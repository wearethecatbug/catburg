const assert = require("node:assert/strict");
const test = require("node:test");
const { withSession } = require("./shared/session.cjs");
const { fixedClockStart } = require("./shared/runtime-context.cjs");
const { waitForStableVisualGeometry } = require("./shared/readiness.cjs");
const { exact, ordinaryOwner, gameControls, openHintDialog, approximatelyEqual } = require("./shared/game-controls.cjs");
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

test("History anchors eight document pixels below its button and Home restores the anchor", async () => {
  await withSession({ width: 390, height: 844 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    await controls.history.click();
    await waitForStableVisualGeometry(page);
    const panel = page.getByRole("region", { name: "History", exact: true });
    const handle = page.getByRole("button", {
      name: "Move History",
      exact: true,
    });
    const [initialPanelBox, historyButtonBox, initialScrollY] =
      await Promise.all([
        panel.boundingBox(),
        controls.history.boundingBox(),
        page.evaluate(() => scrollY),
      ]);
    approximatelyEqual(
      initialPanelBox.y +
        initialScrollY -
        (historyButtonBox.y + initialScrollY + historyButtonBox.height),
      8,
      1,
      "History retains its eight-pixel document anchor within device-pixel rounding",
    );
    await handle.focus();
    await page.keyboard.press("Home");
    const restoredPanelBox = await panel.boundingBox();
    approximatelyEqual(
      restoredPanelBox.y + (await page.evaluate(() => scrollY)),
      initialPanelBox.y + initialScrollY,
      1,
      "Home restores the History document anchor within device-pixel rounding",
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
