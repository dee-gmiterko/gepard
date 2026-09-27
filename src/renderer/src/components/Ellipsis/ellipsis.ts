// Kept out of Ellipsis.tsx so that file exports only components, as required
// for React Fast Refresh.
import { css } from 'styled-components'

export const truncate = css`
  overflow: hidden;
  text-overflow: ellipsis;
`

export const ellipsis = css`
  ${truncate}
  white-space: nowrap;
`
