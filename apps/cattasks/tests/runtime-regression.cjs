const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43814";
const artifactDirectory = process.env.REGRESSION_ARTIFACT_DIR;
const artifactLabel = process.env.REGRESSION_RUN_LABEL;
const viewports = [["mobile-320", 320, 844], ["mobile-390", 390, 844], ["desktop-1268", 1268, 900], ["desktop-1440", 1440, 900]];
const publicCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "task-catalog.v1.json"), "utf8"));
const initialTask = publicCatalog.tasks[0];
assert.ok(initialTask && typeof initialTask.title === "string" && initialTask.title.length > 0, "public catalogue supplies an initial task title");

function artifactPath(name, extension) {
  if (!artifactDirectory) return undefined;
  assert.ok(artifactLabel, "REGRESSION_RUN_LABEL is required when artifacts are enabled");
  assert.ok(fs.statSync(artifactDirectory).isDirectory(), "REGRESSION_ARTIFACT_DIR must be an existing directory");
  const output = path.join(artifactDirectory, `${artifactLabel}-cattasks-${name}.${extension}`);
  assert.equal(fs.existsSync(output), false, `refusing to overwrite existing regression artifact: ${output}`);
  return output;
}

async function observeReachability(page, selector, locator) {
  if (await locator.count() !== 1) return { selector, rendered: false, unclipped: false, receivesPointer: false };
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return { selector, rendered: false, unclipped: false, receivesPointer: false };
  const hit = await locator.evaluate((element) => { const r = element.getBoundingClientRect(); const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { receivesPointer: target === element || element.contains(target), target: target && { tag: target.tagName, id: target.id, className: String(target.className) } }; });
  // Playwright may leave a subpixel vertical offset after scrolling a control into view.
  const verticalRoundingTolerance = 0.5;
  return { selector, box, rendered: box.width > 0 && box.height > 0, unclipped: box.x >= 0 && box.y >= -verticalRoundingTolerance && box.x + box.width <= page.viewportSize().width && box.y + box.height <= page.viewportSize().height + verticalRoundingTolerance, ...hit };
}

async function observeEditorUsability(editor) {
  return editor.evaluate((element) => {
    const editorBox = element.getBoundingClientRect(); const line = element.querySelector(".view-line"); const lineBox = line && line.getBoundingClientRect(); const parsedLineHeight = line ? Number.parseFloat(getComputedStyle(line).lineHeight) : Number.NaN;
    const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : lineBox && lineBox.height;
    return { box: { x: editorBox.x, y: editorBox.y, width: editorBox.width, height: editorBox.height }, lineCount: element.querySelectorAll(".view-line").length, line: lineBox && { x: lineBox.x, y: lineBox.y, width: lineBox.width, height: lineBox.height, lineHeight, complete: Boolean(lineBox.width > 0 && lineBox.height >= lineHeight && lineBox.y >= editorBox.y && lineBox.y + lineBox.height <= editorBox.y + editorBox.height) } };
  });
}

async function observeCollapsedSpine(spine) {
  return spine.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const label = [...element.querySelectorAll("span")].find(node => node.textContent.trim() === "Show task");
    const chevron = element.querySelector("svg");
    const labelBox = label && label.getBoundingClientRect();
    const labelStyle = label && getComputedStyle(label);
    const chevronStyle = chevron && getComputedStyle(chevron);
    const style = getComputedStyle(element);
    const samplePoints = [
      [box.left + box.width / 2, box.top + box.height / 2],
      [box.left + Math.min(8, box.width / 2), box.top + box.height / 2],
      [box.left + box.width / 2, box.top + Math.min(8, box.height / 2)],
    ];
    return {
      box: {x: box.x, y: box.y, width: box.width, height: box.height},
      centered: labelBox ? {
        horizontal: Math.abs((labelBox.left + labelBox.right) / 2 - (box.left + box.right) / 2),
        vertical: Math.abs((labelBox.top + labelBox.bottom) / 2 - (box.top + box.bottom) / 2),
      } : null,
      labelTransform: labelStyle && labelStyle.transform,
      chevronTransform: chevronStyle && chevronStyle.transform,
      backgroundImage: style.backgroundImage,
      labelCount: label ? 1 : 0,
      chevronCount: chevron ? 1 : 0,
      fullSurfaceHits: samplePoints.every(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return hit === element || element.contains(hit);
      }),
      focusVisible: element.matches(":focus-visible"),
    };
  });
}

async function observe(name, width, height) {
  let browser; let context;
  try {
    browser = await playwright.chromium.launch({ channel: "chrome", headless: true });
    context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const consoleErrors = []; const pageErrors = []; const localRequestFailures = []; const localHttpFailures = []; const faviconExceptions = [];
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("requestfailed", request => { if (request.url().startsWith(baseUrl)) localRequestFailures.push({ url: request.url(), failure: request.failure() }); });
    page.on("response", response => { if (!response.url().startsWith(baseUrl) || response.status() < 400) return; const failure = { url: response.url(), status: response.status() }; if (new URL(response.url()).pathname === "/favicon.ico") faviconExceptions.push(failure); else localHttpFailures.push(failure); });
    const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const description = page.locator("pre[aria-label]").first(); const editor = page.locator(".monaco-editor").first(); const previous = page.locator("button[aria-label='Task: Показано описание']"); const next = page.locator("button[aria-label='Test Code']");
    await description.waitFor({ state: "visible", timeout: 10000 }); await editor.waitFor({ state: "visible", timeout: 10000 }); await previous.waitFor({ state: "visible", timeout: 10000 }); await next.waitFor({ state: "visible", timeout: 10000 });
    const controls = [
      ["static task ordinal", "text=TASK 01", page.getByText("TASK 01", {exact: true})],
      ["static task title", "h1", page.getByRole("heading", {name: initialTask.title, level: 1, exact: true})],
      ["minimize", "button[aria-label='Hide task: Свернуть панель']", page.locator("button[aria-label='Hide task: Свернуть панель']")],
      ["description tab", "button[aria-label='Task: Показано описание']", previous],
      ["solution tab", "button[aria-label='Give up: Показать решение']", page.locator("button[aria-label='Give up: Показать решение']")],
      ["hint", "button[aria-label='Hint: Показать подсказки']", page.locator("button[aria-label='Hint: Показать подсказки']")],
      ["Test Code", "button[aria-label='Test Code']", next],
      ["Run Code", "button[aria-label='Run Code']", page.locator("button[aria-label='Run Code']")]
    ];
    const hideTask = page.locator("button[aria-label='Hide task: Свернуть панель']");
    const headerArrows = {
      previous: page.getByRole("button", {name: "Select previous task", includeHidden: true}),
      next: page.getByRole("button", {name: "Select next task", includeHidden: true}),
    };
    const visibleHeaderArrows = {
      previous: page.getByRole("button", {name: "Select previous task"}),
      next: page.getByRole("button", {name: "Select next task"}),
    };
    const descriptionCount = await description.count();
    const controlReachability = {}; const controlInventory = {}; for (const [name, selector, locator] of controls) { controlInventory[name] = { selector, count: await locator.count() }; controlReachability[name] = await observeReachability(page, selector, locator); }
    await hideTask.click();
    const restore = page.getByRole("button", {name: "Show task", exact: true});
    await restore.waitFor({state: "visible", timeout: 10_000});
    const taskPanel = page.locator("#taskPanelContent");
    const collapsedPanel = page.locator("[data-task-collapsed='true']");
    await restore.scrollIntoViewIfNeeded();
    const restoreBox = await restore.boundingBox();
    assert.ok(restoreBox, "Show task must have a box for an edge pointer activation");
    await page.mouse.click(restoreBox.x + Math.min(8, restoreBox.width / 2), restoreBox.y + restoreBox.height / 2);
    await hideTask.waitFor({state: "visible", timeout: 10_000});
    const mouseExpansion = {ariaExpanded: await hideTask.getAttribute("aria-expanded")};
    await hideTask.click();
    await restore.waitFor({state: "visible", timeout: 10_000});
    await restore.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const restoreControl = {
      selector: "button[aria-label='Show task'][aria-controls='taskPanelContent'][aria-expanded='false']",
      count: await restore.count(),
      reachability: await observeReachability(page, "Show task", restore),
      spine: await observeCollapsedSpine(restore),
      collapsedPanelCount: await collapsedPanel.count(),
      panel: {ariaHidden: await taskPanel.getAttribute("aria-hidden"), inert: await taskPanel.evaluate(element => element.hasAttribute("inert"))},
      keyboardFocus: await restore.evaluate(element => element === document.activeElement),
      textureStatus: await page.evaluate(async () => Promise.all([
        fetch("/task-spine/book-spine-desktop.png").then(response => response.status),
        fetch("/task-spine/book-spine-mobile.png").then(response => response.status),
      ])),
    };
    await restore.press("Enter");
    await hideTask.waitFor({state: "visible", timeout: 10_000});
    const enterExpansion = {
      focusOnHide: await hideTask.evaluate(element => element === document.activeElement),
      ariaExpanded: await hideTask.getAttribute("aria-expanded"),
      panel: {ariaHidden: await taskPanel.getAttribute("aria-hidden"), inert: await taskPanel.evaluate(element => element.hasAttribute("inert"))},
    };
    await hideTask.press("Space");
    await restore.waitFor({state: "visible", timeout: 10_000});
    const spaceCollapse = {focusOnShow: await restore.evaluate(element => element === document.activeElement)};
    await restore.press("Space");
    await hideTask.waitFor({state: "visible", timeout: 10_000});
    const spaceExpansion = {focusOnHide: await hideTask.evaluate(element => element === document.activeElement)};
    await previous.waitFor({state: "visible", timeout: 10_000});
    const arrowInventory = {previous: await visibleHeaderArrows.previous.count(), next: await visibleHeaderArrows.next.count()};
    const arrowsExpected = width <= 430 || width > 600;
    const arrowReachability = arrowsExpected ? {
      previous: await observeReachability(page, "Select previous task", headerArrows.previous),
      next: await observeReachability(page, "Select next task", headerArrows.next),
    } : null;
    const observation = { app: "cattasks", viewport: { name, width, height }, status: response && response.status(), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), requiredContent: { descriptionLength: descriptionCount ? (await description.innerText()).trim().length : 0, editorVisible: await editor.isVisible(), previousVisible: await previous.isVisible(), nextVisible: await next.isVisible(), staticIdentity: { ordinalCount: await page.getByText("TASK 01", {exact: true}).count(), titleCount: await page.getByRole("heading", {name: initialTask.title, level: 1, exact: true}).count(), retiredComboboxCount: await page.getByRole("combobox").count() }, arrowInventory, productControlInventory: controlInventory, restoreControl, mouseExpansion, enterExpansion, spaceCollapse, spaceExpansion }, reachability: { description: await observeReachability(page, "pre[aria-label]", description), editor: await observeReachability(page, ".monaco-editor", editor), arrows: arrowReachability, controls: controlReachability }, editorUsability: await observeEditorUsability(editor), consoleErrors, pageErrors, localRequestFailures, localHttpFailures, faviconExceptions };
    const screenshot = artifactPath(name, "png"); const json = artifactPath(name, "json");
    if (screenshot && json) { await page.screenshot({ path: screenshot, fullPage: true }); fs.writeFileSync(json, `${JSON.stringify(observation, null, 2)}\n`, { flag: "wx" }); }
    return observation;
  } finally { if (context) await context.close(); if (browser) await browser.close(); }
}

for (const [name, width, height] of viewports) test(`CatTasks initial dashboard controls, description, and editor are reachable at ${width}px`, async () => {
  const observation = await observe(name, width, height);
  assert.equal(observation.status, 200); assert.ok(observation.requiredContent.descriptionLength > 0); assert.equal(observation.requiredContent.editorVisible, true);
  assert.deepEqual(observation.requiredContent.staticIdentity, {ordinalCount: 1, titleCount: 1, retiredComboboxCount: 0}, "the report retains static identity and no retired header combobox");
  const expectedArrowCount = observation.viewport.width <= 430 || observation.viewport.width > 600 ? 1 : 0;
  assert.deepEqual(observation.requiredContent.arrowInventory, {previous: expectedArrowCount, next: expectedArrowCount}, "header arrows are present on the approved small-mobile and desktop ranges only");
  for (const [name, inventory] of Object.entries(observation.requiredContent.productControlInventory)) assert.equal(inventory.count, 1, `${name} must have exactly one product control (${inventory.selector})`);
  assert.equal(observation.requiredContent.restoreControl.count, 1, `Show task must expose one control (${observation.requiredContent.restoreControl.selector})`);
  for (const [property, expected] of Object.entries({rendered: true, unclipped: true, receivesPointer: true})) assert.equal(observation.requiredContent.restoreControl.reachability[property], expected, `Show task must remain ${property} after Hide task`);
  assert.equal(observation.requiredContent.restoreControl.collapsedPanelCount, 1, "the collapsed state identifies one task panel rail");
  assert.deepEqual(observation.requiredContent.restoreControl.panel, {ariaHidden: "true", inert: true}, "collapsed content stays mounted, hidden and inert");
  assert.deepEqual(observation.requiredContent.mouseExpansion, {ariaExpanded: "true"}, "an edge click on the full Show task spine reopens the task");
  assert.equal(observation.requiredContent.restoreControl.keyboardFocus, true, "Tab returns focus to Show task with a visible focus indicator");
  assert.deepEqual(observation.requiredContent.restoreControl.textureStatus, [200, 200], "both supplied spine textures load from the application");
  const spine = observation.requiredContent.restoreControl.spine;
  assert.deepEqual({labelCount: spine.labelCount, chevronCount: spine.chevronCount, fullSurfaceHits: spine.fullSurfaceHits, focusVisible: spine.focusVisible}, {labelCount: 1, chevronCount: 1, fullSurfaceHits: true, focusVisible: true}, "Show task keeps DOM label, independent chevron, focus and full-surface pointer hits");
  assert.ok(spine.centered && spine.centered.horizontal <= 1 && spine.centered.vertical <= 1, "Show task label stays centered to within one CSS pixel");
  if (observation.viewport.width > 1150) {
    assert.ok(spine.box.width >= 80 && spine.box.width <= 100 && spine.box.height >= 300, "desktop Show task uses the approved narrow vertical spine");
    assert.match(spine.labelTransform, /^matrix\(0, -?1, 1, 0,/, "desktop Show task label is rotated vertically");
    assert.doesNotMatch(spine.chevronTransform, /^matrix\(0, [+-]?1,/, "desktop Show task chevron faces right independently");
  } else {
    assert.ok(spine.box.width >= observation.viewport.width - 40 && spine.box.height >= 56 && spine.box.height <= 64, "stacked Show task uses the horizontal mobile spine");
    assert.doesNotMatch(spine.labelTransform, /^matrix\(0, [+-]?1,/, "mobile Show task label stays horizontal");
    assert.match(spine.chevronTransform, /^matrix\(0, [+-]?1,/, "mobile Show task chevron faces down");
  }
  assert.deepEqual(observation.requiredContent.enterExpansion, {focusOnHide: true, ariaExpanded: "true", panel: {ariaHidden: "false", inert: false}}, "Enter expands the task and transfers focus to Hide task");
  assert.deepEqual(observation.requiredContent.spaceCollapse, {focusOnShow: true}, "Space collapses the task and returns focus to Show task");
  assert.deepEqual(observation.requiredContent.spaceExpansion, {focusOnHide: true}, "Space expands the task and transfers focus to Hide task");
  for (const [name, result] of Object.entries({ description: observation.reachability.description, editor: observation.reachability.editor, ...observation.reachability.controls })) { assert.equal(result.rendered, true, `${name} must render`); assert.equal(result.unclipped, true, `${name} must not be clipped`); assert.equal(result.receivesPointer, true, `${name} must receive pointer hits without another initial-screen layer occluding it`); }
  if (observation.reachability.arrows) for (const [name, result] of Object.entries(observation.reachability.arrows)) { assert.equal(result.rendered, true, `${name} arrow must render`); assert.equal(result.unclipped, true, `${name} arrow must not be clipped`); assert.equal(result.receivesPointer, true, `${name} arrow must receive pointer hits`); }
  assert.ok(observation.editorUsability.box.height >= 240, "the initial editor must retain the approved 240px usable height"); assert.ok(observation.editorUsability.lineCount >= 1, "the editor must contain at least one rendered source line"); assert.equal(observation.editorUsability.line && observation.editorUsability.line.complete, true, "at least one complete editor line must fit inside the editor viewport");
  assert.deepEqual(observation.pageErrors, []); assert.deepEqual(observation.consoleErrors, []); assert.deepEqual(observation.localRequestFailures, []); assert.deepEqual(observation.localHttpFailures, []); assert.equal(observation.scrollWidth, observation.clientWidth);
});
