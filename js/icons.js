// Custom hand-drawn SVG weather icon set + condition classification helpers.
// Kept as inline SVG strings (no external icon requests) so the app looks
// distinct from stock weather-icon libraries and stays installable offline.

const SUN = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="sunBody" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#fff6d8"/>
      <stop offset="55%" stop-color="#ffd35c"/>
      <stop offset="100%" stop-color="#ff9d3d"/>
    </radialGradient>
  </defs>
  <g stroke="#ffb545" stroke-width="4" stroke-linecap="round" opacity="0.85">
    <line x1="50" y1="6" x2="50" y2="16"/>
    <line x1="50" y1="84" x2="50" y2="94"/>
    <line x1="6" y1="50" x2="16" y2="50"/>
    <line x1="84" y1="50" x2="94" y2="50"/>
    <line x1="17" y1="17" x2="24" y2="24"/>
    <line x1="76" y1="76" x2="83" y2="83"/>
    <line x1="17" y1="83" x2="24" y2="76"/>
    <line x1="76" y1="24" x2="83" y2="17"/>
  </g>
  <circle cx="50" cy="50" r="26" fill="url(#sunBody)"/>
</svg>`;

const MOON = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="moonBody" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#fdfdff"/>
      <stop offset="60%" stop-color="#dbe3f7"/>
      <stop offset="100%" stop-color="#aeb9e0"/>
    </radialGradient>
  </defs>
  <circle cx="47" cy="12" r="2" fill="#e7ecff" opacity="0.8"/>
  <circle cx="70" cy="24" r="1.4" fill="#e7ecff" opacity="0.7"/>
  <circle cx="30" cy="26" r="1.2" fill="#e7ecff" opacity="0.6"/>
  <path d="M63 18a32 32 0 1 0 19 38 25 25 0 0 1-19-38Z" fill="url(#moonBody)"/>
</svg>`;

function cloudShape(fill, opacity = 1) {
  return `<path d="M27 68c-10 0-18-8-18-18 0-9 7-17 16-18a20 20 0 0 1 39-6 16 16 0 0 1 15 16c0 .8 0 1.6-.1 2.4A14 14 0 0 1 78 68H27Z" fill="${fill}" opacity="${opacity}"/>`;
}

const CLOUDY = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  ${cloudShape('#c7d2e6', 0.9).replace('M27 68', 'M20 74').replace('H78', 'H70')}
  ${cloudShape('#eef2fb')}
</svg>`;

const PARTLY_CLOUDY_DAY = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="pcSun" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#fff6d8"/>
      <stop offset="60%" stop-color="#ffd35c"/>
      <stop offset="100%" stop-color="#ff9d3d"/>
    </radialGradient>
  </defs>
  <circle cx="65" cy="32" r="19" fill="url(#pcSun)"/>
  ${cloudShape('#eef2fb').replace('M27 68', 'M18 78').replace('H78', 'H74')}
</svg>`;

const PARTLY_CLOUDY_NIGHT = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="pcMoon" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#fdfdff"/>
      <stop offset="60%" stop-color="#dbe3f7"/>
      <stop offset="100%" stop-color="#aeb9e0"/>
    </radialGradient>
  </defs>
  <path d="M72 16a17 17 0 1 0 10 20 13 13 0 0 1-10-20Z" fill="url(#pcMoon)"/>
  ${cloudShape('#c9d3e8').replace('M27 68', 'M18 78').replace('H78', 'H74')}
</svg>`;

const RAIN = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  ${cloudShape('#9fb0cf').replace('M27 68', 'M20 60').replace('H78', 'H72')}
  <g stroke="#5f8fe0" stroke-width="4" stroke-linecap="round">
    <line x1="34" y1="72" x2="29" y2="88"/>
    <line x1="50" y1="72" x2="45" y2="92"/>
    <line x1="66" y1="72" x2="61" y2="88"/>
  </g>
</svg>`;

const THUNDERSTORM = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  ${cloudShape('#6d768f').replace('M27 68', 'M20 56').replace('H78', 'H72')}
  <path d="M52 62 40 82h12l-6 18 22-24H56l8-14Z" fill="#ffd35c"/>
</svg>`;

const SNOW = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  ${cloudShape('#c7d2e6').replace('M27 68', 'M20 58').replace('H78', 'H72')}
  <g fill="#eaf3ff">
    <circle cx="33" cy="80" r="3.4"/>
    <circle cx="50" cy="88" r="3.4"/>
    <circle cx="67" cy="80" r="3.4"/>
  </g>
</svg>`;

const MIST = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#b9c4dc" stroke-width="5" stroke-linecap="round">
    <line x1="16" y1="40" x2="72" y2="40"/>
    <line x1="26" y1="54" x2="84" y2="54"/>
    <line x1="14" y1="68" x2="70" y2="68"/>
    <line x1="30" y1="82" x2="80" y2="82"/>
  </g>
</svg>`;

const ICONS = {
  'clear-day': SUN,
  'clear-night': MOON,
  'partly-cloudy-day': PARTLY_CLOUDY_DAY,
  'partly-cloudy-night': PARTLY_CLOUDY_NIGHT,
  cloudy: CLOUDY,
  rain: RAIN,
  thunderstorm: THUNDERSTORM,
  snow: SNOW,
  mist: MIST,
};

// OWM condition-code -> sky category used both for background + icon set.
export function skyCategory(code) {
  if (code >= 200 && code < 300) return 'thunderstorm';
  if (code >= 300 && code < 600) return 'rain';
  if (code >= 600 && code < 700) return 'snow';
  if (code >= 700 && code < 800) return 'mist';
  if (code === 800) return 'clear';
  if (code === 801) return 'partly-cloudy';
  if (code > 801 && code < 900) return 'clouds';
  return 'clouds';
}

export function isDaytime(unixSeconds, sunrise, sunset) {
  if (!sunrise || !sunset) {
    const h = new Date(unixSeconds * 1000).getUTCHours();
    return h > 6 && h < 18;
  }
  return unixSeconds >= sunrise && unixSeconds < sunset;
}

export function iconKeyFor(code, isDay) {
  const cat = skyCategory(code);
  if (cat === 'clear') return isDay ? 'clear-day' : 'clear-night';
  if (cat === 'partly-cloudy') return isDay ? 'partly-cloudy-day' : 'partly-cloudy-night';
  if (cat === 'clouds') return 'cloudy';
  if (cat === 'rain') return 'rain';
  if (cat === 'thunderstorm') return 'thunderstorm';
  if (cat === 'snow') return 'snow';
  if (cat === 'mist') return 'mist';
  return 'cloudy';
}

export function iconSvg(key) {
  return ICONS[key] || CLOUDY;
}

export function iconDataUri(key) {
  const svg = iconSvg(key);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// sky.css background category (collapses partly-cloudy into clouds for bg variety control)
export function bgSkyCategory(code) {
  const cat = skyCategory(code);
  return cat === 'partly-cloudy' ? 'clouds' : cat;
}
