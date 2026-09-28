import { createRequire } from 'node:module';
import * as path from 'node:path';

const require = createRequire(import.meta.url);

const TS_EXTENSIONS = /\.(tsx?|mts|cts|jsx?|mjs|cjs)$/;

function bundledNativeExe() {
  const platformPkg = `@typescript/typescript-${process.platform}-${process.arch}`;
  let pkgJsonPath;
  try {
    pkgJsonPath = require.resolve(`${platformPkg}/package.json`);
  } catch (e) {
    throw new Error(
      `Bundled TypeScript native binary not found (${platformPkg} is not installed). ` +
        `It is an optionalDependency of extensions/lsp/typescript/package.json. (${e.message})`,
    );
  }
  const exe = path.join(
    path.dirname(pkgJsonPath),
    'lib',
    process.platform === 'win32' ? 'tsc.exe' : 'tsc',
  );
  // Electron cannot execute binaries from inside an asar archive.
  return exe.includes('app.asar') ? exe.replace('app.asar', 'app.asar.unpacked') : exe;
}

export default {
  id: 'typescript',
  displayName: 'TypeScript',
  matches(filePath) {
    return TS_EXTENSIONS.test(filePath);
  },
  async resolve(project) {
    return {
      command: bundledNativeExe(),
      args: ['--lsp', '--stdio'],
      cwd: project.root,
    };
  },
};
