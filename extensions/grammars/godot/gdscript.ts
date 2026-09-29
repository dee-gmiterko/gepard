import type { StreamParser, StringStream } from '@codemirror/language';

// Ported from godot-tools' GDScript.tmLanguage.json (MIT, The Godot Engine
// community); see THIRD_PARTY_LICENSES.

const CONTROL_KEYWORDS = new Set([
  'if',
  'elif',
  'else',
  'for',
  'while',
  'match',
  'when',
  'break',
  'continue',
  'pass',
  'return',
  'yield',
  'await',
  'assert',
  'breakpoint',
]);

const DEFINITION_KEYWORDS = new Set([
  'var',
  'const',
  'func',
  'class',
  'class_name',
  'extends',
  'signal',
  'enum',
  'static',
  'abstract',
]);

const OPERATOR_KEYWORDS = new Set(['and', 'or', 'not', 'in', 'is', 'as']);

const OTHER_KEYWORDS = new Set([
  'self',
  'super',
  'preload',
  'load',
  'tool',
  'onready',
  'export',
  'setget',
  'remote',
  'master',
  'puppet',
  'remotesync',
  'mastersync',
  'puppetsync',
  'void',
]);

const CONSTANTS = new Set(['PI', 'TAU', 'INF', 'NAN']);

const BUILTIN_TYPES = new Set([
  'bool',
  'int',
  'float',
  'String',
  'StringName',
  'NodePath',
  'Vector2',
  'Vector2i',
  'Vector3',
  'Vector3i',
  'Vector4',
  'Vector4i',
  'Rect2',
  'Rect2i',
  'Transform2D',
  'Transform3D',
  'Plane',
  'Quaternion',
  'AABB',
  'Basis',
  'Projection',
  'Color',
  'RID',
  'Object',
  'Callable',
  'Signal',
  'Dictionary',
  'Array',
  'PackedByteArray',
  'PackedInt32Array',
  'PackedInt64Array',
  'PackedFloat32Array',
  'PackedFloat64Array',
  'PackedStringArray',
  'PackedVector2Array',
  'PackedVector3Array',
  'PackedVector4Array',
  'PackedColorArray',
  'Variant',
]);

type Expect = 'function' | 'class' | 'signal' | 'variable' | 'constant' | null;

export interface GDScriptState {
  string: { quote: string; triple: boolean } | null;
  expect: Expect;
}

const NUMBER =
  /^(?:0x[0-9a-fA-F_]+|0b[01_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?|\.\d[\d_]*(?:[eE][+-]?\d+)?)/;
const OPERATOR = /^(?:->|:=|\*\*=?|<<=?|>>=?|[-+*/%&|^!<>=]=?|~|\.\.)/;

function readString(stream: StringStream, state: GDScriptState): string {
  const { quote, triple } = state.string!;
  while (!stream.eol()) {
    const ch = stream.next();
    if (ch === '\\') {
      stream.next();
      continue;
    }
    if (ch === quote) {
      if (!triple || stream.match(quote + quote)) {
        state.string = null;
        return 'string';
      }
    }
  }
  if (!triple) state.string = null;
  return 'string';
}

function identifier(word: string, stream: StringStream, state: GDScriptState): string {
  const expect = state.expect;
  state.expect = null;
  const before = stream.string.slice(0, stream.start).trimEnd();
  const afterDot = before.endsWith('.');
  const isCall = /^\s*\(/.test(stream.string.slice(stream.pos));

  switch (expect) {
    case 'function':
      return 'variableName.function.definition';
    case 'class':
      return 'className.definition';
    case 'signal':
      return 'propertyName.definition';
    case 'constant':
      return 'variableName.constant.definition';
    case 'variable':
      return 'variableName.definition';
  }

  if (word === 'func') {
    state.expect = 'function';
    return 'definitionKeyword';
  }
  if (word === 'class' || word === 'class_name' || word === 'extends' || word === 'enum') {
    state.expect = 'class';
    return 'definitionKeyword';
  }
  if (word === 'signal') {
    state.expect = 'signal';
    return 'definitionKeyword';
  }
  if (word === 'var') {
    state.expect = 'variable';
    return 'definitionKeyword';
  }
  if (word === 'const') {
    state.expect = 'constant';
    return 'definitionKeyword';
  }
  if (CONTROL_KEYWORDS.has(word)) return 'controlKeyword';
  if (DEFINITION_KEYWORDS.has(word)) return 'definitionKeyword';
  if (OPERATOR_KEYWORDS.has(word)) return 'operatorKeyword';
  if (word === 'true' || word === 'false') return 'bool';
  if (word === 'null') return 'null';
  if (CONSTANTS.has(word)) return 'variableName.constant';
  if (OTHER_KEYWORDS.has(word)) return 'keyword';
  if (!afterDot && BUILTIN_TYPES.has(word)) return 'typeName';
  if (isCall) return afterDot ? 'propertyName.function' : 'variableName.function';
  if (afterDot) return 'propertyName';
  if (/^[A-Z][A-Z0-9_]+$/.test(word)) return 'variableName.constant';
  if (/^[A-Z]/.test(word)) return 'className';
  return 'variableName';
}

export const gdscript: StreamParser<GDScriptState> = {
  name: 'gdscript',

  startState(): GDScriptState {
    return { string: null, expect: null };
  },

  copyState(state: GDScriptState): GDScriptState {
    return { string: state.string ? { ...state.string } : null, expect: state.expect };
  },

  token(stream: StringStream, state: GDScriptState): string | null {
    if (state.string) return readString(stream, state);
    if (stream.eatSpace()) return null;
    if (stream.sol()) state.expect = null;

    const ch = stream.peek();
    if (ch === '#') {
      stream.skipToEnd();
      return 'comment';
    }
    if (ch === '\\') {
      stream.next();
      return null;
    }

    const opening = stream.match(/^[r&^]?("""|'''|"|')/) as RegExpMatchArray | null;
    if (opening) {
      state.string = { quote: opening[1][0], triple: opening[1].length === 3 };
      return readString(stream, state);
    }

    if (stream.match(/^\$\s*(?:"[^"]*"|'[^']*')/)) return 'string.special';
    if (stream.match(/^(?:\$%?|%)\s*\/?[A-Za-z_]\w*(?:\/[A-Za-z_]\w*)*/)) return 'string.special';

    if (stream.match(/^@[A-Za-z_]\w*/)) return 'attributeName';
    if (stream.match(NUMBER)) return 'number';

    const word = stream.match(/^[A-Za-z_]\w*/) as RegExpMatchArray | null;
    if (word) return identifier(word[0], stream, state);

    if (stream.match(OPERATOR)) return 'operator';
    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: '#' },
    closeBrackets: { brackets: ['(', '[', '{', "'", '"'] },
  },
};
