import { describe, expect, it } from 'vitest';
import { gdshader } from '../gdshader';
import { classOf, tokenize } from './support';

const SAMPLE = `shader_type canvas_item;
render_mode blend_mix, unshaded;
#include "res://inc.gdshaderinc"

uniform sampler2D tex : source_color, filter_nearest;
uniform float strength : hint_range(0.0, 1.0) = 0.5;
const int STEPS = 4;

/* block
comment */
void fragment() {
	vec4 c = texture(tex, UV); // sample
	if (c.a > 0.5) {
		COLOR = mix(c, vec4(1.0), strength);
	} else {
		discard;
	}
}
`;

describe('gdshader stream parser', () => {
  const tokens = tokenize(gdshader, SAMPLE);

  it('highlights shader type and render modes', () => {
    expect(classOf(tokens, 'shader_type')).toBe('definitionKeyword');
    expect(classOf(tokens, 'canvas_item')).toBe('atom');
    expect(classOf(tokens, 'render_mode')).toBe('definitionKeyword');
    expect(classOf(tokens, 'blend_mix')).toBe('atom');
    expect(classOf(tokens, 'unshaded')).toBe('atom');
  });

  it('highlights declarations, types and hints', () => {
    expect(classOf(tokens, 'uniform')).toBe('definitionKeyword');
    expect(classOf(tokens, 'const')).toBe('definitionKeyword');
    expect(classOf(tokens, 'sampler2D')).toBe('typeName');
    expect(classOf(tokens, 'float')).toBe('typeName');
    expect(classOf(tokens, 'vec4')).toBe('typeName');
    expect(classOf(tokens, 'void')).toBe('typeName');
    expect(classOf(tokens, 'source_color')).toBe('attributeName');
    expect(classOf(tokens, 'filter_nearest')).toBe('attributeName');
    expect(classOf(tokens, 'hint_range')).toBe('attributeName');
    expect(classOf(tokens, 'STEPS')).toBe('constant');
  });

  it('highlights calls, builtins, members and control flow', () => {
    expect(classOf(tokens, 'fragment')).toBe('function');
    expect(classOf(tokens, 'texture')).toBe('function');
    expect(classOf(tokens, 'mix')).toBe('function');
    expect(classOf(tokens, 'UV')).toBe('constant');
    expect(classOf(tokens, 'COLOR')).toBe('constant');
    expect(classOf(tokens, 'a')).toBe('propertyName');
    expect(classOf(tokens, 'if')).toBe('controlKeyword');
    expect(classOf(tokens, 'discard')).toBe('controlKeyword');
  });

  it('highlights literals, comments and preprocessor lines', () => {
    expect(classOf(tokens, '0.5')).toBe('number');
    expect(classOf(tokens, '4')).toBe('number');
    expect(classOf(tokens, '"res://inc.gdshaderinc"')).toBe('string');
    expect(classOf(tokens, '#include')).toBe('keyword');
    expect(classOf(tokens, '// sample')).toBe('comment');
    expect(classOf(tokens, '/* block')).toBe('comment');
    expect(classOf(tokens, 'comment */')).toBe('comment');
    expect(classOf(tokens, 'comment')).toBeUndefined();
  });
});
