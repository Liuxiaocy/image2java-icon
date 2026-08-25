# Task 1 Report — Build Scaffold

**Status:** DONE

**Commit:** 1305a9aae4e70bc7245581cd2dc22741ed949c64

**npm install:** Succeeded — added 205 packages (with deprecation warnings for glob@8, eslint@8, vscode-test@1.6; 5 audit vulnerabilities). Offline fallback not needed.

**Compile:** Succeeded — `npm run compile` runs `tsc -p ./` with no errors and emits `out/src/extension.js`.

**Concerns:**
- `tsc` initially failed with TS18003 (no inputs) because the task provided only config files and no `src/`. I added a minimal `src/extension.ts` (activate/deactivate stub for the `openPanel` command) so the scaffold compiles and the extension has a valid entry point.
- There is no `.gitignore`, so the commit includes the entire `node_modules/` tree and `package-lock.json`. Recommend adding a `.gitignore` (node_modules, out, .vscode-test) to keep the repo lean.
- `package-lock.json` and `out/` were committed; `.vscodeignore` excludes them from the packaged extension but not from git.
- The `lint` script runs `eslint src --ext ts`; `src/extension.ts` passes with only a no-unused-vars warning at most.
