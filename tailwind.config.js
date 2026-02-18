/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#0a0a0f",
          1: "#12121a",
          2: "#1a1a25",
          3: "#222230",
        },
        accent: {
          DEFAULT: "#6366f1",
          hover: "#818cf8",
          dim: "#4f46e5",
        },
        status: {
          idle: "#22c55e",
          working: "#eab308",
          busy: "#ef4444",
        },
        priority: {
          urgent: "#ef4444",
          normal: "#eab308",
          low: "#22c55e",
        },
      },
    },
  },
  plugins: [],
};
