import type { StreamLanguage, StreamParser } from '@codemirror/language';
import type { GrammarApi } from '@gepard/common';
import { gdscript } from './gdscript';
import { gdresource } from './gdresource';
import { gdshader } from './gdshader';

const parsers: Record<string, StreamParser<unknown>> = {
  GDScript: gdscript,
  GDResource: gdresource,
  GDShader: gdshader,
};

export function support(api: GrammarApi, language: string): StreamLanguage<unknown> {
  const parser = parsers[language];
  if (!parser) throw new Error(`unknown Godot language: ${language}`);
  return api.StreamLanguage.define(parser);
}
