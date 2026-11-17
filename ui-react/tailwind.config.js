/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mesh: {
          bg: "#F8FAFC",        // Light slate-50 background
          panel: "#FFFFFF",     // Clean pure white container
          card: "#FFFFFF",      // Clean elevated white card
          cardHover: "#F1F5F9", // Slate-100 hover
          border: "#E2E8F0",    // Crisp slate-200 border
          borderLight: "#F1F5F9",
          text: "#0F172A",      // Deep slate-900 primary text
          muted: "#64748B",     // Slate-500 secondary text
          blue: "#2563EB",      // Vibrant enterprise blue
          emerald: "#059669",   // Crisp emerald healthy
          amber: "#D97706",     // Crisp amber warning
          rose: "#DC2626",      // Crisp red alert
          alert: "#EF4444"      // Circuit break alert
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        matrix: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        futuristic: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', 'sans-serif']
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ping-slow": "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite"
      }
    },
  },
  plugins: [],
};
