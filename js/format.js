// Small, dependency-free formatting helpers.

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'NW', 'NNW', 'NW'];

export function windDirection(deg) {
  if (deg == null) return '—';
  const idx = Math.round(deg / 22.5) % 16;
  return COMPASS[idx];
}

export function windSpeedDisplay(speedMs, units) {
  if (units === 'imperial') return { value: Math.round(speedMs), unit: 'mph' };
  return { value: Math.round(speedMs * 3.6), unit: 'km/h' };
}

export function visibilityDisplay(meters, units) {
  if (meters == null) return { value: '—', unit: 'km', desc: '—' };
  const km = meters / 1000;
  const value = units === 'imperial' ? (km * 0.621371).toFixed(1) : Math.round(km);
  const unit = units === 'imperial' ? 'mi' : 'km';
  let desc = 'Excellent';
  if (km < 1) desc = 'Very poor';
  else if (km < 4) desc = 'Poor';
  else if (km < 10) desc = 'Moderate';
  return { value, unit, desc };
}

export function formatTimeAt(unixSeconds, tzOffsetSeconds, opts = {}) {
  const shifted = new Date((unixSeconds + tzOffsetSeconds) * 1000);
  const h = shifted.getUTCHours();
  const m = shifted.getUTCMinutes();
  if (opts.hourOnly) {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${h >= 12 ? 'pm' : 'am'}`;
  }
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(m).padStart(2, '0');
  return `${h12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function formatDayLabel(unixSeconds, tzOffsetSeconds, index) {
  if (index === 0) return 'Today';
  const shifted = new Date((unixSeconds + tzOffsetSeconds) * 1000);
  return shifted.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

export function formatDateLabel(unixSeconds, tzOffsetSeconds) {
  const shifted = new Date((unixSeconds + tzOffsetSeconds) * 1000);
  return shifted.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function formatFullDate(unixSeconds, tzOffsetSeconds) {
  const shifted = new Date((unixSeconds + tzOffsetSeconds) * 1000);
  return shifted.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

export function durationLabel(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m of daylight`;
}

export function tempUnitSymbol(units) {
  return units === 'imperial' ? '°F' : '°C';
}
