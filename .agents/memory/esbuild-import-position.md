---
name: Esbuild non-top-level imports
description: esbuild can silently mishandle import statements placed after non-import code (function declarations, const assignments, etc.) — always keep all imports at the top of every file.
---

## The rule
All `import` statements must appear at the very top of every TypeScript/JavaScript file, before any other code.

**Why:** The ES module spec requires import declarations to be at module top-level and syntactically before executable code. TypeScript's compiler is lenient and may accept mid-file imports without error, and typecheck passes cleanly. But esbuild's bundler can silently mishandle them — the imported value may be `undefined` at runtime, causing route handlers to throw when Express calls `.use(undefined)`. This manifests as ALL routes in that router silently disappearing (404 on every path) with no error in the logs.

**How to apply:** If you find an import statement anywhere after a `const`, `function`, `export`, or blank-line after executable code, move it to the top of the file. Run the server and test a route to confirm.
