import { describe, expect, it } from 'vitest';
import { gdresource } from '../gdresource';
import { classOf, tokenize } from './support';

const SCENE = `[gd_scene load_steps=3 format=3 uid="uid://c1abc"]

[ext_resource type="Script" path="res://player.gd" id="1_x"]

[sub_resource type="Animation" id="Animation_1"]
resource_name = &"idle"
tracks/0/keys = {
"times": PackedFloat32Array(0, 0.5),
"values": [Vector2(0, 0), -inf]
}

[node name="Player" type="CharacterBody2D" groups=["enemies"]]
position = Vector2(1.5, -2)
script = ExtResource("1_x")
visible = false
metadata/note = null
`;

const PROJECT = `; Engine configuration file.
config_version=5

[application]

config/name="Regrow"
run/main_scene="res://main.tscn"
`;

describe('gdresource stream parser', () => {
  const scene = tokenize(gdresource, SCENE);
  const project = tokenize(gdresource, PROJECT);

  it('highlights section headers and their attributes', () => {
    expect(classOf(scene, '[gd_scene')).toBe('keyword');
    expect(classOf(scene, '[node')).toBe('keyword');
    expect(classOf(scene, 'load_steps')).toBe('propertyName');
    expect(classOf(scene, 'type')).toBe('propertyName');
    expect(classOf(scene, 'groups')).toBe('propertyName');
    expect(classOf(project, '[application')).toBe('keyword');
  });

  it('highlights property keys including slashes', () => {
    expect(classOf(scene, 'resource_name')).toBe('propertyName');
    expect(classOf(scene, 'tracks/0/keys')).toBe('propertyName');
    expect(classOf(scene, 'metadata/note')).toBe('propertyName');
    expect(classOf(project, 'config/name')).toBe('propertyName');
    expect(classOf(project, 'config_version')).toBe('propertyName');
  });

  it('highlights values', () => {
    expect(classOf(scene, '"res://player.gd"')).toBe('string');
    expect(classOf(scene, '&"idle"')).toBe('string');
    expect(classOf(scene, '"times"')).toBe('string');
    expect(classOf(scene, '0.5')).toBe('number');
    expect(classOf(scene, '-2')).toBe('number');
    expect(classOf(scene, '-inf')).toBe('number');
    expect(classOf(scene, 'false')).toBe('bool');
    expect(classOf(scene, 'null')).toBe('null');
    expect(classOf(scene, 'Vector2')).toBe('typeName');
    expect(classOf(scene, 'PackedFloat32Array')).toBe('typeName');
    expect(classOf(scene, 'ExtResource')).toBe('function');
  });

  it('highlights comments', () => {
    expect(classOf(project, '; Engine configuration file.')).toBe('comment');
  });
});
