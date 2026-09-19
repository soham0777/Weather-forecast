<div align="center">

# 🌤️ Aurora Weather

**A premium, real-time weather platform — search any city and get live conditions, hourly trends, a multi-day outlook, air quality, and more, wrapped in a dynamic, animated interface.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Open-00b8d4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://soham0777.github.io/Weather-forecast/)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
![OpenWeatherMap](https://img.shields.io/badge/API-OpenWeatherMap-EB6E4B?style=for-the-badge)

</div>

---

## ✨ Features

- 🔎 **Smart search** — type-ahead city search backed by OpenWeatherMap Geocoding, with keyboard navigation and recent-search chips
- 📍 **One-tap geolocation** — detect your location and reverse-geocode it to a place name
- 🌡️ **Rich current conditions** — temperature, feels-like, daily high/low, description, wind (speed + compass direction), humidity, pressure, visibility, UV index, and air quality, all in one glanceable hero panel
- 🕐 **Hourly forecast** — scrollable 24-hour strip with per-hour icon, temperature, and precipitation chance
- 📅 **Multi-day forecast** — expandable daily cards (built from the free 5-day/3-hour data set) with humidity, wind, and rain-chance detail on tap
- 📈 **Interactive trend charts** — hand-built, dependency-free SVG line and bar charts for temperature and precipitation probability
- 🌫️ **Live air quality** — AQI gauge, category (Good → Very Poor), and pollutant breakdown (PM2.5, PM10, O₃, NO₂, SO₂, CO)
- 🌅 **Sunrise/sunset arc** — animated daylight-progress visualization with daylight-length summary
- 🎨 **Dynamic animated sky** — the entire background morphs with real conditions and time of day: drifting clouds, falling rain, drifting snow, twinkling stars, a glowing sun/moon, and flickering lightning for storms — pure CSS, no video/image assets
- 🌗 **Light / dark / auto themes** — persisted, with instant system-preference syncing
- 🌡️ **°C / °F unit switching** — re-fetches and re-renders instantly
- ⚙️ **Bring your own API key** — optional settings panel to swap in a personal OpenWeatherMap key, stored only in `localStorage`
- 💫 **Loading, empty, and error states** — skeleton shimmer while fetching, a friendly empty state, and a recoverable error state with retry
- ♿ **Accessible by design** — semantic landmarks, skip link, keyboard-navigable search, visible focus states, `aria-live` toasts, `prefers-reduced-motion` support
- 📱 **Mobile-first & responsive** — fluid typography and layout from small phones to wide desktops
- 📦 **Installable PWA** — web app manifest, custom-drawn icon set, offline-capable service worker (app-shell caching + best-effort cached API responses), and an install prompt banner

## 🖥️ Live Demo

👉 **https://soham0777.github.io/Weather-forecast/**

## 🛠️ Run it locally

This is a dependency-free, build-free static site — any static file server works:

```bash
git clone https://github.com/soham0777/Weather-forecast.git
cd Weather-forecast
python3 -m http.server 8080
# open http://localhost:8080
```

The app ships with a shared demo OpenWeatherMap API key so it works immediately. For heavier personal use, get a free key from [OpenWeatherMap](https://openweathermap.org/api) and add it via the **Settings** (gear) icon in the app — it's stored only in your browser's `localStorage`, never sent anywhere else.

> Note: the service worker requires the page to be served over `http(s)`, not opened as a bare `file://` URL.

## 🏗️ Architecture

```
Weather-forecast/
├── index.html                # Semantic markup: header, hero, stats, hourly, chart, daily, AQI, modal
├── manifest.webmanifest      # PWA metadata + icon set
├── service-worker.js         # App-shell caching + network-first API caching for offline resilience
├── css/
│   ├── base.css              # Design tokens (color, type, spacing, motion), resets, accessibility helpers
│   ├── sky.css                # Dynamic animated weather backgrounds (sun, moon, clouds, rain, snow, lightning)
│   ├── layout.css            # App shell, hero, stat cards, hourly strip, chart, daily list, AQI card, responsive rules
│   └── components.css        # Buttons, modal, toasts, skeletons, empty/error states, install banner
├── js/
│   ├── app.js                 # Main controller — wires DOM events to API/state/UI
│   ├── api.js                  # OpenWeatherMap fetch wrapper with typed error handling
│   ├── config.js              # localStorage-backed settings (API key, units, theme, recents, last location)
│   ├── forecast.js            # Aggregates the 3-hour forecast feed into hourly + daily views
│   ├── icons.js                # Hand-drawn inline SVG weather icon set + condition classification
│   ├── aqi.js                  # Air-quality index and UV index scales/labels
│   ├── format.js               # Date/time/unit formatting helpers
│   ├── charts.js               # Dependency-free SVG line/bar chart builders
│   ├── ui.js                    # All DOM rendering (pure "data in, DOM out" functions)
│   └── sky-fx.js               # One-time generation of decorative rain/snow/cloud particles
├── icons/                     # Generated PWA icon set (regular + maskable + favicon + apple-touch-icon)
└── scripts/
    └── gen-icons.js            # Regenerates the icon set (see below)
```

No framework, no bundler, no `node_modules` — just ES modules loaded natively by the browser (`<script type="module">`).

### Why the 3-hour forecast feed?

The classic OpenWeatherMap **One Call** API now requires a separate paid-tier subscription even at low volume. To keep the app working out of the box with a free-tier key, Aurora Weather builds its hourly and daily views from the **5 day / 3 hour forecast** endpoint instead — `js/forecast.js` buckets the 3-hour slots into an hourly strip and groups them by calendar day (min/max temp, representative icon, max precipitation chance) for the daily list. This is why the daily outlook covers the ~5–6 days the free feed provides rather than a fixed "7 days."

## 🔑 APIs used

All from [OpenWeatherMap](https://openweathermap.org/api), free tier:

| Purpose | Endpoint |
|---|---|
| Current conditions | `/data/2.5/weather` |
| Hourly + daily forecast source | `/data/2.5/forecast` |
| Air quality | `/data/2.5/air_pollution` |
| UV index (best-effort; degrades gracefully) | `/data/2.5/uvi` |
| City search / autocomplete | `/geo/1.0/direct` |
| Reverse geocoding (for "use my location") | `/geo/1.0/reverse` |

## ♻️ Regenerating the PWA icons

The PNG icon set in `icons/` is produced by `scripts/gen-icons.js` — a small, dependency-free Node script (pure `zlib`/PNG encoding, no image libraries). To redesign the icon glyph, edit the script and re-run:

```bash
node scripts/gen-icons.js icons/
```

Or replace the files in `icons/` directly with your own square PNGs (192×192, 512×512, plus maskable variants with ~10% safe-area padding).

---

<div align="center">Made with ❤️ by <a href="https://github.com/soham0777">Soham Kadu</a></div>
