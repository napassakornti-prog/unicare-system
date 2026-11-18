/** @type {import('tailwindcss').Config} */
// พาเลตต์สีประจำมหาวิทยาลัยกาฬสินธุ์ (ฟ้าคราม / Leadwort blue) ใช้แทนชุดสี teal เดิมทั้งเว็บ
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          50: '#eef6fd', 100: '#d9ebfa', 200: '#b8d9f4', 300: '#8ac0ec', 400: '#55a1e0',
          500: '#2f82cf', 600: '#1f68b5', 700: '#1a5493', 800: '#17457a', 900: '#123660', 950: '#0b2340',
        },
      },
      fontFamily: { sans: ['"Noto Sans Thai"', 'Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
