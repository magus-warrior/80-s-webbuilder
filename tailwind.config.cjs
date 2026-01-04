/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./src/**/*.{js,jsx}"] ,
  theme: {
    extend: {
      fontFamily: {
        display: ["'Press Start 2P'", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
