import type { MessageDescriptor } from 'react-intl'

// react-intl's own defineMessages types every value as `{}` unless the
// caller supplies each message's values as an explicit generic argument.
export function defineMessages<T extends Record<string, MessageDescriptor>>(messages: T): T {
  return messages
}
