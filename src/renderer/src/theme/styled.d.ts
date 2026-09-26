// Theme typing augmentation (report 04 §1.2) — verified to compile.
import 'styled-components'
import type { Theme } from './tokens'

declare module 'styled-components' {
  export interface DefaultTheme extends Theme {}
}
