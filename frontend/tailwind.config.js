/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bed: '#0d1117',
        panel: '#161b22',
        border: '#30363d',
        accent: '#1f6feb',
        success: '#238636',
        warning: '#9e6a03',
        danger: '#da3633',
        text: '#e6edf3',
        muted: '#8b949e',
      }
    }
  },
  plugins: [],
}
