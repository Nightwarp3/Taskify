/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens backed by CSS custom properties
        canvas:   'var(--c-canvas)',
        raised:   'var(--c-raised)',
        well:     'var(--c-well)',
        hover:    'var(--c-hover)',
        rim:      'var(--c-rim)',
        'rim-focus': 'var(--c-rim-focus)',
        ink:      'var(--c-ink)',
        muted:    'var(--c-muted)',
        ghost:    'var(--c-ghost)',
        accent:   'var(--c-accent)',
        'accent-soft': 'var(--c-accent-soft)',
        'accent-container': 'var(--c-accent-container)',
        'on-accent': 'var(--c-on-accent)',
        danger:   'var(--c-danger)',
        'shadow-color': 'var(--c-shadow)',
      },
      boxShadow: {
        'elev-1': '0 1px 2px var(--c-shadow), 0 1px 3px 1px var(--c-shadow)',
        'elev-2': '0 1px 2px var(--c-shadow), 0 2px 6px 2px var(--c-shadow)',
        'elev-3': '0 4px 8px 3px var(--c-shadow), 0 1px 3px var(--c-shadow)',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        'pill': '999px',
      }
    }
  },
  plugins: []
}
