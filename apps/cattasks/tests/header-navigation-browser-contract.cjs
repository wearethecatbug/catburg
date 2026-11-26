const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

// Independent v146 navigation contract. The catalogue is inert; no code-execution
// control is ever activated by this suite.
const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
const catalog = {version: 1, tasks: [
  {id: "race", title: "Tortoise race", description: "First", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "long", title: "A deliberately long task title that must wrap without covering controls", description: "Long", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "third", title: "Third independent task", description: "Third", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
]};
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const title = (page, name) => page.getByRole("heading", {level: 1, name, exact: true});

async function prepare(page, holdCatalogue) {
  const diagnostics = {console: [], page: [], failed: [], responses: [], catalog: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.failed.push(request.url()));
  page.on("response", response => { if (response.status() >= 400) diagnostics.responses.push(`${response.status()} ${response.url()}`); });
  await page.route("**/task-catalog.v1.json", async route => { diagnostics.catalog.push(`${route.request().method()} ${route.request().url()}`); if (holdCatalogue) await holdCatalogue; await route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}); });
  assert.equal((await page.goto(baseUrl, {waitUntil: "domcontentloaded"}))?.status(), 200, "the inert loopback dashboard loads");
  return diagnostics;
}
function assertDiagnostics(diagnostics) {
  assert.deepEqual(diagnostics.console, [], "no browser console errors"); assert.deepEqual(diagnostics.page, [], "no page errors"); assert.deepEqual(diagnostics.failed, [], "no failed requests"); assert.deepEqual(diagnostics.responses, [], "no failing responses"); assert.equal(diagnostics.catalog.length, 1, "header interaction does not refetch the inert catalogue");
}
async function assertNoHeaderQuery(page) {
  assert.equal(await page.getByRole("combobox").count(), 0, "the retired header combobox is absent"); assert.equal(await page.getByRole("listbox").count(), 0, "the retired header listbox is absent"); assert.equal(await page.locator("input[placeholder='Список задач...']").count(), 0, "the retired header query is absent"); assert.equal(await page.locator("button[aria-controls='headerTaskListMenu']").count(), 0, "the retired header dropdown is absent");
}
async function openFromCatalogue(page, name) {
  await page.getByRole("button", {name: "All tasks", exact: true}).click(); const search = page.getByRole("searchbox", {name: "Search tasks"}); await search.fill(name); await page.locator("section[aria-labelledby='taskListTitle']").filter({hasText: name}).getByRole("button", {name: /^Open(?: |$)/}).click(); await title(page, name).waitFor();
}
async function assertTwoLineSemanticTitle(page, name, label) {
  const heading = title(page, name);
  const result = await heading.evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = node.getBoundingClientRect();
    const visibleRows = [...range.getClientRects()]
      .filter(rect => rect.width && rect.height && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1)
      .map(rect => Math.round(rect.top))
      .filter((top, index, rows) => index === 0 || top !== rows[index - 1]);
    return {
      lines: visibleRows.length,
      text: node.textContent,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  assert.equal(result.text, name, `${label} retains the complete title in the semantic heading`);
  assert.ok(result.lines >= 1 && result.lines <= 2, `${label} visibly paints at most two title lines`);
  assert.equal(result.overflow, 0, `${label} creates no horizontal overflow`);
  return heading;
}
async function assertLiveButton(page, name, label) {
  const button = page.getByRole("button", {name, exact: true}); const box = await button.boundingBox(); assert.ok(box && box.width >= 44 && box.height >= 40, `${label} ${name} has a reachable hit area`); const hit = await button.evaluate(node => { const r = node.getBoundingClientRect(); const point = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return point === node || node.contains(point); }); assert.equal(hit, true, `${label} ${name} owns its center hit point`); return {button, box};
}

test("v146 header removes the retired query and keeps true task boundaries with keyboard navigation", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 1440, height: 900}}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    const previous = page.getByRole("button", {name: "Select previous task", exact: true});
    const next = page.getByRole("button", {name: "Select next task", exact: true});
    await Promise.all([previous.waitFor(), next.waitFor(), title(page, "Tortoise race").waitFor()]);
    await assertNoHeaderQuery(page);
    assert.equal(await previous.isDisabled(), true, "the first task has a genuinely disabled Previous boundary");
    assert.equal(await next.isDisabled(), false, "the first task keeps Next enabled");
    for (let index = 0; index < 24 && await page.evaluate(() => document.activeElement?.getAttribute("aria-label")) !== "Select next task"; index += 1) await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Select next task", "Tab reaches enabled Next");
    assert.equal(await next.evaluate(node => node.matches(":focus-visible")), true, "keyboard traversal exposes visible Next focus");
    await page.keyboard.press("Enter");
    await title(page, catalog.tasks[1].title).waitFor();
    assert.equal(await previous.isDisabled(), false, "Previous becomes enabled after moving to the middle task");
    await previous.click();
    await title(page, "Tortoise race").waitFor();
    await openFromCatalogue(page, "Third independent task");
    assert.equal(await page.getByText(/task 03/i, {exact: true}).count(), 1, "opening from catalogue updates the semantic task ordinal");
    await assertNoHeaderQuery(page);
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 compact and 622 to 623 headers preserve full title semantics and reachable controls", {timeout: 75_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 430, height: 900}}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page); await openFromCatalogue(page, catalog.tasks[1].title);
    for (const width of [320, 430, 622, 623]) { await page.setViewportSize({width, height: 900}); const heading = await assertTwoLineSemanticTitle(page, catalog.tasks[1].title, `${width}px`); const [back, previous, next] = await Promise.all([assertLiveButton(page, "All tasks", `${width}px`), assertLiveButton(page, "Select previous task", `${width}px`), assertLiveButton(page, "Select next task", `${width}px`)]); const headingBox = await heading.boundingBox(); assert.ok(headingBox && !intersects(headingBox, back.box) && !intersects(headingBox, previous.box) && !intersects(headingBox, next.box), `${width}px title clears every live header control`); }
    await page.setViewportSize({width: 430, height: 900}); await page.getByRole("button", {name: "Select next task", exact: true}).press("Enter"); await title(page, "Third independent task").waitFor(); await page.getByRole("button", {name: "Select previous task", exact: true}).click(); await title(page, catalog.tasks[1].title).waitFor(); assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("v146 navigation remains inert while loading and preserves real disabled boundaries after load", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 780, height: 900}, reducedMotion: "reduce"}); const page = await context.newPage(); let release;
  try {
    const held = new Promise(resolve => { release = resolve; });
    const diagnostics = await prepare(page, held);
    const previous = page.getByRole("button", {name: "Select previous task", exact: true});
    const next = page.getByRole("button", {name: "Select next task", exact: true});
    await Promise.all([previous.waitFor(), next.waitFor()]);
    assert.equal(await previous.isDisabled(), true, "Previous is disabled before catalogue data arrives");
    assert.equal(await next.isDisabled(), true, "Next is disabled before catalogue data arrives");
    await previous.hover();
    const loading = await previous.evaluate(node => {
      const parts = [...node.parentElement.querySelectorAll("[aria-hidden='true'] *")];
      const normal = parts.find(part => getComputedStyle(part).backgroundImage.includes("capybara-navigation-normal.png"));
      const reveal = parts.find(part => getComputedStyle(part).backgroundImage.includes("capybara-navigation-reveal.png"));
      if (!normal || !reveal) throw new Error("disabled navigation pose parts are unavailable");
      return {transform: getComputedStyle(node).transform, duration: getComputedStyle(node).transitionDuration, normal: getComputedStyle(normal).backgroundImage, normalDuration: getComputedStyle(normal).transitionDuration, reveal: getComputedStyle(reveal).backgroundImage, revealDuration: getComputedStyle(reveal).transitionDuration, revealOpacity: getComputedStyle(reveal).opacity};
    });
    assert.equal(loading.transform, "none", "disabled loading control does not move on hover");
    assert.equal(loading.duration.split(",").every(value => Number.parseFloat(value) === 0), true, "reduced motion removes loading-control transitions");
    assert.match(loading.normal, /capybara-navigation-normal\.png/, "navigation keeps normal pose art");
    assert.match(loading.reveal, /capybara-navigation-reveal\.png/, "navigation keeps reveal pose art");
    assert.equal(loading.normalDuration.split(",").every(value => Number.parseFloat(value) === 0), true, "reduced motion removes normal-pose transitions during loading");
    assert.equal(loading.revealDuration.split(",").every(value => Number.parseFloat(value) === 0), true, "reduced motion removes reveal-pose transitions during loading");
    assert.equal(loading.revealOpacity, "0", "disabled loading control does not reveal alternate art");
    release();
    await title(page, "Tortoise race").waitFor();
    assert.equal(await previous.isDisabled(), true, "Previous remains disabled at the first real boundary");
    assert.equal(await next.isDisabled(), false, "Next becomes enabled after the catalogue resolves");
    await next.click();
    await title(page, catalog.tasks[1].title).waitFor();
    assert.equal(await previous.isDisabled(), false, "Previous becomes enabled only after a real forward move");
    assertDiagnostics(diagnostics);
  } finally { if (release) release(); await context.close(); await browser.close(); }
});

test("v146 enabled compact navigation keeps focus and reveal under reduced motion", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 834, height: 900}, reducedMotion: "reduce"}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await openFromCatalogue(page, catalog.tasks[1].title);
    const allTasks = page.getByRole("button", {name: "All tasks", exact: true});
    const previous = page.getByRole("button", {name: "Select previous task", exact: true});
    await page.locator("pre[aria-label='Описание задачи']:focus").waitFor();
    await allTasks.focus();
    assert.equal(await allTasks.evaluate(node => node === document.activeElement), true, "All tasks is the stable keyboard anchor after description focus settles");
    await page.keyboard.press("Tab");
    await page.locator("button[aria-label='Select previous task']:focus").waitFor();
    await page.waitForFunction(() => {
      const button = document.querySelector("button[aria-label='Select previous task']");
      const pose = [...button?.parentElement?.querySelectorAll("[aria-hidden='true'] *") ?? []]
        .find(part => getComputedStyle(part).backgroundImage.includes("capybara-navigation-reveal.png"));
      return pose && Number.parseFloat(getComputedStyle(pose).opacity) >= .99;
    });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Select previous task", "Tab reaches enabled Previous");
    assert.equal(await previous.evaluate(node => node.matches(":focus-visible")), true, "enabled Previous remains a visible keyboard target");
    const style = await previous.evaluate(node => {
      const parts = [...node.parentElement.querySelectorAll("[aria-hidden='true'] *")];
      const normal = parts.find(part => getComputedStyle(part).backgroundImage.includes("capybara-navigation-normal.png"));
      const reveal = parts.find(part => getComputedStyle(part).backgroundImage.includes("capybara-navigation-reveal.png"));
      if (!normal || !reveal) throw new Error("enabled navigation pose parts are unavailable");
      return {duration: getComputedStyle(node).transitionDuration, normal: getComputedStyle(normal).backgroundImage, normalDuration: getComputedStyle(normal).transitionDuration, reveal: getComputedStyle(reveal).backgroundImage, revealDuration: getComputedStyle(reveal).transitionDuration, revealOpacity: getComputedStyle(reveal).opacity};
    });
    assert.equal(style.duration.split(",").every(value => Number.parseFloat(value) === 0), true, "reduced motion removes navigation transitions");
    assert.match(style.normal, /capybara-navigation-normal\.png/, "enabled navigation keeps normal pose art");
    assert.match(style.reveal, /capybara-navigation-reveal\.png/, "enabled navigation keeps reveal pose art");
    assert.equal(style.normalDuration.split(",").every(value => Number.parseFloat(value) === 0), true, "reduced motion removes normal-pose transitions for enabled navigation");
    assert.equal(style.revealDuration.split(",").every(value => Number.parseFloat(value) === 0), true, "reduced motion removes reveal-pose transitions for enabled navigation");
    assert.ok(Number.parseFloat(style.revealOpacity) >= .99, "keyboard focus reveals enabled navigation art without motion");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});
