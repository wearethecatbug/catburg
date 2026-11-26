const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

// Independent browser contract for the public construction chooser.  The only
// intercepted resource is an inert catalogue: this file never presses Test or
// Run and never executes fixture code.
const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43950";
const widths = [320, 360, 430, 622, 623, 700, 834, 933, 1040, 1160, 1280, 1440, 1600];
const themes = ["Khorne", "Nurgle"];
const constructions = ["Industrial", "Gothic", "Armor"];
// `responsive/layouts.json` from the SHA-verified v146 kit.  These are the
// artwork baseline values; the separate CSS support rail is +3px and is not
// part of this diagnostic baseline.
const v146Baseline = {320: 168, 360: 168, 430: 168, 622: 226.45972478867577, 623: 226.58704073384496, 700: 236.3903685, 834: 252.6669758, 933: 263.9989457, 1040: 278, 1160: 278, 1280: 278, 1440: 278, 1600: 278};
const v146WorkspaceSlot = {320: 184, 360: 184, 430: 185, 622: 272, 623: 272, 700: 282, 834: 298, 933: 309, 1040: 323, 1160: 323, 1280: 323, 1440: 323, 1600: 323};
const longTitle = "A deliberately long inert fixture title must not cover live construction or navigation controls";
const cyrillicTitle = "Съешь ещё этих мягких французских булок и проверь общую базовую линию";
const mergingIntervalsTitle = "Merging intervals while preserving the original array";
const catalog = {version: 1, tasks: [
  {id: "short", title: "Short", description: "Inert fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "cyrillic", title: cyrillicTitle, description: "Inert fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "long", title: longTitle, description: "Inert fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "literal-title", title: "<b>Markup</b> & literal", description: "Inert literal-title fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  ...Array.from({length: 15}, (_, index) => ({id: `scroll-${index}`, title: `Scroll fixture ${index + 1}`, description: "Inert scroll fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]})),
]};
const invalidCatalog = {...catalog, tasks: [{...catalog.tasks[0], title: ""}]};
const titleCatalog = {version: 1, tasks: [
  {id: "short", title: "Short", description: "Inert fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "merging-intervals", title: mergingIntervalsTitle, description: "Inert title-fit fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "tail", title: "Tail", description: "Inert fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
]};
const pathologicalCatalogueTitle = "A deliberately pathological title that is long enough to exhaust every permitted header-fitting step before the catalogue view is opened and must never leak its task-only clipping state into All tasks";
const catalogueResetCatalog = {version: 1, tasks: [
  {id: "short", title: "Short", description: "Inert fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "pathological", title: pathologicalCatalogueTitle, description: "Inert pathological fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "tail", title: "Tail", description: "Inert fixture.", entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["fixture"], expected: "fixture"}]},
]};

const near = (actual, expected, message, epsilon = 2) => assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, received ${actual}`);
const rectEdges = rect => "left" in rect
  ? rect
  : {left: rect.x, right: rect.x + rect.width, top: rect.y, bottom: rect.y + rect.height};
const intersects = (a, b) => {
  const first = rectEdges(a);
  const second = rectEdges(b);
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
};

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
}

async function prepare(page, payload = catalog, {waitForEditor = true} = {}) {
  const diagnostics = {console: [], page: [], failed: [], responses: [], assets: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.failed.push(request.url()));
  page.on("response", response => { if (response.status() >= 400) diagnostics.responses.push(`${response.status()} ${response.url()}`); });
  page.on("request", request => { if (request.resourceType() === "image") diagnostics.assets.push(request.url()); });
  await page.route("**/task-catalog.v1.json", route => route.fulfill({contentType: "application/json", body: JSON.stringify(payload)}));
  assert.equal((await page.goto(baseUrl, {waitUntil: "domcontentloaded"}))?.status(), 200, "the isolated loopback app loads");
  await page.getByRole("button", {name: /Choose theme.*current:/i}).waitFor({state: "visible"});
  if (waitForEditor) {
    await page.locator(".monaco-editor").first().waitFor({state: "visible"});
    await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));
  }
  await settle(page);
  return diagnostics;
}

async function chooseTheme(page, name) {
  const trigger = page.getByRole("button", {name: /Choose theme.*current:/i});
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  const themesGroup = page.getByRole("group", {name: "Themes", exact: true});
  await themesGroup.waitFor({state: "visible", timeout: 5_000});
  await themesGroup.getByRole("button", {name, exact: true}).click();
  await page.locator(`[data-cattasks-theme='${name.toLowerCase()}']`).waitFor({state: "visible"});
  await ensureConstructionGroup(page);
  await settle(page);
}

function constructionGroup(page) {
  return page.getByRole("group", {name: "Header construction", exact: true});
}

async function ensureConstructionGroup(page) {
  const trigger = page.getByRole("button", {name: /Choose theme.*current:/i});
  const group = constructionGroup(page);
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await group.waitFor({state: "visible", timeout: 5_000});
  return group;
}

async function closeChooser(page) {
  const trigger = page.getByRole("button", {name: /Choose theme.*current:/i});
  if ((await trigger.getAttribute("aria-expanded")) === "true") await trigger.click();
  await constructionGroup(page).waitFor({state: "hidden", timeout: 5_000});
}

async function chooseConstructionWithKeyboard(page, name) {
  const choice = (await ensureConstructionGroup(page)).getByRole("button", {name, exact: true});
  // Programmatic focus is only an anchor.  Chromium's focus-visible heuristic
  // deliberately does not promise a keyboard ring after a pointer modality,
  // so prove the public keyboard path by moving out and back with real keys.
  await choice.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  assert.equal(await choice.evaluate(node => node === document.activeElement), true, `${name} is reached again through real keyboard traversal`);
  assert.equal(await choice.evaluate(node => node.matches(":focus-visible")), true, `${name} exposes visible keyboard focus`);
  const outline = await choice.evaluate(node => {
    const style = getComputedStyle(node);
    return {style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth)};
  });
  assert.equal(outline.style, "solid", `${name} exposes a solid keyboard focus ring`);
  assert.ok(outline.width >= 3, `${name} exposes the promised >=3px keyboard focus ring`);
  await page.keyboard.press("Enter");
  await ensureConstructionGroup(page);
  await expectPressed(page, name);
  await settle(page);
}

async function expectPressed(page, selected) {
  for (const construction of constructions) {
    const option = constructionGroup(page).getByRole("button", {name: construction, exact: true});
    assert.equal(await option.getAttribute("aria-pressed"), String(construction === selected), `${construction} reports the selected construction truthfully`);
  }
}

async function assertConstructionHitTargets(page, viewport) {
  await page.setViewportSize(viewport);
  await settle(page);
  const group = await ensureConstructionGroup(page);
  for (const construction of constructions) {
    const box = await group.getByRole("button", {name: construction, exact: true}).boundingBox();
    assert.ok(box, `${construction} has a live construction target at ${viewport.width}×${viewport.height}`);
    assert.ok(box.width >= 44 && box.height >= 44, `${construction} is a >=44px live construction target at ${viewport.width}×${viewport.height} (measured ${box.width}×${box.height})`);
  }
}

async function setOwningContainerWidth(page, width) {
  let requested = width;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.evaluate(nextWidth => {
      const workspace = document.querySelector("[data-cattasks-workspace]");
      if (!workspace?.parentElement) throw new Error("workspace owner is unavailable");
      Object.assign(workspace.parentElement.style, {inlineSize: `${nextWidth}px`, maxInlineSize: `${nextWidth}px`, minInlineSize: "0px", marginInline: "0px"});
    }, requested);
    await settle(page);
    const actual = await page.locator("[data-cattasks-workspace]").evaluate(node => node.getBoundingClientRect().width);
    if (Math.abs(actual - width) <= 2) return actual;
    requested += width - actual;
  }
  throw new Error(`owning container did not calibrate to ${width}px`);
}

async function geometry(page) {
  return page.evaluate(() => {
    const visible = element => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && !element.closest("[hidden]") && box.width > 0 && box.height > 0;
    };
    const workspace = document.querySelector("[data-cattasks-workspace]");
    const header = [...document.querySelectorAll("[data-cattasks-header]")].find(visible);
    const content = [...document.querySelectorAll("[data-cattasks-workspace-content]")].find(visible);
    if (!workspace || !header || !content) throw new Error("measured workspace/header/content public contract is incomplete");
    const rect = node => { const box = node.getBoundingClientRect(); return {left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height}; };
    return {workspace: rect(workspace), header: rect(header), content: rect(content), measured: Number(workspace.getAttribute("data-cattasks-workspace")), baseline: Number(workspace.getAttribute("data-header-baseline")), slot: Number.parseFloat(getComputedStyle(workspace).getPropertyValue("--workspace-header-slot")), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth};
  });
}

async function assertFrame(page, width, label) {
  const frame = await geometry(page);
  near(frame.workspace.width, width, `${label} uses its actual owning-container width`);
  near(frame.measured, Math.floor(frame.workspace.width), `${label} reports the measured workspace width`, 1);
  near(frame.header.left, frame.workspace.left, `${label} header shares workspace left`);
  near(frame.header.right, frame.workspace.right, `${label} header shares workspace right`);
  near(frame.content.left, frame.workspace.left, `${label} content shares workspace left`);
  near(frame.content.right, frame.workspace.right, `${label} content shares workspace right`);
  near(frame.header.bottom, frame.workspace.top + frame.baseline, `${label} header reaches its reserved baseline`, 3);
  assert.ok(frame.content.top >= frame.header.bottom - 2, `${label} content begins after the header slot`);
  assert.equal(frame.overflow, 0, `${label} has no horizontal document overflow`);
  return frame;
}

async function assertHeaderControls(page, label) {
  const [allTasks, previous, next] = [
    page.getByRole("button", {name: "All tasks", exact: true}),
    page.getByRole("button", {name: "Select previous task", exact: true}),
    page.getByRole("button", {name: "Select next task", exact: true}),
  ];
  for (const [name, control] of [["All tasks", allTasks], ["previous", previous], ["next", next]]) {
    const box = await control.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, `${label} ${name} is an accessible 44px target`);
  }
  const [frame, allBox] = await Promise.all([geometry(page), allTasks.boundingBox()]);
  assert.ok(allBox && allBox.x < frame.workspace.left + frame.workspace.width / 2, `${label} keeps All tasks on the left`);
  return {allTasks, previous, next};
}

async function assertNoTitleOverlap(page, label) {
  const heading = page.getByRole("heading").filter({hasText: /Short|Съешь|deliberately long/i}).first();
  const boxes = await Promise.all([heading.boundingBox(), page.getByRole("button", {name: "Select previous task", exact: true}).boundingBox(), page.getByRole("button", {name: "Select next task", exact: true}).boundingBox()]);
  assert.ok(boxes.every(Boolean), `${label} exposes title and live navigation boxes`);
  assert.ok(!intersects(boxes[0], boxes[1]) && !intersects(boxes[0], boxes[2]), `${label} title does not cover live navigation`);
}

async function assertVisibleV146Art(page, theme, construction) {
  const art = await page.evaluate(() => {
    const header = [...document.querySelectorAll("[data-cattasks-header]")].find(node => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== "none" && !node.closest("[hidden]") && box.width > 0 && box.height > 0;
    });
    if (!header) throw new Error("live header is unavailable for artwork inspection");
    const url = /url\(["']?([^"')]+)["']?\)/g;
    const cssUrls = [header, ...header.querySelectorAll("*")].flatMap(node => ["", "::before", "::after"].flatMap(pseudo => {
      const background = getComputedStyle(node, pseudo || undefined).backgroundImage;
      return [...background.matchAll(url)].map(match => new URL(match[1], document.baseURI).href);
    }));
    const markupUrls = [...header.querySelectorAll("img, image")].map(node => node.currentSrc || node.getAttribute("href") || node.getAttribute("xlink:href")).filter(Boolean).map(value => new URL(value, document.baseURI).href);
    return [...cssUrls, ...markupUrls];
  });
  const origin = new URL(baseUrl).origin;
  const approved = art.filter(url => {
    const parsed = new URL(url, baseUrl);
    return parsed.origin === origin && /^\/cattasks-art\/v146\/(classic|industrial)\//.test(parsed.pathname);
  });
  const label = `${theme} ${construction}`;
  assert.ok(approved.length > 0, `${label} renders at least one live same-origin approved v146 artwork asset`);
  for (const url of approved) assert.match(new URL(url).pathname, /^\/cattasks-art\/v146\/(classic|industrial)\//, `${label} v146 artwork stays inside the closed approved path set`);
  const paths = approved.map(url => new URL(url).pathname);
  const color = theme === "Khorne" ? "ember" : "green";
  const expected = construction === "Industrial"
    ? /^\/cattasks-art\/v146\/industrial\//
    : new RegExp(`^/cattasks-art/v146/classic/panel-${construction.toLowerCase()}-${color}\\.png$`);
  assert.ok(paths.some(path => expected.test(path)), `${label} renders its construction-specific approved artwork and never the other god's colour variant`);
  return [...new Set(paths)].sort();
}

async function assertDiagnostics(diagnostics) {
  assert.deepEqual(diagnostics.console, [], "no console errors occurred");
  assert.deepEqual(diagnostics.page, [], "no page errors occurred");
  assert.deepEqual(diagnostics.failed, [], "no browser request failed");
  assert.deepEqual(diagnostics.responses, [], "no failing response occurred");
}

test("v146 construction overlap helper distinguishes Playwright boxes", () => {
  assert.equal(intersects({x: 10, y: 10, width: 20, height: 20}, {x: 25, y: 20, width: 20, height: 20}), true, "known overlapping Playwright bounding boxes intersect");
  assert.equal(intersects({x: 10, y: 10, width: 20, height: 20}, {x: 31, y: 10, width: 20, height: 20}), false, "separated Playwright bounding boxes do not intersect");
});

test("v146 constructions expose one keyboard-operable closed chooser for both shipped gods", {timeout: 120_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const [index, theme] of themes.entries()) {
      await chooseTheme(page, theme);
      await expectPressed(page, index === 0 ? "Industrial" : "Armor");
      assert.equal(await constructionGroup(page).getByRole("button").count(), constructions.length, `${theme} exposes only the complete construction enum`);
      await assertConstructionHitTargets(page, {width: 320, height: 820});
      await assertConstructionHitTargets(page, {width: 1280, height: 900});
      await page.setViewportSize({width: 1800, height: 1100});
      await settle(page);
      for (const construction of constructions) await chooseConstructionWithKeyboard(page, construction);
    }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 constructions keep Task and All tasks measured across every published width", {timeout: 240_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const theme of themes) {
      await chooseTheme(page, theme);
      const constructionRoots = new Map();
      for (const construction of constructions) {
        await chooseConstructionWithKeyboard(page, construction);
        constructionRoots.set(construction, await assertVisibleV146Art(page, theme, construction));
        for (const width of widths) {
          await setOwningContainerWidth(page, width);
          const taskFrame = await assertFrame(page, width, `${theme} ${construction} Task ${width}px`);
          near(taskFrame.baseline, v146Baseline[width], `${theme} ${construction} ${width}px uses the source v146 baseline`, 2);
          near(taskFrame.slot, v146WorkspaceSlot[width], `${theme} ${construction} ${width}px reserves the source v146 workspace slot including its separate support rail`, 2);
          await closeChooser(page);
          const {allTasks} = await assertHeaderControls(page, `${theme} ${construction} Task ${width}px`);
          await allTasks.click();
          await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
          const catalogueFrame = await assertFrame(page, width, `${theme} ${construction} All tasks ${width}px`);
          near(catalogueFrame.content.top, taskFrame.content.top, `${theme} ${construction} ${width}px preserves content start between pages`, 3);
          const back = page.getByRole("button", {name: "Back to task", exact: true});
          const backBox = await back.boundingBox();
          assert.ok(backBox && backBox.width >= 44 && backBox.height >= 44 && backBox.x < catalogueFrame.workspace.left + catalogueFrame.workspace.width / 2, `${theme} ${construction} ${width}px has a left accessible Back to task control`);
          await back.click();
          await page.getByRole("heading", {name: /Short|Съешь|deliberately long/i}).first().waitFor({state: "visible"});
          await ensureConstructionGroup(page);
        }
      }
      assert.equal(new Set([...constructionRoots.values()].map(paths => paths.join("|"))).size, constructions.length, `${theme} renders a distinct approved artwork path set for each construction`);
    }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 constructions preserve continuity at 622→623 and real title/control geometry", {timeout: 120_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const theme of themes) {
      await chooseTheme(page, theme);
      for (const construction of constructions) {
        await chooseConstructionWithKeyboard(page, construction);
        await closeChooser(page);
        const frames = [];
        for (const width of [622, 623]) {
          await setOwningContainerWidth(page, width);
          frames.push(await assertFrame(page, width, `${theme} ${construction} ${width}px`));
          near(frames.at(-1).baseline, v146Baseline[width], `${theme} ${construction} ${width}px uses the v146 artwork baseline rather than a legacy shared slot`, 2);
          const {next} = await assertHeaderControls(page, `${theme} ${construction} ${width}px`);
          await next.click();
          await page.getByRole("heading", {name: cyrillicTitle, exact: true}).waitFor({state: "visible"});
          await assertNoTitleOverlap(page, `${theme} ${construction} Cyrillic ${width}px`);
          await next.click();
          await page.getByRole("heading", {name: longTitle, exact: true}).waitFor({state: "visible"});
          await assertNoTitleOverlap(page, `${theme} ${construction} long ${width}px`);
          await page.getByRole("button", {name: "Select previous task", exact: true}).click();
          await page.getByRole("button", {name: "Select previous task", exact: true}).click();
        }
        assert.ok(Math.abs(frames[1].header.bottom - frames[0].header.bottom) <= 2, `${theme} ${construction} does not make a visible structural header jump at 622→623`);
        assert.ok(Math.abs(frames[1].content.top - frames[0].content.top) <= 2, `${theme} ${construction} does not drop content at 622→623`);
      }
    }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 Industrial keeps the real merging-intervals title semantic, visible, and inside the fixed 430px workspace slot", {timeout: 90_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page, titleCatalog);
    for (const theme of themes) {
      await chooseTheme(page, theme);
      await chooseConstructionWithKeyboard(page, "Industrial");
      await closeChooser(page);
      await setOwningContainerWidth(page, 430);
      const shortFrame = await assertFrame(page, 430, `${theme} Industrial short title`);
      const next = page.getByRole("button", {name: "Select next task", exact: true});
      await next.click();
      const heading = page.getByRole("heading", {name: mergingIntervalsTitle, exact: true});
      await heading.waitFor({state: "visible"});
      const measured = await heading.evaluate(node => {
        const box = node.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node);
        const lines = [...range.getClientRects()].filter((rect, index, all) => all.findIndex(candidate => Math.abs(candidate.top - rect.top) <= 1 && Math.abs(candidate.bottom - rect.bottom) <= 1) === index).map(rect => ({left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom}));
        return {text: node.textContent, nativeTitle: node.getAttribute("title"), truncated: node.getAttribute("data-title-truncated"), clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, box: {left: box.left, right: box.right, top: box.top, bottom: box.bottom}, lines};
      });
      assert.equal(measured.text, mergingIntervalsTitle, `${theme} preserves the literal heading text`);
      assert.equal(measured.nativeTitle, mergingIntervalsTitle, `${theme} exposes the full native title semantic`);
      assert.notEqual(measured.truncated, "true", `${theme} does not mark the merging-intervals title as truncated`);
      assert.ok(measured.scrollHeight <= measured.clientHeight + 1, `${theme} does not crop the merging-intervals title (${measured.scrollHeight}/${measured.clientHeight})`);
      assert.ok(measured.lines.length >= 1 && measured.lines.length <= 2, `${theme} paints the merging-intervals title in no more than two actual lines`);
      assert.ok(measured.lines.every(line => line.left >= measured.box.left - 1 && line.right <= measured.box.right + 1 && line.top >= measured.box.top - 1 && line.bottom <= measured.box.bottom + 1), `${theme} keeps every title line inside its own painted bounds`);
      const [previousBox, nextBox] = await Promise.all([page.getByRole("button", {name: "Select previous task", exact: true}).boundingBox(), next.boundingBox()]);
      assert.ok(previousBox && nextBox && !intersects(measured.box, previousBox) && !intersects(measured.box, nextBox), `${theme} merging-intervals title does not overlap either live arrow`);
      const longFrame = await assertFrame(page, 430, `${theme} Industrial merging-intervals title`);
      near(longFrame.baseline, shortFrame.baseline, `${theme} title fitting preserves the shared baseline`, 1);
      near(longFrame.slot, shortFrame.slot, `${theme} title fitting preserves the shared workspace slot`, 1);
      await page.getByRole("button", {name: "Select previous task", exact: true}).click();
      await page.getByRole("heading", {name: "Short", exact: true}).waitFor({state: "visible"});
    }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 catalogue header clears a pathological task title's fit and truncation state", {timeout: 90_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page, catalogueResetCatalog);
    await chooseTheme(page, "Khorne");
    await chooseConstructionWithKeyboard(page, "Industrial");
    await closeChooser(page);
    await setOwningContainerWidth(page, 430);
    await page.getByRole("button", {name: "Select next task", exact: true}).click();
    const pathological = page.getByRole("heading", {name: pathologicalCatalogueTitle, exact: true});
    await pathological.waitFor({state: "visible"});
    assert.equal(await pathological.getAttribute("data-title-truncated"), "true", "fixture first reaches the real pathological task-title truncation boundary");
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    const catalogueHeading = page.getByRole("heading", {name: "All tasks", exact: true});
    await catalogueHeading.waitFor({state: "visible"});
    const catalogueFit = await catalogueHeading.evaluate(node => {
      const style = getComputedStyle(node);
      return {truncated: node.getAttribute("data-title-truncated"), overflow: style.overflow, lineClamp: style.webkitLineClamp, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, fontSize: Number.parseFloat(style.fontSize)};
    });
    assert.notEqual(catalogueFit.truncated, "true", "All tasks clears task-title truncation metadata");
    assert.notEqual(catalogueFit.overflow, "hidden", "All tasks does not retain task-title crop overflow");
    assert.ok(catalogueFit.lineClamp === "" || catalogueFit.lineClamp === "none", "All tasks does not retain a task-title line clamp");
    assert.ok(catalogueFit.scrollHeight <= catalogueFit.clientHeight + 1, "All tasks heading has no hidden overflow");
    assert.ok(catalogueFit.fontSize > 18, `All tasks restores its own fitted heading size (received ${catalogueFit.fontSize}px)`);
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 Industrial catalogue Back plate receives its authored 320px public hit point", {timeout: 90_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Khorne");
    await chooseConstructionWithKeyboard(page, "Industrial");
    await closeChooser(page);
    await setOwningContainerWidth(page, 320);
    const allTasks = page.getByRole("button", {name: "All tasks", exact: true});
    await allTasks.click();
    const back = page.getByRole("button", {name: "Back to task", exact: true});
    await back.waitFor({state: "visible"});
    const [workspace, backBox] = await Promise.all([page.locator("[data-cattasks-workspace]").boundingBox(), back.boundingBox()]);
    assert.ok(workspace && backBox, "the measured workspace and live Back control are visible");
    const authoredPoint = {x: workspace.x + 134, y: backBox.y + backBox.height / 2};
    assert.ok(authoredPoint.x - workspace.x >= 9 && authoredPoint.x - workspace.x <= 165, "the independent point is calibrated to the authored 320px Back plate span");
    assert.ok(authoredPoint.x > workspace.x && authoredPoint.x < workspace.x + workspace.width && authoredPoint.y > backBox.y && authoredPoint.y < backBox.y + backBox.height, "the public Back plate point is calibrated inside the measured workspace and Back row");
    await page.mouse.click(authoredPoint.x, authoredPoint.y);
    await settle(page);
    assert.equal(await page.locator("[data-cattasks-page='task']").count(), 1, "the authored Back plate point invokes the real return-to-task callback");
    await page.getByRole("heading", {name: "Short", exact: true}).waitFor({state: "visible"});
    assert.equal(await allTasks.evaluate(node => node === document.activeElement), true, "pointer Back return preserves the application's public All tasks focus handoff");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 construction changes retain the real editor and selected task; unavailable catalogue remains genuine", {timeout: 120_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1800, height: 1100}});
  const page = await context.newPage();
  let unavailable;
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Khorne");
    await setOwningContainerWidth(page, 834);
    const next = page.getByRole("button", {name: "Select next task", exact: true});
    await next.click();
    await page.getByRole("heading", {name: cyrillicTitle, exact: true}).waitFor({state: "visible"});
    const before = await page.evaluate(() => {
      const editor = window.monaco.editor.getEditors()[0];
      const model = editor?.getModel();
      return {model: model?.uri.toString(), models: window.monaco.editor.getModels().map(candidate => candidate.uri.toString()), value: model?.getValue(), selection: editor?.getSelection()?.toString()};
    });
    const editor = page.locator(".monaco-editor").first();
    await editor.click({position: {x: 20, y: 20}});
    await page.keyboard.type("// construction transition keeps this inert draft");
    await page.keyboard.press("Shift+ArrowLeft");
    const edited = await page.evaluate(() => {
      const editor = window.monaco.editor.getEditors()[0];
      return {value: editor?.getModel()?.getValue(), selection: editor?.getSelection()?.toString()};
    });
    assert.notEqual(edited.value, before.value, "the inert draft actually changed before construction transitions");
    assert.ok(edited.selection, "the inert draft has a real selection before construction transitions");
    await chooseConstructionWithKeyboard(page, "Gothic");
    await chooseConstructionWithKeyboard(page, "Armor");
    await closeChooser(page);
    const after = await page.evaluate(() => {
      const editor = window.monaco.editor.getEditors()[0];
      const model = editor?.getModel();
      return {model: model?.uri.toString(), models: window.monaco.editor.getModels().map(candidate => candidate.uri.toString()), value: model?.getValue(), selection: editor?.getSelection()?.toString()};
    });
    assert.deepEqual(after.models, before.models, "construction changes do not remount Monaco models");
    assert.equal(after.model, before.model, "construction changes retain the selected Monaco model");
    assert.equal(after.value, edited.value, "construction changes retain the active draft");
    assert.equal(after.selection, edited.selection, "construction changes retain the Monaco selection");
    assert.equal(await page.getByRole("heading", {name: cyrillicTitle, exact: true}).count(), 1, "construction changes retain the selected task");
    const allTasks = page.getByRole("button", {name: "All tasks", exact: true});
    await allTasks.click();
    const search = page.getByRole("searchbox", {name: "Search tasks"});
    await search.fill("Scroll fixture");
    const notStarted = page.getByRole("radio", {name: "Not started", exact: true});
    await notStarted.check();
    const list = page.locator("section[aria-labelledby='taskListTitle']");
    await list.evaluate(node => { node.scrollTop = Math.min(80, Math.max(0, node.scrollHeight - node.clientHeight)); });
    const retainedScroll = await list.evaluate(node => node.scrollTop);
    await chooseConstructionWithKeyboard(page, "Industrial");
    assert.equal(await search.inputValue(), "Scroll fixture", "construction change retains the real catalogue query");
    assert.equal(await notStarted.isChecked(), true, "construction change retains the real catalogue status filter");
    assert.equal(await list.evaluate(node => node.scrollTop), retainedScroll, "construction change retains catalogue scroll position");
    await search.fill("<b>Markup</b> & literal");
    const literalTitle = list.getByRole("heading", {name: "<b>Markup</b> & literal", exact: true});
    await literalTitle.waitFor({state: "visible"});
    assert.deepEqual(await literalTitle.evaluate(node => ({text: node.textContent, children: node.childElementCount, scripts: node.querySelectorAll("script").length})), {text: "<b>Markup</b> & literal", children: 0, scripts: 0}, "a markup-like inert catalogue title remains literal text without injected descendants");
    assertDiagnostics(diagnostics);

    unavailable = await browser.newContext({viewport: {width: 1000, height: 900}});
    const unavailablePage = await unavailable.newPage();
    await prepare(unavailablePage, invalidCatalog, {waitForEditor: false});
    await unavailablePage.getByRole("heading", {name: "Tasks unavailable.", exact: true}).waitFor({state: "visible"});
    assert.equal(await unavailablePage.getByRole("heading", {name: "", exact: true}).count(), 0, "invalid catalogue does not fabricate a blank selected title");
  } finally {
    await unavailable?.close();
    await context.close();
    await browser.close();
  }
});
