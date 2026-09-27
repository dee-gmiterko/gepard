import { IpcError } from '../ipc/client'
import { intl } from '../i18n/intl'
import { defineMessages } from '../i18n/defineMessages'

const codeMessages = defineMessages({
  BAD_INPUT: { id: 'errors.code.badInput', defaultMessage: "That input isn't valid." },
  BAD_JSON: {
    id: 'errors.code.badJson',
    defaultMessage: 'Unexpected response from a command-line tool.'
  },
  EXEC_FAILED: { id: 'errors.code.execFailed', defaultMessage: 'A command-line tool failed.' },
  EXEC_NOT_FOUND: {
    id: 'errors.code.execNotFound',
    defaultMessage: 'A required command-line tool was not found.'
  },
  EXEC_TOO_LARGE: {
    id: 'errors.code.execTooLarge',
    defaultMessage: 'A command produced too much output.'
  },
  EXTENSION_ALREADY_EXISTS: {
    id: 'errors.code.extensionAlreadyExists',
    defaultMessage: 'This extension is already installed.'
  },
  EXTENSION_INVALID_FILE: {
    id: 'errors.code.extensionInvalidFile',
    defaultMessage: "That file isn't a valid extension."
  },
  FORBIDDEN: { id: 'errors.code.forbidden', defaultMessage: "This action isn't allowed." },
  GH_PARSE_ERROR: {
    id: 'errors.code.ghParseError',
    defaultMessage: "Unexpected response from GitHub's CLI."
  },
  GIT_DIFF_MISMATCH: {
    id: 'errors.code.gitDiffMismatch',
    defaultMessage: 'Unexpected response from git.'
  },
  GIT_PARSE_ERROR: {
    id: 'errors.code.gitParseError',
    defaultMessage: 'Unexpected response from git.'
  },
  GRAPHQL_ERROR: {
    id: 'errors.code.graphqlError',
    defaultMessage: "GitHub's API returned an error."
  },
  INTERNAL: { id: 'errors.code.internal', defaultMessage: 'Something went wrong.' },
  INVALID_PROJECT_ID: {
    id: 'errors.code.invalidProjectId',
    defaultMessage: 'This project is invalid.'
  },
  NO_LANGUAGE_SESSION: {
    id: 'errors.code.noLanguageSession',
    defaultMessage: 'No language server is available for this file yet.'
  },
  NOT_DELETABLE: {
    id: 'errors.code.notDeletable',
    defaultMessage: "This comment can't be deleted."
  },
  NOT_EDITABLE: { id: 'errors.code.notEditable', defaultMessage: "This comment can't be edited." },
  NOT_FOUND: { id: 'errors.code.notFound', defaultMessage: 'Not found.' },
  PROJECT_NOT_CLONED: {
    id: 'errors.code.projectNotCloned',
    defaultMessage: "This project hasn't been cloned yet."
  },
  PROJECT_NOT_FOUND: {
    id: 'errors.code.projectNotFound',
    defaultMessage: 'This project could not be found.'
  },
  SCHEMA_MISMATCH: {
    id: 'errors.code.schemaMismatch',
    defaultMessage: 'Unexpected response from a command-line tool.'
  },
  STORE_CORRUPT: {
    id: 'errors.code.storeCorrupt',
    defaultMessage: 'Local review data is corrupted.'
  },
  UNSUPPORTED_LEFT_ANCHOR: {
    id: 'errors.code.unsupportedLeftAnchor',
    defaultMessage: "GitHub can't anchor a comment there."
  }
})

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export interface LocalizedError {
  message: string
  detail?: string
}

export function localizedErrorMessage(error: unknown): LocalizedError {
  if (error instanceof IpcError) {
    const known = codeMessages[error.code as keyof typeof codeMessages]
    if (known) return { message: intl.formatMessage(known), detail: error.message }
  }
  return { message: errorMessage(error) }
}
