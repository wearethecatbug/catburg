const assert = require("node:assert/strict");
const test = require("node:test");
const zlib = require("node:zlib");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

// This suite intentionally uses only inert catalogue data.  It must never invoke
// user supplied Run Code or Test Code.
const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:44018";
const stripName = "Pet feeding strip";
const chaosThemes = ["khorne", "nurgle", "slaanesh", "tzeentch"];
const capybaraThemes = ["light", "dark"];
const widths = [320, 360, 430, 622, 623, 700, 834, 933, 1040, 1160, 1280, 1440, 1600];
const catalog = {version: 1, tasks: [{
  id: "tyranid-pixi-fixture",
  title: "Tyranid Pixi inert fixture",
  description: "Inert browser fixture. No entered code is executed.",
  entryPoint: "echo",
  starterCode: "function echo(value) { return value; }",
  solution: "function echo(value) { return value; }",
  tests: [{args: ["fixture"], expected: "fixture"}],
}]};

async function prepare(context, page) {
  const diagnostics = {console: [], page: [], request: [], response: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.request.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || "unknown failure"}`));
  page.on("response", response => {
    if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`);
  });
  await context.route("**/task-catalog.v1.json", route => route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}));
  const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
  assert.equal(response?.status(), 200, "the isolated CatTasks dashboard responds with HTTP 200");
  const strip = page.getByLabel(stripName, {exact: true});
  await strip.waitFor({state: "visible", timeout: 10_000});
  await strip.getByRole("button", {name: "Feed pet", exact: true}).waitFor({state: "visible", timeout: 10_000});
  return {diagnostics, strip};
}

function assertCleanDiagnostics(diagnostics, options = {}) {
  const allowed = [
    ...(options.allowMonacoAbort ? [/^GET .*\/vs\/language\/typescript\/tsWorker\.js .*ERR_ABORTED$/] : []),
    ...(options.allowTyranidAbort ? [/^GET .*\/cattasks\/themes\/shared\/tyranid\/tyranid-all-actions-v3\.png .*ERR_ABORTED$/] : []),
  ];
  const unexpectedRequestFailures = diagnostics.request.filter(entry => !allowed.some(pattern => pattern.test(entry)));
  assert.deepEqual({console: diagnostics.console, page: diagnostics.page, request: unexpectedRequestFailures, response: diagnostics.response}, {console: [], page: [], request: [], response: []}, "the inert browser scenario emits no unexpected console, page, request, or response diagnostics");
}

async function selectTheme(page, theme) {
  const trigger = page.getByRole("button", {name: /Choose theme \(current:/});
  await trigger.click();
  const option = page.getByRole("button", {name: theme[0].toUpperCase() + theme.slice(1), exact: true});
  await option.click();
  await page.locator(`[data-cattasks-theme='${theme}']`).waitFor({state: "attached", timeout: 5_000});
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function selectThemeDuringClock(page, theme) {
  await page.getByRole("button", {name: /Choose theme \(current:/}).click();
  await page.getByRole("button", {name: theme[0].toUpperCase() + theme.slice(1), exact: true}).click();
  await page.locator(`[data-cattasks-theme='${theme}']`).waitFor({state: "attached", timeout: 5_000});
}

async function selectPage(page, view) {
  const dashboard = page.locator("[data-cattasks-page]").first();
  const current = async () => dashboard.getAttribute("data-cattasks-page");
  if (view === "all" && await current() !== "all-tasks") await page.getByRole("button", {name: "All tasks", exact: true}).click();
  if (view === "task" && await current() !== "task") await page.getByRole("button", {name: "Back to task", exact: true}).click();
  await page.waitForFunction(expected => document.querySelector("[data-cattasks-page]")?.getAttribute("data-cattasks-page") === expected, view === "all" ? "all-tasks" : "task");
  if (view === "all") {
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible", timeout: 10_000});
    const filters = page.getByLabel("Task filters", {exact: true});
    if (!await filters.isVisible()) {
      const compactToggle = page.getByRole("button", {name: "Filters", exact: true});
      await compactToggle.waitFor({state: "visible", timeout: 10_000});
      await compactToggle.click();
    }
    await filters.waitFor({state: "visible", timeout: 10_000});
    await filters.getByRole("searchbox").waitFor({state: "visible", timeout: 10_000});
  } else {
    await page.getByLabel("User JavaScript code").waitFor({state: "visible", timeout: 10_000});
    await page.locator("section[aria-labelledby='taskOutputHeading']").waitFor({state: "visible", timeout: 10_000});
  }
}

async function tyranidHost(strip) {
  return strip.locator("[data-pet-renderer='tyranid']");
}

async function assertTyranidLayer(strip, label) {
  await strip.scrollIntoViewIfNeeded();
  await strip.getByRole("button", {name: "Feed pet", exact: true}).scrollIntoViewIfNeeded();
  const host = await tyranidHost(strip);
  await host.waitFor({state: "attached", timeout: 10_000});
  assert.equal(await host.count(), 1, `${label}: exactly one local Tyranid renderer host exists`);
  assert.equal(await host.getAttribute("aria-hidden"), "true", `${label}: decorative renderer is hidden from the accessibility tree`);
  const canvas = host.locator("canvas");
  await canvas.waitFor({state: "attached", timeout: 10_000});
  await canvas.waitFor({state: "visible", timeout: 10_000});
  assert.equal(await canvas.count(), 1, `${label}: the renderer host contains one actual canvas`);
  const geometry = await strip.evaluate((node, hostNode) => {
    const track = node.querySelector(":scope > [aria-hidden='true']:not([data-pet-renderer='tyranid'])");
    const feed = node.querySelector("button[aria-label='Feed pet']");
    const canvas = hostNode.querySelector("canvas");
    if (!track || !feed || !canvas) throw new Error("PetStrip layering anchors unavailable");
    const rect = item => {
      const box = item.getBoundingClientRect();
      const style = getComputedStyle(item);
      return {left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height, z: style.zIndex, pointerEvents: style.pointerEvents};
    };
    const trackPrecedesHost = Boolean(track.compareDocumentPosition(hostNode) & Node.DOCUMENT_POSITION_FOLLOWING);
    return {strip: rect(node), track: rect(track), feed: rect(feed), host: rect(hostNode), canvas: rect(canvas), trackPrecedesHost, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth};
  }, await host.elementHandle());
  assert.equal(geometry.trackPrecedesHost, true, `${label}: the native track precedes the local renderer host in PetStrip`);
  assert.ok(geometry.canvas.width > 0 && geometry.canvas.height > 0, `${label}: canvas has a visible local drawing area`);
  assert.ok(geometry.canvas.left >= geometry.strip.left - 1 && geometry.canvas.right <= geometry.strip.right + 1, `${label}: canvas is clipped to PetStrip`);
  assert.equal(geometry.canvas.pointerEvents, "none", `${label}: canvas cannot consume native feed input`);
  assert.ok(Number(geometry.feed.z) > Number(geometry.host.z), `${label}: native Feed paints above the Tyranid host independent of pointer hit testing`);
  assert.equal(geometry.scrollWidth, geometry.clientWidth, `${label}: page has no horizontal overflow`);
  const hit = await strip.evaluate(node => {
    const button = node.querySelector("button[aria-label='Feed pet']");
    const box = button.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.getAttribute("aria-label");
  });
  assert.equal(hit, "Feed pet", `${label}: Feed remains the upper hit target over the local canvas`);
  return {host, canvas, geometry};
}

async function canvasPaintBounds(canvas) {
  return canvas.evaluate(async element => {
    const image = new Image();
    image.src = element.toDataURL("image/png");
    await image.decode();
    const probe = document.createElement("canvas");
    probe.width = image.width;
    probe.height = image.height;
    const context = probe.getContext("2d", {willReadFrequently: true});
    context.drawImage(image, 0, 0);
    const {data, width, height} = context.getImageData(0, 0, probe.width, probe.height);
    let left = width, top = height, right = -1, bottom = -1, opaque = 0;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 16) continue;
      opaque += 1;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return {opaque, left, top, right, bottom, width, height};
  });
}

function decodeRgbaPng(png) {
  assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "screenshot is a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const chunks = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, "screenshot has 8-bit PNG channels");
      assert.ok(data[9] === 2 || data[9] === 6, "screenshot has RGB or RGBA PNG channels");
      channels = data[9] === 6 ? 4 : 3;
      assert.equal(data[12], 0, "screenshot is not interlaced");
    }
    if (type === "IDAT") chunks.push(data);
    offset += length + 12;
  }
  const stride = width * channels;
  const compressed = zlib.inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(stride * height);
  let source = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = compressed[source++];
    for (let column = 0; column < stride; column += 1) {
      const raw = compressed[source++];
      const left = column >= channels ? pixels[row * stride + column - channels] : 0;
      const above = row > 0 ? pixels[(row - 1) * stride + column] : 0;
      const upperLeft = row > 0 && column >= channels ? pixels[(row - 1) * stride + column - channels] : 0;
      let value = raw;
      if (filter === 1) value = (raw + left) & 255;
      if (filter === 2) value = (raw + above) & 255;
      if (filter === 3) value = (raw + Math.floor((left + above) / 2)) & 255;
      if (filter === 4) {
        const prediction = left + above - upperLeft;
        const leftDistance = Math.abs(prediction - left);
        const aboveDistance = Math.abs(prediction - above);
        const upperLeftDistance = Math.abs(prediction - upperLeft);
        value = (raw + (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance ? left : aboveDistance <= upperLeftDistance ? above : upperLeft)) & 255;
      }
      assert.ok(filter <= 4, "screenshot uses a supported PNG filter");
      pixels[row * stride + column] = value;
    }
  }
  return {width, height, channels, pixels};
}

async function compositedPaintBounds(page, canvas) {
  const box = await canvas.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, "canvas has a visible page clip for composited pixel observation");
  const clip = {x: box.x, y: box.y, width: box.width, height: box.height};
  const visible = decodeRgbaPng(await page.screenshot({type: "png", clip}));
  const priorVisibility = await canvas.evaluate(element => element.style.visibility);
  try {
    await canvas.evaluate(element => { element.style.visibility = "hidden"; });
    const hidden = decodeRgbaPng(await page.screenshot({type: "png", clip}));
    assert.deepEqual({width: hidden.width, height: hidden.height}, {width: visible.width, height: visible.height}, "visible and hidden canvas screenshots share one compositor rectangle");
    const changedPixels = new Uint8Array(visible.width * visible.height);
    let changed = 0;
    for (let y = 0; y < visible.height; y += 1) for (let x = 0; x < visible.width; x += 1) {
      const index = (y * visible.width + x) * visible.channels;
      const delta = Math.abs(visible.pixels[index] - hidden.pixels[index]) + Math.abs(visible.pixels[index + 1] - hidden.pixels[index + 1]) + Math.abs(visible.pixels[index + 2] - hidden.pixels[index + 2]);
      if (delta < 40) continue;
      changed += 1;
      changedPixels[y * visible.width + x] = 1;
    }
    const visited = new Uint8Array(changedPixels.length);
    let largest = {count: 0, left: visible.width, top: visible.height, right: -1, bottom: -1};
    for (let start = 0; start < changedPixels.length; start += 1) {
      if (!changedPixels[start] || visited[start]) continue;
      const stack = [start];
      visited[start] = 1;
      const component = {count: 0, left: visible.width, top: visible.height, right: -1, bottom: -1};
      while (stack.length) {
        const point = stack.pop();
        const x = point % visible.width;
        const y = Math.floor(point / visible.width);
        component.count += 1;
        component.left = Math.min(component.left, x); component.right = Math.max(component.right, x);
        component.top = Math.min(component.top, y); component.bottom = Math.max(component.bottom, y);
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          const nextX = x + dx;
          const nextY = y + dy;
          const next = nextY * visible.width + nextX;
          if (nextX < 0 || nextY < 0 || nextX >= visible.width || nextY >= visible.height || !changedPixels[next] || visited[next]) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }
      if (component.count > largest.count) largest = component;
    }
    return {opaque: largest.count, ...largest, changed, width: visible.width, height: visible.height};
  } finally {
    await canvas.evaluate((element, visibility) => { element.style.visibility = visibility; }, priorVisibility);
  }
}

async function observedPaintBounds(page, canvas) {
  const raw = await canvasPaintBounds(canvas);
  const rawCoversCanvas = raw.opaque > raw.width * raw.height * .9 && raw.left === 0 && raw.top === 0 && raw.right === raw.width - 1 && raw.bottom === raw.height - 1;
  if (raw.opaque > 0 && !rawCoversCanvas) return {...raw, source: "raw"};
  return {...await compositedPaintBounds(page, canvas), source: "composited"};
}

async function waitForCanvasPaint(page, canvas, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const paint = await observedPaintBounds(page, canvas);
    if (paint.opaque > 0) return paint;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(`${label}: local Tyranid canvas never produced rendered pixels`);
}

async function dropAt(page, strip, ratio) {
  await strip.scrollIntoViewIfNeeded();
  const before = await strip.locator("[data-pet='food']").evaluateAll(nodes => nodes.map(node => Number(node.dataset.petPosition)));
  const track = strip.locator("[aria-hidden='true']").first();
  const box = await track.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, "the real PetStrip track has pointer geometry");
  await page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2);
  await strip.locator("[data-pet='food']").first().waitFor({state: "attached", timeout: 2_000});
  const positions = await strip.locator("[data-pet='food']").evaluateAll(nodes => nodes.map(node => Number(node.dataset.petPosition)));
  const position = positions.find(candidate => !before.includes(candidate));
  assert.notEqual(position, undefined, "one pointer action creates one observable food/forearm target");
  return position;
}

async function waitFor(page, predicate, label, timeout = 12_000) {
  await page.waitForFunction(predicate, undefined, {timeout});
  assert.ok(true, label);
}

async function advanceUntil(page, predicate, label, limit = 20_000, step = 20) {
  for (let elapsed = 0; elapsed <= limit; elapsed += step) {
    if (await predicate()) return;
    await page.clock.runFor(step);
    await page.evaluate(() => Promise.resolve());
  }
  assert.fail(`timed out in virtual time: ${label}`);
}

async function advanceFromObserved(page, observedAt, elapsed, label) {
  const now = await page.evaluate(() => Date.now());
  const remaining = observedAt + elapsed - now;
  assert.ok(remaining >= 0, `${label}: the virtual clock did not pass its observed transition`);
  await page.clock.runFor(remaining);
  await page.evaluate(() => Promise.resolve());
}

async function latestObservedState(page, state) {
  return page.evaluate(expected => {
    const events = window.__tyranidTimeline || [];
    return [...events].reverse().find(event => event.type === "state" && event.state === expected)?.at ?? null;
  }, state);
}

async function renderedCentre(page, canvas) {
  const [paint, box] = await Promise.all([observedPaintBounds(page, canvas), canvas.boundingBox()]);
  assert.ok(box && paint.opaque > 0 && paint.right >= paint.left, "the local canvas exposes a measurable rendered actor footprint");
  return {
    x: box.x + ((paint.left + paint.right) / 2 + .5) * box.width / paint.width,
    y: box.y + ((paint.top + paint.bottom) / 2 + .5) * box.height / paint.height,
    paint,
  };
}

test("Tyranid Pixi is a local non-intercepting visual layer in every Chaos Task and All tasks layout", {timeout: 180_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const {diagnostics, strip} = await prepare(context, page);
    for (const theme of chaosThemes) {
      await selectTheme(page, theme);
      for (const width of widths) for (const view of ["task", "all"]) {
        await page.setViewportSize({width, height: width <= 430 ? 844 : 900});
        await selectPage(page, view);
        const layer = await assertTyranidLayer(strip, `${theme}/${view}/${width}px`);
        await waitForCanvasPaint(page, layer.canvas, `${theme}/${view}/${width}px`);
      }
    }
    assertCleanDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("Capybara layouts retain the native DOM dog and no Tyranid canvas across the same v146 matrix", {timeout: 120_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const {diagnostics, strip} = await prepare(context, page);
    for (const theme of capybaraThemes) {
      await selectTheme(page, theme);
      for (const width of widths) for (const view of ["task", "all"]) {
        await page.setViewportSize({width, height: width <= 430 ? 844 : 900});
        await selectPage(page, view);
        const label = `${theme}/${view}/${width}px`;
        assert.equal(await (await tyranidHost(strip)).count(), 0, `${label}: Capybara has no Tyranid renderer`);
        assert.equal(await strip.locator("[data-pet='dog']").count(), 1, `${label}: DOM dog remains present`);
        const dimensions = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth}));
        assert.equal(dimensions.scrollWidth, dimensions.clientWidth, `${label}: Capybara v146 view has no horizontal overflow`);
      }
    }
    for (const width of [622, 623]) {
      await page.reload({waitUntil: "domcontentloaded"});
      await strip.waitFor({state: "visible", timeout: 10_000});
      await selectTheme(page, "dark");
      await page.setViewportSize({width, height: 900});
      await selectPage(page, "task");
      const feed = strip.getByRole("button", {name: "Feed pet", exact: true});
      await feed.focus();
      await feed.press("Enter");
      assert.equal(await strip.locator("[data-pet='food'][data-pet-position='50']").count(), 1, `${width}px: native Enter places Capybara food at 50%`);
      await dropAt(page, strip, 0.72);
    }
    assertCleanDiagnostics(diagnostics, {allowMonacoAbort: true});
  } finally {
    await context.close();
    await browser.close();
  }
});

test("Tyranid keeps native Feed ordering and makes bite, acid, next-target and puddle observable", {timeout: 75_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1040, height: 900}});
  const page = await context.newPage();
  try {
    const {diagnostics, strip} = await prepare(context, page);
    await selectTheme(page, "khorne");
    const {canvas} = await assertTyranidLayer(strip, "khorne/task/1040px");
    assert.equal(typeof page.clock?.install, "function", "the supplied Playwright supports deterministic scheduler checks");
    await page.clock.install({time: new Date("2026-01-01T00:00:00Z")});
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 60_000);
    await page.evaluate(() => {
      window.__tyranidTimeline = [];
      const strip = document.querySelector("[aria-label='Pet feeding strip']");
      if (!strip) throw new Error("PetStrip timeline anchor is unavailable");
      new MutationObserver(records => {
        for (const record of records) {
          if (record.type === "attributes" && record.attributeName === "data-pet-state") {
            window.__tyranidTimeline.push({type: "state", state: strip.getAttribute("data-pet-state"), at: Date.now()});
          }
        }
      }).observe(strip, {attributes: true, attributeFilter: ["data-pet-state"]});
    });
    const feed = strip.getByRole("button", {name: "Feed pet", exact: true});
    await feed.focus();
    await feed.press("Enter");
    const active = 50;
    await strip.locator("[data-pet='food'][data-pet-position='50']").waitFor({state: "attached", timeout: 2_000});
    assert.equal(await strip.locator("[data-pet='food'][data-pet-position='50']").count(), 1, "native Chaos Feed Enter places the forearm at the exact 50% position");
    const near = await dropAt(page, strip, 0.63);
    const far = await dropAt(page, strip, 0.18);
    const forearm = strip.locator(`[data-pet='food'][data-pet-position='${active}']`);
    await advanceUntil(page, () => strip.getAttribute("data-pet-state").then(state => state === "eating"), "Tyranid reaches the initial blue forearm", 20_000, 1);
    await page.evaluate(() => Promise.resolve());
    const eatingAt = await latestObservedState(page, "eating");
    assert.notEqual(eatingAt, null, "MutationObserver records the exact eating transition");
    assert.equal(await forearm.count(), 1, "the blue forearm remains until the bite delay completes");
    const forearmBox = await forearm.boundingBox();
    assert.ok(forearmBox, "the selected blue forearm has a painted DOM rectangle");
    const actor = await renderedCentre(page, canvas);
    const expectedBiteX = forearmBox.x + forearmBox.width / 2 - 30;
    assert.ok(Math.abs(actor.x - expectedBiteX) <= 8, `right-facing Tyranid reaches the 30px bite offset before consuming the forearm: actor ${actor.x}, expected ${expectedBiteX}, paint ${JSON.stringify(actor.paint)}`);
    await advanceFromObserved(page, eatingAt, 319, "320ms bite delay");
    assert.equal(await forearm.count(), 1, "forearm is not consumed before the 320ms bite delay");
    await advanceFromObserved(page, eatingAt, 321, "post-bite consumption");
    assert.equal(await forearm.count(), 0, "forearm is consumed immediately after the 320ms bite delay");
    await advanceUntil(page, () => strip.getAttribute("data-pet-state").then(state => state === "acid"), "acid action starts after the bite/eating sequence", 5_000, 1);
    await page.evaluate(() => Promise.resolve());
    const acidStartedAt = await latestObservedState(page, "acid");
    assert.notEqual(acidStartedAt, null, "MutationObserver records the exact acid transition");
    const acid = strip.locator("[data-pet='acid']");
    assert.equal(await acid.count(), 1, "acid state has one visible acid prop");
    const acidNode = await acid.elementHandle();
    assert.ok(acidNode, "the acid prop has one stable DOM identity");
    const acidBox = await acid.boundingBox();
    assert.ok(acidBox, "acid action has a visible DOM geometry anchor");
    assert.ok(Math.abs(acidBox.x + acidBox.width / 2 - (actor.x - 44)) <= 8, "right-facing acid releases 44px behind Tyranid on the opposite side");
    await advanceFromObserved(page, acidStartedAt, 739, "740ms acid action");
    assert.equal(await strip.getAttribute("data-pet-state"), "acid", "acid action lasts its full 740ms");
    await advanceUntil(page, () => strip.getAttribute("data-pet-state").then(state => state === "running"), "the nearest queued forearm begins only after acid action", 10, 1);
    assert.equal(await strip.getAttribute("data-pet-state"), "running", "the nearest queued forearm begins only after acid action");
    await page.evaluate(() => Promise.resolve());
    const puddleStartedAt = await latestObservedState(page, "running");
    assert.notEqual(puddleStartedAt, null, "MutationObserver records the next-target running transition");
    assert.ok(puddleStartedAt - acidStartedAt >= 740, "the next target cannot begin before the completed 740ms acid action");
    assert.equal(await strip.locator(`[data-pet='food'][data-pet-position='${near}']`).count(), 1, "near forearm remains present as the next run begins");
    const puddle = strip.locator("[data-pet='acid'][data-pet-phase='5']");
    assert.equal(await puddle.count(), 1, "first acid action leaves one visible puddle while the next target starts");
    await advanceFromObserved(page, acidStartedAt, 2_239, "740ms acid action plus 1500ms puddle visibility");
    assert.equal(await puddle.count(), 1, "puddle persists for its 1500ms visibility interval");
    assert.equal(await acidNode.evaluate(node => node.isConnected), true, "the same acid DOM prop remains connected just before cleanup");
    await advanceFromObserved(page, acidStartedAt, 2_241, "post-puddle cleanup");
    assert.equal(await puddle.count(), 0, `puddle expires after its visibility interval starting at ${puddleStartedAt}`);
    assert.equal(await acidNode.evaluate(node => node.isConnected), false, "the same acid DOM prop is removed after the puddle deadline");
    await advanceUntil(page, () => strip.locator(`[data-pet='food'][data-pet-position='${near}']`).count().then(count => count === 0), "nearest queued forearm is consumed before the farther forearm", 8_000, 1);
    assert.equal(await strip.locator(`[data-pet='food'][data-pet-position='${far}']`).count(), 1, "farther forearm remains queued while the nearer target runs");
    assertCleanDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("Tyranid local renderer survives reduced motion, controlled visibility and rapid theme cancellation without duplicates", {timeout: 75_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 700, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  const assetPattern = "**/cattasks/themes/shared/tyranid/tyranid-all-actions-v3.png";
  let releaseAsset;
  let assetRequested;
  const assetRequest = new Promise(resolve => { assetRequested = resolve; });
  const assetRelease = new Promise(resolve => { releaseAsset = resolve; });
  const deferAsset = async route => {
    assetRequested(route);
    await assetRelease;
    await route.continue();
  };
  try {
    await context.route(assetPattern, deferAsset);
    const {diagnostics, strip} = await prepare(context, page);
    await selectTheme(page, "khorne");
    const heldRoute = await Promise.race([
      assetRequest,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Tyranid sprite request was not reached")), 10_000)),
    ]);
    assert.ok(heldRoute, "the exact same-origin Tyranid sprite request is reached before cancellation");
    await selectTheme(page, "light");
    releaseAsset();
    await page.waitForTimeout(150);
    assert.equal(await (await tyranidHost(strip)).count(), 0, "late local sprite completion cannot resurrect an unmounted Tyranid host");
    await context.unroute(assetPattern, deferAsset);
    await selectTheme(page, "tzeentch");
    await assertTyranidLayer(strip, "reduced-motion initial");
    // Controlled browser-hidden approximation. The component observes the real
    // visibilitychange event and document.hidden value; this is deliberately not
    // presented as proof of an operating-system window minimisation.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {configurable: true, value: true});
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "hidden", {configurable: true, value: false});
      document.dispatchEvent(new Event("visibilitychange"));
    });
    for (const theme of ["nurgle", "light", "slaanesh", "dark", "tzeentch"]) {
      await selectTheme(page, theme);
      if (capybaraThemes.includes(theme)) assert.equal(await (await tyranidHost(strip)).count(), 0, `${theme}: cancelled/unmounted Tyranid host is absent`);
      else assert.equal(await (await tyranidHost(strip)).count(), 1, `${theme}: remounted Tyranid host is singular`);
    }
    await assertTyranidLayer(strip, "reduced-motion final");
    assertCleanDiagnostics(diagnostics, {allowTyranidAbort: true});
  } finally {
    await context.close();
    await browser.close();
  }
});

test("an active meal keeps its projection with its owning pet through a Chaos and Capybara theme crossing", {timeout: 75_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1040, height: 900}});
  const page = await context.newPage();
  try {
    const {diagnostics, strip} = await prepare(context, page);
    await selectTheme(page, "dark");
    const initialDog = await strip.locator("[data-pet='dog']").evaluate(node => ({
      position: node.style.getPropertyValue("--pet-position"),
      state: node.getAttribute("data-pet-state"),
    }));
    assert.deepEqual(initialDog, {position: "6%", state: "idle"}, "the Dark fixture starts from the native dog idle pose");
    await selectTheme(page, "khorne");
    await assertTyranidLayer(strip, "Khorne before a theme crossing");
    await page.clock.install({time: new Date("2026-01-01T00:00:00Z")});
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 60_000);
    const switchThemeDuringClock = async theme => {
      await page.getByRole("button", {name: /Choose theme \(current:/}).click();
      await page.getByRole("button", {name: theme[0].toUpperCase() + theme.slice(1), exact: true}).click();
      await page.locator(`[data-cattasks-theme='${theme}']`).waitFor({state: "attached", timeout: 5_000});
    };

    const feed = strip.getByRole("button", {name: "Feed pet", exact: true});
    await feed.focus();
    await feed.press("Enter");
    await strip.locator("[data-pet='food'][data-pet-position='50']").waitFor({state: "attached", timeout: 2_000});
    assert.equal(await strip.getAttribute("data-pet-state"), "running", "the Chaos meal begins before the theme crossing");

    await switchThemeDuringClock("dark");
    assert.equal(await (await tyranidHost(strip)).count(), 0, "Capybara does not retain a Chaos canvas while its own pet is active");
    const dog = strip.locator("[data-pet='dog']");
    assert.equal(await dog.count(), 1, "Capybara immediately projects its native DOM dog");
    assert.equal(await dog.getAttribute("data-pet-state"), "idle", "Capybara dog does not inherit Tyranid travel state");
    assert.deepEqual(await dog.evaluate(node => ({position: node.style.getPropertyValue("--pet-position"), state: node.getAttribute("data-pet-state")})), initialDog, "Capybara restores its own reachable idle pose instead of borrowing the Tyranid destination");
    assert.equal(await strip.locator("[data-pet='food'][data-pet-position='50']").count(), 0, "Capybara does not retain the specific active Chaos target");
    assert.equal(await strip.locator("[data-pet='food'] svg").count(), 0, "Capybara does not reinterpret the active forearm as a dog target");
    await feed.focus();
    assert.equal(await page.evaluate(element => document.activeElement === element, await feed.elementHandle()), true, "Feed remains focusable during the crossed meal");

    await switchThemeDuringClock("khorne");
    await assertTyranidLayer(strip, "Khorne restores the active meal");
    assert.equal(await strip.locator("[data-pet='food'][data-pet-position='50']").count(), 1, "returning to Chaos restores the original forearm during travel");
    await advanceUntil(page, () => strip.getAttribute("data-pet-state").then(state => state === "acid"), "the returned Tyranid reaches acid", 20_000, 1);
    assert.equal(await strip.locator("[data-pet='acid']").count(), 1, "Chaos renders the active acid prop");

    await switchThemeDuringClock("dark");
    assert.equal(await (await tyranidHost(strip)).count(), 0, "Capybara remains free of a Tyranid canvas during acid");
    assert.equal(await dog.getAttribute("data-pet-state"), "idle", "Capybara dog does not inherit Tyranid acid state");
    assert.equal(await strip.locator("[data-pet='acid']").count(), 0, "Capybara does not paint the Tyranid-only acid prop");

    await switchThemeDuringClock("khorne");
    await assertTyranidLayer(strip, "Khorne restores active acid");
    assert.equal(await strip.locator("[data-pet='acid']").count(), 1, "returning to Chaos restores acid before the original action completes");
    await page.clock.runFor(741);
    await page.evaluate(() => Promise.resolve());
    assert.notEqual(await strip.getAttribute("data-pet-state"), "acid", "the restored action still completes on its original deadline");
    await page.clock.runFor(10_000);
    await page.evaluate(() => Promise.resolve());

    await switchThemeDuringClock("dark");
    await feed.focus();
    await feed.press("Enter");
    await strip.locator("[data-pet='food'][data-pet-position='50']").waitFor({state: "attached", timeout: 2_000});
    assert.equal(await dog.getAttribute("data-pet-state"), "running", "the inverse crossing starts a native Dark dog meal");
    await switchThemeDuringClock("khorne");
    await assertTyranidLayer(strip, "Khorne during an active Dark meal");
    assert.equal(await strip.locator("[data-pet='food'][data-pet-position='50']").count(), 0, "Chaos does not reinterpret an active Dark pellet as a forearm");
    await switchThemeDuringClock("dark");
    assert.equal(await dog.getAttribute("data-pet-state"), "running", "returning to Dark restores its captured dog travel");
    assert.equal(await strip.locator("[data-pet='food'][data-pet-position='50']").count(), 1, "returning to Dark restores its original active pellet");
    assertCleanDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("a completed Dark dog meal retains its independent pile clock through a God theme", {timeout: 75_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1040, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const {diagnostics, strip} = await prepare(context, page);
    await selectTheme(page, "dark");
    await page.clock.install({time: new Date("2026-01-01T00:00:00Z")});
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 60_000);

    const switchThemeDuringClock = async theme => {
      await page.getByRole("button", {name: /Choose theme \(current:/}).click();
      await page.getByRole("button", {name: theme[0].toUpperCase() + theme.slice(1), exact: true}).click();
      await page.locator(`[data-cattasks-theme='${theme}']`).waitFor({state: "attached", timeout: 5_000});
    };

    const dog = strip.locator("[data-pet='dog']");
    const feed = strip.getByRole("button", {name: "Feed pet", exact: true});
    await feed.focus();
    await feed.press("Enter");
    await advanceUntil(page, () => dog.getAttribute("data-pet-state").then(state => state === "eating"), "Dark dog reaches its native food", 20_000, 1);
    await advanceUntil(page, () => strip.getAttribute("data-pet-state").then(state => state === "idle"), "Dark dog completes its native meal", 5_000, 1);
    const completedAt = await page.evaluate(() => Date.now());
    assert.equal(await strip.locator("[data-pet='pile']").count(), 0, "the dog pile has not appeared at meal completion");

    await switchThemeDuringClock("khorne");
    await assertTyranidLayer(strip, "Khorne while the completed Dark pile clock runs");
    assert.equal(await strip.locator("[data-pet='dog']").count(), 0, "God themes keep the dog visual marker out of the active projection");
    assert.equal(await strip.locator("[data-pet='pile']").count(), 0, "God themes do not paint the Dark dog pile");
    assert.notEqual(await strip.getByRole("status").textContent(), "Pet left a little pile", "God view does not expose a Dark-only pile status");

    await advanceFromObserved(page, completedAt, 2_999, "Dark pile pre-deadline while God is selected");
    assert.equal(await strip.locator("[data-pet='pile']").count(), 0, "no Dark pile is exposed before the three-second deadline");
    await page.clock.runFor(2);
    await page.evaluate(() => Promise.resolve());
    await switchThemeDuringClock("dark");

    const pile = strip.locator("[data-pet='pile']");
    assert.equal(await pile.count(), 1, "returning to Dark exposes its completed meal pile after the original deadline");
    assert.match(await pile.getAttribute("data-pet-anchor") || "", /^-?\d+(?:\.\d+)?$/, "the restored pile retains a measurable rear anchor");
    assert.match(await pile.getAttribute("data-pet-rear-offset") || "", /^-?\d+(?:\.\d+)?$/, "the restored pile retains a measured dog rear offset");
    assert.equal(await strip.getByRole("status").textContent(), "Pet left a little pile", "Dark restores the live pile status");

    await advanceFromObserved(page, completedAt, 9_999, "Dark pile lifetime before its original expiry");
    assert.equal(await pile.count(), 1, "the restored pile survives through its seven-second lifetime");
    await page.clock.runFor(2);
    await page.evaluate(() => Promise.resolve());
    assert.equal(await pile.count(), 0, "the restored pile expires on its original clock rather than a return-to-Dark clock");
    assertCleanDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

async function withTyranidR1Browser(scenario) {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  try {
    await scenario(browser);
  } finally {
    await browser.close();
  }
}

test("Tyranid keeps a physical 30px bite anchor after a responsive viewport change", {timeout: 75_000}, async () => {
  await withTyranidR1Browser(async browser => {
    const context = await browser.newContext({viewport: {width: 1040, height: 900}});
    try {
      const page = await context.newPage();
      const {diagnostics, strip} = await prepare(context, page);
      await selectThemeDuringClock(page, "khorne");
      const {canvas} = await assertTyranidLayer(strip, "responsive bite anchor");
      await page.clock.install({time: new Date("2026-01-01T00:00:00Z")});
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 60_000);
      const feed = strip.getByRole("button", {name: "Feed pet", exact: true});
      await feed.focus();
      await feed.press("Enter");
      await page.setViewportSize({width: 623, height: 900});
      await page.clock.runFor(80);
      await advanceUntil(page, () => strip.getAttribute("data-pet-state").then(state => state === "eating"), "Tyranid reaches the resized centre forearm", 20_000, 8);
      const forearm = strip.locator("[data-pet='food'][data-pet-position='50']");
      const [forearmBox, actor] = await Promise.all([forearm.boundingBox(), renderedCentre(page, canvas)]);
      assert.ok(forearmBox, "the resized forearm has a visible geometry anchor");
      const gap = forearmBox.x + forearmBox.width / 2 - actor.x;
      assert.ok(Math.abs(gap - 30) <= 8, `resizing during travel retains the right-facing 30px bite gap, observed ${gap}`);
      assertCleanDiagnostics(diagnostics);
    } finally {
      await context.close();
    }
  });
});

test("Tyranid does not rewind a settled acid effect when controlled motion is restored", {timeout: 75_000}, async () => {
  await withTyranidR1Browser(async browser => {
    const context = await browser.newContext({viewport: {width: 1040, height: 900}});
    try {
      await context.addInitScript(() => {
        const nativeMatchMedia = window.matchMedia;
        window.__tyranidMotionQueries = [];
        window.matchMedia = query => {
          const mediaQuery = nativeMatchMedia.call(window, query);
          if (query.includes("prefers-reduced-motion")) window.__tyranidMotionQueries.push(mediaQuery);
          return mediaQuery;
        };
      });
      const page = await context.newPage();
      const {diagnostics, strip} = await prepare(context, page);
      await selectTheme(page, "khorne");
      await page.clock.install({time: new Date("2026-01-01T00:00:00Z")});
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 60_000);
      await strip.getByRole("button", {name: "Feed pet", exact: true}).press("Enter");
      await advanceUntil(page, () => strip.getAttribute("data-pet-state").then(state => state === "acid"), "acid starts for a reduced-motion crossing", 20_000, 5);
      const acid = strip.locator("[data-pet='acid']");
      const changeMotion = async preference => {
        await page.emulateMedia({reducedMotion: preference});
        await page.evaluate(() => {
          for (const mediaQuery of window.__tyranidMotionQueries) mediaQuery.dispatchEvent(new MediaQueryListEvent("change", {matches: mediaQuery.matches, media: mediaQuery.media}));
        });
      };
      await page.clock.runFor(120);
      await changeMotion("reduce");
      assert.equal(await acid.getAttribute("data-pet-phase"), "5", "reduced motion settles an active acid effect");
      await page.clock.runFor(40);
      await changeMotion("no-preference");
      await page.clock.runFor(100);
      assert.equal(await acid.getAttribute("data-pet-phase"), "5", "restoring motion cannot rewind a settled acid effect");
      assertCleanDiagnostics(diagnostics);
    } finally {
      await context.close();
    }
  });
});

test("Tyranid preserves the original Dark idle deadline while Chaos is selected", {timeout: 75_000}, async () => {
  await withTyranidR1Browser(async browser => {
    const context = await browser.newContext({viewport: {width: 1040, height: 900}});
    try {
      const page = await context.newPage();
      await page.clock.install({time: new Date("2026-01-01T00:00:00Z")});
      const {diagnostics, strip} = await prepare(context, page);
      await selectThemeDuringClock(page, "dark");
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 250);
      assert.equal(await strip.locator("[data-pet='dog']").getAttribute("data-pet-state"), "idle", "the original Dark idle deadline has not fired before the cross-theme interval");
      await selectThemeDuringClock(page, "khorne");
      await page.clock.runFor(32_000);
      assert.equal(await strip.getAttribute("data-pet-state"), "sleeping", "the active Chaos projection proves the authoritative idle timer fired while Dark was dormant");
      await selectThemeDuringClock(page, "dark");
      assert.equal(await strip.locator("[data-pet='dog']").getAttribute("data-pet-state"), "sleeping", "a dormant Dark projection reaches the original idle sleep deadline after a theme crossing");
      assertCleanDiagnostics(diagnostics);
    } finally {
      await context.close();
    }
  });
});

test("Tyranid restores the active eating framebuffer phase after a Capybara round trip", {timeout: 75_000}, async () => {
  await withTyranidR1Browser(async browser => {
    const context = await browser.newContext({viewport: {width: 1040, height: 900}});
    try {
      await context.addInitScript(() => {
        window.__tyranidFrameRequest = false;
        window.__tyranidFrame = null;
        for (const Constructor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
          if (!Constructor) continue;
          for (const method of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
            if (!Object.hasOwn(Constructor.prototype, method)) continue;
            const nativeDraw = Constructor.prototype[method];
            Constructor.prototype[method] = function (...args) {
              const result = nativeDraw.apply(this, args);
              if (!window.__tyranidFrameRequest || !this.canvas?.closest?.("[data-pet-renderer='tyranid']")) return result;
              const pixels = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
              this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, pixels);
              let fingerprint = 2166136261;
              let opaque = 0;
              for (let index = 0; index < pixels.length; index += 4) {
                if (!pixels[index + 3]) continue;
                opaque += 1;
                fingerprint = Math.imul(fingerprint ^ index ^ pixels[index] ^ (pixels[index + 1] << 8) ^ (pixels[index + 2] << 16), 16777619);
              }
              if (opaque) {
                window.__tyranidFrame = {fingerprint, opaque};
                window.__tyranidFrameRequest = false;
              }
              return result;
            };
          }
        }
      });
      const page = await context.newPage();
      const {diagnostics, strip} = await prepare(context, page);
      const frame = async () => {
        await page.evaluate(() => { window.__tyranidFrame = null; window.__tyranidFrameRequest = true; });
        for (let attempt = 0; attempt < 6; attempt += 1) {
          await page.clock.runFor(16);
          const sample = await page.evaluate(() => window.__tyranidFrame);
          if (sample) return sample;
        }
        assert.fail("the local renderer did not expose an eating-frame sample");
      };
      await selectTheme(page, "khorne");
      await assertTyranidLayer(strip, "phase restoration before meal");
      await page.clock.install({time: new Date("2026-01-01T00:00:00Z")});
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 60_000);
      await strip.getByRole("button", {name: "Feed pet", exact: true}).press("Enter");
      await advanceUntil(page, () => strip.getAttribute("data-pet-state").then(state => state === "eating"), "Tyranid enters eating before phase sample", 20_000, 8);
      const initial = await frame();
      await page.clock.runFor(210);
      const late = await frame();
      assert.notDeepEqual(late, initial, "the original meal clock advances the displayed eating frame");
      await selectThemeDuringClock(page, "dark");
      await selectThemeDuringClock(page, "khorne");
      await assertTyranidLayer(strip, "phase restoration after theme remount");
      const restored = await frame();
      assert.deepEqual(restored, late, "returning during the same meal restores its current animation phase instead of frame zero");
      await advanceUntil(page, () => strip.getAttribute("data-pet-state").then(state => state === "acid"), "Tyranid reaches acid before the second phase sample", 5_000, 8);
      const acidInitial = await frame();
      await page.clock.runFor(200);
      const acidLate = await frame();
      assert.notDeepEqual(acidLate, acidInitial, "the original acid clock advances the displayed acid frame");
      await selectThemeDuringClock(page, "dark");
      await selectThemeDuringClock(page, "khorne");
      await assertTyranidLayer(strip, "acid phase restoration after theme remount");
      assert.deepEqual(await frame(), acidLate, "returning during the same acid effect restores its current animation phase instead of frame zero");
      assertCleanDiagnostics(diagnostics, {allowTyranidAbort: true});
    } finally {
      await context.close();
    }
  });
});
