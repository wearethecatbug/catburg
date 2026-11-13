const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
const catalog = {version: 1, tasks: [
  {id: "race", title: "Tortoise race", description: "First", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "long", title: "A deliberately long task title that must wrap without covering controls", description: "Long", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "third", title: "Third independent task", description: "Third", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "anagrams", title: "Check Whether Two Strings Are Anagrams", description: "Task 11 title fixture.", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
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
const settle = page => page.waitForTimeout(240);
const zeroDurations = values => values.flatMap(value => value.split(",")).every(value => Number.parseFloat(value) === 0);
const assertClose = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= .08, `${message}: expected ${expected}, received ${actual}`);
const translateY = transform => transform === "none" ? 0 : Number.parseFloat(/matrix\((?:[^,]+,){5}\s*([^)]+)\)/.exec(transform)?.[1]);

async function arrowState(button) {
  return button.evaluate(node => {
    const [normal, reveal] = node.querySelectorAll("img"); const buttonBox = node.getBoundingClientRect(); const normalBox = normal.getBoundingClientRect(); const paint = getComputedStyle(node, "::before"); const style = getComputedStyle(node);
    return {button: {x: buttonBox.x, y: buttonBox.y, width: buttonBox.width, height: buttonBox.height}, plaque: {width: Number.parseFloat(paint.width), height: Number.parseFloat(paint.height)}, mascot: {x: normalBox.x, y: normalBox.y, width: normalBox.width, height: normalBox.height}, reveal: getComputedStyle(reveal).opacity, paintFilter: paint.filter, shadow: `${paint.boxShadow} ${style.boxShadow}`, transform: style.transform, durations: [paint.transitionDuration, style.transitionDuration], outline: style.outlineWidth};
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

async function titleGeometry(page, title) {
  return title.evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const shelf = document.querySelector('[class*="__taskShelf"]');
    if (!shelf) throw new Error("task header shelf is unavailable");
    const style = getComputedStyle(node);
    return {
      shelfTop: shelf.getBoundingClientRect().top,
      lines: [...range.getClientRects()].map(rect => ({bottom: rect.bottom, left: rect.left, right: rect.right})),
      overflow: style.overflow,
      lineClamp: style.webkitLineClamp,
    };
  });
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
      assertClose(before.button.width, 103.96, "desktop arrow uses the approved 103.96px hit width");
      assertClose(before.button.height, 48, "desktop arrow uses the approved 48px hit height");
      assertClose(before.plaque.width, 93.79, "desktop arrow uses the approved 93.79px plaque width");
      assertClose(before.plaque.height, 43, "desktop arrow uses the approved 43px plaque height");
      const body = center(before.mascot);
      await page.mouse.move(body.x, body.y);
      await settle(page);
      const hover = await arrowState(arrow);
      assert.equal(hover.paintFilter, "none", "hover keeps the approved plaque color without a brightness filter");
      assertClose(translateY(hover.transform), -2, "hover lifts the complete arrow control by 2px");
      assert.notEqual(hover.shadow, before.shadow, "hover deepens the Back-style plaque shadow");
      assert.equal(hover.reveal, "1", "hover reveals the capybara");
      assert.equal(await arrow.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), body), true, "mascot paint belongs to arrow hit target");
      await page.mouse.down();
      await settle(page);
      const active = await arrowState(arrow);
      assert.equal(active.paintFilter, "none", "pressed arrow keeps the approved unfiltered plaque color");
      assertClose(translateY(active.transform), 3, "pressed arrow settles 3px below its resting position");
      assert.notEqual(active.shadow, hover.shadow, "pressed plaque changes its settled hover shadow");
      await page.mouse.up();
      await page.getByText(expectedTitle, {exact: false}).waitFor();
    }
    await openFromCatalogue(page, "Third independent task"); assert.equal(await page.getByText("TASK 03", {exact: true}).count(), 1, "catalogue Open updates static ordinal"); await assertNoRetiredHeaderControls(page); assertClean(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("static identity keeps native sage arrows only through the approved <=430px mobile range", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 320, height: 900}}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page); await openFromCatalogue(page, "A deliberately long task title that must wrap without covering controls"); const title = page.getByText("A deliberately long task title that must wrap without covering controls", {exact: true}); const ordinal = page.getByText("TASK 02", {exact: true}); const allTasks = page.getByRole("button", {name: "All tasks"}); const previous = page.getByRole("button", {name: "Select previous task", includeHidden: true}); const next = page.getByRole("button", {name: "Select next task", includeHidden: true});
    for (const width of [320, 321, 390, 430, 431, 600]) {
      await page.setViewportSize({width, height: 900});
      await assertNoRetiredHeaderControls(page);
      const compactArrows = width <= 430;
      if (compactArrows) {
        const [previousBox, nextBox] = await Promise.all([previous.boundingBox(), next.boundingBox()]);
        assert.ok(previousBox && nextBox, `${width}px keeps both compact arrows in layout`);
        assert.equal(await page.getByRole("button", {name: "Select previous task"}).count(), 1, `previous remains accessible at ${width}px`);
        assert.equal(await page.getByRole("button", {name: "Select next task"}).count(), 1, `next remains accessible at ${width}px`);
        for (const [name, box] of [["previous", previousBox], ["next", nextBox]]) {
          assert.deepEqual([Math.round(box.width), Math.round(box.height)], [44, 44], `${width}px ${name} keeps a 44px native target`);
        }
        await allTasks.focus();
        await page.keyboard.press("Tab");
        assert.equal(await previous.evaluate(node => node === document.activeElement && node.matches(":focus-visible")), true, `${width}px previous arrow keeps a visible keyboard focus`);
        if (width === 390) {
          await page.mouse.move(...Object.values(center(previousBox)));
          await settle(page);
          assertClose(translateY(await previous.evaluate(node => getComputedStyle(node).transform)), -2, "390px sage arrow retains the Back-style hover lift");
        }
      } else {
        assert.equal(await previous.boundingBox(), null, `previous has no intermediate compact box at ${width}px`);
        assert.equal(await next.boundingBox(), null, `next has no intermediate compact box at ${width}px`);
        assert.equal(await page.getByRole("button", {name: "Select previous task"}).count(), 0, `previous is absent from intermediate compact accessibility at ${width}px`);
        assert.equal(await page.getByRole("button", {name: "Select next task"}).count(), 0, `next is absent from intermediate compact accessibility at ${width}px`);
      }
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
    await page.setViewportSize({width: 390, height: 900});
    await next.focus();
    await page.keyboard.press("Enter");
    await page.getByText("Third independent task", {exact: true}).waitFor();
    const nextBox = await next.boundingBox();
    assert.ok(nextBox, "390px next arrow remains pointer-operable after keyboard navigation");
    await page.getByRole("button", {name: "Select previous task"}).click();
    await title.waitFor();
    assert.equal(await page.getByText("TASK 02", {exact: true}).count(), 1, "390px pointer navigation returns to the selected task");
    for (const width of [601, 1250, 1536]) {
      await page.setViewportSize({width, height: 900});
      for (const arrow of [previous, next]) {
        const box = await arrow.boundingBox();
        assert.ok(box && box.width > 0 && box.height > 0, `arrow restores layout at ${width}px`);
        assertClose(box.width, 103.96, `arrow keeps its approved desktop width at ${width}px`);
        assertClose(box.height, 48, `arrow keeps its approved desktop height at ${width}px`);
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

test("task headers retain every title line and clear the shelf through the desktop transition", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 1440, height: 900}}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    const anagramTitle = "Check Whether Two Strings Are Anagrams";
    await openFromCatalogue(page, anagramTitle);
    const anagrams = page.getByRole("heading", {name: anagramTitle, exact: true});
    for (const width of [1440, 1221, 1220, 1200, 768, 650, 601]) {
      await page.setViewportSize({width, height: 900});
      const geometry = await titleGeometry(page, anagrams);
      assert.equal(geometry.overflow, "visible", `${width}px Task 11 title is not clipped by its own box`);
      assert.notEqual(geometry.lineClamp, "2", `${width}px Task 11 title is not limited to two lines`);
      assert.ok(geometry.lines.at(-1).bottom <= geometry.shelfTop, `${width}px Task 11 final line clears the shelf`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `Task 11 has no horizontal overflow at ${width}px`);
    }

    const longTitle = "A deliberately long task title that must wrap without covering controls";
    await openFromCatalogue(page, longTitle);
    const long = page.getByRole("heading", {name: longTitle, exact: true});
    for (const width of [768, 650, 601]) {
      await page.setViewportSize({width, height: 900});
      const geometry = await titleGeometry(page, long);
      assert.ok(geometry.lines.length >= 3, `${width}px long task title renders beyond two lines`);
      assert.equal(geometry.overflow, "visible", `${width}px long task title has no clipping box`);
      assert.ok(geometry.lines.at(-1).bottom <= geometry.shelfTop, `${width}px long task title clears the shelf`);
    }
    assertClean(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("desktop arrows remain disabled during loading and honor reduced motion", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 780, height: 900}, reducedMotion: "reduce"}); const page = await context.newPage(); let release;
  try {
    const diagnostics = {console: [], page: [], request: [], response: [], catalogRequests: []}; page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); }); page.on("pageerror", error => diagnostics.page.push(error.message)); page.on("requestfailed", request => diagnostics.request.push(request.url())); page.on("response", response => { if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`); }); const held = new Promise(resolve => { release = resolve; }); await page.route("**/task-catalog.v1.json", async route => { diagnostics.catalogRequests.push(`${route.request().method()} ${route.request().url()}`); await held; await route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}); });
    assert.equal((await page.goto(baseUrl, {waitUntil: "domcontentloaded"}))?.status(), 200); const previous = page.getByRole("button", {name: "Select previous task"}); await previous.waitFor(); assert.equal(await previous.isDisabled(), true); const before = await arrowState(previous); await page.mouse.move(...Object.values(center(before.mascot))); await settle(page); const after = await arrowState(previous); assert.equal(after.reveal, "0", "disabled arrow does not reveal"); assert.equal(after.paintFilter, before.paintFilter, "disabled arrow does not hover"); assertClose(translateY(after.transform), 0, "reduced-motion disabled arrow does not translate"); assert.equal(zeroDurations(after.durations), true, "reduced motion removes arrow transitions"); release(); await page.getByText("Tortoise race", {exact: true}).waitFor(); assert.equal(await previous.isDisabled(), false, "loaded catalogue enables arrow"); assertClean(diagnostics);
  } finally { if (release) release(); await context.close(); await browser.close(); }
});

test("mobile sage arrows honor reduced motion without losing their native focus targets", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true}); const context = await browser.newContext({viewport: {width: 390, height: 900}, reducedMotion: "reduce"}); const page = await context.newPage();
  try {
    const diagnostics = await prepare(page); const previous = page.getByRole("button", {name: "Select previous task"}); await previous.waitFor();
    const box = await previous.boundingBox(); assert.ok(box, "390px reduced-motion previous arrow remains rendered");
    await page.getByRole("button", {name: "All tasks"}).focus(); await page.keyboard.press("Tab"); assert.equal(await previous.evaluate(node => node === document.activeElement && node.matches(":focus-visible")), true, "390px reduced-motion previous arrow retains visible focus");
    await page.mouse.move(...Object.values(center(box))); await settle(page);
    const style = await previous.evaluate(node => ({transform: getComputedStyle(node).transform, duration: getComputedStyle(node).transitionDuration}));
    assertClose(translateY(style.transform), 0, "390px reduced-motion hover does not translate the arrow");
    assert.equal(zeroDurations([style.duration]), true, "390px reduced-motion arrow removes its transition");
    assertClean(diagnostics);
  } finally { await context.close(); await browser.close(); }
});
