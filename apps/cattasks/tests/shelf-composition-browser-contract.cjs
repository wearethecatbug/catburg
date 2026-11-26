const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

// Independent v146 Task/Catalogue composition oracle. Only inert fixture data
// is supplied; this suite never activates Test Code or Run Code.
const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
const longTitle = "A deliberately long task title that must wrap without covering controls";
const catalog = {version: 1, tasks: [
  {id: "race", title: "Tortoise race", description: "First", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "long", title: longTitle, description: "Long", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "third", title: "Third independent task", description: "Third", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "anagrams", title: "Check Whether Two Strings Are Anagrams", description: "Fit", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
]};
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

async function prepare(page) {
  const diagnostics = {console: [], page: [], failed: [], responses: [], catalog: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); }); page.on("pageerror", error => diagnostics.page.push(error.message)); page.on("requestfailed", request => diagnostics.failed.push(request.url())); page.on("response", response => { if (response.status() >= 400) diagnostics.responses.push(`${response.status()} ${response.url()}`); });
  await page.route("**/task-catalog.v1.json", route => { diagnostics.catalog.push(`${route.request().method()} ${route.request().url()}`); return route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}); });
  assert.equal((await page.goto(baseUrl, {waitUntil: "domcontentloaded"}))?.status(), 200, "the inert loopback dashboard loads"); return diagnostics;
}
function assertDiagnostics(diagnostics) { assert.deepEqual(diagnostics.console, []); assert.deepEqual(diagnostics.page, []); assert.deepEqual(diagnostics.failed, []); assert.deepEqual(diagnostics.responses, []); assert.equal(diagnostics.catalog.length, 1, "navigation reuses the inert catalogue response"); }
async function enterCatalogue(page) { await page.getByRole("button", {name: "All tasks", exact: true}).click(); await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor(); }
async function openFromCatalogue(page, name) { await enterCatalogue(page); const search = page.getByRole("searchbox", {name: "Search tasks"}); await search.fill(name); await page.locator("section[aria-labelledby='taskListTitle']").filter({hasText: name}).getByRole("button", {name: /^Open(?: |$)/}).click(); await page.getByRole("heading", {level: 1, name, exact: true}).waitFor(); }
async function assertLiveCenter(page, name, label) { const button = page.getByRole("button", {name, exact: true}); const box = await button.boundingBox(); assert.ok(box && box.width >= 44 && box.height >= 40, `${label} ${name} has a usable hit area`); const ownsPoint = await button.evaluate(node => { const r = node.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit === node || node.contains(hit); }); assert.equal(ownsPoint, true, `${label} decoration cannot intercept ${name}`); return {button, box}; }

test("v146 Catalogue keeps Back left, keyboard reachable, and returns focus to its Task opener", {timeout: 75_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 1280, height: 900}}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const width of [320, 430, 622, 623, 1280]) { await page.setViewportSize({width, height: 900}); await enterCatalogue(page); const back = await assertLiveCenter(page, "Back to task", `${width}px Catalogue`); const heading = page.getByRole("heading", {name: "All tasks", exact: true}); const headingBox = await heading.boundingBox(); assert.ok(headingBox && !intersects(headingBox, back.box), `${width}px Catalogue title clears Back`); if (width < 700) { await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab"); } else { for (let index = 0; index < 8 && await page.evaluate(() => document.activeElement?.getAttribute("aria-label")) !== "Back to task"; index += 1) await page.keyboard.press("Shift+Tab"); } await page.locator("button[aria-label='Back to task']:focus").waitFor(); assert.equal(await back.button.evaluate(node => node.matches(":focus-visible")), true, `${width}px Back has visible keyboard focus`); await page.keyboard.press("Enter"); await page.getByRole("button", {name: "All tasks", exact: true}).waitFor(); assert.equal(await page.getByRole("button", {name: "All tasks", exact: true}).evaluate(node => node === document.activeElement), true, `${width}px Back restores focus to its opener`); }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 compact controls and application actions stay keyboard reachable without executing code", {timeout: 75_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 430, height: 900}}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page); await openFromCatalogue(page, longTitle);
    for (const width of [320, 430, 622]) { await page.setViewportSize({width, height: 900}); for (const name of ["All tasks", "Select previous task", "Select next task", "Test Code", "Run Code"]) { await assertLiveCenter(page, name, `${width}px Task`); } await page.getByRole("button", {name: "All tasks", exact: true}).press("Tab"); assert.equal(await page.evaluate(() => document.activeElement?.matches(":focus-visible")), true, `${width}px keyboard traversal retains a visible focus target`); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${width}px Task has no horizontal overflow`); }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 long title is semantically complete, paints at most two lines, and clears every control", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 430, height: 900}}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await openFromCatalogue(page, longTitle);
    const heading = page.getByRole("heading", {level: 1, name: longTitle, exact: true});
    const geometry = await heading.evaluate(node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = node.getBoundingClientRect();
      const fragments = [...range.getClientRects()].filter(rect => rect.width && rect.height);
      const rawRows = fragments.map(rect => Math.round(rect.top)).filter((top, index, values) => index === 0 || top !== values[index - 1]);
      const rows = fragments
        .filter(rect => rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1)
        .map(rect => Math.round(rect.top))
        .filter((top, index, values) => index === 0 || top !== values[index - 1]);
      return {text: node.textContent, lines: rows.length, rawRows: rawRows.length, fragmentsContained: fragments.every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1), lineClamp: getComputedStyle(node).webkitLineClamp, overflowStyle: getComputedStyle(node).overflow, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth};
    });
    assert.equal(geometry.text, longTitle, "the complete original title remains semantic text");
    assert.ok(geometry.lines >= 1 && geometry.lines <= 2, "the compact header visibly paints at most two title lines");
    if (geometry.rawRows > 2) {
      assert.equal(geometry.lineClamp, "2", "the compact header clamps a raw third title row");
      assert.ok(geometry.overflowStyle === "hidden" || geometry.overflowStyle === "clip", "the compact header clips overflowing glyph fragments");
      assert.equal(geometry.fragmentsContained, false, "the compact header does not silently discard a raw third title row");
    }
    assert.equal(geometry.overflow, 0, "the long title creates no horizontal overflow");
    const headingBox = await heading.boundingBox();
    for (const name of ["All tasks", "Select previous task", "Select next task"]) {
      const {box} = await assertLiveCenter(page, name, "long-title Task");
      assert.ok(headingBox && !intersects(headingBox, box), `${name} remains clear of the long title`);
    }
    await openFromCatalogue(page, "Check Whether Two Strings Are Anagrams");
    await page.setViewportSize({width: 1790, height: 900});
    await page.evaluate(() => {
      const workspace = document.querySelector("[data-cattasks-workspace]");
      Object.assign(workspace?.parentElement?.style ?? {}, {inlineSize: "1440px", maxInlineSize: "1440px", minInlineSize: "0px"});
    });
    const fitted = page.getByRole("heading", {level: 1, name: "Check Whether Two Strings Are Anagrams", exact: true});
    await fitted.waitFor({state: "visible"});
    await fitted.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    const fittedGeometry = await fitted.evaluate(node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = node.getBoundingClientRect();
      const fragments = [...range.getClientRects()]
        .filter(rect => rect.width && rect.height);
      const rows = fragments
        .filter(rect => rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1)
        .map(rect => Math.round(rect.top))
        .filter((top, index, values) => index === 0 || top !== values[index - 1]);
      const workspace = node.closest("[data-cattasks-workspace]");
      return {
        rows,
        fragmentsContained: fragments.every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1),
        workspaceWidth: Number(workspace?.getAttribute("data-cattasks-workspace")),
        fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
      };
    });
    assert.ok(Math.abs(fittedGeometry.workspaceWidth - 1384) <= 2, "the positive fit case measures the required 1384px workspace width");
    assert.ok(fittedGeometry.fontSize >= 20 && fittedGeometry.fontSize <= 30, "the measured wide title retains the approved readable 20–30px font range");
    assert.equal(fittedGeometry.fragmentsContained, true, "every nonempty title glyph fragment remains inside the real heading bounds");
    assert.ok(fittedGeometry.rows.length >= 1 && fittedGeometry.rows.length <= 2, "the approved split-width title fits one or two fully visible rows");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 keyboard navigation hands focus to description and supports reduced motion and forced colors", {timeout: 75_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 623, height: 900}, reducedMotion: "reduce"}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page); await openFromCatalogue(page, longTitle); const next = page.getByRole("button", {name: "Select next task", exact: true}); await next.focus(); await next.press("Enter"); await page.getByRole("heading", {level: 1, name: "Third independent task", exact: true}).waitFor(); assert.equal(await page.evaluate(() => document.activeElement?.matches("pre[aria-label='Описание задачи'][tabindex='-1']")), true, "Enter on enabled Next hands focus to the new description"); const previous = page.getByRole("button", {name: "Select previous task", exact: true}); await previous.focus(); const reduced = await previous.evaluate(node => getComputedStyle(node).transitionDuration); assert.equal(reduced.split(",").every(value => Number.parseFloat(value) === 0), true, "reduced motion removes enabled-navigation transitions"); await page.emulateMedia({forcedColors: "active"}); await enterCatalogue(page); const forced = await page.getByRole("heading", {name: "All tasks", exact: true}).evaluate(node => { const style = getComputedStyle(node); return {color: style.color, fill: style.webkitTextFillColor, background: style.backgroundImage}; }); assert.notEqual(forced.color, "rgba(0, 0, 0, 0)", "forced colors keeps the Catalogue heading readable"); assert.equal(forced.fill, forced.color, "forced colors restores text fill to the readable color"); assert.equal(forced.background, "none", "forced colors removes decorative gradient text paint"); assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});
