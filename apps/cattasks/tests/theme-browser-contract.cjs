const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43852";
const themeStorageKey = "cattasks-theme";
const light = {page: "rgb(214, 225, 212)", panel: "rgb(250, 249, 242)", editor: "rgb(253, 254, 252)", pet: "rgb(41, 74, 59)", catalogue: "rgb(247, 249, 246)", fileInput: "rgb(255, 253, 248)"};
const dark = {page: "rgb(16, 38, 47)", panel: "rgb(27, 53, 64)", editor: "rgb(17, 42, 51)"};
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
async function compactFilterMetrics(page) {
  return page.evaluate(() => {
    const panel = document.querySelector("[aria-label='Task filters']");
    if (!panel) throw new Error("missing actual Task filters surface");
    if (!panel.id) throw new Error("actual Task filters surface has no id for its real trigger");
    const trigger = document.querySelector(`button[aria-controls="${CSS.escape(panel.id)}"]`);
    if (!trigger) throw new Error("missing actual compact Filters trigger");
    const workspaceContent = panel.closest("[data-cattasks-workspace-content]");
    if (!workspaceContent) throw new Error("Task filters have no actual workspace-content container");
    const visible = element => {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    const paths = new Set();
    const collectUrls = value => {
      for (const match of value.matchAll(/url\((['"]?)(.*?)\1\)/g)) {
        if (match[2]) paths.add(new URL(match[2], location.href).pathname);
      }
    };
    const collectPaint = (element, pseudo) => {
      const style = getComputedStyle(element, pseudo);
      for (const value of [style.backgroundImage, style.borderImageSource, style.maskImage, style.content]) collectUrls(value || "");
    };
    for (const element of [panel, trigger, ...panel.querySelectorAll("*"), ...trigger.querySelectorAll("*")]) {
      if (!visible(element)) continue;
      collectPaint(element);
      collectPaint(element, "::before");
      collectPaint(element, "::after");
      if (element instanceof HTMLImageElement) paths.add(new URL(element.currentSrc || element.src, location.href).pathname);
      if (element instanceof SVGImageElement) {
        const href = element.getAttribute("href");
        if (href) paths.add(new URL(href, location.href).pathname);
      }
    }
    const workspaceBox = workspaceContent.getBoundingClientRect(), triggerBox = trigger.getBoundingClientRect();
    return {catalogueInlineSize: workspaceBox.width, trigger: {width: triggerBox.width, height: triggerBox.height}, paths: [...paths]};
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
  const names = ["Light", "Dark", "Khorne", "Nurgle", "Slaanesh", "Tzeentch"];
  const buttons = choices.getByRole("button");
  assert.equal(await buttons.count(), names.length, "exactly six theme controls are exposed");
  for (const [index, name] of names.entries()) {
    const option = choices.getByRole("button", {name, exact: true});
    assert.equal(await option.count(), 1, `${name} is exposed as one accessible theme control`);
    assert.equal(await option.evaluate((element, ordinal) => [...element.parentElement.querySelectorAll("button")].indexOf(element), index), index, `${name} keeps its approved option order`);
  }
}

async function themeOptionIcon(option) {
  return option.evaluate(element => {
    const image = element.querySelector("img");
    if (!image) throw new Error("the real theme option has no faction icon");
    return new URL(image.currentSrc || image.src, location.href).pathname;
  });
}

async function triggerArtwork(trigger) {
  return trigger.evaluate(async element => {
    const image = element.querySelector("img");
    if (!image) throw new Error("the real theme trigger has no current-theme artwork");
    await image.decode();
    const box = image.getBoundingClientRect();
    return {
      path: new URL(image.currentSrc || image.src, location.href).pathname,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      width: box.width,
      height: box.height,
    };
  });
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

async function v146Artwork(header, label) {
  assert.equal(await header.count(), 1, `${label} has one v146 header`);
  const decoration = header.locator("[data-cattasks-decoration]");
  assert.equal(await decoration.count(), 1, `${label} has one v146 SVG artwork layer`);
  const artwork = await decoration.evaluate(layer => ({
    ariaHidden: layer.getAttribute("aria-hidden"),
    pointerEvents: getComputedStyle(layer).pointerEvents,
    images: [...layer.querySelectorAll("svg image")].map(image => new URL(image.getAttribute("href"), location.href).pathname),
    markup: layer.innerHTML,
  }));
  assert.equal(artwork.ariaHidden, "true", `${label} artwork is hidden from the accessibility tree`);
  assert.equal(artwork.pointerEvents, "none", `${label} artwork cannot intercept its live controls`);
  return artwork;
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
    assert.equal(await activeGiveUp.evaluate(element => getComputedStyle(element).color), "rgb(227, 238, 232)", "Dark active Give up uses the approved visible ink");
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
    assert.deepEqual(await savedCode.evaluate(element => ({backgroundColor: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color})), {backgroundColor: "rgb(17, 42, 51)", color: "rgb(227, 238, 232)"}, "Dark saved code uses the v146 editor token and ink");
    await chooseTheme(page, "Light");
    assert.deepEqual(await savedCode.evaluate(element => ({backgroundColor: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color})), {backgroundColor: "rgb(253, 254, 252)", color: "rgb(41, 74, 59)"}, "returning to Light restores the v146 editor token and ink");
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
    const lantern = await page.evaluate(() => {
      const vignette = [...document.querySelectorAll("[aria-hidden='true'] *")].find(node => getComputedStyle(node).backgroundImage.includes("study-vignette.webp"));
      const glow = document.querySelector("[data-cattasks-header='capybara'] [class*='lanternGlow']");
      if (!vignette) return null;
      const rect = vignette.getBoundingClientRect();
      const glowRect = glow?.getBoundingClientRect();
      const glowStyle = glow && getComputedStyle(glow);
      return {source: getComputedStyle(vignette).backgroundImage, x: rect.x, y: rect.y, width: rect.width, height: rect.height, glowOpacity: glowStyle?.opacity, glowDisplay: glowStyle?.display, glowVisibility: glowStyle?.visibility, glowGradient: glowStyle?.backgroundImage, glowWidth: glowRect?.width, glowHeight: glowRect?.height};
    });
    assert.match(lantern?.source ?? "", /study-vignette\.webp/, "Dark exposes the supplied study vignette through its CSS mask");
    assert.ok(Number.parseFloat(lantern?.glowOpacity ?? "0") > 0, "Dark keeps the authored static lantern glow visible");
    assert.equal(lantern?.glowDisplay, "block", "Dark renders the scoped lantern glow layer");
    assert.notEqual(lantern?.glowVisibility, "hidden", "Dark keeps the scoped lantern glow visible");
    assert.ok((lantern?.glowWidth ?? 0) > 0 && (lantern?.glowHeight ?? 0) > 0, "Dark gives the scoped lantern glow a rendered box");
    assert.match(lantern?.glowGradient ?? "", /radial-gradient/, "Dark uses the authored lantern radial gradient rather than ambient decoration");
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
    assert.ok(titleBox && backBox && backBox.x + backBox.width <= titleBox.x && Math.min(titleBox.y + titleBox.height, backBox.y + backBox.height) > Math.max(titleBox.y, backBox.y), "the live catalogue Back to task action remains left of, and vertically aligned with, its All tasks title");
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

test("Slaanesh v146 body keeps its violet workspace materials across the three real constructions", {timeout: 120_000, concurrency: false}, async t => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 950}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Slaanesh");
    const constructionChoices = page.getByRole("group", {name: "Header construction", exact: true});
    if (!await constructionChoices.isVisible()) {
      await (await themeTrigger(page)).click();
      await constructionChoices.waitFor({state: "visible"});
    }
    for (const construction of ["Industrial", "Gothic", "Armor"]) {
      await t.test(`${construction} keeps the real reader, editor, actions, and Output distinct`, async () => {
        const constructionChoice = constructionChoices.getByRole("button", {name: construction, exact: true});
        await constructionChoice.click();
        assert.equal(await constructionChoice.getAttribute("aria-pressed"), "true", `${construction} remains the actual selected construction`);
        const materials = await page.evaluate(() => {
          const required = (selector, label) => {
            const element = document.querySelector(selector);
            if (!element) throw new Error(`missing ${label}`);
            return element;
          };
          const paint = element => {
            const style = getComputedStyle(element);
            return {background: style.backgroundColor, radius: style.borderTopLeftRadius};
          };
          const box = element => {
            const rect = element.getBoundingClientRect();
            return {top: rect.top, bottom: rect.bottom};
          };
          const readerControls = required("[aria-label='Режим содержимого']", "real reader controls");
          const reader = readerControls.closest("[class*='taskDetailsContainer']");
          if (!reader) throw new Error("reader controls have no real reader panel");
          const editor = required("section[aria-labelledby='taskSolutionHeading']", "real editor section");
          const output = required("section[aria-labelledby='taskOutputHeading']", "real Output section");
          const run = required("button[aria-label='Run Code']", "real Run action");
          const test = required("button[aria-label='Test Code']", "real Test action");
          return {
            reader: paint(reader), editor: paint(editor), output: paint(output),
            readerToolbar: paint(readerControls),
            editorToolbar: paint(required("#taskSolutionHeading", "editor heading").closest("header") ?? required("#taskSolutionHeading", "editor heading")),
            outputToolbar: paint(required("#taskOutputHeading", "Output heading").closest("header") ?? required("#taskOutputHeading", "Output heading")),
            editorSurface: box(required(".monaco-editor", "editable Monaco surface")),
            run: box(run), test: box(test), outputBox: box(output),
          };
        });
        assert.deepEqual(
          {reader: materials.reader, editor: materials.editor, output: materials.output},
          {
            reader: {background: "rgb(26, 30, 29)", radius: "4px"},
            editor: {background: "rgb(17, 23, 25)", radius: "4px"},
            output: {background: "rgb(22, 28, 27)", radius: "4px"},
          },
          `${construction} keeps the source-approved separate 4px reader (#1a1e1d), editor (#111719), and Output (#161c1b) body materials`,
        );
        for (const [name, toolbar] of Object.entries({reader: materials.readerToolbar, editor: materials.editorToolbar, output: materials.outputToolbar})) {
          assert.equal(toolbar.background, "rgb(53, 45, 57)", `${construction} gives the Slaanesh ${name} toolbar the approved #352d39 raised-violet material`);
        }
        assert.ok(materials.run.top >= materials.editorSurface.bottom && materials.test.top >= materials.editorSurface.bottom, `${construction} keeps real Run and Test below Monaco without invoking either action`);
        assert.ok(materials.outputBox.top >= Math.max(materials.run.bottom, materials.test.bottom), `${construction} keeps Output after the real action strip`);
      });
    }
    const tabs = page.locator("[aria-label='Режим содержимого']");
    const saved = tabs.getByRole("tab", {name: "My solution", exact: true});
    await saved.click();
    assert.equal(await saved.getAttribute("aria-selected"), "true", "Slaanesh retains the actual My solution tab state after construction changes");
    await page.getByRole("button", {name: "Save current code", exact: true}).click();
    const savedCode = page.getByLabel("Saved solution code", {exact: true});
    await savedCode.waitFor({state: "visible"});
    const savedPaint = await savedCode.evaluate(element => ({foreground: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor}));
    assertNormalTextContrast(savedPaint.foreground, [savedPaint.background], "Slaanesh visibly saved solution code after the real Save current code action");
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
    assert.equal(await page.locator("[aria-label='Task filters']").count(), 1, "Slaanesh reaches the real All tasks catalogue without losing its actual filter surface");
    const catalogueMetrics = async width => {
      await page.setViewportSize({width, height: 950}); await nextPaint(page);
      return page.evaluate(() => {
        const required = (selector, label) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`missing ${label}`);
          return element;
        };
        const list = required("[aria-labelledby='taskListTitle']", "real All tasks list");
        const row = required("[aria-labelledby='taskListTitle'] li", "real All tasks row");
        const title = required("[aria-labelledby='taskListTitle'] li h3", "real All tasks row title");
        const pager = required("nav[aria-label='Task pages']", "real task pager");
        const visible = element => {
          const style = getComputedStyle(element), box = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
        };
        const titleBox = title.getBoundingClientRect();
        return {
          title: {width: titleBox.width, height: titleBox.height, visible: visible(title)},
          listOverflow: list.scrollWidth - list.clientWidth,
          pagerOverflow: pager.scrollWidth - pager.clientWidth,
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          pagerVisible: visible(pager), rowVisible: visible(row),
        };
      });
    };
    const desktopCatalogue = await catalogueMetrics(1440);
    assert.equal(desktopCatalogue.rowVisible, true, "1440px Slaanesh All tasks keeps a real catalogue row visible");
    assert.equal(desktopCatalogue.title.visible, true, "1440px Slaanesh All tasks keeps its real task title visible");
    assert.ok(desktopCatalogue.title.width >= 48 && desktopCatalogue.title.height > 0, `1440px Slaanesh All tasks preserves a readable title column (got ${desktopCatalogue.title.width}×${desktopCatalogue.title.height}px)`);
    assert.equal(desktopCatalogue.listOverflow, 0, "1440px Slaanesh All tasks list has no horizontal scroll width");
    assert.equal(desktopCatalogue.pagerOverflow, 0, "1440px Slaanesh task pager has no horizontal scroll width");
    for (const width of [320, 430]) {
      const compactCatalogue = await catalogueMetrics(width);
      assert.equal(compactCatalogue.rowVisible, true, `${width}px Slaanesh catalogue retains a real task row`);
      assert.equal(compactCatalogue.title.visible, true, `${width}px Slaanesh catalogue retains its real task title`);
      assert.equal(compactCatalogue.pagerVisible, true, `${width}px Slaanesh catalogue retains its real task pager`);
      assert.equal(compactCatalogue.listOverflow, 0, `${width}px Slaanesh list has no horizontal scroll width`);
      assert.equal(compactCatalogue.pagerOverflow, 0, `${width}px Slaanesh task pager has no horizontal scroll width`);
      assert.equal(compactCatalogue.documentOverflow, 0, `${width}px Slaanesh catalogue has no horizontal document overflow`);
    }
    const pager = page.getByRole("navigation", {name: "Task pages", exact: true});
    const currentPage = pager.locator("button[aria-current='page']");
    const nextPage = pager.getByRole("button", {name: "2", exact: true});
    assert.equal(await currentPage.innerText(), "1", "430px Slaanesh catalogue exposes its real current page");
    const paginationPaint = locator => locator.evaluate(button => {
      const background = element => {
        for (let candidate = element; candidate; candidate = candidate.parentElement) {
          const color = getComputedStyle(candidate).backgroundColor;
          if (!/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\)$/.test(color)) return color;
        }
        throw new Error("pagination control has no opaque rendered background");
      };
      return {foreground: getComputedStyle(button).color, background: background(button)};
    });
    const currentPagePaint = await paginationPaint(currentPage);
    assertNormalTextContrast(currentPagePaint.foreground, [currentPagePaint.background], "Slaanesh current catalogue page");
    await nextPage.hover();
    const hoveredPagePaint = await paginationPaint(nextPage);
    assertNormalTextContrast(hoveredPagePaint.foreground, [hoveredPagePaint.background], "Slaanesh hovered catalogue page");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
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
    const taskHeader = page.locator(`header${nurgle}[data-v146-header][data-khorne-header='task']`);
    const taskRail = page.locator(`${nurgle}[data-khorne-rail]`);
    assert.equal(await taskHeader.count(), 1, "Nurgle Task has one integrated live header");
    assert.equal(await taskRail.count(), 1, "Nurgle Task has one shared riveted rail");
    const taskArtwork = await v146Artwork(taskHeader, "Nurgle Task");
    assert.ok(taskArtwork.images.includes("/cattasks-art/v146/industrial/crest-gem.png"), "Nurgle Task includes its Industrial crest artwork");
    assert.ok(taskArtwork.images.includes("/cattasks-art/v146/classic/panel-armor-green.png"), "Nurgle Task includes its approved green Armor panel");
    assert.match(taskArtwork.markup, /#95b83e/i, "Nurgle Task renders its green rune glow");
    assert.match(taskArtwork.markup, /#363a22/i, "Nurgle Task renders its distinct green material palette");
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
    const catalogueHeader = page.locator(`header${nurgle}[data-v146-header][data-khorne-header='catalogue']`);
    const catalogueRail = page.locator(`${nurgle}[data-khorne-rail]`);
    assert.equal(await catalogueHeader.count(), 1, "Nurgle catalogue uses its distinct integrated header");
    assert.equal(await catalogueRail.count(), 1, "Nurgle catalogue retains one shared riveted rail");
    const catalogueArtwork = await v146Artwork(catalogueHeader, "Nurgle catalogue");
    assert.ok(catalogueArtwork.images.includes("/cattasks-art/v146/industrial/beam.png"), "Nurgle catalogue includes its Industrial beam artwork");
    assert.ok(catalogueArtwork.images.includes("/cattasks-art/v146/industrial/daemon-iron-support-v1.png"), "Nurgle catalogue includes its catalogue-specific Industrial support artwork");
    assert.ok(!catalogueArtwork.images.includes("/cattasks-art/v146/classic/panel-armor-green.png"), "Nurgle catalogue does not substitute the Task-only green Armor panel");
    assert.match(catalogueArtwork.markup, /#829536/i, "Nurgle catalogue renders its green catalogue accent");
    assert.match(catalogueArtwork.markup, /#363a22/i, "Nurgle catalogue renders its distinct green material palette");
    assert.equal(await railHandle.evaluate((rail, selector) => rail === document.querySelector(selector), `${nurgle}[data-khorne-rail]`), true, "Task to catalogue retains the same shared beam element");
    const catalogueHeaderBox = await catalogueHeader.boundingBox();
    assert.ok(taskHeaderBox && catalogueHeaderBox && Math.abs(taskHeaderBox.y + taskHeaderBox.height - (catalogueHeaderBox.y + catalogueHeaderBox.height)) <= 1, "Task and catalogue headers share their lower edge");
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

    const taskHeader = page.locator("header[data-v146-header][data-khorne-header='task'][data-warhammer-variant='khorne']");
    const taskArtwork = await v146Artwork(taskHeader, "Khorne Task");
    assert.ok(taskArtwork.images.includes("/cattasks-art/v146/industrial/vent-frame.png"), "Khorne Task includes the Industrial vent-frame artwork");
    assert.ok(taskArtwork.images.includes("/cattasks-art/v146/industrial/glowing-arches.png"), "Khorne Task includes the Industrial glowing arches artwork");
    assert.ok(taskArtwork.images.includes("/cattasks-art/v146/classic/panel-armor-ember.png"), "Khorne Task includes its approved ember Armor panel");
    assert.match(taskArtwork.markup, /#ba351d/i, "Khorne Task renders its ember rune glow");
    assert.match(taskArtwork.markup, /#3a2520/i, "Khorne Task renders its distinct ember material palette");

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

    const catalogueHeader = page.locator("header[data-v146-header][data-khorne-header='catalogue'][data-warhammer-variant='khorne']");
    const catalogueArtwork = await v146Artwork(catalogueHeader, "Khorne catalogue");
    assert.ok(catalogueArtwork.images.includes("/cattasks-art/v146/industrial/vent-frame.png"), "Khorne catalogue includes the Industrial vent-frame artwork");
    assert.ok(catalogueArtwork.images.includes("/cattasks-art/v146/industrial/beam.png"), "Khorne catalogue includes the Industrial beam artwork");
    assert.ok(catalogueArtwork.images.includes("/cattasks-art/v146/industrial/daemon-iron-support-v1.png"), "Khorne catalogue includes its catalogue-specific Industrial support artwork");
    assert.ok(!catalogueArtwork.images.includes("/cattasks-art/v146/classic/panel-armor-ember.png"), "Khorne catalogue does not substitute the Task-only ember Armor panel");
    assert.match(catalogueArtwork.markup, /#c32a1c/i, "Khorne catalogue renders its ember catalogue accent");
    assert.match(catalogueArtwork.markup, /#3a2520/i, "Khorne catalogue renders its distinct ember material palette");

    const [catalogueTitle, catalogueBack] = await Promise.all([
      page.getByRole("heading", {name: "All tasks", exact: true}).boundingBox(),
      page.getByRole("button", {name: "Back to task", exact: true}).boundingBox(),
    ]);
    assert.ok(catalogueTitle && catalogueBack, "catalogue title and real return action are visible over the inert v146 artwork");
    assert.ok(catalogueBack.x + catalogueBack.width <= catalogueTitle.x, "catalogue keeps Back to task left of its live title");

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

test("Khorne and Nurgle keep compact Filters labels upright", {timeout: 120_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const scenarios = [
    ["Khorne", 430], ["Khorne", 700], ["Nurgle", 430], ["Nurgle", 700],
  ];
  try {
    for (const [theme, width] of scenarios) {
      const context = await browser.newContext({viewport: {width, height: 932}, reducedMotion: "no-preference"});
      const page = await context.newPage();
      try {
        const diagnostics = await prepare(page);
        await chooseTheme(page, theme);
        await page.getByRole("button", {name: "All tasks", exact: true}).click();
        await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
        const filters = page.getByRole("button", {name: "Filters", exact: true});
        assert.equal(await filters.count(), 1, `${theme} ${width}px exposes one real compact Filters control`);
        assert.equal(await filters.getAttribute("aria-expanded"), "false", `${theme} ${width}px begins with real compact Filters closed`);
        await filters.focus(); await page.keyboard.press("Enter");
        assert.equal(await filters.getAttribute("aria-expanded"), "true", `${theme} ${width}px opens real compact Filters through the keyboard`);
        await page.waitForFunction(button => {
          const visible = element => {
            const style = getComputedStyle(element), box = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
          };
          const label = [...button.children].find(child => child.getAttribute("aria-hidden") !== "true" && child.textContent?.trim() === "Filters" && visible(child));
          const arrow = [...button.children].find(child => child.getAttribute("aria-hidden") === "true" && visible(child));
          if (!label || !arrow) return false;
          const matrix = new DOMMatrixReadOnly(getComputedStyle(arrow).transform);
          return Math.abs(matrix.a + 1) < .001 && Math.abs(matrix.b) < .001 && Math.abs(matrix.c) < .001 && Math.abs(matrix.d + 1) < .001;
        }, await filters.elementHandle(), {timeout: 2_000});
        const glyphs = await filters.evaluate(button => {
          const visible = element => {
            const style = getComputedStyle(element), box = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
          };
          const label = [...button.children].find(child => child.getAttribute("aria-hidden") !== "true" && child.textContent?.trim() === "Filters" && visible(child));
          const arrow = [...button.children].find(child => child.getAttribute("aria-hidden") === "true" && visible(child));
          if (!label || !arrow) throw new Error("real compact Filters requires a visible label child and aria-hidden arrow child");
          return {labelTransform: getComputedStyle(label).transform, arrowTransform: getComputedStyle(arrow).transform};
        });
        assert.equal(glyphs.labelTransform, "none", `${theme} ${width}px keeps the visible Filters label upright after the real open transition`);
        assert.match(glyphs.arrowTransform, /matrix\(-1,\s*0,\s*0,\s*-1,\s*0,\s*0\)/, `${theme} ${width}px rotates only the aria-hidden Filters arrow by 180 degrees`);
        assertDiagnostics(diagnostics);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
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

test("Slaanesh is the fifth keyboard-native theme with distinct trigger, option, scenes, and retained task state", {timeout: 120_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 2560, height: 1200}, reducedMotion: "reduce"});
  const page = await context.newPage();
  const variant = "[data-warhammer-variant='slaanesh']";
  const figureSelector = "[data-slaanesh-figure]";
  try {
    const diagnostics = await prepare(page);
    const trigger = await themeTrigger(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    const choices = page.getByRole("group", {name: "Themes", exact: true});
    await choices.waitFor({state: "visible"});
    await expectShippedThemeChoices(choices);
    assert.equal(await choices.getByRole("button", {name: "Light", exact: true}).evaluate(element => document.activeElement === element), true, "opening the fifth-theme chooser puts focus on its first native option");
    for (let index = 0; index < 4; index += 1) await page.keyboard.press("Tab");
    const choice = choices.getByRole("button", {name: "Slaanesh", exact: true});
    assert.equal(await choice.evaluate(element => document.activeElement === element), true, "keyboard traversal reaches the fifth native Slaanesh choice");
    assert.equal(await themeOptionIcon(choice), "/cattasks/themes/slaanesh/icon.svg", "Slaanesh has its own faction SVG in the chooser rather than reusing its current-theme trigger art");
    await page.keyboard.press("Escape");
    await choices.waitFor({state: "hidden"});
    assert.equal(await page.evaluate(label => document.activeElement?.getAttribute("aria-label") === label, await trigger.getAttribute("aria-label")), true, "Escape restores focus from Slaanesh to the live trigger");
    await trigger.focus(); await page.keyboard.press("Enter");
    for (let index = 0; index < 4; index += 1) await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.locator("[data-cattasks-theme='slaanesh']").waitFor();
    await expectCurrentTheme(page, "Slaanesh");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), themeStorageKey), "slaanesh", "the fifth native choice persists its valid preference");
    const art = await triggerArtwork(await themeTrigger(page));
    assert.match(art.path, /\/cattasks\/themes\/slaanesh\/.*\.png$/i, "the current Slaanesh trigger uses its supplied wide PNG, not the faction SVG");
    assert.ok(art.naturalWidth > art.naturalHeight && art.width > art.height, "the supplied Slaanesh trigger PNG remains proportionally wide");

    const taskHeader = page.locator(`header${variant}[data-v146-header][data-khorne-header='task']`);
    const taskArtwork = await v146Artwork(taskHeader, "Slaanesh Task");
    assert.ok(taskArtwork.images.includes("/cattasks-art/v146/industrial/crest-gem.png"), "Slaanesh Task retains the native central v146 crest");
    assert.ok((await visibleGeometry(page, figureSelector, "data-slaanesh-figure")).length === 2, "wide Slaanesh Task exposes exactly its supplied two decorative figures");
    assert.deepEqual((await page.locator(`${figureSelector}:visible img`).evaluateAll(images => images.map(image => new URL(image.currentSrc || image.src).pathname).sort())), ["/cattasks/themes/slaanesh/task/daemon.webp", "/cattasks/themes/slaanesh/task/marine.webp"], "Slaanesh Task uses only the supplied Task WebP figures");
    assert.match(await page.locator("[data-cattasks-theme='slaanesh'] [data-slaanesh-scene='task']").evaluate(element => getComputedStyle(element).backgroundImage), /slaanesh\/task\/background-desktop\.webp/, "Slaanesh Task paints its supplied desktop WebP backdrop");
    const models = (await surface(page)).models;
    await page.getByRole("tab", {name: "Hint", exact: true}).click();
    assert.equal(await page.getByRole("tab", {name: "Hint", exact: true}).getAttribute("aria-selected"), "true", "Slaanesh preserves the real task tab controls");

    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
    const catalogueHeader = page.locator(`header${variant}[data-v146-header][data-khorne-header='catalogue']`);
    await v146Artwork(catalogueHeader, "Slaanesh catalogue");
    assert.deepEqual((await page.locator(`${figureSelector}:visible img`).evaluateAll(images => images.map(image => new URL(image.currentSrc || image.src).pathname).sort())), ["/cattasks/themes/slaanesh/all-tasks/daemon.webp", "/cattasks/themes/slaanesh/all-tasks/marine.webp"], "Slaanesh catalogue uses only the supplied catalogue WebP figures");
    assert.match(await page.locator("[data-cattasks-theme='slaanesh'] [data-slaanesh-scene='all-tasks']").evaluate(element => getComputedStyle(element).backgroundImage), /slaanesh\/all-tasks\/background-desktop\.webp/, "Slaanesh catalogue paints its supplied desktop WebP backdrop");
    const search = page.getByRole("searchbox", {name: "Search tasks", exact: true});
    await search.fill("fixture 1");
    await page.getByRole("radio", {name: "Not started", exact: true}).check();
    await chooseTheme(page, "Dark"); await chooseTheme(page, "Slaanesh");
    assert.equal(await search.inputValue(), "fixture 1", "Slaanesh theme round-trip retains the real catalogue search");
    assert.equal(await page.getByRole("radio", {name: "Not started", exact: true}).isChecked(), true, "Slaanesh theme round-trip retains the real catalogue filter");
    await page.getByRole("button", {name: "Back to task", exact: true}).click();
    assert.deepEqual((await surface(page)).models, models, "Slaanesh Task/catalogue navigation retains the same Monaco model state");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("Slaanesh UTH-3 maps approved violet ink, focus, and rail across each real construction", {timeout: 90_000}, async t => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1600, height: 1000}, reducedMotion: "reduce"});
  const page = await context.newPage();
  const header = page.locator("header[data-warhammer-variant='slaanesh'][data-v146-header][data-khorne-header='task']");
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Slaanesh");
    const title = header.getByRole("heading", {name: catalog.tasks[0].title, exact: true});
    const allTasks = header.getByRole("button", {name: "All tasks", exact: true});
    const ordinal = header.getByText("TASK 01", {exact: true});
    for (const construction of ["Industrial", "Gothic", "Armor"]) {
      await t.test(construction + " keeps the published violet Task palette", async () => {
        const choices = page.getByRole("group", {name: "Header construction", exact: true});
        if (!await choices.isVisible()) {
          const trigger = await themeTrigger(page);
          await trigger.click();
          await choices.waitFor({state: "visible"});
        }
        const choice = choices.getByRole("button", {name: construction, exact: true});
        await choice.click();
        await header.waitFor({state: "visible"});
        assert.equal(await header.getAttribute("data-v146-construction"), construction.toLowerCase(), construction + " is selected through the real construction control");
        assert.equal(await choice.getAttribute("aria-pressed"), "true", construction + " truthfully exposes its selected state");
        assert.equal(await title.evaluate(element => getComputedStyle(element).color), "rgb(247, 232, 244)", construction + " uses approved #f7e8f4 live heading ink");
        assert.equal(await allTasks.evaluate(element => getComputedStyle(element).color), "rgb(247, 232, 244)", construction + " uses approved #f7e8f4 live action ink");
        assert.equal(await ordinal.evaluate(element => getComputedStyle(element).color), "rgb(219, 195, 223)", construction + " uses approved #dbc3df muted Task ordinal ink");
        await allTasks.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
        assert.deepEqual(await allTasks.evaluate(element => {
          const style = getComputedStyle(element);
          return {focusVisible: element.matches(":focus-visible"), outline: style.outline, outlineColor: style.outlineColor};
        }), {focusVisible: true, outline: "rgb(203, 185, 207) solid 3px", outlineColor: "rgb(203, 185, 207)"}, construction + " renders the approved #cbb9cf native keyboard ring");
        const railPaint = await header.locator("[data-khorne-rail]").evaluate(element => getComputedStyle(element).backgroundImage);
        assert.match(railPaint, /panel-strip-metal\.png/, construction + " keeps the shared support-rail artwork");
        assert.match(railPaint, /rgba\(167, 94, 145, 0\.16\).*rgba\(20, 15, 28, 0\.38\)/, construction + " exposes violet #a75e91 and plum #140f1c rail paint instead of bronze");
      });
    }
    await t.test("retains the native focus affordance in forced colors", async () => {
      for (const colorScheme of ["light", "dark"]) {
        await page.emulateMedia({forcedColors: "active", colorScheme});
        await allTasks.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
        const colors = await allTasks.evaluate(element => {
          const probe = document.createElement("span");
          probe.style.cssText = "position:absolute;color:CanvasText;outline:3px solid Highlight;forced-color-adjust:none";
          document.body.append(probe);
          const expected = getComputedStyle(probe);
          const actual = getComputedStyle(element);
          const result = {
            forcedColors: matchMedia("(forced-colors: active)").matches,
            focusVisible: element.matches(":focus-visible"),
            color: actual.color,
            outlineColor: actual.outlineColor,
            outlineStyle: actual.outlineStyle,
            outlineWidth: actual.outlineWidth,
            expectedColor: expected.color,
            expectedOutlineColor: expected.outlineColor,
          };
          probe.remove();
          return result;
        });
        assert.equal(colors.forcedColors, true, `forced-colors ${colorScheme} is active`);
        assert.equal(colors.focusVisible, true, `forced-colors ${colorScheme} keeps keyboard-visible focus`);
        assert.equal(colors.color, colors.expectedColor, `forced-colors ${colorScheme} resolves the real Slaanesh action to CanvasText`);
        assert.equal(colors.outlineColor, colors.expectedOutlineColor, `forced-colors ${colorScheme} resolves the real Slaanesh keyboard ring to Highlight`);
        assert.equal(colors.outlineStyle, "solid", `forced-colors ${colorScheme} retains a visible solid keyboard ring`);
        assert.equal(colors.outlineWidth, "3px", `forced-colors ${colorScheme} retains the approved keyboard ring width`);
      }
      await page.emulateMedia({forcedColors: "none", colorScheme: "light"});
    });
    assertDiagnostics(diagnostics);
  } finally { await page.emulateMedia({forcedColors: "none"}); await context.close(); await browser.close(); }
});

test("Slaanesh v146 workspace retains real controls across the approved 13-width envelope", {timeout: 180_000}, async t => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1600, height: 1000}, reducedMotion: "reduce"});
  const page = await context.newPage();
  const widths = [320, 360, 430, 622, 623, 700, 834, 933, 1040, 1160, 1280, 1440, 1600];
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Slaanesh");
    const workspaceContentEdges = () => page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      };
      const workspace = document.querySelector("[data-cattasks-workspace]");
      const content = [...document.querySelectorAll("[data-cattasks-workspace-content]")].filter(visible);
      if (!workspace || content.length !== 1) throw new Error("expected one visible workspace content surface");
      const owner = workspace.getBoundingClientRect(), surface = content[0].getBoundingClientRect();
      return {owner: {left: owner.left, right: owner.right}, content: {left: surface.left, right: surface.right}};
    });
    const assertWorkspaceContentWidth = async (width, view) => {
      const edges = await workspaceContentEdges();
      assert.ok(
        Math.abs(edges.content.left - edges.owner.left) <= 2 && Math.abs(edges.content.right - edges.owner.right) <= 2,
        `${width}px Slaanesh ${view} uses the owning workspace inline width (got ${JSON.stringify(edges)})`,
      );
    };
    for (const width of widths) {
      await page.setViewportSize({width, height: 1000}); await nextPaint(page);
      const header = page.locator("header[data-warhammer-variant='slaanesh'][data-v146-header][data-khorne-header='task']");
      assert.equal(await header.count(), 1, `${width}px Slaanesh Task keeps one integrated v146 header`);
      await assertWorkspaceContentWidth(width, "Task");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${width}px Slaanesh Task has no horizontal clipping`);
      if (width === 1600) assert.match(await page.locator("[data-cattasks-theme='slaanesh'] [data-slaanesh-scene='task']").evaluate(element => getComputedStyle(element).backgroundImage), /slaanesh\/task\/background-desktop\.webp/, "Slaanesh Task uses its supplied desktop backdrop in the wide envelope");
      if (width === 700) assert.match(await page.locator("[data-cattasks-theme='slaanesh'] [data-slaanesh-scene='task']").evaluate(element => getComputedStyle(element).backgroundImage), /slaanesh\/task\/background-tablet\.webp/, "Slaanesh Task uses its supplied tablet backdrop in the intermediate envelope");
      if (width === 430) assert.match(await page.locator("[data-cattasks-theme='slaanesh'] [data-slaanesh-scene='task']").evaluate(element => getComputedStyle(element).backgroundImage), /slaanesh\/task\/background-mobile\.webp/, "Slaanesh Task uses its supplied mobile backdrop in the compact envelope");
      const trigger = await themeTrigger(page);
      const box = await trigger.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44, `${width}px Slaanesh keeps its live theme control target`);
    }
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
    for (const width of widths) {
      await page.setViewportSize({width, height: 1000}); await nextPaint(page);
      const header = page.locator("header[data-warhammer-variant='slaanesh'][data-v146-header][data-khorne-header='catalogue']");
      assert.equal(await header.count(), 1, `${width}px Slaanesh catalogue keeps one integrated v146 header`);
      await assertWorkspaceContentWidth(width, "catalogue");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${width}px Slaanesh catalogue has no horizontal clipping`);
      if (width === 1600) assert.match(await page.locator("[data-cattasks-theme='slaanesh'] [data-slaanesh-scene='all-tasks']").evaluate(element => getComputedStyle(element).backgroundImage), /slaanesh\/all-tasks\/background-desktop\.webp/, "Slaanesh catalogue uses its supplied desktop backdrop in the wide envelope");
      if (width === 700) assert.match(await page.locator("[data-cattasks-theme='slaanesh'] [data-slaanesh-scene='all-tasks']").evaluate(element => getComputedStyle(element).backgroundImage), /slaanesh\/all-tasks\/background-tablet\.webp/, "Slaanesh catalogue uses its supplied tablet backdrop in the intermediate envelope");
      if (width === 430) assert.match(await page.locator("[data-cattasks-theme='slaanesh'] [data-slaanesh-scene='all-tasks']").evaluate(element => getComputedStyle(element).backgroundImage), /slaanesh\/all-tasks\/background-mobile\.webp/, "Slaanesh catalogue uses its supplied mobile backdrop in the compact envelope");
    }
    await t.test("uses the 52px compact control at the actual tablet catalogue width", async () => {
      await page.setViewportSize({width: 700, height: 1000}); await nextPaint(page);
      const metrics = await compactFilterMetrics(page);
      assert.ok(metrics.catalogueInlineSize > 480 && metrics.catalogueInlineSize <= 700, `700px viewport exposes the approved compact-tablet catalogue width (got ${metrics.catalogueInlineSize}px)`);
      assert.equal(metrics.trigger.height, 52, "the real Slaanesh Filters trigger is 52px high at the compact-tablet catalogue width");
    });
    await t.test("uses the 54px compact control at the actual phone catalogue width", async () => {
      await page.setViewportSize({width: 430, height: 1000}); await nextPaint(page);
      const metrics = await compactFilterMetrics(page);
      assert.ok(metrics.catalogueInlineSize <= 480, `430px viewport exposes the approved phone catalogue width (got ${metrics.catalogueInlineSize}px)`);
      assert.equal(metrics.trigger.height, 54, "the real Slaanesh Filters trigger is 54px high at the phone catalogue width");
    });
    await t.test("uses the approved shared bracket art on the open compact control and body", async () => {
      await page.setViewportSize({width: 430, height: 1000}); await nextPaint(page);
      const compactFilters = page.getByRole("button", {name: "Filters", exact: true});
      if (await compactFilters.getAttribute("aria-expanded") !== "true") await compactFilters.click();
      const metrics = await compactFilterMetrics(page);
      assert.ok(metrics.paths.includes("/cattasks/themes/shared/all-tasks/filter-brackets/filter-bar.png"), "the visible compact Filters surface uses the approved shared filter-bar art");
      assert.ok(metrics.paths.includes("/cattasks/themes/shared/all-tasks/filter-brackets/surface.png"), "the visible open Filters body uses the approved shared surface art");
    });
    await page.setViewportSize({width: 700, height: 1000}); await nextPaint(page);
    const filters = page.getByRole("button", {name: "Filters", exact: true});
    if (await filters.isVisible() && await filters.getAttribute("aria-expanded") !== "true") await filters.click();
    const radio = page.getByRole("radio", {name: "All topics", exact: true});
    const label = await radio.evaluate(element => {
      const target = element.closest("label") || document.querySelector(`label[for="${element.id}"]`);
      const box = target?.getBoundingClientRect(); return box && {width: box.width, height: box.height};
    });
    assert.ok(label && label.width >= 44 && label.height >= 44, "Slaanesh compact Filters keeps its native radio label at least 44px");
    await page.emulateMedia({forcedColors: "active"});
    assert.notEqual(await radio.evaluate(element => getComputedStyle(element).appearance), "none", "forced-colors Slaanesh retains the native radio appearance");
    await page.emulateMedia({forcedColors: "none"});
    if (await filters.isVisible() && await filters.getAttribute("aria-expanded") === "true") await filters.click();
    await page.setViewportSize({width: 430, height: 1000}); await nextPaint(page);
    const compactFilters = page.getByRole("button", {name: "Filters", exact: true});
    await compactFilters.focus(); await page.keyboard.press("Enter");
    assert.equal(await compactFilters.getAttribute("aria-expanded"), "true", "430px Slaanesh Filters opens through the keyboard");
    const compactOrder = await page.evaluate(() => {
      const trigger = document.querySelector("button[aria-controls='khorne-task-filters']");
      const filters = document.querySelector("[aria-label='Task filters']");
      const list = document.querySelector("[aria-labelledby='taskListTitle']");
      if (!trigger || !filters || !list) throw new Error("missing real compact catalogue controls");
      return {
        triggerBottom: trigger.getBoundingClientRect().bottom,
        filtersTop: filters.getBoundingClientRect().top,
        listTop: list.getBoundingClientRect().top,
      };
    });
    assert.ok(
      compactOrder.triggerBottom <= compactOrder.filtersTop + 1 && compactOrder.triggerBottom <= compactOrder.listTop + 1,
      `430px compact Filters control precedes its opened panel and task list (got ${JSON.stringify(compactOrder)})`,
    );
    const compactSearch = page.getByRole("searchbox", {name: "Search tasks", exact: true});
    await compactSearch.fill("fixture 1");
    assert.equal(await compactSearch.evaluate(element => document.activeElement === element), true, "the real compact Search keeps focus while its filter text is edited");
    const activeFilters = page.locator("[aria-label='Task filters']").getByRole("status");
    assert.equal(await activeFilters.count(), 1, "Slaanesh exposes one live summary for the active compact search");
    assert.match(await activeFilters.innerText(), /Active filters: Search: fixture 1/, "the compact summary names the real active search rather than a decorative state");
    await page.keyboard.press("Escape");
    assert.equal(await compactFilters.getAttribute("aria-expanded"), "false", "Escape from focused Slaanesh Search closes compact Filters");
    assert.equal(await compactFilters.evaluate(element => document.activeElement === element), true, "Escape returns focus to the compact Filters trigger");
    assert.equal(await compactSearch.isVisible(), false, "collapsed Filters removes Search from the visible focusable body");
    await page.keyboard.press("Enter");
    assert.equal(await compactSearch.inputValue(), "fixture 1", "Slaanesh compact Filters retains its real search state while reopening");
    await page.getByRole("button", {name: "Reset filters", exact: true}).click();
    assert.equal(await compactSearch.inputValue(), "", "Reset filters clears the actual compact search value");
    assert.equal(await activeFilters.count(), 0, "Reset filters removes the active-filter summary after restoring defaults");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("Slaanesh collapsed Task uses the supplied recessed control at the actual 600px workspace threshold", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1100, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Slaanesh");
    const workspace = page.locator("[data-cattasks-workspace]").first();
    assert.equal(await workspace.count(), 1, "Slaanesh exposes one actual workspace for the recessed-control breakpoint");
    const models = (await surface(page)).models;
    await page.getByRole("button", {name: "Hide task", exact: true}).click();
    const showTask = page.getByRole("button", {name: "Show task", exact: true});
    await showTask.waitFor({state: "visible"});
    const measure = async width => {
      await workspace.evaluate((element, value) => {
        element.style.width = `${value}px`;
        element.style.maxWidth = `${value}px`;
      }, width);
      await nextPaint(page);
      const exactWorkspaceWidth = await workspace.evaluate(element => element.getBoundingClientRect().width);
      const control = await showTask.evaluate(element => {
        const box = element.getBoundingClientRect();
        const editor = document.querySelector("section[aria-labelledby='taskSolutionHeading']")?.getBoundingClientRect();
        if (!editor) throw new Error("the visible Task editor is required for recessed-control placement");
        const decorativeImages = [element, ...element.querySelectorAll("*")].flatMap(node => {
          const css = getComputedStyle(node).backgroundImage;
          const image = node instanceof HTMLImageElement ? (node.currentSrc || node.src) : "";
          return [css, image].filter(Boolean);
        });
        return {
          width: box.width,
          height: box.height,
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          sources: decorativeImages,
          editor: {left: editor.left, right: editor.right, top: editor.top, bottom: editor.bottom},
          glyphs: (() => {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (node.textContent.trim() !== "Show task") continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              const label = range.getBoundingClientRect();
              const arrow = element.querySelector("svg")?.getBoundingClientRect();
              if (!arrow) throw new Error("the real Show task control requires its inline arrow SVG");
              return {label: {left: label.left, right: label.right, top: label.top, bottom: label.bottom}, arrow: {left: arrow.left, right: arrow.right, top: arrow.top, bottom: arrow.bottom}};
            }
            throw new Error("the visible Show task label requires a real text range");
          })(),
        };
      });
      assert.equal(exactWorkspaceWidth, width, `the isolated workspace fixture holds the actual ${width}px CSS threshold`);
      assert.equal(await showTask.getAttribute("aria-expanded"), "false", `the ${width}px recessed control truthfully reports its collapsed Task`);
      assert.ok((await showTask.getAttribute("aria-controls")), `the ${width}px recessed control names the Task it restores`);
      assert.match(control.sources.join(" "), /recessed.*violet|violet.*recessed/i, `the ${width}px control exposes the supplied violet recessed art through real CSS or DOM`);
      return control;
    };
    const assertSeparatedGlyphs = (control, label) => {
      const {label: text, arrow} = control.glyphs;
      assert.ok(text.right <= arrow.left || arrow.right <= text.left || text.bottom <= arrow.top || arrow.bottom <= text.top,
        `${label} keeps the visible Show task text range separate from its inline right-arrow SVG`);
    };
    const horizontal = await measure(600);
    assert.ok(Math.abs(horizontal.width - 196) <= 1 && horizontal.width > horizontal.height, "600px keeps the 196px horizontal recessed control");
    assert.match(horizontal.sources.join(" "), /recessed-mobile-violet\.png/i, "600px uses only the supplied horizontal recessed asset");
    assert.ok(horizontal.bottom <= horizontal.editor.top + 2 && horizontal.right >= horizontal.editor.left - 2 && horizontal.left <= horizontal.editor.right + 2, "600px places the horizontal Task restore control in normal flow above the editor");
    assertSeparatedGlyphs(horizontal, "600px horizontal recessed control");
    const halfway = await measure(600.5);
    assert.ok(Math.abs(halfway.width - 52) <= 1 && halfway.height > halfway.width, "600.5px switches to the 52px vertical recessed control");
    assert.match(halfway.sources.join(" "), /recessed-violet\.png/i, "600.5px switches to the supplied vertical recessed asset");
    assert.ok(halfway.right <= halfway.editor.left + 2 && halfway.bottom >= halfway.editor.top - 2 && halfway.top <= halfway.editor.bottom + 2, "600.5px places the vertical Task restore control beside the editor");
    assertSeparatedGlyphs(halfway, "600.5px vertical recessed control");
    const vertical = await measure(601);
    assert.ok(Math.abs(vertical.width - 52) <= 1 && vertical.height > vertical.width, "601px retains the vertical recessed control");
    assert.match(vertical.sources.join(" "), /recessed-violet\.png/i, "601px retains the supplied vertical recessed asset");
    assert.ok(vertical.right <= vertical.editor.left + 2 && vertical.bottom >= vertical.editor.top - 2 && vertical.top <= vertical.editor.bottom + 2, "601px keeps the vertical Task restore control beside the editor");
    assertSeparatedGlyphs(vertical, "601px vertical recessed control");
    await showTask.focus(); await page.keyboard.press("Enter");
    await showTask.waitFor({state: "detached"});
    const hideTask = page.getByRole("button", {name: "Hide task", exact: true});
    await hideTask.waitFor({state: "visible"});
    assert.equal(await hideTask.getAttribute("aria-expanded"), "true", "keyboard restoration exposes the actual expanded Task control");
    assert.equal(await hideTask.getAttribute("aria-controls"), "taskPanelContent", "the expanded Task control names the panel it hides");
    assert.equal(await hideTask.evaluate(element => document.activeElement === element), true, "keyboard restoration transfers focus to the actual Hide task control");
    assert.deepEqual((await surface(page)).models, models, "collapsed Task restoration retains the existing Monaco model");
    await hideTask.click();
    await showTask.waitFor({state: "visible"});
    await page.setViewportSize({width: 430, height: 932});
    await workspace.evaluate(element => { element.style.width = ""; element.style.maxWidth = ""; });
    await nextPaint(page);
    const naturalMobile = await showTask.evaluate(element => {
      const box = element.getBoundingClientRect(), arrow = element.querySelector("svg")?.getBoundingClientRect();
      const range = document.createRange();
      const labelNode = [...element.childNodes].find(node => node.textContent?.trim() === "Show task");
      if (!arrow || !labelNode) throw new Error("natural mobile Show task control requires its visible label and inline arrow");
      range.selectNodeContents(labelNode);
      const label = range.getBoundingClientRect();
      return {width: box.width, height: box.height, glyphs: {label: {left: label.left, right: label.right, top: label.top, bottom: label.bottom}, arrow: {left: arrow.left, right: arrow.right, top: arrow.top, bottom: arrow.bottom}}};
    });
    assert.ok(Math.abs(naturalMobile.width - 196) <= 1 && Math.abs(naturalMobile.height - 53.68) <= 1, "the natural phone workspace uses the supplied 196px by 53.68px horizontal recessed control");
    assertSeparatedGlyphs(naturalMobile, "natural phone recessed control");
    await page.setViewportSize({width: 1440, height: 900}); await nextPaint(page);
    const naturalDesktop = await showTask.evaluate(element => {
      const box = element.getBoundingClientRect();
      return {width: box.width, height: box.height};
    });
    assert.ok(Math.abs(naturalDesktop.width - 52) <= 1 && Math.abs(naturalDesktop.height - 157.08) <= 1,
      "the natural desktop workspace uses the supplied 52px by 157.08px vertical recessed control");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("Slaanesh visual oracle reserves the workspace rail and keeps compact filters readable and reachable", {timeout: 120_000}, async t => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  const referencePlum = "rgb(63, 33, 75)";
  const contrastRatio = color => {
    const channels = color.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
    assert.equal(channels?.length, 3, `a rendered RGB foreground is available (got ${color})`);
    const luminance = values => values.map(value => value / 255).map(value => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const [first, second] = [luminance(channels), luminance(referencePlum.match(/\d+/g).map(Number))].sort((a, b) => b - a);
    return (first + .05) / (second + .05);
  };
  const verifyRailBeforeWorkspace = async (mode, viewport, openFilters = false) => {
    await page.setViewportSize(viewport); await nextPaint(page);
    if (mode === "catalogue") {
      const filters = page.getByRole("button", {name: "Filters", exact: true});
      if (openFilters && await filters.getAttribute("aria-expanded") !== "true") {
        await filters.focus(); await page.keyboard.press("Enter");
      }
      if (openFilters) assert.equal(await filters.getAttribute("aria-expanded"), "true", `${viewport.width}px actual Filters opens before measuring the live catalogue rail`);
    }
    const geometry = await page.evaluate(expectedMode => {
      const visible = element => {
        const style = getComputedStyle(element), box = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      };
      const header = document.querySelector(`header[data-v146-header][data-v146-mode='${expectedMode}'][data-warhammer-variant='slaanesh']`);
      if (!header || !visible(header)) throw new Error(`missing visible Slaanesh ${expectedMode} header`);
      const rail = header.querySelector("[data-khorne-rail]");
      if (!rail || !visible(rail)) throw new Error(`missing painted Slaanesh ${expectedMode} support rail`);
      const workspace = [...document.querySelectorAll("[data-cattasks-workspace-content]")].find(visible);
      if (!workspace) throw new Error(`missing visible ${expectedMode} workspace content`);
      const railBox = rail.getBoundingClientRect(), workspaceBox = workspace.getBoundingClientRect();
      return {rail: {top: railBox.top, bottom: railBox.bottom, height: railBox.height}, workspace: {top: workspaceBox.top, height: workspaceBox.height}};
    }, mode);
    assert.ok(geometry.rail.height > 0, `${viewport.width}px ${mode} exposes a real painted support rail`);
    assert.ok(geometry.workspace.height > 0, `${viewport.width}px ${mode} exposes real workspace content`);
    assert.ok(geometry.rail.bottom <= geometry.workspace.top + 1, `${viewport.width}px ${mode} support rail ends before its visible workspace begins (rail ${geometry.rail.top}..${geometry.rail.bottom}; workspace starts ${geometry.workspace.top})`);
  };
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Slaanesh");
    await t.test("keeps the Task rail outside live workspace at desktop and phone widths", async () => {
      await verifyRailBeforeWorkspace("task", {width: 1440, height: 900});
      await verifyRailBeforeWorkspace("task", {width: 430, height: 932});
    });
    await page.setViewportSize({width: 1440, height: 900}); await nextPaint(page);
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
    await t.test("keeps the All tasks rail outside live workspace, including open phone Filters", async () => {
      await verifyRailBeforeWorkspace("catalogue", {width: 1440, height: 900});
      await verifyRailBeforeWorkspace("catalogue", {width: 430, height: 932}, true);
    });
    await t.test("uses readable Slaanesh ink for real filter and import labels", async () => {
      await page.setViewportSize({width: 430, height: 932}); await nextPaint(page);
      const filters = page.getByRole("button", {name: "Filters", exact: true});
      if (await filters.getAttribute("aria-expanded") !== "true") await filters.click();
      assert.equal(await filters.getAttribute("aria-expanded"), "true", "the real phone Filters panel is open before its readable labels are measured");
      const paints = await page.evaluate(() => {
        const panel = document.querySelector("[aria-label='Task filters']");
        if (!panel) throw new Error("missing actual Task filters panel");
        const visibleExact = text => [...panel.querySelectorAll("*")].find(element => {
          const box = element.getBoundingClientRect(), style = getComputedStyle(element);
          return element.children.length === 0 && element.textContent?.trim() === text && style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
        });
        const labels = ["Difficulty", "Topics", "Import tasks JSON"].map(text => {
          const element = visibleExact(text);
          if (!element) throw new Error(`missing visible real ${text} label`);
          return {text, color: getComputedStyle(element).color};
        });
        return {panelPaint: getComputedStyle(panel).backgroundImage, labels};
      });
      assert.match(paints.panelPaint, /linear-gradient/i, "the visible normal-color Slaanesh filters expose their real gradient paint rather than a forced-colors Canvas fallback");
      assert.match(paints.panelPaint, /(?:rgb\(63, 33, 75\)|rgba\(63, 33, 75, 0\.84\))/i, "the first actual Slaanesh panel gradient stop is the approved plum reference fill");
      for (const label of paints.labels) assert.ok(contrastRatio(label.color) >= 4.5, `${label.text} has at least 4.5:1 rendered contrast against the approved plum panel fill (got ${label.color})`);
    });
    await t.test("keeps actual difficulty choices 44px, unclipped, and stateful", async () => {
      await page.setViewportSize({width: 430, height: 932}); await nextPaint(page);
      const filters = page.getByRole("button", {name: "Filters", exact: true});
      if (await filters.getAttribute("aria-expanded") !== "true") await filters.click();
      for (const name of ["Easy", "Medium", "Hard"]) {
        const choice = page.locator("[aria-label='Task filters']").getByRole("button", {name, exact: true});
        assert.equal(await choice.count(), 1, `${name} is one real difficulty button`);
        const before = await choice.getAttribute("aria-pressed");
        await choice.click();
        assert.notEqual(await choice.getAttribute("aria-pressed"), before, `${name} changes the live difficulty selection`);
        await choice.click();
        assert.equal(await choice.getAttribute("aria-pressed"), before, `${name} can restore its live difficulty selection`);
        const metrics = await choice.evaluate((button, label) => {
          const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent.trim() === label) {
            const range = document.createRange(); range.selectNodeContents(node);
            const text = range.getBoundingClientRect(), hit = button.getBoundingClientRect();
            return {hit: {top: hit.top, bottom: hit.bottom, height: hit.height}, text: {top: text.top, bottom: text.bottom, height: text.height}};
          }
          throw new Error(`missing live ${label} text node`);
        }, name);
        assert.ok(metrics.hit.height >= 44, `${name} has a compact real hit target of at least 44px (got ${metrics.hit.height}px)`);
        assert.ok(metrics.text.height > 0 && metrics.text.top >= metrics.hit.top - .5 && metrics.text.bottom <= metrics.hit.bottom + .5, `${name}'s full rendered label remains inside its painted hit box without top clipping`);
      }
    });
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("inline theme boot paints persisted Dark, Khorne, Nurgle, Slaanesh, and Tzeentch before blocked React bundles hydrate", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const valid = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const khorne = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const nurgle = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const slaanesh = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const tzeentch = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const corrupt = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const unavailable = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  try {
    await valid.addInitScript(([key]) => localStorage.setItem(key, "dark"), [themeStorageKey]);
    await khorne.addInitScript(([key]) => localStorage.setItem(key, "khorne"), [themeStorageKey]);
    await nurgle.addInitScript(([key]) => localStorage.setItem(key, "nurgle"), [themeStorageKey]);
    await slaanesh.addInitScript(([key]) => localStorage.setItem(key, "slaanesh"), [themeStorageKey]);
    await tzeentch.addInitScript(([key]) => localStorage.setItem(key, "tzeentch"), [themeStorageKey]);
    await corrupt.addInitScript(([key]) => localStorage.setItem(key, "corrupt"), [themeStorageKey]);
    await unavailable.addInitScript(() => Object.defineProperty(window, "localStorage", {configurable: true, get() { throw new DOMException("blocked", "SecurityError"); }}));
    for (const [context, expectedTheme, expectedPage] of [[valid, "dark", dark.page], [khorne, "khorne", null], [nurgle, "nurgle", null], [slaanesh, "slaanesh", null], [tzeentch, "tzeentch", null], [corrupt, "light", light.page], [unavailable, "light", light.page]]) {
      let bundles = 0;
      const loadedAssets = [];
      await context.route("**/_next/static/**/*.js", route => { bundles += 1; return route.fulfill({contentType: "application/javascript", body: ""}); });
      const page = await context.newPage();
      page.on("response", response => loadedAssets.push(new URL(response.url()).pathname));
      const response = await page.goto(baseUrl, {waitUntil: "load"});
      assert.equal(response?.status(), 200, "the real server response starts before React bundles are released");
      const serverHtml = await response?.text();
      assert.match(serverHtml || "", /cattasks-theme/, "the real server HTML contains the inline theme boot contract");
      assert.equal(await page.locator(`[data-cattasks-theme='${expectedTheme}']`).count(), 1, `inline boot synchronously exposes persisted ${expectedTheme} before React can hydrate`);
      const capybaraHeader = page.locator("header[data-cattasks-header='capybara']");
      const lightThemeChooser = page.locator("button[aria-label='Choose theme (current: Light)']");
      if (expectedTheme === "slaanesh") assert.equal(await capybaraHeader.isVisible(), false, "persisted Slaanesh hides the actual Capybara header before blocked Next bundles can hydrate");
      if (expectedTheme === "slaanesh") assert.equal(await lightThemeChooser.isVisible(), false, "persisted Slaanesh hides the old SSR Light theme chooser before blocked Next bundles can hydrate");
      if (expectedTheme === "tzeentch") assert.equal(await capybaraHeader.isVisible(), false, "persisted Tzeentch hides the actual Capybara header before blocked Next bundles can hydrate");
      if (expectedTheme === "tzeentch") assert.equal(await lightThemeChooser.isVisible(), false, "persisted Tzeentch hides the old SSR Light theme chooser before blocked Next bundles can hydrate");
      if (expectedTheme === "light") {
        assert.equal(await capybaraHeader.count(), 1, "Light fallback retains one actual Capybara header before blocked Next bundles can hydrate");
        assert.equal(await capybaraHeader.isVisible(), true, "Light fallback visibly retains the actual Capybara header before blocked Next bundles can hydrate");
        assert.equal(await lightThemeChooser.count(), 1, "Light fallback retains one actual Light theme chooser before blocked Next bundles can hydrate");
        assert.equal(await lightThemeChooser.isVisible(), true, "Light fallback visibly retains the actual Light theme chooser before blocked Next bundles can hydrate");
      }
      const outerPaint = await page.locator("[class*='background']").evaluate(element => getComputedStyle(element).backgroundColor);
      if (expectedPage) assert.equal(outerPaint, expectedPage, "the visible outer page is painted by inline theme boot before React can hydrate");
      else {
        assert.notEqual(outerPaint, light.page, `${expectedTheme} outer page is painted before React can hydrate`);
        if (expectedTheme === "tzeentch") assert.equal(outerPaint, "rgb(17, 21, 43)", "Tzeentch paints its approved outer page before React can hydrate");
        const sceneSelector = `[data-cattasks-theme='${expectedTheme}'] [data-${expectedTheme}-scene='task']`;
        assert.match(await page.locator(sceneSelector).evaluate(element => getComputedStyle(element).backgroundImage), new RegExp(`cattasks/themes/${expectedTheme}/`), `${expectedTheme} own scene is painted before React can hydrate`);
        assert.ok(loadedAssets.includes(`/cattasks/themes/${expectedTheme}/task/background-desktop.webp`), `the persisted ${expectedTheme} page loads its own scene before React hydration`);
        assert.ok(!loadedAssets.includes("/cattasks/desktop-meadow.png"), `the persisted ${expectedTheme} page does not load the Light desktop meadow`);
        if (["nurgle", "slaanesh", "tzeentch"].includes(expectedTheme)) assert.equal(await page.locator("[class*='taskShelf']:visible, [class*='catalogueShelf']:visible, [class*='mascotCanvas']:visible, [class*='mobileFoxBody']:visible, [class*='shelfStickers']:visible").count(), 0, `prehydrated ${expectedTheme} leaves no painted legacy shelf or mascot`);
      }
      assert.ok(bundles > 0, "all external Next static JavaScript bundles were intercepted before React could hydrate");
      await page.close();
    }
  } finally { await valid.close(); await khorne.close(); await nurgle.close(); await slaanesh.close(); await tzeentch.close(); await corrupt.close(); await unavailable.close(); await browser.close(); }
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
    assert.equal(catalogue.filters.backgroundColor, light.catalogue); assert.equal(catalogue.list.backgroundColor, light.catalogue); assert.equal(catalogue.fileInput.backgroundColor, light.fileInput); assert.equal(catalogue.pet.color, light.pet); assert.match(catalogue.back, /Back/, "narrow catalogue visibly renders its shortened Back label");
    const back = page.getByRole("button", {name: "Back to task", exact: true});
    const backBox = await back.boundingBox();
    assert.ok(backBox && backBox.x < 160, "narrow Back remains on the left side of the catalogue header");
    await back.focus();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Back to task", "the full Back name remains keyboard-addressable");
    assert.equal(await back.evaluate(node => { const rect = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)); }), true, "narrow Back owns its center hit point");
    assert.equal((await surface(page)).overflow, 0, "390px catalogue has no horizontal clipping");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    assert.ok(await page.evaluate(() => window.scrollY > 0), "the extended catalogue really scrolls");
    await chooseTheme(page, "Dark");
    assert.equal((await surface(page)).theme, "dark", "catalogue retains the same actual control");
    const titlePaint = await page.getByRole("heading", {name: "All tasks", exact: true}).evaluate(element => {
      const style = getComputedStyle(element);
      return {color: style.color, fill: style.webkitTextFillColor};
    });
    assert.equal(titlePaint.fill, "rgb(227, 238, 229)", "Dark compact catalogue title uses the approved visible text fill instead of a transparent clipped fill");
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

test("v146 body separates the live reader, editor and output while retaining tabs and catalogue state", {timeout: 120_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const themes = [
    {name: "Khorne", kind: "god"},
    {name: "Nurgle", kind: "god"},
    {name: "Tzeentch", kind: "god"},
    {name: "Dark", kind: "capybara"},
    {name: "Light", kind: "capybara"},
  ];
  try {
    for (const theme of themes) {
      const context = await browser.newContext({viewport: {width: 1440, height: 950}, reducedMotion: "reduce"});
      const page = await context.newPage();
      try {
        const diagnostics = await prepare(page);
        await chooseTheme(page, theme.name);

        const panels = await page.evaluate(() => {
          const required = (selector, label) => {
            const element = document.querySelector(selector);
            if (!element) throw new Error(`missing ${label}`);
            return element;
          };
          const paint = element => {
            const style = getComputedStyle(element);
            return {background: style.backgroundColor, image: style.backgroundImage, radius: style.borderTopLeftRadius, divider: style.borderBottomColor};
          };
          const readerControls = required("[aria-label='Режим содержимого']", "real Task controls");
          const reader = readerControls.closest("[class*='taskDetailsContainer']");
          if (!reader) throw new Error("the real Task controls have no reader panel");
          const editor = required("section[aria-labelledby='taskSolutionHeading']", "real editor section");
          const output = required("section[aria-labelledby='taskOutputHeading']", "real output section");
          const editorTitle = required("#taskSolutionHeading", "editor heading");
          const outputTitle = required("#taskOutputHeading", "output heading");
          const editorSurface = required(".monaco-editor", "editable Monaco surface");
          const run = required("button[aria-label='Run Code']", "Run action");
          const test = required("button[aria-label='Test Code']", "Test action");
          const pet = required("[aria-label='Pet feeding strip']", "Pet feeding strip");
          const toolbar = element => paint(element.closest("header") ?? element);
          const box = element => {
            const rect = element.getBoundingClientRect();
            return {top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height};
          };
          return {
            reader: paint(reader),
            editor: paint(editor),
            output: paint(output),
            readerHeading: paint(readerControls),
            editorHeading: toolbar(editorTitle),
            outputHeading: toolbar(outputTitle),
            editorSurface: box(editorSurface),
            run: box(run),
            test: box(test),
            outputBox: box(output),
            readerBox: box(reader),
            pet: box(pet),
          };
        });

        const readerControls = page.locator("[aria-label='Режим содержимого']");
        const selectedControl = theme.kind === "god"
          ? readerControls.getByRole("tab", {name: "Task", exact: true})
          : readerControls.getByRole("button", {name: /^Task:/});
        const selectionAttribute = theme.kind === "god" ? "aria-selected" : "aria-pressed";
        assert.equal(await selectedControl.getAttribute(selectionAttribute), "true", `${theme.name} starts on its actual Task selection control`);
        const savedControl = theme.kind === "god"
          ? readerControls.getByRole("tab", {name: "My solution", exact: true})
          : readerControls.getByRole("button", {name: "My solution", exact: true});
        await savedControl.click();
        assert.equal(await savedControl.getAttribute(selectionAttribute), "true", `${theme.name} exposes the selected saved-solution control through its own semantics`);
        await page.getByRole("button", {name: "Save current code", exact: true}).click();
        await page.getByRole("button", {name: "Restore to editor", exact: true}).waitFor({state: "visible"});

        const expectedRadius = theme.kind === "god" ? "4px" : "22px";
        for (const [name, panel] of Object.entries({reader: panels.reader, editor: panels.editor, output: panels.output})) {
          assert.equal(panel.radius, expectedRadius, `${theme.name} ${name} is a separate approved v146 body panel`);
        }
        assert.ok(panels.run.top >= panels.editorSurface.bottom && panels.test.top >= panels.editorSurface.bottom, `${theme.name} keeps the real Run and Test actions after the editable Monaco surface without invoking either action`);
        assert.ok(panels.outputBox.top >= Math.max(panels.run.bottom, panels.test.bottom), `${theme.name} keeps Output as a visible separate panel after the real action strip`);
        assert.ok(panels.pet.top >= Math.max(panels.readerBox.bottom, panels.outputBox.bottom) - 2, `${theme.name} keeps the Pet feeding strip below the reader and Output instead of obscuring either panel`);

        const headings = Object.entries({reader: panels.readerHeading, editor: panels.editorHeading, output: panels.outputHeading});
        if (theme.kind === "god") {
          for (const [name, heading] of headings) {
            assert.ok(heading.image.includes("panel-strip-metal"), `${theme.name} ${name} heading paints the approved metal strip`);
          }
        } else {
          for (const [name, heading] of headings) {
            assert.ok(!heading.image.includes("panel-strip-metal"), `${theme.name} ${name} heading stays free of god-panel texture`);
          }
        }

        if (theme.name === "Dark") {
          for (const [name, panel] of Object.entries({reader: panels.reader, editor: panels.editor, output: panels.output})) {
            assert.equal(panel.background, "rgb(27, 53, 64)", `Capybara Dark ${name} uses the approved #1b3540 body material`);
          }
          for (const [name, heading] of headings) {
            assert.equal(heading.background, "rgb(41, 72, 82)", `Capybara Dark ${name} heading uses #294852`);
          }
        }

        if (theme.name === "Tzeentch") {
          for (const [name, heading] of headings) {
            assert.equal(heading.background, "rgb(41, 51, 60)", `Tzeentch ${name} heading uses the approved #29333c band`);
            assert.equal(heading.divider, "rgb(101, 88, 59)", `Tzeentch ${name} heading keeps the approved #65583b lower divider`);
          }
        }

        await page.getByRole("button", {name: "All tasks", exact: true}).click();
        await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor();
        await page.getByRole("button", {name: "Next page", exact: true}).click();
        const currentPage = page.getByRole("navigation", {name: "Task pages", exact: true}).locator("button[aria-current='page']");
        assert.equal(await currentPage.textContent(), "2", `${theme.name} marks page 2 as current after real catalogue navigation`);
        await page.getByRole("button", {name: "Back to task", exact: true}).click();
        await savedControl.waitFor({state: "visible"});
        assert.equal(await savedControl.getAttribute(selectionAttribute), "true", `${theme.name} retains its selected saved-solution control after catalogue navigation`);
        assertDiagnostics(diagnostics);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test("Tzeentch is the sixth native theme with real v146 Task and catalogue surfaces", {timeout: 180_000, concurrency: false}, async t => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1600, height: 1000}, reducedMotion: "reduce"});
  const page = await context.newPage();
  const variant = "[data-warhammer-variant='tzeentch']";
  const figureSelector = "[data-tzeentch-figure]";
  const constructions = ["Industrial", "Gothic", "Armor"];
  try {
    const diagnostics = await prepare(page);
    const trigger = await themeTrigger(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    const choices = page.getByRole("group", {name: "Themes", exact: true});
    await choices.waitFor({state: "visible"});
    await expectShippedThemeChoices(choices);
    for (let index = 0; index < 5; index += 1) await page.keyboard.press("Tab");
    const tzeentch = choices.getByRole("button", {name: "Tzeentch", exact: true});
    assert.equal(await tzeentch.evaluate(element => element === document.activeElement), true, "keyboard traversal reaches the sixth native Tzeentch choice");
    assert.equal(await themeOptionIcon(tzeentch), "/cattasks/themes/tzeentch/icon.svg", "Tzeentch exposes its supplied faction icon in the real chooser");
    await page.keyboard.press("Enter");
    await page.locator("[data-cattasks-theme='tzeentch']").waitFor();
    await expectCurrentTheme(page, "Tzeentch");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), themeStorageKey), "tzeentch", "the sixth native choice persists its valid preference");

    const taskHeader = page.locator(`header${variant}[data-v146-header][data-khorne-header='task']`);
    const taskArtwork = await v146Artwork(taskHeader, "Tzeentch Task");
    assert.ok(taskArtwork.images.includes("/cattasks-art/v146/classic/panel-armor-blue.png"), "wide Tzeentch Task includes its authored blue shared panel material through the shared renderer");
    assert.equal(await taskArtwork.ariaHidden, "true", "Tzeentch Task decoration is excluded from the accessibility tree");
    assert.equal(await taskArtwork.pointerEvents, "none", "Tzeentch Task decoration stays click-through");
    const taskScene = page.locator("[data-cattasks-theme='tzeentch'] [data-tzeentch-scene='task']");
    const taskFigures = page.locator(`${figureSelector}:visible img`);
    await taskScene.waitFor({state: "visible"});
    await taskFigures.nth(1).waitFor({state: "visible"});
    assert.deepEqual(
      (await taskFigures.evaluateAll(images => images.map(image => new URL(image.currentSrc || image.src).pathname).sort())),
      ["/cattasks/themes/tzeentch/task/daemon.webp", "/cattasks/themes/tzeentch/task/marine.webp"],
      "wide Tzeentch Task exposes the supplied Grey Knight and one intact two-Flamer layer",
    );
    assert.equal(await page.locator(`${figureSelector}:visible`).count(), 2, "the two Flamers remain one decorative Task layer rather than split figures");
    assert.match(await taskScene.evaluate(element => getComputedStyle(element).backgroundImage), /tzeentch\/task\/background-desktop\.webp/, "Tzeentch Task paints its supplied desktop background");

    for (const construction of constructions) {
      await t.test(`${construction} keeps live Task controls and the mapped Tzeentch header`, async () => {
        const constructionChoices = page.getByRole("group", {name: "Header construction", exact: true});
        if (!await constructionChoices.isVisible()) {
          await (await themeTrigger(page)).click();
          await constructionChoices.waitFor({state: "visible"});
        }
        const choice = constructionChoices.getByRole("button", {name: construction, exact: true});
        await choice.focus(); await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
        assert.equal(await choice.evaluate(element => element.matches(":focus-visible")), true, `${construction} exposes keyboard-visible selection focus`);
        await page.keyboard.press("Enter");
        assert.equal(await taskHeader.getAttribute("data-v146-construction"), construction.toLowerCase(), `${construction} is the live selected header construction`);
        assert.equal(await choice.getAttribute("aria-pressed"), "true", `${construction} truthfully exposes the selected construction`);
        const live = await page.evaluate(() => {
          const required = (selector, name) => {
            const element = document.querySelector(selector);
            if (!element) throw new Error(`missing ${name}`);
            return element;
          };
          const paint = element => ({background: getComputedStyle(element).backgroundColor, radius: getComputedStyle(element).borderTopLeftRadius});
          const box = element => {
            const {top, right, bottom, left, width, height} = element.getBoundingClientRect();
            return {top, right, bottom, left, width, height};
          };
          const reader = required("[aria-label='Режим содержимого']", "live reader controls").closest("[class*='taskDetailsContainer']");
          const editor = required("section[aria-labelledby='taskSolutionHeading']", "live editor");
          const output = required("section[aria-labelledby='taskOutputHeading']", "live Output");
          const monaco = required(".monaco-editor", "live Monaco editor");
          const run = required("button[aria-label='Run Code']", "live Run control");
          const test = required("button[aria-label='Test Code']", "live Test control");
          if (!reader) throw new Error("reader controls have no live reader panel");
          return {
            reader: paint(reader),
            editor: paint(editor),
            output: paint(output),
            monaco: {paint: paint(monaco), box: box(monaco)},
            run: box(run),
            test: box(test),
            outputBox: box(output),
          };
        });
        assert.deepEqual(
          {reader: live.reader, editor: live.editor, output: live.output, monaco: live.monaco.paint},
          {
            reader: {background: "rgb(26, 30, 29)", radius: "4px"},
            editor: {background: "rgb(17, 23, 25)", radius: "4px"},
            output: {background: "rgb(22, 28, 27)", radius: "4px"},
            monaco: {background: "rgb(16, 21, 23)", radius: "0px"},
          },
          `${construction} maps the real reader, editor, Monaco and Output to their approved Tzeentch v146 materials`,
        );
        assert.ok(live.run.top >= live.monaco.box.bottom && live.test.top >= live.monaco.box.bottom, `${construction} keeps Run and Test after Monaco without activating code`);
        assert.ok(live.outputBox.top >= Math.max(live.run.bottom, live.test.bottom), `${construction} keeps Output after the real action strip`);
      });
    }

    const industrialChoices = page.getByRole("group", {name: "Header construction", exact: true});
    if (!await industrialChoices.isVisible()) { await (await themeTrigger(page)).click(); await industrialChoices.waitFor({state: "visible"}); }
    await industrialChoices.getByRole("button", {name: "Industrial", exact: true}).click();
    assert.equal(await taskHeader.getAttribute("data-v146-construction"), "industrial", "the live Task returns to Industrial before its matching catalogue ornament is measured");

    const initialModels = (await surface(page)).models;
    await page.getByRole("tab", {name: "Hint", exact: true}).click();
    assert.equal(await page.getByRole("tab", {name: "Hint", exact: true}).getAttribute("aria-selected"), "true", "Tzeentch keeps the live Hint tab");
    await page.getByRole("tab", {name: "My solution", exact: true}).click();
    await page.getByRole("button", {name: "Save current code", exact: true}).click();
    await page.getByLabel("Saved solution code", {exact: true}).waitFor({state: "visible"});
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
    const catalogueHeader = page.locator(`header${variant}[data-v146-header][data-khorne-header='catalogue']`);
    const catalogueArtwork = await v146Artwork(catalogueHeader, "Tzeentch catalogue");
    assert.ok(catalogueArtwork.images.includes("/cattasks-art/v146/industrial/tzeentch-left.png"), "wide Industrial Tzeentch catalogue includes its supplied deity left ornament through the shared renderer");
    const catalogueScene = page.locator("[data-cattasks-theme='tzeentch'] [data-tzeentch-scene='all-tasks']");
    const catalogueFigures = page.locator(`${figureSelector}:visible img`);
    await catalogueScene.waitFor({state: "visible"});
    await catalogueFigures.nth(1).waitFor({state: "visible"});
    assert.deepEqual(
      (await catalogueFigures.evaluateAll(images => images.map(image => new URL(image.currentSrc || image.src).pathname).sort())),
      ["/cattasks/themes/tzeentch/all-tasks/daemon.webp", "/cattasks/themes/tzeentch/all-tasks/marine.webp"],
      "wide Tzeentch catalogue uses its supplied Lord of Change and Ultramarine figure layers",
    );
    assert.equal(await page.locator(`${figureSelector}:visible`).count(), 2, "Tzeentch catalogue keeps one intact daemon artwork layer");
    assert.match(await catalogueScene.evaluate(element => getComputedStyle(element).backgroundImage), /tzeentch\/all-tasks\/background-desktop\.webp/, "Tzeentch catalogue paints its supplied desktop background");
    const catalogueSurface = page.locator("main[data-cattasks-workspace-content]");
    assert.equal(await catalogueSurface.count(), 1, "Tzeentch catalogue exposes one owning workspace surface");
    assert.equal(await page.locator("[aria-labelledby='taskListTitle']").count(), 1, "Tzeentch catalogue retains the real task list section");
    const cataloguePaint = await catalogueSurface.evaluate(element => ({background: getComputedStyle(element).backgroundColor, radius: getComputedStyle(element).borderBottomRightRadius}));
    assert.deepEqual(cataloguePaint, {background: "rgb(27, 35, 41)", radius: "6px"}, "Tzeentch All tasks uses the approved #1b2329 catalogue body material");

    for (const [width, expectedHeight] of [[700, 52], [430, 54]]) {
      await page.setViewportSize({width, height: 932}); await nextPaint(page);
      const filters = page.getByRole("button", {name: "Filters", exact: true});
      assert.equal(await filters.count(), 1, `${width}px exposes one real compact Tzeentch Filters control`);
      assert.equal(await filters.evaluate(element => element.getBoundingClientRect().height), expectedHeight, `${width}px Tzeentch Filters preserves the settled compact height`);
      await filters.focus(); await page.keyboard.press("Enter");
      assert.equal(await filters.getAttribute("aria-expanded"), "true", `${width}px Tzeentch opens real Filters from the keyboard`);
      const search = page.getByRole("searchbox", {name: "Search tasks", exact: true});
      await search.fill("fixture 1");
      await page.keyboard.press("Escape");
      assert.equal(await filters.getAttribute("aria-expanded"), "false", `${width}px Escape closes Tzeentch Filters`);
      assert.equal(await filters.evaluate(element => element === document.activeElement), true, `${width}px Escape restores focus to Tzeentch Filters`);
      await page.keyboard.press("Enter");
      assert.equal(await search.inputValue(), "fixture 1", `${width}px reopening Tzeentch Filters retains its real Search value`);
      await page.getByRole("button", {name: "Reset filters", exact: true}).click();
      assert.equal(await search.inputValue(), "", `${width}px Reset filters clears the real search state`);
      await filters.focus(); await page.keyboard.press("Enter");
      assert.equal(await filters.getAttribute("aria-expanded"), "false", `${width}px closes Tzeentch Filters before the next compact viewport`);
    }
    await page.getByRole("button", {name: "Back to task", exact: true}).click();
    assert.deepEqual((await surface(page)).models, initialModels, "Task/catalogue round trip retains the same Monaco model state");
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("Tzeentch keeps each v146 construction inside the approved 3 by 13 by 2 workspace envelope", {timeout: 240_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1600, height: 1000}, reducedMotion: "reduce"});
  const page = await context.newPage();
  const widths = [320, 360, 430, 622, 623, 700, 834, 933, 1040, 1160, 1280, 1440, 1600];
  const constructions = ["Industrial", "Gothic", "Armor"];
  const assertWorkspaceGeometry = async (width, construction, mode) => {
    const geometry = await page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element), box = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      };
      const owner = document.querySelector("[data-cattasks-workspace]");
      const content = [...document.querySelectorAll("[data-cattasks-workspace-content]")].filter(visible);
      if (!owner || content.length !== 1) throw new Error("expected exactly one visible real workspace content surface");
      const ownerBox = owner.getBoundingClientRect(), contentBox = content[0].getBoundingClientRect();
      return {owner: {left: ownerBox.left, right: ownerBox.right}, content: {left: contentBox.left, right: contentBox.right}, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth};
    });
    assert.ok(Math.abs(geometry.owner.left - geometry.content.left) <= 2 && Math.abs(geometry.owner.right - geometry.content.right) <= 2,
      `${construction} ${mode} at ${width}px retains the single owning workspace width (got ${JSON.stringify(geometry)})`);
    assert.equal(geometry.overflow, 0, `${construction} ${mode} at ${width}px has no horizontal clipping`);
  };
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Tzeentch");
    for (const construction of constructions) {
      const options = page.getByRole("group", {name: "Header construction", exact: true});
      if (!await options.isVisible()) { await (await themeTrigger(page)).click(); await options.waitFor({state: "visible"}); }
      await options.getByRole("button", {name: construction, exact: true}).click();
      const taskHeader = page.locator("header[data-warhammer-variant='tzeentch'][data-v146-header][data-khorne-header='task']");
      assert.equal(await taskHeader.getAttribute("data-v146-construction"), construction.toLowerCase(), `${construction} becomes the actual Task construction before the matrix`);
      for (const width of widths) {
        await page.setViewportSize({width, height: 1000}); await nextPaint(page);
        assert.equal(await taskHeader.count(), 1, `${construction} Tzeentch Task keeps one integrated header at ${width}px`);
        await assertWorkspaceGeometry(width, construction, "Task");
      }
      await page.getByRole("button", {name: "All tasks", exact: true}).click();
      await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
      const catalogueHeader = page.locator("header[data-warhammer-variant='tzeentch'][data-v146-header][data-khorne-header='catalogue']");
      assert.equal(await catalogueHeader.getAttribute("data-v146-construction"), construction.toLowerCase(), `${construction} persists to the actual Tzeentch catalogue header`);
      for (const width of widths) {
        await page.setViewportSize({width, height: 1000}); await nextPaint(page);
        assert.equal(await catalogueHeader.count(), 1, `${construction} Tzeentch catalogue keeps one integrated header at ${width}px`);
        await assertWorkspaceGeometry(width, construction, "catalogue");
      }
      await page.getByRole("button", {name: "Back to task", exact: true}).click();
      await taskHeader.waitFor({state: "visible"});
    }
    assertDiagnostics(diagnostics);
  } finally { await context.close(); await browser.close(); }
});

test("Tzeentch collapsed Task keeps the blue recessed controls, keyboard restoration, and forced-colors affordances", {timeout: 120_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1100, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Tzeentch");
    const workspace = page.locator("[data-cattasks-workspace]").first();
    const models = (await surface(page)).models;
    await page.getByRole("button", {name: "Hide task", exact: true}).click();
    const showTask = page.getByRole("button", {name: "Show task", exact: true});
    await showTask.waitFor({state: "visible"});
    const measure = async width => {
      await workspace.evaluate((element, value) => { element.style.width = `${value}px`; element.style.maxWidth = `${value}px`; }, width);
      await nextPaint(page);
      return showTask.evaluate(element => {
        const box = element.getBoundingClientRect();
        const sources = [element, ...element.querySelectorAll("*")].flatMap(node => [getComputedStyle(node).backgroundImage, node instanceof HTMLImageElement ? (node.currentSrc || node.src) : ""].filter(Boolean));
        return {width: box.width, height: box.height, sources};
      });
    };
    const horizontal = await measure(600);
    assert.ok(Math.abs(horizontal.width - 196) <= 1 && Math.abs(horizontal.height - 54) <= 1, "600px Tzeentch workspace exposes the 196 by 54 horizontal blue recessed control");
    assert.match(horizontal.sources.join(" "), /recessed.*blue|blue.*recessed/i, "600px horizontal control exposes supplied blue recessed art through the actual UI");
    const vertical = await measure(601);
    assert.ok(Math.abs(vertical.width - 52) <= 1 && Math.abs(vertical.height - 157) <= 1, "601px Tzeentch workspace exposes the 52 by 157 blue vertical spine");
    assert.match(vertical.sources.join(" "), /recessed.*blue|blue.*recessed/i, "601px vertical spine exposes supplied blue recessed art through the actual UI");
    await showTask.focus(); await page.keyboard.press("Enter");
    const hideTask = page.getByRole("button", {name: "Hide task", exact: true});
    await hideTask.waitFor({state: "visible"});
    assert.equal(await hideTask.evaluate(element => element === document.activeElement), true, "keyboard restoration returns focus to the actual Hide task control");
    assert.deepEqual((await surface(page)).models, models, "Tzeentch collapsed Task restoration retains the Monaco model state");
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
    await page.setViewportSize({width: 700, height: 1000}); await nextPaint(page);
    const filters = page.getByRole("button", {name: "Filters", exact: true});
    await filters.focus(); await page.keyboard.press("Enter");
    const radio = page.getByRole("radio", {name: "All topics", exact: true});
    await page.emulateMedia({forcedColors: "active", colorScheme: "dark"});
    assert.notEqual(await radio.evaluate(element => getComputedStyle(element).appearance), "none", "forced-colors Tzeentch retains native radio affordance");
    await filters.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
    const colors = await filters.evaluate(element => {
      const probe = document.createElement("span"); probe.style.cssText = "position:absolute;color:CanvasText;outline:3px solid Highlight;forced-color-adjust:none"; document.body.append(probe);
      const expected = getComputedStyle(probe), actual = getComputedStyle(element);
      const result = {active: matchMedia("(forced-colors: active)").matches, focus: element.matches(":focus-visible"), color: actual.color, outlineColor: actual.outlineColor, outlineStyle: actual.outlineStyle, outlineWidth: actual.outlineWidth, expectedColor: expected.color, expectedOutline: expected.outlineColor}; probe.remove(); return result;
    });
    assert.equal(colors.active, true, "forced-colors becomes active for the actual Tzeentch Filters control");
    assert.equal(colors.focus, true, "forced-colors keeps keyboard-visible focus on the actual Tzeentch Filters control");
    assert.equal(colors.color, colors.expectedColor, "forced-colors resolves the actual Tzeentch Filters control to CanvasText");
    assert.equal(colors.outlineColor, colors.expectedOutline, "forced-colors resolves the actual Tzeentch keyboard ring to Highlight");
    assert.equal(colors.outlineStyle, "solid", "forced-colors retains a solid keyboard ring");
    assert.equal(colors.outlineWidth, "3px", "forced-colors retains the approved 3px keyboard ring");
    assertDiagnostics(diagnostics);
  } finally { await page.emulateMedia({forcedColors: "none"}); await context.close(); await browser.close(); }
});
