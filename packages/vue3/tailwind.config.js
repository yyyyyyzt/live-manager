/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0052D9',
          hover: '#366EF4',
          light: '#618DFF',
        },
        background: {
          DEFAULT: '#1D1D1D',
          secondary: '#242424',
          tertiary: '#2C2C2C',
        },
        text: {
          primary: '#FFFFFF',
          secondary: 'rgba(255,255,255,0.9)',
          muted: 'rgba(255,255,255,0.6)',
        },
        functional: {
          success: '#00A870',
          warning: '#ED7B2F',
          error: '#E34D59',
          disabled: '#A6A6A6',
        },
      },
      fontFamily: {
        sans: ['PingFang SC', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
