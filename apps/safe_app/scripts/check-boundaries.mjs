import { readdir, readFile } from "node:fs/promises";
import pathUtilities from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import typeScriptCompiler from "typescript";

const appDirectory = pathUtilities.resolve(pathUtilities.dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv.length === 3 && process.argv[2] === "--self-test") {
  await runSelfTest();
} else if (process.argv.length === 2) {
  report(await analyzeProject(await readProject()));
} else {
  console.error("Usage: node ./scripts/check-boundaries.mjs [--self-test]");
  process.exitCode = 1;
}

function report(errors) {
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log("Boundary checks passed.");
}

async function readProject() {
  const sourceRoot = pathUtilities.join(appDirectory, "src");
  const publicRoot = pathUtilities.join(appDirectory, "public");
  const files = new Map();
  for (const filePath of await listFiles(sourceRoot)) files.set(toProjectPath(filePath), await readFile(filePath, "utf8"));
  const assets = new Set((await listFiles(publicRoot)).map((filePath) => pathUtilities.relative(publicRoot, filePath).replace(/\\/g, "/")));
  return { files, assets };
}

// Real files and isolated negative fixtures share the same resolution and diagnostic path.
function analyzeProject(project) {
  const errors = [];
  const graph = new Map();
  const caseIndex = new Map([...project.files.keys()].map((name) => [name.toLowerCase(), name]));
  const cssKeys = new Map([...project.files].filter(([name]) => name.endsWith(".css")).map(([name, text]) => [name, parseCssKeys(text)]));
  for (const [fileName, text] of project.files) {
    if (!/\.(ts|tsx)$/.test(fileName)) continue;
    const sourceFile = typeScriptCompiler.createSourceFile(fileName, text, typeScriptCompiler.ScriptTarget.Latest, true);
    const edges = [];
    const cssBindings = new Map();
    for (const entry of collectModuleReferences(sourceFile)) {
      if (fileName.includes("/features/safe-game/domain/") && !entry.specifier.startsWith(".") && !entry.specifier.startsWith("@/")) {
        errors.push(`${fileName}: forbidden external domain import ${entry.specifier}`);
      }
      const resolved = resolveModule(fileName, entry.specifier, project.files, caseIndex);
      if (resolved.error) errors.push(`${fileName}: ${resolved.error} ${entry.specifier}`);
      if (resolved.path) {
        edges.push(resolved.path);
        if (entry.isCss && entry.binding) cssBindings.set(entry.binding, resolved.path);
        if (violatesOwner(fileName, resolved.path)) errors.push(`${fileName}: forbidden layer import ${entry.specifier}`);
      }
    }
    for (const [binding, key] of collectCssAccesses(sourceFile)) {
      if (!cssBindings.has(binding)) continue;
      const cssFile = cssBindings.get(binding);
      if (!cssFile || !cssKeys.get(cssFile)?.has(key)) errors.push(`${fileName}: missing CSS module key ${binding}.${key}`);
    }
    for (const asset of collectAssetReferences(sourceFile, text)) {
      if (!project.assets.has(asset)) errors.push(`${fileName}: missing or mis-cased asset /${asset}`);
    }
    graph.set(fileName, edges);
  }
  for (const [fileName, cssText] of project.files) {
    if (!fileName.endsWith(".css")) continue;
    for (const asset of cssText.matchAll(/url\(\s*["']?\/([^"')\s]+)["']?\s*\)/g)) if (!project.assets.has(asset[1])) errors.push(`${fileName}: missing or mis-cased asset /${asset[1]}`);
  }
  errors.push(...findCycles(graph));
  return errors;
}

function collectModuleReferences(sourceFile) {
  const references = [];
  function visit(node) {
    const specifier = typeScriptCompiler.isImportDeclaration(node) || typeScriptCompiler.isExportDeclaration(node) ? node.moduleSpecifier : typeScriptCompiler.isCallExpression(node) && node.expression.kind === typeScriptCompiler.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
    if (specifier && typeScriptCompiler.isStringLiteral(specifier)) {
      const clause = typeScriptCompiler.isImportDeclaration(node) ? node.importClause : undefined;
      references.push({ specifier: specifier.text, isCss: specifier.text.endsWith(".module.css"), binding: clause?.name?.text ?? clause?.namedBindings?.name?.text });
    }
    typeScriptCompiler.forEachChild(node, visit);
  }
  visit(sourceFile);
  return references;
}

function collectCssAccesses(sourceFile) {
  const accesses = [];
  function visit(node) {
    if (typeScriptCompiler.isPropertyAccessExpression(node) && typeScriptCompiler.isIdentifier(node.expression)) accesses.push([node.expression.text, node.name.text]);
    if (typeScriptCompiler.isElementAccessExpression(node) && typeScriptCompiler.isIdentifier(node.expression) && node.argumentExpression && typeScriptCompiler.isStringLiteral(node.argumentExpression)) accesses.push([node.expression.text, node.argumentExpression.text]);
    typeScriptCompiler.forEachChild(node, visit);
  }
  visit(sourceFile);
  return accesses;
}

function collectAssetReferences(sourceFile, sourceText) {
  const assets = [];
  function visit(node) {
    if ((typeScriptCompiler.isStringLiteral(node) || typeScriptCompiler.isNoSubstitutionTemplateLiteral(node)) && /^\/.*\.(png|jpe?g|gif|svg|webp|avif)$/i.test(node.text)) assets.push(node.text.slice(1));
    typeScriptCompiler.forEachChild(node, visit);
  }
  visit(sourceFile);
  for (const match of sourceText.matchAll(/url\(\s*["']?\/([^"')\s]+)["']?\s*\)/g)) if (!match[1].includes("${")) assets.push(match[1]);
  return assets;
}

function resolveModule(from, specifier, files, caseIndex) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return {};
  const base = specifier.startsWith("@/") ? `src/${specifier.slice(2)}` : pathUtilities.posix.normalize(pathUtilities.posix.join(pathUtilities.posix.dirname(from), specifier));
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.css`, pathUtilities.posix.join(base, "index.ts")];
  for (const candidate of candidates) if (files.has(candidate)) return { path: candidate };
  for (const candidate of candidates) if (caseIndex.has(candidate.toLowerCase())) return { error: "mis-cased local module", path: caseIndex.get(candidate.toLowerCase()) };
  return { error: "missing local module" };
}

function violatesOwner(from, target) {
  const domain = from.includes("/features/safe-game/domain/");
  const model = from.includes("/features/safe-game/model/");
  const live = !from.includes("/legacy/");
  return (domain && !target.includes("/features/safe-game/domain/")) ||
    (model && !target.includes("/features/safe-game/domain/") && !target.includes("/features/safe-game/model/")) ||
    (live && target.includes("/legacy/"));
}

// Inspect literal class tokens in parsed rules; dynamic CSS access still needs runtime checks.
function parseCssKeys(text) {
  const keys = new Set();
  postcss.parse(text).walkRules((rule) => { for (const match of rule.selector.matchAll(/\.([A-Za-z_][\w-]*)/g)) keys.add(match[1]); });
  return keys;
}

function findCycles(graph) {
  const errors = [];
  const visiting = new Set();
  const visited = new Set();
  function visit(node, chain) {
    if (visiting.has(node)) { errors.push(`circular local import: ${[...chain, node].join(" -> ")}`); return; }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) visit(next, [...chain, node]);
    visiting.delete(node); visited.add(node);
  }
  for (const node of graph.keys()) visit(node, []);
  return errors;
}

async function runSelfTest() {
  const valid = fixture({ "src/features/safe-game/domain/a.ts": "export const a = 1;", "src/presentation/view.tsx": 'import styles from "./view.module.css"; export const view = styles.ok;', "src/presentation/view.module.css": ".ok {}" }, []);
  if (analyzeProject(valid).length) throw new Error("Valid boundary fixture failed.");
  const cases = [
    [fixture({ "src/features/safe-game/domain/a.ts": 'import "react";' }, []), "forbidden external domain import"],
    [fixture({ "src/features/safe-game/domain/a.ts": 'import "../model/b";', "src/features/safe-game/model/b.ts": "export {};" }, []), "forbidden layer import"],
    [fixture({ "src/features/safe-game/model/a.ts": 'import "@/app/page";', "src/app/page.ts": "export {};" }, []), "forbidden layer import"],
    [fixture({ "src/app/page.ts": 'import "@/legacy/prototype";', "src/legacy/prototype.ts": "export {};" }, []), "forbidden layer import"],
    [fixture({ "src/a.ts": 'import "./b";', "src/b.ts": 'export * from "./a";' }, []), "circular local import"],
    [fixture({ "src/a.ts": 'import "./case";', "src/Case.ts": "export {};" }, []), "mis-cased local module"],
    [fixture({ "src/p.tsx": 'import styles from "./p.module.css"; export const p = styles["missing"];', "src/p.module.css": ".missingSuffix {}" }, []), "missing CSS module key"],
    [fixture({ "src/p.tsx": 'export const image = { asset: "/Image.png" };' }, ["image.png"]), "missing or mis-cased asset"],
    [fixture({ "src/p.css": 'body { background: url("/Image.png"); }' }, ["image.png"]), "missing or mis-cased asset"],
  ];
  for (const [project, expected] of cases) if (!analyzeProject(project).some((error) => error.includes(expected))) throw new Error(`Negative control did not report ${expected}.`);
  console.log("Boundary negative controls passed.");
}

function fixture(fileObject, assets) { return { files: new Map(Object.entries(fileObject)), assets: new Set(assets) }; }
async function listFiles(directory) { const entries = await readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map(async (entry) => { const entryPath = pathUtilities.join(directory, entry.name); return entry.isDirectory() ? listFiles(entryPath) : [entryPath]; }))).flat(); }
function toProjectPath(filePath) { return pathUtilities.relative(appDirectory, filePath).replace(/\\/g, "/"); }
