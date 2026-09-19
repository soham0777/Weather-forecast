// Turns the free-tier "5 day / 3 hour" forecast list into hourly + daily views.
import { iconKeyFor, isDaytime } from './icons.js';
import { formatTimeAt, formatDayLabel, formatDateLabel } from './format.js';

export function buildHourly(list, tzOffset, sunrise, sunset, limit = 12) {
  return list.slice(0, limit).map((entry) => {
    const isDay = isDaytime(entry.dt, sunrise, sunset);
    const code = entry.weather[0].id;
    return {
      time: entry.dt,
      label: formatTimeAt(entry.dt, tzOffset, { hourOnly: true }),
      temp: entry.main.temp,
      feelsLike: entry.main.feels_like,
      pop: entry.pop || 0,
      icon: iconKeyFor(code, isDay),
      description: entry.weather[0].description,
      wind: entry.wind,
      humidity: entry.main.humidity,
    };
  });
}

export function buildDaily(list, tzOffset) {
  const byDate = new Map();

  list.forEach((entry) => {
    const shifted = new Date((entry.dt + tzOffset) * 1000);
    const dateKey = shifted.toISOString().slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey).push(entry);
  });

  const days = [...byDate.entries()].map(([, entries], index) => {
    const temps = entries.map((e) => e.main.temp);
    const tempMin = Math.min(...entries.map((e) => e.main.temp_min ?? e.main.temp));
    const tempMax = Math.max(...entries.map((e) => e.main.temp_max ?? e.main.temp));
    const pop = Math.max(...entries.map((e) => e.pop || 0));
    const humidity = Math.round(entries.reduce((sum, e) => sum + e.main.humidity, 0) / entries.length);
    const windSpeed = entries.reduce((sum, e) => sum + e.wind.speed, 0) / entries.length;

    // Representative slot: closest to local midday, for icon + description.
    const midday = entries.reduce((best, e) => {
      const hour = new Date((e.dt + tzOffset) * 1000).getUTCHours();
      const bestHour = new Date((best.dt + tzOffset) * 1000).getUTCHours();
      return Math.abs(hour - 13) < Math.abs(bestHour - 13) ? e : best;
    }, entries[0]);

    const code = midday.weather[0].id;
    const refDt = entries[0].dt;

    return {
      dt: refDt,
      dayLabel: formatDayLabel(refDt, tzOffset, index),
      dateLabel: formatDateLabel(refDt, tzOffset),
      tempMin,
      tempMax,
      avgTemp: temps.reduce((a, b) => a + b, 0) / temps.length,
      pop,
      humidity,
      windSpeed,
      description: midday.weather[0].description,
      icon: iconKeyFor(code, true),
      entries,
    };
  });

  return days;
}

export function globalTempRange(days) {
  const min = Math.min(...days.map((d) => d.tempMin));
  const max = Math.max(...days.map((d) => d.tempMax));
  return { min, max: Math.max(max, min + 1) };
}
