/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.{html,js}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      'light',
      'dark',
      'cupcake',
      'synthwave',
      'retro',
      'cyberpunk',
      'valentine',
      'aqua',
      'lofi',
      'dracula',
      'forest',
      'business'
    ],
  },
}