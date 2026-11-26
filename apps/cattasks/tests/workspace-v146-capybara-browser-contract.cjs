const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

// Independent public-contract oracle for CAP-01…05.  It intercepts only the
// catalogue with inert data and never activates either code-execution control.
const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43960";
const widths = [320, 360, 430, 622, 623, 700, 834, 933, 1040, 1160, 1280, 1440, 1600];
const thresholdWidths = [288, 620, 621, 622, 623, 624];
const expectedBaseline = {288: 168, 320: 168, 360: 168, 430: 168, 622: 226.45972478867577, 623: 226.58704073384496, 834: 252.6669758, 933: 263.9989457, 1040: 278, 1160: 278, 1280: 278, 1440: 278, 1600: 278};
const expectedSlot = {288: 183, 320: 184, 360: 184, 430: 185, 622: 272, 623: 272, 834: 298, 933: 309, 1040: 323, 1160: 323, 1280: 323, 1440: 323, 1600: 323};
const longTitle = "A deliberately long inert Capybara fixture title must not cover live navigation or the real task workspace";
const catalog = {version: 1, tasks: [
  {id: "short", title: "Short fixture", description: "Inert browser fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "long", title: longTitle, description: "Inert browser fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  ...Array.from({length: 12}, (_, index) => ({id: `scroll-${index}`, title: `Scroll fixture ${index + 1}`, description: "Inert browser fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]})),
]};

const near = (actual, expected, message, epsilon = 3) => assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, received ${actual}`);
const edges = box => ({left: box.left ?? box.x, right: box.right ?? box.x + box.width, top: box.top ?? box.y, bottom: box.bottom ?? box.y + box.height});
const intersects = (a, b) => { const x = edges(a); const y = edges(b); return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top; };

async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
}

async function prepare(page) {
  const diagnostics = {console: [], page: [], failed: [], responses: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.failed.push(`${request.method()} ${request.url()}`));
  page.on("response", response => { if (response.status() >= 400) diagnostics.responses.push(`${response.status()} ${response.url()}`); });
  await page.route("**/task-catalog.v1.json", route => route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}));
  const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
  assert.equal(response?.status(), 200, "the isolated loopback dashboard loads");
  await page.getByRole("button", {name: /Choose theme.*current:/i}).waitFor({state: "visible"});
  await page.locator(".monaco-editor").first().waitFor({state: "visible"});
  await settle(page);
  return diagnostics;
}

async function chooseTheme(page, name) {
  const trigger = page.getByRole("button", {name: /Choose theme.*current:/i});
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  const group = page.getByRole("group", {name: "Themes", exact: true});
  await group.waitFor({state: "visible"});
  await group.getByRole("button", {name, exact: true}).click();
  await page.locator(`[data-cattasks-theme='${name.toLowerCase()}']`).waitFor({state: "visible"});
  await settle(page);
}

async function setOwnerWidth(page, width) {
  let requested = width;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    assert.equal(await page.locator("[data-cattasks-workspace]").count(), 1, "Capybara exposes one public measured workspace root before owner-width calibration");
    await page.evaluate(next => {
      const workspace = document.querySelector("[data-cattasks-workspace]");
      if (!workspace?.parentElement) throw new Error("public workspace root has no owning container");
      Object.assign(workspace.parentElement.style, {inlineSize: `${next}px`, maxInlineSize: `${next}px`, minInlineSize: "0px", marginInline: "0px"});
    }, requested);
    await settle(page);
    const actual = await page.locator("[data-cattasks-workspace]").evaluate(node => node.getBoundingClientRect().width);
    if (Math.abs(actual - width) <= 2) return actual;
    requested += width - actual;
  }
  throw new Error(`workspace owner did not calibrate to ${width}px`);
}

async function frame(page) {
  return page.evaluate(() => {
    const visible = node => { const style = getComputedStyle(node); const box = node.getBoundingClientRect(); return style.display !== "none" && style.visibility !== "hidden" && !node.closest("[hidden]") && box.width > 0 && box.height > 0; };
    const workspace = document.querySelector("[data-cattasks-workspace]");
    const header = [...document.querySelectorAll("[data-cattasks-header]")].find(visible);
    const content = [...document.querySelectorAll("[data-cattasks-workspace-content]")].find(visible);
    if (!workspace || !header || !content) throw new Error("Capybara public workspace/header/content contract is incomplete");
    const rect = node => { const r = node.getBoundingClientRect(); return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height}; };
    return {workspace: rect(workspace), header: rect(header), content: rect(content), measured: Number(workspace.getAttribute("data-cattasks-workspace")), baseline: Number(workspace.getAttribute("data-header-baseline")), slot: Number.parseFloat(getComputedStyle(workspace).getPropertyValue("--workspace-header-slot")), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth};
  });
}

async function assertFrame(page, width, label) {
  const value = await frame(page);
  near(value.workspace.width, width, `${label} uses measured owner width`);
  near(value.measured, Math.floor(value.workspace.width), `${label} exposes measured width`, 1);
  for (const [name, rect] of [["header", value.header], ["content", value.content]]) {
    near(rect.left, value.workspace.left, `${label} ${name} shares workspace left`);
    near(rect.right, value.workspace.right, `${label} ${name} shares workspace right`);
  }
  // The semantic header may contain supports below the visual shelf.  The
  // exported baseline and slot, not the element's painted bottom, govern the
  // common workspace/body contract.
  assert.ok(value.baseline > 0 && value.slot > 0, `${label} exports positive v146 baseline and workspace slot`);
  near(value.content.top, value.workspace.top + value.slot, `${label} work body starts at the exported workspace slot`);
  assert.equal(value.overflow, 0, `${label} has no horizontal document overflow`);
  if (expectedBaseline[width] !== undefined) {
    near(value.baseline, expectedBaseline[width], `${label} preserves v146 source baseline`);
    near(value.slot, expectedSlot[width], `${label} preserves v146 source slot including support rail`);
  }
  return value;
}

async function assertLiveControl(page, name, label) {
  const control = page.getByRole("button", {name, exact: true});
  const box = await control.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 40, `${label} ${name} has a reachable hit area`);
  const pointOwner = await control.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return Boolean(hit && (hit === node || node.contains(hit)));
  });
  assert.equal(pointOwner, true, `${label} ${name} receives its physical center point`);
  return {control, box};
}

async function assertTaskControls(page, label) {
  const back = await assertLiveControl(page, "All tasks", label);
  const previous = await assertLiveControl(page, "Select previous task", label);
  const next = await assertLiveControl(page, "Select next task", label);
  const heading = page.getByRole("heading").first();
  const headingBox = await heading.boundingBox();
  assert.ok(headingBox && !intersects(headingBox, back.box) && !intersects(headingBox, previous.box) && !intersects(headingBox, next.box), `${label} title remains clear of live navigation hit areas`);
  return back.control;
}

async function assertVisibleAsset(page, leaf, label) {
  const evidence = await page.evaluate(expectedLeaf => {
    const visible = node => { const style = getComputedStyle(node); const rect = node.getBoundingClientRect(); return style.display !== "none" && style.visibility !== "hidden" && !node.closest("[hidden]") && rect.width > 0 && rect.height > 0; };
    const candidates = [];
    for (const image of document.images) {
      const url = image.currentSrc || image.src;
      if (url.includes(expectedLeaf) && visible(image)) candidates.push({kind: "img", url, rect: image.getBoundingClientRect().toJSON(), loaded: image.complete && image.naturalWidth > 0});
    }
    const matcher = /url\(["']?([^"')]+)["']?\)/g;
    for (const node of document.querySelectorAll("[data-cattasks-header], [data-cattasks-header] *")) {
      for (const pseudo of [undefined, "::before", "::after"]) {
        const background = getComputedStyle(node, pseudo).backgroundImage;
        for (const match of background.matchAll(matcher)) {
          const url = new URL(match[1], document.baseURI).href;
          if (url.includes(expectedLeaf) && visible(node)) candidates.push({kind: pseudo || "background", url, rect: node.getBoundingClientRect().toJSON(), loaded: performance.getEntriesByName(url).length > 0});
        }
      }
    }
    return candidates;
  }, leaf);
  assert.ok(evidence.length > 0, `${label} exposes visible supplied ${leaf} art in the closed live header`);
  assert.ok(evidence.every(item => item.url.includes(`/cattasks/themes/capybara/${leaf}`)), `${label} uses only the approved Capybara URL for ${leaf}`);
  assert.ok(evidence.some(item => item.loaded), `${label} records a successfully loaded visible ${leaf} resource`);
}

async function assertCatalogueClearance(page, label) {
  const back = await assertLiveControl(page, "Back to task", label);
  const heading = page.getByRole("heading", {name: "All tasks", exact: true});
  const headingBox = await heading.boundingBox();
  assert.ok(headingBox && !intersects(headingBox, back.box), `${label} All tasks title remains clear of Back to task`);
  return back.control;
}

function assertDiagnostics(diagnostics) {
  assert.deepEqual(diagnostics, {console: [], page: [], failed: [], responses: []}, "inert browser contract leaves no diagnostics");
}

test("Capybara rectangle overlap helper rejects separated controls", () => {
  assert.equal(intersects({x: 0, y: 0, width: 20, height: 20}, {x: 19, y: 0, width: 20, height: 20}), true);
  assert.equal(intersects({x: 0, y: 0, width: 20, height: 20}, {x: 21, y: 0, width: 20, height: 20}), false);
});

test("Capybara Light and Dark share the v146 Task and All tasks envelope at every published width", {timeout: 240_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const theme of ["Light", "Dark"]) {
      await chooseTheme(page, theme);
      for (const width of widths) {
        await setOwnerWidth(page, width);
        await assertFrame(page, width, `${theme} Task ${width}px`);
        const allTasks = await assertTaskControls(page, `${theme} Task ${width}px`);
        await allTasks.click();
        await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
        await assertFrame(page, width, `${theme} All tasks ${width}px`);
        const back = await assertCatalogueClearance(page, `${theme} All tasks ${width}px`);
        await back.click();
        await page.getByRole("button", {name: "All tasks", exact: true}).waitFor({state: "visible"});
      }
      await setOwnerWidth(page, 430);
      await assertVisibleAsset(page, "fox-button-lean.webp", `${theme} Task 430px`);
      await setOwnerWidth(page, 1600);
      await assertVisibleAsset(page, "study-vignette.webp", `${theme} Task 1600px`);
      await assertVisibleAsset(page, "nook-vignette.webp", `${theme} Task 1600px`);
    }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("Capybara keeps common Khorne geometry and safe controls through the 622 to 623 transition", {timeout: 180_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const theme of ["Light", "Dark"]) {
      await chooseTheme(page, theme);
      const capybaraFrames = new Map();
      for (const width of thresholdWidths) {
        await setOwnerWidth(page, width);
        capybaraFrames.set(width, await assertFrame(page, width, `${theme} threshold ${width}px`));
        await assertTaskControls(page, `${theme} threshold ${width}px`);
      }
      const lower = capybaraFrames.get(622);
      const upper = capybaraFrames.get(623);
      assert.ok(Math.abs(lower.baseline - upper.baseline) <= 2, `${theme} holds the exported workspace baseline at 622→623`);
      assert.ok(Math.abs(lower.content.top - upper.content.top) <= 2, `${theme} holds the workspace start at 622→623`);
      for (const width of [288, 622, 623, 1600]) {
        await setOwnerWidth(page, width);
        const capybara = await assertFrame(page, width, `${theme} comparison ${width}px`);
        await chooseTheme(page, "Khorne");
        await setOwnerWidth(page, width);
        const khorne = await assertFrame(page, width, `Khorne comparison ${width}px`);
        near(capybara.workspace.width, khorne.workspace.width, `${theme} and Khorne share outer width at ${width}px`);
        near(capybara.baseline, khorne.baseline, `${theme} and Khorne share outer baseline at ${width}px`);
        near(capybara.content.top, khorne.content.top, `${theme} and Khorne share content start at ${width}px`);
        await chooseTheme(page, theme);
      }
    }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("Capybara theme changes keep the mounted dog and keyboard feeding without code execution", {timeout: 90_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Light");
    const strip = page.getByLabel("Pet feeding strip", {exact: true});
    const dog = strip.locator("[data-pet='dog']");
    const feed = strip.getByRole("button", {name: "Feed pet", exact: true});
    await dog.waitFor({state: "visible"});
    await feed.focus();
    assert.equal(await feed.evaluate(node => node === document.activeElement), true, "Feed is keyboard reachable before the theme change");
    await dog.evaluate(node => { node.dataset.capybaraOracleIdentity = "preserve"; });
    await chooseTheme(page, "Dark");
    assert.equal(await dog.getAttribute("data-capybara-oracle-identity"), "preserve", "theme change keeps the same mounted dog DOM node");
    await feed.focus();
    await feed.press("Enter");
    await strip.locator("[data-pet='food']").first().waitFor({state: "attached"});
    assert.equal(await strip.locator("[data-pet='food']").count(), 1, "one keyboard Feed action creates one food item after theme change");
    assert.equal(await feed.evaluate(node => node === document.activeElement), true, "Feed retains active keyboard ownership after Enter");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});
