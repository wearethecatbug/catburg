const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43814";
const artifactDirectory = process.env.REGRESSION_ARTIFACT_DIR;
const artifactLabel = process.env.REGRESSION_RUN_LABEL;
const viewports = [["mobile-320", 320, 844], ["mobile-390", 390, 844], ["desktop-1440", 1440, 900]];

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
  return { selector, box, rendered: box.width > 0 && box.height > 0, unclipped: box.x >= 0 && box.y >= 0 && box.x + box.width <= page.viewportSize().width && box.y + box.height <= page.viewportSize().height, ...hit };
}

async function observeEditorUsability(editor) {
  return editor.evaluate((element) => {
    const editorBox = element.getBoundingClientRect(); const line = element.querySelector(".view-line"); const lineBox = line && line.getBoundingClientRect(); const parsedLineHeight = line ? Number.parseFloat(getComputedStyle(line).lineHeight) : Number.NaN;
    const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : lineBox && lineBox.height;
    return { box: { x: editorBox.x, y: editorBox.y, width: editorBox.width, height: editorBox.height }, lineCount: element.querySelectorAll(".view-line").length, line: lineBox && { x: lineBox.x, y: lineBox.y, width: lineBox.width, height: lineBox.height, lineHeight, complete: Boolean(lineBox.width > 0 && lineBox.height >= lineHeight && lineBox.y >= editorBox.y && lineBox.y + lineBox.height <= editorBox.y + editorBox.height) } };
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
    const description = page.locator("pre[aria-label]").first(); const editor = page.locator(".monaco-editor").first(); const previous = page.locator("button[aria-label='Показано описание']"); const next = page.locator("button[aria-label='Test Code']");
    await description.waitFor({ state: "visible", timeout: 10000 }); await editor.waitFor({ state: "visible", timeout: 10000 }); await previous.waitFor({ state: "visible", timeout: 10000 }); await next.waitFor({ state: "visible", timeout: 10000 });
    const controls = [
      ["header previous arrow", "button[class*='arrowLeft']", page.locator("button[class*='arrowLeft']")],
      ["clear task selection", "button[aria-label='Очистить выбор задачи']", page.locator("button[aria-label='Очистить выбор задачи']")],
      ["header next arrow", "button[class*='arrowRight']", page.locator("button[class*='arrowRight']")],
      ["minimize", "button[aria-label='Свернуть панель']", page.locator("button[aria-label='Свернуть панель']")],
      ["description tab", "button[aria-label='Показано описание']", previous],
      ["solution tab", "button[aria-label='Показать решение']", page.locator("button[aria-label='Показать решение']")],
      ["information", "button[aria-label='Показать информацию']", page.locator("button[aria-label='Показать информацию']")],
      ["Test Code", "button[aria-label='Test Code']", next],
      ["Run Code", "button[aria-label='Run Code']", page.locator("button[aria-label='Run Code']")]
    ];
    const taskListInput = page.locator("input[placeholder='Список задач...']");
    const descriptionCount = await description.count();
    const controlReachability = {}; const controlInventory = {}; for (const [name, selector, locator] of controls) { controlInventory[name] = { selector, count: await locator.count() }; controlReachability[name] = await observeReachability(page, selector, locator); }
    const observation = { app: "cattasks", viewport: { name, width, height }, status: response && response.status(), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), requiredContent: { descriptionLength: descriptionCount ? (await description.innerText()).trim().length : 0, editorVisible: await editor.isVisible(), previousVisible: await previous.isVisible(), nextVisible: await next.isVisible(), taskListInputCount: await taskListInput.count(), productControlInventory: controlInventory }, reachability: { description: await observeReachability(page, "pre[aria-label]", description), editor: await observeReachability(page, ".monaco-editor", editor), taskListInput: await observeReachability(page, "input[placeholder='Список задач...']", taskListInput), controls: controlReachability }, editorUsability: await observeEditorUsability(editor), consoleErrors, pageErrors, localRequestFailures, localHttpFailures, faviconExceptions };
    const screenshot = artifactPath(name, "png"); const json = artifactPath(name, "json");
    if (screenshot && json) { await page.screenshot({ path: screenshot, fullPage: true }); fs.writeFileSync(json, `${JSON.stringify(observation, null, 2)}\n`, { flag: "wx" }); }
    return observation;
  } finally { if (context) await context.close(); if (browser) await browser.close(); }
}

for (const [name, width, height] of viewports) test(`CatTasks initial dashboard controls, description, and editor are reachable at ${width}px`, async () => {
  const observation = await observe(name, width, height);
  assert.equal(observation.status, 200); assert.ok(observation.requiredContent.descriptionLength > 0); assert.equal(observation.requiredContent.editorVisible, true);
  assert.equal(observation.requiredContent.taskListInputCount, 1, "the current task selector has exactly one public input");
  for (const [name, inventory] of Object.entries(observation.requiredContent.productControlInventory)) assert.equal(inventory.count, 1, `${name} must have exactly one product control (${inventory.selector})`);
  for (const [name, result] of Object.entries({ description: observation.reachability.description, editor: observation.reachability.editor, taskListInput: observation.reachability.taskListInput, ...observation.reachability.controls })) { assert.equal(result.rendered, true, `${name} must render`); assert.equal(result.unclipped, true, `${name} must not be clipped`); assert.equal(result.receivesPointer, true, `${name} must receive pointer hits without another initial-screen layer occluding it`); }
  assert.ok(observation.editorUsability.box.height >= 240, "the initial editor must retain the approved 240px usable height"); assert.ok(observation.editorUsability.lineCount >= 1, "the editor must contain at least one rendered source line"); assert.equal(observation.editorUsability.line && observation.editorUsability.line.complete, true, "at least one complete editor line must fit inside the editor viewport");
  assert.deepEqual(observation.pageErrors, []); assert.deepEqual(observation.consoleErrors, []); assert.deepEqual(observation.localRequestFailures, []); assert.deepEqual(observation.localHttpFailures, []); assert.equal(observation.scrollWidth, observation.clientWidth);
});
