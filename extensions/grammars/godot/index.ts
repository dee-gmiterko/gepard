import type { StreamParser } from '@codemirror/language';
import type { GrammarApi } from './api';
import { gdscript } from './gdscript';
import { gdresource } from './gdresource';
import { gdshader } from './gdshader';

const parsers: Record<string, StreamParser<unknown>> = {
  GDScript: gdscript as StreamParser<unknown>,
  GDResource: gdresource as StreamParser<unknown>,
  GDShader: gdshader as StreamParser<unknown>,
};

export default {
  id: 'godot',
  displayName: 'Godot',
  languages: [
    { name: 'GDScript', extensions: ['gd'] },
    { name: 'GDResource', extensions: ['tscn', 'tres', 'godot', 'import', 'gdns', 'gdnlib'] },
    { name: 'GDShader', extensions: ['gdshader', 'gdshaderinc'] },
  ],
  support(api: GrammarApi, language: string) {
    const parser = parsers[language];
    if (!parser) throw new Error(`unknown Godot language: ${language}`);
    return api.StreamLanguage.define(parser);
  },
};
