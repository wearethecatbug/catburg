const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {loadTypeScript} = require("./helpers/load-typescript.cjs");

const appRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(appRoot, "public");
const catalogModulePath = path.join(appRoot, "src", "app", "_components", "tasks", "catalog", "taskCatalog.ts");
const {CatalogValidationError, loadBuiltinTaskCatalog, parseTaskCatalog} = loadTypeScript(catalogModulePath);

function validCatalog(overrides = {}) {
  return {
    version: 1,
    tasks: [{
      id: "example-task",
      title: "Example task",
      description: "A valid independent control.",
      entryPoint: "exampleTask",
      starterCode: "function exampleTask() { return null; }",
      solution: "function exampleTask() { return null; }",
      tests: [{args: [], expected: null}],
      ...overrides,
    }],
  };
}

function expectCatalogError(action, message) {
  assert.throws(action, error => error instanceof CatalogValidationError && message.test(error.message));
}

async function withFetch(fetchImplementation, action) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImplementation;
  try {
    await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function fileHash(name) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(publicRoot, name))).digest("hex").toUpperCase();
}

function sourceLines(name) {
  const source = fs.readFileSync(path.join(publicRoot, name), "utf8");
  return source.split(/\r\n|\n|\r/);
}

function parseLocator(locator, source, lineCount) {
  const match = /^L([1-9]\d*)-L([1-9]\d*)$/.exec(locator);
  assert.ok(match, `${source} locator must use L<start>-L<end>`);
  const start = Number(match[1]);
  const end = Number(match[2]);
  assert.ok(start <= end, `${source} locator start must not exceed its end`);
  assert.ok(end <= lineCount, `${source} locator must stay within raw source line bounds`);
  return {start, end};
}

test("catalog parser preserves JSON transport values, including zero-argument cases", () => {
  const values = ["quoted text", true, false, null, [0, {nested: ["value", null]}], {deep: {zero: 0}}];
  const parsed = parseTaskCatalog(validCatalog({tests: [{args: [], expected: null}, {args: values, expected: {ok: true, values}}]}));

  assert.deepEqual(parsed.tasks[0].tests, [{args: [], expected: null}, {args: values, expected: {ok: true, values}}]);
});

test("catalog parser rejects malformed fields, duplicate IDs, and non-JSON values while retaining a valid control", () => {
  assert.equal(parseTaskCatalog(validCatalog()).tasks.length, 1);
  expectCatalogError(() => parseTaskCatalog(validCatalog({title: "  "})), /catalog\.tasks\[0\]\.title: must be a non-empty string/);
  expectCatalogError(() => parseTaskCatalog(validCatalog({entryPoint: "not-valid"})), /catalog\.tasks\[0\]\.entryPoint/);
  expectCatalogError(() => parseTaskCatalog(validCatalog({entryPoint: "default"})), /catalog\.tasks\[0\]\.entryPoint/);
  expectCatalogError(() => parseTaskCatalog(validCatalog({entryPoint: "let"})), /catalog\.tasks\[0\]\.entryPoint/);
  expectCatalogError(() => parseTaskCatalog(validCatalog({tests: [{args: "not-array", expected: null}]})), /args: must be an array/);
  expectCatalogError(() => parseTaskCatalog(validCatalog({tests: [{args: [Number.NaN], expected: null}]})), /args: must contain JSON values only/);
  expectCatalogError(() => parseTaskCatalog(validCatalog({tests: [{args: [], expected: undefined}]})), /expected: must be a JSON value/);
  expectCatalogError(() => parseTaskCatalog(validCatalog({tests: [{args: [() => null], expected: null}]})), /args: must contain JSON values only/);
  const duplicate = validCatalog();
  duplicate.tasks.push({...duplicate.tasks[0]});
  expectCatalogError(() => parseTaskCatalog(duplicate), /duplicate id 'example-task'/);
});

test("built-in loader requests the canonical asset, derives ordinals, and rejects HTTP, JSON, and schema failures", async () => {
  let request;
  const controller = new AbortController();
  await withFetch(async (url, options) => {
    request = {url, options};
    return {ok: true, json: async () => validCatalog()};
  }, async () => {
    const tasks = await loadBuiltinTaskCatalog(controller.signal);
    assert.equal(tasks[0].ordinal, 1);
    assert.equal("ordinal" in validCatalog().tasks[0], false, "ordinal is derived rather than persisted");
  });
  assert.equal(request.url, "/task-catalog.v1.json");
  assert.equal(request.options.signal, controller.signal);

  await withFetch(async () => ({ok: false, status: 503, json: async () => { throw new Error("must not parse HTTP failure"); }}), async () => {
    await assert.rejects(loadBuiltinTaskCatalog(), error => error instanceof CatalogValidationError && /HTTP 503/.test(error.message));
  });
  await withFetch(async () => ({ok: true, json: async () => { throw new SyntaxError("bad JSON"); }}), async () => {
    await assert.rejects(loadBuiltinTaskCatalog(), error => error instanceof CatalogValidationError && /not valid JSON/.test(error.message));
  });
  await withFetch(async () => ({ok: true, json: async () => ({version: 2, tasks: []})}), async () => {
    await assert.rejects(loadBuiltinTaskCatalog(), error => error instanceof CatalogValidationError && /catalog\.version/.test(error.message));
  });
});

test("published catalog is exactly the curated, syntactically valid three-task contract", () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(publicRoot, "task-catalog.v1.json"), "utf8"));
  const parsed = parseTaskCatalog(catalog);

  assert.equal(parsed.tasks.length, 3);
  assert.deepEqual(parsed.tasks.map(task => task.entryPoint), ["race", "digitize", "noSpace"]);
  assert.deepEqual(parsed.tasks.map(task => task.id), ["race", "digitize", "no-space"]);
  for (const task of parsed.tasks) {
    assert.ok(task.tests.length > 0, `${task.id} has at least one typed test`);
    assert.doesNotThrow(() => new Function(task.starterCode), `${task.id} starter code has valid syntax without execution`);
    assert.doesNotThrow(() => new Function(task.solution), `${task.id} reference code has valid syntax without execution`);
  }
});

test("published provenance has one exact correction ledger per curated record and immutable raw corpora match the accepted hashes", () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(publicRoot, "task-catalog.provenance.v1.json"), "utf8"));
  assert.equal(provenance.catalog, "task-catalog.v1.json");
  assert.deepEqual(provenance.records.map(record => [record.id, record.source, record.locator]), [
    ["race", "tasks.txt", "L1-L45"],
    ["digitize", "tasks.txt", "L48-L74"],
    ["no-space", "tasks.txt", "L76-L96"],
  ]);
  for (const record of provenance.records) {
    assert.ok(Array.isArray(record.corrections) && record.corrections.length > 0, `${record.id} has an explicit correction ledger`);
    for (const correction of record.corrections) {
      assert.equal(typeof correction.sourceLocator, "string");
      assert.equal(typeof correction.original, "string");
      assert.equal(typeof correction.replacement, "string");
      assert.equal(typeof correction.reason, "string");
    }
  }
  assert.equal(fileHash("tasks.txt"), "E7C6CFE712F004DDDE55A0D7F01B1A189454C40F6DBB4816E46CF7F162A51270");
  assert.equal(fileHash("tasks2"), "C71E60B7C719D3259F11EF593A2D7CC3FB88728044457FA11C8325E3A90DA0A4");
  assert.equal(fileHash("сodeWarsTasks.txt"), "0289BB53579FD352B19E84A50F8853594461A4AF1F31DCD4D9765E332C7B4B57");
});

test("migration report accounts for every immutable corpus with a hash and nonempty record-boundary ledger", () => {
  const report = JSON.parse(fs.readFileSync(path.join(publicRoot, "task-catalog.migration-report.v1.json"), "utf8"));
  const expectedSources = new Map([
    ["tasks.txt", "E7C6CFE712F004DDDE55A0D7F01B1A189454C40F6DBB4816E46CF7F162A51270"],
    ["tasks2", "C71E60B7C719D3259F11EF593A2D7CC3FB88728044457FA11C8325E3A90DA0A4"],
    ["сodeWarsTasks.txt", "0289BB53579FD352B19E84A50F8853594461A4AF1F31DCD4D9765E332C7B4B57"],
  ]);

  assert.equal(report.version, 1);
  assert.ok(Array.isArray(report.sources));
  assert.equal(report.sources.length, expectedSources.size, "every source is accounted for exactly once");
  assert.deepEqual([...report.sources.map(source => source.source)].sort(), [...expectedSources.keys()].sort(), "source membership is exact and has no duplicates");
  for (const source of report.sources) {
    assert.equal(source.sha256, expectedSources.get(source.source), `${source.source} has the accepted immutable SHA-256`);
    assert.ok(Array.isArray(source.records) && source.records.length > 0, `${source.source} has a nonempty boundary ledger`);
    const lines = sourceLines(source.source);
    assert.equal(source.lineCount, lines.length, `${source.source} reports its exact raw line count`);
    const coveredLines = new Set();
    for (const record of source.records) {
      assert.equal(typeof record.locator, "string");
      const {start, end} = parseLocator(record.locator, source.source, lines.length);
      for (let line = start; line <= end; line += 1) coveredLines.add(line);
      assert.equal(typeof record.status, "string");
      assert.ok(record.status.trim().length > 0, `${source.source} records an import status`);
      assert.ok(Array.isArray(record.issues), `${source.source} records an issue list even when empty`);
    }
    for (let line = 1; line <= lines.length; line += 1) {
      if (lines[line - 1].trim() !== "") assert.equal(coveredLines.has(line), true, `${source.source} line ${line} must not be silently dropped`);
    }
  }
});
