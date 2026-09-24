/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // This is crucial for the manual toggle
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom dark mode colors
        pulseDark: "#0B0F17",
        pulsePanel: "#131B2A",
        pulseBorder: "#1F2B42",
        // Custom light mode colors
        pulseLight: "#F8FAFC",
        pulseLightPanel: "#FFFFFF",
        pulseLightBorder: "#E2E8F0"
      }
    },
  },
  plugins: [],
}