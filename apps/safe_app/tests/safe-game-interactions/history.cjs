const assert = require("node:assert/strict");
const test = require("node:test");
const { withSession } = require("./shared/session.cjs");
const { fixedClockStart } = require("./shared/runtime-context.cjs");
const { waitForStableVisualGeometry } = require("./shared/readiness.cjs");
const { exact, ordinaryOwner, gameControls, openHintDialog, visibleQuestionAnswer, approximatelyEqual } = require("./shared/game-controls.cjs");
const { clickVisibleArtwork } = require("./shared/artwork-geometry.cjs");



async function dragHistoryHandle(page, handle, destination) {
  const handleBox = await handle.boundingBox();
  assert.ok(handleBox, "History handle has a visible box");
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(destination.x, destination.y);
  await page.mouse.up();
}



async function armViewportResizeRender(page) {
  await page.evaluate(() => {
    window.__safeCatResizeRender = false;
    window.addEventListener(
      "resize",
      () => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            window.__safeCatResizeRender = true;
          }),
        );
      },
      { once: true },
    );
  });
}



async function waitForViewportResizeRender(page) {
  await page.waitForFunction(
    () => window.__safeCatResizeRender === true,
    undefined,
    {
      timeout: 1000,
    },
  );
  await page.evaluate(() => {
    delete window.__safeCatResizeRender;
  });
}

async function assertHistoryGrip(page, description) {
  const panel = await exact(
    page.getByRole("region", { name: "History", exact: true }),
    `${description} History panel`,
  );
  const handle = await exact(
    page.getByRole("button", { name: "Move History", exact: true }),
    `${description} History grip keeps its accessible name`,
  );
  await exact(
    page.getByRole("heading", { name: "History", exact: true }),
    `${description} readable History identity`,
  );
  const visibleMoveHistoryText = await handle.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    let count = 0;
    while ((node = walker.nextNode())) {
      if (node.textContent?.trim() !== "Move History") continue;
      const range = document.createRange();
      range.selectNode(node);
      if ([...range.getClientRects()].some((rect) => rect.width >= 20 && rect.height >= 8))
        count += 1;
    }
    return count;
  });
  assert.equal(
    visibleMoveHistoryText,
    0,
    `${description} does not expose a redundant visible Move History label`,
  );
  assert.equal(await handle.isVisible(), true, `${description} grip is visible`);
  const grip = await handle.evaluate((element) => {
    const visibilityOptions = { opacityProperty: true, visibilityProperty: true };
    const pseudoContents = ["::before", "::after"].flatMap((pseudo) => {
      const style = getComputedStyle(element, pseudo);
      if (style.display === "none" || style.visibility !== "visible" ||
          Number(style.opacity) <= 0 || !element.checkVisibility(visibilityOptions)) {
        return [];
      }
      return [style.content.replaceAll('"', "").replaceAll("'", "").trim()];
    });
    return {
      text: element.innerText.trim(),
      pseudoContents,
      hasVisibleDecoration: [...element.querySelectorAll("*")].some(
        (mark) => {
          const style = getComputedStyle(mark);
          const visible =
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number.parseFloat(style.opacity) > 0 &&
            mark.getClientRects().length > 0;
          if (!visible) return false;
          if (style.backgroundImage.includes("radial-gradient")) return true;
          return (
            mark instanceof SVGSVGElement &&
            [...mark.querySelectorAll("circle, ellipse, line, path, polygon, polyline, rect")].some(
              (shape) => shape.getClientRects().length > 0 && shape.checkVisibility(visibilityOptions),
            )
          );
        },
      ),
    };
  });
  const hasSymbolGrip = [grip.text, ...grip.pseudoContents].some(
    (content) => /^[^\p{L}\p{N}\s]+$/u.test(content),
  );
  assert.ok(
    hasSymbolGrip || grip.hasVisibleDecoration,
    `${description} renders a non-text grip rather than another textual action label`,
  );
  await handle.focus();
  assert.equal(
    await handle.evaluate((element) => document.activeElement === element),
    true,
    `${description} grip remains keyboard focusable`,
  );
  return { panel, handle };
}

function register01() {


test("controlled clock rejects obsolete pet-settle callbacks across restart and terminal transitions", async () => {
  await withSession(
    { width: 1175, height: 1098 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await gameControls(page);
      await clickVisibleArtwork(page, controls.cat);
      await page.clock.runFor(100);
      await controls.newRound.click();
      await ordinaryOwner(page, "PLAYING", "new round cancels the first pet settle");
      await clickVisibleArtwork(page, controls.cat);
      await page.clock.runFor(250);
      await ordinaryOwner(page, "PET_NORMAL", "new-round pet presentation before its settle deadline");
      await controls.surrender.click();
      await page.clock.runFor(250);
      await ordinaryOwner(page, "SURRENDERED", "terminal ordinary owner after pending settle deadline");
      await page.goto("about:blank");
      await page.clock.runFor(250);
    },
  );
});

test("History falls back above-right without moving the page and Home restores the anchor", async () => {
  await withSession({ width: 390, height: 844 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    const closedDocumentHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    const closedScrollY = await page.evaluate(() => scrollY);
    await controls.history.click();
    await waitForStableVisualGeometry(page);
    const panel = page.getByRole("region", { name: "History", exact: true });
    const handle = page.getByRole("button", {
      name: "Move History",
      exact: true,
    });
    const [initialPanelBox, historyButtonBox, openedDocumentHeight, openedScrollY] =
      await Promise.all([
        panel.boundingBox(),
        controls.history.boundingBox(),
        page.evaluate(() => document.documentElement.scrollHeight),
        page.evaluate(() => scrollY),
      ]);
    assert.ok(initialPanelBox && historyButtonBox, "History and its trigger have measured compact geometry");
    assert.equal(
      openedDocumentHeight,
      closedDocumentHeight,
      "opening compact History does not extend the document below the scene",
    );
    assert.equal(openedScrollY, closedScrollY, "opening compact History does not scroll the page");
    assert.ok(
      initialPanelBox.y + initialPanelBox.height <= historyButtonBox.y - 7,
      "compact History opens above its trigger with the approved eight-pixel gap",
    );
    const visibleLane = { left: 12, right: 390 - 12 };
    const triggerRight = historyButtonBox.x + historyButtonBox.width;
    assert.ok(
      triggerRight >= visibleLane.left + initialPanelBox.width &&
        triggerRight <= visibleLane.right,
      "compact History's trigger right edge fits the established visible lane",
    );
    const expectedRight = Math.min(
      Math.max(triggerRight, visibleLane.left + initialPanelBox.width),
      visibleLane.right,
    );
    const expectedPanelX = expectedRight - initialPanelBox.width;
    const isRightAnchored = (panelBox) =>
      Math.abs(panelBox.x - expectedPanelX) <= 2;
    assert.equal(
      isRightAnchored(initialPanelBox),
      true,
      "compact History right-aligns with its trigger when that alignment fits the visible lane",
    );
    assert.equal(
      isRightAnchored({ ...initialPanelBox, x: initialPanelBox.x - 20 }),
      false,
      "a compact History panel shifted left inside the visible lane is not right-aligned to its trigger",
    );
    await handle.focus();
    await page.keyboard.press("Home");
    const restoredPanelBox = await panel.boundingBox();
    approximatelyEqual(
      restoredPanelBox.y,
      initialPanelBox.y,
      1,
      "Home restores the compact History viewport anchor within device-pixel rounding",
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollHeight),
      closedDocumentHeight,
      "Home does not extend the document below the scene",
    );
    assert.equal(
      await page.evaluate(() => scrollY),
      closedScrollY,
      "Home does not scroll the page",
    );
  });
});

test("History keyboard movement uses an interior real-drag position", async () => {
  await withSession({ width: 1175, height: 1098 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    await controls.history.click();
    const panel = page.getByRole("region", { name: "History", exact: true });
    const handle = page.getByRole("button", {
      name: "Move History",
      exact: true,
    });
    await dragHistoryHandle(page, handle, { x: 400, y: 400 });
    const interiorBox = await panel.boundingBox();
    assert.ok(
      interiorBox.x > 20 && interiorBox.x + interiorBox.width < 1175 - 20,
      "drag establishes interior horizontal room",
    );
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
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page, context }) => {
      const controls = await gameControls(page);
      for (const guess of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]) {
        await controls.code.fill(guess);
        await controls.submit.click();
      }
      await controls.history.click();
      const panel = page.getByRole("region", { name: "History", exact: true });
      const handle = page.getByRole("button", {
        name: "Move History",
        exact: true,
      });
      await panel.scrollIntoViewIfNeeded();
      const initialBox = await panel.boundingBox();
      const handleBox = await handle.boundingBox();
      const dragTarget = {
        x:
          handleBox.x + handleBox.width / 2 < 195
            ? Math.min(382, handleBox.x + handleBox.width / 2 + 80)
            : Math.max(8, handleBox.x + handleBox.width / 2 - 80),
        y:
          handleBox.y + handleBox.height / 2 < 422
            ? Math.min(836, handleBox.y + handleBox.height / 2 + 80)
            : Math.max(8, handleBox.y + handleBox.height / 2 - 80),
      };
      await dragHistoryHandle(page, handle, dragTarget);
      const movedBox = await panel.boundingBox();
      assert.ok(
        Math.round(movedBox.x) !== Math.round(initialBox.x) ||
          Math.round(movedBox.y) !== Math.round(initialBox.y),
        "mobile drag reaches a distinct unclamped panel position",
      );
      assert.ok(
        movedBox.x >= 0 &&
          movedBox.y >= 0 &&
          movedBox.x + movedBox.width <= 390,
      );
      const entries = panel.locator("div[aria-live='polite']");
      const scrollMetrics = await entries.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        return {
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          scrollTop: element.scrollTop,
        };
      });
      assert.ok(
        scrollMetrics.scrollHeight > scrollMetrics.clientHeight,
        "populated History has internal overflow before no-drag check",
      );
      assert.ok(
        scrollMetrics.scrollTop > 0,
        "internal History scroll position changes",
      );
      assert.deepEqual(
        await panel.boundingBox(),
        movedBox,
        "internal scrolling does not drag the panel",
      );
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
      assert.equal(
        await panel.count(),
        0,
        "new round resets History visibility",
      );
      const hint = await openHintDialog(page);
      assert.equal(
        await hint.dialog.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.left + box.width / 2,
            box.top + box.height / 2,
          );
          return hit === element || element.contains(hit);
        }),
        true,
      );
      await page
        .getByRole("button", { name: "Close hint challenge", exact: true })
        .click();
      // CDP touch events exercise the browser's touch transport instead of mouse-derived Pointer
      // Events.
      const client = await context.newCDPSession(page);
      await controls.history.click();
      const touchHandleBox = await handle.boundingBox();
      const beforeTouchBox = await panel.boundingBox();
      const touchStart = {
        x: Math.round(touchHandleBox.x + touchHandleBox.width / 2),
        y: Math.round(touchHandleBox.y + touchHandleBox.height / 2),
        id: 7,
      };
      const touchTarget = {
        x: touchStart.x + (beforeTouchBox.x > 0 ? -30 : 30),
        y: touchStart.y + (beforeTouchBox.y > 0 ? -30 : 30),
      };
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [touchStart],
      });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ ...touchStart, ...touchTarget }],
      });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      const afterTouchBox = await panel.boundingBox();
      assert.ok(
        Math.round(afterTouchBox.x) !== Math.round(beforeTouchBox.x) ||
          Math.round(afterTouchBox.y) !== Math.round(beforeTouchBox.y),
        "CDP touch transport moves History to a distinct unclamped position",
      );
    },
  );
});
}

function register02() {


test("SCV02 History uses a visible non-text grip without duplicating its readable identity", async () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await withSession(viewport, {}, async ({ page }) => {
      const controls = await gameControls(page);
      await controls.history.click();
      const { panel } = await assertHistoryGrip(
        page,
        `${viewport.width}px History`,
      );
      await panel.scrollIntoViewIfNeeded();
    });
  }
});

test("SCV02 History header drags as one surface while Close restores its opener", async () => {
  await withSession({ width: 1280, height: 900 }, {}, async ({ page, context }) => {
    const controls = await gameControls(page);
    const closedScrollY = await page.evaluate(() => scrollY);
    await controls.history.click();
    const panel = await exact(
      page.getByRole("region", { name: "History", exact: true }),
      "History panel with its restyled header",
    );
    const heading = await exact(
      panel.getByRole("heading", { name: "History", exact: true }),
      "History title drag area",
    );
    const close = await exact(
      panel.getByRole("button", { name: "Close History", exact: true }),
      "History close action",
    );
    const [before, headingBox] = await Promise.all([
      panel.boundingBox(),
      heading.boundingBox(),
    ]);
    assert.ok(before && headingBox, "History header has measurable geometry");
    await page.mouse.move(
      headingBox.x + headingBox.width / 2,
      headingBox.y + headingBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      headingBox.x + headingBox.width / 2 - 60,
      headingBox.y + headingBox.height / 2 - 40,
    );
    await page.mouse.up();
    const afterTitleDrag = await panel.boundingBox();
    assert.ok(
      Math.round(afterTitleDrag.x) !== Math.round(before.x) ||
        Math.round(afterTitleDrag.y) !== Math.round(before.y),
      "dragging the History title moves the whole panel",
    );

    const grip = await exact(
      panel.getByRole("button", { name: "Move History", exact: true }),
      "History centered drag grip",
    );
    const [movedHeadingBox, gripBox, closeBox] = await Promise.all([
      heading.boundingBox(),
      grip.boundingBox(),
      close.boundingBox(),
    ]);
    assert.ok(
      movedHeadingBox && gripBox && closeBox,
      "History header keeps title, grip, and Close geometry after a drag",
    );
    assert.ok(
      closeBox.x - (gripBox.x + gripBox.width) > 2,
      "History header keeps a real open span between its grip and Close action",
    );
    const headerGap = {
      x: (gripBox.x + gripBox.width + closeBox.x) / 2,
      y: movedHeadingBox.y + movedHeadingBox.height / 2,
    };
    await page.mouse.move(headerGap.x, headerGap.y);
    await page.mouse.down();
    await page.mouse.move(headerGap.x - 35, headerGap.y + 25);
    await page.mouse.up();
    const afterHeaderDrag = await panel.boundingBox();
    assert.ok(
      Math.round(afterHeaderDrag.x) !== Math.round(afterTitleDrag.x) ||
        Math.round(afterHeaderDrag.y) !== Math.round(afterTitleDrag.y),
      "the open span of the History header also drags the panel",
    );

    const touchHeadingBox = await heading.boundingBox();
    assert.ok(touchHeadingBox, "History title remains a touch drag target");
    const beforeTouchDrag = await panel.boundingBox();
    const touchStart = {
      x: Math.round(touchHeadingBox.x + touchHeadingBox.width / 2),
      y: Math.round(touchHeadingBox.y + touchHeadingBox.height / 2),
      id: 13,
    };
    const client = await context.newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [touchStart],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{
        ...touchStart,
        x: touchStart.x + (beforeTouchDrag.x < 500 ? 32 : -32),
        y: touchStart.y + (beforeTouchDrag.y < 400 ? 26 : -26),
      }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const afterTouchDrag = await panel.boundingBox();
    assert.ok(
      Math.round(afterTouchDrag.x) !== Math.round(beforeTouchDrag.x) ||
        Math.round(afterTouchDrag.y) !== Math.round(beforeTouchDrag.y),
      "touch dragging the History title moves the whole panel",
    );

    await close.click();
    assert.equal(
      await panel.count(),
      0,
      "Close History removes the panel instead of beginning a drag",
    );
    assert.equal(
      await controls.history.evaluate((element) => document.activeElement === element),
      true,
      "Close History restores focus to the History opener",
    );
    assert.equal(
      await page.evaluate(() => scrollY),
      closedScrollY,
      "Close History restores focus without scrolling the page",
    );

    await controls.history.click();
    const keyboardClose = await exact(
      page.getByRole("button", { name: "Close History", exact: true }),
      "reopened History close action",
    );
    await keyboardClose.focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await panel.count(),
      0,
      "keyboard activation of Close History removes the panel",
    );
    assert.equal(
      await controls.history.evaluate((element) => document.activeElement === element),
      true,
      "keyboard Close History restores focus to the History opener",
    );
  });
});

test("SCV02 /safe smoke keeps the History grip reachable without horizontal overflow", async () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await withSession(viewport, { route: "/safe" }, async ({ page }) => {
      const controls = await gameControls(page);
      await controls.history.click();
      const { handle } = await assertHistoryGrip(
        page,
        `/safe ${viewport.width}px History`,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        `/safe ${viewport.width}px History does not add horizontal overflow`,
      );
      await handle.focus();
      await page.keyboard.press("Escape");
      assert.equal(
        await page.getByRole("region", { name: "History", exact: true }).count(),
        0,
        `/safe ${viewport.width}px Escape closes History`,
      );
      assert.equal(
        await controls.history.evaluate((element) => document.activeElement === element),
        true,
        `/safe ${viewport.width}px Escape returns focus to History`,
      );
    });
  }
});


test("SC05 provider: desktop History pointer and keyboard movements visibly update position", async () => {
  await withSession({ width: 1280, height: 900 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    await controls.history.click();
    const panel = await exact(
      page.getByRole("region", { name: "History", exact: true }),
      "desktop History panel",
    );
    const handle = await exact(
      page.getByRole("button", { name: "Move History", exact: true }),
      "desktop History drag handle",
    );
    const [initialPanel, historyButton, initialScrollY] = await Promise.all([
      panel.boundingBox(),
      controls.history.boundingBox(),
      page.evaluate(() => scrollY),
    ]);
    approximatelyEqual(
      initialPanel.y + initialScrollY -
        (historyButton.y + initialScrollY + historyButton.height),
      8,
      1,
      "desktop History initially anchors eight document pixels below its button",
    );
    const handleBox = await handle.boundingBox();
    assert.ok(handleBox, "desktop History handle has a rendered box");
    await dragHistoryHandle(page, handle, {
      x: Math.max(16, handleBox.x - 80),
      y: Math.max(16, handleBox.y - 70),
    });
    const dragged = await panel.boundingBox();
    assert.ok(
      Math.round(dragged.x) !== Math.round(initialPanel.x) ||
        Math.round(dragged.y) !== Math.round(initialPanel.y),
      "desktop pointer drag visibly relocates History",
    );
    await handle.focus();
    await page.keyboard.press("ArrowDown");
    const afterDown = await panel.boundingBox();
    assert.ok(
      afterDown.y > dragged.y,
      "desktop ArrowDown visibly moves the inline History panel down",
    );
    await page.keyboard.press("ArrowUp");
    const afterUp = await panel.boundingBox();
    assert.ok(
      afterUp.y < afterDown.y,
      "desktop ArrowUp visibly moves the inline History panel up",
    );
  });
});

test("History coverage keeps keyboard focus reachable", async () => {
  for (const focusedControl of ["history grip", "code input"]) {
    await withSession(
      { width: 390, height: 844 },
      { random: 0.041, clockStart: fixedClockStart },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        await visibleQuestionAnswer(page);
        await page.clock.runFor(5001);
        await controls.history.click();

        const history = await exact(
          page.getByRole("region", { name: "History", exact: true }),
          `${focusedControl} visible History`,
        );
        const hiddenHistory = page.locator('section[aria-label="History"]');
        const handle = await exact(
          page.getByRole("button", { name: "Move History", exact: true }),
          `${focusedControl} History grip`,
        );
        const before = await history.boundingBox();
        const beforeScrollY = await page.evaluate(() => scrollY);
        assert.ok(before, `${focusedControl} History has compact geometry before preview`);

        const expectedFocus = focusedControl === "history grip" ? controls.hint : controls.code;
        await (focusedControl === "history grip" ? handle : controls.code).focus();
        assert.equal(
          await (focusedControl === "history grip" ? handle : controls.code).evaluate(
            (element) => element === document.activeElement,
          ),
          true,
          `${focusedControl} establishes its requested focus baseline`,
        );
        assert.equal(
          await expectedFocus.evaluate((element) => element === document.activeElement),
          focusedControl !== "history grip",
          `${focusedControl} establishes the expected focus baseline`,
        );

        const hintBox = await controls.hint.boundingBox();
        assert.ok(hintBox, `${focusedControl} Show hint has a physical hover target`);
        await page.mouse.move(0, 0);
        await page.mouse.move(hintBox.x + hintBox.width / 2, hintBox.y + hintBox.height / 2);
        await page.clock.runFor(150);

        await exact(
          page.getByRole("region", { name: "Stored hints", exact: true }),
          `${focusedControl} compact Stored hints preview`,
        );
        assert.equal(await hiddenHistory.count(), 1, `${focusedControl} keeps History mounted while covered`);
        assert.equal(await hiddenHistory.evaluate((element) => getComputedStyle(element).visibility), "hidden");
        assert.equal(await hiddenHistory.getAttribute("aria-hidden"), "true");
        assert.equal(await hiddenHistory.getAttribute("inert"), "");
        assert.equal(
          await expectedFocus.evaluate((element) => element === document.activeElement),
          true,
          `${focusedControl} keeps focus on its existing visible control while History is covered`,
        );
        assert.equal(await page.evaluate(() => scrollY), beforeScrollY, `${focusedControl} cover does not scroll the page`);

        await page.keyboard.press("Escape");
        assert.equal(
          await page.getByRole("region", { name: "Stored hints", exact: true }).count(),
          0,
          `${focusedControl} Escape closes only the preview`,
        );
        const restored = await exact(
          page.getByRole("region", { name: "History", exact: true }),
          `${focusedControl} restored History`,
        );
        assert.equal(await hiddenHistory.getAttribute("aria-hidden"), null);
        assert.equal(await hiddenHistory.getAttribute("inert"), null);
        assert.equal(await hiddenHistory.evaluate((element) => getComputedStyle(element).visibility), "visible");
        assert.equal(
          await expectedFocus.evaluate((element) => element === document.activeElement),
          true,
          `${focusedControl} Escape leaves focus on the visible control instead of the page body`,
        );
        const after = await restored.boundingBox();
        assert.deepEqual(after, before, `${focusedControl} Escape restores History without moving it`);
        assert.equal(await page.evaluate(() => scrollY), beforeScrollY, `${focusedControl} Escape does not scroll the page`);

        for (let step = 0; step < 8; step += 1) {
          if (
            await page.evaluate(() => {
              const active = document.activeElement;
              return active instanceof HTMLElement &&
                active.getAttribute("aria-label") === "Move History" &&
                active.closest('section[aria-label="History"]') !== null;
            })
          ) break;
          await page.keyboard.press("Tab");
        }
        assert.equal(
          await handle.evaluate((element) => element === document.activeElement),
          true,
          `${focusedControl} keyboard Tab reaches the restored History grip`,
        );
      },
    );
  }
});

// These browser assertions use public roles, rendered assets, and geometry only; no test
// reads the game secret or a reducer-internal answer.
async function sc06Dialog(page) {
  const dialog = await exact(
    page.getByRole("dialog", {
      name: "Solve a quick math question",
      exact: true,
    }),
    "SC06 math dialog",
  );
  const answer = await exact(
    dialog.locator("#hint-answer"),
    "SC06 answer input",
  );
  const check = await exact(
    dialog.getByRole("button", { name: "Check", exact: true }),
    "SC06 Check action",
  );
  const newQuestion = await exact(
    dialog.getByRole("button", { name: "New question", exact: true }),
    "SC06 New question action",
  );
  const giveUp = await exact(
    dialog.getByRole("button", { name: "Give up", exact: true }),
    "SC06 Give up action",
  );
  const randomOperator = await exact(
    dialog.getByRole("button", { name: "Random operator", exact: true }),
    "SC06 Random operator action",
  );
  return { dialog, answer, check, newQuestion, giveUp, randomOperator };
}
}

module.exports = { register01, register02 };
