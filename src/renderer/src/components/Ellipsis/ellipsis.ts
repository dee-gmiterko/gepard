import { css } from 'styled-components'

export const truncate = css`
  overflow: hidden;
  text-overflow: ellipsis;
`

export const ellipsis = css`
  ${truncate}
  white-space: nowrap;
`
