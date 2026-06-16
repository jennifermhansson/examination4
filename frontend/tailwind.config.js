/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Preflight is disabled so Tailwind only adds utility classes and does NOT
  // reset base elements. This lets the new dark catalog live alongside the
  // existing light-themed views (kitchen, orders, header) without breaking them.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // Catalog ("dark island") palette — see claudeInstructions / design spec.
        canvas: '#0f1115', // page / hero background
        card: '#181c24', // product card background
        'card-hover': '#1d222c', // card background on hover
        ink: '#ffffff', // primary text
        muted: '#a1a1aa', // secondary text
        line: '#2a2f3a', // borders
        brand: {
          DEFAULT: '#ff7a00', // accent
          hover: '#ff8f1f',
          soft: 'rgba(255, 122, 0, 0.12)',
        },
      },
      borderRadius: {
        card: '20px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.6)',
        'card-hover':
          '0 8px 16px rgba(0,0,0,0.45), 0 24px 48px -16px rgba(0,0,0,0.7)',
        brand: '0 8px 20px -6px rgba(255,122,0,0.5)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
