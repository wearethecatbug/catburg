const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
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

function validBuiltIn(id = "ct-js-01", overrides = {}) {
  const solution = "function exampleTask() { return null; }";
  return {
    id,
    slug: "example-task",
    title: "Example task",
    description: "A valid independent control.",
    hints: ["Start by naming the input and expected output.", "Keep the return value JSON-safe."],
    entryPoint: "exampleTask",
    starterCode: solution,
    solution,
    tests: [{args: [], expected: null}],
    solutions: [{
      id: "reference",
      label: "Reference solution",
      code: solution,
      timeComplexity: "O(1)",
      spaceComplexity: "O(1)",
      rationale: "The reference returns a constant value.",
    }],
    difficulty: "Easy",
    ...overrides,
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

function invokeCuratedReference(task, args) {
  const context = vm.createContext(Object.create(null));
  context.__args = structuredClone(args);
  new vm.Script(`"use strict";\n${task.solution}\nglobalThis.__result = ${task.entryPoint}(...globalThis.__args);`, {filename: `${task.id}.reference.js`})
    .runInContext(context, {timeout: 100});
  return JSON.parse(JSON.stringify({result: context.__result, args: context.__args}));
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

test("built-in catalogue metadata is strict while legacy scalar or omitted hints remain compatible", () => {
  const builtIn = validBuiltIn();
  const parsed = parseTaskCatalog({version: 1, tasks: [builtIn]}).tasks[0];
  assert.deepEqual(parsed.hints, builtIn.hints);
  assert.equal(parsed.solution, builtIn.solutions[0].code, "the legacy primary solution projects from the first ordered solution");

  const legacyScalar = parseTaskCatalog(validCatalog({hint: "Read the function signature first."})).tasks[0];
  assert.deepEqual(legacyScalar.hints, ["Read the function signature first."], "scalar hint is used only when plural hints is absent");
  assert.deepEqual(parseTaskCatalog(validCatalog({hints: []})).tasks[0].hints, [], "an explicit empty legacy hints list is not replaced by scalar fallback");

  for (const [label, overrides] of [
    ["missing plural hints", {hints: undefined}],
    ["one built-in hint", {hints: ["Only one meaningful hint."]}],
    ["blank hint", {hints: ["First meaningful hint.", "  "]}],
    ["malformed present hints", {hints: "not-an-array"}],
    ["missing solutions", {solutions: undefined}],
    ["malformed solution", {solutions: [{...builtIn.solutions[0], timeComplexity: "linear"}]}],
    ["unapproved complexity token", {solutions: [{...builtIn.solutions[0], spaceComplexity: "O(z)"}]}],
    ["invalid difficulty", {difficulty: "Unrated"}],
    ["invalid built-in entry point", {entryPoint: "not-valid"}],
    ["non-json expected value", {tests: [{args: [], expected: undefined}]}],
  ]) {
    const candidate = {...builtIn, ...overrides};
    if (Object.hasOwn(overrides, "hints") && overrides.hints === undefined) delete candidate.hints;
    if (Object.hasOwn(overrides, "solutions") && overrides.solutions === undefined) delete candidate.solutions;
    expectCatalogError(() => parseTaskCatalog({version: 1, tasks: [candidate]}), /catalog\.tasks\[0\]/);
  }

  const duplicateSlug = validBuiltIn("ct-js-02", {slug: builtIn.slug});
  expectCatalogError(() => parseTaskCatalog({version: 1, tasks: [builtIn, duplicateSlug]}), /duplicate slug/);
  const duplicateSolutionIds = validBuiltIn("ct-js-01", {solutions: [{...builtIn.solutions[0], id: "same"}, {...builtIn.solutions[0], id: "same"}]});
  expectCatalogError(() => parseTaskCatalog({version: 1, tasks: [duplicateSolutionIds]}), /duplicate solution id/i);
  const distinctSolutionIds = validBuiltIn("ct-js-01", {solutions: [{...builtIn.solutions[0], id: "first"}, {...builtIn.solutions[0], id: "second"}]});
  assert.doesNotThrow(() => parseTaskCatalog({version: 1, tasks: [distinctSolutionIds]}), "distinct ordered solution IDs remain valid");
  assert.doesNotThrow(() => parseTaskCatalog({version: 1, tasks: [validBuiltIn("ct-js-01"), validBuiltIn("ct-js-02", {slug: "second-task"})]}), "solution IDs are scoped to each task");
  assert.doesNotThrow(() => parseTaskCatalog({version: 1, tasks: [validBuiltIn("ct-js-01", {solutions: [{...builtIn.solutions[0], timeComplexity: "O(n * k log k)", spaceComplexity: "O(V + E); auxiliary space excludes output"}]})]}), "approved complexity grammar accepts declared variables, operators, log, and a plain-English qualifier");
  for (const invalidComplexity of ["O(nn)", "O(log)", "O(n +)", "O(n *** m)", "O(capacityjunk)"]) {
    expectCatalogError(() => parseTaskCatalog({version: 1, tasks: [validBuiltIn("ct-js-01", {solutions: [{...builtIn.solutions[0], timeComplexity: invalidComplexity}]})]}), /timeComplexity|notation|catalog\.tasks/);
  }
  expectCatalogError(() => parseTaskCatalog({version: 1, tasks: [validBuiltIn("ct-js-02")]}), /ordinal|ct-js-01|catalog\.tasks/);
  expectCatalogError(() => parseTaskCatalog({version: 1, tasks: [validBuiltIn("ct-js-01", {ordinal: 1})]}), /ordinal|catalog\.tasks/);
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

test("published catalogue is the complete ordered 50-task learning contract", async () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(publicRoot, "task-catalog.v1.json"), "utf8"));
  const parsed = parseTaskCatalog(catalog);

  assert.equal(parsed.tasks.length, 50);
  assert.deepEqual(parsed.tasks.map(task => task.id), Array.from({length: 50}, (_, index) => `ct-js-${String(index + 1).padStart(2, "0")}`));
  assert.equal(parsed.tasks.some(task => "ordinal" in task), false, "the parser returns definitions rather than persisting derived ordinals");
  await withFetch(async () => ({ok: true, json: async () => catalog}), async () => {
    const loaded = await loadBuiltinTaskCatalog();
    assert.deepEqual(loaded.map(task => task.ordinal), Array.from({length: 50}, (_, index) => index + 1), "the loader derives ordinals from canonical source order");
  });
  assert.equal(new Set(parsed.tasks.map(task => task.slug)).size, 50, "slugs are unique even where function signatures intentionally repeat");
  const easy = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15, 17, 19, 33, 34].map(value => `ct-js-${String(value).padStart(2, "0")}`));
  const hard = new Set(["ct-js-46", "ct-js-50"]);
  assert.deepEqual(parsed.tasks.map(task => [task.id, task.difficulty]), parsed.tasks.map(task => [task.id, easy.has(task.id) ? "Easy" : hard.has(task.id) ? "Hard" : "Medium"]), "every ID has the approved relative-learning difficulty, not merely a matching aggregate count");

  const expectedTitles = [
    "Reverse a String", "Check if a String Is a Palindrome", "Find the Maximum Number", "Remove Duplicates from an Array", "Count Character Frequencies",
    "Find the First Non-Repeating Character", "Two Sum", "Find a Missing Number", "Move Zeros to the End", "Find the Intersection of Two Arrays",
    "Check Whether Two Strings Are Anagrams", "Find the Most Frequent Element", "Chunk an Array", "Flatten a Nested Array", "Binary Search",
    "Find the First Occurrence Using Binary Search", "Merge Two Sorted Arrays", "Find Duplicates", "Find the Second Largest Unique Number", "Rotate an Array",
    "Valid Parentheses", "Implement a Stack", "Implement a Queue", "Fibonacci", "Sequences and factorial", "Removing adjacent pairs of characters",
    "Longest substring without repeating characters", "Maximum subarray sum", "Merging intervals while preserving the original array", "Minimum window length with a target sum",
    "Group Anagrams", "Product Except Self", "Longest Common Prefix", "Is Subsequence", "Linked List Cycle", "Reverse Linked List", "Tree Maximum Depth",
    "Level Order Traversal", "Validate BST", "Kth Largest Element", "Top K Frequent", "Search Rotated Array", "Daily Temperatures", "Decode Bracketed String",
    "Generate Parentheses", "Word Break", "Coin Change Minimum", "Course Schedule", "Number of Islands", "LRU Cache",
  ];
  assert.deepEqual(parsed.tasks.map(task => task.title), expectedTitles, "the source and additional-task mapping is complete and ordered");

  const hintCounts = new Set();
  for (const task of parsed.tasks) {
    assert.ok(task.tests.length > 0, `${task.id} has at least one typed test`);
    assert.ok(task.hints.length >= 2 && task.hints.every(hint => /[A-Za-z]/.test(hint) && hint.trim() === hint), `${task.id} has meaningful normalized English hints`);
    hintCounts.add(task.hints.length);
    assert.equal(task.solution, task.solutions[0].code, `${task.id} preserves the first solution as the legacy primary solution`);
    for (const solution of task.solutions) {
      assert.match(solution.timeComplexity, /^O\(.+\)(?:;\s+\S.+)?$/, `${task.id}/${solution.id} has approved time notation`);
      assert.match(solution.spaceComplexity, /^O\(.+\)(?:;\s+\S.+)?$/, `${task.id}/${solution.id} has approved space notation`);
      assert.match(solution.rationale, /\S/, `${task.id}/${solution.id} explains its declared bounds`);
    }
    assert.doesNotThrow(() => new Function(task.starterCode), `${task.id} starter code has valid syntax without execution`);
    assert.doesNotThrow(() => new Function(task.solution), `${task.id} reference code has valid syntax without execution`);
  }
  assert.ok(hintCounts.size > 1, "hint counts vary with educational need rather than being padded to a shared count");
  assert.deepEqual(parsed.tasks.slice(30).map(task => task.entryPoint), ["groupAnagrams", "productExceptSelf", "longestCommonPrefix", "isSubsequence", "hasCycle", "reverseList", "maxDepth", "levelOrder", "isValidBST", "kthLargest", "topKFrequent", "searchRotated", "daysUntilWarmer", "decodeString", "generateParentheses", "canSegment", "minCoins", "canFinish", "countIslands", "lruTranscript"]);
});

test("curated references meet the independent normal, edge, sentinel, ordering, and non-mutation examples", () => {
  const catalogue = JSON.parse(fs.readFileSync(path.join(publicRoot, "task-catalog.v1.json"), "utf8"));
  const byId = new Map(catalogue.tasks.map(task => [task.id, task]));
  const cases = [
    ["ct-js-01", ["cat"], "tac"], ["ct-js-02", ["level"], true], ["ct-js-03", [[-4, 9, 2]], 9], ["ct-js-03", [[]], null],
    ["ct-js-04", [[1, 2, 1, 3]], [1, 2, 3]], ["ct-js-05", ["aab"], {a: 2, b: 1}], ["ct-js-06", ["aabbcdde"], "c"],
    ["ct-js-07", [[2, 7, 11, 15], 9], [0, 1]], ["ct-js-08", [[3, 0, 1]], 2], ["ct-js-09", [[0, 1, 0, 3, 12]], [1, 3, 12, 0, 0]],
    ["ct-js-10", [[1, 2, 2, 1], [2, 2]], [2]], ["ct-js-11", ["listen", "silent"], true], ["ct-js-12", [[1, 3, 2, 3, 2, 3]], 3],
    ["ct-js-13", [[1, 2, 3, 4, 5], 2], [[1, 2], [3, 4], [5]]], ["ct-js-14", [[1, [2, [3]], 4]], [1, 2, 3, 4]], ["ct-js-15", [[1, 3, 5, 7], 5], 2],
    ["ct-js-16", [[1, 2, 2, 2, 3], 2], 1], ["ct-js-17", [[1, 3, 5], [2, 4, 6]], [1, 2, 3, 4, 5, 6]], ["ct-js-18", [[1, 2, 2, 3, 3, 3]], [2, 3]],
    ["ct-js-19", [[4, 4, 3, 2]], 3], ["ct-js-19", [[4, 4]], null], ["ct-js-20", [[1, 2, 3, 4, 5], 2], [4, 5, 1, 2, 3]],
    ["ct-js-21", ["([{}])"], true], ["ct-js-22", [[["push", 1], ["peek"], ["pop"], ["pop"], ["isEmpty"]]], [null, 1, 1, null, true]],
    ["ct-js-23", [[["enqueue", 1], ["enqueue", 2], ["dequeue"], ["peek"], ["size"]]], [null, null, 1, 2, 1]], ["ct-js-24", [7], 13],
    ["ct-js-25", [5], 120], ["ct-js-26", ["abbaca"], "ca"], ["ct-js-27", ["abcabcbb"], 3], ["ct-js-28", [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], 6],
    ["ct-js-29", [[[1, 3], [2, 6], [8, 10]]], [[1, 6], [8, 10]]], ["ct-js-30", [[2, 3, 1, 2, 4, 3], 7], 2],
    ["ct-js-31", [["eat", "tea", "tan", "ate", "nat", "bat"]], [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]]], ["ct-js-32", [[1, 2, 3, 4]], [24, 12, 8, 6]],
    ["ct-js-33", [["flower", "flow", "flight"]], "fl"], ["ct-js-34", ["ace", "abcde"], true], ["ct-js-35", [[{value: 1, next: 1}, {value: 2, next: 0}], 0], true],
    ["ct-js-36", [[{value: 1, next: 1}, {value: 2, next: null}], 0], {nodes: [{value: 1, next: null}, {value: 2, next: 0}], head: 1}],
    ["ct-js-37", [[3, 9, 20, null, null, 15, 7]], 3], ["ct-js-38", [[3, 9, 20, null, null, 15, 7]], [[3], [9, 20], [15, 7]]],
    ["ct-js-39", [[2, 1, 3]], true], ["ct-js-40", [[3, 2, 1, 5, 6, 4], 2], 5], ["ct-js-41", [[1, 1, 2, 2, 3], 2], [1, 2]],
    ["ct-js-42", [[4, 5, 6, 7, 0, 1, 2], 0], 4], ["ct-js-43", [[73, 74, 75, 71, 69, 72, 76, 73]], [1, 1, 4, 2, 1, 1, 0, 0]],
    ["ct-js-44", ["3[a2[c]]"], "accaccacc"], ["ct-js-44", ["0[a]"], ""], ["ct-js-44", ["2[a"], null], ["ct-js-45", [2], ["(())", "()()"]],
    ["ct-js-46", ["leetcode", ["leet", "code"]], true], ["ct-js-47", [[1, 2, 5], 11], 3], ["ct-js-48", [2, [[1, 0], [0, 1]]], false],
    ["ct-js-49", [["11000", "11000", "00100", "00011"]], 3], ["ct-js-50", [2, [["put", 1, 1], ["put", 2, 2], ["get", 1], ["put", 3, 3], ["get", 2]]], [null, null, 1, null, -1]],
  ];
  for (const [id, args, expected] of cases) {
    const task = byId.get(id);
    assert.ok(task, `${id} must have a curated reference fixture`);
    assert.deepEqual(invokeCuratedReference(task, args).result, expected, `${id} reference result matches its independent fixture`);
  }

  for (const [id, args] of [["ct-js-29", [[[1, 3], [2, 6], [8, 10]]]], ["ct-js-36", [[{value: 1, next: 1}, {value: 2, next: null}], 0]], ["ct-js-49", [["110", "010"]]]]) {
    const task = byId.get(id);
    const before = structuredClone(args);
    const observed = invokeCuratedReference(task, args);
    assert.deepEqual(observed.args, before, `${id} must not mutate its JSON transport input inside the isolated reference invocation`);
  }
  assert.equal(invokeCuratedReference(byId.get("ct-js-48"), [2, [[0, 0]]]).result, false, "self-cycle graph input is rejected");
});

test("Task 01 reverses UTF-16 code units rather than code points", () => {
  const catalogue = JSON.parse(fs.readFileSync(path.join(publicRoot, "task-catalog.v1.json"), "utf8"));
  const task = catalogue.tasks.find(candidate => candidate.id === "ct-js-01");
  assert.ok(task, "Task 01 must remain present in the published catalogue");

  // The published contract deliberately reverses UTF-16 code units, separating this surrogate pair.
  const input = "A\uD83D\uDE00B";
  const observed = invokeCuratedReference(task, [input]);
  assert.notEqual(observed.result, "B\u{1F600}A", "Task 01 must reject code-point reversal");
  assert.equal(observed.result, "B\uDE00\uD83DA", "Task 01 reverses each UTF-16 code unit in order");
  assert.deepEqual(observed.args, [input], "Task 01 must not mutate its JSON transport input");
});

test("every published JSON test tuple agrees with every ordered reference solution", () => {
  const catalogue = JSON.parse(fs.readFileSync(path.join(publicRoot, "task-catalog.v1.json"), "utf8"));
  for (const task of catalogue.tasks) {
    for (const solution of task.solutions) {
      const referenceTask = {...task, solution: solution.code};
      for (const [index, testCase] of task.tests.entries()) {
        assert.deepEqual(invokeCuratedReference(referenceTask, testCase.args).result, testCase.expected, `${task.id}/${solution.id} agrees with declared JSON test ${index + 1}`);
      }
    }
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
