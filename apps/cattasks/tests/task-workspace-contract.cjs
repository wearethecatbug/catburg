const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const {loadTypeScript} = require("./helpers/load-typescript.cjs");

const workspace = loadTypeScript(path.join(__dirname, "..", "src", "app", "_components", "tasks", "context", "taskWorkspaceState.ts"));

const result = (requestId = "run") => ({requestId, status: "completed", message: "done", logs: []});

test("task workspaces restore drafts by stable identity and invalidate only the edited task result", () => {
  let state = workspace.createTaskWorkspaceState();
  state = workspace.selectTask(state, "task-a", "starter A");
  state = workspace.setTaskDraft(state, "task-a", "draft A", "starter A");
  const started = workspace.beginTaskRun(state, "task-a", "starter A", "test");
  assert.ok(started);
  state = workspace.completeTaskRun(started.state, started.token, result("a"));
  assert.equal(state.workspaces.get("task-a").result.result.requestId, "a");

  state = workspace.selectTask(state, "task-b", "starter B");
  state = workspace.setTaskDraft(state, "task-b", "draft B", "starter B");
  const bStarted = workspace.beginTaskRun(state, "task-b", "starter B", "run");
  assert.ok(bStarted);
  state = workspace.completeTaskRun(bStarted.state, bStarted.token, result("b"));

  state = workspace.selectTask(state, "task-a", "starter A");
  assert.equal(state.workspaces.get("task-a").draft, "draft A", "A draft survives A→B→A");
  assert.equal(state.workspaces.get("task-a").result.result.requestId, "a", "A result remains while A is unchanged");
  assert.equal(state.workspaces.get("task-b").result.result.requestId, "b", "B workspace remains independent");

  state = workspace.setTaskDraft(state, "task-a", "edited A", "starter A");
  assert.equal(state.workspaces.get("task-a").result, undefined, "editing A invalidates A only");
  assert.equal(state.workspaces.get("task-b").result.result.requestId, "b", "editing A cannot clear B result");
});

test("stale task-run completions cannot survive switching, ABA edits, repeated runs, or clear selection", () => {
  let state = workspace.createTaskWorkspaceState();
  state = workspace.selectTask(state, "task-a", "starter");
  const first = workspace.beginTaskRun(state, "task-a", "starter", "test");
  assert.ok(first);
  state = workspace.setTaskDraft(first.state, "task-a", "changed", "starter");
  state = workspace.setTaskDraft(state, "task-a", "starter", "starter");
  state = workspace.completeTaskRun(state, first.token, result("aba"));
  assert.equal(state.workspaces.get("task-a").result, undefined, "an A→B→A-equivalent draft sequence cannot revive an old result");

  const repeatedOne = workspace.beginTaskRun(state, "task-a", "starter", "test");
  assert.ok(repeatedOne);
  const repeatedTwo = workspace.beginTaskRun(repeatedOne.state, "task-a", "starter", "run");
  assert.ok(repeatedTwo);
  state = workspace.completeTaskRun(repeatedTwo.state, repeatedOne.token, result("old-repeat"));
  assert.equal(state.workspaces.get("task-a").result, undefined, "an earlier repeat cannot overwrite the current run");
  state = workspace.completeTaskRun(state, repeatedTwo.token, result("new-repeat"));
  assert.equal(state.workspaces.get("task-a").result.result.requestId, "new-repeat");

  const beforeSwitch = workspace.beginTaskRun(state, "task-a", "starter", "test");
  assert.ok(beforeSwitch);
  state = workspace.selectTask(beforeSwitch.state, "task-b", "starter B");
  state = workspace.completeTaskRun(state, beforeSwitch.token, result("wrong-task"));
  assert.equal(state.workspaces.get("task-a").result.result.requestId, "new-repeat", "a completion cannot be attributed after selection changes");
  state = workspace.clearTaskSelection(state);
  const afterClear = workspace.completeTaskRun(state, beforeSwitch.token, result("after-clear"));
  assert.equal(afterClear, state, "clear selection rejects a late completion without mutating state");
});

test("workspace state safely supports inherited-looking and URI-unsafe stable IDs", () => {
  let state = workspace.createTaskWorkspaceState();
  state = workspace.selectTask(state, "__proto__", "proto starter");
  state = workspace.setTaskDraft(state, "__proto__", "proto draft", "proto starter");
  state = workspace.selectTask(state, "../../task?x=1", "uri starter");
  state = workspace.setTaskDraft(state, "../../task?x=1", "uri draft", "uri starter");

  assert.equal(state.workspaces.get("__proto__").draft, "proto draft");
  assert.equal(state.workspaces.get("../../task?x=1").draft, "uri draft");
  assert.equal(Object.prototype.hasOwnProperty.call(Object.fromEntries(state.workspaces), "__proto__"), true);
});

test("same draft is a no-op and runs require the selected task", () => {
  let state = workspace.createTaskWorkspaceState();
  assert.equal(workspace.beginTaskRun(state, "missing", "starter", "test"), null);
  state = workspace.selectTask(state, "task-a", "starter");
  const unchanged = workspace.setTaskDraft(state, "task-a", "starter", "starter");
  assert.equal(unchanged, state, "same text must not discard a current result or advance generations");
  assert.equal(workspace.beginTaskRun(state, "task-b", "starter", "test"), null, "a non-selected task cannot start a visible run");
});
