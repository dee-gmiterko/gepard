import type { GrammarExtension } from '@gepard/common';
import { support } from './support';

export default {
  id: 'godot',
  displayName: 'Godot',
  languages: [
    { name: 'GDScript', extensions: ['gd'] },
    { name: 'GDResource', extensions: ['tscn', 'tres', 'godot', 'import', 'gdns', 'gdnlib'] },
    { name: 'GDShader', extensions: ['gdshader', 'gdshaderinc'] },
  ],
  support,
} satisfies GrammarExtension;
