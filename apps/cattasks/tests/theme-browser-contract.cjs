const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43852";
const themeStorageKey = "cattasks-theme";
const light = {page: "rgb(214, 225, 212)", panel: "rgb(250, 251, 251)", editor: "rgb(255, 255, 254)", pet: "rgb(37, 69, 50)", catalogue: "rgb(247, 249, 246)", fileInput: "rgb(255, 253, 248)"};
const dark = {page: "rgb(16, 38, 47)", panel: "rgb(23, 46, 56)", editor: "rgb(16, 38, 47)"};
const catalog = {version: 1, tasks: Array.from({length: 24}, (_, index) => ({
  id: `theme-${index + 1}`, title: `Theme fixture ${index + 1}`,
  description: "Inert fixture; this oracle never executes entered code.", entryPoint: "echo",
  starterCode: `function echo(value) { return value + ${index + 1}; }`,
  solution: `function echo(value) { return value + ${index + 1}; }`,
  tests: [{args: ["fixture"], expected: `fixture${index + 1}`}],
}))};

function diagnosticsFor(page) {
  const diagnostics = {console: [], page: [], failed: [], responses: [], catalogRequests: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.failed.push(request.url()));
  page.on("response", response => { if (response.status() >= 400) diagnostics.responses.push(`${response.request().method()} ${response.status()} ${response.url()}`); });
  return diagnostics;
}
async function prepare(page) {
  const diagnostics = diagnosticsFor(page);
  await page.route("**/task-catalog.v1.json", route => {
    diagnostics.catalogRequests.push(`${route.request().method()} ${route.request().url()}`);
    return route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });
  const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
  assert.equal(response?.status(), 200, "the exact isolated loopback app loads");
  await page.getByRole("heading", {name: catalog.tasks[0].title, exact: true}).waitFor();
  await page.locator(".monaco-editor").first().waitFor({state: "visible"});
  await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));
  return diagnostics;
}
function assertDiagnostics(diagnostics, expectedCatalogRequests = 1) {
  assert.deepEqual(diagnostics.console, []);
  assert.deepEqual(diagnostics.page, []);
  assert.deepEqual(diagnostics.failed, []);
  assert.deepEqual(diagnostics.responses, []);
  assert.deepEqual(diagnostics.catalogRequests, Array.from({length: expectedCatalogRequests}, () => `GET ${new URL("/task-catalog.v1.json", baseUrl).href}`));
}
async function surface(page) {
  return page.evaluate(() => {
    const find = selector => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`missing theme surface ${selector}`);
      return element;
    };
    const paint = element => ({backgroundColor: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color});
    const models = window.monaco.editor.getModels();
    return {
      theme: find("[data-cattasks-theme]").getAttribute("data-cattasks-theme"),
      outer: paint(find("[class*='background']")),
      panel: paint(find("[class*='taskDetailsContainer']")),
      solution: paint(find("section[aria-labelledby='taskSolutionHeading']")),
      output: paint(find("section[aria-labelledby='taskOutputHeading']")),
      frame: paint(find("[class*='codeEditorFrame']")),
      pet: paint(find("[aria-label='Pet feeding strip']")),
      editorPaints: [...document.querySelectorAll(".monaco-editor")].map(paint),
      models: models.map(model => ({uri: model.uri.toString(), value: model.getValue(), version: model.getVersionId()})),
      editorSelections: window.monaco.editor.getEditors().map(editor => ({uri: editor.getModel()?.uri.toString(), selection: editor.getSelection()?.toString()})),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}
async function catalogueSurface(page) {
  return page.evaluate(() => {
    const find = selector => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`missing catalogue surface ${selector}`);
      return element;
    };
    const paint = element => ({backgroundColor: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color});
    return {filters: paint(find("[aria-label='Task filters']")), list: paint(find("[aria-labelledby='taskListTitle']")), fileInput: paint(find("label[class*='fileInput']")), pet: paint(find("[aria-label='Pet feeding strip']")), back: find("button").textContent?.trim()};
  });
}
async function waitForJavaScriptWorker(page) {
  await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));
  await page.evaluate(async () => {
    const monaco = window.monaco;
    const model = monaco?.editor.getModels()[0];
    if (!model) throw new Error("a Monaco model is required before waiting for the JavaScript worker");
    const factory = await monaco.languages.typescript.getJavaScriptWorker();
    const worker = await factory(model.uri);
    if (!worker) throw new Error("the JavaScript worker did not initialize");
  });
}
async function toggle(page, action) {
  const control = page.getByRole("button", {name: action, exact: true});
  assert.equal(await page.getByRole("button", {name: /Switch to (light|dark) theme/}).count(), 1, "one dynamic theme action is exposed");
  const box = await control.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, "the real action has a 44px target");
  return control;
}

test("Light baseline and one pointer/keyboard switch preserve state and Monaco models", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    const before = await surface(page);
    assert.deepEqual({page: before.outer.backgroundColor, panel: before.panel.backgroundColor, editor: before.editorPaints[0].backgroundColor}, {page: light.page, panel: light.panel, editor: light.editor});
    assert.equal(before.solution.backgroundColor, light.panel); assert.equal(before.output.backgroundColor, light.panel); assert.equal(before.frame.backgroundColor, light.panel); assert.equal(before.pet.color, light.pet);
    assert.equal(before.theme, "light"); assert.equal(before.overflow, 0);
    await page.getByRole("button", {name: "Give up: Показать решение", exact: true}).click();
    await page.locator("[class*='taskSolutionContainer'] .monaco-editor").waitFor({state: "visible"});
    const activeGiveUp = page.getByRole("button", {name: "Give up: Показано решение", exact: true});
    assert.equal(await activeGiveUp.getAttribute("aria-pressed"), "true", "opening the readonly solution selects the real Give up control");
    assert.equal(await activeGiveUp.evaluate(element => getComputedStyle(element).color), "rgb(23, 61, 40)", "Light retains the approved active Give up ink");
    const withSolution = await surface(page);
    assert.equal(withSolution.editorPaints.length, 2, "the editable and readonly Monaco paths are both present");
    assert.ok(withSolution.editorPaints.every(editor => editor.backgroundColor === light.editor), "both Monaco paths retain the Light renderer");
    await (await toggle(page, "Switch to dark theme")).click();
    await page.locator("[data-cattasks-theme='dark']").waitFor();
    const changed = await surface(page);
    assert.deepEqual({page: changed.outer.backgroundColor, panel: changed.panel.backgroundColor}, {page: dark.page, panel: dark.panel});
    assert.equal(changed.editorPaints.length, 2, "both Monaco paths stay mounted after the switch");
    assert.ok(changed.editorPaints.every(editor => editor.backgroundColor === dark.editor), "both Monaco paths render the approved dark paint");
    assert.equal(await activeGiveUp.getAttribute("aria-pressed"), "true", "theme changes retain the real selected Give up state");
    assert.equal(await activeGiveUp.evaluate(element => getComputedStyle(element).color), "rgb(225, 234, 227)", "Dark active Give up uses the approved visible ink");
    assert.deepEqual(changed.models, withSolution.models, "draft, solution, and Monaco model versions survive the switch");
    assert.deepEqual(changed.editorSelections, withSolution.editorSelections, "editor selections survive the switch");
    await toggle(page, "Switch to light theme");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Switch to light theme", "keyboard traversal returns to the actual theme control");
    assert.deepEqual(await page.evaluate(() => ({focusVisible: document.activeElement?.matches(":focus-visible"), outlineColor: getComputedStyle(document.activeElement).outlineColor})), {focusVisible: true, outlineColor: "rgb(231, 200, 143)"}, "keyboard focus uses the approved amber ring");
    await page.keyboard.press("Enter");
    await page.locator("[data-cattasks-theme='light']").waitFor();
    const keyboardRestored = await surface(page);
    assert.deepEqual(keyboardRestored.models, withSolution.models); assert.deepEqual(keyboardRestored.editorSelections, withSolution.editorSelections);
    assert.equal(await activeGiveUp.getAttribute("aria-pressed"), "true", "returning to Light retains the real selected Give up state");
    assert.equal(await activeGiveUp.evaluate(element => getComputedStyle(element).color), "rgb(23, 61, 40)", "returning to Light restores the approved active Give up ink");
    await (await toggle(page, "Switch to dark theme")).click();
    await page.locator("[data-cattasks-theme='dark']").waitFor();
    await page.getByRole("button", {name: "My solution", exact: true}).click();
    await page.getByRole("button", {name: "Save current code", exact: true}).click();
    const savedCode = page.getByLabel("Saved solution code", {exact: true});
    await savedCode.waitFor({state: "visible"});
    assert.equal((await savedCode.textContent())?.trim(), catalog.tasks[0].starterCode, "the saved snapshot retains the original inert draft");
    assert.deepEqual(await savedCode.evaluate(element => ({backgroundColor: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color})), {backgroundColor: "rgb(16, 38, 47)", color: "rgb(225, 234, 227)"}, "Dark saved code is visibly rendered with the approved editor foreground");
    await (await toggle(page, "Switch to light theme")).click();
    await page.locator("[data-cattasks-theme='light']").waitFor();
    assert.deepEqual(await savedCode.evaluate(element => ({backgroundColor: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color})), {backgroundColor: "rgb(255, 255, 255)", color: light.pet}, "returning to Light restores the existing saved-code paint");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("Dark preference persists, paints the meadow, and preserves a bright lantern glass", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    assert.equal((await surface(page)).theme, "light", "a first visit starts in Light before persistence is exercised");
    await (await toggle(page, "Switch to dark theme")).click();
    await page.locator("[data-cattasks-theme='dark']").waitFor();
    const darkSurface = await surface(page);
    assert.deepEqual({page: darkSurface.outer.backgroundColor, panel: darkSurface.panel.backgroundColor, editor: darkSurface.editorPaints[0].backgroundColor}, dark);
    assert.match(await page.locator("[class*='viewportDecoration']").evaluate(element => getComputedStyle(element).backgroundImage), /night-meadow\.png/);
    const lantern = await page.locator("[class*='shelfLantern']").boundingBox();
    assert.ok(lantern && lantern.width && lantern.height, "the approved 1440px lantern crop is visible");
    const screenshot = await page.screenshot({clip: {x: lantern.x, y: lantern.y, width: lantern.width, height: lantern.height}});
    const contrast = await page.evaluate(async encoded => {
      const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let brightest = 0, casing = 0, casingCount = 0;
      for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4, value = .2126 * pixels[offset] + .7152 * pixels[offset + 1] + .0722 * pixels[offset + 2];
        brightest = Math.max(brightest, value);
        if (x < canvas.width * .22 || x > canvas.width * .78 || y < canvas.height * .24 || y > canvas.height * .78) { casing += value; casingCount += 1; }
      }
      return {brightest, casing: casing / casingCount};
    }, screenshot.toString("base64"));
    assert.ok(contrast.brightest >= contrast.casing + 75, "lantern glass is brighter than its muted casing");
    await waitForJavaScriptWorker(page);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), themeStorageKey), "dark", "the actual toggle writes the valid preference");
    await page.reload({waitUntil: "domcontentloaded"}); await page.locator("[data-cattasks-theme='dark']").waitFor();
    await waitForJavaScriptWorker(page);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), themeStorageKey), "dark");
    assertDiagnostics(diagnostics, 2);
  } finally { await context.close(); await browser.close(); }
});

test("inline theme boot paints persisted Dark before blocked React bundles hydrate", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const valid = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const corrupt = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const unavailable = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  try {
    await valid.addInitScript(([key]) => localStorage.setItem(key, "dark"), [themeStorageKey]);
    await corrupt.addInitScript(([key]) => localStorage.setItem(key, "corrupt"), [themeStorageKey]);
    await unavailable.addInitScript(() => Object.defineProperty(window, "localStorage", {configurable: true, get() { throw new DOMException("blocked", "SecurityError"); }}));
    for (const [context, expectedTheme, expectedPage] of [[valid, "dark", dark.page], [corrupt, "light", light.page], [unavailable, "light", light.page]]) {
      let bundles = 0;
      await context.route("**/_next/static/**/*.js", route => { bundles += 1; return route.fulfill({contentType: "application/javascript", body: ""}); });
      const page = await context.newPage();
      const response = await page.goto(baseUrl, {waitUntil: "commit"});
      assert.equal(response?.status(), 200, "the real server response starts before React bundles are released");
      const serverHtml = await response?.text();
      assert.match(serverHtml || "", /cattasks-theme/, "the real server HTML contains the inline theme boot contract");
      await page.locator(`[data-cattasks-theme='${expectedTheme}']`).waitFor();
      assert.equal(await page.locator("[class*='background']").evaluate(element => getComputedStyle(element).backgroundColor), expectedPage, "the visible outer page is painted by inline theme boot before React can hydrate");
      assert.ok(bundles > 0, "all external Next static JavaScript bundles were intercepted before React could hydrate");
      await page.close();
    }
  } finally { await valid.close(); await corrupt.close(); await unavailable.close(); await browser.close(); }
});

test("Bad or unavailable storage falls back safely; narrow All tasks scrolls without clipping", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const corrupt = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce"});
  const unavailable = await browser.newContext({viewport: {width: 320, height: 844}, reducedMotion: "reduce"});
  try {
    await corrupt.addInitScript(([key]) => localStorage.setItem(key, "corrupt"), [themeStorageKey]);
    const page = await corrupt.newPage(), diagnostics = await prepare(page);
    assert.equal((await surface(page)).theme, "light", "invalid preference falls back to Light");
    await page.getByRole("button", {name: "All tasks", exact: true}).click(); await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor();
    const catalogue = await catalogueSurface(page);
    assert.equal(catalogue.filters.backgroundColor, light.catalogue); assert.equal(catalogue.list.backgroundColor, light.catalogue); assert.equal(catalogue.fileInput.backgroundColor, light.fileInput); assert.equal(catalogue.pet.color, light.pet); assert.equal(catalogue.back, "←Back to task");
    await page.getByRole("button", {name: "Back to task", exact: true}).focus();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "←Back to task", "the catalogue return control remains keyboard-focusable");
    assert.equal((await surface(page)).overflow, 0, "390px catalogue has no horizontal clipping");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    assert.ok(await page.evaluate(() => window.scrollY > 0), "the extended catalogue really scrolls");
    await (await toggle(page, "Switch to dark theme")).click();
    assert.equal((await surface(page)).theme, "dark", "catalogue retains the same actual control");
    const titlePaint = await page.getByRole("heading", {name: "All tasks", exact: true}).evaluate(element => {
      const style = getComputedStyle(element);
      return {color: style.color, fill: style.webkitTextFillColor};
    });
    assert.equal(titlePaint.fill, "rgb(225, 234, 227)", "Dark compact catalogue title uses the approved visible text fill instead of a transparent clipped fill");
    assertDiagnostics(diagnostics);
    await unavailable.addInitScript(() => Object.defineProperty(window, "localStorage", {configurable: true, get() { throw new DOMException("blocked", "SecurityError"); }}));
    const blockedPage = await unavailable.newPage(), blockedDiagnostics = await prepare(blockedPage);
    assert.equal((await surface(blockedPage)).theme, "light");
    const control = await toggle(blockedPage, "Switch to dark theme"); await control.focus();
    assert.equal(await blockedPage.evaluate(() => document.activeElement?.matches(":focus-visible")), true, "320px switch retains keyboard focus");
    await blockedPage.keyboard.press("Enter"); assert.equal((await surface(blockedPage)).theme, "dark", "storage failure does not disable the local switch");
    assert.equal((await surface(blockedPage)).overflow, 0, "320px task view has no horizontal clipping");
    assertDiagnostics(blockedDiagnostics);
  } finally { await corrupt.close(); await unavailable.close(); await browser.close(); }
});
