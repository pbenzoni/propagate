/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        newsprint: '#f4ecd8',
        newsprintDark: '#e8dcbf',
        inkblack: '#15130f',
        redink: '#9a1f1f',
        blueink: '#1a3a6b',
        goldink: '#b8962e',
      },
      fontFamily: {
        display: ['"Playfair Display"', '"Old Standard TT"', 'Georgia', 'serif'],
        body: ['"Libre Caslon Text"', '"Crimson Pro"', 'Georgia', 'serif'],
        slab: ['"Roboto Slab"', '"Zilla Slab"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
