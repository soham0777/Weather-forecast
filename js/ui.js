// DOM rendering — every function here is a pure "data in, DOM out" step.
import { iconDataUri } from './icons.js';
import { aqiInfo, uvInfo, AQI_COMPONENT_LABELS } from './aqi.js';
import {
  windDirection, windSpeedDisplay, visibilityDisplay,
  formatTimeAt, formatFullDate, tempUnitSymbol, durationLabel,
} from './format.js';
import { buildTempChart, buildPopChart } from './charts.js';

const $ = (id) => document.getElementById(id);

export const dom = {
  skeleton: $('skeletonState'),
  errorPanel: $('stateError'),
  emptyPanel: $('stateEmpty'),
  content: $('weatherContent'),
  errorTitle: $('errorTitle'),
  errorMessage: $('errorMessage'),
  errorRetry: $('errorRetry'),
  recentChips: $('recentChips'),

  heroCountry: $('heroCountry'),
  heroPlace: $('heroPlace'),
  heroDatetime: $('heroDatetime'),
  heroTemp: $('heroTemp'),
  heroTempUnit: $('heroTempUnit'),
  heroDesc: $('heroDesc'),
  heroFeels: $('heroFeels'),
  heroHigh: $('heroHigh'),
  heroLow: $('heroLow'),
  heroIcon: $('heroIcon'),

  windSpeed: $('windSpeed'),
  windUnit: $('windUnit'),
  windDir: $('windDir'),
  windNeedle: $('windNeedle'),
  humidityVal: $('humidityVal'),
  humidityBar: $('humidityBar'),
  pressureVal: $('pressureVal'),
  pressureTrend: $('pressureTrend'),
  visibilityVal: $('visibilityVal'),
  visibilityDesc: $('visibilityDesc'),
  uvVal: $('uvVal'),
  uvDesc: $('uvDesc'),
  aqiBadge: $('aqiBadge'),
  aqiLabel: $('aqiLabel'),
  aqiSub: $('aqiSub'),

  daylightLength: $('daylightLength'),
  sunDot: $('sunDot'),
  sunriseVal: $('sunriseVal'),
  sunsetVal: $('sunsetVal'),

  hourlyScroller: $('hourlyScroller'),
  chartWrap: $('chartWrap'),
  chartTabs: $('chartTabs'),
  dailyList: $('dailyList'),

  aqiUpdated: $('aqiUpdated'),
  aqiGaugeFill: $('aqiGaugeFill'),
  aqiGaugeNum: $('aqiGaugeNum'),
  aqiGaugeLabel: $('aqiGaugeLabel'),
  aqiSummary: $('aqiSummary'),
  aqiComponents: $('aqiComponents'),
};

export function showState(state) {
  dom.skeleton.hidden = state !== 'loading';
  dom.errorPanel.hidden = state !== 'error';
  dom.emptyPanel.hidden = state !== 'empty';
  dom.content.hidden = state !== 'content';
}

export function showError(message) {
  dom.errorMessage.textContent = message;
  showState('error');
}

export function setSkyAttributes(skyCategory, isDay) {
  document.body.setAttribute('data-sky', skyCategory);
  document.body.setAttribute('data-time', isDay ? 'day' : 'night');
}

export function renderHero({ place, country, dt, tzOffset, temp, feelsLike, tempMin, tempMax, description, iconKey, units }) {
  dom.heroCountry.textContent = country;
  dom.heroPlace.textContent = place;
  dom.heroDatetime.textContent = formatFullDate(dt, tzOffset);
  dom.heroTemp.textContent = Math.round(temp);
  dom.heroTempUnit.textContent = tempUnitSymbol(units);
  dom.heroDesc.textContent = description;
  dom.heroFeels.textContent = `${Math.round(feelsLike)}°`;
  dom.heroHigh.textContent = `${Math.round(tempMax)}°`;
  dom.heroLow.textContent = `${Math.round(tempMin)}°`;
  dom.heroIcon.src = iconDataUri(iconKey);
  dom.heroIcon.alt = description;
}

export function renderStats({ wind, humidity, pressure, visibility, uvi, aqi, units }) {
  const w = windSpeedDisplay(wind.speed, units);
  dom.windSpeed.textContent = w.value;
  dom.windUnit.textContent = w.unit;
  dom.windDir.textContent = wind.deg != null ? windDirection(wind.deg) : '—';
  dom.windNeedle.style.transform = `translateX(-50%) rotate(${wind.deg || 0}deg)`;

  dom.humidityVal.textContent = humidity;
  requestAnimationFrame(() => { dom.humidityBar.style.width = `${humidity}%`; });

  dom.pressureVal.textContent = pressure;
  dom.pressureTrend.textContent = pressure >= 1013 ? 'High pressure' : 'Low pressure';

  const vis = visibilityDisplay(visibility, units);
  dom.visibilityVal.textContent = vis.value;
  dom.visibilityDesc.textContent = vis.desc;

  const uv = uvInfo(uvi);
  dom.uvVal.textContent = uvi != null ? Math.round(uvi) : '—';
  dom.uvVal.style.color = uv.color;
  dom.uvDesc.textContent = uv.label;

  if (aqi != null) {
    const info = aqiInfo(aqi);
    dom.aqiBadge.style.background = `${info.color}22`;
    dom.aqiBadge.style.color = info.color;
    dom.aqiBadge.querySelector('.aqi-badge__dot').style.background = info.color;
    dom.aqiLabel.textContent = info.label;
    dom.aqiSub.textContent = info.desc;
  } else {
    dom.aqiLabel.textContent = '—';
    dom.aqiSub.textContent = 'Unavailable';
  }
}

export function renderSun({ sunrise, sunset, tzOffset, now }) {
  dom.sunriseVal.textContent = formatTimeAt(sunrise, tzOffset);
  dom.sunsetVal.textContent = formatTimeAt(sunset, tzOffset);
  dom.daylightLength.textContent = durationLabel(sunset - sunrise);

  const total = sunset - sunrise;
  const progress = Math.min(1, Math.max(0, (now - sunrise) / total));
  const isDaytime = now >= sunrise && now <= sunset;

  // Point along the arc path (approx semicircle from (10,90) to (290,90), radius 140)
  const angle = Math.PI * (1 - progress);
  const cx = 150;
  const cy = 90;
  const r = 140;
  const x = cx - r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);

  dom.sunDot.setAttribute('cx', isDaytime ? x : (progress < 0.5 ? 10 : 290));
  dom.sunDot.setAttribute('cy', isDaytime ? y : 90);
  dom.sunDot.style.opacity = isDaytime ? '1' : '0.35';
}

export function renderHourly(hourlyItems, units) {
  dom.hourlyScroller.innerHTML = hourlyItems.map((item) => `
    <div class="hourly-card">
      <span class="hourly-card__time">${item.label}</span>
      <img class="hourly-card__icon" src="${iconDataUri(item.icon)}" alt="${item.description}" />
      <span class="hourly-card__temp">${Math.round(item.temp)}°</span>
      <span class="hourly-card__pop">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 2s6 7.6 6 12a6 6 0 1 1-12 0c0-4.4 6-12 6-12Z" stroke="currentColor" stroke-width="2"/></svg>
        ${Math.round(item.pop * 100)}%
      </span>
    </div>
  `).join('');
}

let lastChartKind = 'temp';
let lastHourly = [];

export function renderChart(hourlyItems, units, kind = lastChartKind) {
  lastChartKind = kind;
  lastHourly = hourlyItems;
  const svg = kind === 'pop' ? buildPopChart(hourlyItems) : buildTempChart(hourlyItems, tempUnitSymbol(units));
  dom.chartWrap.innerHTML = svg;
}

export function rerenderChartForUnits(units) {
  if (lastHourly.length) renderChart(lastHourly, units, lastChartKind);
}

export function setChartKind(kind, units) {
  if (lastHourly.length) renderChart(lastHourly, units, kind);
}

export function renderDaily(days, units, globalRange) {
  dom.dailyList.innerHTML = days.map((day, i) => {
    const loPct = ((day.tempMin - globalRange.min) / (globalRange.max - globalRange.min)) * 100;
    const hiPct = ((day.tempMax - globalRange.min) / (globalRange.max - globalRange.min)) * 100;
    return `
    <div>
      <button type="button" class="daily-row" data-day-index="${i}" aria-expanded="false">
        <span>
          <span class="daily-row__day">${day.dayLabel}</span>
          <span class="daily-row__date">${day.dateLabel}</span>
        </span>
        <span class="daily-row__mid">
          <img class="daily-row__icon" src="${iconDataUri(day.icon)}" alt="" />
          <span class="daily-row__pop">${Math.round(day.pop * 100)}%</span>
          <span class="daily-row__desc">${day.description}</span>
        </span>
        <span class="daily-row__range">
          <span class="daily-row__lo">${Math.round(day.tempMin)}°</span>
          <span class="range-track"><span class="range-track__fill" style="left:${loPct}%;width:${Math.max(hiPct - loPct, 4)}%;"></span></span>
          <span>${Math.round(day.tempMax)}°</span>
        </span>
      </button>
      <div class="daily-detail">
        <div class="daily-detail__inner">
          <div class="daily-detail__item"><b>${Math.round(day.humidity)}%</b>Humidity</div>
          <div class="daily-detail__item"><b>${windSpeedDisplay(day.windSpeed, units).value} ${windSpeedDisplay(day.windSpeed, units).unit}</b>Wind</div>
          <div class="daily-detail__item"><b>${Math.round(day.pop * 100)}%</b>Chance of rain</div>
          <div class="daily-detail__item" style="text-transform:capitalize;"><b>${day.description}</b>Conditions</div>
        </div>
      </div>
    </div>`;
  }).join('');

  dom.dailyList.querySelectorAll('.daily-row').forEach((row) => {
    row.addEventListener('click', () => {
      const isOpen = row.classList.contains('is-open');
      dom.dailyList.querySelectorAll('.daily-row').forEach((r) => {
        r.classList.remove('is-open');
        r.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        row.classList.add('is-open');
        row.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

export function renderAirQuality(aqiData, tzOffset) {
  if (!aqiData) {
    dom.aqiSummary.textContent = 'Air quality data is unavailable for this location right now.';
    dom.aqiComponents.innerHTML = '';
    dom.aqiGaugeNum.textContent = '—';
    dom.aqiGaugeLabel.textContent = '—';
    return;
  }
  const { main, components, dt } = aqiData.list[0];
  const info = aqiInfo(main.aqi);
  const pct = main.aqi / 5;
  const circumference = 314;

  dom.aqiGaugeFill.style.stroke = info.color;
  dom.aqiGaugeFill.setAttribute('stroke-dashoffset', String(circumference * (1 - pct)));
  dom.aqiGaugeNum.textContent = main.aqi;
  dom.aqiGaugeLabel.textContent = info.label;
  dom.aqiSummary.textContent = `${info.desc} Index ${main.aqi} of 5 (OpenWeatherMap scale).`;
  dom.aqiUpdated.textContent = `Updated ${formatTimeAt(dt, tzOffset)}`;

  dom.aqiComponents.innerHTML = Object.entries(AQI_COMPONENT_LABELS).map(([key, label]) => `
    <div><b>${components[key] != null ? components[key].toFixed(1) : '—'}</b>${label}</div>
  `).join('');
}

export function renderRecentChips(recents, onSelect) {
  if (!recents.length) {
    dom.recentChips.innerHTML = '';
    return;
  }
  dom.recentChips.innerHTML = recents.map((r) => `
    <button class="chip" type="button" data-recent-key="${r.key}">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" stroke="currentColor" stroke-width="1.8"/></svg>
      ${r.name}
    </button>
  `).join('');
  dom.recentChips.querySelectorAll('[data-recent-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const match = recents.find((r) => r.key === btn.dataset.recentKey);
      if (match) onSelect(match);
    });
  });
}

let toastId = 0;
export function showToast(message, type = 'info') {
  const stack = $('toastStack');
  const id = `toast-${toastId++}`;
  const icons = {
    error: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    success: '<svg viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4 10-10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v5M12 8h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.id = id;
  el.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  }, 4200);
}
