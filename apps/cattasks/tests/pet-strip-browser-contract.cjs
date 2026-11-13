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

async function prepare(context, page, fixtureCatalog = catalog) {
  const diagnostics = {console: [], page: [], request: [], response: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.request.push(`${request.method()} ${request.url()}`));
  page.on("response", response => {
    if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`);
  });
  await context.route("**/task-catalog.v1.json", route => route.fulfill({contentType: "application/json", body: JSON.stringify(fixtureCatalog)}));
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
  await strip.scrollIntoViewIfNeeded();
  const box = await strip.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, "the pet strip must expose a visible pointer target");
  const y = box.y + box.height / 2;
  assert.ok(y >= 0 && y <= page.viewportSize().height, "the measured pet-strip pointer midpoint must be inside the viewport");
  return dropAtX(page, strip, box.x + Math.round(box.width * ratio), y);
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

async function waitForDogState(dog, state, timeout = 10_000) {
  await dog.evaluate((element, expected) => new Promise((resolve, reject) => {
    const deadline = performance.now() + 5_000;
    const check = () => {
      if (element.getAttribute("data-pet-state") === expected) return resolve();
      if (performance.now() >= deadline) return reject(new Error(`dog never reached ${expected}`));
      requestAnimationFrame(check);
    };
    check();
  }), state, {timeout});
}

async function sampleRenderedTravel(page, dog, start) {
  await page.evaluate(() => { window.__petStripMotion = []; });
  await dog.evaluate(element => {
    const samples = window.__petStripMotion;
    let collecting = false;
    let ended = false;
    const sample = () => {
      if (!ended) {
        const rect = element.getBoundingClientRect();
        samples.push({type: "frame", at: performance.now(), left: rect.left, right: rect.right});
        requestAnimationFrame(sample);
      }
    };
    element.addEventListener("transitionrun", event => {
      if (!['left', 'inset-inline-start'].includes(event.propertyName)) return;
      collecting = true;
      samples.push({type: "run", at: performance.now()});
      requestAnimationFrame(sample);
    }, {once: true});
    element.addEventListener("transitionend", event => {
      if (!['left', 'inset-inline-start'].includes(event.propertyName) || !collecting) return;
      ended = true;
      samples.push({type: "end", at: performance.now()});
    }, {once: true});
  });
  await start();
  await dog.evaluate(() => new Promise((resolve, reject) => {
    const deadline = performance.now() + 5_000;
    const check = () => {
      const events = window.__petStripMotion || [];
      if (events.some(event => event.type === "end")) return resolve();
      if (performance.now() >= deadline) return reject(new Error("dog transition did not end"));
      requestAnimationFrame(check);
    };
    check();
  }));
  return page.evaluate(() => window.__petStripMotion);
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
      const pileIds = new WeakMap();
      let nextPileId = 0;
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
            if (node.nodeType !== Node.ELEMENT_NODE || !node.matches("[data-pet='pile']")) continue;
            const pile = node.getBoundingClientRect();
            const dogNode = strip.querySelector("[data-pet='dog']");
            const dog = dogNode.getBoundingClientRect();
            const id = `pile-${++nextPileId}`;
            pileIds.set(node, id);
            window.__petStripTimeline.push({
              type: "pile",
              id,
              at: Date.now(),
              direction: dogNode.dataset.petDirection,
              pile: {left: pile.left, right: pile.right, top: pile.top, bottom: pile.bottom, width: pile.width, height: pile.height},
              dog: {left: dog.left, right: dog.right, top: dog.top, bottom: dog.bottom, width: dog.width, height: dog.height},
            });
          }
          for (const node of record.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && node.matches("[data-pet='pile']")) window.__petStripTimeline.push({type: "pile-removed", id: pileIds.get(node), at: Date.now()});
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
    assert.equal((await petTimeline(page)).filter(event => event.type === "pile").length, 0, "no pile is inserted before the exact three-second meal delay");
    await page.clock.runFor(1);
    const firstPileEvent = (await petTimeline(page)).find(event => event.type === "pile");
    assert.ok(firstPileEvent, "the first pile insertion is observable");
    const pileAppearedAt = firstPileEvent.at;
    assert.equal(pileAppearedAt - mealFinishedAt, 3_000, "the pile clock is anchored to eating completion rather than eating start");
    assert.ok(firstPileEvent.pile.width <= 20 && firstPileEvent.pile.height <= 18, "the inserted pile is no larger than the approved 20 by 18 CSS pixels");
    assert.ok(firstPileEvent.pile.left >= stripBox.x && firstPileEvent.pile.right <= stripBox.x + stripBox.width, "the inserted pile remains inside the strip at birth");
    const overlapsDogAtBirth = firstPileEvent.pile.left < firstPileEvent.dog.right && firstPileEvent.pile.right > firstPileEvent.dog.left && firstPileEvent.pile.top < firstPileEvent.dog.bottom && firstPileEvent.pile.bottom > firstPileEvent.dog.top;
    assert.equal(overlapsDogAtBirth, false, "the rendered pile does not overlap the rendered dog at birth");
    if (firstPileEvent.direction === "right") assert.ok(firstPileEvent.pile.right + 4 <= firstPileEvent.dog.left, "a right-facing dog leaves the pile behind its left rear with the required gap");
    else assert.ok(firstPileEvent.pile.left >= firstPileEvent.dog.right + 4, "a left-facing dog leaves the pile behind its right rear with the required gap");
    const firstPile = strip.locator("[data-pet='pile']").first();
    const frozenFirstPile = await firstPile.boundingBox();
    assert.ok(frozenFirstPile, "the inserted pile exposes a rendered rect");

    await advanceUntil(page, async () => (await petTimeline(page)).some(event => event.type === "target" && Number(event.position) === tieFirst), "the first equal-distance food becomes active", 10_000);
    await advanceUntil(page, async () => (await petTimeline(page)).some(event => event.type === "target" && Number(event.position) === tieSecond), "the second equal-distance food becomes active", 10_000);
    const targetOrder = (await petTimeline(page)).filter(event => event.type === "target").map(event => Number(event.position));
    assert.ok(targetOrder.indexOf(tieFirst) < targetOrder.indexOf(tieSecond), "distinct equal-distance foods retain FIFO order");

    await advanceUntil(page, async () => (await petTimeline(page)).filter(event => event.type === "pile").length === 2, "second completed meal creates its own pile");
    const pileEvents = (await petTimeline(page)).filter(event => event.type === "pile");
    const nearPileEvent = pileEvents[1];
    assert.ok(nearPileEvent, "the second pile insertion is observable");
    const nearPileAppearedAt = nearPileEvent.at;
    assert.ok(nearPileAppearedAt > pileAppearedAt, "the later meal owns a distinct later pile clock");
    assert.equal(await strip.locator("[data-pet='pile']").count(), 2, "the first pile remains while the later meal pile is visible");
    const afterLaterMovement = await firstPile.boundingBox();
    assert.ok(afterLaterMovement, "the original pile remains rendered while later meals run");
    assert.ok(Math.abs(afterLaterMovement.x - frozenFirstPile.x) <= 1 && Math.abs(afterLaterMovement.y - frozenFirstPile.y) <= 1, "the original pile stays at its frozen birth anchor while the dog later moves");

    const remainingBeforeExpiry = pileAppearedAt + 6_999 - await page.evaluate(() => Date.now());
    assert.ok(remainingBeforeExpiry >= 0, "queue progression must not conceal the first pile expiry boundary");
    await page.clock.runFor(remainingBeforeExpiry);
    assert.equal((await petTimeline(page)).filter(event => event.type === "pile-removed" && event.id === firstPileEvent.id).length, 0, "the first pile survives until its own seven-second lifetime has elapsed");
    await page.clock.runFor(1);
    assert.equal((await petTimeline(page)).filter(event => event.type === "pile-removed" && event.id === firstPileEvent.id).length, 1, "the same first pile node is removed exactly seven seconds after appearance");
    assert.equal((await petTimeline(page)).filter(event => event.type === "pile-removed" && event.id === nearPileEvent.id).length, 0, "the later pile node retains its independent lifetime");
    assert.ok(await strip.locator("[data-pet='pile']").count() >= 1, "first-pile cleanup does not remove later meal piles");
    assertCleanDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("CatTasks renders unified near and far pet travel on the measured safe track", {timeout: 75_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  try {
    for (const viewport of [{width: 390, height: 844}, {width: 780, height: 900}, {width: 1536, height: 1024}]) {
      const context = await browser.newContext({viewport});
      const page = await context.newPage();
      try {
        const diagnostics = await prepare(context, page);
        const strip = page.getByLabel(stripName, {exact: true});
        const dog = strip.locator("[data-pet='dog']");
        await strip.waitFor({state: "visible", timeout: 10_000});
        await dog.waitFor({state: "visible", timeout: 10_000});
        await waitForEnabledFeed(strip);
        const box = await strip.boundingBox();
        const track = strip.locator(":scope > span[aria-hidden='true']").first();
        const trackBox = await track.boundingBox();
        assert.ok(trackBox && trackBox.width > 114 && box && box.width >= trackBox.width + 114, `${viewport.width}px track is wider than 114px and reserves the required 57px inset at both strip edges`);
        const clickAtLogical = async (logical, roundCoordinate = Math.round) => {
          await strip.scrollIntoViewIfNeeded();
          const currentTrack = await track.boundingBox();
          const currentStrip = await strip.boundingBox();
          assert.ok(currentTrack && currentStrip, "the visible strip exposes current safe-track coordinates");
          return {x: roundCoordinate(currentTrack.x + (currentTrack.width * logical / 100)), y: currentStrip.y + currentStrip.height / 2};
        };
        const dropAtLogical = async (logical, roundCoordinate = Math.round) => {
          const point = await clickAtLogical(logical, roundCoordinate);
          return dropAtX(page, strip, point.x, point.y);
        };
        const startPosition = await dropAtLogical(10, Math.floor);
        await waitForDogState(dog, "eating");
        await page.waitForTimeout(650);
        await waitForDogState(dog, "idle");

        let nearPosition;
        const near = await sampleRenderedTravel(page, dog, async () => { nearPosition = await dropAtLogical(20); });
        const nearCssDuration = await dog.evaluate(element => getComputedStyle(element).transitionDuration);
        await waitForDogState(dog, "eating");
        await page.waitForTimeout(650);
        await waitForDogState(dog, "idle");
        const resetPosition = await dropAtLogical(10, Math.floor);
        assert.equal(resetPosition, startPosition, `${viewport.width}px reset reuses the same physical start pixel`);
        await waitForDogState(dog, "eating");
        await page.waitForTimeout(650);
        await waitForDogState(dog, "idle");
        let farPosition;
        const far = await sampleRenderedTravel(page, dog, async () => { farPosition = await dropAtLogical(90, Math.ceil); });
        const summarize = (events, label) => {
          const run = events.find(event => event.type === "run");
          const end = events.find(event => event.type === "end");
          const frames = events.filter(event => event.type === "frame");
          assert.ok(run && end && frames.length >= 2, `${label} reaches a real transition and rAF rect samples`);
          const moved = Math.abs(frames.at(-1).left - frames[0].left);
          assert.ok(moved > 1, `${label} changes the rendered dog rect`);
          return {duration: end.at - run.at, distance: moved};
        };
        const nearResult = summarize(near, `${viewport.width}px near route`);
        const farResult = summarize(far, `${viewport.width}px far route`);
        const durations = await dog.evaluate(element => getComputedStyle(element).transitionDuration.split(",").map(value => value.trim()));
        const cssDuration = value => value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1_000;
        const farCssDuration = cssDuration(durations[0]);
        assert.ok(cssDuration(nearCssDuration) >= 480, `${viewport.width}px near CSS duration honors the 480ms floor`);
        assert.ok(nearResult.duration >= 400, `${viewport.width}px near route honors the 480ms floor within 80ms observation tolerance`);
        const expectedFar = Math.max(1400, Math.round(farResult.distance / 0.28));
        const pointerPrecision = (2 * 100) / trackBox.width;
        assert.ok(Math.abs(startPosition - 10) <= pointerPrecision, `${viewport.width}px start pointer position remains within one physical pixel of logical 10`);
        assert.ok(Math.abs(nearPosition - 20) <= pointerPrecision, `${viewport.width}px near pointer position remains within one physical pixel of logical 20`);
        assert.ok(Math.abs(farPosition - 90) <= pointerPrecision, `${viewport.width}px far pointer position remains within one physical pixel of logical 90`);
        assert.ok(Math.abs(farPosition - startPosition) >= 80, `${viewport.width}px outward pixel rounding preserves the required nominal 10-to-90 logical distance`);
        assert.ok(Math.abs(nearPosition - startPosition) > 0, `${viewport.width}px near pointer action produces a distinct normalized position`);
        assert.ok(farCssDuration >= expectedFar, `${viewport.width}px far CSS duration uses the published unified formula (expected at least ${expectedFar}ms, observed ${farCssDuration}ms)`);
        assert.ok(farResult.duration >= expectedFar - 80, `${viewport.width}px far route honors the unified rendered-distance pace within 80ms tolerance`);
        assert.ok(farResult.duration > nearResult.duration, `${viewport.width}px far route lasts longer than the near route`);
        await waitForDogState(dog, "eating");
        await page.waitForTimeout(650);
        await waitForDogState(dog, "idle");
        await page.evaluate(() => { window.__petStripZeroTransition = false; document.querySelector("[data-pet='dog']").addEventListener("transitionrun", () => { window.__petStripZeroTransition = true; }, {once: true}); });
        const zeroPoint = await clickAtLogical(90, Math.ceil);
        await page.mouse.click(zeroPoint.x, zeroPoint.y);
        await page.waitForTimeout(40);
        assert.equal(await page.evaluate(() => window.__petStripZeroTransition), false, `${viewport.width}px zero-distance route does not start a transition`);
        assertCleanDiagnostics(diagnostics);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test("CatTasks keeps viewport foliage separate from responsive local pet-strip grasses through scroll and resize", {timeout: 45_000}, async () => {
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
      const track = strip.querySelector("[aria-hidden='true']");
      if (!track) throw new Error("pet strip track unavailable");
      const findAsset = name => [...document.querySelectorAll("*")].filter(node => getComputedStyle(node).backgroundImage.includes(name));
      const viewportDecoration = document.querySelector("[class*='viewportDecoration']");
      const decorationLayer = document.querySelector("[class*='decorationLayer']");
      if (!viewportDecoration || !decorationLayer) throw new Error("dashboard viewport decorations unavailable");
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
        meadow: {...rectangle(viewportDecoration), backgroundImage: getComputedStyle(viewportDecoration).backgroundImage, backgroundPosition: getComputedStyle(viewportDecoration).backgroundPosition, backgroundRepeat: getComputedStyle(viewportDecoration).backgroundRepeat, backgroundSize: getComputedStyle(viewportDecoration).backgroundSize},
        light: {display: getComputedStyle(decorationLayer).display},
        strip: {...rectangle(strip), availableWidth: (strip.parentElement?.getBoundingClientRect().width ?? 0) - parseFloat(parentStyle.paddingInlineStart) - parseFloat(parentStyle.paddingInlineEnd), minBlockSize: getComputedStyle(strip).minBlockSize, maxInlineSize: getComputedStyle(strip).maxInlineSize, borderRadius: getComputedStyle(strip).borderTopLeftRadius},
        track: rectangle(track),
        grassNodes: findAsset("grass-").length,
        grasses: findAsset("grass-").filter(node => getComputedStyle(node).display !== "none").map(node => ({...rectangle(node), inStrip: strip.contains(node), backgroundImage: getComputedStyle(node).backgroundImage})),
        foliage: ["foliage-top-right.png", "foliage-bottom-left.png", "foliage-bottom-right.png"].map(asset => ({asset, nodes: findAsset(asset).map(node => ({...rectangle(node), display: getComputedStyle(node).display, fixedAncestor: hasFixedAncestor(node)}))})),
      };
    });

    const assertDesktopMeadowAsset = () => page.evaluate(async () => {
      const image = new Image();
      image.src = "/cattasks/desktop-meadow.png";
      await new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, {once: true});
        image.addEventListener("error", () => reject(new Error("desktop meadow asset failed to load")), {once: true});
      });
      return {currentSrc: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight};
    });

    let previousFoliage = null;
    const desktopGrasses = [
      {asset: "grass-01.png", inlineStart: 0.08},
      {asset: "grass-02.png", inlineStart: 0.23},
      {asset: "grass-03.png", inlineStart: 0.39},
      {asset: "grass-01.png", inlineStart: 0.57},
      {asset: "grass-02.png", inlineStart: 0.74},
      {asset: "grass-03.png", inlineStart: 0.90},
    ];
    const mobileGrasses = [
      {asset: "grass-02.png", inlineStart: 0.23},
      {asset: "grass-01.png", inlineStart: 0.57},
      {asset: "grass-03.png", inlineStart: 0.90},
    ];
    for (const [width, height] of [[1150, 900], [1151, 900], [1150, 900], [1536, 1024], [780, 900], [601, 900], [600, 900], [500, 900], [390, 844], [320, 844], [601, 900], [780, 900], [1536, 1024]]) {
      await page.setViewportSize({width, height});
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await strip.scrollIntoViewIfNeeded();
      const beforeScroll = await inspect();
      assert.equal(beforeScroll.viewport.scrollWidth, beforeScroll.viewport.clientWidth, `${width}px has no horizontal document overflow`);
      const expectedGrasses = width <= 600 ? mobileGrasses : desktopGrasses;
      assert.equal(beforeScroll.grassNodes, 6, `${width}px retains all six local grass anchors`);
      assert.equal(beforeScroll.grasses.length, expectedGrasses.length, `${width}px renders the approved visible grass density`);
      assert.ok(beforeScroll.grasses.every(grass => grass.inStrip), `${width}px keeps every grass element inside PetStrip`);
      assert.equal(new Set(beforeScroll.grasses.map(grass => Math.round(grass.left))).size, expectedGrasses.length, `${width}px keeps each visible grass at a distinct inline position`);
      assert.ok(new Set(beforeScroll.grasses.map(grass => Math.round(grass.top))).size > 1, `${width}px keeps grass vertically staggered`);
      assert.ok(beforeScroll.grasses.every(grass => grass.pointerEvents === "none"), `${width}px grass is pointer inert`);
      for (const [index, expected] of expectedGrasses.entries()) {
        const grass = beforeScroll.grasses[index];
        assert.ok(grass.backgroundImage.includes(expected.asset), `${width}px renders ${expected.asset} in the approved visible order`);
        assert.ok(Math.abs((grass.left - beforeScroll.track.left) / beforeScroll.track.width - expected.inlineStart) <= 0.02, `${width}px keeps ${expected.asset} at its approved inline position`);
      }
      assert.ok(parseFloat(beforeScroll.strip.minBlockSize) >= 64, `${width}px retains at least the approved 64px frame height minimum`);
      assert.equal(beforeScroll.strip.maxInlineSize, "1428px", `${width}px retains the 1428px frame maximum`);
      assert.equal(beforeScroll.strip.borderRadius, "32px", `${width}px retains the 32px frame radius`);
      assert.ok(beforeScroll.strip.height >= 64, `${width}px frame height honors its minimum`);
      assert.ok(Math.abs(beforeScroll.strip.width - Math.min(1428, beforeScroll.strip.availableWidth)) <= 1, `${width}px frame fills its available inline width within its maximum`);
      const expectsDesktopMeadow = width >= 1151;
      assert.equal(beforeScroll.meadow.position, "fixed", `${width}px viewport decoration remains fixed`);
      assert.equal(beforeScroll.meadow.pointerEvents, "none", `${width}px viewport decoration remains pointer inert`);
      if (expectsDesktopMeadow) {
        assert.ok(beforeScroll.meadow.backgroundImage.includes("desktop-meadow.png"), `${width}px uses the approved desktop meadow background`);
        assert.equal(beforeScroll.meadow.backgroundPosition, "50% 50%", `${width}px centers the desktop meadow background`);
        assert.equal(beforeScroll.meadow.backgroundRepeat, "no-repeat", `${width}px does not tile the desktop meadow background`);
        assert.equal(beforeScroll.meadow.backgroundSize, "cover", `${width}px covers the desktop viewport with the meadow background`);
        assert.equal(beforeScroll.light.display, "none", `${width}px hides the retired desktop light decoration`);
        assert.ok(beforeScroll.foliage.every(({nodes}) => nodes.length === 1 && nodes[0].display === "none"), `${width}px hides every retired corner foliage decoration`);
        const meadowAsset = await assertDesktopMeadowAsset();
        assert.ok(meadowAsset.currentSrc.endsWith("/cattasks/desktop-meadow.png"), `${width}px loads the published desktop meadow asset`);
        assert.deepEqual({width: meadowAsset.width, height: meadowAsset.height}, {width: 1779, height: 884}, `${width}px desktop meadow asset retains its approved dimensions`);
      } else {
        assert.equal(beforeScroll.meadow.backgroundImage, "none", `${width}px keeps the desktop meadow background off below its breakpoint`);
        assert.notEqual(beforeScroll.light.display, "none", `${width}px retains the local light decoration below the desktop breakpoint`);
        assert.equal(beforeScroll.foliage.length, 3, `${width}px reads all three foliage asset kinds`);
        assert.ok(beforeScroll.foliage.every(({nodes}) => nodes.length === 1 && nodes[0].display !== "none" && nodes[0].pointerEvents === "none" && nodes[0].fixedAncestor), `${width}px foliage stays in one visible fixed pointer-inert viewport decoration per corner`);
        const topBranch = beforeScroll.foliage[0].nodes[0];
        assert.ok(topBranch.top < 0 || topBranch.right > width, `${width}px top branch extends beyond a viewport edge to hide its source endpoint`);
      }

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
      if (expectsDesktopMeadow) {
        assert.deepEqual({left: afterScroll.meadow.left, top: afterScroll.meadow.top, width: afterScroll.meadow.width, height: afterScroll.meadow.height}, {left: beforeScroll.meadow.left, top: beforeScroll.meadow.top, width: beforeScroll.meadow.width, height: beforeScroll.meadow.height}, `${width}px desktop meadow remains viewport-anchored while the document scrolls`);
      } else {
        assert.deepEqual(afterScroll.foliage.map(({asset, nodes}) => ({asset, left: nodes[0].left, top: nodes[0].top})), beforeScroll.foliage.map(({asset, nodes}) => ({asset, left: nodes[0].left, top: nodes[0].top})), `${width}px foliage remains viewport-anchored while the document scrolls`);
      }
      if (previousFoliage && !expectsDesktopMeadow) assert.equal(afterScroll.foliage.length, previousFoliage.length, `${width}px reverse resize retains every foliage asset kind`);
      previousFoliage = afterScroll.foliage;
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.setViewportSize({width: 1536, height: 1024});
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor({state: "visible", timeout: 10_000});
    const catalogue = await inspect();
    assert.ok(catalogue.meadow.backgroundImage.includes("desktop-meadow.png"), "desktop catalogue shares the approved meadow background");
    assert.equal(catalogue.meadow.position, "fixed", "desktop catalogue meadow remains fixed");
    assert.equal(catalogue.meadow.pointerEvents, "none", "desktop catalogue meadow remains pointer inert");
    assert.equal(catalogue.light.display, "none", "desktop catalogue hides the retired light decoration");
    assert.ok(catalogue.foliage.every(({nodes}) => nodes.length === 1 && nodes[0].display === "none"), "desktop catalogue hides every retired corner foliage decoration");
    assertCleanDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("CatTasks keeps the 1151px workspace editor and rendered Output above the pet strip", {timeout: 30_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1151, height: 700}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(context, page);
    const strip = page.getByLabel(stripName, {exact: true});
    const editor = page.getByLabel("User JavaScript code");
    const output = page.locator("section[aria-labelledby='taskOutputHeading']");
    await Promise.all([
      strip.waitFor({state: "visible", timeout: 10_000}),
      editor.waitFor({state: "visible", timeout: 10_000}),
      output.waitFor({state: "visible", timeout: 10_000}),
    ]);
    const geometry = await page.evaluate(() => {
      const pick = selector => document.querySelector(selector);
      const strip = pick("[aria-label='Pet feeding strip']");
      const workspace = [...document.querySelectorAll("[class*='taskContentPanelContainer']")]
        .find(node => getComputedStyle(node).display !== "none");
      const editor = pick("[class*='codeEditorFrame']");
      const output = pick("section[aria-labelledby='taskOutputHeading']");
      if (!strip || !workspace || !editor || !output) throw new Error("workspace geometry anchors unavailable");
      const rect = node => { const box = node.getBoundingClientRect(); return {top: box.top, bottom: box.bottom, height: box.height}; };
      return {strip: rect(strip), workspace: rect(workspace), editor: rect(editor), output: rect(output)};
    });
    assert.ok(geometry.editor.height >= 240, `the rendered Monaco editor keeps its 240px minimum: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.output.height >= 212, `the rendered Output keeps its 212px minimum: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.workspace.bottom <= geometry.strip.top, `the visible workspace ends before the PetStrip rather than being covered by it: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.output.bottom <= geometry.strip.top, `the rendered Output ends before the PetStrip rather than being covered by it: ${JSON.stringify(geometry)}`);
    assertCleanDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("CatTasks lets a tall 1305px catalogue paginate to its final inert row above the pet strip and open it", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1305, height: 1132}});
  const page = await context.newPage();
  const tallCatalog = {version: 1, tasks: Array.from({length: 18}, (_, index) => ({
    id: `pet-strip-row-${index + 1}`,
    title: `Inert catalogue row ${index + 1}`,
    description: `Safe inert row ${index + 1} exists only to exercise paginated catalogue navigation.`,
    entryPoint: "echo",
    starterCode: "function echo(value) { return value; }",
    solution: "function echo(value) { return value; }",
    tests: [{args: [`row-${index + 1}`], expected: `row-${index + 1}`}],
  }))};
  try {
    const diagnostics = await prepare(context, page, tallCatalog);
    await page.getByRole("button", {name: "All tasks", exact: true}).click();
    const strip = page.getByLabel(stripName, {exact: true});
    const list = page.locator("section[aria-labelledby='taskListTitle']");
    const filters = page.getByLabel("Task filters", {exact: true});
    const pageNavigation = page.getByRole("navigation", {name: "Task pages", exact: true});
    const lastOpen = page.getByRole("button", {name: "Open Inert catalogue row 18", exact: true});
    await Promise.all([
      strip.waitFor({state: "visible", timeout: 10_000}),
      list.waitFor({state: "visible", timeout: 10_000}),
      filters.waitFor({state: "visible", timeout: 10_000}),
      pageNavigation.waitFor({state: "visible", timeout: 10_000}),
    ]);
    const initialGeometry = await page.evaluate(() => {
      const strip = document.querySelector("[aria-label='Pet feeding strip']");
      const catalogue = document.querySelector("[class*='catalogueMain']");
      const list = document.querySelector("section[aria-labelledby='taskListTitle']");
      const filters = document.querySelector("[aria-label='Task filters']");
      if (!strip || !catalogue || !list || !filters) throw new Error("catalogue geometry anchors unavailable");
      const rect = node => { const box = node.getBoundingClientRect(); return {top: box.top, bottom: box.bottom, height: box.height}; };
      return {strip: rect(strip), catalogue: rect(catalogue), filters: rect(filters), list: rect(list)};
    });
    assert.ok(initialGeometry.catalogue.bottom <= initialGeometry.strip.top, `the catalogue ends before the PetStrip rather than continuing behind it: ${JSON.stringify(initialGeometry)}`);
    assert.ok(initialGeometry.filters.bottom <= initialGeometry.strip.top, `the catalogue filters end before the PetStrip rather than continuing behind it: ${JSON.stringify(initialGeometry)}`);
    assert.ok(initialGeometry.list.bottom <= initialGeometry.strip.top, `the catalogue task list ends before the PetStrip rather than continuing behind it: ${JSON.stringify(initialGeometry)}`);
    assert.equal(await lastOpen.count(), 0, "the final catalogue action is not rendered until its pagination page is selected");
    const thirdPage = pageNavigation.getByRole("button", {name: "3", exact: true});
    await thirdPage.click();
    await lastOpen.waitFor({state: "visible", timeout: 10_000});
    assert.equal(await thirdPage.getAttribute("aria-current"), "page", "the real third pagination page is active before the final row is inspected");
    const scroll = await page.evaluate(() => ({scrollY, listScrollTop: document.querySelector("section[aria-labelledby='taskListTitle']")?.scrollTop ?? null}));
    assert.equal(scroll.listScrollTop, 0, "the final catalogue action does not rely on a hidden task-list scroll container");
    const lastAction = await lastOpen.boundingBox();
    const stripBox = await strip.boundingBox();
    assert.ok(lastAction && lastAction.y >= 0 && lastAction.y + lastAction.height <= 1132, "pagination exposes the final catalogue action inside the viewport");
    assert.ok(lastAction && stripBox && lastAction.y + lastAction.height <= stripBox.y, "the paginated final catalogue action remains above the PetStrip");
    const hit = await lastOpen.evaluate(node => {
      const box = node.getBoundingClientRect();
      const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return Boolean(target && node.contains(target));
    });
    assert.equal(hit, true, "the final catalogue action is hit-testable rather than masked by the PetStrip");
    await lastOpen.click();
    await page.getByRole("button", {name: "All tasks", exact: true}).waitFor({state: "visible", timeout: 10_000});
    await page.getByText("Safe inert row 18 exists only to exercise paginated catalogue navigation.", {exact: true}).waitFor({state: "visible"});
    assertCleanDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});
