const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const {loadTypeScript} = require("./helpers/load-typescript.cjs");

const appRoot = path.join(__dirname, "..", "src", "app", "_components", "tasks");
const catalogue = loadTypeScript(path.join(appRoot, "catalog", "taskCatalogueRows.ts"));
const workspace = loadTypeScript(path.join(appRoot, "context", "taskWorkspaceState.ts"));

const tasks = [
  {id: "race", title: "Race", description: "Numbers task", starterCode: "race"},
  {id: "digitize", title: "Digitize", description: "Arrays task", starterCode: "digitize"},
  {id: "no-space", title: "No space", description: "Strings task", starterCode: "no-space"},
  {id: "missing", title: "Missing", description: "No topic", starterCode: "missing"},
];

const result = (status, passedCount, totalTests) => ({requestId: `${status}-${passedCount}-${totalTests}`, status, message: status, logs: [], passedCount, totalTests});

function rows(state) {
  return catalogue.getTaskCatalogueRows(tasks, state);
}

function status(state, id) {
  return rows(state).find(row => row.id === id)?.status;
}

function start(state, id, mode) {
  const started = workspace.beginTaskRun(state, id, tasks.find(task => task.id === id).starterCode, mode);
  assert.ok(started, `${id} must be selected before its ${mode}`);
  return started;
}

test("catalogue projects the curated built-in topic map and leaves legacy metadata uncategorized", () => {
  assert.deepEqual(catalogue.TASK_TOPICS, ["Arrays", "Strings", "Numbers", "Logic"]);
  const expectedBuiltInTopics = new Map([
    ["ct-js-01", "Strings"], ["ct-js-02", "Strings"], ["ct-js-03", "Numbers"], ["ct-js-04", "Arrays"], ["ct-js-05", "Strings"],
    ["ct-js-06", "Strings"], ["ct-js-07", "Arrays"], ["ct-js-08", "Numbers"], ["ct-js-09", "Arrays"], ["ct-js-10", "Arrays"],
    ["ct-js-11", "Strings"], ["ct-js-12", "Arrays"], ["ct-js-13", "Arrays"], ["ct-js-14", "Arrays"], ["ct-js-15", "Arrays"],
    ["ct-js-16", "Arrays"], ["ct-js-17", "Arrays"], ["ct-js-18", "Arrays"], ["ct-js-19", "Numbers"], ["ct-js-20", "Arrays"],
    ["ct-js-21", "Strings"], ["ct-js-22", "Logic"], ["ct-js-23", "Logic"], ["ct-js-24", "Numbers"], ["ct-js-25", "Numbers"],
    ["ct-js-26", "Strings"], ["ct-js-27", "Strings"], ["ct-js-28", "Arrays"], ["ct-js-29", "Arrays"], ["ct-js-30", "Arrays"],
    ["ct-js-31", "Strings"], ["ct-js-32", "Arrays"], ["ct-js-33", "Strings"], ["ct-js-34", "Strings"], ["ct-js-35", "Logic"],
    ["ct-js-36", "Logic"], ["ct-js-37", "Logic"], ["ct-js-38", "Logic"], ["ct-js-39", "Logic"], ["ct-js-40", "Arrays"],
    ["ct-js-41", "Arrays"], ["ct-js-42", "Arrays"], ["ct-js-43", "Arrays"], ["ct-js-44", "Strings"], ["ct-js-45", "Logic"],
    ["ct-js-46", "Strings"], ["ct-js-47", "Logic"], ["ct-js-48", "Logic"], ["ct-js-49", "Logic"], ["ct-js-50", "Logic"],
  ]);
  assert.deepEqual([...expectedBuiltInTopics], Array.from({length: 50}, (_, index) => {
    const id = `ct-js-${String(index + 1).padStart(2, "0")}`;
    return [id, catalogue.getBuiltInTaskTopic(id)];
  }), "every curated built-in ID has its independently specified topic");
  assert.equal(catalogue.getBuiltInTaskTopic("race"), "Numbers");
  assert.equal(catalogue.getBuiltInTaskTopic("digitize"), "Arrays");
  assert.equal(catalogue.getBuiltInTaskTopic("no-space"), "Strings");
  assert.equal(catalogue.getBuiltInTaskTopic("missing"), "Uncategorized");
  assert.equal(catalogue.getBuiltInTaskTopic("constructor"), "Uncategorized", "inherited-looking IDs are not metadata");
  assert.equal(catalogue.getBuiltInTaskTopic("__proto__"), "Uncategorized", "prototype-looking IDs are not metadata");
  assert.equal(catalogue.getBuiltInTaskTopic("toString"), "Uncategorized", "inherited names are not metadata");

  const projected = rows(workspace.createTaskWorkspaceState());
  assert.deepEqual(projected.map(row => [row.id, row.topic, row.status, row.isCurrent]), [
    ["race", "Numbers", "Not started", false],
    ["digitize", "Arrays", "Not started", false],
    ["no-space", "Strings", "Not started", false],
    ["missing", "Uncategorized", "Not started", false],
  ]);
  assert.deepEqual(projected.map(row => [row.title, row.description]), tasks.map(task => [task.title, task.description]));
});

test("catalogue rows project validated difficulty without reordering, and omitted custom metadata is Unrated", () => {
  const difficultyTasks = [
    {id: "ct-js-01", title: "Easy first", description: "", starterCode: "", ordinal: 1, difficulty: "Easy"},
    {id: "ct-js-46", title: "Hard second", description: "", starterCode: "", ordinal: 46, difficulty: "Hard"},
    {id: "legacy-custom", title: "Unrated third", description: "", starterCode: "", ordinal: 51},
    {id: "ct-js-11", title: "Medium fourth", description: "", starterCode: "", ordinal: 11, difficulty: "Medium"},
  ];
  const projected = catalogue.getTaskCatalogueRows(difficultyTasks, workspace.createTaskWorkspaceState());
  assert.deepEqual(projected.map(row => [row.id, row.ordinal, row.difficulty]), [
    ["ct-js-01", 1, "Easy"], ["ct-js-46", 46, "Hard"], ["legacy-custom", 51, "Unrated"], ["ct-js-11", 11, "Medium"],
  ], "projection retains the provider's source ordinal and order, including an unrated custom task");
});

test("selection is current-only; a full current-draft Test pass completes and a later Run retains completion", () => {
  let state = workspace.createTaskWorkspaceState();
  state = workspace.selectTask(state, "race", "race");
  assert.equal(status(state, "race"), "Not started");
  assert.equal(rows(state).find(row => row.id === "race").isCurrent, true);

  const passing = start(state, "race", "test");
  assert.equal(status(passing.state, "race"), "In progress", "a pending Test request is session work before its result");
  state = workspace.completeTaskRun(passing.state, passing.token, result("completed", 2, 2));
  assert.equal(status(state, "race"), "Completed");

  const run = start(state, "race", "run");
  state = workspace.completeTaskRun(run.state, run.token, result("completed"));
  assert.equal(status(state, "race"), "Completed", "Run output cannot erase an accepted Test completion");
});

test("a requested Run creates in-progress work without completing the task", () => {
  let state = workspace.createTaskWorkspaceState();
  state = workspace.selectTask(state, "race", "race");
  const run = start(state, "race", "run");
  assert.equal(status(run.state, "race"), "In progress", "an accepted Run request counts as session work");
  state = workspace.completeTaskRun(run.state, run.token, result("completed"));
  assert.equal(status(state, "race"), "In progress", "Run success cannot complete a task");
});

test("attempts and failed, timed-out, runtime, or empty Test outcomes remain in progress and invalidate a prior completion", () => {
  let state = workspace.createTaskWorkspaceState();
  state = workspace.selectTask(state, "race", "race");
  state = workspace.setTaskDraft(state, "race", "edited", "race");
  assert.equal(status(state, "race"), "In progress", "draft edits start progress");

  for (const outcome of [
    result("completed", 0, 0),
    result("test-failed", 1, 2),
    result("runtime-error"),
    result("timeout"),
  ]) {
    const passing = start(state, "race", "test");
    state = workspace.completeTaskRun(passing.state, passing.token, result("completed", 1, 1));
    assert.equal(status(state, "race"), "Completed", "control Test establishes an accepted completion before invalidation");
    const started = start(state, "race", "test");
    state = workspace.completeTaskRun(started.state, started.token, outcome);
    assert.equal(status(state, "race"), "In progress", `${outcome.status} invalidates the prior completion`);
  }

  const passing = start(state, "race", "test");
  state = workspace.completeTaskRun(passing.state, passing.token, result("completed", 1, 1));
  assert.equal(status(state, "race"), "Completed");
  state = workspace.setTaskDraft(state, "race", "edited again", "race");
  assert.equal(status(state, "race"), "In progress", "editing invalidates an accepted completion");
});

test("a cancelled attempt cannot complete a task or erase a valid same-draft Test completion", () => {
  let state = workspace.createTaskWorkspaceState();
  state = workspace.selectTask(state, "race", "race");
  const cancelledFirst = start(state, "race", "test");
  state = workspace.completeTaskRun(cancelledFirst.state, cancelledFirst.token, result("cancelled"));
  assert.equal(status(state, "race"), "In progress", "a cancelled first attempt is still work in progress");

  const passing = start(state, "race", "test");
  state = workspace.completeTaskRun(passing.state, passing.token, result("completed", 1, 1));
  const cancelledAfterPass = start(state, "race", "test");
  state = workspace.completeTaskRun(cancelledAfterPass.state, cancelledAfterPass.token, result("cancelled"));
  assert.equal(status(state, "race"), "Completed", "cancellation cannot erase a valid Test completion for the unchanged draft");
});

test("stale, switched, and repeated Test completions cannot complete another generation or task", () => {
  let state = workspace.createTaskWorkspaceState();
  state = workspace.selectTask(state, "race", "race");
  state = workspace.setTaskDraft(state, "race", "race edited", "race");
  const stale = start(state, "race", "test");
  state = workspace.setTaskDraft(stale.state, "race", "race edited again", "race");
  state = workspace.setTaskDraft(state, "race", "race edited", "race");
  state = workspace.completeTaskRun(state, stale.token, result("completed", 1, 1));
  assert.equal(status(state, "race"), "In progress", "ABA draft values cannot restore completion");

  const first = start(state, "race", "test");
  const second = start(first.state, "race", "test");
  state = workspace.completeTaskRun(second.state, first.token, result("completed", 1, 1));
  assert.equal(status(state, "race"), "In progress", "superseded completion is stale");
  state = workspace.completeTaskRun(state, second.token, result("completed", 1, 1));
  assert.equal(status(state, "race"), "Completed");

  const switchToken = start(state, "race", "test");
  state = workspace.selectTask(switchToken.state, "digitize", "digitize");
  state = workspace.completeTaskRun(state, switchToken.token, result("completed", 1, 1));
  assert.equal(status(state, "race"), "Completed", "old completion cannot mutate a switched task");
  assert.equal(status(state, "digitize"), "Not started", "selection alone remains non-progress");
});

test("workspaces are session-local and status is keyed independently by stable task ID", () => {
  let state = workspace.createTaskWorkspaceState();
  state = workspace.selectTask(state, "race", "race");
  const race = start(state, "race", "test");
  state = workspace.completeTaskRun(race.state, race.token, result("completed", 1, 1));
  state = workspace.selectTask(state, "digitize", "digitize");
  state = workspace.setTaskDraft(state, "digitize", "digitize edited", "digitize");

  assert.equal(status(state, "race"), "Completed");
  assert.equal(status(state, "digitize"), "In progress");
  assert.equal(status(workspace.createTaskWorkspaceState(), "race"), "Not started", "a new state has no persisted completion");
});
