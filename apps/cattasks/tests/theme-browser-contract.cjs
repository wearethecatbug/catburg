const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43852";
const fixtureCatalog = {
  version: 1,
  tasks: [
    {
      id: "theme-first",
      title: "Theme baseline fixture",
      description: "An inert task used only to inspect the Light surface.",
      entryPoint: "echo",
      starterCode: "function echo(value) { return value; }",
      solution: "function echo(value) { return value; }",
      tests: [{args: ["fixture"], expected: "fixture"}],
    },
    {
      id: "theme-second",
      title: "Second theme fixture",
      description: "Keeps catalogue navigation observable without executing code.",
      entryPoint: "echo",
      starterCode: "function echo(value) { return value; }",
      solution: "function echo(value) { return value; }",
      tests: [{args: ["fixture"], expected: "fixture"}],
    },
  ],
};

const lightPaint = {
  page: "rgb(214, 225, 212)",
  panel: "rgb(250, 251, 251)",
  catalogue: "rgb(247, 249, 246)",
  fileInput: "rgb(255, 253, 248)",
  monaco: "rgb(255, 255, 254)",
};

function installDiagnostics(page) {
  const diagnostics = {console: [], page: [], failed: [], responses: [], catalogRequests: []};
  page.on("console", message => {
    if (message.type() === "error") diagnostics.console.push(message.text());
  });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.failed.push(request.url()));
  page.on("response", response => {
    if (response.status() >= 400) diagnostics.responses.push(`${response.request().method()} ${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

async function prepare(page) {
  const diagnostics = installDiagnostics(page);
  await page.route("**/task-catalog.v1.json", route => {
    diagnostics.catalogRequests.push(`${route.request().method()} ${route.request().url()}`);
    return route.fulfill({contentType: "application/json", body: JSON.stringify(fixtureCatalog)});
  });
  const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
  assert.equal(response?.status(), 200, "the isolated loopback app must load");
  await page.getByRole("heading", {name: fixtureCatalog.tasks[0].title, exact: true}).waitFor();
  await page.locator(".monaco-editor").waitFor({state: "visible"});
  await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));
  return diagnostics;
}

async function taskSurface(page) {
  return page.evaluate(() => {
    const find = selector => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`missing Light surface ${selector}`);
      return element;
    };
    const paint = element => {
      const style = getComputedStyle(element);
      return {backgroundColor: style.backgroundColor, color: style.color, borderColor: style.borderColor};
    };
    const outer = find('[class*="background"]');
    const taskPanel = find('[class*="taskDetailsContainer"]');
    const solution = find('section[aria-labelledby="taskSolutionHeading"]');
    const output = find('section[aria-labelledby="taskOutputHeading"]');
    const editorFrame = find('[class*="codeEditorFrame"]');
    const monaco = find(".monaco-editor");
    const pet = find('[aria-label="Pet feeding strip"]');
    const visibleThemeChoice = [...document.querySelectorAll("button, [role='button']")].some(element => /theme|light|dark/i.test(element.getAttribute("aria-label") || element.textContent || ""));
    return {
      outer: paint(outer),
      taskPanel: paint(taskPanel),
      solution: paint(solution),
      output: paint(output),
      editorFrame: paint(editorFrame),
      monaco: paint(monaco),
      pet: paint(pet),
      monacoModels: window.monaco.editor.getModels().map(model => ({uri: model.uri.path, value: model.getValue()})),
      visibleThemeChoice,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function catalogueSurface(page) {
  return page.evaluate(() => {
    const find = selector => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`missing Light catalogue surface ${selector}`);
      return element;
    };
    const paint = element => {
      const style = getComputedStyle(element);
      return {backgroundColor: style.backgroundColor, color: style.color, borderColor: style.borderColor};
    };
    const filters = find('[aria-label="Task filters"]');
    const taskList = find('[aria-labelledby="taskListTitle"]');
    const fileInput = find('label[class*="fileInput"]');
    const pet = find('[aria-label="Pet feeding strip"]');
    const back = find("button");
    return {
      filters: paint(filters),
      taskList: paint(taskList),
      fileInput: paint(fileInput),
      pet: paint(pet),
      back: {label: back.textContent?.trim()},
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

function assertDiagnostics(diagnostics) {
  assert.deepEqual(diagnostics.console, [], "the visual baseline emits no console errors");
  assert.deepEqual(diagnostics.page, [], "the visual baseline emits no page errors");
  assert.deepEqual(diagnostics.failed, [], "the visual baseline has no failed requests");
  assert.deepEqual(diagnostics.responses, [], "the visual baseline has no HTTP failures");
  assert.deepEqual(diagnostics.catalogRequests, [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`], "the inert fixture makes exactly one catalogue request");
}

test("Light task surface preserves the established palette, editor, keyboard navigation, and geometry", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    const surface = await taskSurface(page);
    assert.equal(surface.outer.backgroundColor, lightPaint.page);
    assert.equal(surface.taskPanel.backgroundColor, lightPaint.panel);
    assert.equal(surface.solution.backgroundColor, lightPaint.panel);
    assert.equal(surface.output.backgroundColor, lightPaint.panel);
    assert.equal(surface.editorFrame.backgroundColor, lightPaint.panel);
    assert.equal(surface.monaco.backgroundColor, lightPaint.monaco);
    assert.equal(surface.pet.color, "rgb(37, 69, 50)");
    assert.equal(surface.visibleThemeChoice, false, "the Light-only delivery cannot advertise an unavailable theme choice");
    assert.equal(surface.overflow, 0, "the Light task surface has no horizontal overflow");
    assert.ok(surface.monacoModels.some(model => model.uri.endsWith("/solution-theme-first.js") && model.value === fixtureCatalog.tasks[0].starterCode), "the real Monaco model is mounted for the fixture task");

    const allTasks = page.getByRole("button", {name: "All tasks", exact: true});
    await allTasks.focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Select previous task", "keyboard navigation starts at the original previous-task control");
    assert.equal(await page.evaluate(() => document.activeElement?.matches(":focus-visible")), true, "the original previous-task control keeps a visible focus state");
    assertDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("Light catalogue preserves its panels, custom controls, pet strip, and return control", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor();
    const surface = await catalogueSurface(page);
    assert.equal(surface.filters.backgroundColor, lightPaint.catalogue);
    assert.equal(surface.taskList.backgroundColor, lightPaint.catalogue);
    assert.equal(surface.fileInput.backgroundColor, lightPaint.fileInput);
    assert.equal(surface.pet.color, "rgb(37, 69, 50)");
    assert.equal(surface.back.label, "←Back to task");
    assert.equal(surface.overflow, 0, "the Light catalogue has no horizontal overflow");
    await page.getByRole("button", {name: "Back to task", exact: true}).focus();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "←Back to task", "the original catalogue return control remains keyboard-focusable");
    assertDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});
