/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        seal: {
          50: "#f0f5ff",
          100: "#e0eaff",
          200: "#c7d7fe",
          300: "#a4bbfc",
          400: "#7d97f8",
          500: "#5b72f2",
          600: "#4150e6",
          700: "#333ecb",
          800: "#2c35a4",
          900: "#2a3382",
          950: "#1c1f4c",
        },
      },
    },
  },
  plugins: [],
};
