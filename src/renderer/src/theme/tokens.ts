import type { ThemeTemplateData } from '@gepard/common';

export interface Theme {
  mode: ThemeTemplateData['mode'];
  font: {
    ui: string;
    mono: string;
    size: { xs: string; sm: string; md: string; lg: string };
    lineHeight: number;
  };
  space: { 1: string; 2: string; 3: string; 4: string; 5: string; 6: string };
  radius: { sm: string; md: string };
  z: { floating: number; popover: number };
  shadow: ThemeTemplateData['shadow'];
  colors: ThemeTemplateData['colors'];
  syntax: ThemeTemplateData['syntax'];
}

const font: Theme['font'] = {
  ui: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  size: { xs: '11px', sm: '12px', md: '13px', lg: '15px' },
  lineHeight: 1.45,
};

const space: Theme['space'] = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '24px',
  6: '32px',
};
const radius: Theme['radius'] = { sm: '3px', md: '6px' };
const z: Theme['z'] = { floating: 20, popover: 30 };

export function buildTheme(template: ThemeTemplateData): Theme {
  return {
    mode: template.mode,
    font,
    space,
    radius,
    z,
    shadow: template.shadow,
    colors: template.colors,
    syntax: template.syntax,
  };
}
