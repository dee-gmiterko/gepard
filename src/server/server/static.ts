import express, { type Express } from 'express';

const IMMUTABLE_ASSETS_PREFIX = '/assets/';

export function createStaticApp(root: string): Express {
  return express().use(
    express.static(root, {
      setHeaders: (res, file) => {
        res.setHeader(
          'Cache-Control',
          file.includes(IMMUTABLE_ASSETS_PREFIX)
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        );
      },
    }),
  );
}
