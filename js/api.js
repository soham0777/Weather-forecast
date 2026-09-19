// Thin wrapper around the OpenWeatherMap REST APIs used by the app.
import { getApiKey } from './config.js';

const BASE = 'https://api.openweathermap.org';

class WeatherApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'WeatherApiError';
    this.status = status;
  }
}

async function request(path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  url.searchParams.set('appid', getApiKey());

  let response;
  try {
    response = await fetch(url.toString());
  } catch {
    throw new WeatherApiError('Network error — check your connection and try again.', 0);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new WeatherApiError('We couldn’t find that place. Try a different spelling.', 404);
    }
    if (response.status === 401) {
      throw new WeatherApiError('Invalid API key. Add a valid OpenWeatherMap key in Settings.', 401);
    }
    if (response.status === 429) {
      throw new WeatherApiError('Too many requests right now. Please wait a moment and try again.', 429);
    }
    throw new WeatherApiError('The weather service is unavailable right now.', response.status);
  }

  return response.json();
}

export function geocodeCity(query, limit = 5) {
  return request('/geo/1.0/direct', { q: query, limit });
}

export function reverseGeocode(lat, lon) {
  return request('/geo/1.0/reverse', { lat, lon, limit: 1 });
}

export function getCurrentWeather(lat, lon, units) {
  return request('/data/2.5/weather', { lat, lon, units });
}

export function getForecast(lat, lon, units) {
  return request('/data/2.5/forecast', { lat, lon, units });
}

export function getAirPollution(lat, lon) {
  return request('/data/2.5/air_pollution', { lat, lon });
}

// UV index endpoint is legacy/deprecated on some plans — treat failure as optional data.
export async function getUvIndex(lat, lon) {
  try {
    return await request('/data/2.5/uvi', { lat, lon });
  } catch {
    return null;
  }
}

export { WeatherApiError };
