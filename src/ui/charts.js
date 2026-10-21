import { html, useState, useRef, useLayoutEffect } from '../lib.js';
import { formatDateShort } from '../format.js';

// Grafy ako čisté SVG (bez knižnice). Jedna séria = akcentová farba, mriežka a popisy v textových tokenoch.
// Interakcia: ťuknutie / ťahanie prstom (alebo šípky na klávesnici) ukáže hodnotu najbližšieho bodu.

/** Šírka kontajnera v px (sleduje zmeny rozmeru). */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Pekné hodnoty osi: ~count dielikov s krokom 1 / 2 / 2,5 / 5 × 10^k. */
export function niceTicks(min, max, count = 3) {
  if (min === max) { const d = Math.abs(min) * 0.1 || 1; min -= d; max += d; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** Index bodu najbližšieho k x (px). */
function nearest(xs, x) {
  let best = 0;
  xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = i; });
  return best;
}

/** Spoločná interakcia: aktívny index z ukazovateľa a klávesnice. */
function useActive(xs) {
  const [active, setActive] = useState(null);
  const svgRef = useRef(null);
  const fromEvent = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    setActive(nearest(xs, e.clientX - r.left));
  };
  const handlers = {
    onPointerDown: fromEvent,
    onPointerMove: fromEvent,
    onPointerLeave: (e) => { if (e.pointerType === 'mouse') setActive(null); },
    onKeyDown: (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const d = e.key === 'ArrowRight' ? 1 : -1;
        setActive((a) => Math.min(xs.length - 1, Math.max(0, a === null ? (d > 0 ? 0 : xs.length - 1) : a + d)));
      } else if (e.key === 'Escape') setActive(null);
    },
    onBlur: () => setActive(null),
  };
  return { active, svgRef, handlers };
}

function Tooltip({ x, width, title, value, detail }) {
  const w = 168;
  const left = Math.min(Math.max(x - w / 2, 0), Math.max(0, width - w));
  return html`
    <div class="chart-tip" style=${`left:${left}px;width:${w}px`} role="status">
      <div class="chart-tip-value">${value}</div>
      <div class="chart-tip-label">${title}${detail ? ` · ${detail}` : ''}</div>
    </div>`;
}

const PAD = { top: 28, right: 16, bottom: 24, left: 44 };

/**
 * Čiarový graf hodnôt v čase.
 * points: [{ t, value }]; format(v) → text hodnoty; axisFormat(v) → text na osi; detail(p) → doplnok v bubline
 */
export function LineChart({ points, format, axisFormat = format, detail, height = 200, label }) {
  const [wrapRef, width] = useWidth();
  const n = points.length;
  const w = Math.max(width, 200);
  const innerW = w - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const values = points.map((p) => p.value);
  const ticks = n ? niceTicks(Math.min(...values), Math.max(...values)) : [0, 1];
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (v) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const t0 = points[0]?.t;
  const t1 = points[n - 1]?.t;
  const x = (t) => (n < 2 || t1 === t0 ? PAD.left + innerW / 2 : PAD.left + ((t - t0) / (t1 - t0)) * innerW);
  const xs = points.map((p) => x(p.t));
  const { active, svgRef, handlers } = useActive(xs);

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = n > 1 ? `${line}L${xs[n - 1].toFixed(1)},${PAD.top + innerH}L${xs[0].toFixed(1)},${PAD.top + innerH}Z` : '';
  const last = points[n - 1];
  const a = active !== null ? points[active] : null;

  return html`
    <div class="chart" ref=${wrapRef}>
      ${width > 0 && n > 0 && html`
        <svg ref=${svgRef} width=${w} height=${height} class="chart-svg" tabindex="0" role="img"
          aria-label=${label} ...${handlers}>
          ${ticks.map((v) => html`
            <g key=${v}>
              <line class="chart-grid" x1=${PAD.left} x2=${w - PAD.right} y1=${y(v)} y2=${y(v)} />
              <text class="chart-axis" x=${PAD.left - 8} y=${y(v) + 4} text-anchor="end">${axisFormat(v)}</text>
            </g>`)}
          <text class="chart-axis" x=${xs[0]} y=${height - 6} text-anchor=${n > 1 ? 'start' : 'middle'}>${formatDateShort(t0)}</text>
          ${n > 1 && html`<text class="chart-axis" x=${xs[n - 1]} y=${height - 6} text-anchor="end">${formatDateShort(t1)}</text>`}
          ${area && html`<path class="chart-area" d=${area} />`}
          ${n > 1 && html`<path class="chart-line" d=${line} />`}
          ${a && html`<line class="chart-cross" x1=${xs[active]} x2=${xs[active]} y1=${PAD.top - 8} y2=${PAD.top + innerH} />`}
          ${points.map((p, i) => (n <= 24 || i === n - 1 || i === active) && html`
            <circle key=${i} class=${`chart-dot ${i === active ? 'active' : ''}`} cx=${xs[i]} cy=${y(p.value)}
              r=${i === active || i === n - 1 ? 5 : 3.5} />`)}
          ${!a && html`
            <text class="chart-end" x=${Math.min(xs[n - 1], w - PAD.right)} y=${y(last.value) - 12}
              text-anchor=${n > 1 ? 'end' : 'middle'}>${format(last.value)}</text>`}
        </svg>
        ${a && html`<${Tooltip} x=${xs[active]} width=${w} title=${formatDateShort(a.t)} value=${format(a.value)}
          detail=${detail?.(a)} />`}`}
    </div>`;
}

/**
 * Stĺpcový graf (napr. týždenný objem). bars: [{ t, value }]; format(v) → text; title(bar) → popis v bubline.
 */
export function BarChart({ bars, format, axisFormat = format, title, height = 180, label }) {
  const [wrapRef, width] = useWidth();
  const n = bars.length;
  const w = Math.max(width, 200);
  const innerW = w - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const max = Math.max(0, ...bars.map((b) => b.value));
  const ticks = max > 0 ? niceTicks(0, max) : [0];
  const yMax = ticks[ticks.length - 1] || 1;
  const y = (v) => PAD.top + innerH - (v / yMax) * innerH;
  const band = innerW / Math.max(n, 1);
  const barW = Math.max(2, Math.min(24, band - 2));
  const xs = bars.map((_, i) => PAD.left + band * i + band / 2);
  const { active, svgRef, handlers } = useActive(xs);
  const maxIdx = bars.reduce((m, b, i) => (b.value > bars[m].value ? i : m), 0);
  const base = PAD.top + innerH;

  // Stĺpec so zaobleným vrchom (4 px) a rovnou základňou.
  const barPath = (cx, top) => {
    const h = base - top;
    if (h <= 0) return '';
    const r = Math.min(4, barW / 2, h);
    const l = cx - barW / 2;
    const rr = cx + barW / 2;
    return `M${l},${base}V${top + r}Q${l},${top} ${l + r},${top}H${rr - r}Q${rr},${top} ${rr},${top + r}V${base}Z`;
  };
  const a = active !== null ? bars[active] : null;

  return html`
    <div class="chart" ref=${wrapRef}>
      ${width > 0 && n > 0 && html`
        <svg ref=${svgRef} width=${w} height=${height} class="chart-svg" tabindex="0" role="img"
          aria-label=${label} ...${handlers}>
          ${ticks.map((v) => html`
            <g key=${v}>
              <line class="chart-grid" x1=${PAD.left} x2=${w - PAD.right} y1=${y(v)} y2=${y(v)} />
              <text class="chart-axis" x=${PAD.left - 8} y=${y(v) + 4} text-anchor="end">${axisFormat(v)}</text>
            </g>`)}
          ${bars.map((b, i) => html`
            <path key=${i} class=${`chart-bar ${active !== null && i !== active ? 'dim' : ''}`} d=${barPath(xs[i], y(b.value))} />`)}
          ${!a && max > 0 && html`
            <text class="chart-end" x=${Math.min(Math.max(xs[maxIdx], PAD.left + 20), w - PAD.right - 20)} y=${y(max) - 8}
              text-anchor="middle">${format(max)}</text>`}
          <text class="chart-axis" x=${xs[0] - barW / 2} y=${height - 6} text-anchor="start">${formatDateShort(bars[0].t)}</text>
          ${n > 1 && html`<text class="chart-axis" x=${xs[n - 1] + barW / 2} y=${height - 6} text-anchor="end">${formatDateShort(bars[n - 1].t)}</text>`}
        </svg>
        ${a && html`<${Tooltip} x=${xs[active]} width=${w} title=${title(a)} value=${format(a.value)} />`}`}
    </div>`;
}

/** Malý graf trendu v riadku zoznamu (bez osí a interakcie). */
export function Sparkline({ points, width = 72, height = 28 }) {
  if (points.length < 2) return html`<span class="spark-empty" style=${`width:${width}px`} />`;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = 4;
  const x = (i) => pad + (i / (points.length - 1)) * (width - 2 * pad);
  const y = (v) => (max === min ? height / 2 : pad + (1 - (v - min) / (max - min)) * (height - 2 * pad));
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const lx = x(vals.length - 1);
  const ly = y(vals[vals.length - 1]);
  return html`
    <svg class="spark" width=${width} height=${height} viewBox=${`0 0 ${width} ${height}`} aria-hidden="true">
      <path d=${d} />
      <circle cx=${lx} cy=${ly} r="3" />
    </svg>`;
}
