/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/views/**/*.ejs",
    "./src/*.js",
    "./src/client-dist/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0f0f0f',
        darkCard: '#1f1f1f',
        darkBorder: '#3f3f3f',
      }
    },
  },
  plugins: [],
}
