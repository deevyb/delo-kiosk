import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Delo Primary Palette
        'delo-maroon': '#921C12',
        'delo-cream': '#F9F6EE',
        'delo-navy': '#000024',
        // Delo Secondary Palette
        'delo-terracotta': '#C85A2E',
        'delo-sage': '#8B9E8B',
        'delo-gold': '#D4A574',
      },
      fontFamily: {
        yatra: ['Yatra One', 'cursive'],
        bricolage: ['Bricolage Grotesque', 'sans-serif'],
        'roboto-mono': ['Roboto Mono', 'monospace'],
        cooper: ['Cooper Md BT', 'serif'],
        manrope: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
