import { describe, expect, it } from 'vitest';
import { gdscript } from '../gdscript';
import { classOf, tokenize } from './support';

const SAMPLE = `@tool
class_name Player
extends CharacterBody2D

signal died(cause: String)

const SPEED := 200.0
var health: int = 10
@onready var sprite: Sprite2D = $Sprite2D
var label := %Label
var path := $"Some Node/Child"

func _ready() -> void:
	# comment with "quotes"
	sprite.play("idle")
	if health > 0 and not is_dead():
		emit_signal(&"died", 'x')
	var v := Vector2(1, 2) * PI
	print("""multi
line""")
	return
`;

describe('gdscript stream parser', () => {
  const tokens = tokenize(gdscript, SAMPLE);

  it('highlights annotations and declaration keywords', () => {
    expect(classOf(tokens, '@tool')).toBe('attributeName');
    expect(classOf(tokens, '@onready')).toBe('attributeName');
    expect(classOf(tokens, 'class_name')).toBe('definitionKeyword');
    expect(classOf(tokens, 'extends')).toBe('definitionKeyword');
    expect(classOf(tokens, 'signal')).toBe('definitionKeyword');
    expect(classOf(tokens, 'func')).toBe('definitionKeyword');
    expect(classOf(tokens, 'var')).toBe('definitionKeyword');
  });

  it('names declared symbols by what they declare', () => {
    expect(classOf(tokens, 'Player')).toBe('className');
    expect(classOf(tokens, 'CharacterBody2D')).toBe('className');
    expect(classOf(tokens, 'died')).toBe('propertyName');
    expect(classOf(tokens, 'SPEED')).toBe('constant');
    expect(classOf(tokens, 'health')).toBe('variableName');
    expect(classOf(tokens, '_ready')).toBe('function');
  });

  it('highlights types, calls, members and constants', () => {
    expect(classOf(tokens, 'String')).toBe('typeName');
    expect(classOf(tokens, 'int')).toBe('typeName');
    expect(classOf(tokens, 'void')).toBe('keyword');
    expect(classOf(tokens, 'Vector2')).toBe('typeName');
    expect(classOf(tokens, 'Sprite2D')).toBe('className');
    expect(classOf(tokens, 'play')).toBe('method');
    expect(classOf(tokens, 'is_dead')).toBe('function');
    expect(classOf(tokens, 'emit_signal')).toBe('function');
    expect(classOf(tokens, 'PI')).toBe('constant');
  });

  it('highlights control flow and word operators', () => {
    expect(classOf(tokens, 'if')).toBe('controlKeyword');
    expect(classOf(tokens, 'return')).toBe('controlKeyword');
    expect(classOf(tokens, 'and')).toBe('operatorKeyword');
    expect(classOf(tokens, 'not')).toBe('operatorKeyword');
    expect(classOf(tokens, ':=')).toBe('operator');
    expect(classOf(tokens, '->')).toBe('operator');
  });

  it('highlights node paths, strings, numbers and comments', () => {
    expect(classOf(tokens, '$Sprite2D')).toBe('string.special');
    expect(classOf(tokens, '%Label')).toBe('string.special');
    expect(classOf(tokens, '$"Some Node/Child"')).toBe('string.special');
    expect(classOf(tokens, '"idle"')).toBe('string');
    expect(classOf(tokens, "'x'")).toBe('string');
    expect(classOf(tokens, '&"died"')).toBe('string');
    expect(classOf(tokens, '200.0')).toBe('number');
    expect(classOf(tokens, '10')).toBe('number');
    expect(classOf(tokens, '# comment with "quotes"')).toBe('comment');
  });

  it('keeps a triple-quoted string open across lines', () => {
    const strings = tokens.filter(([, cls]) => cls === 'string').map(([text]) => text);
    expect(strings).toContain('"""multi');
    expect(strings).toContain('line"""');
    expect(classOf(tokens, 'line')).toBeUndefined();
  });
});
