import type { LineIndexFileMatches } from './line-index'

export interface LineIndexFileChange {
  path: string
  type: 'created' | 'changed' | 'deleted'
}

export type LineIndexRequest =
  | { type: 'build'; repoRoot: string; files: string[] }
  | { type: 'update'; changes: LineIndexFileChange[] }
  | { type: 'queryExactLine'; id: number; text: string; exclude?: { path: string; line: number } }
  | { type: 'queryWord'; id: number; word: string }

export type LineIndexResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'built'; fileCount: number }
  | { type: 'updated' }
  | { type: 'result'; id: number; files: LineIndexFileMatches[] }
