export interface Theme {
  mode: 'light' | 'dark'
  font: {
    ui: string
    mono: string
    size: { xs: string; sm: string; md: string; lg: string }
    lineHeight: number
  }
  space: { 1: string; 2: string; 3: string; 4: string; 5: string; 6: string }
  radius: { sm: string; md: string }
  z: { floating: number; modal: number; popover: number }
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
    overlay: string
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
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '24px',
  6: '32px'
}
const radius: Theme['radius'] = { sm: '3px', md: '6px' }
const z: Theme['z'] = { floating: 20, modal: 25, popover: 30 }

export interface ThemeTemplate {
  id: string
  name: string
  mode: 'light' | 'dark'
  shadow: Theme['shadow']
  colors: Theme['colors']
  syntax: Theme['syntax']
}

export function buildTheme(template: ThemeTemplate): Theme {
  return {
    mode: template.mode,
    font,
    space,
    radius,
    z,
    shadow: template.shadow,
    colors: template.colors,
    syntax: template.syntax
  }
}
