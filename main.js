// «Más abuelos que nietos» — scrollytelling con datos de los Censos 2017 y 2025
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { ninos: css('--ninos'), mayores: css('--mayores'), neutro: css('--neutro'), text: css('--text'), grid: css('--grid'), muted: css('--muted') };
const es = d3.formatLocale({ decimal: ',', thousands: ' ', grouping: [3] });
const fmt = es.format(',.0f'), fmt1 = es.format(',.1f'), fmt2 = es.format(',.2f'), pct = es.format('+,.0%');
const indice = e => { const n = d3.sum(e.slice(0, 3)); return n ? d3.sum(e.slice(12)) / n : null; };
const grupoColor = i => i < 3 ? C.ninos : i >= 12 ? C.mayores : C.neutro;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tooltip compartido
const tip = document.getElementById('tooltip');
const showTip = (html, x, y) => {
  tip.innerHTML = html; tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(x + 14, innerWidth - r.width - 8) + 'px';
  tip.style.top = Math.max(8, y - r.height - 10) + 'px';
};
const hideTip = () => { tip.hidden = true; };

// Scrollama: una instancia por sección
function scrolly(id, onStep) {
  const steps = document.querySelectorAll(`#${id} .step`);
  scrollama().setup({ step: steps, offset: 0.6 }).onStepEnter(({ element, index, direction }) => {
    steps.forEach(s => s.classList.toggle('activo', s === element));
    onStep(index, direction);
  });
}

// Pirámide centrada reutilizable (sin sexo: el ancho es el valor del grupo)
function piramide(svgEl, { max, etiquetas, unidad = '%' }) {
  const svg = d3.select(svgEl);
  const { width: W, height: H } = svgEl.getBoundingClientRect();
  const labelW = 58, m = { t: 6, b: 6 };
  const y = d3.scaleBand(d3.range(18), [H - m.b, m.t]).padding(0.14);
  const x = d3.scaleLinear([0, max], [0, W - labelW - 8]);
  const cx = labelW + (W - labelW) / 2;
  svg.attr('viewBox', `0 0 ${W} ${H}`);
  svg.append('g').attr('class', 'axis').selectAll('text').data(etiquetas).join('text')
    .attr('x', 0).attr('y', (_, i) => y(i) + y.bandwidth() / 2).attr('dy', '.35em').text(d => d);
  const barras = svg.append('g').selectAll('rect').data(d3.range(18)).join('rect')
    .attr('y', i => y(i)).attr('height', y.bandwidth()).attr('rx', 3).attr('x', cx).attr('width', 0).attr('fill', grupoColor);
  const contornos = svg.append('g').selectAll('rect').data(d3.range(18)).join('rect')
    .attr('y', i => y(i)).attr('height', y.bandwidth()).attr('rx', 3).attr('fill', 'none')
    .attr('stroke', C.text).attr('stroke-width', 1.5).attr('opacity', 0);
  let actual = [], previo = null;
  const fv = v => unidad === '%' ? fmt1(v) + ' %' : fmt(v) + ' personas';
  svg.append('g').selectAll('rect').data(d3.range(18)).join('rect') // zonas de hover más grandes que las barras
    .attr('x', 0).attr('width', W).attr('y', i => y(i)).attr('height', y.step()).attr('fill', 'transparent')
    .on('pointermove', (ev, i) => showTip(`<b>${etiquetas[i]} años</b><br>${previo ? `2017: ${fv(previo[i])}<br>2025: ` : ''}${fv(actual[i])}`, ev.clientX, ev.clientY))
    .on('pointerleave', hideTip);
  return function update(valores, contorno = null, dur = 900) {
    actual = valores; previo = contorno;
    barras.transition().duration(reduceMotion ? 0 : dur).attr('x', i => cx - x(valores[i]) / 2).attr('width', i => x(valores[i]));
    contornos.transition().duration(reduceMotion ? 0 : dur).attr('opacity', contorno ? 0.9 : 0)
      .attr('x', i => cx - x((contorno || valores)[i]) / 2).attr('width', i => x((contorno || valores)[i]));
  };
}

Promise.all([
  d3.json('data/distritos.json'), d3.json('data/nacional.json'), d3.json('data/mapa.geojson'),
]).then(([dist, nac, geo]) => {
  escenaPuntos(nac);
  escenaPiramide(nac);
  escenaMapa(dist, geo);
  escenaPocsi(dist, nac);
  escenaDispersion(dist);
  escenaBuscador(dist, nac);
});

// 1 · Cada punto = 100 niños menores de 5 años
function escenaPuntos(nac) {
  const canvas = document.getElementById('puntos'), ctx = canvas.getContext('2d');
  const N17 = Math.round(nac.edades[0][0] / 100), N25 = Math.round(nac.edades[1][0] / 100);
  const orden = d3.shuffle(d3.range(N17)); // los que «se apagan» son los de rango >= N25
  const alfa = new Float32Array(N17).fill(1);
  const destino = new Float32Array(N17).fill(1);
  let celda, cols, dpr;

  function tamano() {
    dpr = devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
    celda = Math.sqrt((canvas.width * canvas.height) / N17);
    cols = Math.floor(canvas.width / celda);
    celda = canvas.width / cols;
    dibujar();
  }
  function dibujar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = C.ninos;
    const s = celda * 0.55, off = (celda - s) / 2;
    for (let k = 0; k < N17; k++) {
      ctx.globalAlpha = alfa[k];
      ctx.fillRect((k % cols) * celda + off, Math.floor(k / cols) * celda + off, s, s);
    }
    ctx.globalAlpha = 1;
  }
  let anim;
  function animar() {
    if (anim) anim.stop();
    const desde = Float32Array.from(alfa), retraso = orden.map(() => Math.random() * 900);
    anim = d3.timer(t => {
      let fin = true;
      for (let k = 0; k < N17; k++) {
        const p = Math.min(1, Math.max(0, (t - retraso[k]) / 600));
        if (p < 1) fin = false;
        alfa[k] = desde[k] + (destino[k] - desde[k]) * (reduceMotion ? 1 : p);
      }
      dibujar();
      if (fin || reduceMotion) anim.stop();
    });
  }
  const contador = d3.select('#contador-n'), caja = document.querySelector('.contador');
  let valorContador = nac.edades[0][0];
  function contar(a, etiqueta, clase) {
    caja.classList.toggle('mayores', clase === 'mayores');
    caja.querySelector('small').textContent = etiqueta;
    const i = d3.interpolateRound(valorContador, a);
    contador.transition().duration(reduceMotion ? 0 : 1400).tween('text', () => t => contador.text(fmt(valorContador = i(t))));
  }
  const may = e => d3.sum(e.slice(12));
  scrolly('s-puntos', paso => {
    for (let k = 0; k < N17; k++) destino[k] = paso === 0 ? 1 : paso === 1 ? (orden[k] >= N25 ? 0.07 : 1) : (orden[k] >= N25 ? 0.04 : 0.25);
    animar();
    if (paso === 0) contar(nac.edades[0][0], 'niños menores de 5 años · 2017');
    if (paso === 1) contar(nac.edades[1][0], 'niños menores de 5 años · 2025');
    if (paso === 2) { valorContador = may(nac.edades[0]); contar(may(nac.edades[1]), 'adultos de 60 años o más · 2025', 'mayores'); }
  });
  addEventListener('resize', tamano);
  tamano();
}

// 2 · Pirámide nacional
function escenaPiramide(nac) {
  const p = nac.edades.map(e => { const t = d3.sum(e); return e.map(v => (100 * v) / t); });
  const update = piramide(document.getElementById('piramide'), { max: d3.max(p.flat()) * 1.05, etiquetas: nac.etiquetas });
  update(p[0], null, 0);
  const anio = document.getElementById('piramide-anio');
  scrolly('s-piramide', paso => {
    anio.textContent = paso === 0 ? '2017' : '2025';
    update(paso === 0 ? p[0] : p[1], paso === 0 ? null : p[0]);
  });
}

// 3 · Mapa 3D: altura y color según adultos mayores por niño
function escenaMapa(dist, geo) {
  const neutro = d3.rgb('#383835');
  const azul = d3.interpolateLab(neutro, C.ninos), naranja = d3.interpolateLab(neutro, C.mayores);
  const color = idx => {
    if (idx == null) return [45, 45, 42];
    const t = Math.max(-2, Math.min(2, Math.log2(Math.max(idx, 0.01)))); // ¼ … 4 en escala log
    const c = d3.rgb(t < 0 ? azul(-t / 2) : naranja(t / 2));
    return [c.r, c.g, c.b];
  };
  // Precalcular índices por año
  geo.features.forEach(f => {
    const d = dist[f.properties.u];
    f.properties.i = d ? [d[3] ? indice(d[7]) : null, indice(d[8])] : [null, null];
  });
  const movil = innerWidth < 700;
  // En escritorio el texto va a la izquierda: corremos el centro para que el foco quede a la derecha
  const corrida = movil ? 0 : Math.min(240, innerWidth * 0.17);
  const vista = (longitude, latitude, zoom, bearing, escala, foco) =>
    ({ longitude: longitude - (corrida * 360) / (512 * 2 ** zoom), latitude, zoom, pitch: 52, bearing, escala, foco });
  const vistas = [
    vista(-75.2, -9.6, movil ? 4.5 : 5.0, -12, 1),
    vista(-75.2, -9.6, movil ? 4.5 : 5.0, -12, 1),
    vista(-76.75, -11.4, movil ? 7.3 : 8.2, 20, 0.25, '150611'),
    vista(-77.0, -12.1, movil ? 9 : 9.8, -20, 0.08, '150131'),
    vista(-71.42, -16.52, movil ? 7.6 : 8.6, 30, 0.25, '040113'),
  ];
  const porUbigeo = new Map(geo.features.map(f => [f.properties.u, f]));
  let anio = 0, escala = 1, foco = null;
  const altura = f => Math.min(f.properties.i[anio] ?? 0, 6) * 14000;
  const capas = () => [new deck.GeoJsonLayer({
    id: 'distritos', data: geo, extruded: true, pickable: true, autoHighlight: true, highlightColor: [255, 255, 255, 70],
    getFillColor: f => f.properties.u === foco ? [255, 236, 220] : color(f.properties.i[anio]),
    getElevation: altura,
    elevationScale: escala, getLineColor: [17, 17, 16], lineWidthMinPixels: 0.5, wireframe: false,
    material: { ambient: 0.55, diffuse: 0.6, shininess: 24, specularColor: [60, 60, 60] },
    updateTriggers: { getFillColor: [anio, foco], getElevation: anio },
    transitions: reduceMotion ? {} : { getFillColor: 1000, getElevation: { duration: 1200, easing: d3.easeCubicInOut } },
  }), new deck.TextLayer({
    id: 'etiqueta', data: foco ? [porUbigeo.get(foco)] : [],
    getPosition: f => [...d3.geoCentroid(f), altura(f) * escala + 300],
    getText: f => dist[f.properties.u][0], getSize: 18, getColor: [240, 239, 236], fontFamily: 'Inter, sans-serif', fontWeight: 600,
    getPixelOffset: [0, -18], background: true, getBackgroundColor: [26, 26, 25, 230], backgroundPadding: [8, 4], characterSet: 'auto',
    updateTriggers: { getPosition: [anio, escala] },
  })];
  const mapa = new deck.Deck({
    parent: document.getElementById('mapa'),
    initialViewState: vistas[0],
    controller: matchMedia('(pointer: fine)').matches ? { scrollZoom: false } : false,
    layers: capas(),
    getTooltip: ({ object: f }) => {
      if (!f) return null;
      const d = dist[f.properties.u];
      if (!d) return { text: 'Sin datos' };
      const [a, b] = f.properties.i;
      return {
        html: `<b>${d[0]}</b><br><span class="m">${d[1]}, ${d[2]}</span><br>Mayores por niño: ${a == null ? '—' : fmt2(a)} → <b>${fmt2(b)}</b><br>Habitantes 2025: ${fmt(d[4])}`,
        style: { background: '#1a1a19', color: C.text, border: `1px solid ${C.grid}`, borderRadius: '8px', fontFamily: 'Inter, sans-serif', fontSize: '13px', padding: '8px 12px' },
      };
    },
  });
  const anioEl = document.getElementById('mapa-anio');
  scrolly('s-mapa', paso => {
    anio = paso === 0 ? 0 : 1;
    anioEl.textContent = anio ? '2025' : '2017';
    const v = vistas[paso], desde = escala;
    foco = v.foco ?? null;
    d3.transition().duration(reduceMotion ? 0 : 2200).tween('escala', () => t => {
      escala = desde + (v.escala - desde) * t; mapa.setProps({ layers: capas() });
    });
    mapa.setProps({
      initialViewState: { ...v, transitionDuration: reduceMotion ? 0 : 2200, transitionInterpolator: new deck.FlyToInterpolator() },
      layers: capas(),
    });
  });
}

// 4 · Pocsi: personas por grupo de edad, misma escala en ambos años
function escenaPocsi(dist, nac) {
  const d = dist['040113'], max = d3.max([...d[7], ...d[8]]) * 1.05;
  piramide(document.getElementById('pocsi-17'), { max, etiquetas: nac.etiquetas, unidad: 'personas' })(d[7], null, 0);
  piramide(document.getElementById('pocsi-25'), { max, etiquetas: nac.etiquetas, unidad: 'personas' })(d[8], null, 0);
}

// 5 · Dispersión: cambio de población vs. índice 2025
function escenaDispersion(dist) {
  const puntos = Object.values(dist)
    .filter(d => d[3] > 0 && d[4] > 0 && indice(d[8]) > 0)
    .map(d => ({ d, r: d[4] / d[3], i: indice(d[8]) }));
  const svgEl = document.getElementById('dispersion'), svg = d3.select(svgEl);
  const { width: W, height: H } = svgEl.getBoundingClientRect(), m = { t: 12, r: 12, b: 44, l: 52 };
  svg.attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3.scaleLog([0.2, 6], [m.l, W - m.r]).clamp(true);
  const y = d3.scaleLog([0.08, 8], [H - m.b, m.t]).clamp(true);
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickValues([0.25, 0.5, 1, 2, 4]).tickFormat(r => pct(r - 1)).tickSize(-(H - m.t - m.b)))
    .call(g => g.select('.domain').remove());
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).tickValues([0.1, 0.25, 0.5, 1, 2, 4]).tickFormat(fmt2).tickSize(-(W - m.l - m.r)))
    .call(g => g.select('.domain').remove());
  svg.append('text').attr('class', 'axis').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').attr('fill', C.muted).attr('font-size', 12).text('cambio de población 2017→2025 →');
  svg.append('text').attr('x', m.l + 4).attr('y', m.t + 12).attr('fill', C.muted).attr('font-size', 12).text('↑ mayores por niño, 2025');
  // Referencias: población estable e índice = 1
  svg.append('line').attr('x1', x(1)).attr('x2', x(1)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', C.muted).attr('stroke-dasharray', '3 3');
  svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(1)).attr('y2', y(1)).attr('stroke', C.muted).attr('stroke-dasharray', '3 3');
  svg.append('g').selectAll('circle').data(puntos).join('circle')
    .attr('cx', p => x(p.r)).attr('cy', p => y(p.i)).attr('r', 3)
    .attr('fill', p => p.i > 1 ? C.mayores : C.ninos).attr('fill-opacity', 0.55);
  // Anotaciones
  const anot = ['Pocsi', 'San Isidro', 'Alis'];
  const ann = svg.append('g');
  puntos.filter(p => anot.includes(p.d[0]) && (p.d[0] === 'Pocsi' || p.d[2] === 'Lima')).forEach(p => {
    ann.append('circle').attr('cx', x(p.r)).attr('cy', y(p.i)).attr('r', 5).attr('fill', 'none').attr('stroke', C.text).attr('stroke-width', 1.5);
    ann.append('text').attr('x', x(p.r) + 8).attr('y', y(p.i) + 4).attr('fill', C.text).attr('font-size', 12).text(p.d[0]);
  });
  // Hover: punto más cercano
  const delaunay = d3.Delaunay.from(puntos, p => x(p.r), p => y(p.i));
  const marca = svg.append('circle').attr('r', 6).attr('fill', 'none').attr('stroke', C.text).attr('stroke-width', 2).attr('opacity', 0);
  svg.on('pointermove', ev => {
    const [px, py] = d3.pointer(ev), p = puntos[delaunay.find(px, py)];
    if (Math.hypot(x(p.r) - px, y(p.i) - py) > 24) { marca.attr('opacity', 0); return hideTip(); }
    marca.attr('cx', x(p.r)).attr('cy', y(p.i)).attr('opacity', 1);
    showTip(`<b>${p.d[0]}</b><br><span class="m">${p.d[1]}, ${p.d[2]}</span><br>Población: ${pct(p.r - 1)}<br>Mayores por niño: ${fmt2(p.i)}`, ev.clientX, ev.clientY);
  }).on('pointerleave', () => { marca.attr('opacity', 0); hideTip(); });
}

// 6 · Buscador de distritos
function escenaBuscador(dist, nac) {
  const nombre = (u, d) => `${d[0]}, ${d[1]}, ${d[2]}`;
  const porNombre = new Map(Object.entries(dist).map(([u, d]) => [nombre(u, d), u]));
  document.getElementById('lista-distritos').innerHTML = [...porNombre.keys()].sort((a, b) => a.localeCompare(b, 'es'))
    .map(n => `<option value="${n}">`).join('');
  const ranking = Object.entries(dist).filter(([, d]) => d[3] > 0 && indice(d[8]) != null)
    .sort((a, b) => indice(b[1][8]) - indice(a[1][8])).map(([u]) => u);
  const ficha = document.getElementById('ficha');
  document.getElementById('buscar').addEventListener('input', ev => {
    const u = porNombre.get(ev.target.value);
    if (!u) return;
    const d = dist[u], a = d[3] ? indice(d[7]) : null, b = indice(d[8]);
    ficha.hidden = false;
    document.getElementById('ficha-nombre').textContent = nombre(u, d);
    document.getElementById('ficha-indice').textContent = `${a == null ? '—' : fmt2(a)} → ${b == null ? '—' : fmt2(b)}`;
    document.getElementById('ficha-pob').textContent = `${d[3] ? fmt(d[3]) : '—'} → ${fmt(d[4])}`;
    const r = ranking.indexOf(u);
    document.getElementById('ficha-rank').textContent = r < 0 ? 'Distrito nuevo' : `${fmt(r + 1)} de ${fmt(ranking.length)}`;
    const p = [d[7], d[8]].map(e => { const t = d3.sum(e); return t ? e.map(v => (100 * v) / t) : null; });
    const svg = document.getElementById('ficha-piramide');
    svg.replaceChildren();
    piramide(svg, { max: d3.max(p.filter(Boolean).flat()) * 1.05, etiquetas: nac.etiquetas })(p[1], d[3] ? p[0] : null, 0);
  });
}
