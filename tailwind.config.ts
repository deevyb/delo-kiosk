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
        // Chart palette: the only colors that encode data. Held apart from the
        // brand secondaries, which fail colorblind separation and AA contrast
        // against white at this size.
        'delo-chart-fast': '#3D7E2F',
        'delo-chart-mid': '#C18A1F',
        'delo-chart-slow': '#AE3A1E',
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
