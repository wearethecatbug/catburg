const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43852";
const themeStorageKey = "cattasks-theme";
const light = {page: "rgb(214, 225, 212)", panel: "rgb(250, 251, 251)", editor: "rgb(255, 255, 254)", pet: "rgb(37, 69, 50)", catalogue: "rgb(247, 249, 246)", fileInput: "rgb(255, 253, 248)"};
const dark = {page: "rgb(16, 38, 47)", panel: "rgb(23, 46, 56)", editor: "rgb(16, 38, 47)"};
const catalog = {version: 1, tasks: Array.from({length: 24}, (_, index) => ({
  id: `theme-${index + 1}`, title: `Theme fixture ${index + 1}`,
  description: "Inert fixture; only its fixed starter code runs in the runner assertion.", entryPoint: "echo",
  starterCode: `function echo(value) { return value + ${index + 1}; }`,
  solution: `function echo(value) { return value + ${index + 1}; }`,
  ...(index === 0 ? {hints: ["This inert hint makes the real accordion reachable without executing code."]} : {}),
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
async function themeTrigger(page) {
  const control = page.getByRole("button", {name: /Choose theme.*current:/i});
  assert.equal(await control.count(), 1, "one labelled theme trigger is exposed");
  const box = await control.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, "the real action has a 44px target");
  return control;
}

async function chooseTheme(page, name) {
  const trigger = await themeTrigger(page);
  await trigger.click();
  const choices = page.getByRole("group", {name: "Themes", exact: true});
  await choices.waitFor({state: "visible"});
  const option = choices.getByRole("button", {name, exact: true});
  await option.click();
  await page.locator(`[data-cattasks-theme='${name.toLowerCase()}']`).waitFor();
  await expectCurrentTheme(page, name);
}

async function expectCurrentTheme(page, name) {
  await expectText(page, /Choose theme.*current:/i, new RegExp(`current:\\s*${name}`, "i"));
}

async function expectText(page, roleName, pattern) {
  const label = await page.getByRole("button", {name: roleName}).getAttribute("aria-label");
  assert.match(label || "", pattern, "the trigger reports the selected theme in its accessible name");
}

async function expectShippedThemeChoices(choices) {
  const names = ["Light", "Dark", "Khorne", "Nurgle"];
  const buttons = choices.getByRole("button");
  assert.equal(await buttons.count(), names.length, "exactly four theme controls are exposed");
  for (const [index, name] of names.entries()) {
    const option = choices.getByRole("button", {name, exact: true});
    assert.equal(await option.count(), 1, `${name} is exposed as one accessible theme control`);
    assert.equal(await option.evaluate((element, ordinal) => [...element.parentElement.querySelectorAll("button")].indexOf(element), index), index, `${name} keeps its approved option order`);
  }
}

async function khorneAssets(page) {
  return page.evaluate(() => performance.getEntriesByType("resource")
    .map(entry => entry.name)
    .filter(name => name.includes("/cattasks/themes/khorne/")));
}

async function themeAssets(page, theme) {
  return page.evaluate(activeTheme => performance.getEntriesByType("resource")
    .map(entry => new URL(entry.name).pathname)
    .filter(path => path.includes(`/cattasks/themes/${activeTheme}/`)), theme);
}

async function visibleGeometry(page, selector, attribute) {
  return page.locator(selector).evaluateAll((elements, attributeName) => elements
    .filter(element => {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    })
    .map(element => {
      const box = element.getBoundingClientRect();
      return {
        name: element.getAttribute(attributeName), x: box.x, y: box.y, width: box.width, height: box.height,
        right: box.right, bottom: box.bottom, pointerEvents: getComputedStyle(element).pointerEvents,
      };
    }), attribute);
}

async function visibleKhorneGeometry(page, selector) {
  return page.locator(selector).evaluateAll(elements => elements
    .filter(element => {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    })
    .map(element => {
      const box = element.getBoundingClientRect();
      return {
        name: element.getAttribute("data-khorne-figure"),
        x: box.x, y: box.y, width: box.width, height: box.height,
        right: box.right, bottom: box.bottom,
        pointerEvents: getComputedStyle(element).pointerEvents,
      };
    }));
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function paintDelta(page, visible, hidden) {
  return page.evaluate(async ([visiblePng, hiddenPng]) => {
    const decode = async encoded => {
      const image = new Image();
      image.src = `data:image/png;base64,${encoded}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      canvas.getContext("2d").drawImage(image, 0, 0);
      return canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const [withFigures, withoutFigures] = await Promise.all([decode(visiblePng), decode(hiddenPng)]);
    let changed = 0;
    for (let index = 0; index < withFigures.length; index += 4) {
      // Chromium may round an otherwise identical composited pixel by one 8-bit level.
      // Treat only a perceptible channel delta as figure paint, preserving the zero-leak oracle.
      if (Math.abs(withFigures[index] - withoutFigures[index]) > 1 || Math.abs(withFigures[index + 1] - withoutFigures[index + 1]) > 1 || Math.abs(withFigures[index + 2] - withoutFigures[index + 2]) > 1 || Math.abs(withFigures[index + 3] - withoutFigures[index + 3]) > 1) changed += 1;
    }
    return changed;
  }, [visible.toString("base64"), hidden.toString("base64")]);
}

function cataloguePaintStrips(filters, list, allowance = 14) {
  return {
    leftRim: {x: Math.max(0, Math.floor(filters.x - 1)), y: Math.floor(filters.y), width: allowance + 1, height: Math.max(1, Math.floor(filters.height))},
    leftInterior: {x: Math.floor(filters.x + allowance), y: Math.floor(filters.y), width: Math.max(1, Math.floor(filters.width - allowance)), height: Math.max(1, Math.floor(filters.height))},
    rightRim: {x: Math.floor(list.x + list.width - allowance), y: Math.floor(list.y), width: allowance + 1, height: Math.max(1, Math.floor(list.height))},
    rightInterior: {x: Math.floor(list.x), y: Math.floor(list.y), width: Math.max(1, Math.floor(list.width - allowance)), height: Math.max(1, Math.floor(list.height))},
  };
}

async function figurePaintChanges(page, selector, strips) {
  await page.locator(`${selector}:visible img`).evaluateAll(images => Promise.all(images.map(image => image.decode())));
  const capture = async () => Object.fromEntries(await Promise.all(Object.entries(strips)
    .map(async ([name, clip]) => [name, await page.screenshot({clip, caret: "hide"})])));
  const painted = await capture();
  await page.locator(selector).evaluateAll(elements => elements.forEach(element => {
    element.__themeOracleVisibility = {value: element.style.getPropertyValue("visibility"), priority: element.style.getPropertyPriority("visibility")};
    element.style.setProperty("visibility", "hidden", "important");
  }));
  let unpainted;
  try { unpainted = await capture(); }
  finally {
    await page.locator(selector).evaluateAll(elements => elements.forEach(element => {
      const saved = element.__themeOracleVisibility;
      if (saved) element.style.setProperty("visibility", saved.value, saved.priority);
      delete element.__themeOracleVisibility;
    }));
  }
  return Object.fromEntries(await Promise.all(Object.keys(strips).map(async name => [name, await paintDelta(page, painted[name], unpainted[name])])));
}

async function sampledPanelColor(page, locator) {
  const box = await locator.boundingBox();
  assert.ok(box && box.width >= 24 && box.height >= 24, "a real painted panel is available for contrast sampling");
  const clip = {x: Math.floor(box.x + box.width - 18), y: Math.floor(box.y + box.height - 18), width: 12, height: 12};
  const image = await page.screenshot({clip, caret: "hide"});
  return page.evaluate(async encoded => {
    const source = new Image(); source.src = `data:image/png;base64,${encoded}`; await source.decode();
    const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext("2d"); context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const sums = [0, 0, 0];
    for (let index = 0; index < pixels.length; index += 4) for (let channel = 0; channel < 3; channel += 1) sums[channel] += pixels[index + channel];
    return `rgb(${sums.map(value => Math.round(value / (pixels.length / 4))).join(", ")})`;
  }, image.toString("base64"));
}

function luminance(color) {
  const values = color.match(/^rgba?\(([^)]+)\)$/i)?.[1].split(",").slice(0, 3).map(value => Number(value.trim()))
    ?? (/^#([\da-f]{6})$/i.test(color) ? [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16)) : null);
  assert.ok(values?.every(value => Number.isFinite(value)), `expected a concrete CSS color, received ${color}`);
  return values.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
}

function assertNormalTextContrast(foreground, backgrounds, label) {
  const foregroundLuminance = luminance(foreground);
  for (const background of backgrounds) {
    const backgroundLuminance = luminance(background);
    const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + .05) / (Math.min(foregroundLuminance, backgroundLuminance) + .05);
    assert.ok(ratio >= 4.5, `${label}: ${foreground} on ${background} has ${ratio.toFixed(2)}:1 contrast; normal text requires at least 4.5:1`);
  }
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
    await chooseTheme(page, "Dark");
    const changed = await surface(page);
    assert.deepEqual({page: changed.outer.backgroundColor, panel: changed.panel.backgroundColor}, {page: dark.page, panel: dark.panel});
    assert.equal(changed.editorPaints.length, 2, "both Monaco paths stay mounted after the switch");
    assert.ok(changed.editorPaints.every(editor => editor.backgroundColor === dark.editor), "both Monaco paths render the approved dark paint");
    assert.equal(await activeGiveUp.getAttribute("aria-pressed"), "true", "theme changes retain the real selected Give up state");
    assert.equal(await activeGiveUp.evaluate(element => getComputedStyle(element).color), "rgb(225, 234, 227)", "Dark active Give up uses the approved visible ink");
    assert.deepEqual(changed.models, withSolution.models, "draft, solution, and Monaco model versions survive the switch");
    assert.deepEqual(changed.editorSelections, withSolution.editorSelections, "editor selections survive the switch");
    const trigger = await themeTrigger(page);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), await trigger.getAttribute("aria-label"), "keyboard traversal returns to the actual theme trigger");
    assert.deepEqual(await page.evaluate(() => ({focusVisible: document.activeElement?.matches(":focus-visible"), outlineColor: getComputedStyle(document.activeElement).outlineColor})), {focusVisible: true, outlineColor: "rgb(231, 200, 143)"}, "keyboard focus uses the approved amber ring");
    await page.keyboard.press("Enter");
    const choices = page.getByRole("group", {name: "Themes", exact: true});
    await choices.waitFor({state: "visible"});
    const lightChoice = choices.getByRole("button", {name: "Light", exact: true});
    assert.equal(await lightChoice.evaluate(element => document.activeElement === element), true, "opening with the keyboard reaches the first named theme choice");
    assert.equal(await lightChoice.getAttribute("aria-pressed"), "false", "the Light choice accurately reports the current Dark selection");
    await page.keyboard.press("Enter");
    await page.locator("[data-cattasks-theme='light']").waitFor();
    await expectCurrentTheme(page, "Light");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), await trigger.getAttribute("aria-label"), "choosing a theme returns keyboard focus to the real trigger");
    const keyboardRestored = await surface(page);
    assert.deepEqual(keyboardRestored.models, withSolution.models); assert.deepEqual(keyboardRestored.editorSelections, withSolution.editorSelections);
    assert.equal(await activeGiveUp.getAttribute("aria-pressed"), "true", "returning to Light retains the real selected Give up state");
    assert.equal(await activeGiveUp.evaluate(element => getComputedStyle(element).color), "rgb(23, 61, 40)", "returning to Light restores the approved active Give up ink");
    await chooseTheme(page, "Dark");
    await page.getByRole("button", {name: "My solution", exact: true}).click();
    await page.getByRole("button", {name: "Save current code", exact: true}).click();
    const savedCode = page.getByLabel("Saved solution code", {exact: true});
    await savedCode.waitFor({state: "visible"});
    assert.equal((await savedCode.textContent())?.trim(), catalog.tasks[0].starterCode, "the saved snapshot retains the original inert draft");
    assert.deepEqual(await savedCode.evaluate(element => ({backgroundColor: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color})), {backgroundColor: "rgb(16, 38, 47)", color: "rgb(225, 234, 227)"}, "Dark saved code is visibly rendered with the approved editor foreground");
    await chooseTheme(page, "Light");
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
    await chooseTheme(page, "Dark");
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

test("Khorne is a keyboard-accessible persisted choice with distinct Task and catalogue art", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    const before = await surface(page);
    const trigger = await themeTrigger(page);
    const triggerLabel = await trigger.getAttribute("aria-label");
    await trigger.focus();
    await page.keyboard.press("Enter");
    const choices = page.getByRole("group", {name: "Themes", exact: true});
    await choices.waitFor({state: "visible"});
    await expectShippedThemeChoices(choices);
    assert.equal(await choices.locator("button[aria-pressed='true']").count(), 1, "the current choice has one accessible selected state");
    assert.equal(await choices.getByRole("button", {name: "Light", exact: true}).getAttribute("aria-pressed"), "true", "the initial selected choice is Light");
    await choices.getByRole("button", {name: "Light", exact: true}).and(page.locator(":focus")).waitFor({state: "visible"});
    await page.keyboard.press("Shift+Tab");
    await page.waitForFunction(label => document.activeElement?.getAttribute("aria-label") === label, triggerLabel);
    await page.keyboard.press("Escape");
    await choices.waitFor({state: "hidden"});
    assert.equal(await page.getByRole("group", {name: "Themes", exact: true}).count(), 0, "Escape closes the theme choices");
    await page.waitForFunction(label => document.activeElement?.getAttribute("aria-label") === label, triggerLabel);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), triggerLabel, "Escape restores focus to the trigger");
    assert.equal((await surface(page)).theme, "light", "Escape from the trigger retains the selected Light theme");
    await chooseTheme(page, "Khorne");
    const khorne = await surface(page);
    assert.equal(khorne.theme, "khorne");
    assert.notEqual(khorne.outer.backgroundColor, light.page, "Khorne owns its outer page paint");
    assert.notEqual(khorne.panel.backgroundColor, light.panel, "Khorne owns its panel paint");
    assert.deepEqual(khorne.models, before.models, "selecting Khorne preserves the existing Monaco model");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), themeStorageKey), "khorne", "the real Khorne choice persists its value");
    await page.waitForFunction(() => performance.getEntriesByType("resource").some(entry => entry.name.includes("/cattasks/themes/khorne/")));
    assert.ok((await khorneAssets(page)).length > 0, "Task loads Khorne's public art instead of a preview screenshot");
    await waitForJavaScriptWorker(page);
    await page.reload({waitUntil: "domcontentloaded"});
    await page.locator("[data-cattasks-theme='khorne']").waitFor();
    await waitForJavaScriptWorker(page);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), themeStorageKey), "khorne", "a normal reload retains the selected Khorne preference");
    assert.ok((await khorneAssets(page)).some(asset => asset.endsWith("/task/background-desktop.webp")), "the persisted Task view loads Khorne's own wide scene");
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor();
    assert.equal((await surface(page)).theme, "khorne", "catalogue keeps the selected Khorne theme");
    await page.waitForFunction(() => performance.getEntriesByType("resource").some(entry => new URL(entry.name).pathname === "/cattasks/themes/khorne/all-tasks/background-desktop.webp"));
    assert.ok((await khorneAssets(page)).some(asset => asset.endsWith("/all-tasks/background-desktop.webp")), "catalogue navigation loads the active All tasks desktop background rather than an unrelated new Khorne resource");
    assert.equal((await surface(page)).overflow, 0, "Khorne catalogue retains the existing wide geometry");
    const catalogueHeader = page.locator("header[data-khorne-header='catalogue']");
    const catalogueTitle = catalogueHeader.getByRole("heading", {name: "All tasks", exact: true});
    const catalogueBack = catalogueHeader.getByRole("button", {name: "Back to task", exact: true});
    assert.equal(await catalogueHeader.count(), 1, "Khorne catalogue uses its own integrated header");
    const [titleBox, backBox] = await Promise.all([catalogueTitle.boundingBox(), catalogueBack.boundingBox()]);
    assert.ok(titleBox && backBox && titleBox.x + titleBox.width <= backBox.x && Math.min(titleBox.y + titleBox.height, backBox.y + backBox.height) > Math.max(titleBox.y, backBox.y), "the live catalogue title remains left of, and vertically aligned with, its Back to task action");
    assert.equal(await page.locator("[class*='shelfStickers'], [class*='backRabbit'], [class*='compactCandles'], [data-catalogue-back-capybara]").count(), 0, "Khorne catalogue has no former shelf or mascot decoration");
    assert.equal(await page.locator("[class*='difficultyBar']:visible").count(), 0, "Khorne difficulty choices do not retain the former green bars");
    const selectedDifficulty = page.getByRole("button", {name: "Easy", exact: true});
    assert.notEqual(await selectedDifficulty.evaluate(element => getComputedStyle(element).color), "rgb(47, 81, 51)", "Khorne selected difficulty does not retain the former green ink");
    const search = page.getByRole("searchbox", {name: "Search tasks", exact: true});
    await search.fill("fixture 1");
    await page.getByRole("radio", {name: "Not started", exact: true}).check();
    assert.equal(await page.getByRole("button", {name: "1", exact: true}).getAttribute("aria-current"), "page", "changing a filter resets the catalogue to its first page");
    await page.getByRole("button", {name: "Next page", exact: true}).click();
    const secondPage = page.getByRole("button", {name: "2", exact: true});
    assert.equal(await secondPage.getAttribute("aria-current"), "page", "the fixture reaches a genuine second catalogue page");
    await chooseTheme(page, "Dark");
    assert.equal(await search.inputValue(), "fixture 1", "theme selection preserves the live catalogue search state");
    assert.equal(await page.getByRole("radio", {name: "Not started", exact: true}).isChecked(), true, "theme selection preserves a non-default catalogue filter");
    assert.equal(await secondPage.getAttribute("aria-current"), "page", "theme selection preserves the current catalogue page when its result set still permits it");
    assertDiagnostics(diagnostics, 2);
  } finally { await context.close(); await browser.close(); }
});

test("fresh non-Khorne and compact Khorne boots do not transfer hidden Khorne figures", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const figurePaths = [
    "/cattasks/themes/khorne/task/marine.webp",
    "/cattasks/themes/khorne/task/daemon.webp",
    "/cattasks/themes/khorne/all-tasks/marine.webp",
    "/cattasks/themes/khorne/all-tasks/daemon.webp",
  ];
  const origin = new URL(baseUrl).origin;
  const scenarios = [
    {name: "fresh Light desktop", viewport: {width: 1440, height: 900}, theme: null, figures: []},
    {name: "fresh Dark desktop", viewport: {width: 1440, height: 900}, theme: "dark", figures: []},
    {name: "fresh Khorne at 430px", viewport: {width: 430, height: 900}, theme: "khorne", figures: []},
    {name: "visible Khorne desktop", viewport: {width: 2560, height: 1200}, theme: "khorne", figures: figurePaths.slice(0, 2)},
  ];
  try {
    for (const scenario of scenarios) {
      const context = await browser.newContext({viewport: scenario.viewport, reducedMotion: "reduce"});
      try {
        if (scenario.theme) await context.addInitScript(([key, theme]) => localStorage.setItem(key, theme), [themeStorageKey, scenario.theme]);
        const page = await context.newPage();
        const requests = new Set();
        page.on("request", request => {
          const url = new URL(request.url());
          if (url.origin === origin) requests.add(url.pathname);
        });
        const diagnostics = await prepare(page);
        await nextPaint(page);
        const requestedFigures = figurePaths.filter(path => requests.has(path));
        assert.deepEqual(requestedFigures, scenario.figures, `${scenario.name} requests exactly the Khorne figure assets that can be visibly used at boot`);
        if (scenario.name === "visible Khorne desktop") {
          assert.equal((await visibleKhorneGeometry(page, "[data-khorne-figure]")).length, 3, "visible desktop Khorne renders its actual three-piece side composition");
        }
        assertDiagnostics(diagnostics);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test("Nurgle is the fourth native choice with real Task/catalogue state, one rail, and responsive scene boundaries", {timeout: 120_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 2560, height: 1200}, reducedMotion: "reduce"});
  const page = await context.newPage();
  const figureSelector = "[data-nurgle-figure]";
  const nurgle = "[data-warhammer-variant='nurgle']";
  try {
    const diagnostics = await prepare(page);
    const trigger = await themeTrigger(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    const choices = page.getByRole("group", {name: "Themes", exact: true});
    await choices.waitFor({state: "visible"});
    await expectShippedThemeChoices(choices);
    assert.equal(await choices.getByRole("button", {name: "Light", exact: true}).evaluate(element => document.activeElement === element), true, "opening the Nurgle chooser puts focus on the first native option");
    for (let index = 0; index < 3; index += 1) await page.keyboard.press("Tab");
    const nurgleChoice = choices.getByRole("button", {name: "Nurgle", exact: true});
    assert.equal(await nurgleChoice.evaluate(element => document.activeElement === element), true, "keyboard traversal reaches the native Nurgle choice");
    await page.keyboard.press("Escape");
    await choices.waitFor({state: "hidden"});
    assert.equal(await page.evaluate(label => document.activeElement?.getAttribute("aria-label") === label, await trigger.getAttribute("aria-label")), true, "Escape from Nurgle restores focus to the theme trigger");
    await trigger.focus(); await page.keyboard.press("Enter");
    assert.equal(await choices.getByRole("button", {name: "Light", exact: true}).evaluate(element => document.activeElement === element), true, "reopening the Nurgle chooser resets keyboard focus to its first option");
    for (let index = 0; index < 3; index += 1) await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.locator("[data-cattasks-theme='nurgle']").waitFor();
    await expectCurrentTheme(page, "Nurgle");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), themeStorageKey), "nurgle", "the native Nurgle choice persists the valid preference");
    const taskHeader = page.locator(`header${nurgle}[data-khorne-header='task']`);
    const taskRail = page.locator(`${nurgle}[data-khorne-rail]`);
    const taskAquila = page.locator(`${nurgle}[data-khorne-aquila]`);
    assert.equal(await taskHeader.count(), 1, "Nurgle Task has one integrated live header");
    assert.equal(await taskRail.count(), 1, "Nurgle Task has one shared riveted rail");
    assert.equal(await taskAquila.count(), 1, "Nurgle Task has its supplied shared Aquila");
    assert.equal(await taskAquila.locator("img").getAttribute("src"), "/cattasks/themes/nurgle/aquila.png", "Nurgle Task uses the supplied shared Aquila path");
    const railHandle = await taskRail.elementHandle();
    const taskHeaderBox = await taskHeader.boundingBox();
    const taskFigures = await visibleGeometry(page, figureSelector, "data-nurgle-figure");
    assert.equal(taskFigures.length, 2, "wide Nurgle Task exposes its indivisible marine and daemon/fly figures only");
    assert.ok(taskFigures.every(figure => figure.bottom >= 1140 && figure.bottom <= 1220 && figure.pointerEvents === "none"), "wide Nurgle Task figures are grounded and click-through");
    const taskFigureImages = page.locator(`${figureSelector}:visible img`);
    assert.equal(await taskFigureImages.count(), 2, "wide Nurgle Task exposes exactly two decoded figure images");
    assert.deepEqual((await taskFigureImages.evaluateAll(images => images.map(image => new URL(image.currentSrc || image.src).pathname).sort())), ["/cattasks/themes/nurgle/task/daemon.webp", "/cattasks/themes/nurgle/task/marine.webp"], "wide Nurgle Task uses the two supplied Task figure paths");
    await taskFigureImages.evaluateAll(images => Promise.all(images.map(image => image.decode())));
    assert.ok((await themeAssets(page, "nurgle")).some(path => path === "/cattasks/themes/nurgle/task/background-desktop.webp"), "Nurgle Task paints its real supplied desktop backdrop");
    assert.equal(await page.locator("[class*='taskShelf']:visible, [class*='catalogueShelf']:visible, [class*='mascotCanvas']:visible, [class*='mobileFoxBody']:visible, [class*='shelfStickers']:visible").count(), 0, "Nurgle Task leaves no painted legacy shelf or mascot composition");
    const taskPanel = page.locator("[class*='taskDetailsContainer']");
    const taskReadability = await taskPanel.evaluate(panel => {
      const heading = panel.querySelector("h2, h3");
      const description = panel.querySelector("pre");
      if (!heading || !description) throw new Error("Nurgle Task needs a real heading and description for contrast verification");
      return {heading: getComputedStyle(heading).color, description: getComputedStyle(description).color};
    });
    const taskPanelPaint = await sampledPanelColor(page, taskPanel);
    assertNormalTextContrast(taskReadability.heading, [taskPanelPaint], "Nurgle Task heading against sampled panel paint");
    assertNormalTextContrast(taskReadability.description, [taskPanelPaint], "Nurgle Task description against sampled panel paint");

    const initialModels = (await surface(page)).models;
    await page.getByRole("tab", {name: "Hint", exact: true}).click();
    assert.equal(await page.getByRole("tab", {name: "Hint", exact: true}).getAttribute("aria-selected"), "true", "Nurgle retains the real task tab state");
    await page.getByRole("tab", {name: "My solution", exact: true}).click();
    await page.getByRole("button", {name: "Save current code", exact: true}).click();
    await page.getByRole("button", {name: "Test Code", exact: true}).click();
    await page.locator("[data-variant='test'][data-result='success']").waitFor({state: "attached"});

    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
    await nextPaint(page);
    const catalogueHeader = page.locator(`header${nurgle}[data-khorne-header='catalogue']`);
    const catalogueRail = page.locator(`${nurgle}[data-khorne-rail]`);
    const catalogueAquila = page.locator(`${nurgle}[data-khorne-aquila]`);
    assert.equal(await catalogueHeader.count(), 1, "Nurgle catalogue uses its distinct integrated header");
    assert.equal(await catalogueRail.count(), 1, "Nurgle catalogue retains one shared riveted rail");
    assert.equal(await catalogueAquila.count(), 1, "Nurgle catalogue keeps the supplied Aquila in its catalogue header placement");
    assert.equal(await catalogueAquila.locator("img").getAttribute("src"), "/cattasks/themes/nurgle/aquila.png", "Nurgle catalogue reuses the supplied shared Aquila path");
    assert.equal(await railHandle.evaluate((rail, selector) => rail === document.querySelector(selector), `${nurgle}[data-khorne-rail]`), true, "Task to catalogue retains the same shared beam element");
    const [catalogueHeaderBox, catalogueAquilaBox] = await Promise.all([catalogueHeader.boundingBox(), catalogueAquila.boundingBox()]);
    assert.ok(taskHeaderBox && catalogueHeaderBox && catalogueAquilaBox && Math.abs(taskHeaderBox.y + taskHeaderBox.height - (catalogueHeaderBox.y + catalogueHeaderBox.height)) <= 1, "Task and catalogue headers share their lower edge while Aquila remains visibly placed");
    const catalogueFigures = await visibleGeometry(page, figureSelector, "data-nurgle-figure");
    assert.equal(catalogueFigures.length, 2, "wide Nurgle catalogue exposes its indivisible marine and plaguebearer/nurglings group");
    assert.ok(catalogueFigures.every(figure => figure.bottom >= 1140 && figure.bottom <= 1220 && figure.pointerEvents === "none"), "wide Nurgle catalogue figures are grounded and click-through");
    await page.locator(`${figureSelector}:visible img`).evaluateAll(images => Promise.all(images.map(image => image.decode())));
    assert.deepEqual((await page.locator(`${figureSelector}:visible img`).evaluateAll(images => images.map(image => new URL(image.currentSrc || image.src).pathname).sort())), ["/cattasks/themes/nurgle/all-tasks/daemon.webp", "/cattasks/themes/nurgle/all-tasks/marine.webp"], "wide Nurgle catalogue uses the two supplied catalogue figure paths");
    assert.ok((await themeAssets(page, "nurgle")).some(path => path === "/cattasks/themes/nurgle/all-tasks/background-desktop.webp"), "Nurgle catalogue paints its real supplied desktop backdrop");
    const [filtersBox, listBox] = await Promise.all([
      page.getByLabel("Task filters", {exact: true}).boundingBox(),
      page.locator("[aria-labelledby='taskListTitle']").boundingBox(),
    ]);
    assert.ok(filtersBox && listBox, "Nurgle's live catalogue panes provide paint bounds");
    const paintChanges = await figurePaintChanges(page, figureSelector, cataloguePaintStrips(filtersBox, listBox));
    assert.ok(paintChanges.leftRim + paintChanges.rightRim > 0, `Nurgle figures visibly enter at least one approved catalogue pane rim (${JSON.stringify(paintChanges)})`);
    assert.equal(paintChanges.leftInterior + paintChanges.rightInterior, 0, `Nurgle figures never paint the catalogue interiors beyond the rim allowance (${JSON.stringify(paintChanges)})`);
    const catalogueList = page.locator("[aria-labelledby='taskListTitle']");
    const catalogueReadability = await catalogueList.evaluate(panel => {
      const heading = panel.querySelector("li h3");
      const description = panel.querySelector("li p");
      if (!heading || !description) throw new Error("Nurgle catalogue needs a real task heading and blurb for contrast verification");
      return {heading: getComputedStyle(heading).color, description: getComputedStyle(description).color};
    });
    const cataloguePanelPaint = await sampledPanelColor(page, catalogueList);
    assertNormalTextContrast(catalogueReadability.heading, [cataloguePanelPaint], "Nurgle catalogue task heading against sampled list paint");
    assertNormalTextContrast(catalogueReadability.description, [cataloguePanelPaint], "Nurgle catalogue blurb against sampled list paint");
    const search = page.getByRole("searchbox", {name: "Search tasks", exact: true});
    await search.fill("fixture 1");
    await page.getByRole("radio", {name: "Not started", exact: true}).check();
    await page.getByRole("button", {name: "Next page", exact: true}).click();
    await chooseTheme(page, "Dark"); await chooseTheme(page, "Nurgle");
    assert.equal(await search.inputValue(), "fixture 1", "Nurgle round-trip retains the live catalogue search");
    assert.equal(await page.getByRole("radio", {name: "Not started", exact: true}).isChecked(), true, "Nurgle round-trip retains the real catalogue filter");
    assert.equal(await page.getByRole("button", {name: "2", exact: true}).getAttribute("aria-current"), "page", "Nurgle round-trip retains the live catalogue page");
    await page.getByRole("button", {name: "Back to task", exact: true}).click();
    await page.getByRole("heading", {name: catalog.tasks[0].title, exact: true}).waitFor({state: "visible"});
    assert.deepEqual((await surface(page)).models, initialModels, "Nurgle Task/catalogue navigation retains the same Monaco model state");

    for (const width of [1920, 1440]) {
      await page.setViewportSize({width, height: 1200}); await nextPaint(page);
      const strip = await page.getByLabel("Pet feeding strip", {exact: true}).boundingBox();
      const figures = await visibleGeometry(page, figureSelector, "data-nurgle-figure");
      assert.ok(strip && figures.length === 2 && figures.every(figure => figure.y >= strip.y + strip.height - 1), `${width}px Nurgle uses the normal-flow lower scene rather than narrowing the workspace`);
    }
    await page.setViewportSize({width: 768, height: 900}); await nextPaint(page);
    assert.match(await page.locator("[data-cattasks-theme='nurgle'] [data-nurgle-scene='task']").evaluate(element => getComputedStyle(element).backgroundImage), /nurgle\/task\/background-tablet\.webp/, "Nurgle Task uses its supplied tablet backdrop at tablet width");
    await page.setViewportSize({width: 430, height: 932}); await nextPaint(page);
    assert.equal((await visibleGeometry(page, figureSelector, "data-nurgle-figure")).length, 0, "430px Nurgle Task hides decorative figures");
    assert.match(await page.locator("[data-cattasks-theme='nurgle'] [data-nurgle-scene='task']").evaluate(element => getComputedStyle(element).backgroundImage), /nurgle\/task\/background-mobile\.webp/, "Nurgle Task uses its supplied mobile backdrop at compact width");
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
    await page.setViewportSize({width: 800, height: 900}); await nextPaint(page);
    assert.match(await page.locator("[data-cattasks-theme='nurgle'] [data-nurgle-scene='all-tasks']").evaluate(element => getComputedStyle(element).backgroundImage), /nurgle\/all-tasks\/background-tablet\.webp/, "Nurgle catalogue uses its supplied tablet backdrop at tablet width");
    const radio = page.getByRole("radio", {name: "All topics", exact: true});
    if (!await radio.isVisible()) await page.getByRole("button", {name: "Filters", exact: true}).click();
    const label = await radio.evaluate(element => {
      const target = element.closest("label") || document.querySelector(`label[for="${element.id}"]`);
      const box = target?.getBoundingClientRect(); return box && {width: box.width, height: box.height};
    });
    assert.ok(label && label.width >= 44 && label.height >= 44, "Nurgle compact catalogue keeps the native radio label at least 44px");
    await page.emulateMedia({forcedColors: "active"});
    assert.notEqual(await radio.evaluate(element => getComputedStyle(element).appearance), "none", "forced-colors Nurgle uses the native radio appearance");
    await page.emulateMedia({forcedColors: "none"});
    for (const viewport of [{width: 430, height: 932}, {width: 320, height: 820}]) {
      await page.setViewportSize(viewport); await nextPaint(page);
      assert.equal((await visibleGeometry(page, figureSelector, "data-nurgle-figure")).length, 0, `${viewport.width}px Nurgle catalogue hides decorative figures`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${viewport.width}px Nurgle catalogue has no horizontal overflow`);
    }
    assert.match(await page.locator("[data-cattasks-theme='nurgle'] [data-nurgle-scene='all-tasks']").evaluate(element => getComputedStyle(element).backgroundImage), /nurgle\/all-tasks\/background-mobile\.webp/, "Nurgle catalogue uses its supplied mobile backdrop at compact width");
    assertDiagnostics(diagnostics, 1);
  } finally { await context.close(); await browser.close(); }
});

test("only active visible-or-near Nurgle page figures transfer", {timeout: 120_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const origin = new URL(baseUrl).origin;
  const figures = [
    "/cattasks/themes/nurgle/task/marine.webp", "/cattasks/themes/nurgle/task/daemon.webp",
    "/cattasks/themes/nurgle/all-tasks/marine.webp", "/cattasks/themes/nurgle/all-tasks/daemon.webp",
  ];
  const inactiveKhorneScene = [
    "/cattasks/themes/khorne/task/background-desktop.webp", "/cattasks/themes/khorne/task/marine.webp", "/cattasks/themes/khorne/task/daemon.webp",
    "/cattasks/themes/khorne/all-tasks/background-desktop.webp", "/cattasks/themes/khorne/all-tasks/marine.webp", "/cattasks/themes/khorne/all-tasks/daemon.webp",
  ];
  const scenarios = [
    {name: "Light", theme: null, viewport: {width: 1440, height: 900}, expected: []},
    {name: "Dark", theme: "dark", viewport: {width: 1440, height: 900}, expected: []},
    {name: "Khorne", theme: "khorne", viewport: {width: 2560, height: 1200}, expected: []},
    {name: "Nurgle compact", theme: "nurgle", viewport: {width: 430, height: 932}, expected: []},
    {name: "Nurgle wide Task", theme: "nurgle", viewport: {width: 2560, height: 1200}, expected: figures.slice(0, 2)},
  ];
  try {
    for (const scenario of scenarios) {
      const context = await browser.newContext({viewport: scenario.viewport, reducedMotion: "reduce"});
      try {
        if (scenario.theme) await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [themeStorageKey, scenario.theme]);
        const page = await context.newPage(), requests = new Set();
        page.on("request", request => { const url = new URL(request.url()); if (url.origin === origin) requests.add(url.pathname); });
        const diagnostics = await prepare(page); await nextPaint(page);
        assert.deepEqual(figures.filter(path => requests.has(path)), scenario.expected, `${scenario.name} transfers only Nurgle figures usable at boot`);
        if (scenario.theme === "nurgle") assert.deepEqual(inactiveKhorneScene.filter(path => requests.has(path)), [], `${scenario.name} never transfers an inactive Khorne backdrop or figure`);
        assertDiagnostics(diagnostics);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test("Khorne replaces the legacy header with live navigation, runner controls, and task tabs", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Khorne");
    const header = page.locator("header[data-khorne-header]");
    const allTasks = page.getByRole("button", {name: "All tasks", exact: true});
    const previous = page.getByRole("button", {name: "Select previous task", exact: true});
    const next = page.getByRole("button", {name: "Select next task", exact: true});
    const title = header.getByRole("heading", {name: catalog.tasks[0].title, exact: true});

    await header.waitFor({state: "visible"});
    assert.equal(await header.count(), 1, "Khorne has one replacement header");
    assert.equal(await title.count(), 1, "the task title remains a live heading in the replacement header");
    assert.equal(await header.getByRole("button", {name: "All tasks", exact: true}).count(), 1, "All tasks belongs to the integrated header");
    assert.equal(await header.getByRole("button", {name: "Select previous task", exact: true}).count(), 1, "previous task belongs to the central header composition");
    assert.equal(await header.getByRole("button", {name: "Select next task", exact: true}).count(), 1, "next task belongs to the central header composition");
    for (const control of [allTasks, previous, next]) {
      const box = await control.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44, "integrated header actions retain a keyboard-sized target");
    }
    assert.equal(await page.locator("[class*='taskShelf'], [class*='catalogueShelf'], [class*='mascotCanvas'], [class*='mobileFoxBody']").count(), 0, "Khorne does not leave the former shelf or mascots below the replacement header");
    await next.click();
    await page.getByRole("heading", {name: catalog.tasks[1].title, exact: true}).waitFor({state: "visible"});
    await previous.click();
    await page.getByRole("heading", {name: catalog.tasks[0].title, exact: true}).waitFor({state: "visible"});

    const tablist = page.getByRole("tablist", {name: "Task panel", exact: true});
    const taskTab = tablist.getByRole("tab", {name: "Task", exact: true});
    const hintTab = tablist.getByRole("tab", {name: "Hint", exact: true});
    const solutionTab = tablist.getByRole("tab", {name: "My solution", exact: true});
    assert.equal(await tablist.count(), 1, "the task switcher exposes one tablist");
    assert.equal(await taskTab.getAttribute("aria-selected"), "true", "Task starts selected");
    assert.equal(await page.getByRole("button", {name: "Hide task", exact: true}).count(), 1, "Hide task remains a distinct action outside the tablist");
    const tabPaint = await Promise.all([taskTab, hintTab].map(tab => tab.evaluate(element => ({background: getComputedStyle(element).backgroundImage, border: getComputedStyle(element).borderBottomColor}))));
    assert.notDeepEqual(tabPaint[0], tabPaint[1], "the active Task tab has distinct active paint");
    await taskTab.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await hintTab.getAttribute("aria-selected"), "true", "ArrowRight activates Hint through the real tab state");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "tab", "tab keyboard navigation moves focus to the selected tab");
    await page.keyboard.press("End");
    assert.equal(await solutionTab.getAttribute("aria-selected"), "true", "End activates My solution through the real tab state");
    const solutionPanelId = await solutionTab.getAttribute("aria-controls");
    assert.ok(solutionPanelId, "the selected tab names its panel");
    const solutionPanel = page.locator(`[id="${solutionPanelId}"]`);
    assert.equal(await solutionPanel.getAttribute("role"), "tabpanel", "the named panel has tabpanel semantics");
    assert.equal(await solutionPanel.getAttribute("aria-labelledby"), await solutionTab.getAttribute("id"), "the selected panel points back to its tab");
    assert.equal(await solutionPanel.getAttribute("hidden"), null, "the selected panel is available to the user");

    const testCode = page.getByRole("button", {name: "Test Code", exact: true});
    const runCode = page.getByRole("button", {name: "Run Code", exact: true});
    for (const control of [testCode, runCode]) {
      const box = await control.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44, "the real runner control keeps an accessible target");
      assert.equal(await control.isEnabled(), true, "the real runner control remains enabled for the inert fixture");
    }
    await page.waitForFunction(() => window.monaco?.editor.getModels()[0]?.getValue().includes("function echo"));
    await testCode.click();
    await page.locator("[data-variant='test'][data-result='success']").waitFor({state: "attached"});
    const output = page.locator("section[aria-labelledby='taskOutputHeading']");
    const beforeRun = (await output.textContent())?.trim();
    await runCode.click();
    await page.waitForFunction(previous => {
      const output = document.querySelector("section[aria-labelledby='taskOutputHeading']")?.textContent?.trim();
      return Boolean(output && output !== previous);
    }, beforeRun);

    await page.getByRole("button", {name: "Hide task", exact: true}).click();
    const showTask = page.getByRole("button", {name: "Show task", exact: true});
    await showTask.waitFor({state: "visible"});
    await showTask.focus();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Show task", "Show task remains reachable outside the hidden panel");
    await showTask.click();
    await taskTab.waitFor({state: "visible"});

    await allTasks.click();
    const allTasksTitle = page.getByRole("heading", {name: "All tasks", exact: true});
    const back = page.getByRole("button", {name: "Back to task", exact: true});
    await allTasksTitle.waitFor({state: "visible"});
    const catalogueHeader = page.locator("header[data-khorne-header]");
    assert.equal(await catalogueHeader.count(), 1, "catalogue also uses one Khorne header");
    assert.equal(await catalogueHeader.getByRole("heading", {name: "All tasks", exact: true}).count(), 1, "catalogue heading stays live inside the replacement header");
    assert.equal(await catalogueHeader.getByRole("button", {name: "Back to task", exact: true}).count(), 1, "catalogue return action belongs to the replacement header");
    assert.equal(await page.locator("[class*='taskShelf'], [class*='catalogueShelf'], [class*='mascotCanvas'], [class*='mobileFoxBody']").count(), 0, "catalogue removes the former shelf and mascots as well");
    await back.click();
    await page.getByRole("heading", {name: catalog.tasks[0].title, exact: true}).waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await allTasks.evaluate(element => document.activeElement === element), true, "returning from the catalogue restores focus to All tasks");
    assert.equal((await surface(page)).theme, "khorne", "the integrated return control retains the selected Khorne theme");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("Khorne keeps a 1600px workspace, aligned beam and grounded desktop scene through live navigation", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 2560, height: 1200}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Khorne");
    await nextPaint(page);

    const taskRail = page.locator("[data-khorne-rail]");
    const taskWorkspace = page.locator("[data-khorne-workspace]:visible");
    assert.equal(await taskRail.count(), 1, "Task exposes one shared riveted beam");
    assert.equal(await taskWorkspace.count(), 1, "Task exposes one measurable content workspace");
    const taskRailHandle = await taskRail.elementHandle();
    const taskRailBox = await taskRail.boundingBox(), taskWorkspaceBox = await taskWorkspace.boundingBox();
    assert.ok(taskRailHandle && taskRailBox && taskWorkspaceBox, "Task rail and workspace are visibly measurable");
    assert.ok(Math.abs(taskWorkspaceBox.width - 1600) <= 1, "Task workspace reaches, but does not exceed, the approved 1600px desktop cap");

    const taskVents = await visibleKhorneGeometry(page, "[data-khorne-vent]");
    assert.equal(taskVents.length, 2, "Task has its two measurable red vent inserts");
    for (const vent of taskVents) assert.ok(vent.height >= 38 && vent.height <= 40, "Task red inserts retain the approved 38–40px desktop height");

    const taskFigures = await visibleKhorneGeometry(page, "[data-khorne-figure]");
    assert.deepEqual(taskFigures.map(figure => figure.name).sort(), ["task-hound-lower", "task-hound-upper", "task-marine"], "Task exposes three independently placed decorations");
    const figure = name => taskFigures.find(candidate => candidate.name === name);
    const marine = figure("task-marine"), upperHound = figure("task-hound-upper"), lowerHound = figure("task-hound-lower");
    assert.ok(Math.abs(marine.bottom - 1172) <= 16, "Task marine is grounded on the painted floor rather than floating");
    assert.ok(Math.abs(lowerHound.bottom - 1176) <= 16, "Task lower hound is grounded on the painted floor rather than floating");
    assert.ok(upperHound.bottom <= lowerHound.bottom - 120, "Task upper hound remains significantly above the lower hound on its parapet");
    assert.ok(taskFigures.every(candidate => candidate.pointerEvents === "none"), "Task decorative figures do not intercept real controls");

    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
    await nextPaint(page);
    const catalogueRail = page.locator("[data-khorne-rail]");
    const catalogueWorkspace = page.locator("[data-khorne-workspace]:visible");
    assert.equal(await catalogueRail.count(), 1, "catalogue retains the one shared riveted beam");
    assert.equal(await catalogueWorkspace.count(), 1, "catalogue exposes one measurable content workspace");
    const catalogueRailBox = await catalogueRail.boundingBox(), catalogueWorkspaceBox = await catalogueWorkspace.boundingBox();
    assert.ok(catalogueRailBox && catalogueWorkspaceBox, "catalogue rail and workspace are visibly measurable");
    assert.ok(Math.abs(catalogueWorkspaceBox.width - 1600) <= 1, "catalogue workspace reaches, but does not exceed, the approved 1600px desktop cap");
    assert.ok(Math.abs(catalogueRailBox.x - taskRailBox.x) <= 1 && Math.abs(catalogueRailBox.y - taskRailBox.y) <= 1 && Math.abs(catalogueRailBox.width - taskRailBox.width) <= 1, "the catalogue keeps the Task beam at the identical desktop position and width");
    assert.equal(await taskRailHandle.evaluate((rail, selector) => rail === document.querySelector(selector), "[data-khorne-rail]"), true, "navigation retains the same persistent beam element rather than swapping a duplicate");

    const catalogueVents = await visibleKhorneGeometry(page, "[data-khorne-vent]");
    assert.equal(catalogueVents.length, 2, "catalogue has its two measurable red vent inserts");
    for (const vent of catalogueVents) assert.ok(vent.height >= 38 && vent.height <= 40, "catalogue red inserts retain the approved 38–40px desktop height");
    assert.ok(catalogueVents.every((vent, index) => Math.abs(vent.height - taskVents[index].height) <= 1), "Task and catalogue red inserts remain equal-height through navigation");

    const [catalogueTitle, aquila, catalogueBack] = await Promise.all([
      page.getByRole("heading", {name: "All tasks", exact: true}).boundingBox(),
      page.locator("[data-khorne-aquila]").boundingBox(),
      page.getByRole("button", {name: "Back to task", exact: true}).boundingBox(),
    ]);
    assert.ok(catalogueTitle && aquila && catalogueBack, "catalogue title, central aquila, and real return action are visible");
    assert.ok(catalogueTitle.x + catalogueTitle.width <= aquila.x && aquila.x + aquila.width <= catalogueBack.x, "catalogue keeps title left, aquila centred, and Back to task right");

    const catalogueFigures = await visibleKhorneGeometry(page, "[data-khorne-figure]");
    assert.deepEqual(catalogueFigures.map(candidate => candidate.name).sort(), ["catalogue-daemon", "catalogue-marine"], "catalogue exposes its two independent side figures");
    const catalogueMarine = catalogueFigures.find(candidate => candidate.name === "catalogue-marine"), catalogueDaemon = catalogueFigures.find(candidate => candidate.name === "catalogue-daemon");
    assert.ok(Math.abs(catalogueMarine.bottom - 1172) <= 16 && Math.abs(catalogueDaemon.bottom - 1176) <= 16, "catalogue side figures are grounded on the painted floor");
    assert.ok(catalogueFigures.every(candidate => candidate.pointerEvents === "none"), "catalogue figures are click-through decoration");
    const [filtersBox, listBox] = await Promise.all([
      page.getByLabel("Task filters", {exact: true}).boundingBox(),
      page.locator("[aria-labelledby='taskListTitle']").boundingBox(),
    ]);
    assert.ok(filtersBox && listBox, "the live filter and task-list panes provide paint bounds for the catalogue scene");
    const strips = cataloguePaintStrips(filtersBox, listBox);
    await page.locator("[data-khorne-figure]:visible img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const capture = async () => Object.fromEntries(await Promise.all(Object.entries(strips)
      .map(async ([name, clip]) => [name, await page.screenshot({clip, caret: "hide"})])));
    const painted = await capture();
    await page.locator("[data-khorne-figure]").evaluateAll(elements => elements.forEach(element => {
      element.__khorneOracleVisibility = {value: element.style.getPropertyValue("visibility"), priority: element.style.getPropertyPriority("visibility")};
      element.style.setProperty("visibility", "hidden", "important");
    }));
    let unpainted;
    try { unpainted = await capture(); }
    finally {
      await page.locator("[data-khorne-figure]").evaluateAll(elements => elements.forEach(element => {
        const saved = element.__khorneOracleVisibility;
        if (saved) element.style.setProperty("visibility", saved.value, saved.priority);
        delete element.__khorneOracleVisibility;
      }));
    }
    const paintChanges = Object.fromEntries(await Promise.all(Object.keys(strips)
      .map(async name => [name, await paintDelta(page, painted[name], unpainted[name])])));
    assert.ok(paintChanges.leftRim + paintChanges.rightRim > 0, "at least one catalogue figure visibly enters its narrow allowed pane rim");
    assert.equal(paintChanges.leftInterior + paintChanges.rightInterior, 0, `figure paint never enters the work interior beyond the 14px allowance (${JSON.stringify(paintChanges)})`);

    await page.getByRole("button", {name: "Back to task", exact: true}).click();
    await page.getByRole("heading", {name: catalog.tasks[0].title, exact: true}).waitFor({state: "visible"});
    await nextPaint(page);
    const returnedRail = await page.locator("[data-khorne-rail]").boundingBox();
    assert.ok(returnedRail && Math.abs(returnedRail.x - taskRailBox.x) <= 1 && Math.abs(returnedRail.y - taskRailBox.y) <= 1 && Math.abs(returnedRail.width - taskRailBox.width) <= 1, "Task → catalogue → Task preserves the shared beam geometry");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("Khorne and Nurgle keep the persistent rail and lower header edge through the catalogue compact boundary", {timeout: 120_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const boxWithinOnePixel = (actual, expected, message) => {
    assert.ok(actual && expected, `${message}: both boxes are measurable`);
    for (const dimension of ["x", "y", "width", "height"]) {
      assert.ok(Math.abs(actual[dimension] - expected[dimension]) <= 1, `${message}: ${dimension} changed from ${expected[dimension]} to ${actual[dimension]}`);
    }
  };
  try {
    for (const theme of ["khorne", "nurgle"]) {
      for (const width of [831, 854]) {
        const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: "reduce"});
        try {
          const page = await context.newPage();
          const diagnostics = await prepare(page);
          await chooseTheme(page, theme[0].toUpperCase() + theme.slice(1));
          await nextPaint(page);
          const variant = `[data-warhammer-variant='${theme}']`;
          const taskHeader = page.locator(`header${variant}[data-khorne-header='task']`);
          const rail = page.locator(`${variant}[data-khorne-rail]`);
          const allTasks = taskHeader.getByRole("button", {name: "All tasks", exact: true});

          assert.equal(await taskHeader.count(), 1, `${theme} ${width}px starts with one Task header`);
          assert.equal(await rail.count(), 1, `${theme} ${width}px starts with one shared rail`);
          await nextPaint(page);
          const railHandle = await rail.elementHandle();
          const taskRailBox = await rail.boundingBox();
          const taskHeaderBox = await taskHeader.boundingBox();
          assert.ok(railHandle && taskRailBox && taskHeaderBox, `${theme} ${width}px Task rail and header are measurable`);
          assert.equal((await surface(page)).overflow, 0, `${theme} ${width}px Task has no horizontal overflow`);

          await allTasks.click();
          const catalogueHeader = page.locator(`header${variant}[data-khorne-header='catalogue']`);
          const back = catalogueHeader.getByRole("button", {name: "Back to task", exact: true});
          await back.waitFor({state: "visible"});
          await nextPaint(page);
          const catalogueRailBox = await rail.boundingBox();
          const catalogueHeaderBox = await catalogueHeader.boundingBox();
          const backBox = await back.boundingBox();
          boxWithinOnePixel(catalogueRailBox, taskRailBox, `${theme} ${width}px Task → catalogue preserves the shared rail geometry`);
          assert.ok(catalogueHeaderBox && Math.abs((catalogueHeaderBox.y + catalogueHeaderBox.height) - (taskHeaderBox.y + taskHeaderBox.height)) <= 1, `${theme} ${width}px Task → catalogue preserves the lower header edge`);
          assert.ok(backBox && backBox.width >= 44 && backBox.height >= 44, `${theme} ${width}px catalogue Back to task remains a 44px target`);
          assert.equal(await railHandle.evaluate((element, selector) => element === document.querySelector(selector), `${variant}[data-khorne-rail]`), true, `${theme} ${width}px keeps the exact same mounted rail element`);
          assert.equal((await surface(page)).overflow, 0, `${theme} ${width}px catalogue has no horizontal overflow`);

          await back.click();
          await page.getByRole("heading", {name: catalog.tasks[0].title, exact: true}).waitFor({state: "visible"});
          await allTasks.and(page.locator(":focus")).waitFor({state: "visible"});
          await nextPaint(page);
          boxWithinOnePixel(await rail.boundingBox(), taskRailBox, `${theme} ${width}px catalogue → Task restores the shared rail geometry`);
          assert.equal((await surface(page)).overflow, 0, `${theme} ${width}px returned Task has no horizontal overflow`);
          assertDiagnostics(diagnostics);
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
});

test("Khorne moves scenes below the pet strip on constrained desktop and hides them on compact catalogue", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1920, height: 1200}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Khorne");
    for (const width of [1920, 1440]) {
      await page.setViewportSize({width, height: 1200});
      await nextPaint(page);
      const strip = await page.getByLabel("Pet feeding strip", {exact: true}).boundingBox();
      const figures = await visibleKhorneGeometry(page, "[data-khorne-figure]");
      assert.ok(strip && figures.length === 3, `${width}px Task retains the three decorations in normal document flow`);
      assert.ok(figures.every(figure => figure.y >= strip.y + strip.height - 1), `${width}px Task decorations sit below the pet strip instead of narrowing the workspace`);
    }

    await page.setViewportSize({width: 800, height: 900});
    await nextPaint(page);
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
    const touchFilters = page.getByRole("button", {name: "Filters", exact: true});
    if (await touchFilters.count() && await touchFilters.isVisible() && await touchFilters.getAttribute("aria-expanded") === "false") await touchFilters.click();
    const touchRadio = page.getByRole("radio", {name: "All topics", exact: true});
    await touchRadio.waitFor({state: "visible"});
    const touchLabel = await touchRadio.evaluate(radio => {
      const label = radio.closest("label") || document.querySelector(`label[for="${radio.id}"]`);
      if (!label) throw new Error("the real All topics radio has no label target");
      const box = label.getBoundingClientRect();
      return {width: box.width, height: box.height};
    });
    assert.ok(touchLabel.width >= 44 && touchLabel.height >= 44, "800px touch All topics label keeps a 44px target");
    await page.emulateMedia({forcedColors: "active"});
    assert.notEqual(await touchRadio.evaluate(radio => getComputedStyle(radio).appearance), "none", "forced-colors Khorne uses the native radio appearance");
    await page.emulateMedia({forcedColors: "none"});
    if (await touchFilters.count() && await touchFilters.getAttribute("aria-expanded") === "true") await touchFilters.click();

    await page.setViewportSize({width: 430, height: 900});
    await nextPaint(page);
    const filters = page.getByRole("button", {name: "Filters", exact: true});
    await filters.focus();
    await page.keyboard.press("Enter");
    assert.equal(await filters.getAttribute("aria-expanded"), "true", "430px compact Filters opens from the keyboard");
    await page.getByRole("searchbox", {name: "Search tasks", exact: true}).waitFor({state: "visible"});
    await page.keyboard.press(" ");
    assert.equal(await filters.getAttribute("aria-expanded"), "false", "430px compact Filters closes from the keyboard");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, "430px catalogue has no horizontal overflow");
    assert.equal((await visibleKhorneGeometry(page, "[data-khorne-figure]")).length, 0, "430px catalogue hides decorative figures");

    await page.setViewportSize({width: 320, height: 844});
    await nextPaint(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, "320px catalogue has no horizontal overflow");
    assert.equal((await visibleKhorneGeometry(page, "[data-khorne-figure]")).length, 0, "320px catalogue hides decorative figures");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("Khorne keeps real hints, active Give up, and enabled Restore readable", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Khorne");

    await page.getByRole("tab", {name: "Hint", exact: true}).click();
    const hint = page.locator("details").filter({has: page.getByText("Hint 1", {exact: true})});
    await hint.waitFor({state: "visible"});
    const collapsedHint = await hint.evaluate(element => {
      const style = getComputedStyle(element), summary = element.querySelector("summary");
      if (!summary) throw new Error("the real hint accordion has no summary");
      return {foreground: getComputedStyle(summary).color, background: style.backgroundColor};
    });
    assertNormalTextContrast(collapsedHint.foreground, [collapsedHint.background], "collapsed Khorne hint summary");
    await hint.locator("summary").click();
    const openHint = await hint.evaluate(element => {
      const style = getComputedStyle(element), summary = element.querySelector("summary"), body = element.querySelector("p");
      if (!summary || !body) throw new Error("the open real hint accordion is incomplete");
      return {summary: getComputedStyle(summary).color, body: getComputedStyle(body).color, background: style.backgroundColor};
    });
    assertNormalTextContrast(openHint.summary, [openHint.background], "open Khorne hint summary");
    assertNormalTextContrast(openHint.body, [openHint.background], "open Khorne hint body");

    await page.getByRole("button", {name: "Give up: Показать решение", exact: true}).click();
    const giveUp = page.getByRole("button", {name: "Give up: Показано решение", exact: true});
    const taskTabs = page.getByRole("tablist", {name: "Task panel", exact: true});
    const taskTab = taskTabs.getByRole("tab", {name: "Task", exact: true});
    const taskPanelId = await taskTab.getAttribute("aria-controls");
    assert.ok(taskPanelId, "the real Task tab continues to name its panel after Give up");
    const taskPanel = page.locator(`[id="${taskPanelId}"]`);
    assert.equal(await taskTab.getAttribute("aria-selected"), "true", "Give up presents the reference solution through the selected Task tab");
    assert.equal(await taskTab.getAttribute("tabindex"), "0", "the selected Task tab remains keyboard-tabbable");
    assert.equal(await taskTabs.locator("[role='tab'][aria-selected='true']").count(), 1, "Give up retains exactly one selected task tab");
    assert.equal(await taskTabs.locator("[role='tab'][tabindex='0']").count(), 1, "Give up retains exactly one tabbable task tab");
    assert.equal(await taskPanel.getAttribute("role"), "tabpanel", "the reference solution stays in the labelled Task tabpanel");
    assert.equal(await taskPanel.getAttribute("aria-labelledby"), await taskTab.getAttribute("id"), "the Task tabpanel remains labelled by its live Task tab");
    await taskPanel.locator(".monaco-editor").waitFor({state: "visible"});
    const selectedGiveUp = await giveUp.evaluate(element => {
      const panel = document.querySelector("[class*='taskDetailsContainer']");
      if (!panel) throw new Error("the real task control panel is missing");
      return {foreground: getComputedStyle(element).color, background: getComputedStyle(panel).backgroundColor};
    });
    assertNormalTextContrast(selectedGiveUp.foreground, [selectedGiveUp.background], "selected Khorne Give up");

    await taskTab.click();
    await page.getByText(catalog.tasks[0].description, {exact: true}).waitFor({state: "visible"});
    assert.equal(await taskTab.getAttribute("aria-selected"), "true", "returning through the real Task tab restores its selected state");
    assert.equal(await taskPanel.locator(".monaco-editor").count(), 0, "returning through Task removes the reference solution from the description tabpanel");

    await page.getByRole("tab", {name: "My solution", exact: true}).click();
    const restore = page.getByRole("button", {name: "Restore to editor", exact: true});
    assert.equal(await restore.isDisabled(), true, "Restore remains unavailable before an inert draft is saved");
    await page.getByRole("button", {name: "Save current code", exact: true}).click();
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent?.trim() === "Restore to editor" && !button.disabled));
    assert.equal(await restore.isDisabled(), false, "saving the inert draft enables the real Restore action");
    const restorePaint = await restore.evaluate(element => {
      const style = getComputedStyle(element);
      const resolveColor = name => {
        const probe = document.createElement("span");
        probe.style.color = `var(${name})`;
        element.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      return {foreground: style.color, endpoints: ["--action-face-top", "--action-face-bottom", "--action-hover-top", "--action-hover-bottom"].map(resolveColor)};
    });
    assertNormalTextContrast(restorePaint.foreground, restorePaint.endpoints, "enabled Khorne Restore gradient endpoints");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("inline theme boot paints persisted Dark, Khorne, and Nurgle before blocked React bundles hydrate", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const valid = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const khorne = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const nurgle = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const corrupt = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const unavailable = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  try {
    await valid.addInitScript(([key]) => localStorage.setItem(key, "dark"), [themeStorageKey]);
    await khorne.addInitScript(([key]) => localStorage.setItem(key, "khorne"), [themeStorageKey]);
    await nurgle.addInitScript(([key]) => localStorage.setItem(key, "nurgle"), [themeStorageKey]);
    await corrupt.addInitScript(([key]) => localStorage.setItem(key, "corrupt"), [themeStorageKey]);
    await unavailable.addInitScript(() => Object.defineProperty(window, "localStorage", {configurable: true, get() { throw new DOMException("blocked", "SecurityError"); }}));
    for (const [context, expectedTheme, expectedPage] of [[valid, "dark", dark.page], [khorne, "khorne", null], [nurgle, "nurgle", null], [corrupt, "light", light.page], [unavailable, "light", light.page]]) {
      let bundles = 0;
      const loadedAssets = [];
      await context.route("**/_next/static/**/*.js", route => { bundles += 1; return route.fulfill({contentType: "application/javascript", body: ""}); });
      const page = await context.newPage();
      page.on("response", response => loadedAssets.push(new URL(response.url()).pathname));
      const response = await page.goto(baseUrl, {waitUntil: "load"});
      assert.equal(response?.status(), 200, "the real server response starts before React bundles are released");
      const serverHtml = await response?.text();
      assert.match(serverHtml || "", /cattasks-theme/, "the real server HTML contains the inline theme boot contract");
      await page.locator(`[data-cattasks-theme='${expectedTheme}']`).waitFor();
      const outerPaint = await page.locator("[class*='background']").evaluate(element => getComputedStyle(element).backgroundColor);
      if (expectedPage) assert.equal(outerPaint, expectedPage, "the visible outer page is painted by inline theme boot before React can hydrate");
      else {
        assert.notEqual(outerPaint, light.page, `${expectedTheme} outer page is painted before React can hydrate`);
        const sceneSelector = expectedTheme === "nurgle" ? "[data-cattasks-theme='nurgle'] [data-nurgle-scene='task']" : "[data-khorne-scene='task']";
        assert.match(await page.locator(sceneSelector).evaluate(element => getComputedStyle(element).backgroundImage), new RegExp(`cattasks/themes/${expectedTheme}/`), `${expectedTheme} own scene is painted before React can hydrate`);
        assert.ok(loadedAssets.includes(`/cattasks/themes/${expectedTheme}/task/background-desktop.webp`), `the persisted ${expectedTheme} page loads its own scene before React hydration`);
        assert.ok(!loadedAssets.includes("/cattasks/desktop-meadow.png"), `the persisted ${expectedTheme} page does not load the Light desktop meadow`);
        if (expectedTheme === "nurgle") assert.equal(await page.locator("[class*='taskShelf']:visible, [class*='catalogueShelf']:visible, [class*='mascotCanvas']:visible, [class*='mobileFoxBody']:visible, [class*='shelfStickers']:visible").count(), 0, "prehydrated Nurgle leaves no painted legacy shelf or mascot");
      }
      assert.ok(bundles > 0, "all external Next static JavaScript bundles were intercepted before React could hydrate");
      await page.close();
    }
  } finally { await valid.close(); await khorne.close(); await nurgle.close(); await corrupt.close(); await unavailable.close(); await browser.close(); }
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
    await chooseTheme(page, "Dark");
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
    const control = await themeTrigger(blockedPage); await control.focus();
    assert.equal(await blockedPage.evaluate(() => document.activeElement?.matches(":focus-visible")), true, "320px switch retains keyboard focus");
    await blockedPage.keyboard.press("Enter");
    await blockedPage.getByRole("group", {name: "Themes", exact: true}).waitFor({state: "visible"});
    await blockedPage.getByRole("button", {name: "Dark", exact: true}).click();
    assert.equal((await surface(blockedPage)).theme, "dark", "storage failure does not disable the local switch");
    assert.equal((await surface(blockedPage)).overflow, 0, "320px task view has no horizontal clipping");
    assertDiagnostics(blockedDiagnostics);
  } finally { await corrupt.close(); await unavailable.close(); await browser.close(); }
});
