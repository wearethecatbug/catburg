const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
// Valid inert fixtures exercise catalog navigation without running supplied task code.
const catalog = {version: 1, tasks: [
  {id: "race", title: "Tortoise race", description: "First", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "long", title: "A deliberately long task title that must wrap without covering controls", description: "Long", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
  {id: "third", title: "Third independent task", description: "Third", entryPoint: "echo", starterCode: "function echo() {}", solution: "function echo() {}", tests: [{args: ["fixture"], expected: "fixture"}]},
]};

async function prepare(page, source = catalog) {
  const diagnostics = {console: [], page: [], request: [], response: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.request.push(request.url()));
  page.on("response", response => { if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`); });
  await page.route("**/task-catalog.v1.json", route => route.fulfill({contentType: "application/json", body: JSON.stringify(source)}));
  assert.equal((await page.goto(baseUrl, {waitUntil: "domcontentloaded"})).status(), 200);
  return diagnostics;
}

const settle = page => page.waitForTimeout(180);
const center = box => ({x: box.x + box.width / 2, y: box.y + box.height / 2});
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const hasOnlyZeroDurations = durations => durations.flatMap(value => value.split(",")).every(value => Number.parseFloat(value) === 0);

async function waitForDescriptionFocus(page) {
  // Selected-task setup owns this queued focus before the keyboard traversal takes ownership.
  const description = page.getByLabel("Описание задачи");
  await description.waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Описание задачи");
}

async function state(button) {
  return button.evaluate(node => {
    const [normal, reveal] = node.querySelectorAll("img");
    const r = node.getBoundingClientRect();
    const mascot = normal.getBoundingClientRect();
    const paint = getComputedStyle(node, "::before");
    const buttonStyle = getComputedStyle(node);
    const filters = [];
    for (let item = normal; item; item = item.parentElement) {
      filters.push(getComputedStyle(item).filter);
      if (item === node) break;
    }
    return {button: {x: r.x, y: r.y, width: r.width, height: r.height}, mascot: {x: mascot.x, y: mascot.y, width: mascot.width, height: mascot.height}, paintFilter: paint.filter, shadow: `${paint.boxShadow} ${buttonStyle.boxShadow}`, transition: `${paint.transition} ${buttonStyle.transition}`, durations: [paint.transitionDuration, buttonStyle.transitionDuration], outline: buttonStyle.outlineColor, outlineStyle: buttonStyle.outlineStyle, outlineWidth: buttonStyle.outlineWidth, normalOpacity: getComputedStyle(normal).opacity, revealOpacity: getComputedStyle(reveal).opacity, filters, arrowColor: getComputedStyle(node.querySelector("span:last-child")).color};
  });
}

async function catOnlyPoint(button) {
  return button.evaluate(node => {
    const [normal, reveal] = node.querySelectorAll("img");
    const canvas = document.createElement("canvas");
    canvas.width = reveal.naturalWidth;
    canvas.height = reveal.naturalHeight;
    const context = canvas.getContext("2d", {willReadFrequently: true});
    context.drawImage(normal, 0, 0);
    const before = context.getImageData(0, 0, canvas.width, canvas.height).data;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(reveal, 0, 0);
    const after = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const rect = reveal.getBoundingClientRect();
    // Compare decoded art to find a clickable cat-only pixel, including mirrored right-side art.
    const mirrored = getComputedStyle(reveal.parentElement).transform.includes("-");
    for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      if (before[offset + 3] < 4 && after[offset + 3] > 200) {
        const scaledX = (x + .5) * rect.width / canvas.width;
        return {x: mirrored ? rect.right - scaledX : rect.left + scaledX, y: rect.top + (y + .5) * rect.height / canvas.height};
      }
    }
    return null;
  });
}

async function assertMascotAssetsDecoded(button) {
  const dimensions = await button.evaluate(async node => {
    const images = [...node.querySelectorAll("img")];
    await Promise.all(images.map(image => image.decode()));
    return images.map(image => [image.naturalWidth, image.naturalHeight]);
  });
  assert.equal(dimensions.length, 2, "each arrow has normal and revealed mascot images");
  assert.ok(dimensions.every(([width, height]) => width > 0 && height > 0), "mascot images decode before pixel sampling");
  assert.deepEqual(dimensions[0], dimensions[1], "normal and reveal art share one canvas");
}

async function assertReachable(page, locator, width, label) {
  const box = await locator.boundingBox();
  assert.ok(box, `${label} renders at ${width}px`);
  assert.ok(box.x >= 0 && box.x + box.width <= width, `${label} fits at ${width}px`);
  assert.equal(await locator.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), center(box)), true, `${label} hit-tests at ${width}px`);
  return box;
}

async function assertAllTasksEdgesReachable(locator, width) {
  const hitTargets = await locator.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    return [rect.left + 2, rect.left + rect.width / 2, rect.right - 2].map(x =>
      node.contains(document.elementFromPoint(x, y)));
  });
  assert.deepEqual(hitTargets, [true, true, true], `All tasks center and edges hit-test at ${width}px`);
}

async function assertNotClippedByOverflowAncestor(locator, label, width) {
  const clipped = await locator.evaluate(node => {
    const rect = node.getBoundingClientRect();
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const clipsX = /hidden|clip|scroll|auto/.test(style.overflowX);
      const clipsY = /hidden|clip|scroll|auto/.test(style.overflowY);
      if (!clipsX && !clipsY) continue;
      const ancestorRect = ancestor.getBoundingClientRect();
      if ((clipsX && (rect.left < ancestorRect.left || rect.right > ancestorRect.right)) ||
          (clipsY && (rect.top < ancestorRect.top || rect.bottom > ancestorRect.bottom))) return true;
    }
    return false;
  });
  assert.equal(clipped, false, `${label} is not clipped by an overflow ancestor at ${width}px`);
}

test("header navigation preserves task heading, selector, mascot target, plaque states, and shelf support", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1536, height: 1024}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    const previous = page.getByRole("button", {name: "Select previous task"});
    const next = page.getByRole("button", {name: "Select next task"});
    const selector = page.getByRole("combobox");
    const clear = page.getByRole("button", {name: "Очистить выбор задачи"});
    await Promise.all([previous.waitFor(), next.waitFor(), selector.waitFor(), clear.waitFor()]);
    const number = page.getByText("TASK 01", {exact: true});
    const title = page.getByText("Tortoise race", {exact: true});
    await Promise.all([number.waitFor(), title.waitFor()]);
    await waitForDescriptionFocus(page);

    const type = await page.evaluate(() => {
      const leaf = text => [...document.querySelectorAll("*")].find(node => node.textContent?.trim() === text && !node.querySelector("*"));
      const number = leaf("TASK 01");
      const title = leaf("Tortoise race");
      const n = getComputedStyle(number), t = getComputedStyle(title);
      const nr = number.getBoundingClientRect(), tr = title.getBoundingClientRect();
      return {number: [n.fontSize, n.fontWeight, n.letterSpacing, n.color, nr.bottom], title: [t.fontSize, t.fontWeight, t.color, tr.top]};
    });
    assert.deepEqual(type.number.slice(0, 4), ["20px", "500", "0.9px", "rgb(35, 75, 54)"]);
    assert.deepEqual(type.title.slice(0, 3), ["36px", "650", "rgb(35, 75, 54)"]);
    assert.ok(type.number[4] <= type.title[3], "number is above title");

    await clear.click();
    assert.equal(await selector.inputValue(), "", "clear starts real typing from an empty query");
    assert.equal(await selector.evaluate(node => node === document.activeElement), true, "clear gives the editable input keyboard ownership");
    // Sequential keys exercise the native input path; bulk fill cannot expose a first-key focus theft.
    await selector.pressSequentially("T", {delay: 75});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await selector.inputValue(), "T", "the first typed character is retained after queued effects");
    assert.equal(await selector.evaluate(node => node === document.activeElement), true, "the input retains focus after the first typed character");
    await selector.pressSequentially("hird", {delay: 75});
    assert.equal(await selector.inputValue(), "Third", "ordinary subsequent characters extend the query");
    await selector.press("ArrowLeft");
    await selector.press("Backspace");
    assert.equal(await selector.inputValue(), "Thid", "Backspace edits at the caret without losing the query");
    await selector.pressSequentially("r", {delay: 75});
    await selector.press("Shift+ArrowLeft");
    assert.deepEqual(await selector.evaluate(node => [node.selectionStart, node.selectionEnd]), [3, 4], "Shift+ArrowLeft selects the preceding character");
    await selector.press("ArrowRight");
    assert.deepEqual(await selector.evaluate(node => [node.selectionStart, node.selectionEnd]), [4, 4], "ArrowRight collapses the selection at its end");
    assert.equal(await selector.inputValue(), "Third", "modifier/caret editing preserves the restored query");
    assert.equal(await selector.evaluate(node => node === document.activeElement), true, "editing keeps focus in the query input");
    await page.getByRole("option", {name: /Third independent task/}).waitFor();
    await selector.press("Tab");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await clear.evaluate(node => node === document.activeElement), true, "Tab from a typed query stays on Clear after queued popup effects");
    assert.equal(await selector.inputValue(), "Third", "Tab retains the editable query");
    await selector.focus();
    await selector.press("Escape");
    assert.equal(await selector.getAttribute("aria-expanded"), "false", "Escape closes editable selector");
    await clear.click();
    assert.equal(await selector.inputValue(), "", "clear keeps selector behavior");
    assert.equal(await selector.evaluate(node => node === document.activeElement), true, "clear restores selector focus");
    // Real keyboard input is covered above; this bulk value only selects the known task for later navigation checks.
    await selector.fill("Tortoise");
    await page.getByRole("option", {name: /Tortoise race/}).click();
    await page.getByText("Tortoise race", {exact: true}).waitFor();
    await waitForDescriptionFocus(page);

    const allTasks = page.getByRole("button", {name: "All tasks"});
    await allTasks.focus();
    await page.keyboard.press("Tab");
    assert.equal(await previous.evaluate(node => node === document.activeElement), true, "previous arrow is one keyboard stop after All tasks");
    const keyboardPrevious = await state(previous);
    assert.notEqual(keyboardPrevious.outline, "rgba(0, 0, 0, 0)", "Tab gives the arrow a nontransparent focus outline");
    assert.notEqual(keyboardPrevious.outlineStyle, "none", "Tab gives the arrow a visible focus outline style");
    assert.ok(Number.parseFloat(keyboardPrevious.outlineWidth) > 0, "Tab gives the arrow a positive focus outline width");
    assert.equal(keyboardPrevious.revealOpacity, "1", "keyboard focus reveals the cat");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "combobox");
    assert.equal(await selector.evaluate(node => node === document.activeElement), true, "selector follows previous arrow in keyboard order");
    assert.equal(await selector.getAttribute("aria-expanded"), "false", "keyboard focus leaves the selected selector popup closed");
    assert.equal(await number.isVisible(), true, "focused selector keeps the task number visible");
    assert.equal(await title.isVisible(), true, "focused selector keeps the task title visible");
    const desktopCaret = await selector.evaluate(node => {
      const style = getComputedStyle(node);
      return {caretColor: style.caretColor, textColor: style.color};
    });
    assert.notEqual(desktopCaret.caretColor, "rgba(0, 0, 0, 0)", "focused selected selector has a nontransparent desktop caret");
    assert.notEqual(desktopCaret.caretColor, desktopCaret.textColor, "desktop caret remains distinguishable from hidden input text");
    const desktopValue = await selector.inputValue();
    await selector.press("End");
    assert.deepEqual(await selector.evaluate(node => [node.selectionStart, node.selectionEnd]), [desktopValue.length, desktopValue.length], "End places the desktop caret at the selected value end");
    await selector.press("ArrowLeft");
    assert.deepEqual(await selector.evaluate(node => [node.selectionStart, node.selectionEnd]), [desktopValue.length - 1, desktopValue.length - 1], "desktop ArrowLeft moves the collapsed caret one character");
    await selector.press("ArrowRight");
    assert.deepEqual(await selector.evaluate(node => [node.selectionStart, node.selectionEnd]), [desktopValue.length, desktopValue.length], "desktop ArrowLeft/ArrowRight restores a collapsed caret");
    await selector.click({position: {x: 12, y: 12}});
    assert.equal(await selector.inputValue(), desktopValue, "desktop mouse caret placement preserves the selected query");
    assert.equal(await selector.evaluate(node => node === document.activeElement && node.selectionStart === node.selectionEnd), true, "desktop mouse click leaves a collapsed focused caret");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Очистить выбор задачи");
    assert.equal(await clear.evaluate(node => node === document.activeElement), true, "clear action stays in keyboard order");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Select next task");
    assert.equal(await next.evaluate(node => node === document.activeElement), true, "next arrow is one keyboard stop after clear");
    assert.equal(await previous.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').count(), 0, "previous mascot adds no focusable descendants");
    assert.equal(await next.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').count(), 0, "next mascot adds no focusable descendants");

    for (const [button, bodyTitle, catTitle] of [[next, "A deliberately long task title", "Third independent task"], [previous, "A deliberately long task title", "Tortoise race"]]) {
      const initial = await state(button);
      let body = center(initial.mascot);
      await page.mouse.move(body.x, body.y);
      await settle(page);
      const hover = await state(button);
      assert.match(hover.paintFilter, /brightness\(1\.04\)/);
      assert.match(hover.transition, /(filter|box-shadow) 0\.16s/);
      assert.match(hover.shadow, /rgba\(255, 214, 153/);
      assert.notEqual(hover.arrowColor, initial.arrowColor, "arrow darkens on hover");
      assert.deepEqual(hover.mascot, initial.mascot, "hover leaves mascot geometry stable");
      assert.ok(hover.filters.every(filter => filter === "none"), "plaque filter never reaches mascot ancestors");
      assert.equal(await button.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), body), true, "capybara belongs to button hit target");
      await page.mouse.click(body.x, body.y);
      await page.getByText(bodyTitle, {exact: false}).waitFor();
      // Selection can reflow the header; use its current mascot geometry for the next hit target.
      let current = await state(button);
      body = center(current.mascot);
      await page.mouse.move(center(current.button).x, center(current.button).y);
      await page.mouse.move(body.x, body.y);
      await settle(page);
      assert.equal((await state(button)).revealOpacity, "1", "hover reveals cat");
      await assertMascotAssetsDecoded(button);
      const cat = await catOnlyPoint(button);
      assert.ok(cat, "hover artwork has cat-only opaque pixel");
      assert.equal(await button.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), cat), true, "cat belongs to same button hit target");
      await page.mouse.move(cat.x, cat.y);
      await page.mouse.click(cat.x, cat.y);
      await page.getByText(catTitle, {exact: false}).waitFor();
      current = await state(button);
      body = center(current.mascot);
      await page.mouse.move(center(current.button).x, center(current.button).y);
      await page.mouse.move(body.x, body.y);
      await settle(page);
      assert.equal((await state(button)).revealOpacity, "1", "plaque-to-mascot pointer travel does not flicker");
    }

    const press = center((await state(next)).button);
    await page.mouse.move(press.x, press.y);
    await settle(page);
    const hoverBeforePress = await state(next);
    await page.mouse.down();
    await settle(page);
    assert.notEqual((await state(next)).shadow, hoverBeforePress.shadow, "pressed plaque changes its settled hover shadow");
    await page.mouse.up();

    const longTitle = page.getByText("A deliberately long task title that must wrap without covering controls", {exact: true});
    const longNumber = page.getByText("TASK 02", {exact: true});
    await longTitle.waitFor();
    await longNumber.waitFor();
    const [longBox, previousBox, nextBox] = await Promise.all([longTitle.boundingBox(), previous.boundingBox(), next.boundingBox()]);
    assert.ok(longBox.height > 36, "long title wraps");
    assert.equal(intersects(longBox, previousBox), false, "long title does not cover previous arrow");
    assert.equal(intersects(longBox, nextBox), false, "long title does not cover next arrow");

    for (const width of [1536, 1250, 1201, 1200, 780, 390, 780, 1200, 1201, 1250, 1536]) {
      await page.setViewportSize({width, height: 900});
      const [previousBoxAtWidth, selectorBox, nextBoxAtWidth, numberBoxAtWidth, titleBoxAtWidth, allTasksBox, clearBox] = await Promise.all([
        assertReachable(page, previous, width, "previous"),
        assertReachable(page, selector, width, "selector"),
        assertReachable(page, next, width, "next"),
        longNumber.boundingBox(),
        longTitle.boundingBox(),
        allTasks.boundingBox(),
        clear.boundingBox(),
      ]);
      assert.ok(numberBoxAtWidth && titleBoxAtWidth && allTasksBox && clearBox, `long task identity and required controls render at ${width}px`);
      assert.equal(intersects(previousBoxAtWidth, selectorBox), false, `previous/selector do not overlap at ${width}px`);
      assert.equal(intersects(nextBoxAtWidth, selectorBox), false, `next/selector do not overlap at ${width}px`);
      const shelf = await page.evaluate(() => {
        const previousArrow = document.querySelector('[aria-label="Select previous task"]');
        const nextArrow = document.querySelector('[aria-label="Select next task"]');
        let header = previousArrow.parentElement;
        while (header && (!header.contains(nextArrow) || header.nextElementSibling?.getAttribute("aria-hidden") !== "true")) header = header.parentElement;
        const element = header?.nextElementSibling;
        if (!element) throw new Error("Dashboard shelf missing");
        const rect = element.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        return {left: rect.left, right: rect.right, top: rect.top, height: rect.height, headerTop: headerRect.top, headerBottom: headerRect.bottom, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, arrows: [previousArrow, nextArrow].map(arrow => { const box = arrow.getBoundingClientRect(); return {centerX: box.left + box.width / 2, bottom: box.bottom}; })};
      });
      for (const [box, label] of [[numberBoxAtWidth, "task number"], [titleBoxAtWidth, "long title"]]) {
        assert.equal(intersects(box, allTasksBox), false, `${label} does not cover All tasks at ${width}px`);
        assert.equal(intersects(box, clearBox), false, `${label} does not cover Clear at ${width}px`);
        assert.ok(box.y >= shelf.headerTop && box.y + box.height <= shelf.headerBottom, `${label} stays inside the header at ${width}px`);
        assert.ok(box.y + box.height <= shelf.top, `${label} stays above the shelf at ${width}px`);
      }
      await assertNotClippedByOverflowAncestor(longNumber, "task number", width);
      await assertNotClippedByOverflowAncestor(longTitle, "long title", width);
      if ([1250, 1201, 1200].includes(width)) await assertAllTasksEdgesReachable(allTasks, width);
      if (width === 390) {
        await allTasks.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "combobox");
        assert.equal(await selector.getAttribute("aria-expanded"), "false", "narrow keyboard focus leaves the selected selector popup closed");
        assert.equal(await longNumber.isVisible(), true, "narrow focused selector keeps the task number visible");
        assert.equal(await longTitle.isVisible(), true, "narrow focused selector keeps the task title visible");
        const narrowCaret = await selector.evaluate(node => {
          const style = getComputedStyle(node);
          return {caretColor: style.caretColor, textColor: style.color};
        });
        assert.notEqual(narrowCaret.caretColor, "rgba(0, 0, 0, 0)", "focused selected selector has a nontransparent narrow caret");
        assert.notEqual(narrowCaret.caretColor, narrowCaret.textColor, "narrow caret remains distinguishable from hidden input text");
        const narrowValue = await selector.inputValue();
        await selector.press("End");
        await selector.press("ArrowLeft");
        assert.deepEqual(await selector.evaluate(node => [node.selectionStart, node.selectionEnd]), [narrowValue.length - 1, narrowValue.length - 1], "narrow ArrowLeft moves the collapsed caret one character");
        await selector.press("ArrowRight");
        assert.deepEqual(await selector.evaluate(node => [node.selectionStart, node.selectionEnd]), [narrowValue.length, narrowValue.length], "narrow ArrowLeft/ArrowRight restores a collapsed caret");
        await selector.click({position: {x: 12, y: 12}});
        assert.equal(await selector.inputValue(), narrowValue, "narrow mouse caret placement preserves the selected query");
        assert.equal(await selector.evaluate(node => node === document.activeElement && node.selectionStart === node.selectionEnd), true, "narrow mouse click leaves a collapsed focused caret");
      }
      if (width === 1536) assert.ok(shelf.height > 10, "desktop shelf is thicker than 10px");
      assert.equal(shelf.overflow, 0, `no horizontal overflow at ${width}px`);
      for (const arrow of shelf.arrows) {
        assert.ok(arrow.centerX >= shelf.left && arrow.centerX <= shelf.right, `shelf supports plaque horizontally at ${width}px`);
        assert.ok(Math.abs(arrow.bottom - shelf.top) <= 3, `plaque is seated on shelf at ${width}px`);
      }
    }
    assert.deepEqual(diagnostics.console, []);
    assert.deepEqual(diagnostics.page, []);
    assert.deepEqual(diagnostics.request, []);
    assert.deepEqual(diagnostics.response, []);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("arrows are inert while a valid catalogue is loading and reduced motion removes their transitions", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 780, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = {console: [], page: [], request: [], response: []};
    page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
    page.on("pageerror", error => diagnostics.page.push(error.message));
    page.on("requestfailed", request => diagnostics.request.push(request.url()));
    page.on("response", response => { if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`); });
    let releaseCatalog;
    let observeCatalogRequest;
    const catalogRequestStarted = new Promise(resolve => { observeCatalogRequest = resolve; });
    const heldCatalog = new Promise(resolve => { releaseCatalog = resolve; });
    await page.route("**/task-catalog.v1.json", async route => {
      observeCatalogRequest();
      await heldCatalog;
      await route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
    });
    assert.equal((await page.goto(baseUrl, {waitUntil: "domcontentloaded"})).status(), 200);
    await catalogRequestStarted;
    const previous = page.getByRole("button", {name: "Select previous task"});
    const next = page.getByRole("button", {name: "Select next task"});
    await Promise.all([previous.waitFor(), next.waitFor()]);
    assert.equal(await previous.isDisabled(), true);
    assert.equal(await next.isDisabled(), true);
    const before = await state(previous);
    const body = center(before.mascot);
    await page.mouse.move(body.x, body.y);
    await settle(page);
    const after = await state(previous);
    assert.equal(after.revealOpacity, "0", "disabled arrow does not reveal cat");
    assert.equal(after.paintFilter, before.paintFilter, "disabled arrow does not hover");
    await page.mouse.click(body.x, body.y);
    assert.notEqual(await previous.evaluate(node => node === document.activeElement), true, "disabled button remains nonfocusable");
    assert.equal(hasOnlyZeroDurations(after.durations), true, "reduced motion makes every plaque and button transition duration zero");
    releaseCatalog();
    await page.getByText("Tortoise race", {exact: true}).waitFor();
    assert.equal(await previous.isDisabled(), false, "valid loaded catalogue enables navigation as the positive control");
    assert.deepEqual(diagnostics.console, []);
    assert.deepEqual(diagnostics.page, []);
    assert.deepEqual(diagnostics.request, []);
    assert.deepEqual(diagnostics.response, []);
  } finally {
    await context.close();
    await browser.close();
  }
});
