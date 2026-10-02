import messages from './messages.json' with { type: 'json' };

/** @type {import('@gepard/common').LocaleExtension} */
const locale = {
  id: 'en',
  displayName: 'English',
  messages,
};

export default locale;
