const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
const catalog = {version: 1, tasks: [
  {id: "race", title: "Tortoise race", description: "First", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "long", title: "A deliberately long task title that must wrap without covering controls", description: "Long", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "third", title: "Third independent task", description: "Third", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
]};

async function prepare(page) {
  const diagnostics = {console: [], page: [], request: [], response: [], catalogRequests: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.request.push(request.url()));
  page.on("response", response => { if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`); });
  await page.route("**/task-catalog.v1.json", route => { diagnostics.catalogRequests.push(`${route.request().method()} ${route.request().url()}`); return route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}); });
  assert.equal((await page.goto(baseUrl, {waitUntil: "domcontentloaded"}))?.status(), 200);
  return diagnostics;
}

const center = box => ({x: box.x + box.width / 2, y: box.y + box.height / 2});
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const settle = page => page.waitForTimeout(180);
const zeroDurations = values => values.flatMap(value => value.split(",")).every(value => Number.parseFloat(value) === 0);

async function arrowState(button) {
  return button.evaluate(node => {
    const [normal, reveal] = node.querySelectorAll("img"); const buttonBox = node.getBoundingClientRect(); const normalBox = normal.getBoundingClientRect(); const paint = getComputedStyle(node, "::before"); const style = getComputedStyle(node);
    return {button: {x: buttonBox.x, y: buttonBox.y, width: buttonBox.width, height: buttonBox.height}, mascot: {x: normalBox.x, y: normalBox.y, width: normalBox.width, height: normalBox.height}, reveal: getComputedStyle(reveal).opacity, paintFilter: paint.filter, shadow: `${paint.boxShadow} ${style.boxShadow}`, durations: [paint.transitionDuration, style.transitionDuration], outline: style.outlineWidth};
  });
}

async function assertMascotContact(button, label) {
  const result = await button.evaluate(async node => {
    const image = node.querySelector("img"); await image.decode(); const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", {willReadFrequently: true}); context.drawImage(image, 0, 0); const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let bottom = -1; for (let y = canvas.height - 1; y >= 0 && bottom < 0; y -= 1) for (let x = 0, run = 0; x < canvas.width; x += 1) { run = pixels[(y * canvas.width + x) * 4 + 3] >= 240 ? run + 1 : 0; if (run >= 32) bottom = y; }
    const imageBox = image.getBoundingClientRect(); const buttonBox = node.getBoundingClientRect(); const paint = getComputedStyle(node, "::before"); return {contour: imageBox.top + (bottom + 1) * imageBox.height / canvas.height, plaque: buttonBox.bottom - Number.parseFloat(paint.bottom) - Number.parseFloat(paint.height)};
  });
  assert.ok(result.contour >= result.plaque && result.contour - result.plaque <= 3, `${label} opaque capybara contour remains seated on its plaque`);
}

async function assertNoRetiredHeaderControls(page) {
  assert.equal(await page.getByRole("combobox").count(), 0, "retired header combobox is absent");
  assert.equal(await page.getByRole("listbox").count(), 0, "retired header popup is absent");
  assert.equal(await page.locator("input[placeholder='Список задач...']").count(), 0, "retired header query is absent");
  assert.equal(await page.locator("button[aria-label='Очистить выбор задачи']").count(), 0, "retired header clear action is absent");
  assert.equal(await page.locator("button[aria-controls='headerTaskListMenu']").count(), 0, "retired dropdown toggle is absent");
}

async function openFromCatalogue(page, title) {
  await page.getByRole("button", {name: "All tasks"}).click();
  const search = page.getByRole("searchbox", {name: "Search tasks"}); await search.fill(title);
  await page.locator("section[aria-labelledby='taskListTitle']").filter({hasText: title}).getByRole("button", {name: /^Open(?: |$)/}).click();
  await page.getByText(title, {exact: true}).waitFor();
}

function assertClean(diagnostics) {
  assert.deepEqual(diagnostics.console, []); assert.deepEqual(diagnostics.page, []); assert.deepEqual(diagnostics.request, []); assert.deepEqual(diagnostics.response, []);
  assert.deepEqual(diagnostics.catalogRequests, [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`], "fixture performs exactly one inert catalogue GET");
}

test("static identity replaces header query while desktop capybara navigation retains focus, reveal, contact, and catalogue flow", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 1536, height: 1024}}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page); const previous = page.getByRole("button", {name: "Select previous task"}); const next = page.getByRole("button", {name: "Select next task"}); const allTasks = page.getByRole("button", {name: "All tasks"}); const ordinal = page.getByText("TASK 01", {exact: true}); const title = page.getByText("Tortoise race", {exact: true});
    await Promise.all([previous.waitFor(), next.waitFor(), allTasks.waitFor(), ordinal.waitFor(), title.waitFor()]); await assertNoRetiredHeaderControls(page);
    const [allBox, titleBox] = await Promise.all([allTasks.boundingBox(), title.boundingBox()]); assert.ok(allBox.width >= 44 && allBox.height >= 44, "18px All tasks retains a 44px hit target"); assert.equal(await allTasks.evaluate(node => getComputedStyle(node).fontSize), "18px", "All tasks has the selected 18px scale"); assert.equal(intersects(allBox, titleBox), false, "All tasks does not cover static title");
    assert.equal(await title.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); return [...range.getClientRects()].every(rect => rect.width > 0 && rect.height > 0); }), true, "static title exposes readable rendered lines");
    await assertMascotContact(previous, "previous"); await assertMascotContact(next, "next");
    await allTasks.focus(); await page.keyboard.press("Tab"); assert.equal(await previous.evaluate(node => node === document.activeElement), true, "previous arrow remains the desktop keyboard stop after All tasks"); const focus = await arrowState(previous); assert.ok(Number.parseFloat(focus.outline) > 0 && focus.reveal === "1", "focused arrow retains outline and reveal");
    for (const [arrow, expectedTitle] of [[next, "A deliberately long task title"], [previous, "Tortoise race"]]) {
      const before = await arrowState(arrow);
      const body = center(before.mascot);
      await page.mouse.move(body.x, body.y);
      await settle(page);
      const hover = await arrowState(arrow);
      assert.ok(Math.abs(Number.parseFloat(/brightness\(([^)]+)\)/.exec(hover.paintFilter)?.[1]) - 1.04) < .01, "hover keeps the approved plaque brightness");
      assert.equal(hover.reveal, "1", "hover reveals the capybara");
      assert.equal(await arrow.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), body), true, "mascot paint belongs to arrow hit target");
      await page.mouse.down();
      await settle(page);
      assert.notEqual((await arrowState(arrow)).shadow, hover.shadow, "pressed plaque changes its settled hover shadow");
      await page.mouse.up();
      await page.getByText(expectedTitle, {exact: false}).waitFor();
    }
    await openFromCatalogue(page, "Third independent task"); assert.equal(await page.getByText("TASK 03", {exact: true}).count(), 1, "catalogue Open updates static ordinal"); await assertNoRetiredHeaderControls(page); assertClean(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("static identity is readable without arrows at <=600 and preserves desktop arrow geometry above breakpoint", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 320, height: 900}}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page); await openFromCatalogue(page, "A deliberately long task title that must wrap without covering controls"); const title = page.getByText("A deliberately long task title that must wrap without covering controls", {exact: true}); const ordinal = page.getByText("TASK 02", {exact: true}); const allTasks = page.getByRole("button", {name: "All tasks"}); const previous = page.getByRole("button", {name: "Select previous task", includeHidden: true}); const next = page.getByRole("button", {name: "Select next task", includeHidden: true});
    for (const width of [320, 390, 600]) {
      await page.setViewportSize({width, height: 900});
      await assertNoRetiredHeaderControls(page);
      assert.equal(await previous.boundingBox(), null, `previous has no compact box at ${width}px`);
      assert.equal(await next.boundingBox(), null, `next has no compact box at ${width}px`);
      assert.equal(await page.getByRole("button", {name: "Select previous task"}).count(), 0, `previous absent from compact accessibility at ${width}px`);
      assert.equal(await page.getByRole("button", {name: "Select next task"}).count(), 0, `next absent from compact accessibility at ${width}px`);
      const [allBox, titleBox, ordinalBox] = await Promise.all([allTasks.boundingBox(), title.boundingBox(), ordinal.boundingBox()]);
      assert.ok(allBox.width >= 44 && allBox.height >= 44 && !intersects(allBox, titleBox) && !intersects(allBox, ordinalBox), `All tasks retains isolated hit geometry at ${width}px`);
      const lines = await title.evaluate(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const owner = node.parentElement.getBoundingClientRect();
        return {
          owner: {left: owner.left, right: owner.right},
          lines: [...range.getClientRects()].map(rect => ({left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom})),
        };
      });
      assert.ok(lines.lines.length >= (width < 600 ? 2 : 1), `long selected title remains readable at ${width}px`);
      for (const line of lines.lines) assert.ok(line.left >= lines.owner.left && line.right <= lines.owner.right, `long title line stays contained at ${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `no horizontal overflow at ${width}px`);
    }
    for (const width of [601, 1250, 1536]) {
      await page.setViewportSize({width, height: 900});
      for (const arrow of [previous, next]) {
        const box = await arrow.boundingBox();
        assert.ok(box && box.width > 0 && box.height > 0, `arrow restores layout at ${width}px`);
        await assertMascotContact(arrow, `arrow at ${width}px`);
      }
      if (width === 1250) {
        const edgeHits = await allTasks.evaluate(node => { const box = node.getBoundingClientRect(); const y = box.top + box.height / 2; return [box.left + 2, box.left + box.width / 2, box.right - 2].map(x => node.contains(document.elementFromPoint(x, y))); });
        assert.deepEqual(edgeHits, [true, true, true], "All tasks preserves 1250px left, centre, and right hit geometry");
      }
      if (width === 1536) {
        const shelf = await page.evaluate(() => { const previous = document.querySelector('[aria-label="Select previous task"]'); const next = document.querySelector('[aria-label="Select next task"]'); let header = previous?.parentElement; while (header && (!header.contains(next) || header.nextElementSibling?.getAttribute("aria-hidden") !== "true")) header = header.parentElement; const shelf = header?.nextElementSibling; if (!shelf) throw new Error("dashboard shelf is unavailable"); return {top: shelf.getBoundingClientRect().top, bottoms: [previous, next].map(node => node.getBoundingClientRect().bottom)}; });
        for (const bottom of shelf.bottoms) assert.ok(Math.abs(bottom - shelf.top) <= 3, "desktop plaque remains seated on shelf support");
      }
    }
    assertClean(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("desktop arrows remain disabled during loading and honor reduced motion", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 780, height: 900}, reducedMotion: "reduce"}); const page = await context.newPage(); let release;
  try {
    const diagnostics = {console: [], page: [], request: [], response: [], catalogRequests: []}; page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); }); page.on("pageerror", error => diagnostics.page.push(error.message)); page.on("requestfailed", request => diagnostics.request.push(request.url())); page.on("response", response => { if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`); }); const held = new Promise(resolve => { release = resolve; }); await page.route("**/task-catalog.v1.json", async route => { diagnostics.catalogRequests.push(`${route.request().method()} ${route.request().url()}`); await held; await route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}); });
    assert.equal((await page.goto(baseUrl, {waitUntil: "domcontentloaded"}))?.status(), 200); const previous = page.getByRole("button", {name: "Select previous task"}); await previous.waitFor(); assert.equal(await previous.isDisabled(), true); const before = await arrowState(previous); await page.mouse.move(...Object.values(center(before.mascot))); await settle(page); const after = await arrowState(previous); assert.equal(after.reveal, "0", "disabled arrow does not reveal"); assert.equal(after.paintFilter, before.paintFilter, "disabled arrow does not hover"); assert.equal(zeroDurations(after.durations), true, "reduced motion removes arrow transitions"); release(); await page.getByText("Tortoise race", {exact: true}).waitFor(); assert.equal(await previous.isDisabled(), false, "loaded catalogue enables arrow"); assertClean(diagnostics);
  } finally { if (release) release(); await context.close(); await browser.close(); }
});
