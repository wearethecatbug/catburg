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
    page.on("pageerror", (error) => monitorFailures.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(baseUrl) && response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
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
    assert.equal(Math.round(initialPanelBox.y + initialScrollY - (historyButtonBox.y + initialScrollY + historyButtonBox.height)), 8);
    await handle.focus();
    await page.keyboard.press("Home");
    const restoredPanelBox = await panel.boundingBox();
    assert.equal(Math.round(restoredPanelBox.y + await page.evaluate(() => scrollY)), Math.round(initialPanelBox.y + initialScrollY));
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
    const initialBox = await panel.boundingBox();
    await dragHistoryHandle(page, handle, { x: 300, y: 700 });
    const movedBox = await panel.boundingBox();
    assert.notEqual(Math.round(movedBox.x), Math.round(initialBox.x));
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
    const client = await context.newCDPSession(page);
    await controls.history.click();
    const touchHandleBox = await handle.boundingBox();
    const beforeTouchBox = await panel.boundingBox();
    const touchStart = { x: Math.round(touchHandleBox.x + touchHandleBox.width / 2), y: Math.round(touchHandleBox.y + touchHandleBox.height / 2), id: 7 };
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchStart] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...touchStart, x: touchStart.x + 30, y: touchStart.y + 30 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const afterTouchBox = await panel.boundingBox();
    assert.notEqual(Math.round(afterTouchBox.x), Math.round(beforeTouchBox.x), "CDP touch transport moves History");
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
