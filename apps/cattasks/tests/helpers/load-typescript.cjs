const fs = require("node:fs");
const path = require("node:path");
const typescript = require("../../node_modules/typescript");

function loadTypeScript(modulePath) {
  const resolvedPath = require.resolve(modulePath);
  const originalLoader = require.extensions[".ts"];

  require.extensions[".ts"] = (module, filename) => {
    if (filename !== resolvedPath) {
      if (originalLoader) return originalLoader(module, filename);
      throw new Error(`unexpected TypeScript module: ${filename}`);
    }

    const source = fs.readFileSync(filename, "utf8");
    const output = typescript.transpileModule(source, {
      compilerOptions: {module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022},
      fileName: path.basename(filename),
    });
    module._compile(output.outputText, filename);
  };

  try {
    delete require.cache[resolvedPath];
    return require(resolvedPath);
  } finally {
    if (originalLoader) require.extensions[".ts"] = originalLoader;
    else delete require.extensions[".ts"];
  }
}

module.exports = {loadTypeScript};
