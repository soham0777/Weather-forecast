// Minimal, dependency-free SVG chart builders for the trends card.

const W = 640;
const H = 220;
const PAD_X = 28;
const PAD_TOP = 28;
const PAD_BOTTOM = 34;

function scaleX(i, count) {
  if (count <= 1) return W / 2;
  return PAD_X + (i * (W - PAD_X * 2)) / (count - 1);
}

function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function buildTempChart(items, unitSymbol) {
  const temps = items.map((i) => i.temp);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = Math.max(max - min, 4);
  const top = PAD_TOP;
  const bottom = H - PAD_BOTTOM;

  const points = items.map((item, i) => ({
    x: scaleX(i, items.length),
    y: bottom - ((item.temp - min) / range) * (bottom - top),
    ...item,
  }));

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;

  const labelEvery = Math.max(1, Math.round(items.length / 7));
  const labels = points
    .map((p, i) => {
      if (i % labelEvery !== 0 && i !== points.length - 1) return '';
      return `<text x="${p.x}" y="${H - 10}" text-anchor="middle" class="chart-axis-label">${p.label}</text>`;
    })
    .join('');

  const valueLabels = points
    .map((p, i) => {
      if (i % labelEvery !== 0 && i !== points.length - 1) return '';
      return `<text x="${p.x}" y="${p.y - 14}" text-anchor="middle" class="chart-value-label">${Math.round(p.temp)}°</text>`;
    })
    .join('');

  const dots = points
    .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3.2" class="chart-dot"/>`)
    .join('');

  return `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Temperature trend chart">
    <defs>
      <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#tempFill)" stroke="none"/>
    <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
    ${dots}
    ${valueLabels}
    ${labels}
  </svg>`;
}

export function buildPopChart(items) {
  const bottom = H - PAD_BOTTOM;
  const top = PAD_TOP + 20;
  const barW = Math.min(26, ((W - PAD_X * 2) / items.length) * 0.55);

  const bars = items
    .map((item, i) => {
      const x = scaleX(i, items.length) - barW / 2;
      const pct = Math.round(item.pop * 100);
      const barH = (pct / 100) * (bottom - top);
      const y = bottom - barH;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, 2)}" rx="6" fill="var(--accent-2)" fill-opacity="0.75"/>
        ${pct > 0 ? `<text x="${x + barW / 2}" y="${y - 8}" text-anchor="middle" class="chart-value-label">${pct}%</text>` : ''}
      `;
    })
    .join('');

  const labelEvery = Math.max(1, Math.round(items.length / 7));
  const labels = items
    .map((item, i) => {
      if (i % labelEvery !== 0 && i !== items.length - 1) return '';
      const x = scaleX(i, items.length);
      return `<text x="${x}" y="${H - 10}" text-anchor="middle" class="chart-axis-label">${item.label}</text>`;
    })
    .join('');

  return `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Precipitation probability chart">
    <line x1="${PAD_X}" y1="${bottom}" x2="${W - PAD_X}" y2="${bottom}" stroke="var(--divider)" stroke-width="1"/>
    ${bars}
    ${labels}
  </svg>`;
}
