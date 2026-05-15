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
        // Forged-iron accent palette
        gold: {
          400: '#f0c878',
          500: '#d9a85a',
          600: '#a87838',
          700: '#6b4818',
        },
        ember: {
          400: '#ff8a4a',
          500: '#d97a4a',
          600: '#a85a2a',
        },
        leaf: {
          400: '#9be6c4',
          500: '#6bbf7a',
          600: '#3f8a4a',
        },
        blood: {
          400: '#ff8a8a',
          500: '#a83838',
          600: '#7a2424',
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
