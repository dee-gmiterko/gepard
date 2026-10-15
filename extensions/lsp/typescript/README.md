# Gepard TypeScript extension

TypeScript and JavaScript language extension for Gepard. Wraps the native
TypeScript language server.

## Behaviour

- Always runs its own pinned language server shipped inside the package.
- Never detects or runs the reviewed project's own TypeScript toolchain, so
  reviewing does not depend on that toolchain being installed or compatible.
