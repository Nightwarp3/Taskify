/**
 * Raw color tokens mirroring src/renderer/src/index.css. NativeWind classes
 * cover styling, but a few places need literal color values: status/nav bar
 * sync, the navigation theme, and native pickers.
 */
export const lightColors = {
  canvas: '#F3F4F6',
  raised: '#FFFFFF',
  well: '#EBEDF0',
  hover: '#E8EAED',
  rim: '#D1D5DB',
  rimFocus: '#2979FF',
  ink: '#1C1B1F',
  muted: '#5F6368',
  ghost: '#9AA0A6',
  accent: '#2979FF',
  accentSoft: '#82B1FF',
  accentContainer: '#E8F0FE',
  onAccent: '#FFFFFF',
  danger: '#B3261E'
}

export const darkColors = {
  canvas: '#121212',
  raised: '#1E1E1E',
  well: '#2A2A2A',
  hover: '#2E2E2E',
  rim: '#3A3A3A',
  rimFocus: '#2979FF',
  ink: '#E3E3E3',
  muted: '#AEAEB2',
  ghost: '#6E6E73',
  accent: '#2979FF',
  accentSoft: '#82B1FF',
  accentContainer: '#1A2E50',
  onAccent: '#FFFFFF',
  danger: '#F2B8B5'
}

export type ThemeColors = typeof lightColors

export function colorsFor(theme: 'light' | 'dark'): ThemeColors {
  return theme === 'dark' ? darkColors : lightColors
}

// Status bar + Android navigation bar backgrounds (match the desktop bridge).
export const barColors = {
  dark: { status: '#1E1E1E', nav: '#121212' },
  light: { status: '#FFFFFF', nav: '#F3F4F6' }
}
