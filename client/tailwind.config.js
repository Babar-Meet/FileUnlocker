/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Manrope'", "sans-serif"],
      },
      colors: {
        tide: "#124559",
        lagoon: "#3b8ea5",
        foam: "#d2f3ea",
        coral: "#ff8357",
        sand: "#fff8e7",
        ink: "#1a2a33",
      },
      boxShadow: {
        panel: "0 24px 50px -24px rgba(17, 36, 46, 0.55)",
      },
    },
  },
  plugins: [],
};
