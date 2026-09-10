import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import operatingSystem from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selectedMode = process.argv[2];

if (!isKnownMode(selectedMode) || process.argv.length !== 3) {
  console.error("Usage: node ./scripts/test-unit.mjs <positive|failure-probe|empty-selection-probe>");
  process.exitCode = 1;
} else {
  process.exitCode = await runSelectedTest(selectedMode);
}

async function runSelectedTest(mode) {
  const temporaryOutputDirectoryPrefix = path.join(operatingSystem.tmpdir(), "safe-cat-unit-");
  let temporaryOutputDirectory;
  let exitCode = 1;

  try {
    temporaryOutputDirectory = await mkdtemp(temporaryOutputDirectoryPrefix);
    const compilerResult = spawnSync(
      process.execPath,
      [
        path.join(appDirectory, "node_modules", "typescript", "bin", "tsc"),
        "--project",
        path.join(appDirectory, "tsconfig.tests.json"),
        "--outDir",
        temporaryOutputDirectory,
      ],
      { cwd: appDirectory, stdio: "inherit" },
    );

    if (compilerResult.status !== 0) {
      return compilerResult.status ?? 1;
    }

    const selectedTestFiles = await selectCompiledTestFiles(temporaryOutputDirectory, mode);
    if (selectedTestFiles.length === 0) {
      console.error(`No compiled ${mode} tests were selected.`);
      return 1;
    }

    const aliasResolverPath = await createAliasResolver(temporaryOutputDirectory);
    const testResult = spawnSync(
      process.execPath,
      ["--require", aliasResolverPath, "--test", ...selectedTestFiles],
      { cwd: appDirectory, env: createTestEnvironment(), stdio: "inherit" },
    );
    exitCode = testResult.status ?? 1;
  } finally {
    if (temporaryOutputDirectory) {
      await rm(temporaryOutputDirectory, { recursive: true, force: true });
      if (existsSync(temporaryOutputDirectory)) {
        throw new Error(`Temporary test output was not removed: ${temporaryOutputDirectory}`);
      }
      console.log(`Temporary test output removed: ${temporaryOutputDirectory}`);
    }
  }

  return exitCode;
}

async function createAliasResolver(outputDirectory) {
  const resolverPath = path.join(outputDirectory, "alias-resolver.cjs");
  const aliases = [["@/", path.join(outputDirectory, "src")]];
  const resolverSource = [
    'const moduleLoader = require("node:module");',
    'const path = require("node:path");',
    `const aliases = ${JSON.stringify(aliases)};`,
    "const originalResolveFilename = moduleLoader._resolveFilename;",
    "moduleLoader._resolveFilename = function resolveConfiguredAlias(request, parent, isMain, options) {",
    "  for (const [prefix, targetDirectory] of aliases) {",
    "    if (request.startsWith(prefix)) {",
    "      return originalResolveFilename.call(this, path.join(targetDirectory, request.slice(prefix.length)), parent, isMain, options);",
    "    }",
    "  }",
    "  return originalResolveFilename.call(this, request, parent, isMain, options);",
    "};",
    "",
  ].join("\n");
  await writeFile(resolverPath, resolverSource, { encoding: "utf8", flag: "wx" });
  return resolverPath;
}

function createTestEnvironment() {
  const appNodeModulesDirectory = path.join(appDirectory, "node_modules");
  const existingNodePath = process.env.NODE_PATH;
  return {
    ...process.env,
    NODE_PATH: [appNodeModulesDirectory, existingNodePath].filter(Boolean).join(path.delimiter),
  };
}

function isKnownMode(mode) {
  return mode === "positive" || mode === "failure-probe" || mode === "empty-selection-probe";
}

async function selectCompiledTestFiles(outputDirectory, mode) {
  const compiledFiles = await listFilesRecursively(outputDirectory);
  const selectedFiles = compiledFiles.filter((filePath) => {
    const filename = path.basename(filePath);
    if (mode === "empty-selection-probe") return false;
    if (mode === "positive") {
      return filename.endsWith(".test.js") && !filename.endsWith(".probe.test.js");
    }
    return filename === "intentional-failure.probe.test.js";
  });
  return selectedFiles.sort();
}

async function listFilesRecursively(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursively(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}
