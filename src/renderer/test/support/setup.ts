process.env.DEBUG_PRINT_LIMIT ??= '2500';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('lang');
});
