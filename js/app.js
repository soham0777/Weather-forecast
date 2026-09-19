// Main application controller — wires DOM events to the API, state and UI layers.
import * as api from './api.js';
import * as cfg from './config.js';
import { initSkyParticles } from './sky-fx.js';
import { iconKeyFor, isDaytime, bgSkyCategory } from './icons.js';
import { buildHourly, buildDaily, globalTempRange } from './forecast.js';
import * as ui from './ui.js';

let units = cfg.getUnits();
let currentCoords = null;
let suggestionItems = [];
let activeSuggestionIndex = -1;
let searchDebounce = null;

/* ------------------------------------------------------------------ */
/*  Theme                                                              */
/* ------------------------------------------------------------------ */

function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', pref);
  }
  document.querySelectorAll('[data-theme-choice]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.themeChoice === pref);
  });
}

function currentEffectiveTheme() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit) return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function initTheme() {
  const pref = cfg.getThemePref();
  applyTheme(pref);

  document.getElementById('themeBtn').addEventListener('click', () => {
    const next = currentEffectiveTheme() === 'dark' ? 'light' : 'dark';
    cfg.setThemePref(next);
    applyTheme(next);
  });

  document.querySelectorAll('[data-theme-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choice = btn.dataset.themeChoice;
      cfg.setThemePref(choice);
      applyTheme(choice);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Units                                                              */
/* ------------------------------------------------------------------ */

function initUnits() {
  const cBtn = document.getElementById('unitC');
  const fBtn = document.getElementById('unitF');

  const reflect = () => {
    cBtn.classList.toggle('is-active', units === 'metric');
    fBtn.classList.toggle('is-active', units === 'imperial');
    cBtn.setAttribute('aria-pressed', String(units === 'metric'));
    fBtn.setAttribute('aria-pressed', String(units === 'imperial'));
  };
  reflect();

  const switchTo = async (next) => {
    if (units === next) return;
    units = next;
    cfg.setUnits(units);
    reflect();
    if (currentCoords) await loadWeather(currentCoords, { silent: true });
  };

  cBtn.addEventListener('click', () => switchTo('metric'));
  fBtn.addEventListener('click', () => switchTo('imperial'));
}

/* ------------------------------------------------------------------ */
/*  Settings modal                                                     */
/* ------------------------------------------------------------------ */

function initSettings() {
  const overlay = document.getElementById('settingsOverlay');
  const openBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('settingsClose');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveBtn = document.getElementById('saveSettings');

  const open = () => {
    apiKeyInput.value = localStorage.getItem('aurora.apiKey') || '';
    overlay.classList.add('is-open');
  };
  const close = () => overlay.classList.remove('is-open');

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });

  saveBtn.addEventListener('click', async () => {
    cfg.setApiKey(apiKeyInput.value.trim());
    close();
    ui.showToast('Settings saved', 'success');
    if (currentCoords) await loadWeather(currentCoords, { silent: true });
  });
}

/* ------------------------------------------------------------------ */
/*  Search + geocoding autocomplete                                    */
/* ------------------------------------------------------------------ */

function closeSuggestions() {
  const list = document.getElementById('suggestions');
  list.classList.remove('is-open');
  list.innerHTML = '';
  activeSuggestionIndex = -1;
  document.getElementById('citySearch').setAttribute('aria-expanded', 'false');
}

function renderSuggestions(items) {
  suggestionItems = items;
  const list = document.getElementById('suggestions');
  if (!items.length) {
    closeSuggestions();
    return;
  }
  list.innerHTML = items.map((item, i) => {
    const locality = [item.state, item.country].filter(Boolean).join(', ');
    return `
      <li role="option" id="sugg-${i}">
        <button type="button" class="suggestion" data-index="${i}">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" stroke="currentColor" stroke-width="1.8"/></svg>
          <span><strong>${item.name}</strong> <span class="locality">${locality}</span></span>
        </button>
      </li>`;
  }).join('');
  list.classList.add('is-open');
  document.getElementById('citySearch').setAttribute('aria-expanded', 'true');

  list.querySelectorAll('.suggestion').forEach((btn) => {
    btn.addEventListener('click', () => selectSuggestion(Number(btn.dataset.index)));
  });
}

function selectSuggestion(index) {
  const item = suggestionItems[index];
  if (!item) return;
  document.getElementById('citySearch').value = item.name;
  closeSuggestions();
  const label = [item.name, item.state, item.country].filter(Boolean).join(', ');
  loadWeather({ lat: item.lat, lon: item.lon, name: item.name, country: item.country }, {});
  cfg.pushRecent({ key: `${item.lat},${item.lon}`, name: label, lat: item.lat, lon: item.lon, placeName: item.name, country: item.country });
}

function initSearch() {
  const input = document.getElementById('citySearch');
  const clearBtn = document.getElementById('clearSearch');
  const form = document.getElementById('searchForm');

  input.addEventListener('input', () => {
    clearBtn.classList.toggle('is-visible', input.value.length > 0);
    clearTimeout(searchDebounce);
    const q = input.value.trim();
    if (q.length < 2) {
      closeSuggestions();
      return;
    }
    searchDebounce = setTimeout(async () => {
      try {
        const results = await api.geocodeCity(q);
        renderSuggestions(results);
      } catch {
        closeSuggestions();
      }
    }, 320);
  });

  input.addEventListener('keydown', (e) => {
    const list = document.getElementById('suggestions');
    if (!list.classList.contains('is-open')) return;
    const options = [...list.querySelectorAll('.suggestion')];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, options.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0) selectSuggestion(activeSuggestionIndex);
      return;
    } else if (e.key === 'Escape') {
      closeSuggestions();
      return;
    } else {
      return;
    }
    options.forEach((opt, i) => opt.classList.toggle('is-active', i === activeSuggestionIndex));
    options[activeSuggestionIndex]?.scrollIntoView({ block: 'nearest' });
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.remove('is-visible');
    closeSuggestions();
    input.focus();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (suggestionItems.length) selectSuggestion(0);
  });

  document.addEventListener('click', (e) => {
    if (!form.contains(e.target)) closeSuggestions();
  });
}

/* ------------------------------------------------------------------ */
/*  Geolocation                                                        */
/* ------------------------------------------------------------------ */

function initGeolocation() {
  const btn = document.getElementById('locateBtn');
  btn.addEventListener('click', () => useMyLocation({ silent: false }));
}

function useMyLocation({ silent }) {
  if (!('geolocation' in navigator)) {
    if (!silent) ui.showToast('Geolocation is not supported in this browser.', 'error');
    return;
  }
  const btn = document.getElementById('locateBtn');
  btn.classList.add('is-loading');

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      btn.classList.remove('is-loading');
      const { latitude, longitude } = pos.coords;
      let name = 'Your location';
      let country = '';
      try {
        const rev = await api.reverseGeocode(latitude, longitude);
        if (rev[0]) { name = rev[0].name; country = rev[0].country; }
      } catch { /* fall back to generic label */ }
      loadWeather({ lat: latitude, lon: longitude, name, country }, {});
    },
    () => {
      btn.classList.remove('is-loading');
      if (!silent) ui.showToast('Location access was denied. Try searching instead.', 'error');
      else ui.showState('empty');
    },
    { timeout: 10000 },
  );
}

/* ------------------------------------------------------------------ */
/*  Core weather loading                                               */
/* ------------------------------------------------------------------ */

async function loadWeather({ lat, lon, name, country }, { silent = false } = {}) {
  currentCoords = { lat, lon, name, country };
  if (!silent) ui.showState('loading');

  try {
    const [current, forecast, aqiRaw, uvRaw] = await Promise.all([
      api.getCurrentWeather(lat, lon, units),
      api.getForecast(lat, lon, units),
      api.getAirPollution(lat, lon).catch(() => null),
      api.getUvIndex(lat, lon),
    ]);

    const tzOffset = current.timezone;
    const sunrise = current.sys.sunrise;
    const sunset = current.sys.sunset;
    const nowUnix = current.dt;
    const isDay = isDaytime(nowUnix, sunrise, sunset);
    const code = current.weather[0].id;

    ui.setSkyAttributes(bgSkyCategory(code), isDay);

    ui.renderHero({
      place: name || current.name,
      country: country || current.sys.country || '',
      dt: nowUnix,
      tzOffset,
      temp: current.main.temp,
      feelsLike: current.main.feels_like,
      tempMin: current.main.temp_min,
      tempMax: current.main.temp_max,
      description: current.weather[0].description,
      iconKey: iconKeyFor(code, isDay),
      units,
    });

    const aqiIndex = aqiRaw?.list?.[0]?.main?.aqi ?? null;
    ui.renderStats({
      wind: current.wind,
      humidity: current.main.humidity,
      pressure: current.main.pressure,
      visibility: current.visibility,
      uvi: uvRaw?.value ?? null,
      aqi: aqiIndex,
      units,
    });

    ui.renderSun({ sunrise, sunset, tzOffset, now: nowUnix });

    const hourly = buildHourly(forecast.list, tzOffset, sunrise, sunset, 12);
    ui.renderHourly(hourly, units);
    ui.renderChart(hourly, units);
    document.querySelectorAll('#chartTabs button').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.chart === 'temp');
      btn.setAttribute('aria-selected', String(btn.dataset.chart === 'temp'));
    });

    const daily = buildDaily(forecast.list, tzOffset);
    ui.renderDaily(daily, units, globalTempRange(daily));

    ui.renderAirQuality(aqiRaw, tzOffset);

    ui.showState('content');
    cfg.setLastLocation({ lat, lon, name: name || current.name, country: country || current.sys.country || '' });
  } catch (err) {
    const message = err?.message || 'Something went wrong while fetching the forecast.';
    ui.showError(message);
    ui.showToast(message, 'error');
  }
}

/* ------------------------------------------------------------------ */
/*  Chart tabs                                                         */
/* ------------------------------------------------------------------ */

function initChartTabs() {
  document.getElementById('chartTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-chart]');
    if (!btn) return;
    document.querySelectorAll('#chartTabs button').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', String(b === btn));
    });
    ui.setChartKind(btn.dataset.chart, units);
  });
}

/* ------------------------------------------------------------------ */
/*  Retry + recents + errors                                           */
/* ------------------------------------------------------------------ */

function initErrorRetry() {
  document.getElementById('errorRetry').addEventListener('click', () => {
    if (currentCoords) loadWeather(currentCoords, {});
  });
}

function initRecents() {
  ui.renderRecentChips(cfg.getRecents(), (item) => {
    loadWeather({ lat: item.lat, lon: item.lon, name: item.placeName, country: item.country }, {});
  });
}

/* ------------------------------------------------------------------ */
/*  PWA install banner + service worker                                */
/* ------------------------------------------------------------------ */

function initInstallPrompt() {
  const banner = document.getElementById('installBanner');
  const installBtn = document.getElementById('installBtn');
  const dismissBtn = document.getElementById('installDismiss');
  let deferredPrompt = null;

  if (sessionStorage.getItem('aurora.installDismissed')) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    banner.classList.add('is-visible');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.classList.remove('is-visible');
  });

  dismissBtn.addEventListener('click', () => {
    banner.classList.remove('is-visible');
    sessionStorage.setItem('aurora.installDismissed', '1');
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => { /* offline support best-effort */ });
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Boot                                                                */
/* ------------------------------------------------------------------ */

function boot() {
  initSkyParticles();
  initTheme();
  initUnits();
  initSettings();
  initSearch();
  initGeolocation();
  initChartTabs();
  initErrorRetry();
  initRecents();
  initInstallPrompt();
  registerServiceWorker();

  const last = cfg.getLastLocation();
  if (last) {
    loadWeather({ lat: last.lat, lon: last.lon, name: last.name, country: last.country }, {});
  } else {
    useMyLocation({ silent: true });
  }
}

document.addEventListener('DOMContentLoaded', boot);
