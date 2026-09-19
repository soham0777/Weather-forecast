// OpenWeatherMap's Air Pollution API reports a 1–5 index (not US AQI 0–500).
export const AQI_LEVELS = {
  1: { label: 'Good', color: '#2ecc9b', desc: 'Air quality is satisfactory.' },
  2: { label: 'Fair', color: '#8bd450', desc: 'Air quality is acceptable.' },
  3: { label: 'Moderate', color: '#ffcc4d', desc: 'Sensitive groups may notice effects.' },
  4: { label: 'Poor', color: '#ff8a4c', desc: 'Health effects possible with prolonged exposure.' },
  5: { label: 'Very Poor', color: '#ff4d6d', desc: 'Health warnings — limit outdoor exertion.' },
};

export function aqiInfo(index) {
  return AQI_LEVELS[index] || AQI_LEVELS[3];
}

export const AQI_COMPONENT_LABELS = {
  pm2_5: 'PM2.5',
  pm10: 'PM10',
  o3: 'Ozone',
  no2: 'NO₂',
  so2: 'SO₂',
  co: 'CO',
};

export function uvInfo(uvi) {
  if (uvi == null) return { label: '—', color: 'var(--ink-3)' };
  if (uvi < 3) return { label: 'Low', color: '#2ecc9b' };
  if (uvi < 6) return { label: 'Moderate', color: '#ffcc4d' };
  if (uvi < 8) return { label: 'High', color: '#ff8a4c' };
  if (uvi < 11) return { label: 'Very High', color: '#ff4d6d' };
  return { label: 'Extreme', color: '#c026d3' };
}
