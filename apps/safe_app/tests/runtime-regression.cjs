const assert = require("node:assert/strict");
const fileSystem = require("node:fs");
const pathUtilities = require("node:path");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.SAFE_CAT_BASE_URL || "http://127.0.0.1:43813";
const artifactDirectory = process.env.REGRESSION_ARTIFACT_DIR;
const artifactLabel = process.env.REGRESSION_RUN_LABEL;
const viewports = [["mobile-320", 320, 844], ["mobile-390", 390, 844], ["desktop-1440", 1440, 900]];
const documentBottomToleranceCssPixels = 1;

function artifactPath(name, extension) {
  if (!artifactDirectory) return undefined;
  assert.ok(artifactLabel, "REGRESSION_RUN_LABEL is required when artifacts are enabled");
  assert.ok(fileSystem.statSync(artifactDirectory).isDirectory(), "REGRESSION_ARTIFACT_DIR must be an existing directory");
  const output = pathUtilities.join(artifactDirectory, `${artifactLabel}-safe-cat-${name}.${extension}`);
  assert.equal(fileSystem.existsSync(output), false, `refusing to overwrite existing regression artifact: ${output}`);
  return output;
}

function isAtDocumentBottom(documentMetrics) {
  return Math.abs(documentMetrics.scrollHeight - documentMetrics.clientHeight - documentMetrics.scrollTop) <= documentBottomToleranceCssPixels;
}

function isReachableInViewport(box, viewport, documentMetrics) {
  const verticalOverflow = box.y + box.height - viewport.height;
  return box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && (verticalOverflow <= 0 || (verticalOverflow <= documentBottomToleranceCssPixels && isAtDocumentBottom(documentMetrics)));
}

async function observeReachability(page, selector, locator) {
  if (await locator.count() !== 1) return { selector, rendered: false, unclipped: false, receivesPointer: false };
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return { selector, rendered: false, unclipped: false, receivesPointer: false };
  const hit = await locator.evaluate((element) => { const boundingRectangle = element.getBoundingClientRect(); const target = document.elementFromPoint(boundingRectangle.left + boundingRectangle.width / 2, boundingRectangle.top + boundingRectangle.height / 2); return { receivesPointer: target === element || element.contains(target), target: target && { tag: target.tagName, id: target.id, className: String(target.className) }, text: (element.innerText || "").trim(), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }; });
  const documentMetrics = await page.evaluate(() => { const scrolling = document.scrollingElement; return { scrollHeight: scrolling.scrollHeight, clientHeight: scrolling.clientHeight, scrollTop: scrolling.scrollTop }; });
  const viewport = page.viewportSize(); const verticalOverflow = box.y + box.height - viewport.height;
  return { selector, box, documentMetrics, verticalOverflow, rendered: box.width > 0 && box.height > 0, strictlyWithinViewport: box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, unclipped: isReachableInViewport(box, viewport, documentMetrics), ...hit };
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
    const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
    const instruction = page.getByText("Enter a whole code from 1 to 1000.", { exact: true });
    const input = page.getByLabel("Safe code", { exact: true }); const ok = page.getByRole("button", { name: "OK", exact: true });
    const buttonNames = ["New game", "Give up", "Show hint", "History"]; const buttons = buttonNames.map(name => page.getByRole("button", { name, exact: true }));
    const cat = page.getByLabel("Cat idle", { exact: true });
    await instruction.waitFor(); await input.waitFor(); await ok.waitFor(); await cat.waitFor(); for (const button of buttons) await button.waitFor();
    await input.focus(); await input.fill("1000"); await cat.hover(); await page.mouse.move(0, 0);
    const buttonReachability = []; for (let index = 0; index < buttons.length; index += 1) buttonReachability.push(await observeReachability(page, `button with accessible name ${buttonNames[index]}`, buttons[index]));
    const observation = { app: "safe-cat", viewport: { name, width, height }, status: response && response.status(), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), requiredContent: { instructionVisible: await instruction.isVisible(), inputVisible: await input.isVisible(), inputEnabled: await input.isEnabled(), inputValue: await input.inputValue(), menuButtonCount: buttons.length, menuButtonSelectorCounts: await Promise.all(buttons.map(button => button.count())), okButtonCount: await ok.count() }, reachability: { instruction: await observeReachability(page, "instruction labelled Enter a whole code from 1 to 1000.", instruction), input: await observeReachability(page, "input labelled Safe code", input), ok: await observeReachability(page, "button with accessible name OK", ok), buttons: buttonReachability }, consoleErrors, pageErrors, localRequestFailures, localHttpFailures, faviconExceptions };
    const screenshot = artifactPath(name, "png"); const json = artifactPath(name, "json");
    if (screenshot && json) { await page.screenshot({ path: screenshot, fullPage: true }); fileSystem.writeFileSync(json, `${JSON.stringify(observation, null, 2)}\n`, { flag: "wx" }); }
    return observation;
  } finally { if (context) await context.close(); if (browser) await browser.close(); }
}

for (const [name, width, height] of viewports) test(`Safe Cat initial screen and actual cat hover/leave are runtime-safe and reachable at ${width}px`, async () => {
  const observation = await observe(name, width, height);
  assert.equal(observation.status, 200); assert.equal(observation.requiredContent.instructionVisible, true); assert.equal(observation.requiredContent.inputVisible, true); assert.equal(observation.requiredContent.inputEnabled, true); assert.equal(observation.requiredContent.inputValue, "1000", "the published 1..1000 range must fit without submitting a guess"); assert.equal(observation.requiredContent.okButtonCount, 1, "the initial Safe Cat screen has exactly one OK control");
  for (const count of observation.requiredContent.menuButtonSelectorCounts) assert.equal(count, 1, "each initial Safe Cat menu control must have exactly one public selector match");
  for (const [name, result] of Object.entries({ instruction: observation.reachability.instruction, input: observation.reachability.input, ok: observation.reachability.ok })) { assert.equal(result.rendered, true, `${name} must render`); assert.equal(result.unclipped, true, `${name} must not be clipped`); assert.equal(result.receivesPointer, true, `${name} must receive pointer hits`); }
  assert.equal(observation.reachability.ok.text, "OK", "the OK control must expose its real label"); assert.ok(observation.reachability.ok.scrollWidth <= observation.reachability.ok.clientWidth, "the complete OK label must fit its control"); assert.ok(observation.reachability.input.scrollWidth <= observation.reachability.input.clientWidth, "the four-digit input value must fit its control");
  for (const result of [...Object.values({ instruction: observation.reachability.instruction, input: observation.reachability.input, ok: observation.reachability.ok }), ...observation.reachability.buttons]) {
    assert.equal(result.rendered, true, "required control must render"); assert.equal(result.unclipped, true, "required control must not be clipped"); assert.equal(result.receivesPointer, true, "required control must receive pointer hits");
    const onePixelOutside = { ...result.box, y: observation.viewport.height - result.box.height + 0.5 };
    const beyondTolerance = { ...result.box, y: observation.viewport.height - result.box.height + documentBottomToleranceCssPixels + 0.01 };
    const notAtDocumentBottom = { ...result.documentMetrics, scrollTop: result.documentMetrics.scrollTop - documentBottomToleranceCssPixels - 1 };
    assert.equal(isReachableInViewport(beyondTolerance, observation.viewport, result.documentMetrics), false, "more than one CSS pixel of bottom clipping must fail even at the document boundary");
    assert.equal(isReachableInViewport(onePixelOutside, observation.viewport, notAtDocumentBottom), false, "a bottom-overflowing box must fail away from the document scroll boundary");
    if (result.verticalOverflow > 0) { assert.equal(isAtDocumentBottom(result.documentMetrics), true, "a bottom-overflowing required control is acceptable only at the document scroll boundary"); assert.ok(result.verticalOverflow <= documentBottomToleranceCssPixels, "the document-boundary tolerance is at most one CSS pixel"); }
  }
  assert.deepEqual(observation.pageErrors, []); assert.deepEqual(observation.consoleErrors, []); assert.deepEqual(observation.localRequestFailures, []); assert.deepEqual(observation.localHttpFailures, []); assert.equal(observation.scrollWidth, observation.clientWidth);
});
