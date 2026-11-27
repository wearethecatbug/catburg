const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

// Independent public-contract oracle for the approved ambient behavior. It
// uses only inert catalogue data and never presses Run Code or Test Code.
const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:44009";
const fixtureModelPath = "/solution-ambient-fixture.js";
const themes = ["Light", "Dark", "Khorne", "Nurgle", "Slaanesh", "Tzeentch"];
const chaosThemes = ["Khorne", "Nurgle", "Slaanesh", "Tzeentch"];
const constructions = ["Industrial", "Gothic", "Armor"];
const catalog = {version: 1, tasks: [
  {
    id: "ambient-fixture",
    title: "Ambient fixture",
    description: "Inert browser fixture.",
    entryPoint: "echo",
    starterCode: "function echo(value) { return value; }",
    solution: "function echo(value) { return value; }",
    tests: [{args: ["fixture"], expected: "fixture"}],
  },
]};

function diagnosticsFor(page) {
  const diagnostics = {console: [], page: [], request: [], response: [], catalogRequests: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.request.push(`${request.method()} ${request.url()}`));
  page.on("response", response => {
    if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

async function prepare(page) {
  const diagnostics = diagnosticsFor(page);
  await page.route("**/task-catalog.v1.json", route => {
    diagnostics.catalogRequests.push(`${route.request().method()} ${route.request().url()}`);
    return route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });
  const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
  assert.equal(response?.status(), 200, "the isolated loopback dashboard loads");
  await page.getByRole("button", {name: /Choose theme.*current:/i}).waitFor({state: "visible"});
  await page.locator(".monaco-editor").first().waitFor({state: "visible"});
  await page.waitForFunction(path => Boolean(window.monaco?.editor.getModels().find(model => model.uri.path === path)), fixtureModelPath);
  return diagnostics;
}

function assertDiagnostics(diagnostics, expectedCatalogRequests = 1) {
  assert.deepEqual(diagnostics.console, [], "ambient interaction logs no browser console errors");
  assert.deepEqual(diagnostics.page, [], "ambient interaction raises no page errors");
  assert.deepEqual(diagnostics.request, [], "ambient interaction has no failed requests");
  assert.deepEqual(diagnostics.response, [], "ambient interaction has no HTTP errors");
  assert.deepEqual(diagnostics.catalogRequests, Array.from({length: expectedCatalogRequests}, () => `GET ${new URL("/task-catalog.v1.json", baseUrl).href}`), "the isolated catalogue is requested once per real navigation");
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
}

function chooser(page) {
  return page.getByRole("button", {name: /Choose theme.*current:/i});
}

async function openChooser(page) {
  const trigger = chooser(page);
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  const appearance = page.getByRole("group", {name: "Appearance", exact: true});
  await appearance.waitFor({state: "visible"});
  return appearance;
}

async function themesGroup(page) {
  const appearance = await openChooser(page);
  const themes = appearance.getByRole("group", {name: "Themes", exact: true});
  await themes.waitFor({state: "visible"});
  return themes;
}

async function chooseTheme(page, name) {
  const group = await themesGroup(page);
  await group.getByRole("button", {name, exact: true}).click();
  await page.locator(`[data-cattasks-theme='${name.toLowerCase()}']`).waitFor({state: "visible"});
  await settle(page);
}

async function requestTheme(page, name) {
  const group = await themesGroup(page);
  await group.getByRole("button", {name, exact: true}).click();
  await page.locator(`[data-cattasks-theme='${name.toLowerCase()}']`).waitFor({state: "visible"});
}

async function chooseConstruction(page, name) {
  const appearance = await openChooser(page);
  const construction = appearance.getByRole("group", {name: "Header construction", exact: true});
  await construction.waitFor({state: "visible"});
  await construction.getByRole("button", {name, exact: true}).click();
  await page.waitForFunction(expected => document.querySelector("[data-v146-header]")?.getAttribute("data-v146-construction") === expected, name.toLowerCase());
  await expectAmbient(page, undefined, "running");
}

async function motionButton(page) {
  const appearance = await openChooser(page);
  const button = appearance.getByRole("button", {name: "Motion", exact: true});
  await button.waitFor({state: "visible"});
  return button;
}

async function expectAmbient(page, theme, state) {
  const host = page.locator("[data-cattasks-ambient]");
  await host.waitFor({state: "attached", timeout: 10_000});
  await page.waitForFunction(({theme: expectedTheme, state: expectedState}) => {
    const node = document.querySelector("[data-cattasks-ambient]");
    return Boolean(node
      && node.getAttribute("data-ambient-state") === expectedState
      && (expectedTheme === undefined || node.getAttribute("data-ambient-theme") === expectedTheme));
  }, {theme, state}, {timeout: 10_000});
  return host;
}

async function ambientSurface(page) {
  return page.locator("[data-cattasks-ambient]").evaluate(host => {
    const style = getComputedStyle(host);
    const canvas = host.querySelector("canvas");
    const canvasStyle = canvas ? getComputedStyle(canvas) : null;
    const rect = host.getBoundingClientRect();
    return {
      ariaHidden: host.getAttribute("aria-hidden"),
      state: host.getAttribute("data-ambient-state"),
      theme: host.getAttribute("data-ambient-theme"),
      pointerEvents: style.pointerEvents,
      canvasCount: host.querySelectorAll("canvas").length,
      canvasPointerEvents: canvasStyle?.pointerEvents,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function setModel(page, value) {
  return page.evaluate(({path, nextValue}) => {
    const model = window.monaco?.editor.getModels().find(candidate => candidate.uri.path === path);
    if (!model) throw new Error("ambient fixture Monaco model is unavailable");
    model.setValue(nextValue);
    return model.getValue();
  }, {path: fixtureModelPath, nextValue: value});
}

async function feedWithKeyboard(page) {
  const strip = page.getByLabel("Pet feeding strip", {exact: true});
  const feed = strip.getByRole("button", {name: "Feed pet", exact: true});
  await feed.waitFor({state: "visible"});
  const before = await strip.locator("[data-pet='food']").count();
  await feed.focus();
  await feed.press("Enter");
  await assert.doesNotReject(strip.locator("[data-pet='food']").nth(before).waitFor({state: "attached", timeout: 2_000}));
  assert.equal(await strip.locator("[data-pet='food']").count(), before + 1, "keyboard Feed remains a working semantic control while ambient Motion changes");
}

async function setDocumentVisibility(page, value) {
  await page.evaluate(nextValue => {
    window.__ambientVisibilityRestore ??= () => {
      delete document.visibilityState;
      delete document.hidden;
    };
    Object.defineProperty(document, "visibilityState", {configurable: true, get: () => nextValue});
    Object.defineProperty(document, "hidden", {configurable: true, get: () => nextValue === "hidden"});
    document.dispatchEvent(new Event("visibilitychange"));
  }, value);
}

async function restoreDocumentVisibility(page) {
  await page.evaluate(() => {
    window.__ambientVisibilityRestore?.();
    delete window.__ambientVisibilityRestore;
  });
}

test("ambient Motion is persistent, noninteractive, and preserves the real task controls", {timeout: 60_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "no-preference"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await expectAmbient(page, "light", "running");
    const initialSurface = await ambientSurface(page);
    assert.equal(initialSurface.ariaHidden, "true", "the ambient host is decorative");
    assert.equal(initialSurface.state, "running", "the ambient host reports its live state");
    assert.equal(initialSurface.theme, "light", "the ambient host reports its bound theme");
    assert.equal(initialSurface.pointerEvents, "none", "the ambient host has no pointer ownership");
    assert.equal(initialSurface.canvasCount, 1, "the ambient host owns exactly one canvas");
    assert.equal(initialSurface.canvasPointerEvents, "none", "the ambient canvas has no pointer ownership");
    assert.ok(initialSurface.width > 0 && initialSurface.height > 0, "the ambient canvas occupies a positive rendered geometry");

    const modelValue = "function echo(value) { return `ambient:${value}`; }";
    assert.equal(await setModel(page, modelValue), modelValue, "the real Monaco model accepts inert text before Motion changes");
    await feedWithKeyboard(page);

    const motion = await motionButton(page);
    assert.equal(await motion.getAttribute("aria-pressed"), "true", "Motion initially reports enabled");
    await motion.click();
    assert.equal(await motion.getAttribute("aria-pressed"), "false", "Motion truthfully reports disabled");
    await expectAmbient(page, "light", "paused");
    assert.equal(await page.evaluate(path => window.monaco.editor.getModels().find(model => model.uri.path === path)?.getValue(), fixtureModelPath), modelValue, "Motion does not replace the real Monaco model");
    await feedWithKeyboard(page);

    await page.reload({waitUntil: "domcontentloaded"});
    await page.locator(".monaco-editor").first().waitFor({state: "visible"});
    await page.waitForFunction(path => Boolean(window.monaco?.editor.getModels().find(model => model.uri.path === path)), fixtureModelPath);
    const persistedMotion = await motionButton(page);
    assert.equal(await persistedMotion.getAttribute("aria-pressed"), "false", "disabled Motion persists through a real reload");
    await expectAmbient(page, "light", "paused");
    await persistedMotion.click();
    await expectAmbient(page, "light", "running");
    assert.equal(await motionButton(page).then(button => button.getAttribute("aria-pressed")), "true", "re-enabled Motion reports its persistent user setting");
    assertDiagnostics(diagnostics, 2);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("ambient binds the current theme, respects reduced and controlled hidden states, and stays behind real controls", {timeout: 90_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: "no-preference"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const theme of themes) {
      await chooseTheme(page, theme);
      await expectAmbient(page, theme.toLowerCase(), "running");
    }
    for (const theme of chaosThemes) {
      await chooseTheme(page, theme);
      for (const construction of constructions) await chooseConstruction(page, construction);
      await expectAmbient(page, theme.toLowerCase(), "running");
    }

    await requestTheme(page, "Nurgle");
    await requestTheme(page, "Tzeentch");
    await expectAmbient(page, "tzeentch", "running");

    await chooseTheme(page, "Khorne");
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible"});
    await expectAmbient(page, "khorne", "running");
    const pointOwners = await page.evaluate(() => {
      const targets = [
        document.querySelector("button[aria-label='Back to task']"),
        document.querySelector("[aria-label='Task filters']"),
      ].filter(Boolean);
      return targets.map(target => {
        const box = target.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return {belongsToTarget: Boolean(hit && (hit === target || target.contains(hit))), target: target.getAttribute("aria-label")};
      });
    });
    assert.ok(pointOwners.length === 2 && pointOwners.every(owner => owner.belongsToTarget), "ambient never captures the live Back or Filters hit areas");

    await setDocumentVisibility(page, "hidden");
    await expectAmbient(page, "khorne", "paused");
    assert.equal(await motionButton(page).then(button => button.getAttribute("aria-pressed")), "true", "a controlled hidden state pauses effects without rewriting the user setting");
    await setDocumentVisibility(page, "visible");
    await expectAmbient(page, "khorne", "running");
    await restoreDocumentVisibility(page);
    assertDiagnostics(diagnostics);
  } finally {
    await restoreDocumentVisibility(page).catch(() => undefined);
    await context.close();
    await browser.close();
  }

  const reducedBrowser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const reducedContext = await reducedBrowser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: "reduce"});
  const reducedPage = await reducedContext.newPage();
  try {
    const diagnostics = await prepare(reducedPage);
    await expectAmbient(reducedPage, "light", "paused");
    const setting = await motionButton(reducedPage);
    assert.equal(await setting.getAttribute("aria-pressed"), "true", "reduced motion pauses effects without changing the user's enabled setting");
    assertDiagnostics(diagnostics);
  } finally {
    await reducedContext.close();
    await reducedBrowser.close();
  }
});

// This observes the composited WebGL framebuffer at the canvas boundary.  It
// deliberately knows no AmbientController state or route implementation.
async function installAmbientFramebufferProbe(page) {
  await page.addInitScript(() => {
    const sample = canvas => {
      const host = canvas.parentElement;
      if (!host?.hasAttribute("data-cattasks-ambient")) return;
      let gl;
      try { gl = canvas.getContext("webgl2") || canvas.getContext("webgl"); } catch { return; }
      if (!gl || gl.getParameter(gl.FRAMEBUFFER_BINDING)) return;
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      if (!width || !height || width * height > 2_400_000) return;
      const pixels = new Uint8Array(width * height * 4);
      try { gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); } catch { return; }
      const centroid = (predicate, minX = 0, maxX = width) => {
        let count = 0, x = 0, y = 0, alpha = 0;
        // A 2px grid remains finer than the smallest 3–5px firefly core and
        // keeps the public-frame diagnostic small enough for an E2E run.
        for (let yIndex = 0; yIndex < height; yIndex += 2) for (let xIndex = 0; xIndex < width; xIndex += 2) {
          if (xIndex < minX || xIndex >= maxX) continue;
          const offset = (yIndex * width + xIndex) * 4;
          const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2], a = pixels[offset + 3];
          if (!predicate(r, g, b, a)) continue;
          count++; x += xIndex; y += yIndex; alpha += a;
        }
        return count ? {count, x: x / count, y: y / count, alpha: alpha / count, intensity: alpha} : null;
      };
      const components = predicate => {
        const gridWidth = Math.ceil(width / 2), gridHeight = Math.ceil(height / 2);
        const selected = new Uint8Array(gridWidth * gridHeight);
        for (let gridY = 0; gridY < gridHeight; gridY++) for (let gridX = 0; gridX < gridWidth; gridX++) {
          const offset = ((gridY * 2) * width + gridX * 2) * 4;
          selected[gridY * gridWidth + gridX] = Number(predicate(pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]));
        }
        const result = [];
        for (let seed = 0; seed < selected.length; seed++) {
          if (!selected[seed]) continue;
          const queue = [seed]; selected[seed] = 0;
          let count = 0, x = 0, y = 0;
          for (let cursor = 0; cursor < queue.length; cursor++) {
            const point = queue[cursor], gridX = point % gridWidth, gridY = Math.floor(point / gridWidth);
            count++; x += gridX * 2; y += gridY * 2;
            for (let deltaY = -1; deltaY <= 1; deltaY++) for (let deltaX = -1; deltaX <= 1; deltaX++) {
              const nextX = gridX + deltaX, nextY = gridY + deltaY;
              if (nextX < 0 || nextX >= gridWidth || nextY < 0 || nextY >= gridHeight) continue;
              const next = nextY * gridWidth + nextX;
              if (selected[next]) { selected[next] = 0; queue.push(next); }
            }
          }
          if (count >= 3 && count <= 180) result.push({count, x: x / count, y: y / count});
        }
        return result.sort((left, right) => right.count - left.count).slice(0, 12);
      };
      const warm = (r, g, b, a) => a > 30 && Math.abs(r * 255 / a - 241) < 12 && Math.abs(g * 255 / a - 217) < 12 && Math.abs(b * 255 / a - 111) < 12;
      const fireflyCore = (r, g, b, a) => a >= 100 && warm(r, g, b, a);
      const withGlow = component => {
        let intensity = 0;
        for (let sampleY = Math.max(0, Math.floor(component.y - 18)); sampleY <= Math.min(height - 1, Math.ceil(component.y + 18)); sampleY++) for (let sampleX = Math.max(0, Math.floor(component.x - 18)); sampleX <= Math.min(width - 1, Math.ceil(component.x + 18)); sampleX++) {
          if (Math.hypot(sampleX - component.x, sampleY - component.y) > 18) continue;
          const offset = (sampleY * width + sampleX) * 4;
          if (warm(pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3])) intensity += pixels[offset + 3];
        }
        return {...component, intensity};
      };
      window.__cattasksAmbientFramebuffer = {
        bee: components((r, g, b, a) => a > 100 && r > 190 && r < 240 && g > 120 && g < 185 && b > 15 && b < 75),
        butterfly: centroid((r, g, b, a) => a > 100 && r > 65 && r < 120 && g > 45 && g < 95 && b > 25 && b < 75),
        dragonfly: centroid((r, g, b, a) => a > 80 && r > 75 && r < 125 && g > 90 && g < 145 && b > 95 && b < 160),
        firefly: centroid(warm),
        fireflyCores: components(fireflyCore).map(withGlow),
      };
      window.__cattasksAmbientCaptureRequested = false;
    };
    for (const prototype of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
      if (!prototype) continue;
      for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
        if (!Object.prototype.hasOwnProperty.call(prototype, name)) continue;
        const original = prototype[name];
        prototype[name] = function (...args) {
          const result = original.apply(this, args);
          if (window.__cattasksAmbientCaptureRequested) sample(this.canvas);
          return result;
        };
      }
    }
  });
}

async function renderedAmbientFrame(page) {
  await page.evaluate(() => {
    window.__cattasksAmbientFramebuffer = undefined;
    window.__cattasksAmbientCaptureRequested = true;
  });
  await page.waitForTimeout(120);
  const frame = await page.evaluate(() => {
    return window.__cattasksAmbientFramebuffer;
  });
  assert.ok(frame, "a real ambient WebGL frame is available for visual inspection");
  return frame;
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function divergingPaths(left, right) {
  return left.slice(1).some((body, index) => {
    const start = left[0], otherStart = right[0], other = right[index + 1];
    return Math.hypot((body.x - start.x) - (other.x - otherStart.x), (body.y - start.y) - (other.y - otherStart.y)) > 5;
  });
}

function trackBody(componentFrames) {
  const first = componentFrames[0][0];
  if (!first) return [];
  return componentFrames.slice(1).reduce((tracked, components) => {
    const previous = tracked.at(-1);
    const next = [...components].sort((left, right) => distance(left, previous) - distance(right, previous))[0];
    return next ? [...tracked, next] : tracked;
  }, [first]);
}

function trackCore(componentFrames, first, maximumStep = 48) {
  if (!first) return [];
  return componentFrames.slice(1).reduce((tracked, components) => {
    const previous = tracked.at(-1);
    const next = [...components].sort((left, right) => distance(left, previous) - distance(right, previous))[0];
    return next && distance(next, previous) <= maximumStep ? [...tracked, next] : tracked;
  }, [first]);
}

function independentlyBreathingPair(componentFrames) {
  const tracks = componentFrames[0].map(core => trackCore(componentFrames, core));
  for (let leftIndex = 0; leftIndex < tracks.length; leftIndex++) for (let rightIndex = leftIndex + 1; rightIndex < tracks.length; rightIndex++) {
    const left = tracks[leftIndex], right = tracks[rightIndex];
    if (left.length !== componentFrames.length || right.length !== componentFrames.length) continue;
    if (left.some((core, index) => distance(core, right[index]) <= 24)) continue;
    if (left.slice(1).some((core, index) => {
      const leftChange = core.intensity - left[index].intensity;
      const rightChange = right[index + 1].intensity - right[index].intensity;
      return Math.abs(leftChange) > 250 && Math.abs(rightChange) > 250 && Math.sign(leftChange) !== Math.sign(rightChange);
    })) return {left, right};
  }
  return null;
}

test("ambient painted insects follow visibly different paths and fireflies breathe independently", {timeout: 25_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "no-preference"});
  const page = await context.newPage();
  try {
    await installAmbientFramebufferProbe(page);
    const diagnostics = await prepare(page);
    await expectAmbient(page, "light", "running");
    const frames = [];
    for (let index = 0; index < 13; index++) {
      frames.push(await renderedAmbientFrame(page));
      await page.waitForTimeout(260);
    }
    const beeComponents = frames.map(frame => frame.bee);
    const bees = trackBody(beeComponents);
    const butterflies = frames.map(frame => frame.butterfly);
    const dragonflies = frames.map(frame => frame.dragonfly);
    assert.ok(bees.length === frames.length && butterflies.every(Boolean) && dragonflies.every(Boolean), "Light paints recognizable bee, butterfly, and dragonfly bodies instead of interchangeable points");
    const beeSteps = bees.slice(1).map((body, index) => distance(body, bees[index]));
    assert.ok(beeSteps.some((step, index) => step < 1.5 && beeSteps[index + 1] < 1.5), "the painted bee body visibly dwells for a meaningful interval between short flights while its wings may animate");
    assert.ok(beeSteps.some(step => step > 3), "the painted bee body also completes a distinct short flight");
    assert.ok(divergingPaths(butterflies, dragonflies) && divergingPaths(bees, dragonflies), "butterfly, bee, and dragonfly have visibly distinct rendered movement paths rather than one trajectory translated to different start points");

    await chooseTheme(page, "Dark");
    const fireflies = [];
    const darkFrames = [];
    for (let index = 0; index < 7; index++) {
      const frame = await renderedAmbientFrame(page);
      darkFrames.push(frame);
      fireflies.push(frame.firefly);
      await page.waitForTimeout(650);
    }
    assert.ok(fireflies.every(Boolean), "Dark paints warm firefly cores with a visible glow");
    const brightness = fireflies.map(firefly => firefly.alpha);
    assert.ok(Math.max(...brightness) - Math.min(...brightness) > 12, "painted fireflies visibly change brightness instead of remaining static");
    const coreFrames = darkFrames.map(frame => frame.fireflyCores);
    assert.ok(independentlyBreathingPair(coreFrames), "spatially distinct, continuously tracked painted firefly glows change brightness out of phase rather than pulsing as one synchronized light");
    const spatialSteps = fireflies.slice(1).map((firefly, index) => distance(firefly, fireflies[index]));
    assert.ok(spatialSteps.some(step => step > 1), "the glowing firefly motif moves with its light rather than leaving a fixed spot");
    assertDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

async function installAmbientTitleDrawProbe(page) {
  await page.addInitScript(() => {
    window.__cattasksAmbientTitleDraws = 0;
    for (const prototype of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
      if (!prototype) continue;
      for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
        if (!Object.prototype.hasOwnProperty.call(prototype, name)) continue;
        const original = prototype[name];
        prototype[name] = function (...args) {
          const result = original.apply(this, args);
          if (this.canvas?.parentElement?.hasAttribute("data-cattasks-ambient")) window.__cattasksAmbientTitleDraws++;
          return result;
        };
      }
    }
  });
}

async function titleAndAmbientGeometry(page) {
  return page.evaluate(() => {
    const title = document.querySelector("header[data-v146-header] h1");
    const host = document.querySelector("[data-cattasks-ambient]");
    const root = host?.parentElement;
    if (!title || !host || !root) throw new Error("real title or ambient root is unavailable");
    const rect = node => {
      const value = node.getBoundingClientRect();
      return {x: value.x, y: value.y, width: value.width, height: value.height};
    };
    return {title: rect(title), root: rect(root), canvases: host.querySelectorAll("canvas").length, draws: window.__cattasksAmbientTitleDraws};
  });
}

test("ambient protected title metric recomposes while reduced Motion is paused", {timeout: 30_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 623, height: 1100}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    await installAmbientTitleDrawProbe(page);
    const diagnostics = await prepare(page);
    await chooseTheme(page, "Khorne");
    await expectAmbient(page, "khorne", "paused");
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (let frame = 0; frame < 4; frame++) await new Promise(requestAnimationFrame);
    });
    await page.waitForTimeout(300);
    const quiet = await titleAndAmbientGeometry(page);
    await page.waitForTimeout(300);
    const quietAgain = await titleAndAmbientGeometry(page);
    assert.equal(quietAgain.draws, quiet.draws, "reduced Motion establishes a quiet ambient canvas before title geometry changes");

    const before = quietAgain;
    await page.locator("header[data-v146-header] h1").evaluate(async title => {
      title.style.lineHeight = "2.1";
      await document.fonts.ready;
      for (let frame = 0; frame < 4; frame++) await new Promise(requestAnimationFrame);
    });
    await page.waitForTimeout(350);
    const after = await titleAndAmbientGeometry(page);
    assert.ok(after.title.height > before.title.height + 20, "a controlled late metric change grows the real protected title at the fixed 623px viewport");
    assert.deepEqual(after.root, before.root, "the outer ambient workspace geometry remains stable while only the live title changes");
    assert.equal(after.canvases, 1, "title recomposition retains exactly one ambient canvas");
    assert.ok(after.draws > before.draws, "a controlled late protected-title metric change recomposes the paused ambient scene without synthetic resize or scroll");
    assertDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});
