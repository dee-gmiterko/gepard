import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const STANDARD_TOKEN_TYPES = [
  'namespace',
  'type',
  'class',
  'enum',
  'interface',
  'struct',
  'typeParameter',
  'parameter',
  'variable',
  'property',
  'enumMember',
  'event',
  'function',
  'method',
  'macro',
  'keyword',
  'modifier',
  'comment',
  'string',
  'number',
  'regexp',
  'operator',
  'decorator',
];
const STANDARD_TOKEN_MODIFIERS = [
  'declaration',
  'definition',
  'readonly',
  'static',
  'deprecated',
  'abstract',
  'async',
  'modification',
  'documentation',
  'defaultLibrary',
];

// Mirrors the capabilities the main process advertises in LspSession.
const CLIENT_CAPABILITIES = {
  general: { positionEncodings: ['utf-16'] },
  workspace: {
    configuration: true,
    workspaceFolders: true,
    didChangeWatchedFiles: { dynamicRegistration: true },
    didChangeConfiguration: { dynamicRegistration: true },
    symbol: {},
  },
  window: { workDoneProgress: true },
  textDocument: {
    synchronization: { dynamicRegistration: false },
    definition: { linkSupport: false },
    references: {},
    documentSymbol: { hierarchicalDocumentSymbolSupport: true },
    semanticTokens: {
      requests: { range: true, full: false },
      tokenTypes: STANDARD_TOKEN_TYPES,
      tokenModifiers: STANDARD_TOKEN_MODIFIERS,
      formats: ['relative'],
    },
  },
};

export class LspClient {
  #child;
  #buffer = Buffer.alloc(0);
  #pending = new Map();
  #nextId = 1;
  #root;
  #languageId;
  legend = { tokenTypes: [], tokenModifiers: [] };

  static async start(plan, languageId) {
    const client = new LspClient(plan, languageId);
    const rootUri = pathToFileURL(plan.cwd).toString();
    const result = await client.request('initialize', {
      processId: process.pid,
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: basename(plan.cwd) }],
      capabilities: CLIENT_CAPABILITIES,
    });
    client.legend = result.capabilities.semanticTokensProvider.legend;
    client.notify('initialized', {});
    return client;
  }

  constructor(plan, languageId) {
    this.#root = plan.cwd;
    this.#languageId = languageId;
    this.#child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.#child.stdout.on('data', (chunk) => this.#receive(chunk));
    this.#child.once('exit', (code, signal) => {
      for (const { reject } of this.#pending.values()) {
        reject(new Error(`language server exited (code=${code}, signal=${signal})`));
      }
      this.#pending.clear();
    });
  }

  uri(relativePath) {
    return pathToFileURL(join(this.#root, relativePath)).toString();
  }

  request(method, params) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method, params) {
    this.#send({ jsonrpc: '2.0', method, params });
  }

  async withDocument(relativePath, fn) {
    const uri = this.uri(relativePath);
    const text = await readFile(join(this.#root, relativePath), 'utf8');
    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId: this.#languageId(relativePath), version: 1, text },
    });
    try {
      return await fn(uri, text);
    } finally {
      this.notify('textDocument/didClose', { textDocument: { uri } });
    }
  }

  decodeTokens(data) {
    const tokens = [];
    let line = 0;
    let character = 0;
    for (let i = 0; i < data.length; i += 5) {
      const [deltaLine, deltaChar, length, typeIndex, modifierBits] = data.slice(i, i + 5);
      line += deltaLine;
      character = deltaLine === 0 ? character + deltaChar : deltaChar;
      tokens.push({
        line,
        character,
        length,
        type: this.legend.tokenTypes[typeIndex],
        modifiers: this.legend.tokenModifiers.filter((_, bit) => (modifierBits & (1 << bit)) !== 0),
      });
    }
    return tokens;
  }

  async dispose() {
    await this.request('shutdown');
    this.notify('exit');
    this.#child.kill();
  }

  #send(message) {
    const body = Buffer.from(JSON.stringify(message));
    this.#child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    this.#child.stdin.write(body);
  }

  #receive(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    for (;;) {
      const headerEnd = this.#buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const length = Number(/Content-Length: (\d+)/.exec(this.#buffer.subarray(0, headerEnd))[1]);
      const bodyStart = headerEnd + 4;
      if (this.#buffer.length < bodyStart + length) return;
      const message = JSON.parse(this.#buffer.subarray(bodyStart, bodyStart + length).toString());
      this.#buffer = this.#buffer.subarray(bodyStart + length);
      this.#dispatch(message);
    }
  }

  #dispatch(message) {
    if (message.id === undefined) return;
    if (message.method) {
      const result =
        message.method === 'workspace/configuration'
          ? (message.params.items ?? []).map(() => ({}))
          : null;
      this.#send({ jsonrpc: '2.0', id: message.id, result });
      return;
    }
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    this.#pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result);
  }
}
