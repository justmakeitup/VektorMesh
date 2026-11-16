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
          bg: "#090A0F",
          panel: "#12151E",
          card: "#171B26",
          border: "#23293B",
          hover: "#1D2333",
          emerald: "#10B981",
          amber: "#F59E0B",
          crimson: "#EF4444",
          cyan: "#06B6D4",
          violet: "#8B5CF6"
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ['"Inter"', "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"]
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ping-slow": "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite"
      }
    },
  },
  plugins: [],
};
