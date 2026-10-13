import { defineMessages, type IntlShape, type MessageDescriptor } from 'react-intl';
import { errorMessage, AppError, MissingDependencyError } from '@gepard/common';

const codeMessages = defineMessages({
  AUTH_REQUIRED: {
    id: 'errors.code.authRequired',
    defaultMessage: 'GitHub rejected the sign-in. Run `gh auth login` and try again.',
  },
  BAD_INPUT: { id: 'errors.code.badInput', defaultMessage: "That input isn't valid." },
  BAD_JSON: {
    id: 'errors.code.badJson',
    defaultMessage: 'Unexpected response from a command-line tool.',
  },
  CONNECTION_FAILED: {
    id: 'errors.code.connectionFailed',
    defaultMessage: 'GitHub could not be reached. Check your connection and try again.',
  },
  EXEC_FAILED: { id: 'errors.code.execFailed', defaultMessage: 'A command-line tool failed.' },
  EXEC_NOT_FOUND: {
    id: 'errors.code.execNotFound',
    defaultMessage: 'A required command-line tool was not found.',
  },
  EXEC_TOO_LARGE: {
    id: 'errors.code.execTooLarge',
    defaultMessage: 'A command produced too much output.',
  },
  EXTENSION_ALREADY_EXISTS: {
    id: 'errors.code.extensionAlreadyExists',
    defaultMessage: 'This extension is already installed.',
  },
  EXTENSION_IN_USE: {
    id: 'errors.code.extensionInUse',
    defaultMessage: 'The installed extension could not be replaced. Restart Gepard and try again.',
  },
  EXTENSION_INVALID_ARCHIVE: {
    id: 'errors.code.extensionInvalidArchive',
    defaultMessage: "The downloaded file isn't a valid extension archive.",
  },
  EXTENSION_INVALID_FILE: {
    id: 'errors.code.extensionInvalidFile',
    defaultMessage: "That file isn't a valid extension.",
  },
  EXTENSION_INVALID_PACKAGE: {
    id: 'errors.code.extensionInvalidPackage',
    defaultMessage: "That package isn't a valid extension.",
  },
  EXTENSION_RELEASE_NOT_FOUND: {
    id: 'errors.code.extensionReleaseNotFound',
    defaultMessage: 'No extension release was found for this platform.',
  },
  EXTENSION_UNSUPPORTED_PLATFORM: {
    id: 'errors.code.extensionUnsupportedPlatform',
    defaultMessage: "This extension isn't available for this platform.",
  },
  FORBIDDEN: { id: 'errors.code.forbidden', defaultMessage: "This action isn't allowed." },
  GH_PARSE_ERROR: {
    id: 'errors.code.ghParseError',
    defaultMessage: "Unexpected response from GitHub's CLI.",
  },
  GIT_DIFF_MISMATCH: {
    id: 'errors.code.gitDiffMismatch',
    defaultMessage: 'Unexpected response from git.',
  },
  GIT_PARSE_ERROR: {
    id: 'errors.code.gitParseError',
    defaultMessage: 'Unexpected response from git.',
  },
  GRAPHQL_ERROR: {
    id: 'errors.code.graphqlError',
    defaultMessage: "GitHub's API returned an error.",
  },
  INTERNAL: { id: 'errors.code.internal', defaultMessage: 'Something went wrong.' },
  INVALID_PROJECT_ID: {
    id: 'errors.code.invalidProjectId',
    defaultMessage: 'This project is invalid.',
  },
  MISSING_DEPENDENCY: {
    id: 'errors.code.missingDependency',
    defaultMessage:
      '`{dependency}` is required but was not found. Install it and make sure it is on your PATH.',
  },
  NOT_DELETABLE: {
    id: 'errors.code.notDeletable',
    defaultMessage: "This comment can't be deleted.",
  },
  NOT_EDITABLE: { id: 'errors.code.notEditable', defaultMessage: "This comment can't be edited." },
  NOT_FOUND: { id: 'errors.code.notFound', defaultMessage: 'Not found.' },
  PROJECT_LOCKED: {
    id: 'errors.code.projectLocked',
    defaultMessage: 'This project is already open in another window.',
  },
  PROJECT_NOT_CLONED: {
    id: 'errors.code.projectNotCloned',
    defaultMessage: "This project hasn't been cloned yet.",
  },
  PROJECT_NOT_FOUND: {
    id: 'errors.code.projectNotFound',
    defaultMessage: 'This project could not be found.',
  },
  PR_HEAD_CHANGED: {
    id: 'errors.code.prHeadChanged',
    defaultMessage:
      'This pull request was updated by its author. Reload it to see the new version.',
  },
  PR_HEAD_UNAVAILABLE: {
    id: 'errors.code.prHeadUnavailable',
    defaultMessage: "This pull request's code could not be fetched from GitHub.",
  },
  RATE_LIMITED: {
    id: 'errors.code.rateLimited',
    defaultMessage: "GitHub's API rate limit was reached. Try again in a few minutes.",
  },
  SCHEMA_MISMATCH: {
    id: 'errors.code.schemaMismatch',
    defaultMessage: 'Unexpected response from a command-line tool.',
  },
  STALE_SHA: {
    id: 'errors.code.staleSha',
    defaultMessage: 'The project moved to a different commit while this was loading.',
  },
  STORE_CORRUPT: {
    id: 'errors.code.storeCorrupt',
    defaultMessage: 'Local review data is corrupted.',
  },
  UNSUPPORTED_LEFT_ANCHOR: {
    id: 'errors.code.unsupportedLeftAnchor',
    defaultMessage: "GitHub can't anchor a comment there.",
  },
});

function isKnownCode(code: string): code is keyof typeof codeMessages {
  return Object.hasOwn(codeMessages, code);
}

export type ErrorValues = Record<string, string>;

export interface DescribedError {
  message: string | MessageDescriptor;
  values?: ErrorValues;
  detail?: string;
}

export function describeError(error: unknown): DescribedError {
  if (error instanceof MissingDependencyError) {
    return {
      message: codeMessages.MISSING_DEPENDENCY,
      values: { dependency: error.dependency },
      detail: error.message,
    };
  }
  if (error instanceof AppError && isKnownCode(error.code)) {
    return { message: codeMessages[error.code], detail: error.message };
  }
  return { message: errorMessage(error) };
}

export function formatErrorText(
  intl: IntlShape,
  message: string | MessageDescriptor,
  values?: ErrorValues,
): string {
  return typeof message === 'string' ? message : intl.formatMessage(message, values);
}

export function errorText(message: string | MessageDescriptor, values?: ErrorValues): string {
  if (typeof message === 'string') return message;
  const text =
    typeof message.defaultMessage === 'string' ? message.defaultMessage : (message.id ?? '');
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => values?.[name] ?? placeholder);
}
