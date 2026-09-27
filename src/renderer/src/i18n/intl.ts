import { createIntl, createIntlCache, ReactIntlErrorCode } from 'react-intl'
import { availableLocales, defaultLocale, messagesByLocale } from './locales'
import { resolveLocale } from './resolveLocale'
import { invoke } from '../ipc/client'

export const locale = resolveLocale(availableLocales, navigator.languages, defaultLocale)

const cache = createIntlCache()

export const intl = createIntl(
  {
    locale,
    defaultLocale,
    messages: messagesByLocale[locale],
    onError: (error) => {
      if (error.code === ReactIntlErrorCode.MISSING_TRANSLATION) return
      invoke('log.write', { level: 'warn', scope: 'intl', message: error.message }).catch(() => {})
    }
  },
  cache
)
