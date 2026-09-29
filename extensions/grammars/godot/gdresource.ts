import type { StreamParser, StringStream } from '@codemirror/language';

// Ported from godot-tools' GDResource.tmLanguage.json (MIT, The Godot Engine
// community); see THIRD_PARTY_LICENSES.

export interface GDResourceState {
  string: boolean;
  header: boolean;
}

const SECTION = /^\[\s*[A-Za-z_][\w.]*(?=[\s\]])/;
const KEY = /^[A-Za-z_][\w/.-]*(?=\s*=)/;
const NUMBER =
  /^-?(?:0x[0-9a-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|inf|nan)\b/;

function readString(stream: StringStream, state: GDResourceState): string {
  while (!stream.eol()) {
    const ch = stream.next();
    if (ch === '\\') {
      stream.next();
      continue;
    }
    if (ch === '"') {
      state.string = false;
      break;
    }
  }
  return 'string';
}

export const gdresource: StreamParser<GDResourceState> = {
  name: 'gdresource',

  startState(): GDResourceState {
    return { string: false, header: false };
  },

  copyState(state: GDResourceState): GDResourceState {
    return { ...state };
  },

  token(stream: StringStream, state: GDResourceState): string | null {
    if (state.string) return readString(stream, state);
    if (stream.sol()) state.header = false;
    if (stream.eatSpace()) return null;

    const atLineStart = stream.string.slice(0, stream.start).trim() === '';
    const ch = stream.peek();

    if (ch === ';') {
      stream.skipToEnd();
      return 'comment';
    }

    if (atLineStart && stream.match(SECTION)) {
      state.header = true;
      return 'keyword';
    }
    if (state.header) {
      if (ch === ']') {
        stream.next();
        state.header = false;
        return null;
      }
      if (stream.match(/^[A-Za-z_]\w*(?=\s*=)/)) return 'propertyName';
    } else if (atLineStart && stream.match(KEY)) {
      return 'propertyName';
    }

    if (ch === '"') {
      stream.next();
      state.string = true;
      return readString(stream, state);
    }
    if (stream.match(/^[&^](?=")/)) return 'string';

    if (stream.match(NUMBER)) return 'number';
    if (stream.match(/^(?:true|false)\b/)) return 'bool';
    if (stream.match(/^null\b/)) return 'null';

    if (stream.match(/^(?:ExtResource|SubResource|Resource)(?=\s*\()/))
      return 'variableName.function';
    if (stream.match(/^[A-Za-z_]\w*(?=\s*\()/)) return 'typeName';
    if (stream.match(/^[A-Za-z_]\w*/)) return 'variableName';

    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: ';' },
  },
};
