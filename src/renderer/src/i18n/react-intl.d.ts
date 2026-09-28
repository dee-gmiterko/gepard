import type { MessageDescriptor } from 'react-intl';

declare module 'react-intl' {
  // Shadows react-intl's overload that brands every entry as taking no values ({}), which rejects `values` at call sites.
  export function defineMessages<const D extends Record<string, MessageDescriptor>>(
    messages: D,
  ): { readonly [K in keyof D]: Readonly<D[K]> };
}
