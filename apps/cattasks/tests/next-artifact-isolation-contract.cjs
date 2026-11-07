const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const typescript = require("../node_modules/typescript");
const {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} = require("next/constants");

const appRoot = path.resolve(__dirname, "..");
const configPath = path.join(appRoot, "next.config.ts");
const tsconfigPath = path.join(appRoot, "tsconfig.json");
const gitignorePath = path.join(appRoot, ".gitignore");

function loadConfig(source = fs.readFileSync(configPath, "utf8")) {
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022},
    fileName: configPath,
  }).outputText;
  const loadedModule = new Module(configPath, module.parent);
  loadedModule.filename = configPath;
  loadedModule.paths = Module._nodeModulePaths(path.dirname(configPath));
  loadedModule._compile(compiled, configPath);
  return loadedModule.exports.default;
}

function assertIsolatedOutputs(config) {
  const development = config(PHASE_DEVELOPMENT_SERVER);
  const build = config(PHASE_PRODUCTION_BUILD);
  const production = config(PHASE_PRODUCTION_SERVER);

  assert.notEqual(development.distDir, build.distDir, "development and build must not share an output directory");
  assert.notEqual(development.distDir, production.distDir, "development and production start must not share an output directory");
  assert.equal(development.distDir, ".next-dev");
  assert.equal(build.distDir, ".next");
  assert.equal(production.distDir, ".next");
  assert.equal(path.dirname(path.resolve(appRoot, development.distDir)), appRoot);
  assert.equal(path.dirname(path.resolve(appRoot, build.distDir)), appRoot);
  assert.equal(path.dirname(path.resolve(appRoot, production.distDir)), appRoot);
  assert.equal(path.relative(path.resolve(appRoot, build.distDir), path.resolve(appRoot, development.distDir)).startsWith(`..${path.sep}`), true);
}

test("development and production use isolated Next output directories", () => {
  assertIsolatedOutputs(loadConfig());
});

test("type discovery and ignore rules cover both isolated artifacts", () => {
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
  const include = tsconfig.include;
  const gitignore = fs.readFileSync(gitignorePath, "utf8").split(/\r?\n/);

  assert.ok(include.includes(".next/types/**/*.ts"));
  assert.ok(include.includes(".next-dev/types/**/*.ts"));
  assert.ok(gitignore.includes("/.next-dev/"));
});

test("the contract rejects a shared output directory", () => {
  const source = fs.readFileSync(configPath, "utf8");
  const sharedOutput = loadConfig(source.replace('".next-dev"', '".next"'));

  assert.throws(() => assertIsolatedOutputs(sharedOutput), /must not share an output directory/);
});
