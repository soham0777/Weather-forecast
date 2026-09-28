# Frontend — React + Vite

> EDUCATIONAL SIMULATOR — NOT A REAL BANKING SYSTEM. See the [project README](../README.md).

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173  (the backend must run on http://localhost:8000)
```

Other scripts: `npm run build` (production build to `dist/`), `npm run preview`, `npm run lint`.

If the backend runs elsewhere, copy `.env.example` to `.env` and set `VITE_API_BASE_URL`, and add the UI's origin to
the backend's `FRONTEND_URL` (CORS).

Every button calls the real backend through Axios (`src/services/api.js`); no API response is hard-coded. The
`src/data/` folder only holds teaching content (status-code explanations, the SOAP vs REST table, architecture
descriptions and the public DEMO client credentials).
