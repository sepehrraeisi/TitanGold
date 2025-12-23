/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        "muted-foreground": "var(--muted-foreground)",
        positive: "var(--positive)",
        negative: "var(--negative)",
        "trading-green": "var(--trading-green)",
        "trading-red": "var(--trading-red)",
        "trading-blue": "var(--trading-blue)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        persian: ["IRANSans", "Vazir", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
}
