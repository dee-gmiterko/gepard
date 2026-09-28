import 'styled-components';
import type { Theme } from './tokens';

declare module 'styled-components' {
  export interface DefaultTheme extends Theme {}
}
