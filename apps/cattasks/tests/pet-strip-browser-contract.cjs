const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43814";
const stripName = "Pet feeding strip";
// Valid inert data only; this contract never invokes Test Code or Run Code.
const catalog = {version: 1, tasks: [{
  id: "pet-strip-fixture",
  title: "Pet strip fixture",
  description: "Inert browser fixture.",
  entryPoint: "echo",
  starterCode: "function echo(value) { return value; }",
  solution: "function echo(value) { return value; }",
  tests: [{args: ["fixture"], expected: "fixture"}],
}]};

async function prepare(context, page) {
  const diagnostics = {console: [], page: [], request: [], response: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.request.push(`${request.method()} ${request.url()}`));
  page.on("response", response => {
    if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`);
  });
  await context.route("**/task-catalog.v1.json", route => route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}));
  const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
  assert.equal(response?.status(), 200, "the isolated dashboard route responds with HTTP 200");
  return diagnostics;
}

function assertCleanDiagnostics(diagnostics) {
  assert.deepEqual(diagnostics, {console: [], page: [], request: [], response: []}, "inert startup and pet interaction emit no browser diagnostics");
}

async function advanceUntil(page, predicate, description, limit = 15_000) {
  for (let elapsed = 0; elapsed <= limit; elapsed += 100) {
    if (await predicate()) return;
    await page.clock.runFor(100);
  }
  assert.fail(`timed out in virtual time: ${description}`);
}

async function advanceUntilObservedTick(page, predicate, description, limit = 3_000) {
  for (let elapsed = 0; elapsed <= limit; elapsed += 1) {
    if (await predicate()) return;
    await page.clock.runFor(1);
    await page.evaluate(() => Promise.resolve());
  }
  assert.fail(`timed out while observing one-millisecond virtual ticks: ${description}`);
}

async function dropAt(page, strip, ratio) {
  const box = await strip.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, "the pet strip must expose a visible pointer target");
  return dropAtX(page, strip, box.x + Math.round(box.width * ratio), box.y + box.height / 2);
}

async function dropAtX(page, strip, x, y) {
  const before = await foodPositions(strip);
  const box = await strip.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, "the pet strip must expose a visible pointer target");
  await page.mouse.click(x, y);
  await assert.doesNotReject(strip.locator("[data-pet='food']").first().waitFor({state: "attached", timeout: 2_000}));
  const positions = await foodPositions(strip);
  assert.equal(positions.length, before.length + 1, "one accepted pointer action creates exactly one food item");
  const position = positions.find(candidate => !before.includes(candidate));
  assert.notEqual(position, undefined, "each newly placed food has an observable horizontal position");
  return position;
}

async function foodPositions(strip) {
  return strip.locator("[data-pet='food']").evaluateAll(nodes => nodes.map(node => Number(node.dataset.petPosition)));
}

async function countAt(strip, pet, position) {
  return strip.locator(`[data-pet='${pet}']`).evaluateAll((nodes, expected) => nodes.filter(node => Number(node.dataset.petPosition) === expected).length, position);
}

async function dogTargets(dog, position) {
  return Number(await dog.getAttribute("data-pet-target")) === position;
}

async function petTimeline(page) {
  return page.evaluate(() => window.__petStripTimeline || []);
}

async function waitForEnabledFeed(strip) {
  const feed = strip.getByRole("button", {name: "Feed pet", exact: true});
  await strip.locator("button[aria-label='Feed pet']:enabled").waitFor({state: "visible", timeout: 10_000});
  return feed;
}

test("CatTasks pet strip is a shallow accessible footer without the retired game surface", {timeout: 30_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(context, page);
    assert.equal(typeof page.clock?.install, "function", "the supplied Playwright must support deterministic browser clocks");
    await page.clock.install({time: new Date("2026-01-01T00:00:00Z")});
    const strip = page.getByLabel(stripName, {exact: true});
    await strip.waitFor({state: "visible", timeout: 10_000});
    const feed = await waitForEnabledFeed(strip);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 5_000);
    assert.equal(await strip.count(), 1, "the dashboard has one pet strip");
    assert.equal(await strip.locator("canvas").count(), 0, "the footer does not mount a canvas game");
    assert.equal(await page.getByRole("link", {name: /играть с п[её]сиком/i}).count(), 0, "the document does not expose the retired game link");

    const bounds = await strip.boundingBox();
    assert.ok(bounds && bounds.width > 0 && bounds.height > 0, "the strip is rendered");
    assert.ok(bounds.height < page.viewportSize().height / 3, "the footer remains a shallow strip rather than a game panel");
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width, "the mobile strip is horizontally reachable");

    const status = strip.getByRole("status");
    assert.equal(await feed.count(), 1, "one native Feed control is available");
    assert.equal(await status.count(), 1, "feeding changes have one live status channel");
    await feed.focus();
    assert.equal(await feed.evaluate(element => element === document.activeElement), true, "Feed receives keyboard focus");
    await feed.press("Enter");
    await assert.doesNotReject(strip.locator("[data-pet='food']").first().waitFor({state: "attached", timeout: 2_000}));
    assert.equal(await strip.locator("[data-pet='food']").count(), 1, "one keyboard feed creates exactly one food item");
    assert.equal(await countAt(strip, "food", 50), 1, "native Enter places food at the normalized center");
    assert.match((await status.textContent()) || "", /food|feed|dog/i, "the accepted keyboard feed reports a meaningful live status");
    const reducedMotion = await strip.locator("[data-pet='dog']").evaluate(element => {
      const style = getComputedStyle(element);
      return {enabled: matchMedia("(prefers-reduced-motion: reduce)").matches, duration: style.animationDuration, iterations: style.animationIterationCount, transitionDuration: style.transitionDuration, state: element.getAttribute("data-pet-state")};
    });
    assert.equal(reducedMotion.enabled, true, "the reduced-motion browser preference reaches the pet strip");
    assert.match(reducedMotion.state || "", /^(idle|running|eating)$/, "reduced motion preserves the dog’s interaction state");
    assert.ok(reducedMotion.duration === "0s" || reducedMotion.iterations === "1", "reduced motion does not leave a looping dog animation active");
    assert.ok(reducedMotion.transitionDuration.split(",").every(duration => duration.trim() === "0s"), "reduced motion disables the dog's horizontal transition");
    assertCleanDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("CatTasks pet strip processes its horizontal food queue deterministically and keeps pile clocks independent", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(context, page);
    assert.equal(typeof page.clock?.install, "function", "the supplied Playwright must support deterministic browser clocks");
    await page.clock.install({time: new Date("2026-01-01T00:00:00Z")});
    const strip = page.getByLabel(stripName, {exact: true});
    const dog = strip.locator("[data-pet='dog']");
    await strip.waitFor({state: "visible", timeout: 10_000});
    await dog.waitFor({state: "visible", timeout: 10_000});
    await waitForEnabledFeed(strip);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 5_000);
    await page.evaluate(() => {
      window.__petStripTimeline = [];
      const strip = document.querySelector("[aria-label='Pet feeding strip']");
      const clockProbe = document.createElement("span");
      clockProbe.dataset.petClockProbe = "pending";
      strip.append(clockProbe);
      new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "attributes" && record.target === clockProbe && record.attributeName === "data-pet-clock-probe") {
            window.__petStripTimeline.push({type: "clock-probe", at: Date.now()});
          }
          if (record.type === "attributes" && record.target.matches("[data-pet='dog']") && record.attributeName === "data-pet-target") {
            window.__petStripTimeline.push({type: "target", position: record.target.getAttribute("data-pet-target"), at: Date.now()});
          }
          for (const node of record.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && node.matches("[data-pet='pile']")) window.__petStripTimeline.push({type: "pile", position: node.dataset.petPosition, at: Date.now()});
          }
        }
      }).observe(strip, {subtree: true, childList: true, attributes: true, attributeFilter: ["data-pet-target", "data-pet-clock-probe"]});
      const probeStartedAt = Date.now();
      setTimeout(() => clockProbe.dataset.petClockProbe = "fired", 37);
      window.__petStripTimeline.push({type: "clock-probe-scheduled", at: probeStartedAt});
    });
    await page.clock.runFor(100);
    const probe = await petTimeline(page);
    const probeStart = probe.find(event => event.type === "clock-probe-scheduled");
    const probeEvent = probe.find(event => event.type === "clock-probe");
    assert.ok(probeStart && probeEvent, "the timeline observer records its scheduled-clock anchor");
    assert.equal(probeEvent.at - probeStart.at, 37, "runFor(100) delivers the MutationObserver anchor at its scheduled virtual time");

    const first = await dropAt(page, strip, 0.72);
    await advanceUntil(page, () => dogTargets(dog, first), "first food becomes active");
    const stripBox = await strip.boundingBox();
    assert.ok(stripBox && stripBox.width > 0, "the running strip retains measurable pointer geometry");
    const nearX = stripBox.x + Math.round(stripBox.width * 0.64);
    const near = await dropAtX(page, strip, nearX, stripBox.y + stripBox.height / 2);
    const far = await dropAt(page, strip, 0.30);
    assert.ok(Math.abs(near - first) < Math.abs(far - first), "the candidate near food is measurably closer than the known farther food");
    assert.equal(await dogTargets(dog, first), true, "an active target remains stable while new food is queued");

    await advanceUntil(page, () => dog.getAttribute("data-pet-state").then(state => state === "eating"), "dog reaches the first food");
    assert.equal((await foodPositions(strip)).includes(first), false, "a food is removed only after the dog arrives and begins eating");
    await advanceUntilObservedTick(page, async () => (await petTimeline(page)).some(event => event.type === "target" && Number(event.position) === near), "the nearest ready food wins after the current meal");
    const nearTargetEvent = (await petTimeline(page)).find(event => event.type === "target" && Number(event.position) === near);
    assert.ok(nearTargetEvent, "the public dog target transition records the first eating completion boundary");
    const mealFinishedAt = nearTargetEvent.at;
    assert.equal(await dogTargets(dog, near), true, "the observed completion boundary leaves the near food as the active target");

    const tieOffset = Math.max(40, Math.floor(stripBox.width * 0.10));
    const tieFirst = await dropAtX(page, strip, nearX - tieOffset, stripBox.y + stripBox.height / 2);
    const tieSecond = await dropAtX(page, strip, nearX + tieOffset, stripBox.y + stripBox.height / 2);
    assert.notEqual(tieFirst, tieSecond, "FIFO candidates occupy distinct observed positions");
    const firstTieDistance = Math.abs(tieFirst - near);
    const secondTieDistance = Math.abs(tieSecond - near);
    assert.ok(Math.abs(firstTieDistance - secondTieDistance) <= 0.001, "equal-distance candidates are derived from the same measured click center and integer pixel offsets");
    assert.equal(await dogTargets(dog, near), true, "new symmetric candidates do not replace the active near target");

    const untilFirstPile = mealFinishedAt + 2_999 - await page.evaluate(() => Date.now());
    assert.ok(untilFirstPile >= 0, "queue progression must not conceal the three-second pile boundary");
    await page.clock.runFor(untilFirstPile);
    assert.equal(await countAt(strip, "pile", first), 0, "no pile appears before the exact three-second meal delay");
    await page.clock.runFor(1);
    assert.equal(await countAt(strip, "pile", first), 1, "the first pile appears exactly three seconds after eating finishes");
    const firstPileEvent = (await petTimeline(page)).find(event => event.type === "pile" && Number(event.position) === first);
    assert.ok(firstPileEvent, "the first pile insertion is observable");
    const pileAppearedAt = firstPileEvent.at;
    assert.equal(pileAppearedAt - mealFinishedAt, 3_000, "the pile clock is anchored to eating completion rather than eating start");

    await advanceUntil(page, async () => (await petTimeline(page)).some(event => event.type === "target" && Number(event.position) === tieFirst), "the first equal-distance food becomes active", 10_000);
    await advanceUntil(page, async () => (await petTimeline(page)).some(event => event.type === "target" && Number(event.position) === tieSecond), "the second equal-distance food becomes active", 10_000);
    const targetOrder = (await petTimeline(page)).filter(event => event.type === "target").map(event => Number(event.position));
    assert.ok(targetOrder.indexOf(tieFirst) < targetOrder.indexOf(tieSecond), "distinct equal-distance foods retain FIFO order");

    await advanceUntil(page, () => countAt(strip, "pile", near).then(count => count === 1), "second completed meal creates its own pile");
    const nearPileEvent = (await petTimeline(page)).find(event => event.type === "pile" && Number(event.position) === near);
    assert.ok(nearPileEvent, "the second pile insertion is observable");
    const nearPileAppearedAt = nearPileEvent.at;
    assert.ok(nearPileAppearedAt > pileAppearedAt, "the later meal owns a distinct later pile clock");
    assert.equal(await countAt(strip, "pile", first), 1, "the first pile remains while the later meal pile is visible");

    const remainingBeforeExpiry = pileAppearedAt + 6_999 - await page.evaluate(() => Date.now());
    assert.ok(remainingBeforeExpiry >= 0, "queue progression must not conceal the first pile expiry boundary");
    await page.clock.runFor(remainingBeforeExpiry);
    assert.equal(await countAt(strip, "pile", first), 1, "the pile survives until its own seven-second lifetime has elapsed");
    await page.clock.runFor(1);
    assert.equal(await countAt(strip, "pile", first), 0, "the first pile and its effects are removed exactly seven seconds after appearance");
    assert.equal(await countAt(strip, "pile", near), 1, "first-pile cleanup does not remove the overlapping later pile");
    assertCleanDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("CatTasks keeps viewport foliage separate from six local pet-strip grasses through responsive scroll and resize", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1536, height: 1024}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(context, page);
    const strip = page.getByLabel(stripName, {exact: true});
    await strip.waitFor({state: "visible", timeout: 10_000});

    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.setAttribute("data-pet-test-spacer", "true");
      spacer.style.height = "1500px";
      document.body.append(spacer);
    });

    const inspect = () => page.evaluate(() => {
      const strip = document.querySelector("[aria-label='Pet feeding strip']");
      if (!strip) throw new Error("pet strip unavailable");
      const findAsset = name => [...document.querySelectorAll("*")].filter(node => getComputedStyle(node).backgroundImage.includes(name));
      const rectangle = node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, position: style.position, pointerEvents: style.pointerEvents, zIndex: style.zIndex};
      };
      const hasFixedAncestor = node => {
        for (let current = node.parentElement; current; current = current.parentElement) {
          if (getComputedStyle(current).position === "fixed") return true;
        }
        return false;
      };
      const parentStyle = getComputedStyle(strip.parentElement);
      return {
        viewport: {width: innerWidth, height: innerHeight, scrollX, scrollY, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth},
        strip: {...rectangle(strip), availableWidth: (strip.parentElement?.getBoundingClientRect().width ?? 0) - parseFloat(parentStyle.paddingInlineStart) - parseFloat(parentStyle.paddingInlineEnd), minBlockSize: getComputedStyle(strip).minBlockSize, maxInlineSize: getComputedStyle(strip).maxInlineSize, borderRadius: getComputedStyle(strip).borderTopLeftRadius},
        grasses: findAsset("grass-").map(node => ({...rectangle(node), inStrip: strip.contains(node)})),
        foliage: ["foliage-top-right.png", "foliage-bottom-left.png", "foliage-bottom-right.png"].map(asset => ({asset, nodes: findAsset(asset).map(node => ({...rectangle(node), fixedAncestor: hasFixedAncestor(node)}))})),
      };
    });

    let previousFoliage = null;
    for (const [width, height] of [[1536, 1024], [780, 900], [390, 844], [780, 900], [1536, 1024]]) {
      await page.setViewportSize({width, height});
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await strip.scrollIntoViewIfNeeded();
      const beforeScroll = await inspect();
      assert.equal(beforeScroll.viewport.scrollWidth, beforeScroll.viewport.clientWidth, `${width}px has no horizontal document overflow`);
      assert.equal(beforeScroll.grasses.length, 6, `${width}px renders exactly six grass assets`);
      assert.ok(beforeScroll.grasses.every(grass => grass.inStrip), `${width}px keeps every grass element inside PetStrip`);
      assert.equal(new Set(beforeScroll.grasses.map(grass => Math.round(grass.left))).size, 6, `${width}px keeps each grass at a distinct inline position`);
      assert.ok(new Set(beforeScroll.grasses.map(grass => Math.round(grass.top))).size > 1, `${width}px keeps grass vertically staggered`);
      assert.ok(beforeScroll.grasses.every(grass => grass.pointerEvents === "none"), `${width}px grass is pointer inert`);
      assert.ok(parseFloat(beforeScroll.strip.minBlockSize) >= 64, `${width}px retains at least the approved 64px frame height minimum`);
      assert.equal(beforeScroll.strip.maxInlineSize, "1428px", `${width}px retains the 1428px frame maximum`);
      assert.equal(beforeScroll.strip.borderRadius, "32px", `${width}px retains the 32px frame radius`);
      assert.ok(beforeScroll.strip.height >= 64, `${width}px frame height honors its minimum`);
      assert.ok(Math.abs(beforeScroll.strip.width - Math.min(1428, beforeScroll.strip.availableWidth)) <= 1, `${width}px frame fills its available inline width within its maximum`);
      assert.equal(beforeScroll.foliage.length, 3, `${width}px reads all three foliage asset kinds`);
      assert.ok(beforeScroll.foliage.every(({nodes}) => nodes.length === 1 && nodes[0].pointerEvents === "none" && nodes[0].fixedAncestor), `${width}px foliage stays in one fixed pointer-inert viewport decoration per corner`);
      const topBranch = beforeScroll.foliage[0].nodes[0];
      assert.ok(topBranch.top < 0 || topBranch.right > width, `${width}px top branch extends beyond a viewport edge to hide its source endpoint`);

      for (const grass of beforeScroll.grasses) {
        const hit = await page.evaluate(({x, y}) => {
          const target = document.elementFromPoint(x, y);
          return target?.getAttribute("aria-label");
        }, {x: grass.left + grass.width / 2, y: grass.top + grass.height / 2});
        assert.equal(hit, "Feed pet", `${width}px grass cannot intercept the feed control`);
      }

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      const afterScroll = await inspect();
      assert.ok(afterScroll.viewport.scrollY > 0, `${width}px scenario reaches a real scroll position`);
      assert.deepEqual(afterScroll.foliage.map(({asset, nodes}) => ({asset, left: nodes[0].left, top: nodes[0].top})), beforeScroll.foliage.map(({asset, nodes}) => ({asset, left: nodes[0].left, top: nodes[0].top})), `${width}px foliage remains viewport-anchored while the document scrolls`);
      if (previousFoliage) assert.equal(afterScroll.foliage.length, previousFoliage.length, `${width}px reverse resize retains every foliage asset kind`);
      previousFoliage = afterScroll.foliage;
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    assertCleanDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});
