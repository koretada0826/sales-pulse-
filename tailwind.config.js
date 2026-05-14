/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0b0f19',
          800: '#111827',
          700: '#1f2937',
          600: '#374151'
        },
        accent: {
          blue: '#3b82f6',
          purple: '#8b5cf6',
          gold: '#f5b301'
        }
      },
      boxShadow: {
        glow: '0 0 0 4px rgba(139,92,246,0.25), 0 12px 40px rgba(59,130,246,0.35)'
      },
      fontFamily: {
        sans: ['"Inter"', '"Hiragino Sans"', '"Noto Sans JP"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
