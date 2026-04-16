/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base:    '#080C14',
        card:    '#0D1220',
        subtle:  '#141A2A',
        border:  '#1E2A40',
        accent:  '#3B82F6',
        primary: '#F0F4FF',
        secondary:'#8B96B0',
        muted:   '#4A5568',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        'accent-sm': '0 0 0 3px rgba(59,130,246,0.25)',
        'card': '0 1px 3px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-up': 'fadeUp 400ms ease both',
        'pulse-dot': 'pulse-dot 1.5s ease infinite',
      },
    },
  },
  plugins: [],
}
