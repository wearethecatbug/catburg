const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.SAFE_CAT_BASE_URL || "http://127.0.0.1:3213";
const viewportCases = [
  [1175, 1098], [1440, 900], [768, 900], [390, 844], [320, 844], [1280, 600],
];

async function withSession(viewport, options, executeCase) {
  let browser;
  let context;
  let page;
  const monitorFailures = [];
  let caseFailure;
  try {
    browser = await playwright.chromium.launch({ channel: "chrome", headless: true });
    context = await browser.newContext({
      viewport,
      colorScheme: options.colorScheme || "light",
      hasTouch: Boolean(options.hasTouch),
      isMobile: Boolean(options.hasTouch),
    });
    if (options.random !== undefined) {
      await context.addInitScript((randomValue) => { Math.random = () => randomValue; }, options.random);
    }
    page = await context.newPage();
    if (options.beforeGoto) await options.beforeGoto(page);
    page.on("pageerror", (error) => monitorFailures.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !options.isExpectedConsoleFailure?.(message.text()) && !options.isExpectedLocalFailure?.(message.text())) monitorFailures.push(`console ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      // A superseded responsive image request may be cancelled while the cat changes state.
      const requestUrl = new URL(request.url());
      const isSupersededSafeCatImage = request.failure()?.errorText === "net::ERR_ABORTED"
        && request.resourceType() === "image"
        && requestUrl.origin === new URL(baseUrl).origin
        && requestUrl.pathname === "/_next/image"
        && requestUrl.searchParams.get("url")?.startsWith("/safe-cat/");
      if (isSupersededSafeCatImage) return;
      if (request.url().startsWith(baseUrl) && !options.isExpectedLocalFailure?.(request.url())) monitorFailures.push(`failed ${request.url()}`);
    });
    page.on("response", (response) => {
      if (response.url().startsWith(baseUrl) && response.status() >= 400 && !response.url().endsWith("/favicon.ico") && !options.isExpectedLocalFailure?.(response.url())) {
        monitorFailures.push(`${response.status()} ${response.url()}`);
      }
    });
    const response = await page.goto(new URL(options.route || "/", baseUrl).href, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, "the selected route responds successfully");
    return await executeCase({ page, context, monitorFailures });
  } catch (error) {
    caseFailure = error;
    throw error;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    // Do not replace an already-reached product assertion with a cleanup monitor failure.
    if (!caseFailure) assert.deepEqual(monitorFailures, [], "browser failure monitors stay empty");
  }
}

async function exact(locator, description) {
  assert.equal(await locator.count(), 1, `${description} has exactly one public match`);
  return locator;
}

async function gameControls(page) {
  const controls = {
    instruction: page.getByText("Enter a whole code from 1 to 1000.", { exact: true }),
    code: page.getByLabel("Safe code", { exact: true }),
    submit: page.getByRole("button", { name: "OK", exact: true }),
    newRound: page.getByRole("button", { name: "New game", exact: true }),
    surrender: page.getByRole("button", { name: "Give up", exact: true }),
    hint: page.getByRole("button", { name: "Show hint", exact: true }),
    history: page.getByRole("button", { name: "History", exact: true }),
    cat: page.getByLabel(/^Cat /),
  };
  for (const [description, locator] of Object.entries(controls)) await exact(locator, description);
  return controls;
}

async function openHintDialog(page) {
  const controls = await gameControls(page);
  await controls.hint.click();
  const dialog = page.getByRole("dialog", { name: "Solve a quick math question" });
  const answer = page.locator("#hint-answer");
  await exact(dialog, "math challenge dialog");
  await exact(answer, "math challenge answer input");
  return { ...controls, dialog, answer };
}

function solveVisibleQuestion(questionText) {
  const [, leftText, operator, rightText] = questionText.match(/^(\d+) ([+\-−×÷]) (\d+) =$/) || [];
  assert.ok(leftText && rightText, "the visible question has two operands and an operator");
  const leftOperand = Number(leftText);
  const rightOperand = Number(rightText);
  return ({ "+": leftOperand + rightOperand, "-": leftOperand - rightOperand, "−": leftOperand - rightOperand, "×": leftOperand * rightOperand, "÷": leftOperand / rightOperand })[operator];
}

async function dragHistoryHandle(page, handle, destination) {
  const handleBox = await handle.boundingBox();
  assert.ok(handleBox, "History handle has a visible box");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x, destination.y);
  await page.mouse.up();
}

async function armViewportResizeRender(page) {
  await page.evaluate(() => {
    window.__safeCatResizeRender = false;
    window.addEventListener("resize", () => {
      requestAnimationFrame(() => requestAnimationFrame(() => { window.__safeCatResizeRender = true; }));
    }, { once: true });
  });
}

async function waitForViewportResizeRender(page) {
  await page.waitForFunction(() => window.__safeCatResizeRender === true, undefined, { timeout: 1000 });
  await page.evaluate(() => { delete window.__safeCatResizeRender; });
}

async function waitForStableVisualGeometry(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.complete ? image.decode().catch(() => {}) : new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    })));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function settleViewportAtTop(page) {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

function contrastRatio(foreground, background) {
  function relativeLuminance(color) {
    const channels = color.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number).map((channel) => {
      const normalizedChannel = channel / 255;
      return normalizedChannel <= 0.03928 ? normalizedChannel / 12.92 : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

// Transparent text containers inherit their visual background from the first opaque ancestor.
async function opaqueAncestorBackground(locator) {
  return locator.evaluate((element) => {
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      const backgroundColor = getComputedStyle(ancestor).backgroundColor;
      if (!backgroundColor.startsWith("rgba") || !backgroundColor.endsWith(", 0)")) return backgroundColor;
    }
    return getComputedStyle(document.body).backgroundColor;
  });
}

async function exactHiddenChild(locator, description) {
  const child = locator.locator('[aria-hidden="true"]');
  assert.equal(await child.count(), 1, `${description} has one decorative public layer`);
  return child;
}

function intersects(first, second, gap = 0) {
  return first.x < second.x + second.width + gap
    && first.x + first.width + gap > second.x
    && first.y < second.y + second.height + gap
    && first.y + first.height + gap > second.y;
}

function visibleRotationDegrees(transform) {
  if (transform === "none") return 0;
  const values = transform.match(/matrix\(([^)]+)\)/)?.[1].split(",").map(Number);
  assert.ok(values && values.length === 6, "the visible dial transform is a 2D matrix");
  return (Math.round(Math.atan2(values[1], values[0]) * 180 / Math.PI) + 360) % 360;
}

async function visibleDialAngle(dial) {
  return visibleRotationDegrees(await dial.evaluate((element) => getComputedStyle(element).transform));
}

async function publicAssetPresentation(locator) {
  return locator.evaluate((element) => {
    const image = element instanceof HTMLImageElement ? element : element.querySelector("img");
    if (image) return { reference: image.currentSrc || image.src, fit: getComputedStyle(image).objectFit };
    const renderedElement = [element, ...element.querySelectorAll("*")].find((candidate) => getComputedStyle(candidate).backgroundImage !== "none") || element;
    const style = getComputedStyle(renderedElement);
    return { reference: style.backgroundImage, fit: style.backgroundSize };
  });
}

// Reads the opaque pixels from the public same-origin artwork, then maps them to
// the rendered contain box.  Layout boxes include transparent WebP padding and
// are therefore not evidence of the visible cat/safe contact contract.
async function visibleAlphaBounds(locator) {
  return locator.evaluate(async (element) => {
    const rendered = element instanceof HTMLImageElement ? element : element.querySelector("img");
    const backgroundOwner = rendered ? null : [element, ...element.querySelectorAll("*")].find((candidate) => getComputedStyle(candidate).backgroundImage !== "none");
    if (rendered instanceof HTMLImageElement && (!rendered.complete || !rendered.naturalWidth)) {
      await new Promise((resolve, reject) => { rendered.addEventListener("load", resolve, { once: true }); rendered.addEventListener("error", reject, { once: true }); });
    }
    const source = rendered || await new Promise((resolve, reject) => {
      const url = getComputedStyle(backgroundOwner || element).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
      const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url;
    });
    const rect = (rendered || backgroundOwner || element).getBoundingClientRect();
    const canvas = document.createElement("canvas"); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width; let top = canvas.height; let right = -1; let bottom = -1;
    for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 8) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
    }
    if (right < left) throw new Error("public artwork has no visible alpha pixels");
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const offsetX = rect.x + (rect.width - canvas.width * scale) / 2;
    const offsetY = rect.y + (rect.height - canvas.height * scale) / 2;
    return { x: offsetX + left * scale, y: offsetY + top * scale, width: (right - left + 1) * scale, height: (bottom - top + 1) * scale };
  });
}

// Computed dimensions are the logical component contract.  boundingBox() is
// intentionally reserved for rendered contact/overflow checks because the
// stage can apply a responsive visual scale to the entire game.
async function logicalBox(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      width: Number.parseFloat(style.width),
      height: Number.parseFloat(style.height),
      left: Number.parseFloat(style.left) || 0,
      top: Number.parseFloat(style.top) || 0,
      rendered: rect.toJSON(),
    };
  });
}

function visibleContact(first, second) { return intersects(first, second, 0); }

function titleControlPointY(pathData) {
  const match = pathData?.match(/Q\s*200\s*(-?\d+(?:\.\d+)?)\s*364\s*59/);
  assert.ok(match, "the public title path retains its approved quadratic-curve geometry");
  return Number(match[1]);
}

function approximatelyEqual(actual, expected, tolerance, description) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${description}: expected ${expected} ±${tolerance}, received ${actual}`);
}

async function earnCurrentRoundHints(page, amount) {
  const controls = await gameControls(page);
  for (let count = 0; count < amount; count += 1) {
    await controls.hint.click();
    await visibleQuestionAnswer(page);
  }
  return controls;
}

async function visibleQuestionAnswer(page) {
  const dialog = page.getByRole("dialog", { name: "Solve a quick math question" });
  const question = await dialog.locator("label[for='hint-answer']").innerText();
  const answer = solveVisibleQuestion(question);
  await dialog.locator("#hint-answer").fill(String(answer));
  await page.getByRole("button", { name: "Send answer", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}

async function earnFirstHint(page) {
  const controls = await gameControls(page);
  await controls.hint.click();
  await visibleQuestionAnswer(page);
  return controls;
}

test("deterministic code 42 opens without rendering the secret", async () => {
  await withSession({ width: 1175, height: 1098 }, { random: 0.041 }, async ({ page }) => {
    const controls = await gameControls(page);
    await controls.code.fill("42");
    await controls.submit.click();
    await exact(page.getByLabel("Safe opened", { exact: true }), "opened safe");
    assert.equal(/safe code is 42/i.test(await page.locator("body").innerText()), false);
  });
});

test("abandonment earns no fact and a solved even question announces a fresh next hint", async () => {
  await withSession({ width: 1175, height: 1098 }, { random: 0.041 }, async ({ page }) => {
    const hint = await openHintDialog(page);
    await page.getByRole("button", { name: "Give Up Hint", exact: true }).click();
    assert.equal(await hint.answer.isDisabled(), true);
    assert.equal(await page.getByText(/even|odd/i).count(), 0, "abandonment yields no safe parity fact");
    await page.getByRole("button", { name: "New Hint", exact: true }).click();
    const solvedQuestion = await hint.dialog.locator("label[for='hint-answer']").innerText();
    await hint.answer.fill(String(solveVisibleQuestion(solvedQuestion)));
    await page.getByRole("button", { name: "Send answer", exact: true }).click();
    await exact(page.getByRole("status").getByText("Earned hint: The code is even.", { exact: true }), "immediate earned even fact status");
    await hint.dialog.waitFor({ state: "hidden" });
    await hint.hint.click();
    const freshDialog = await exact(page.getByRole("dialog", { name: "Solve a quick math question" }), "fresh math challenge dialog");
    const freshAnswer = freshDialog.locator("#hint-answer");
    await exact(freshAnswer, "fresh math challenge answer input");
    assert.equal(await freshAnswer.isEnabled(), true, "a later Show hint creates a usable fresh challenge instead of replaying the awarded fact");
  });
});

test("dialog autofocus, operator replacement, tab cycle, Escape opener focus, and Give Up focus transfer", async () => {
  await withSession({ width: 768, height: 900 }, {}, async ({ page }) => {
    const hint = await openHintDialog(page);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "hint-answer", "opening focuses the answer input");
    const close = page.getByRole("button", { name: "Close hint challenge", exact: true });
    const firstOperator = page.getByRole("button", { name: "Addition", exact: true });
    await firstOperator.click();
    assert.equal(await hint.answer.isEnabled(), true, "operator replacement keeps the answer input usable");
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(await hint.dialog.evaluate((element) => element.contains(document.activeElement)), true, "Shift+Tab remains in the dialog");
    await hint.answer.focus();
    await page.keyboard.press("Tab");
    assert.equal(await hint.dialog.evaluate((element) => element.contains(document.activeElement)), true, "Tab remains in the dialog");
    await page.keyboard.press("Escape");
    await hint.dialog.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Show hint", "Escape restores the actual opener");
    await hint.hint.click();
    const giveUp = page.getByRole("button", { name: "Give Up Hint", exact: true });
    await giveUp.focus();
    await giveUp.click();
    assert.equal(await giveUp.isDisabled(), true);
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "New Hint", "Give Up moves focus to enabled New Hint");
  });
});

test("controlled clock rejects obsolete leave callbacks across re-entry, restart, and terminal transitions", async () => {
  await withSession({ width: 1175, height: 1098 }, { random: 0.041 }, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    const controls = await gameControls(page);
    await controls.cat.hover();
    await page.mouse.move(0, 0);
    await page.clock.runFor(100);
    await controls.cat.hover();
    await page.clock.runFor(150);
    await exact(page.getByLabel("Cat hover", { exact: true }), "re-entered cat after obsolete deadline");
    await page.mouse.move(0, 0);
    await controls.newRound.click();
    await controls.cat.hover();
    await page.clock.runFor(250);
    await exact(page.getByLabel("Cat hover", { exact: true }), "new-round hover after old leave deadline");
    await page.mouse.move(0, 0);
    await controls.surrender.click();
    await page.clock.runFor(250);
    await exact(page.getByLabel("Cat surrendered", { exact: true }), "terminal cat after pending leave deadline");
    await page.goto("about:blank");
    await page.clock.runFor(250);
  });
});

test("History anchors eight document pixels below its button and Home restores the anchor", async () => {
  await withSession({ width: 390, height: 844 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    await controls.history.click();
    const panel = page.getByRole("region", { name: "History", exact: true });
    const handle = page.getByRole("button", { name: "Move History", exact: true });
    const [initialPanelBox, historyButtonBox, initialScrollY] = await Promise.all([panel.boundingBox(), controls.history.boundingBox(), page.evaluate(() => scrollY)]);
    approximatelyEqual(initialPanelBox.y + initialScrollY - (historyButtonBox.y + initialScrollY + historyButtonBox.height), 8, 1, "History retains its eight-pixel document anchor within device-pixel rounding");
    await handle.focus();
    await page.keyboard.press("Home");
    const restoredPanelBox = await panel.boundingBox();
    approximatelyEqual(restoredPanelBox.y + await page.evaluate(() => scrollY), initialPanelBox.y + initialScrollY, 1, "Home restores the History document anchor within device-pixel rounding");
  });
});

test("History keyboard movement uses an interior real-drag position", async () => {
  await withSession({ width: 1175, height: 1098 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    await controls.history.click();
    const panel = page.getByRole("region", { name: "History", exact: true });
    const handle = page.getByRole("button", { name: "Move History", exact: true });
    await dragHistoryHandle(page, handle, { x: 400, y: 400 });
    const interiorBox = await panel.boundingBox();
    assert.ok(interiorBox.x > 20 && interiorBox.x + interiorBox.width < 1175 - 20, "drag establishes interior horizontal room");
    await handle.focus();
    await page.keyboard.press("ArrowRight");
    const afterTenPixels = await panel.boundingBox();
    await page.keyboard.press("Shift+ArrowLeft");
    const afterOnePixel = await panel.boundingBox();
    assert.equal(Math.round(afterTenPixels.x - interiorBox.x), 10);
    assert.equal(Math.round(afterTenPixels.x - afterOnePixel.x), 1);
  });
});

test("History mouse and touch dragging, bounds, internal scrolling, reopen, reset, and modal stacking are observable", async () => {
  await withSession({ width: 390, height: 844 }, { random: 0.041 }, async ({ page, context }) => {
    const controls = await gameControls(page);
    for (const guess of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]) { await controls.code.fill(guess); await controls.submit.click(); }
    await controls.history.click();
    const panel = page.getByRole("region", { name: "History", exact: true });
    const handle = page.getByRole("button", { name: "Move History", exact: true });
    await panel.scrollIntoViewIfNeeded();
    const initialBox = await panel.boundingBox();
    const handleBox = await handle.boundingBox();
    const dragTarget = {
      x: handleBox.x + handleBox.width / 2 < 195 ? Math.min(382, handleBox.x + handleBox.width / 2 + 80) : Math.max(8, handleBox.x + handleBox.width / 2 - 80),
      y: handleBox.y + handleBox.height / 2 < 422 ? Math.min(836, handleBox.y + handleBox.height / 2 + 80) : Math.max(8, handleBox.y + handleBox.height / 2 - 80),
    };
    await dragHistoryHandle(page, handle, dragTarget);
    const movedBox = await panel.boundingBox();
    assert.ok(Math.round(movedBox.x) !== Math.round(initialBox.x) || Math.round(movedBox.y) !== Math.round(initialBox.y), "mobile drag reaches a distinct unclamped panel position");
    assert.ok(movedBox.x >= 0 && movedBox.y >= 0 && movedBox.x + movedBox.width <= 390);
    const entries = panel.locator("div[aria-live='polite']");
    const scrollMetrics = await entries.evaluate((element) => { element.scrollTop = element.scrollHeight; return { scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, scrollTop: element.scrollTop }; });
    assert.ok(scrollMetrics.scrollHeight > scrollMetrics.clientHeight, "populated History has internal overflow before no-drag check");
    assert.ok(scrollMetrics.scrollTop > 0, "internal History scroll position changes");
    assert.deepEqual(await panel.boundingBox(), movedBox, "internal scrolling does not drag the panel");
    await armViewportResizeRender(page);
    await page.setViewportSize({ width: 320, height: 844 });
    await waitForViewportResizeRender(page);
    const resizedBox = await panel.boundingBox();
    assert.ok(resizedBox.x >= 0 && resizedBox.x + resizedBox.width <= 320);
    await controls.history.focus();
    await page.keyboard.press("Enter");
    await controls.history.focus();
    await page.keyboard.press("Enter");
    await exact(panel, "reopened History");
    await controls.newRound.click();
    assert.equal(await panel.count(), 0, "new round resets History visibility");
    const hint = await openHintDialog(page);
    assert.equal(await hint.dialog.evaluate((element) => { const box = element.getBoundingClientRect(); const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2); return hit === element || element.contains(hit); }), true);
    await page.getByRole("button", { name: "Close hint challenge", exact: true }).click();
    // CDP touch events exercise the browser's touch transport instead of mouse-derived Pointer Events.
    const client = await context.newCDPSession(page);
    await controls.history.click();
    const touchHandleBox = await handle.boundingBox();
    const beforeTouchBox = await panel.boundingBox();
    const touchStart = { x: Math.round(touchHandleBox.x + touchHandleBox.width / 2), y: Math.round(touchHandleBox.y + touchHandleBox.height / 2), id: 7 };
    const touchTarget = {
      x: touchStart.x + (beforeTouchBox.x > 0 ? -30 : 30),
      y: touchStart.y + (beforeTouchBox.y > 0 ? -30 : 30),
    };
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchStart] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...touchStart, ...touchTarget }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const afterTouchBox = await panel.boundingBox();
    assert.ok(Math.round(afterTouchBox.x) !== Math.round(beforeTouchBox.x) || Math.round(afterTouchBox.y) !== Math.round(beforeTouchBox.y), "CDP touch transport moves History to a distinct unclamped position");
  });
});

test("each viewport scrolls controls individually before checking reachable geometry", async () => {
  for (const [width, height] of viewportCases) {
    await withSession({ width, height }, {}, async ({ page }) => {
      const controls = await gameControls(page);
      await controls.code.scrollIntoViewIfNeeded();
      const codeBox = await controls.code.boundingBox();
      assert.ok(codeBox.y >= 0 && codeBox.y + codeBox.height <= height, "code row is reachable after its own scroll");
      await controls.submit.scrollIntoViewIfNeeded();
      const submitBox = await controls.submit.boundingBox();
      assert.ok(submitBox.y >= 0 && submitBox.y + submitBox.height <= height, "submit is reachable after its own scroll");
      await controls.cat.scrollIntoViewIfNeeded();
      const [catBox, safeBox, scrollY] = await Promise.all([controls.cat.boundingBox(), page.getByLabel("Safe closed", { exact: true }).boundingBox(), page.evaluate(() => scrollY)]);
      assert.ok(catBox.y + scrollY >= 0, "cat remains in document coordinates even when viewport is short");
      assert.ok(Math.abs(safeBox.x + safeBox.width / 2 - width / 2) <= 2);
      assert.ok(Math.abs(catBox.x + catBox.width / 2 - width / 2) <= 2);
      assert.ok(catBox.y < safeBox.y + safeBox.height && catBox.y + catBox.height > safeBox.y, "cat and safe retain intentional overlap");
    });
  }
});

test("empty and populated History contrast are collected separately in light and dark", async () => {
  for (const colorScheme of ["light", "dark"]) {
    await withSession({ width: 1175, height: 1098 }, { colorScheme, random: 0.041 }, async ({ page }) => {
      const controls = await gameControls(page);
      await controls.history.click();
      const panel = page.getByRole("region", { name: "History", exact: true });
      const emptyText = panel.getByText("No valid attempts yet.", { exact: true });
      const heading = panel.getByRole("heading", { name: "History", exact: true });
      const handle = page.getByRole("button", { name: "Move History", exact: true });
      const targets = [emptyText, heading, handle];
      const emptyMeasurements = [];
      for (const target of targets) {
        emptyMeasurements.push(contrastRatio(await target.evaluate((element) => getComputedStyle(element).color), await opaqueAncestorBackground(target)));
      }
      await controls.history.focus();
      await page.keyboard.press("Enter");
      for (const guess of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]) { await controls.code.fill(guess); await controls.submit.click(); }
      await controls.history.click();
      const populatedPanel = page.getByRole("region", { name: "History", exact: true });
      const populatedMeasurements = [];
      for (const target of [populatedPanel.getByRole("heading", { name: "History", exact: true }), page.getByRole("button", { name: "Move History", exact: true })]) {
        populatedMeasurements.push(contrastRatio(await target.evaluate((element) => getComputedStyle(element).color), await opaqueAncestorBackground(target)));
      }
      assert.ok(emptyMeasurements.every((ratio) => ratio >= 4.5), `${colorScheme} empty History contrast meets 4.5:1`);
      assert.ok(populatedMeasurements.every((ratio) => ratio >= 4.5), `${colorScheme} populated History contrast meets 4.5:1`);
    });
  }
});

test("code input has visible keyboard focus in light and dark", async () => {
  for (const colorScheme of ["light", "dark"]) {
    await withSession({ width: 1175, height: 1098 }, { colorScheme }, async ({ page }) => {
      const controls = await gameControls(page);
      await controls.code.focus();
      const focusStyle = await controls.code.evaluate((element) => { const style = getComputedStyle(element); return [style.outlineStyle, style.outlineWidth, style.boxShadow]; });
      assert.ok((focusStyle[0] !== "none" && focusStyle[1] !== "0px") || focusStyle[2] !== "none");
    });
  }
});

test("preserved routes load without local asset failures", async () => {
  for (const route of ["/", "/safe", "/example", "/example2"]) {
    await withSession({ width: 1175, height: 1098 }, { route }, async ({ page }) => {
      assert.equal(await page.locator("body").isVisible(), true);
    });
  }
});

test("SC05 D02: public cat states use the approved contained WebP family and retain a labelled stable fallback box", async () => {
  await withSession({ width: 1440, height: 900 }, { random: 0.041 }, async ({ page }) => {
    const controls = await gameControls(page);
    const expected = [
      ["Cat idle", "cat-idle-768.webp", [272, 204]],
      ["Cat hover", "cat-attention-768.webp", [272, 204]],
      ["Cat wrong", "cat-wrong-768.webp", [272, 204]],
      ["Cat won", "cat-won-640.webp", [272, 204]],
      ["Cat surrendered", "cat-surrendered-640.webp", [272, 204]],
    ];
    const inspect = async (label, asset, dimensions) => {
      const cat = await exact(page.getByLabel(label, { exact: true }), `${label} public state`);
      const box = await logicalBox(cat);
      assert.deepEqual([Math.round(box.width), Math.round(box.height)], dimensions, `${label} keeps its approved logical scene box before stage scale`);
      const presentation = await publicAssetPresentation(cat);
      assert.match(presentation.reference, new RegExp(asset), `${label} loads its exact approved derivative`);
      assert.equal(presentation.fit, "contain", `${label} never crops the character`);
    };
    await inspect(...expected[0]);
    await controls.cat.hover();
    await inspect(...expected[1]);
    await page.mouse.move(0, 0);
    await controls.code.fill("41");
    await controls.submit.click();
    await inspect(...expected[2]);
    await controls.newRound.click();
    await controls.code.fill("42");
    await controls.submit.click();
    await inspect(...expected[3]);
    await controls.newRound.click();
    await controls.surrender.click();
    await inspect(...expected[4]);
  });
  let interceptedIdleOptimizerRequests = 0;
  const isIdleOptimizerRequest = (url) => {
    let requestUrl;
    try { requestUrl = new URL(url); } catch { return false; }
    return requestUrl.origin === new URL(baseUrl).origin
      && requestUrl.pathname === "/_next/image"
      && requestUrl.searchParams.get("url") === "/safe-cat/cat-idle-768.webp";
  };
  await withSession({ width: 390, height: 844 }, {
    beforeGoto: async (page) => page.route("**/_next/image?*", (route) => {
      if (isIdleOptimizerRequest(route.request().url())) {
        interceptedIdleOptimizerRequests += 1;
        return route.abort();
      }
      return route.continue();
    }),
    isExpectedLocalFailure: isIdleOptimizerRequest,
    isExpectedConsoleFailure: (message) => interceptedIdleOptimizerRequests > 0 && message === "Failed to load resource: net::ERR_FAILED",
  }, async ({ page }) => {
    const fallback = await exact(page.getByLabel("Cat idle", { exact: true }), "failed-asset fallback");
    const box = await logicalBox(fallback);
    assert.ok(interceptedIdleOptimizerRequests >= 1, "the selected idle Next/Image optimizer request is actually intercepted");
    assert.deepEqual([Math.round(box.width), Math.round(box.height)], [208, 156], "failed idle asset preserves the approved mobile logical scene box");
    assert.equal(await fallback.isVisible(), true, "a failed primary asset retains the labelled cat scene instead of removing it");
  });
});

test("SC05 D04: each accepted public input edit advances only the decorative dial by 36 degrees", async () => {
  await withSession({ width: 768, height: 800 }, {}, async ({ page, context }) => {
    const controls = await gameControls(page);
    const dial = await exactHiddenChild(page.getByLabel("Safe closed", { exact: true }), "safe dial");
    const angle = () => visibleDialAngle(dial);
    const settleDial = () => page.waitForTimeout(220);
    assert.deepEqual(await dial.evaluate((element) => { const style = getComputedStyle(element); return [style.transitionProperty, style.transitionDuration, style.transitionTimingFunction]; }), ["transform", "0.18s", "cubic-bezier(0.22, 0.61, 0.36, 1)"], "normal motion uses the approved 180ms easing");
    assert.equal(await angle(), 0, "a new round starts at the public zero angle");
    await controls.code.fill("1");
    await page.waitForTimeout(90);
    const middleAngle = await angle();
    assert.ok(middleAngle > 0 && middleAngle < 36, "normal-motion dial visibly progresses before its 180ms endpoint");
    await settleDial();
    assert.equal(await angle(), 36, "an accepted insert advances the dial once");
    await controls.code.press("End");
    await controls.code.press("2");
    await settleDial();
    assert.equal(await angle(), 72, "a second accepted insertion advances another 36 degrees");
    await controls.code.press("Backspace");
    await settleDial();
    assert.equal(await angle(), 36, "a nonempty public deletion reverses one 36-degree step");
    await controls.code.fill("");
    await settleDial();
    assert.equal(await angle(), 0, "deleting to the empty input restores canonical zero");
    for (const edit of [async () => controls.code.fill("12"), async () => controls.code.fill("99")]) {
      const before = await angle();
      await edit();
      await settleDial();
      assert.equal(await angle(), (before + 36) % 360, "an accepted nonempty insert or replacement advances the dial once");
    }
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
    await page.evaluate(() => navigator.clipboard.writeText("123"));
    await controls.code.focus();
    await page.keyboard.press("Control+A");
    const beforePaste = await angle();
    await page.keyboard.press("Control+V");
    await settleDial();
    assert.equal(await angle(), (beforePaste + 36) % 360, "one accepted paste advances the dial once");
    const beforeNoOp = await angle();
    await controls.code.fill(await controls.code.inputValue());
    await settleDial();
    assert.equal(await angle(), beforeNoOp, "an unchanged public string gives no dial signal");
    await controls.submit.click();
    await settleDial();
    assert.equal(await angle(), beforeNoOp, "a public result cannot reveal a secret-dependent rotation");
    await controls.newRound.click();
    await settleDial();
    assert.equal(await angle(), 0, "New game synchronously restores zero");
    await controls.code.fill("8");
    await settleDial();
    assert.equal(await angle(), 36, "a nonempty public edit establishes a visible nonzero terminal baseline");
    await controls.surrender.click();
    await settleDial();
    assert.equal(await angle(), 36, "terminal states preserve rather than reset the last nonzero public angle");
    await controls.code.press("1");
    await settleDial();
    assert.equal(await angle(), 36, "the disabled terminal input rejects an actual public edit without dial movement");
    assert.equal(await controls.code.inputValue(), "8", "the disabled terminal input preserves its accepted public value");
    assert.equal(await dial.evaluate((element) => `${getComputedStyle(element).pointerEvents},${element.tabIndex}`), "none,-1", "the dial is non-interactive decoration");
  });
});

test("SC05 D14: the separate dial keeps its approved responsive size and geometric centre independently of rotation", async () => {
  for (const [width, height, expectedSize] of [[1440, 900, 104], [768, 800, 88], [390, 844, 76], [320, 600, 68]]) {
    await withSession({ width, height }, {}, async ({ page }) => {
      const safe = page.getByLabel("Safe closed", { exact: true });
      const dial = await exactHiddenChild(safe, `${width}px separate dial`);
      const [dialLogical, safeBox, dialBox] = await Promise.all([logicalBox(dial), safe.boundingBox(), dial.boundingBox()]);
      approximatelyEqual(dialLogical.width, expectedSize, 1, `${width}px logical dial width before stage scale`);
      approximatelyEqual(dialLogical.height, expectedSize, 1, `${width}px logical dial height before stage scale`);
      approximatelyEqual((dialBox.x + dialBox.width / 2 - safeBox.x) / safeBox.width, .4805, .012, `${width}px rendered dial horizontal door ratio`);
      approximatelyEqual((dialBox.y + dialBox.height / 2 - safeBox.y) / safeBox.height, .5335, .012, `${width}px rendered dial vertical door ratio`);
    });
  }
});

test("SC05 D04: reduced-motion dial is synchronous and never gains a transition", async () => {
  await withSession({ width: 390, height: 844 }, {}, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const controls = await gameControls(page);
    const dial = await exactHiddenChild(page.getByLabel("Safe closed", { exact: true }), "reduced-motion safe dial");
    await controls.code.fill("5");
    assert.equal(await visibleDialAngle(dial), 36, "reduced motion retains the public step immediately");
    assert.equal(await dial.evaluate((element) => getComputedStyle(element).transitionProperty), "none", "reduced motion removes dial movement");
  });
});

test("SC05 D05: cat petting supports click, touch, and keyboard while bubbles stay bounded and non-mutating", async () => {
  await withSession({ width: 390, height: 844 }, { hasTouch: true }, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    const controls = await gameControls(page);
    const pet = await exact(page.getByRole("button", { name: "Pet the cat", exact: true }), "petting target");
    const petBox = await pet.boundingBox();
    assert.ok(petBox, "petting target has a rendered click area");
    const initialLayout = await page.locator("main").boundingBox();
    const bubbles = await exact(pet.locator(':scope > [aria-hidden="true"]:not(:has(img))'), "aria-hidden heart overlay");
    const heartOrigins = () => bubbles.locator(':scope > *').evaluateAll((elements) => elements.map((element) => [element.style.getPropertyValue("--origin-x"), element.style.getPropertyValue("--origin-y")]));
    const resolvedPointerOrigin = (position, round = Math.floor) => ({ x: round(petBox.x + position.x) - petBox.x, y: round(petBox.y + position.y) - petBox.y });
    const originStyle = (position, round) => [`${resolvedPointerOrigin(position, round).x}px`, `${resolvedPointerOrigin(position, round).y}px`];
    const pointerOrigin = { x: Math.round(petBox.width * .24), y: Math.round(petBox.height * .36) };
    await page.mouse.click(petBox.x + pointerOrigin.x, petBox.y + pointerOrigin.y);
    assert.equal(await bubbles.locator(':scope > *').count(), 3, "one pet emits exactly three decorative hearts");
    assert.deepEqual(await heartOrigins(), Array.from({ length: 3 }, () => originStyle(pointerOrigin)), "a pointer pet starts every heart at its actual in-target coordinate");
    // Sample the rendered animation at one shared WAAPI instant so unused custom properties cannot masquerade as three motions.
    const renderedMotion = await bubbles.locator(':scope > *').evaluateAll((elements) => elements.map((element) => {
      const animation = element.getAnimations()[0];
      animation.pause();
      animation.currentTime = 700;
      const style = getComputedStyle(element);
      const sample = { duration: style.animationDuration, transform: style.transform };
      animation.play();
      return sample;
    }));
    assert.deepEqual(renderedMotion.map((sample) => sample.duration), ["1.4s", "1.6s", "1.8s"], "normal hearts render three distinct computed animation durations");
    const sampledRise = renderedMotion.map((sample) => Number(sample.transform.match(/matrix\([^,]+, [^,]+, [^,]+, [^,]+, [^,]+, ([^)]+)\)/)?.[1]));
    assert.equal(sampledRise.every((rise) => Number.isFinite(rise) && rise < 0), true, "normal hearts visibly rise at the representative WAAPI sample");
    assert.equal(new Set(sampledRise.map((rise) => rise.toFixed(3))).size, 3, "normal hearts render three distinct sampled rises instead of static or identical motion");
    assert.deepEqual(await page.locator("main").boundingBox(), initialLayout, "petting never allocates game layout");
    assert.equal(await controls.code.inputValue(), "", "petting does not alter controlled input");
    assert.equal(await controls.submit.isEnabled(), true, "petting does not alter game action availability");
    assert.equal(await bubbles.evaluate((element) => getComputedStyle(element).pointerEvents), "none", "heart overlay passes pointer input through");
    await page.clock.runFor(1401);
    assert.equal(await bubbles.locator(':scope > *').count(), 2, "the 1.4s heart cleans up independently before the longer hearts");
    await page.clock.runFor(200);
    assert.equal(await bubbles.locator(':scope > *').count(), 1, "the 1.6s heart cleans up independently before the 1.8s heart");
    await page.clock.runFor(200);
    assert.equal(await bubbles.locator(':scope > *').count(), 0, "the first burst is fully cleaned up by its 1.8s lifecycle");
    const rejectedTouchOrigin = { x: Math.round(petBox.width * .72), y: Math.round(petBox.height * .62) };
    await pet.tap({ position: rejectedTouchOrigin });
    assert.equal(await bubbles.locator(':scope > *').count(), 3, "a fresh touch burst emits exactly three hearts");
    await pet.tap({ position: pointerOrigin });
    assert.equal(await bubbles.locator(':scope > *').count(), 3, "the 900ms throttle rejects an immediate touch burst");
    await page.clock.runFor(900);
    await pet.tap({ position: pointerOrigin });
    assert.equal(await bubbles.locator(':scope > *').count(), 6, "two throttled bursts cap the DOM at six hearts");
    assert.deepEqual((await heartOrigins()).slice(-3), Array.from({ length: 3 }, () => originStyle(pointerOrigin, Math.round)), "a later touch pet resolves to its own distinct in-target coordinate");
    await page.clock.runFor(2701);
    assert.equal(await bubbles.locator(':scope > *').count(), 0, "both throttled bursts complete their individual 1.8s cleanup");
    await pet.focus();
    await page.keyboard.press("Enter");
    assert.deepEqual(await heartOrigins(), Array.from({ length: 3 }, () => [`${petBox.width / 2}px`, `${petBox.height / 2}px`]), "keyboard petting resolves every heart at the exact target center");
    const durationsAndRises = await bubbles.locator(':scope > *').evaluateAll((elements) => elements.map((element) => [element.style.getPropertyValue("--duration"), element.style.getPropertyValue("--rise")]));
    assert.deepEqual(durationsAndRises, [["1400ms", "38px"], ["1600ms", "46px"], ["1800ms", "54px"]], "normal motion uses the approved deterministic lifecycles and rises");
    await page.clock.runFor(1801);
    assert.equal(await bubbles.locator(':scope > *').count(), 0, "keyboard burst is completely cleaned up after its 1.8s maximum lifecycle");
    await page.keyboard.press("Space");
    assert.deepEqual(await heartOrigins(), Array.from({ length: 3 }, () => [`${petBox.width / 2}px`, `${petBox.height / 2}px`]), "Space petting matches Enter at the exact target center");
    await page.clock.runFor(1801);
    assert.equal(await bubbles.locator(':scope > *').count(), 0, "Space burst is also completely cleaned up after its 1.8s maximum lifecycle");
  });
});

test("SC05 provider: pet status is externally described for every game outcome", async () => {
  await withSession({ width: 390, height: 844 }, { random: 0.041 }, async ({ page }) => {
    const controls = await gameControls(page);
    const pet = await exact(page.getByRole("button", { name: "Pet the cat", exact: true }), "petting target with external status");
    const inspectDescription = async (label, state) => {
      await exact(page.getByLabel(label, { exact: true }), `${state} public cat state`);
      const descriptionId = await pet.getAttribute("aria-describedby");
      assert.ok(descriptionId, `${state} pet target has an external description reference`);
      const description = await exact(page.locator(`#${descriptionId}`), `${state} external pet description`);
      assert.equal(await pet.evaluate((element, id) => element.contains(document.getElementById(id)), descriptionId), false, `${state} pet state is not supplied only by a button descendant`);
      assert.match(await description.innerText(), new RegExp(state, "i"), `${state} external pet description updates with the public cat outcome`);
    };
    await inspectDescription("Cat idle", "idle");
    await controls.code.fill("41"); await controls.submit.click();
    await inspectDescription("Cat wrong", "wrong");
    await controls.newRound.click(); await controls.code.fill("42"); await controls.submit.click();
    await inspectDescription("Cat won", "won");
    await controls.newRound.click(); await controls.surrender.click();
    await inspectDescription("Cat surrendered", "surrendered");
  });
});

test("SC05 provider: pet origins use unscaled layout coordinates in both responsive scale bands", async () => {
  for (const [width, height, expectedScale] of [[1440, 900, 1.18], [768, 800, .9]]) await withSession({ width, height }, {}, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    const controls = await gameControls(page);
    const pet = await exact(page.getByRole("button", { name: "Pet the cat", exact: true }), `${width}px pet target`);
    const overlay = await exact(pet.locator(':scope > [aria-hidden="true"]:not(:has(img))'), `${width}px heart overlay`);
    const petBox = await pet.boundingBox();
    const stageScale = await page.locator("main > div").first().evaluate((element) => Math.abs(getComputedStyle(element).transform.match(/matrix\(([^)]+)\)/)?.[1].split(",").map(Number)[0] ?? 1));
    approximatelyEqual(stageScale, expectedScale, .01, `${width}px pet origin test uses the approved stage scale`);
    const client = { x: Math.round(petBox.x + petBox.width * .27), y: Math.round(petBox.y + petBox.height * .63) };
    await page.mouse.click(client.x, client.y);
    const origins = await overlay.locator(':scope > *').evaluateAll((elements) => elements.map((element) => [Number.parseFloat(element.style.getPropertyValue("--origin-x")), Number.parseFloat(element.style.getPropertyValue("--origin-y"))]));
    const expectedPointer = [(client.x - petBox.x) / stageScale, (client.y - petBox.y) / stageScale];
    for (const origin of origins) {
      approximatelyEqual(origin[0], expectedPointer[0], 1, `${width}px pointer heart x origin converts back to unscaled layout space`);
      approximatelyEqual(origin[1], expectedPointer[1], 1, `${width}px pointer heart y origin converts back to unscaled layout space`);
    }
    await page.clock.runFor(1801);
    await pet.focus(); await page.keyboard.press("Enter");
    const keyboardOrigins = await overlay.locator(':scope > *').evaluateAll((elements) => elements.map((element) => [Number.parseFloat(element.style.getPropertyValue("--origin-x")), Number.parseFloat(element.style.getPropertyValue("--origin-y"))]));
    const expectedKeyboard = [petBox.width / (2 * stageScale), petBox.height / (2 * stageScale)];
    for (const origin of keyboardOrigins) {
      approximatelyEqual(origin[0], expectedKeyboard[0], .01, `${width}px keyboard heart x origin is the exact unscaled layout centre`);
      approximatelyEqual(origin[1], expectedKeyboard[1], .01, `${width}px keyboard heart y origin is the exact unscaled layout centre`);
    }
  });
});

test("SC05 D05: reduced-motion petting keeps three decorative hearts fade-only for 700ms", async () => {
  await withSession({ width: 390, height: 844 }, { hasTouch: true }, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-01T00:00:00Z"));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const pet = await exact(page.getByRole("button", { name: "Pet the cat", exact: true }), "reduced-motion petting target");
    const petBox = await pet.boundingBox();
    assert.ok(petBox, "reduced-motion petting target has a rendered touch area");
    const overlay = await exact(pet.locator(':scope > [aria-hidden="true"]:not(:has(img))'), "reduced-motion aria-hidden heart overlay");
    const origin = { x: Math.round(petBox.width * .68), y: Math.round(petBox.height * .31) };
    const client = { x: Math.floor(petBox.x + origin.x), y: Math.floor(petBox.y + origin.y) };
    await pet.dispatchEvent("click", { detail: 1, clientX: client.x, clientY: client.y });
    const hearts = overlay.locator(':scope > *');
    assert.equal(await hearts.count(), 3, "reduced motion retains exactly three hearts");
    const resolvedOrigin = [`${client.x - petBox.x}px`, `${client.y - petBox.y}px`];
    assert.deepEqual(await hearts.evaluateAll((elements) => elements.map((element) => [element.style.getPropertyValue("--origin-x"), element.style.getPropertyValue("--origin-y")])), Array.from({ length: 3 }, () => resolvedOrigin), "reduced motion keeps the actual resolved touch origin");
    for (let index = 0; index < 3; index += 1) {
      const style = await hearts.nth(index).evaluate((element) => [getComputedStyle(element).transform, getComputedStyle(element).animationDuration, getComputedStyle(element).transitionDuration]);
      assert.ok(style[0] === "none" || style[0] === "matrix(1, 0, 0, 1, 0, 0)", "reduced-motion hearts neither translate nor scale");
      assert.ok(style[1] === "0.7s" || style[2] === "0.7s", "reduced-motion heart lifecycle is the approved 700ms fade");
    }
    await page.waitForTimeout(240);
    const middleStates = await hearts.evaluateAll((elements) => elements.map((element) => ({ opacity: Number(getComputedStyle(element).opacity), transform: getComputedStyle(element).transform })));
    const middleOpacities = middleStates.map((state) => state.opacity);
    for (const state of middleStates) {
      assert.ok(state.transform === "none" || state.transform === "matrix(1, 0, 0, 1, 0, 0)", "mid-lifecycle reduced-motion heart still has no translation or scale");
      assert.ok(state.opacity > 0.05 && state.opacity < 0.95, "mid-lifecycle reduced-motion heart is visibly fading rather than static or complete");
    }
    // CSS animation progress uses the browser clock, while the paused page clock keeps cleanup deterministic.
    await page.waitForTimeout(260);
    const lateOpacities = await hearts.evaluateAll((elements) => elements.map((element) => Number(getComputedStyle(element).opacity)));
    for (let index = 0; index < 3; index += 1) assert.ok(lateOpacities[index] < middleOpacities[index], "late reduced-motion heart opacity progresses toward cleanup");
    await page.clock.runFor(699);
    assert.equal(await hearts.count(), 3, "reduced-motion hearts remain present through controlled 699ms");
    await page.clock.runFor(1);
    assert.equal(await hearts.count(), 0, "reduced-motion hearts clean up exactly at controlled 700ms");
    assert.equal(await overlay.getAttribute("aria-hidden"), "true", "reduced-motion overlay stays decorative");
  });
});

test("SC05 D06: controls retain actual game semantics, visible focus, and local typography", async () => {
  await withSession({ width: 320, height: 600 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    const initialGeometry = await page.evaluate(() => {
      const input = document.querySelector("#safe-code");
      const shell = input.parentElement;
      const submit = shell.querySelector("button");
      return [input.getBoundingClientRect().toJSON(), shell.getBoundingClientRect().toJSON(), submit.getBoundingClientRect().toJSON()];
    });
    assert.equal(await controls.code.getAttribute("placeholder"), "Enter a number...", "approved inner-field placeholder is public");
    const compactForm = await controls.code.evaluate((input) => {
      const shell = input.parentElement; const submit = shell.querySelector("button");
      const inputStyle = getComputedStyle(input); const submitStyle = getComputedStyle(submit);
      const context = document.createElement("canvas").getContext("2d");
      context.font = `${inputStyle.fontWeight} ${inputStyle.fontSize} ${inputStyle.fontFamily}`;
      const horizontalPadding = Number.parseFloat(inputStyle.paddingLeft) + Number.parseFloat(inputStyle.paddingRight);
      return {
        shell: shell.getBoundingClientRect().toJSON(), input: input.getBoundingClientRect().toJSON(), submit: submit.getBoundingClientRect().toJSON(),
        submitBoxSizing: submitStyle.boxSizing, placeholderWidth: context.measureText(input.placeholder).width, fourDigitWidth: context.measureText("1000").width,
        inputContentWidth: input.clientWidth - horizontalPadding,
      };
    });
    assert.ok(compactForm.shell.width >= 296 && compactForm.shell.width <= 320, "320px code form uses the available near-viewport row width");
    assert.deepEqual([compactForm.submitBoxSizing, Math.round(compactForm.submit.width)], ["border-box", 84], "320px OK retains its exact 84px border-box outer width");
    assert.ok(compactForm.input.width > 0 && compactForm.placeholderWidth <= compactForm.inputContentWidth && compactForm.fourDigitWidth <= compactForm.inputContentWidth, "320px input keeps both its placeholder and four-digit code affordance unclipped");
    await controls.code.focus();
    const [inputStyle, titleFont, externalFonts, focusedGeometry] = await page.evaluate(() => {
      const title = document.querySelector("h1");
      const input = document.querySelector("#safe-code"); const shell = input.parentElement; const submit = shell.querySelector("button"); const style = getComputedStyle(input);
      return [
        [style.outlineWidth, style.borderColor, style.boxShadow, style.caretColor],
        title && getComputedStyle(title).fontFamily,
        [...document.querySelectorAll("link[rel='stylesheet'], link[rel='preload']")].map((link) => link.href).filter((href) => !new URL(href).origin.includes(location.origin)),
        [input.getBoundingClientRect().toJSON(), shell.getBoundingClientRect().toJSON(), submit.getBoundingClientRect().toJSON()],
      ];
    });
    assert.equal(inputStyle[0], "0px", "D12 focus removes the obsolete outer outline");
    assert.equal(inputStyle[1], "rgb(173, 149, 224)", "D12 focus uses the approved inner violet border");
    assert.match(inputStyle[2], /182, 157, 227/, "D12 focus uses the approved inner violet glow");
    assert.notEqual(inputStyle[3], "transparent", "focused controlled input retains a visible caret");
    assert.deepEqual(focusedGeometry, initialGeometry, "input focus never shifts shell or OK geometry");
    assert.match(titleFont, /Chewy|Trebuchet MS|cursive/i, "title uses the approved D12 fallback stack");
    assert.deepEqual(externalFonts, [], "the screen does not request a remote font");
    await controls.code.fill("bad"); await controls.submit.click();
    assert.equal(await controls.code.getAttribute("aria-invalid"), "true", "invalid public input remains distinct from focus and disabled state");
    await controls.surrender.click();
    assert.equal(await controls.code.isDisabled(), true, "terminal state keeps the controlled input closed");
    assert.equal(await controls.submit.isDisabled(), true, "terminal state keeps submit disabled");
  });
});

test("SC05 D07-D09: lamp and stored-hint card are current-round only across hover, focus, and Escape", async () => {
  await withSession({ width: 390, height: 844 }, { random: 0.041 }, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    const controls = await gameControls(page);
    const lamp = await exact(controls.hint.locator('img[src$="hint-lamp-off-96.webp"], img[src$="hint-lamp-on-96.webp"]'), "hint lamp image");
    assert.match(await lamp.getAttribute("src"), /hint-lamp-off-96\.webp$/, "empty current-round collection renders the off lamp");
    await controls.hint.hover();
    await page.clock.runFor(149);
    assert.equal(await page.getByRole("region", { name: "Stored hints", exact: true }).count(), 0, "hover does not disclose before 150ms");
    await page.clock.runFor(1);
    assert.equal(await page.getByRole("region", { name: "Stored hints", exact: true }).count(), 0, "empty collection has no readable stored card");
    await controls.hint.click();
    await visibleQuestionAnswer(page);
    assert.match(await lamp.getAttribute("src"), /hint-lamp-on-96\.webp$/, "an accepted current fact immediately derives lamp-on");
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    await controls.hint.hover();
    await page.clock.runFor(150);
    const card = await exact(page.getByRole("region", { name: "Stored hints", exact: true }), "stored-hint card");
    assert.equal(await card.getByRole("listitem").count(), 1, "the card exposes the earned fact once");
    await page.clock.pauseAt(await page.evaluate(() => Date.now()));
    await card.hover();
    await page.clock.runFor(250);
    assert.equal(await card.isVisible(), true, "moving from trigger into the card cancels its pending leave close");
    await controls.hint.hover();
    await page.clock.runFor(250);
    assert.equal(await card.isVisible(), true, "moving from the card back to its trigger keeps the stored card open beyond the leave delay");
    await page.clock.pauseAt(await page.evaluate(() => Date.now()));
    await page.mouse.move(0, 0);
    await page.clock.runFor(199);
    assert.equal(await card.isVisible(), true, "leave delay is exactly 200ms");
    await page.clock.runFor(1);
    assert.equal(await card.count(), 0, "card closes after its leave delay");
    await controls.hint.focus();
    const focusedCard = await exact(page.getByRole("region", { name: "Stored hints", exact: true }), "focus-described stored-hint card");
    assert.match(await controls.hint.getAttribute("aria-describedby"), /stored-hints/i, "focus associates the readable content with Show hint");
    await page.keyboard.press("Escape");
    assert.equal(await focusedCard.count(), 0, "Escape closes the card");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Show hint", "Escape returns focus to its trigger");
    await controls.newRound.click();
    assert.match(await lamp.getAttribute("src"), /hint-lamp-off-96\.webp$/, "New game removes former-round lamp state");
  });
});

test("SC05 D09: a 500ms touch long press reads stored hints while a shorter tap keeps math activation", async () => {
  await withSession({ width: 390, height: 844 }, { hasTouch: true, random: 0.041 }, async ({ page, context }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    const controls = await earnFirstHint(page);
    const hintBox = await controls.hint.boundingBox(); const client = await context.newCDPSession(page);
    const point = { x: Math.round(hintBox.x + hintBox.width / 2), y: Math.round(hintBox.y + hintBox.height / 2), id: 9 };
    await controls.hint.tap();
    await exact(page.getByRole("dialog", { name: "Solve a quick math question" }), "short touch math activation");
    await page.getByRole("button", { name: "Close hint challenge", exact: true }).click();
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.clock.runFor(499);
    assert.equal(await page.getByRole("region", { name: "Stored hints", exact: true }).count(), 0, "a 150-499ms touch contact does not disclose stored hints before the 500ms threshold");
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.clock.runFor(500);
    assert.equal(await page.getByRole("region", { name: "Stored hints", exact: true }).count(), 0, "ending a short touch cannot reopen stored hints after its former deadline");
    const shortTouchDialog = page.getByRole("dialog", { name: "Solve a quick math question" });
    if (await shortTouchDialog.count()) await page.getByRole("button", { name: "Close hint challenge", exact: true }).click();
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.clock.runFor(300);
    await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await page.clock.runFor(500);
    assert.equal(await page.getByRole("region", { name: "Stored hints", exact: true }).count(), 0, "touch cancellation before 500ms cannot reopen stored hints after its former deadline");
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.clock.runFor(500);
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const longPressCard = await exact(page.getByRole("region", { name: "Stored hints", exact: true }), "500ms touch long-press card");
    assert.equal(await page.getByRole("dialog", { name: "Solve a quick math question" }).count(), 0, "long press suppresses synthetic math activation");
    await page.clock.runFor(201);
    assert.equal(await longPressCard.isVisible(), true, "long-press stored card remains visible beyond the wrapper 200ms hover-close window");
    assert.equal(await page.getByRole("dialog", { name: "Solve a quick math question" }).count(), 0, "long-press card persistence does not restore a math dialog");
  });
});

test("SC05 D09-D11: four current-round hints cap visible stored rows, scroll internally, and avoid protected content", async () => {
  for (const [width, height] of [[320, 600], [390, 844], [768, 800], [1280, 600], [1440, 900]]) {
    await withSession({ width, height }, { random: 0.041 }, async ({ page }) => {
      const controls = await earnCurrentRoundHints(page, 4);
      await controls.hint.focus();
      const card = await exact(page.getByRole("region", { name: "Stored hints", exact: true }), `${width}x${height} stored-hint card`);
      await card.scrollIntoViewIfNeeded();
      const list = await exact(card.getByRole("list"), "stored-hint semantic list");
      assert.equal(await list.getByRole("listitem").count(), 4, "four current-round facts remain readable rather than being discarded at the three-row cap");
      const [metrics, cardBox, heading, instruction, safe, cat, form, newRound, surrender, history] = await Promise.all([
        list.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const rows = [...element.querySelectorAll("li")].filter((row) => {
            const rowRect = row.getBoundingClientRect();
            return rowRect.top >= rect.top && rowRect.bottom <= rect.bottom;
          }).length;
          const style = getComputedStyle(element);
          return { scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, visibleRows: rows, overflowY: style.overflowY, maxHeight: Number.parseFloat(style.maxHeight) };
        }),
        card.boundingBox(),
        page.getByRole("heading", { name: "Guess the number", exact: true }).boundingBox(),
        controls.instruction.boundingBox(),
        page.getByLabel("Safe closed", { exact: true }).boundingBox(),
        controls.cat.boundingBox(),
        controls.code.boundingBox(),
        controls.newRound.boundingBox(),
        controls.surrender.boundingBox(),
        controls.history.boundingBox(),
      ]);
      assert.equal(metrics.clientHeight, 72, "stored fact viewport exposes exactly three complete 24px rows");
      assert.equal(metrics.scrollHeight, 96, "four short facts produce the exact four-row internal scroll extent");
      assert.equal(metrics.visibleRows, 3, "stored fact viewport exposes exactly three complete rows");
      assert.equal(metrics.maxHeight, 72, "stored fact list uses the approved 72px three-row cap");
      assert.ok(["auto", "scroll"].includes(metrics.overflowY), "stored facts expose a visible scrollable overflow path");
      assert.ok(cardBox.x >= 12 && cardBox.y >= 0 && cardBox.x + cardBox.width <= width - 12, `${width}x${height} card preserves the 12px viewport gutter`);
      for (const protectedBox of [heading, instruction, safe, cat, form, newRound, surrender, history]) {
        assert.equal(intersects(cardBox, protectedBox, 12), false, `${width}x${height} card avoids protected content or falls into normal flow`);
      }
    });
  }
});

test("SC05 D09-D10: reward is latest-wins, announces once, expires without losing storage, and New game invalidates old timers", async () => {
  await withSession({ width: 768, height: 800 }, { random: 0.041 }, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    const controls = await earnFirstHint(page);
    const reward = await exact(page.getByLabel("New hint reward", { exact: true }), "newly-earned reward presentation");
    const announcement = await exact(page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]'), "single polite reward announcement");
    const firstText = await reward.innerText();
    assert.equal(await announcement.innerText(), `Earned hint: ${firstText}`, "reward and one polite announcement contain the exact same public fact");
    await page.clock.runFor(4749);
    assert.equal(await reward.isVisible(), true, "reward remains through 4.75 seconds");
    await page.clock.runFor(501);
    assert.equal(await reward.count(), 0, "reward clears at 5000ms plus the approved tolerance");
    assert.equal(await announcement.count(), 1, "the one polite atomic hint status persists after its transient reward closes");
    assert.equal(await announcement.innerText(), `Earned hint: ${firstText}`, "transient reward expiry does not erase its announced earned fact");
    await controls.hint.focus();
    const stored = await exact(page.getByRole("region", { name: "Stored hints", exact: true }), "stored fact after transient expiry");
    assert.equal(await stored.getByRole("listitem").count(), 1, "expiry does not remove the persisted fact");
    await page.keyboard.press("Escape");
    await controls.hint.click();
    await visibleQuestionAnswer(page);
    const laterReward = await exact(page.getByLabel("New hint reward", { exact: true }), "later latest-wins reward");
    const laterText = await laterReward.innerText();
    assert.notEqual(laterText, firstText, "a later accepted eligible fact replaces rather than queues the reward");
    assert.equal(await page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]').count(), 1, "only one reward announcement region exists");
    await page.clock.runFor(1000);
    assert.equal(await laterReward.isVisible(), true, "the earlier expiry cannot erase the newer reward");
    await controls.newRound.click();
    await page.clock.runFor(0);
    assert.equal(await page.getByLabel("New hint reward", { exact: true }).count(), 0, "New game invalidates current reward immediately");
    await page.clock.runFor(6000);
    assert.equal(await page.getByLabel("New hint reward", { exact: true }).count(), 0, "stale timer callbacks cannot resurrect former-round reward state");
  });
});

test("SC05 provider: one persistent atomic hint status and stored-card focus races stay current-round only", async () => {
  await withSession({ width: 390, height: 844 }, { random: 0.041 }, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    const controls = await gameControls(page);
    assert.equal(await controls.newRound.locator("xpath=..").getByRole("button").count(), 4, "the menu remains a four-button grid without an extra hint-status action");
    const announcement = await exact(page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]'), "persistent polite atomic hint status");
    assert.deepEqual(await announcement.evaluate((element) => [element.getAttribute("role"), element.getAttribute("aria-live"), element.getAttribute("aria-atomic")]), ["status", "polite", "true"], "hint feedback exposes one persistent polite atomic live region");
    await controls.hint.click();
    await visibleQuestionAnswer(page);
    const reward = await exact(page.getByLabel("New hint reward", { exact: true }), "single earned hint reward");
    const earnedFact = await reward.innerText();
    assert.equal(await page.getByLabel("New hint reward", { exact: true }).count(), 1, "one earned fact creates one reward presentation rather than duplicate reward statuses");
    assert.equal(await announcement.innerText(), `Earned hint: ${earnedFact}`, "the sole persistent status announces the current earned fact");

    await controls.hint.focus();
    await exact(page.getByRole("region", { name: "Stored hints", exact: true }), "focus-opened stored card");
    await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("region", { name: "Stored hints", exact: true }).count(), 0, "Tab focus leave closes the stored card immediately through its public blur behavior");

    await controls.hint.focus();
    await exact(page.getByRole("region", { name: "Stored hints", exact: true }), "reopened stored card for Escape");
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("region", { name: "Stored hints", exact: true }).count(), 0, "Escape closes the stored card");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Show hint", "Escape restores focus to the stored-card trigger");

    await controls.hint.hover();
    await page.clock.runFor(150);
    await exact(page.getByRole("region", { name: "Stored hints", exact: true }), "hover-opened stored card");
    await page.mouse.move(0, 0);
    await page.clock.runFor(100);
    await controls.hint.hover();
    await page.clock.runFor(200);
    await exact(page.getByRole("region", { name: "Stored hints", exact: true }), "re-entered stored card after obsolete leave deadline");

    await page.mouse.move(0, 0);
    await controls.newRound.click();
    await page.clock.runFor(500);
    assert.equal(await page.getByRole("region", { name: "Stored hints", exact: true }).count(), 0, "current-round reset cancels pending local card state instead of reopening stale hints");
    assert.equal(await page.getByLabel("New hint reward", { exact: true }).count(), 0, "current-round reset also clears the stale reward presentation");
    assert.equal(await announcement.count(), 1, "reset retains one persistent hint-status owner without creating duplicates");
  });
});

test("SC05 provider: exhausted hints retain their single public status instead of creating another reward channel", async () => {
  await withSession({ width: 390, height: 844 }, { random: 0.041 }, async ({ page }) => {
    const controls = await gameControls(page);
    const announcement = await exact(page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]'), "exhaustion status owner");
    let exhausted = false;
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const rewardsBeforeClick = await page.getByLabel("New hint reward", { exact: true }).count();
      await controls.hint.click();
      const dialog = page.getByRole("dialog", { name: "Solve a quick math question" });
      if (await dialog.count()) {
        await visibleQuestionAnswer(page);
        continue;
      }
      if (/no further hints/i.test(await announcement.innerText())) {
        exhausted = true;
        assert.equal(await dialog.count(), 0, "the exhausted final Show hint activation does not open another challenge");
        assert.equal(await page.getByLabel("New hint reward", { exact: true }).count(), rewardsBeforeClick, "the exhausted final Show hint activation adds no reward");
        break;
      }
      assert.fail(`Show hint attempt ${attempt} neither opened a public challenge nor announced exhaustion`);
    }
    assert.equal(exhausted, true, "a bounded public Show hint flow eventually announces exhaustion");
    assert.equal(await page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]').count(), 1, "exhaustion does not add a second live status");
  });
});

test("SC05 provider: current-round reset cancels a pending touch card before it can reopen", async () => {
  await withSession({ width: 390, height: 844 }, { hasTouch: true, random: 0.041 }, async ({ page, context }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    const controls = await earnFirstHint(page);
    const hintBox = await controls.hint.boundingBox();
    assert.ok(hintBox, "touch reset checks a rendered Show hint target");
    const client = await context.newCDPSession(page);
    const touch = { x: Math.round(hintBox.x + hintBox.width / 2), y: Math.round(hintBox.y + hintBox.height / 2), id: 17 };
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch] });
    await page.clock.runFor(300);
    await controls.newRound.click();
    await page.clock.runFor(500);
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    assert.equal(await page.getByRole("region", { name: "Stored hints", exact: true }).count(), 0, "reset prevents an old touch timer from reopening a former-round stored card");
  });
});

test("SC05 provider: reward row retains 12px narrow gutters while copy can reflow", async () => {
  for (const [width, height] of [[320, 600], [390, 844]]) await withSession({ width, height }, { random: 0.041 }, async ({ page }) => {
    await earnFirstHint(page);
    const reward = await exact(page.getByLabel("New hint reward", { exact: true }), `${width}px earned reward row`);
    const copy = await exact(reward.locator("p"), `${width}px reward copy`);
    const [rewardBox, copyBox] = await Promise.all([reward.boundingBox(), copy.boundingBox()]);
    assert.ok(rewardBox && copyBox, `${width}px reward row and copy render`);
    assert.ok(rewardBox.x >= 12 && rewardBox.x + rewardBox.width <= width - 12, `${width}px reward row itself remains inside the 12px viewport gutters`);
    assert.ok(copyBox.width > 0 && copyBox.x >= rewardBox.x && copyBox.x + copyBox.width <= rewardBox.x + rewardBox.width, `${width}px reward copy may shrink or wrap within its row without escaping it`);
    assert.equal(await reward.evaluate((element) => getComputedStyle(element).pointerEvents), "none", `${width}px reward wrapper never intercepts scene pointer input`);
    const pet = await exact(page.getByRole("button", { name: "Pet the cat", exact: true }), `${width}px still-hittable cat target`);
    const petBox = await pet.boundingBox();
    assert.equal(await page.evaluate(({ x, y }) => {
      const target = document.elementFromPoint(x + 1, y + 1);
      return target instanceof Element && (target === document.querySelector('[aria-label="Pet the cat"]') || document.querySelector('[aria-label="Pet the cat"]')?.contains(target));
    }, { x: petBox.x + petBox.width / 2, y: petBox.y + petBox.height / 2 }), true, `${width}px reward leaves the cat hit target at its visible centre`);
  });
});

test("SC05 provider: reduced-motion safe open and close never animate", async () => {
  await withSession({ width: 390, height: 844 }, { random: 0.041 }, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const controls = await gameControls(page);
    const closed = await exact(page.getByLabel("Safe closed", { exact: true }), "reduced-motion closed safe");
    assert.equal(await closed.evaluate((element) => getComputedStyle(element).animationName), "none", "reduced-motion closed safe has no animation name");
    await controls.code.fill("42");
    await controls.submit.click();
    const opened = await exact(page.getByLabel("Safe opened", { exact: true }), "reduced-motion opened safe");
    assert.equal(await opened.evaluate((element) => getComputedStyle(element).animationName), "none", "reduced-motion opened safe has no animation name");
    await controls.newRound.click();
    const resetClosed = await exact(page.getByLabel("Safe closed", { exact: true }), "reduced-motion reset safe");
    assert.equal(await resetClosed.evaluate((element) => getComputedStyle(element).animationName), "none", "reduced-motion reset safe has no animation name");
  });
});

test("SC05 D09-D11: approved protected zones remain reachable and non-overlapping at every viewport", async () => {
  for (const [width, height] of [[320, 600], [390, 844], [768, 800], [1280, 600], [1440, 900]]) {
    await withSession({ width, height }, { random: 0.041 }, async ({ page }) => {
      const controls = await earnFirstHint(page);
      await waitForStableVisualGeometry(page);
      await settleViewportAtTop(page);
      const rewardBubble = await exact(page.getByLabel("New hint reward", { exact: true }).locator("p"), `${width}x${height} reward speech bubble`);
      const safeScene = page.getByLabel("Safe closed", { exact: true });
      const [heading, instruction, safeBox, catBox, form, bubble, safeAlpha, catAlpha] = await Promise.all([
        page.getByRole("heading", { name: "Guess the number", exact: true }).boundingBox(),
        controls.instruction.boundingBox(),
        safeScene.boundingBox(),
        controls.cat.boundingBox(),
        controls.code.boundingBox(),
        rewardBubble.boundingBox(),
        visibleAlphaBounds(safeScene),
        visibleAlphaBounds(controls.cat),
      ]);
      for (const [name, box] of Object.entries({ heading, instruction, safeBox, catBox, form, bubble, safeAlpha, catAlpha })) assert.ok(box && box.width > 0 && box.height > 0, `${width}x${height} ${name} renders`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${width}x${height} has no horizontal overflow`);
      for (const [name, protectedBox] of Object.entries({ heading, instruction, safe: safeAlpha, cat: catAlpha, form })) assert.equal(intersects(bubble, protectedBox, 12), false, `${width}x${height} speech bubble preserves a 12px protected gap from ${name}`);
      for (const control of [controls.code, controls.submit, controls.newRound, controls.surrender, controls.hint, controls.history]) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height, `${width}x${height} ${await control.innerText()} remains reachable`);
      }
    });
  }
});

test("SC05 D10: New game alone runs the 720ms title curve, restarts cleanly, and settles canonically", async () => {
  await withSession({ width: 768, height: 800 }, {}, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    const controls = await gameControls(page);
    const curve = await exact(page.getByRole("heading", { name: "Guess the number", exact: true }).locator('svg[aria-hidden="true"] defs path'), "decorative title curve");
    const canonical = "M 36 59 Q 200 4 364 59";
    assert.equal(await curve.getAttribute("d"), canonical, "initial title is canonical");
    await controls.code.fill("7");
    await controls.submit.click();
    await page.clock.runFor(800);
    assert.equal(await curve.getAttribute("d"), canonical, "guess feedback cannot trigger title motion");
    await controls.hint.click();
    await page.keyboard.press("Escape");
    assert.equal(await curve.getAttribute("d"), canonical, "hint activity cannot trigger title motion");
    const keyframes = [[130, 76], [288, -30], [439, 32], [569, 0]];
    for (const [elapsed, expectedY] of keyframes) {
      await controls.newRound.click();
      await page.clock.runFor(0);
      assert.equal(await curve.getAttribute("d"), canonical, "each New game begins the replacement sequence at canonical");
      await page.clock.runFor(elapsed);
      approximatelyEqual(titleControlPointY(await curve.getAttribute("d")), expectedY, 4, `approved damped keyframe near ${elapsed}ms`);
    }
    await controls.newRound.click();
    await page.clock.runFor(0);
    assert.equal(await curve.getAttribute("d"), canonical, "rapid New game cancels and restarts from canonical");
    await page.clock.runFor(721);
    assert.equal(await curve.getAttribute("d"), canonical, "one 720ms sequence settles exactly at canonical");
  });
});

test("SC05 D10: title remains static at 390px and under reduced motion", async () => {
  for (const options of [{ viewport: { width: 390, height: 844 } }, { viewport: { width: 768, height: 800 }, reduced: true }]) {
    await withSession(options.viewport, {}, async ({ page }) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      if (options.reduced) await page.emulateMedia({ reducedMotion: "reduce" });
      const controls = await gameControls(page);
      const curve = await exact(page.getByRole("heading", { name: "Guess the number", exact: true }).locator('svg[aria-hidden="true"] defs path'), "static title curve");
      const canonical = await curve.getAttribute("d");
      await controls.newRound.click();
      await page.clock.runFor(750);
      assert.equal(await curve.getAttribute("d"), canonical, "suppressed-motion title does not bend");
    });
  }
});

test("SC05 D12: menu controls preserve exact source geometry and default, hover, active, focus, disabled, narrow, and reduced-motion states", async () => {
  await withSession({ width: 1280, height: 600 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    for (const [button, expectedPath] of [[controls.newRound, "M6 4.5c0-1.2 1.3-1.9 2.3-1.2l11 7.5a1.5 1.5 0 0 1 0 2.4l-11 7.5C7.3 21.4 6 20.7 6 19.5Z"], [controls.surrender, "M20 4v5h-5M4 20v-5h5M4.8 8a8 8 0 0 1 13.1-3L20 9M4 15l2.1 4A8 8 0 0 0 19.2 16"], [controls.hint, "M12 5a6 6 0 0 0-4 10.5V18h8v-2.5A6 6 0 0 0 12 5Z"]]) {
      const icon = await exact(button.locator('svg[viewBox="0 0 24 24"]'), "D12 menu SVG icon");
      assert.equal(await icon.locator("path").first().getAttribute("d"), expectedPath, "D12 keeps exact supplied SVG path geometry");
      assert.deepEqual(await icon.evaluate((element) => [getComputedStyle(element).width, getComputedStyle(element).height]), ["30px", "30px"], "D12 keeps the 30px icon box");
    }
    const initial = await controls.newRound.evaluate((element) => { const style = getComputedStyle(element); return [style.borderTopWidth, style.borderRadius, style.minHeight, style.backgroundImage]; });
    assert.deepEqual(initial.slice(0, 3), ["3px", "24px", "64px"], "D12 default menu border, radius, and height match source CSS");
    assert.match(initial[3], /linear-gradient/, "D12 default menu background is a gradient");
    const defaultStyle = await controls.newRound.evaluate((element) => { const style = getComputedStyle(element); return [style.boxShadow, style.transitionDuration]; });
    assert.match(defaultStyle[0], /0px 5px 14px/, "D12 default shadow retains 5px/14px component");
    assert.match(defaultStyle[0], /0px 1px 0px 0px inset|inset 0px 1px 0px/, "D12 default shadow retains serialized inset component");
    assert.equal(defaultStyle[1], "0.16s, 0.16s, 0.16s", "D12 default transition is 160ms");
    for (const [button, top, bottom] of [[controls.newRound, "rgb(217, 248, 220)", "rgb(191, 237, 196)"], [controls.surrender, "rgb(214, 235, 255)", "rgb(185, 218, 245)"], [controls.hint, "rgb(231, 220, 255)", "rgb(216, 199, 248)"], [controls.history, "rgb(255, 231, 210)", "rgb(255, 212, 178)"]]) {
      const background = await button.evaluate((element) => getComputedStyle(element).backgroundImage);
      assert.equal(background.includes(top), true, "D12 keeps exact top gradient colour");
      assert.equal(background.includes(bottom), true, "D12 keeps exact bottom gradient colour");
    }
    await controls.newRound.focus();
    assert.deepEqual(await controls.newRound.evaluate((element) => { const style = getComputedStyle(element); return [style.outlineWidth, style.outlineColor, style.outlineOffset]; }), ["3px", "rgb(128, 99, 210)", "4px"], "D12 keyboard focus uses supplied violet outline");
    await controls.newRound.hover(); await page.waitForTimeout(180);
    const hoverStyle = await controls.newRound.evaluate((element) => { const style = getComputedStyle(element); return [style.transform, style.filter, style.boxShadow]; });
    assert.match(hoverStyle[0], /matrix\(1, 0, 0, 1, 0, -2\)/, "fine-pointer hover lifts exactly 2px");
    assert.match(hoverStyle[1], /brightness\(1\.025\)/, "fine-pointer hover applies exact brightness");
    assert.match(hoverStyle[2], /0px 9px 20px/, "fine-pointer hover applies 9px/20px shadow");
    const hoverBox = await controls.newRound.boundingBox(); await page.mouse.move(hoverBox.x + hoverBox.width / 2, hoverBox.y + hoverBox.height / 2); await page.mouse.down(); await page.waitForTimeout(180);
    const activeStyle = await controls.newRound.evaluate((element) => { const style = getComputedStyle(element); return [style.transform, style.boxShadow]; });
    assert.match(activeStyle[0], /matrix\(1, 0, 0, 1, 0, 1\)/, "held active presses exactly 1px");
    assert.match(activeStyle[1], /0px 2px 5px/, "held active uses source 2px/5px shadow");
    assert.match(activeStyle[1], /0px 2px 3px 0px inset|inset 0px 2px 3px/, "held active uses serialized inset shadow");
    await page.mouse.up();
    await controls.code.fill("bad"); await controls.submit.click();
    assert.equal(await controls.code.evaluate((element) => getComputedStyle(element).borderColor), "rgb(197, 101, 123)", "D12 invalid input uses exact rose border");
    await controls.surrender.click();
    await page.waitForTimeout(180);
    assert.equal(await controls.surrender.evaluate((element) => getComputedStyle(element).opacity), "0.5", "D12 disabled control is visibly distinct");
    assert.equal(await controls.surrender.evaluate((element) => getComputedStyle(element).boxShadow), "none", "D12 disabled menu control removes its shadow");
    assert.equal(await controls.code.evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(245, 242, 247)", "D12 disabled input background is exact");
    assert.deepEqual(await controls.code.evaluate((element) => { const style = getComputedStyle(element); return [style.color, style.cursor]; }), ["rgb(116, 109, 130)", "not-allowed"], "D12 disabled input uses muted not-allowed state");
  });
  await withSession({ width: 390, height: 844 }, {}, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const controls = await gameControls(page);
    assert.equal(await controls.newRound.evaluate((element) => getComputedStyle(element).transitionProperty), "none", "D12 reduced motion removes menu transitions");
    const box = await controls.newRound.boundingBox();
    assert.ok(box.width <= 420 && box.width > 0, "D12 narrow menu respects its 420px maximum");
    const shell = controls.code.locator("xpath=..");
    assert.deepEqual(await Promise.all([controls.code.evaluate((element) => { const style=getComputedStyle(element); return [style.height,style.paddingLeft,style.fontSize]; }), controls.submit.evaluate((element) => { const style=getComputedStyle(element); return [style.height,style.flexBasis,style.fontSize]; }), shell.evaluate((element) => { const style=getComputedStyle(element); return [style.borderRadius,style.paddingLeft,style.gap]; })]), [["56px","14px","16px"],["56px","84px","18px"],["24px","8px","8px"]], "D12 <=600px exact shell/input/submit gaps, padding, radius, and fonts apply");
  });
  await withSession({ width: 390, height: 844 }, { hasTouch: true }, async ({ page }) => {
    const controls = await gameControls(page); const box = await controls.newRound.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(180);
    assert.equal(await controls.newRound.evaluate((element) => getComputedStyle(element).transform), "none", "coarse/touch pointer does not receive fine-pointer hover lift");
  });
});

test("SC05 D13: selected scene, safe, dial, dialog, operator, and New Hint artwork render at their approved public states", async () => {
  await withSession({ width: 1440, height: 900 }, { random: 0.041 }, async ({ page }) => {
    const controls = await gameControls(page);
    const renderedReferences = await page.locator("*").evaluateAll((elements) => elements.map((element) => ({ background: getComputedStyle(element).backgroundImage, src: element instanceof HTMLImageElement ? (element.currentSrc || element.src) : "" })));
    for (const filename of ["scene-background-wide.webp", "safe-closed-720.webp", "safe-dial-256.webp"]) assert.equal(renderedReferences.some((reference) => reference.background.includes(filename) || reference.src.includes(filename)), true, `${filename} renders in its approved initial state`);
    await controls.hint.click();
    const dialog = await exact(page.getByRole("dialog", { name: "Solve a quick math question" }), "D13 hint dialog");
    const dialogReferences = await dialog.locator("*").evaluateAll((elements) => elements.map((element) => ({ background: getComputedStyle(element).backgroundImage, src: element instanceof HTMLImageElement ? (element.currentSrc || element.src) : "" })));
    for (const filename of ["cat-thinking-512.webp", "operator-add-256.webp", "operator-subtract-256.webp", "operator-multiply-256.webp", "operator-divide-256.webp", "new-hint-256.webp"]) assert.equal(dialogReferences.some((reference) => reference.background.includes(filename) || reference.src.includes(filename)), true, `${filename} renders in the dialog`);
    for (const name of ["Addition", "Subtraction", "Multiplication", "Division"]) await exact(page.getByRole("button", { name, exact: true }), `${name} keeps its accessible label`);
    await exact(page.getByRole("button", { name: "New Hint", exact: true }), "New Hint accessible action");
    await page.getByRole("button", { name: "Close hint challenge", exact: true }).click();
    await controls.code.fill("42"); await controls.submit.click();
    const openedReferences = await page.locator("*").evaluateAll((elements) => elements.map((element) => ({ background: getComputedStyle(element).backgroundImage, src: element instanceof HTMLImageElement ? (element.currentSrc || element.src) : "" })));
    assert.equal(openedReferences.some((reference) => reference.background.includes("safe-open-720.webp") || reference.src.includes("safe-open-720.webp")), true, "open safe artwork renders after a public win");
  });
  await withSession({ width: 390, height: 844 }, {}, async ({ page }) => {
    const backgroundOwner = await exact(page.locator("main").locator("xpath=.."), "D13 route background owner");
    assert.match(await backgroundOwner.evaluate((element) => getComputedStyle(element).backgroundImage), /scene-background-tall\.webp/, "D13 narrow route selects the portrait scene background from its actual route owner");
    const controls = await gameControls(page); await controls.hint.click();
    const dialog = await exact(page.getByRole("dialog", { name: "Solve a quick math question" }), "D13 narrow dialog");
    assert.match(await dialog.evaluate((element) => getComputedStyle(element).backgroundImage), /hint-board-900\.webp/, "D13 applies the board to the dialog itself");
  });
  await withSession({ width: 390, height: 844 }, {
    beforeGoto: async (page) => page.route("**/safe-closed-720.webp", (route) => route.abort()),
    isExpectedLocalFailure: (url) => url.endsWith("/safe-closed-720.webp"),
    isExpectedConsoleFailure: (message) => message === "Failed to load resource: net::ERR_FAILED",
  }, async ({ page }) => {
    const safe = await exact(page.getByLabel("Safe closed", { exact: true }), "failed selected-safe fallback");
    const box = await safe.boundingBox();
    assert.ok(box.width > 0 && box.height > 0, "failed selected safe retains a labelled visible fallback box");
  });
});

test("SC05 D12: every enabled action control shares the authoritative fine-pointer, active, focus, and coarse-pointer contract", async () => {
  await withSession({ width: 1280, height: 600 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    const historyIcon = await exact(controls.history.locator('svg[viewBox="0 0 24 24"]'), "History source SVG");
    assert.equal(await historyIcon.locator("rect").count(), 3, "History has exactly three source bars");
    assert.deepEqual(await historyIcon.locator("rect").evaluateAll((rectangles) => rectangles.map((rect) => [rect.getAttribute("x"), rect.getAttribute("y"), rect.getAttribute("width"), rect.getAttribute("height"), rect.getAttribute("rx")])), [["2", "12", "5", "10", "1.5"], ["9.5", "2", "5", "20", "1.5"], ["17", "7", "5", "15", "1.5"]], "History preserves authoritative bar geometry");
    for (const control of [controls.newRound, controls.surrender, controls.hint, controls.history, controls.submit]) {
      assert.equal(await control.evaluate((element) => getComputedStyle(element).transitionDuration.split(",").every((duration) => duration.trim() === "0.16s")), true, `${await control.innerText()} has only 160ms shared transitions`);
      await control.focus();
      assert.deepEqual(await control.evaluate((element) => { const style=getComputedStyle(element); return [style.outlineWidth,style.outlineColor,style.outlineOffset]; }), ["3px","rgb(128, 99, 210)","4px"], `${await control.innerText()} has shared focus-visible treatment`);
      await control.hover(); await page.waitForTimeout(180);
      const hovered = await control.evaluate((element) => { const style=getComputedStyle(element); return [style.transform,style.filter,style.boxShadow]; });
      assert.match(hovered[0], /matrix\(1, 0, 0, 1, 0, -2\)/, `${await control.innerText()} fine hover lifts -2px`);
      assert.match(hovered[1], /brightness\(1\.025\)/, `${await control.innerText()} fine hover brightens 1.025`);
      assert.match(hovered[2], /0px 9px 20px/, `${await control.innerText()} fine hover has 9px/20px shadow`);
      const box = await control.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(180);
      const active = await control.evaluate((element) => { const style=getComputedStyle(element); return [style.transform,style.boxShadow]; });
      assert.match(active[0], /matrix\(1, 0, 0, 1, 0, 1\)/, `${await control.innerText()} held active presses 1px`);
      assert.match(active[1], /0px 2px 5px/, `${await control.innerText()} held active has source shadow`);
      assert.match(active[1], /0px 2px 3px 0px inset|inset 0px 2px 3px/, `${await control.innerText()} held active has serialized inset shadow`);
      await page.mouse.move(0, 0); await page.mouse.up();
    }
  });
  await withSession({ width: 390, height: 844 }, { hasTouch: true }, async ({ page }) => {
    const controls = await gameControls(page);
    for (const control of [controls.newRound, controls.surrender, controls.hint, controls.history, controls.submit]) {
      const box = await control.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(180);
      assert.equal(await control.evaluate((element) => getComputedStyle(element).transform), "none", `${await control.innerText()} coarse pointer does not hover-lift`);
    }
  });
});

test("SC05 D15/D18/D23: one accessible curved title and subtitle retain the canonical public SVG and responsive typography", async () => {
  for (const [width, height, fontSize, subtitleSize, subtitleWeight] of [[1440, 900, "44px", "18px", "600"], [390, 844, "38px", "18px", "600"], [321, 838, "38px", "18px", "600"]]) {
    await withSession({ width, height }, {}, async ({ page }) => {
      const heading = await exact(page.getByRole("heading", { name: "Guess the number", exact: true }), `${width}px accessible title`);
      assert.equal(await page.getByRole("heading").count(), 1, "D15 exposes exactly one title heading");
      const svg = await exact(heading.locator('svg[aria-hidden="true"]'), "D18 decorative title SVG");
      assert.equal(await svg.getAttribute("viewBox"), "0 0 400 72", "D18 current title viewBox is 400 by 72");
      const arc = await exact(svg.locator("defs path"), "D15 title arc definition");
      assert.equal(await arc.getAttribute("d"), "M 36 59 Q 200 4 364 59", "D15 canonical title arc is exact");
      const textPath = await exact(svg.locator("textPath"), "D15 curved title text");
      assert.deepEqual([await textPath.getAttribute("textLength"), await textPath.getAttribute("startOffset"), await textPath.textContent()], ["300", "50%", "Guess the number"], "D15 title copy and arc length are exact");
      const marks = await exact(svg.locator(":scope > path"), "D23 separated decorative side marks");
      assert.equal(await marks.getAttribute("d"), "M 15 35 L 24 40 M 14 51 L 23 47 M 376 40 L 385 35 M 377 47 L 386 51", "D23 side marks are separate and symmetric");
      assert.equal(await heading.evaluate((element) => getComputedStyle(element).fontSize), fontSize, "D18 title typography follows the active scale band");
      const instruction = await exact(page.getByText("Enter a whole code from 1 to 1000.", { exact: true }), "D15 single subtitle");
      assert.equal(await instruction.count(), 1, "D15 keeps one public subtitle");
      assert.deepEqual(await instruction.evaluate((element) => { const style = getComputedStyle(element); return [style.fontSize, style.fontWeight]; }), [subtitleSize, subtitleWeight], "D15 keeps the approved subtitle weight and active breakpoint size");
    });
  }
  await withSession({ width: 768, height: 800 }, {}, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    const controls = await gameControls(page); const arc = page.getByRole("heading", { name: "Guess the number", exact: true }).locator("defs path");
    for (const [elapsed, expected] of [[0, 4], [130, 76], [288, -30], [439, 32], [569, 0], [720, 4]]) {
      await controls.newRound.click(); await page.clock.runFor(elapsed);
      approximatelyEqual(titleControlPointY(await arc.getAttribute("d")), expected, 4, `D15 damped title control at ${elapsed}ms`);
    }
  });
});

test("SC05 D16/D17/D19/D22/D24/D26: visible artwork, scale bands, dial and subtitle clearance stay coherent", async () => {
  const viewports = [[2560, 1277], [1440, 900], [1280, 800], [605, 838], [599, 838], [390, 844], [321, 838], [2554, 436], [2554, 450]];
  for (const [width, height] of viewports) await withSession({ width, height }, { random: 0.041 }, async ({ page }) => {
    const controls = await gameControls(page); const safe = page.getByLabel("Safe closed", { exact: true });
    const [safeAlpha, idleAlpha, subtitle] = await Promise.all([visibleAlphaBounds(safe), visibleAlphaBounds(controls.cat), controls.instruction.boundingBox()]);
    assert.ok(visibleContact(safeAlpha, idleAlpha), `${width}x${height} D16 visible idle cat contacts visible safe`);
    assert.ok(idleAlpha.y - (subtitle.y + subtitle.height) >= 16, `${width}x${height} D26 idle alpha starts at least 16px below subtitle`);
    const dial = await exactHiddenChild(safe, "D22 dial"); const [safeBox, dialBox] = await Promise.all([safe.boundingBox(), dial.boundingBox()]);
    approximatelyEqual((dialBox.x + dialBox.width / 2 - safeBox.x) / safeBox.width, .4805, .012, `${width}x${height} D22 dial x ratio`);
    approximatelyEqual((dialBox.y + dialBox.height / 2 - safeBox.y) / safeBox.height, .5335, .012, `${width}x${height} D22 dial y ratio`);
    for (const target of [safe, controls.cat]) assert.equal((await publicAssetPresentation(target)).fit, "contain", "D17 artwork remains contained");
    const shell = controls.code.locator("xpath=..");
    const expectedGap = width <= 600 ? "8px" : "12px";
    assert.deepEqual(await shell.evaluate((element) => { const style = getComputedStyle(element); return [style.gap, style.backgroundColor]; }), [expectedGap, "rgba(255, 253, 254, 0.95)"], `${width}x${height} D16 form shell uses its real paper surface and active gap`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}x${height} D24 has no horizontal page overflow`);
    if (width >= 1280) assert.deepEqual(await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight]), [height, height], `${width}x${height} D24 desktop has no empty vertical scroll`);
    if (width === 321) {
      const background = await page.locator("main").evaluate((element) => {
        const owner = [element, ...element.parentElement ? [element.parentElement, ...element.parentElement.parentElement ? [element.parentElement.parentElement] : []] : []].find((candidate) => getComputedStyle(candidate).backgroundImage !== "none");
        const rect = owner.getBoundingClientRect(); const style = getComputedStyle(owner);
        return { image: style.backgroundImage, x: rect.x, y: rect.y, width: rect.width, height: rect.height, scrollHeight: document.documentElement.scrollHeight };
      });
      assert.match(background.image, /scene-background-tall\.webp/, "D24 selects the actual tall-scene background owner at 321px");
      assert.ok(background.x <= 0 && background.x + background.width >= width, "D24 background owner covers the full compact document width");
      assert.ok(background.y <= 0 && background.y + background.height >= background.scrollHeight, "D24 selected background owner covers legitimate compact scrolling through the document bottom");
    }
  });
  for (const [width, height, expectedScale] of [[1440, 900, 1.18], [768, 800, .9], [390, 844, 1]]) await withSession({ width, height }, {}, async ({ page }) => {
    const stage = await exact(page.locator("main > div").first(), `${width}x${height} responsive stage`);
    const transform = await stage.evaluate((element) => getComputedStyle(element).transform);
    const matrix = transform === "none" ? [1, 0, 0, 1] : transform.match(/matrix\(([^)]+)\)/)?.[1].split(",").map(Number);
    assert.ok(matrix && matrix.length === 6, `${width}x${height} stage exposes a measurable scale transform`);
    approximatelyEqual(Math.abs(matrix[0]), expectedScale, .01, `${width}x${height} D17 effective ordinary-height stage scale`);
    approximatelyEqual(Math.abs(matrix[3]), expectedScale, .01, `${width}x${height} D17 preserves uniform effective scale`);
  });
});

test("SC05 D19/D26: every public cat outcome has a comparable visible silhouette and preserves subtitle clearance", async () => {
  for (const [width, height] of [[2560, 1277], [1440, 900], [1280, 800], [605, 838], [390, 844], [321, 838], [2554, 436], [2554, 450]]) await withSession({ width, height }, { random: .041 }, async ({ page }) => {
    const controls = await gameControls(page); const samples = [];
    const inspect = async (label) => { const cat = await exact(page.getByLabel(label, { exact: true }), label); const bounds = await visibleAlphaBounds(cat); const subtitle = await controls.instruction.boundingBox(); assert.ok(bounds.y - (subtitle.y + subtitle.height) >= 16, `${width}px ${label} retains D26 subtitle clearance`); samples.push({ label, bounds }); };
    await inspect("Cat idle"); await controls.cat.hover(); await inspect("Cat hover"); await page.mouse.move(0, 0);
    await controls.code.fill("41"); await controls.submit.click(); await inspect("Cat wrong");
    await controls.newRound.click(); await controls.code.fill("42"); await controls.submit.click(); await inspect("Cat won");
    await controls.newRound.click(); await controls.surrender.click(); await inspect("Cat surrendered");
    const idleArea = samples[0].bounds.width * samples[0].bounds.height;
    for (const sample of samples.slice(1)) {
      const ratio = sample.bounds.width * sample.bounds.height / idleArea;
      assert.ok(ratio >= .62 && ratio <= 1.65, `${width}px D19 ${sample.label} visible alpha scale remains comparable to idle`);
    }
  });
});

test("SC05 D20/D21: menu never intersects or overflows and every control remains reachable at breakpoint edges", async () => {
  for (const [width, height] of [[321, 838], [547, 838], [599, 838], [600, 838], [601, 838], [605, 838], [768, 800], [1024, 800]]) await withSession({ width, height }, {}, async ({ page }) => {
    const controls = await gameControls(page); const all = [controls.newRound, controls.surrender, controls.hint, controls.history];
    await page.evaluate(() => scrollTo(0, 0));
    await waitForStableVisualGeometry(page);
    const boxes = [];
    for (const control of all) {
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox(); const scroll = await page.evaluate(() => scrollY);
      assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height, `${width}px ${await control.innerText()} is reachable`);
      boxes.push({ ...box, y: box.y + scroll });
    }
    for (let index = 0; index < boxes.length; index += 1) for (let other = index + 1; other < boxes.length; other += 1) assert.equal(intersects(boxes[index], boxes[other]), false, `${width}px menu buttons ${index}/${other} do not intersect`);
    const menu = controls.newRound.locator("xpath=.."); assert.ok((await menu.boundingBox()).width <= width, `${width}px menu container has no lateral overflow`);
  });
  const continuity = [];
  for (const width of [599, 600, 601, 605]) await withSession({ width, height: 838 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    const [title, cat, safe, form, menu, stage] = await Promise.all([
      page.getByRole("heading", { name: "Guess the number", exact: true }).boundingBox(),
      controls.cat.boundingBox(), page.getByLabel("Safe closed", { exact: true }).boundingBox(), controls.code.locator("xpath=..").boundingBox(), controls.newRound.locator("xpath=..").boundingBox(),
      page.locator("main > div").first().evaluate((element) => {
        const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
        const matrix = style.transform.match(/matrix\(([^)]+)\)/)?.[1].split(",").map(Number);
        const [originX, originY] = style.transformOrigin.split(" ").slice(0, 2).map(Number.parseFloat);
        const scale = Math.abs(matrix?.[0] ?? 1);
        return { scale, origin: { x: rect.x + scale * originX, y: rect.y + scale * originY } };
      }),
    ]);
    for (const [name, box] of Object.entries({ title, cat, safe, form, menu })) assert.ok(box && box.width > 0 && box.height > 0, `${width}px D21 ${name} anchor renders`);
    assert.ok(title.y < cat.y && cat.y < safe.y && safe.y < form.y && form.y < menu.y, `${width}px D21 keeps title, cat, safe, form, and menu in the approved top-to-bottom order`);
    continuity.push({ width, ...stage, anchors: { title, cat, safe, form, menu } });
  });
  assert.deepEqual(continuity.map((sample) => sample.scale), [1, 1, .9, .9], "D21 records the approved 1/.90 breakpoint scale bands rather than an unexplained layout mode");
  for (const [first, second] of [[continuity[0], continuity[1]], [continuity[2], continuity[3]]]) {
    for (const name of ["title", "cat", "safe", "form", "menu"]) {
      const before = first.anchors[name]; const after = second.anchors[name];
      approximatelyEqual(after.x / second.width, before.x / first.width, .006, `${first.width}/${second.width}px D21 ${name} normalized x anchor stays continuous within its scale band`);
      approximatelyEqual(after.y / 838, before.y / 838, .006, `${first.width}/${second.width}px D21 ${name} normalized y anchor stays continuous within its scale band`);
    }
  }
  // Reconstruct unscaled centres around the actual transform origin; rendered coordinates alone change at the .90 scale boundary.
  const logicalCenter = (sample, box) => ({
    x: sample.origin.x + (box.x + box.width / 2 - sample.origin.x) / sample.scale,
    y: sample.origin.y + (box.y + box.height / 2 - sample.origin.y) / sample.scale,
  });
  const [at600, at601] = [continuity[1], continuity[2]];
  for (const name of ["title", "cat", "safe", "form", "menu"]) {
    const before = logicalCenter(at600, at600.anchors[name]); const after = logicalCenter(at601, at601.anchors[name]);
    approximatelyEqual(after.x - before.x, 0, 1, `600/601px D21 ${name} logical x anchor survives the .90 scale transition without a structural jump`);
    approximatelyEqual(after.y - before.y, 0, 1, `600/601px D21 ${name} logical y anchor survives the .90 scale transition without a structural jump`);
  }
});

test("SC05 D25: a wrong valid code is visibly rejected and any real input edit clears only transient feedback", async () => {
  await withSession({ width: 390, height: 844 }, { random: .041 }, async ({ page }) => {
    const controls = await gameControls(page); await controls.code.fill("41"); await controls.submit.click();
    assert.equal(await controls.code.getAttribute("aria-invalid"), "true", "D25 wrong but valid code exposes invalid state");
    assert.equal(await controls.code.evaluate((element) => getComputedStyle(element).borderColor), "rgb(197, 101, 123)", "D25 wrong code has red border");
    assert.match(await controls.code.evaluate((element) => getComputedStyle(element).boxShadow), /197, 101, 123/, "D25 wrong code has red ring");
    await exact(page.getByText("Incorrect code, try again.", { exact: true }), "D25 neutral wrong feedback"); await exact(page.getByLabel("Cat wrong", { exact: true }), "D25 wrong cat");
    await controls.code.focus();
    await controls.code.press("Backspace");
    assert.equal(await controls.code.getAttribute("aria-invalid"), null, "D25 deletion clears invalid ring");
    assert.equal(await page.getByText("Incorrect code, try again.", { exact: true }).count(), 0, "D25 deletion clears transient feedback"); await exact(page.getByLabel("Cat idle", { exact: true }), "D25 deletion restores idle cat");
    await controls.code.fill("77");
    assert.equal(await controls.code.getAttribute("aria-invalid"), null, "D25 replacement stays neutral after a real edit");
    await controls.history.click();
    const history = await exact(page.getByRole("region", { name: "History", exact: true }), "D25 retained attempts History");
    assert.deepEqual(await history.getByRole("listitem").allTextContents(), ["41"], "D25 insertion and replacement preserve completed public attempts");
    await controls.code.fill("");
    assert.equal(await controls.code.inputValue(), "", "D25 full clear reaches the controlled empty value");
    assert.deepEqual(await history.getByRole("listitem").allTextContents(), ["41"], "D25 full clear preserves completed public attempts");
    await controls.code.fill("bad"); await controls.submit.click(); assert.equal(await controls.code.getAttribute("aria-invalid"), "true", "D25 invalid syntax is distinct");
    await controls.code.fill(""); assert.equal(await controls.code.getAttribute("aria-invalid"), null, "D25 clear after invalid syntax restores neutral input"); await exact(page.getByLabel("Cat idle", { exact: true }), "D25 invalid-edit recovery uses idle cat");
  });
});
