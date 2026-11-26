const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

// This is deliberately a browser contract: it only intercepts the catalogue and
// never invokes the task runner.  The product must expose a real measured
// workspace (`data-cattasks-workspace`) and its computed header baseline
// (`data-header-baseline`).  The latter is diagnostic evidence, not the oracle:
// assertions below also measure the painted DOM boxes.
const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43852";
const widths = [320, 360, 430, 622, 623, 700, 834, 933, 1040, 1160, 1280, 1440, 1600];
const metricFitTitle = "Actual measured title must fit by reducing to a readable size before truncation";
const catalog = {version: 1, tasks: [
  {id: "short", title: "Short", description: "Inert fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "cyrillic", title: "Съешь ещё этих мягких французских булок", description: "Inert Cyrillic fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "two-line", title: "A two line fixture title preserves the common content start", description: "Inert two-line fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "metric-fit", title: metricFitTitle, description: "Inert metric-fitting fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "long", title: "A deliberately long fixture title that must not move the shared workspace content start or cover its live controls", description: "Inert long fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
]};
// The public parser rejects a blank title.  This deliberately invalid response
// covers the genuine unavailable-catalogue state instead of pretending that a
// blank title is a selectable task.
const invalidCatalog = {...catalog, tasks: [{...catalog.tasks[0], title: ""}]};

const near = (actual, expected, message, epsilon = 1.5) => assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, received ${actual}`);
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

async function prepare(page, {payload = catalog, waitForEditor = true} = {}) {
  const diagnostics = {console: [], page: [], failed: [], responses: [], catalogRequests: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.failed.push(request.url()));
  page.on("response", response => { if (response.status() >= 400) diagnostics.responses.push(`${response.request().method()} ${response.status()} ${response.url()}`); });
  await page.route("**/task-catalog.v1.json", route => {
    diagnostics.catalogRequests.push(`${route.request().method()} ${route.request().url()}`);
    return route.fulfill({contentType: "application/json", body: JSON.stringify(payload)});
  });
  assert.equal((await page.goto(baseUrl, {waitUntil: "domcontentloaded"}))?.status(), 200, "the isolated loopback app loads");
  await page.getByRole("button", {name: /Choose theme.*current:/i}).waitFor({state: "visible"});
  if (waitForEditor) {
    await page.locator(".monaco-editor").first().waitFor({state: "visible"});
    await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));
  }
  await settle(page);
  return diagnostics;
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
}

async function chooseTheme(page, name) {
  const trigger = page.getByRole("button", {name: /Choose theme.*current:/i});
  await trigger.click();
  const choices = page.getByRole("group", {name: "Themes", exact: true});
  await choices.getByRole("button", {name, exact: true}).click();
  await page.locator(`[data-cattasks-theme='${name.toLowerCase()}']`).waitFor();
  await settle(page);
}

// A split pane constrains the measured workspace's owner, never the measured
// element or its diagnostic/CSS values.  The unique marker dies with the
// disposable browser context.
async function setOwningContainerWidth(page, width) {
  let requestedWidth = width;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.evaluate(nextWidth => {
      const workspace = document.querySelector("[data-cattasks-workspace]");
      if (!workspace?.parentElement) throw new Error("v146 workspace owner is unavailable");
      const owner = workspace.parentElement;
      owner.setAttribute("data-v146-test-split-owner", "");
      Object.assign(owner.style, {
        inlineSize: `${nextWidth}px`, maxInlineSize: `${nextWidth}px`,
        minInlineSize: "0px", marginInline: "0px",
      });
    }, requestedWidth);
    await settle(page);
    const actualWidth = await page.locator("[data-cattasks-workspace]").evaluate(node => node.getBoundingClientRect().width);
    if (Math.abs(actualWidth - width) <= 1.5) return actualWidth;
    requestedWidth += width - actualWidth;
  }
  const actualWidth = await page.locator("[data-cattasks-workspace]").evaluate(node => node.getBoundingClientRect().width);
  throw new Error(`v146 owning-container calibration could not reach ${width}px (measured ${actualWidth}px)`);
}

async function geometry(page) {
  return page.evaluate(() => {
    const workspace = document.querySelector("[data-cattasks-workspace]");
    const visible = element => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && !element.closest("[hidden]") && box.width > 0 && box.height > 0;
    };
    const header = [...document.querySelectorAll("[data-cattasks-header]")].find(visible);
    const content = [...document.querySelectorAll("[data-cattasks-workspace-content]")].find(visible);
    if (!workspace || !header || !content) throw new Error("v146 workspace geometry contract is incomplete");
    const rect = element => {
      const box = element.getBoundingClientRect();
      return {left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height};
    };
    return {
      workspace: rect(workspace), header: rect(header), content: rect(content),
      measuredWidth: Number(workspace.getAttribute("data-cattasks-workspace")),
      baseline: Number(workspace.getAttribute("data-header-baseline")),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function assertFrame(page, width, pageName) {
  const frame = await geometry(page);
  assert.ok(Number.isFinite(frame.measuredWidth), `${pageName} exposes numeric measured workspace width`);
  assert.ok(Number.isFinite(frame.baseline), `${pageName} exposes numeric header baseline`);
  near(frame.workspace.width, width, `${pageName} paints the calibrated owning-container width`, 2);
  near(frame.measuredWidth, Math.floor(frame.workspace.width), `${pageName} diagnostic matches the actual workspace width`, 1);
  near(frame.header.left, frame.workspace.left, `${pageName} header starts at the real workspace left`);
  near(frame.header.right, frame.workspace.right, `${pageName} header ends at the real workspace right`);
  near(frame.content.left, frame.workspace.left, `${pageName} content shares workspace left`);
  near(frame.content.right, frame.workspace.right, `${pageName} content shares workspace right`);
  near(frame.header.bottom, frame.workspace.top + frame.baseline, `${pageName} real header occupies the reserved baseline slot`, 3);
  assert.ok(frame.content.top >= frame.header.bottom - 2, `${pageName} content starts after the real header boundary`);
  assert.equal(frame.overflow, 0, `${pageName} has no horizontal document overflow at ${width}px`);
  return frame;
}

async function clickWithKeyboard(page, locator, key, {theme, width, target}) {
  const anchorId = `v146-keyboard-anchor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const context = `${theme} ${width}px ${target}`;
  await page.evaluate(({anchorId}) => {
    const visible = element => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && !element.closest("[hidden]") && box.width > 0 && box.height > 0;
    };
    const header = [...document.querySelectorAll("[data-cattasks-header]")].find(visible);
    if (!header?.parentElement) throw new Error("v146 keyboard anchor cannot find the live header");
    const anchor = document.createElement("button");
    anchor.id = anchorId;
    anchor.type = "button";
    anchor.textContent = "v146 keyboard test anchor";
    anchor.setAttribute("data-v146-keyboard-anchor", "");
    Object.assign(anchor.style, {
      position: "absolute", inlineSize: "1px", blockSize: "1px", margin: "-1px",
      padding: "0", overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap",
    });
    header.before(anchor);
    anchor.focus();
  }, {anchorId});
  try {
    assert.equal(await page.evaluate(id => document.activeElement?.id === id, anchorId), true, `${context} starts real Tab navigation from its localized header anchor`);
    for (let tabCount = 0; tabCount < 24; tabCount += 1) {
      await page.keyboard.press("Tab");
      if (await locator.evaluate(node => node === document.activeElement)) {
        assert.equal(await locator.evaluate(node => node.matches(":focus-visible")), true, `${context} receives visible focus through real Tab navigation`);
        await page.keyboard.press(key);
        return;
      }
    }
    throw new Error(`${context} was not reachable through Tab navigation from the live-header anchor`);
  } finally {
    await page.evaluate(id => document.getElementById(id)?.remove(), anchorId);
  }
}

async function assertStackedTaskGrid(page, width, theme) {
  const layout = await page.evaluate(() => {
    const content = [...document.querySelectorAll("[data-cattasks-workspace-content]")].find(element => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && !element.closest("[hidden]") && box.width > 0 && box.height > 0;
    });
    if (!content || content.children.length !== 2) throw new Error("v146 task grid does not expose its reader/editor pair");
    const rect = element => {
      const box = element.getBoundingClientRect();
      return {left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth};
    };
    return {content: rect(content), reader: rect(content.children[0]), editor: rect(content.children[1])};
  });
  const context = `${theme} ${width}px Task grid`;
  assert.ok(layout.reader.height > 0 && layout.editor.height > 0, `${context} keeps both reader and editor usable (reader ${layout.reader.height}px, editor ${layout.editor.height}px)`);
  assert.ok(layout.editor.top >= layout.reader.bottom - 1, `${context} stacks editor below reader (reader bottom ${layout.reader.bottom}px, editor top ${layout.editor.top}px)`);
  near(layout.reader.left, layout.content.left, `${context} reader shares the actual content left`);
  near(layout.reader.right, layout.content.right, `${context} reader shares the actual content right`);
  near(layout.editor.left, layout.content.left, `${context} editor shares the actual content left`);
  near(layout.editor.right, layout.content.right, `${context} editor shares the actual content right`);
  assert.ok(layout.content.scrollWidth <= layout.content.clientWidth + 1, `${context} content has no inner horizontal overflow (${layout.content.scrollWidth}/${layout.content.clientWidth})`);
  assert.ok(layout.reader.scrollWidth <= layout.reader.clientWidth + 1, `${context} reader has no inner horizontal overflow (${layout.reader.scrollWidth}/${layout.reader.clientWidth})`);
  assert.ok(layout.editor.scrollWidth <= layout.editor.clientWidth + 1, `${context} editor has no inner horizontal overflow (${layout.editor.scrollWidth}/${layout.editor.clientWidth})`);
}

async function assertDiagnostics(diagnostics) {
  assert.deepEqual(diagnostics.console, []);
  assert.deepEqual(diagnostics.page, []);
  assert.deepEqual(diagnostics.failed, []);
  assert.deepEqual(diagnostics.responses, []);
  assert.deepEqual(diagnostics.catalogRequests, [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`]);
}

async function waitForFocus(page, locator, message) {
  const element = await locator.elementHandle();
  assert.ok(element, `${message}: focus target exists`);
  await page.waitForFunction(node => document.activeElement === node, element, {timeout: 5_000});
  assert.equal(await locator.evaluate(node => node === document.activeElement), true, message);
}

test("v146 foundation measures Task and All tasks from the owning container at every published width", {timeout: 180_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const theme of ["Khorne", "Nurgle"]) {
      await chooseTheme(page, theme);
      for (const width of widths) {
        await setOwningContainerWidth(page, width);
        const taskFrame = await assertFrame(page, width, `${theme} Task`);
        const allTasks = page.getByRole("button", {name: "All tasks", exact: true});
        const allBox = await allTasks.boundingBox();
        assert.ok(allBox && allBox.width >= 44 && allBox.height >= 44, `${theme} ${width}px All tasks is a real 44px target`);
        assert.ok(allBox.x < taskFrame.workspace.left + taskFrame.workspace.width / 2, `${theme} ${width}px All tasks remains on the left`);
        await clickWithKeyboard(page, allTasks, "Enter", {theme, width, target: "All tasks"});
        await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor();
        const catalogueFrame = await assertFrame(page, width, `${theme} All tasks`);
        near(catalogueFrame.content.top, taskFrame.content.top, `${theme} ${width}px Task and All tasks preserve content start`, 2);
        near(catalogueFrame.header.bottom, taskFrame.header.bottom, `${theme} ${width}px Task and All tasks preserve header baseline`, 2);
        const back = page.getByRole("button", {name: "Back to task", exact: true});
        const backBox = await back.boundingBox();
        assert.ok(backBox && backBox.width >= 44 && backBox.height >= 44, `${theme} ${width}px Back to task is a real 44px target`);
        assert.ok(backBox.x < catalogueFrame.workspace.left + catalogueFrame.workspace.width / 2, `${theme} ${width}px Back to task remains on the left`);
        await clickWithKeyboard(page, back, "Space", {theme, width, target: "Back to task"});
        await page.getByRole("heading", {name: "Short", exact: true}).waitFor();
      }
    }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 foundation turns sub-820px Task work into one usable reader/editor column", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const theme of ["Khorne", "Nurgle"]) {
      await chooseTheme(page, theme);
      for (const width of widths.filter(candidate => candidate <= 820)) {
        await setOwningContainerWidth(page, width);
        await assertStackedTaskGrid(page, width, theme);
      }
    }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 foundation fits measured titles before shortening and preserves pathological-title metadata", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const theme of ["Khorne", "Nurgle"]) {
      await chooseTheme(page, theme);
      await setOwningContainerWidth(page, 834);
      const previous = page.getByRole("button", {name: "Select previous task", exact: true});
      while (!(await previous.isDisabled())) await previous.click();
      await page.getByRole("heading", {name: "Short", exact: true}).waitFor({state: "visible"});
      const shortFrame = await geometry(page);
      const next = page.getByRole("button", {name: "Select next task", exact: true});
      for (let step = 0; step < 3; step += 1) await next.click();
      const metricTitle = page.getByRole("heading", {name: metricFitTitle, exact: true});
      await metricTitle.waitFor({state: "visible"});
      const metric = await metricTitle.evaluate(node => {
        const box = node.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node);
        return {
          text: node.textContent,
          nativeTitle: node.getAttribute("title"),
          fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
          lineClamp: getComputedStyle(node).webkitLineClamp,
          titleTruncated: node.getAttribute("data-title-truncated"),
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight,
          box: {top: box.top, bottom: box.bottom, left: box.left, right: box.right},
          lines: [...range.getClientRects()].map(rect => ({top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right})),
        };
      });
      const metricLines = metric.lines.filter((line, index, lines) => lines.findIndex(candidate => Math.abs(candidate.top - line.top) <= 1 && Math.abs(candidate.bottom - line.bottom) <= 1) === index);
      assert.equal(metric.text, metricFitTitle, `${theme} retains the unabridged metric-fitting title text`);
      assert.equal(metric.nativeTitle, metricFitTitle, `${theme} exposes the unabridged metric-fitting title natively`);
      assert.ok(metric.fontSize >= 18, `${theme} metric-fitting title remains legible at ${metric.fontSize}px`);
      assert.ok(metric.lineClamp === "" || metric.lineClamp === "none", `${theme} metric-fitting title has no active line-clamp fallback (${JSON.stringify(metric.lineClamp)})`);
      assert.notEqual(metric.titleTruncated, "true", `${theme} metric-fitting title is not marked as truncated`);
      assert.ok(metric.scrollHeight <= metric.clientHeight + 1, `${theme} metric-fitting title is not clipped by a fixed line clamp`);
      assert.ok(metricLines.length >= 1 && metricLines.length <= 2, `${theme} metric-fitting title renders one or two actual lines, not ${metricLines.length}`);
      assert.ok(metricLines.every(line => line.top >= metric.box.top - 1 && line.bottom <= metric.box.bottom + 1 && line.left >= metric.box.left - 1 && line.right <= metric.box.right + 1), `${theme} every rendered metric-fitting title line stays inside its reserved rectangle`);
      const metricFrame = await geometry(page);
      near(metricFrame.header.bottom, shortFrame.header.bottom, `${theme} metric-fitting title preserves the short-title header boundary`, 1);
      near(metricFrame.content.top, shortFrame.content.top, `${theme} metric-fitting title preserves the short-title content start`, 1);
      await next.click();
      const pathologicalTitle = page.getByRole("heading", {name: /deliberately long fixture/i});
      await pathologicalTitle.waitFor({state: "visible"});
      assert.equal(await pathologicalTitle.getAttribute("title"), catalog.tasks.at(-1).title, `${theme} pathological title retains its native unabridged title`);
      const [pathologicalBox, previousBox, nextBox] = await Promise.all([pathologicalTitle.boundingBox(), page.getByRole("button", {name: "Select previous task", exact: true}).boundingBox(), next.boundingBox()]);
      assert.ok(pathologicalBox && previousBox && nextBox && !intersects(pathologicalBox, previousBox) && !intersects(pathologicalBox, nextBox), `${theme} pathological title keeps both header controls clear`);
      const pathologicalFrame = await geometry(page);
      near(pathologicalFrame.header.bottom, metricFrame.header.bottom, `${theme} pathological title remains in the fixed header slot`, 1);
      near(pathologicalFrame.header.bottom, shortFrame.header.bottom, `${theme} pathological title preserves the short-title header boundary`, 1);
      near(pathologicalFrame.content.top, shortFrame.content.top, `${theme} pathological title preserves the short-title content start`, 1);
    }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 foundation restores the real catalogue opener before a second keyboard reopen", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1200, height: 920}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const theme of ["Khorne", "Light"]) {
      await chooseTheme(page, theme);
      const opener = page.getByRole("button", {name: "All tasks", exact: true});
      await opener.focus();
      await waitForFocus(page, opener, `${theme} starts from the real All tasks opener`);
      await page.keyboard.press("Enter");
      const firstSearch = page.getByRole("searchbox", {name: "Search tasks", exact: true});
      await firstSearch.waitFor({state: "visible"});
      await waitForFocus(page, firstSearch, `${theme} first keyboard catalogue open focuses its searchbox`);
      await firstSearch.fill("short");
      const firstNotStarted = page.getByRole("radio", {name: "Not started", exact: true});
      await firstNotStarted.check();
      const back = page.getByRole("button", {name: "Back to task", exact: true});
      await back.focus();
      await waitForFocus(page, back, `${theme} Back to task is the real keyboard return control`);
      await page.keyboard.press("Enter");
      const restoredOpener = page.getByRole("button", {name: "All tasks", exact: true});
      await restoredOpener.waitFor({state: "visible"});
      await waitForFocus(page, restoredOpener, `${theme} Back to task restores focus to its All tasks opener`);
      await page.keyboard.press("Enter");
      const secondSearch = page.getByRole("searchbox", {name: "Search tasks", exact: true});
      await secondSearch.waitFor({state: "visible"});
      await waitForFocus(page, secondSearch, `${theme} second keyboard catalogue open focuses its current searchbox`);
      assert.equal(await secondSearch.inputValue(), "short", `${theme} second catalogue owner retains the first query`);
      assert.equal(await page.getByRole("radio", {name: "Not started", exact: true}).isChecked(), true, `${theme} second catalogue owner retains the selected filter`);
      const secondBack = page.getByRole("button", {name: "Back to task", exact: true});
      await secondBack.focus();
      await page.keyboard.press("Enter");
      await restoredOpener.waitFor({state: "visible"});
    }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 foundation keeps live controls, title cases, boundaries and editor state independent of decoration", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Khorne");
    await setOwningContainerWidth(page, 834);
    const previous = page.getByRole("button", {name: "Select previous task", exact: true});
    const next = page.getByRole("button", {name: "Select next task", exact: true});
    const themeToggle = page.getByRole("button", {name: /Choose theme.*current:/i});
    assert.equal(await previous.isDisabled(), true, "first task disables previous instead of wrapping");
    assert.equal(await next.isDisabled(), false, "first task exposes its real last header navigation control");
    await next.focus();
    assert.equal(await next.evaluate(node => node === document.activeElement), true, "keyboard order starts from the actual enabled Next header control");
    await page.keyboard.press("Tab");
    assert.equal(await themeToggle.evaluate(node => node === document.activeElement), true, "one real Tab from header Next reaches the labelled ThemeToggle before the workspace");
    assert.equal(await themeToggle.evaluate(node => node.matches(":focus-visible")), true, "ThemeToggle receives visible focus through the natural header Tab order");
    assert.equal(await page.getByRole("heading", {name: "Short", exact: true}).count(), 1, "first boundary keeps the selected task visible");
    for (const title of ["Съешь ещё этих мягких французских булок", "A two line fixture title preserves the common content start", metricFitTitle, "A deliberately long fixture title that must not move the shared workspace content start or cover its live controls"]) {
      await clickWithKeyboard(page, next, "Enter", {theme: "Khorne", width: 834, target: "Select next task"});
      const heading = page.getByRole("heading", {name: title, exact: true});
      await heading.waitFor();
      const [titleBox, previousBox, nextBox] = await Promise.all([heading.boundingBox(), previous.boundingBox(), next.boundingBox()]);
      assert.ok(titleBox && previousBox && nextBox && !intersects(titleBox, previousBox) && !intersects(titleBox, nextBox), `title ${JSON.stringify(title)} does not cover live arrows`);
    }
    assert.equal(await next.isDisabled(), true, "last task disables next instead of wrapping");
    assert.equal(await page.getByRole("heading", {name: /deliberately long fixture/i}).count(), 1, "disabled last boundary keeps current task");
    const editor = page.locator(".monaco-editor").first();
    const stateBefore = await page.evaluate(() => {
      const editor = window.monaco.editor.getEditors().find(candidate => candidate.hasTextFocus()) ?? window.monaco.editor.getEditors()[0];
      const model = editor?.getModel();
      return {
        models: window.monaco.editor.getModels().map(candidate => candidate.uri.toString()),
        model: model?.uri.toString(),
        value: model?.getValue(),
        selection: editor?.getSelection()?.toString(),
      };
    });
    await editor.click({position: {x: 20, y: 20}});
    const retainedDraft = "// inert draft retained";
    await page.keyboard.type(retainedDraft);
    await page.keyboard.press("Shift+ArrowLeft");
    const edited = await page.evaluate(() => {
      const editor = window.monaco.editor.getEditors().find(candidate => candidate.hasTextFocus()) ?? window.monaco.editor.getEditors()[0];
      const model = editor?.getModel();
      return {value: model?.getValue(), selection: editor?.getSelection()?.toString()};
    });
    assert.notEqual(edited.value, stateBefore.value, "typing changes the active Monaco draft before the view transition");
    assert.ok(edited.value?.includes(retainedDraft), "the active Monaco draft contains the inserted inert content before the view transition");
    const typed = edited.value;
    const editedSelection = edited.selection;
    assert.ok(editedSelection, "the edited draft has a representable Monaco selection before the view transition");
    const allTasks = page.getByRole("button", {name: "All tasks", exact: true});
    await clickWithKeyboard(page, allTasks, "Enter", {theme: "Khorne", width: 834, target: "All tasks"});
    const search = page.getByRole("searchbox", {name: "Search tasks"});
    await search.fill("short");
    const notStarted = page.getByRole("radio", {name: "Not started", exact: true});
    await notStarted.check();
    const taskList = page.locator("section[aria-labelledby='taskListTitle']");
    const shortRow = taskList.getByRole("heading", {name: "Short", exact: true});
    await shortRow.waitFor({state: "visible"});
    assert.equal(await shortRow.count(), 1, "the real search/filter pair reaches exactly the untouched Short task");
    assert.equal(await taskList.getByRole("heading", {name: /deliberately long fixture/i}).count(), 0, "the active query excludes the edited long task from the untouched-task filter control");
    await clickWithKeyboard(page, page.getByRole("button", {name: "Back to task", exact: true}), "Space", {theme: "Khorne", width: 834, target: "Back to task"});
    await chooseTheme(page, "Nurgle");
    const stateAfter = await page.evaluate(() => {
      const editor = window.monaco.editor.getEditors().find(candidate => candidate.hasTextFocus()) ?? window.monaco.editor.getEditors()[0];
      const model = editor?.getModel();
      return {
        models: window.monaco.editor.getModels().map(candidate => candidate.uri.toString()),
        model: model?.uri.toString(),
        value: model?.getValue(),
        selection: editor?.getSelection()?.toString(),
      };
    });
    assert.deepEqual(stateAfter.models, stateBefore.models, "theme/view changes do not remount Monaco models");
    assert.equal(stateAfter.model, stateBefore.model, "theme/view changes retain the active Monaco model");
    assert.equal(stateAfter.value, typed, "theme/view changes retain the draft");
    assert.equal(stateAfter.selection, editedSelection, "theme/view changes retain the edited Monaco selection");
    assert.equal(await page.getByRole("heading", {name: /deliberately long fixture/i}).count(), 1, "the selected task survives the view/theme transition");
    await clickWithKeyboard(page, page.getByRole("button", {name: "All tasks", exact: true}), "Enter", {theme: "Nurgle", width: 834, target: "All tasks"});
    assert.equal(await search.inputValue(), "short", "the public Search tasks control retains its query after re-opening");
    assert.equal(await notStarted.isChecked(), true, "the public status filter retains its selection after re-opening");
    assert.equal(await shortRow.count(), 1, "the retained search/filter pair still reaches exactly the untouched Short task");
    assert.equal(await taskList.getByRole("heading", {name: /deliberately long fixture/i}).count(), 0, "the retained query continues to exclude the edited long task");
    const decoration = await page.evaluate(() => [...document.querySelectorAll("[data-cattasks-decoration]")].filter(node => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }).map(node => ({pointerEvents: getComputedStyle(node).pointerEvents})));
    assert.ok(decoration.length > 0, "the pointer-safety assertion observes at least one visible decorative layer");
    assert.ok(decoration.every(layer => layer.pointerEvents === "none"), "visible decorative layers cannot capture pointers");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 foundation presents the genuine unavailable-catalogue fallback for an invalid public response", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page, {payload: invalidCatalog, waitForEditor: false});
    await chooseTheme(page, "Khorne");
    await setOwningContainerWidth(page, 834);
    await page.getByRole("heading", {name: "Tasks unavailable.", exact: true}).waitFor();
    await assertFrame(page, 834, "Khorne unavailable catalogue");
    await clickWithKeyboard(page, page.getByRole("button", {name: "All tasks", exact: true}), "Enter", {theme: "Khorne", width: 834, target: "All tasks"});
    await page.getByRole("alert").getByText("Tasks could not be loaded.", {exact: true}).waitFor();
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});
