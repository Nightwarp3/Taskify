/** @type {import('tailwindcss').Config} */
module.exports = {
  // Manual theme toggle (persisted in settings) drives the `.dark` class via
  // NativeWind's setColorScheme(), mirroring the desktop renderer.
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', './App.tsx'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Semantic tokens backed by CSS custom properties (see global.css).
        // RGB channel triplets so Tailwind opacity modifiers (e.g. bg-accent/10) work.
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        well: 'rgb(var(--c-well) / <alpha-value>)',
        hover: 'rgb(var(--c-hover) / <alpha-value>)',
        rim: 'rgb(var(--c-rim) / <alpha-value>)',
        'rim-focus': 'rgb(var(--c-rim-focus) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        ghost: 'rgb(var(--c-ghost) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--c-accent-soft) / <alpha-value>)',
        'accent-container': 'rgb(var(--c-accent-container) / <alpha-value>)',
        'on-accent': 'rgb(var(--c-on-accent) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)'
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '16px',
        pill: '999px'
      }
    }
  },
  plugins: []
}
