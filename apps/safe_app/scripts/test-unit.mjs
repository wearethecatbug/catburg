import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testSources = {
  positive: "positive.test.ts",
  "failure-probe": "intentional-failure.probe.test.ts",
};
const selectedTest = testSources[process.argv[2]];

if (!selectedTest || process.argv.length !== 3) {
  console.error("Usage: node ./scripts/test-unit.mjs <positive|failure-probe>");
  process.exitCode = 1;
} else {
  process.exitCode = await runSelectedTest(selectedTest);
}

async function runSelectedTest(sourceFile) {
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

    const testResult = spawnSync(
      process.execPath,
      ["--test", path.join(temporaryOutputDirectory, sourceFile.replace(/\.ts$/, ".js"))],
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
