export interface Theme {
  mode: 'light' | 'dark'
  font: {
    ui: string
    mono: string
    size: { xs: string; sm: string; md: string; lg: string }
    lineHeight: number
  }
  space: { 0: string; 1: string; 2: string; 3: string; 4: string; 5: string; 6: string }
  radius: { sm: string; md: string }
  z: { panel: number; floating: number; popover: number }
  shadow: { popover: string; floating: string }
  colors: {
    bg: string
    bgSubtle: string
    bgElevated: string
    bgHover: string
    bgSelected: string
    fg: string
    fgMuted: string
    fgSubtle: string
    border: string
    borderStrong: string
    accent: string
    accentFg: string
    danger: string
    success: string
    warning: string
    diffAddBg: string
    diffAddFg: string
    diffDelBg: string
    diffDelFg: string
    diffHunk: string
    commentBg: string
  }
  syntax: {
    keyword: string
    string: string
    number: string
    comment: string
    type: string
    function: string
    property: string
    constant: string
    tag: string
    invalid: string
  }
}

const font: Theme['font'] = {
  ui: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  size: { xs: '11px', sm: '12px', md: '13px', lg: '15px' },
  lineHeight: 1.45
}

const space: Theme['space'] = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '24px',
  6: '32px'
}
const radius: Theme['radius'] = { sm: '3px', md: '6px' }
const z: Theme['z'] = { panel: 10, floating: 20, popover: 30 }
const lightShadow: Theme['shadow'] = {
  popover: '0 4px 12px rgba(31, 35, 40, 0.15)',
  floating: '0 4px 16px rgba(31, 35, 40, 0.18)'
}
const darkShadow: Theme['shadow'] = {
  popover: '0 4px 12px rgba(1, 4, 9, 0.6)',
  floating: '0 4px 16px rgba(1, 4, 9, 0.7)'
}

export const lightTheme: Theme = {
  mode: 'light',
  font,
  space,
  radius,
  z,
  shadow: lightShadow,
  colors: {
    bg: '#ffffff',
    bgSubtle: '#f6f8fa',
    bgElevated: '#ffffff',
    bgHover: '#eaeef2',
    bgSelected: '#ddf4ff',
    fg: '#1f2328',
    fgMuted: '#59636e',
    fgSubtle: '#818b98',
    border: '#d1d9e0',
    borderStrong: '#8c959f',
    accent: '#0969da',
    accentFg: '#ffffff',
    danger: '#cf222e',
    success: '#1a7f37',
    warning: '#9a6700',
    diffAddBg: '#dafbe1',
    diffAddFg: '#116329',
    diffDelBg: '#ffebe9',
    diffDelFg: '#82071e',
    diffHunk: '#ddf4ff',
    commentBg: '#fff8c5'
  },
  syntax: {
    keyword: '#cf222e',
    string: '#0a3069',
    number: '#0550ae',
    comment: '#59636e',
    type: '#953800',
    function: '#8250df',
    property: '#0550ae',
    constant: '#0550ae',
    tag: '#116329',
    invalid: '#82071e'
  }
}

export const darkTheme: Theme = {
  mode: 'dark',
  font,
  space,
  radius,
  z,
  shadow: darkShadow,
  colors: {
    bg: '#0d1117',
    bgSubtle: '#161b22',
    bgElevated: '#161b22',
    bgHover: '#21262d',
    bgSelected: '#132e53',
    fg: '#e6edf3',
    fgMuted: '#9198a1',
    fgSubtle: '#6e7681',
    border: '#30363d',
    borderStrong: '#484f58',
    accent: '#4493f8',
    accentFg: '#ffffff',
    danger: '#f85149',
    success: '#3fb950',
    warning: '#d29922',
    diffAddBg: '#033a16',
    diffAddFg: '#3fb950',
    diffDelBg: '#67060c',
    diffDelFg: '#f85149',
    diffHunk: '#122447',
    commentBg: '#3b2b00'
  },
  syntax: {
    keyword: '#ff7b72',
    string: '#a5d6ff',
    number: '#79c0ff',
    comment: '#9198a1',
    type: '#ffa657',
    function: '#d2a8ff',
    property: '#79c0ff',
    constant: '#79c0ff',
    tag: '#7ee787',
    invalid: '#ffa198'
  }
}
