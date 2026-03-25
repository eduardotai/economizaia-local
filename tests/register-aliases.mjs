import Module from "node:module";
import path from "node:path";

const projectRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolve(specifier, parent, isMain, options) {
  if (specifier.startsWith("@/")) {
    const resolved = path.join(projectRoot, specifier.slice(2));
    return originalResolveFilename.call(this, resolved, parent, isMain, options);
  }

  return originalResolveFilename.call(this, specifier, parent, isMain, options);
};
