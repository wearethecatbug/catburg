import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selectedMode = process.argv[2];

if (!isKnownMode(selectedMode) || process.argv.length !== 3) {
  console.error("Usage: node ./scripts/test-unit.mjs <positive|failure-probe>");
  process.exitCode = 1;
} else {
  process.exitCode = await runSelectedTest(selectedMode);
}

async function runSelectedTest(mode) {
  const temporaryOutputDirectoryPrefix = path.join(os.tmpdir(), "safe-cat-unit-");
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

    const testResult = spawnSync(
      process.execPath,
      ["--test", ...selectedTestFiles],
      { cwd: appDirectory, stdio: "inherit" },
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

function isKnownMode(mode) {
  return mode === "positive" || mode === "failure-probe";
}

async function selectCompiledTestFiles(outputDirectory, mode) {
  const compiledFiles = await listFilesRecursively(outputDirectory);
  const selectedFiles = compiledFiles.filter((filePath) => {
    const filename = path.basename(filePath);
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
