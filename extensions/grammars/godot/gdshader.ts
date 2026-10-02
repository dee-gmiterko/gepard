import type { StreamParser, StringStream } from '@codemirror/language';

const CONTROL_KEYWORDS = new Set([
  'if',
  'else',
  'for',
  'while',
  'do',
  'return',
  'break',
  'continue',
  'switch',
  'case',
  'default',
  'discard',
]);

const STORAGE_KEYWORDS = new Set([
  'shader_type',
  'render_mode',
  'stencil_mode',
  'group_uniforms',
  'struct',
  'const',
  'uniform',
  'varying',
  'instance',
  'global',
  'in',
  'out',
  'inout',
  'flat',
  'smooth',
  'lowp',
  'mediump',
  'highp',
]);

const TYPES = new Set([
  'void',
  'bool',
  'int',
  'uint',
  'float',
  'bvec2',
  'bvec3',
  'bvec4',
  'ivec2',
  'ivec3',
  'ivec4',
  'uvec2',
  'uvec3',
  'uvec4',
  'vec2',
  'vec3',
  'vec4',
  'mat2',
  'mat3',
  'mat4',
  'sampler2D',
  'isampler2D',
  'usampler2D',
  'sampler2DArray',
  'isampler2DArray',
  'usampler2DArray',
  'sampler3D',
  'isampler3D',
  'usampler3D',
  'samplerCube',
  'samplerCubeArray',
  'samplerExternalOES',
]);

const SHADER_TYPES = new Set(['spatial', 'canvas_item', 'particles', 'sky', 'fog']);

type Mode = 'render_mode' | 'shader_type' | null;

export interface GDShaderState {
  blockComment: boolean;
  mode: Mode;
}

const NUMBER =
  /^(?:0x[0-9a-fA-F]+[uU]?|\d+\.\d*(?:[eE][+-]?\d+)?[fF]?|\.\d+(?:[eE][+-]?\d+)?[fF]?|\d+(?:[eE][+-]?\d+)?[uUfF]?)/;
const OPERATOR = /^(?:<<=?|>>=?|&&|\|\||[-+*/%&|^!<>=]=?|~|\?|:)/;

function readBlockComment(stream: StringStream, state: GDShaderState): string {
  while (!stream.eol()) {
    if (stream.match('*/')) {
      state.blockComment = false;
      break;
    }
    stream.next();
  }
  return 'comment';
}

function identifier(word: string, stream: StringStream, state: GDShaderState): string {
  const before = stream.string.slice(0, stream.start).trimEnd();
  const afterDot = before.endsWith('.');
  const afterColon = before.endsWith(':') || before.endsWith(',');
  const isCall = /^\s*\(/.test(stream.string.slice(stream.pos));

  if (state.mode === 'shader_type') {
    state.mode = null;
    return SHADER_TYPES.has(word) ? 'atom' : 'variableName';
  }
  if (state.mode === 'render_mode') return 'atom';

  if (word === 'shader_type' || word === 'render_mode') {
    state.mode = word;
    return 'definitionKeyword';
  }
  if (CONTROL_KEYWORDS.has(word)) return 'controlKeyword';
  if (STORAGE_KEYWORDS.has(word)) return 'definitionKeyword';
  if (word === 'true' || word === 'false') return 'bool';
  if (TYPES.has(word)) return 'typeName';
  if (afterDot) return 'propertyName';
  if (afterColon && /^(?:hint_|filter_|repeat_|source_color|instance_index)/.test(word))
    return 'attributeName';
  if (isCall) return 'variableName.function';
  if (/^[A-Z][A-Z0-9_]+$/.test(word)) return 'variableName.constant';
  return 'variableName';
}

export const gdshader: StreamParser<GDShaderState> = {
  name: 'gdshader',

  startState(): GDShaderState {
    return { blockComment: false, mode: null };
  },

  copyState(state: GDShaderState): GDShaderState {
    return { ...state };
  },

  token(stream: StringStream, state: GDShaderState): string | null {
    if (state.blockComment) return readBlockComment(stream, state);
    if (stream.eatSpace()) return null;

    const ch = stream.peek();
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match('/*')) {
      state.blockComment = true;
      return readBlockComment(stream, state);
    }
    if (ch === '#' && stream.string.slice(0, stream.start).trim() === '') {
      stream.match(/^#\s*\w*/);
      return 'keyword';
    }
    if (ch === '"') {
      stream.next();
      while (!stream.eol()) {
        const c = stream.next();
        if (c === '\\') stream.next();
        else if (c === '"') break;
      }
      return 'string';
    }
    if (ch === ';') {
      stream.next();
      state.mode = null;
      return null;
    }

    if (stream.match(NUMBER)) return 'number';

    const word = stream.match(/^[A-Za-z_]\w*/);
    if (word && word !== true) return identifier(word[0], stream, state);

    if (stream.match(OPERATOR)) return 'operator';
    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '[', '{', '"'] },
  },
};
