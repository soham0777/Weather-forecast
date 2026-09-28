import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The backend's CORS policy allows http://localhost:5173, so keep this port fixed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
})
