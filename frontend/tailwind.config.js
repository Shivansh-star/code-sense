/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        surface: {
          0: '#0d1117',
          1: '#161b22',
          2: '#21262d',
          3: '#30363d',
        },
        accent: {
          DEFAULT: '#58a6ff',
          hover: '#79b8ff',
          muted: '#1f4068',
        },
        success: '#3fb950',
        warning: '#d29922',
        danger: '#f85149',
      },
    },
  },
  plugins: [],
};
