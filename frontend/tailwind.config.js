/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#3b63f7',
          600: '#2d52e8',
          700: '#2241cc',
          900: '#111d5e',
        },
        surface: {
          900: '#0a0c14',
          800: '#10131f',
          700: '#171b2d',
          600: '#1e2438',
          500: '#252b44',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
