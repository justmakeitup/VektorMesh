/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        mesh: {
          bg: "#2C3531",        // Deep dark slate spruce
          panel: "#222B27",     // Panel container
          card: "#1E2623",      // Card elevation
          cardHover: "#27332D", // Card hover
          border: "#116466",    // Deep teal accent border
          borderLight: "rgba(209, 232, 226, 0.15)",
          dark: "#2C3531",      // Primary dark
          teal: "#116466",      // Primary accent teal
          copper: "#D9B08C",    // Secondary accent warm tan / copper
          peach: "#FFCB9A",     // Bright highlight / amber glow
          mint: "#D1E8E2",      // Crisp ice sage / pale mint text
          alert: "#EF4444"      // Circuit break alert
        }
      },
      fontFamily: {
        matrix: ['"Share Tech Mono"', '"VT323"', "ui-monospace", "monospace"],
        futuristic: ['"Chakra Petch"', '"Rajdhani"', "system-ui", "sans-serif"],
        mono: ['"Share Tech Mono"', '"JetBrains Mono"', "ui-monospace", "monospace"],
        sans: ['"Chakra Petch"', '"Rajdhani"', "system-ui", "sans-serif"]
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ping-slow": "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite"
      }
    },
  },
  plugins: [],
};
