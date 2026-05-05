/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f3ee',
          100: '#e8e2d4',
          200: '#cfc4ad',
          300: '#a99878',
          400: '#7a6a4a',
          500: '#534830',
          600: '#3a3220',
          700: '#272117',
          800: '#191510',
          900: '#0e0b08',
        },
        storm: {
          400: '#9a7fbf',
          500: '#6b4e9a',
          600: '#3f2e6b',
          700: '#241945',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
