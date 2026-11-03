const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const appRoot = path.resolve(__dirname, '..', '..');
const sourceRoot = path.join(appRoot, 'src');
const extensions = ['.ts', '.tsx'];

function resolveProjectModule(candidate) {
  for (const extension of extensions) {
    if (fs.existsSync(`${candidate}${extension}`)) return `${candidate}${extension}`;
  }
  for (const extension of extensions) {
    const indexPath = path.join(candidate, `index${extension}`);
    if (fs.existsSync(indexPath)) return indexPath;
  }
  return null;
}

/**
 * Executes an actual project TypeScript module in memory.  The optional source
 * transform is limited to test-only visibility of private pure entry points.
 */
function loadTypeScriptModule(filePath, { cache = new Map(), transformSource } = {}) {
  const normalizedPath = path.normalize(filePath);
  if (cache.has(normalizedPath)) return cache.get(normalizedPath).exports;

  let source = fs.readFileSync(normalizedPath, 'utf8');
  if (transformSource) source = transformSource(source, normalizedPath);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: normalizedPath,
  }).outputText;
  const module = { exports: {} };
  cache.set(normalizedPath, module);

  const localRequire = (specifier) => {
    const candidate = specifier.startsWith('@/')
      ? path.join(sourceRoot, specifier.slice(2))
      : specifier.startsWith('.')
        ? path.resolve(path.dirname(normalizedPath), specifier)
        : null;
    if (!candidate) return require(specifier);

    const projectModule = resolveProjectModule(candidate);
    if (projectModule) return loadTypeScriptModule(projectModule, { cache, transformSource });
    return require(candidate);
  };

  const execute = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
  execute(module.exports, localRequire, module, normalizedPath, path.dirname(normalizedPath));
  return module.exports;
}

module.exports = { appRoot, loadTypeScriptModule };
