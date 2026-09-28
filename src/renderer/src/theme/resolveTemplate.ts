import type { ThemeTemplate } from './tokens'

export const SYSTEM_LIGHT_TEMPLATE_ID = 'light'
export const SYSTEM_DARK_TEMPLATE_ID = 'dark'

// The built-in light/dark templates are runtime theme extensions
// (`extensions/themes/{light,dark}`), fetched over IPC (`themes.list`) like
// any other extension - they are not guaranteed to be loaded yet (first
// paint, still fetching) or even available at all (extension broken,
// disabled, or missing). This is the one theme baked directly into the app
// itself, used only as a last resort so the UI never renders unstyled or
// blank.
const FALLBACK_TEMPLATE: ThemeTemplate = {
  id: '__fallback__',
  name: 'Fallback',
  mode: 'light',
  shadow: {
    popover: '0 4px 12px rgba(31, 35, 40, 0.15)',
    floating: '0 4px 16px rgba(31, 35, 40, 0.18)'
  },
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
    commentBg: '#fff8c5',
    overlay: 'rgba(31, 35, 40, 0.4)'
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

export function resolveTemplate(
  selectedId: string | null,
  systemPrefersDark: boolean,
  templates: readonly ThemeTemplate[]
): ThemeTemplate {
  if (selectedId !== null) {
    const selected = templates.find((template) => template.id === selectedId)
    if (selected) return selected
  }
  const systemId = systemPrefersDark ? SYSTEM_DARK_TEMPLATE_ID : SYSTEM_LIGHT_TEMPLATE_ID
  const bySystemId = templates.find((template) => template.id === systemId)
  if (bySystemId) return bySystemId

  const systemMode = systemPrefersDark ? 'dark' : 'light'
  const byMode = templates.find((template) => template.mode === systemMode)
  if (byMode) return byMode

  return templates[0] ?? FALLBACK_TEMPLATE
}
