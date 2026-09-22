const assert = require("node:assert/strict");
const test = require("node:test");
const { withSession } = require("./shared/session.cjs");
const { fixedClockStart } = require("./shared/runtime-context.cjs");
const { expectHintLamp } = require("./shared/sc08-contract.cjs");
const { pauseClockAtCurrentTime, exact, ordinaryOwner, expectRewardReplacement, expectOrdinaryReturn, gameControls, openHintDialog, solveVisibleQuestion, visibleQuestionAnswer } = require("./shared/game-controls.cjs");
const { intersects } = require("./shared/artwork-geometry.cjs");



async function earnCurrentRoundHints(page, amount) {
  const controls = await gameControls(page);
  for (let count = 0; count < amount; count += 1) {
    await controls.hint.click();
    await visibleQuestionAnswer(page);
    await page.clock.runFor(5001);
  }
  return controls;
}



async function refocusShowHint(controls) {
  await controls.newRound.focus();
  await controls.hint.focus();
}



async function expireHintReward(page) {
  const reward = page.getByLabel("New hint reward", { exact: true });
  if (await reward.count()) await page.clock.runFor(5001);
  assert.equal(await reward.count(), 0, "earned-hint reward expires before stored-hint discovery");
}



async function earnFirstHint(page) {
  const controls = await gameControls(page);
  await controls.hint.click();
  await visibleQuestionAnswer(page);
  return controls;
}

function register01() {


test("deterministic code 42 opens without rendering the secret", async () => {
  await withSession(
    { width: 1175, height: 1098 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      await controls.code.fill("42");
      await controls.submit.click();
      await exact(
        page.getByLabel("Safe opened", { exact: true }),
        "opened safe",
      );
      assert.equal(
        /safe code is 42/i.test(await page.locator("body").innerText()),
        false,
      );
    },
  );
});

test("abandonment earns no fact and a solved even question announces a fresh next hint", async () => {
  await withSession(
    { width: 1175, height: 1098 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const hint = await openHintDialog(page);
      await hint.dialog
        .getByRole("button", { name: "Give up", exact: true })
        .click();
      assert.equal(await hint.answer.isDisabled(), true);
      assert.equal(
        await page.getByText(/even|odd/i).count(),
        0,
        "abandonment yields no safe parity fact",
      );
      await page
        .getByRole("button", { name: "New question", exact: true })
        .click();
      const solvedQuestion = await hint.dialog
        .locator("label[for='hint-answer']")
        .innerText();
      await hint.answer.fill(String(solveVisibleQuestion(solvedQuestion)));
      await page.getByRole("button", { name: "Check", exact: true }).click();
      await hint.dialog
        .getByText("Great job! You earned a hint!", { exact: true })
        .waitFor({ state: "visible" });
      await page.clock.runFor(2500);
      await hint.dialog.waitFor({ state: "hidden" });
      await exact(
        page
          .getByRole("status")
          .getByText("Earned hint: The code is even.", { exact: true }),
        "post-handoff earned even fact status",
      );
      await hint.hint.click();
      const freshDialog = await exact(
        page.getByRole("dialog", { name: "Solve a quick math question" }),
        "fresh math challenge dialog",
      );
      const freshAnswer = freshDialog.locator("#hint-answer");
      await exact(freshAnswer, "fresh math challenge answer input");
      assert.equal(
        await freshAnswer.isEnabled(),
        true,
        "a later Show hint creates a usable fresh challenge instead of replaying the awarded fact",
      );
    },
  );
});

test("dialog autofocus, operator replacement, tab cycle, Escape opener focus, and Give up focus transfer", async () => {
  await withSession({ width: 768, height: 900 }, {}, async ({ page }) => {
    const hint = await openHintDialog(page);
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      "hint-answer",
      "opening focuses the answer input",
    );
    const close = page.getByRole("button", {
      name: "Close hint challenge",
      exact: true,
    });
    const firstOperator = page.getByRole("button", {
      name: "Addition",
      exact: true,
    });
    await firstOperator.click();
    assert.equal(
      await hint.answer.isEnabled(),
      true,
      "operator replacement keeps the answer input usable",
    );
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await hint.dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      true,
      "Shift+Tab remains in the dialog",
    );
    await hint.answer.focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await hint.dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      true,
      "Tab remains in the dialog",
    );
    await page.keyboard.press("Escape");
    await hint.dialog.waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      "Show hint",
      "Escape restores the actual opener",
    );
    await hint.hint.click();
    const giveUp = hint.dialog.getByRole("button", {
      name: "Give up",
      exact: true,
    });
    await giveUp.focus();
    await giveUp.click();
    assert.equal(await giveUp.isDisabled(), true);
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      "New question",
      "Give up moves focus to enabled New question",
    );
  });
});
}

function register02() {


test("SC05 D07-D09: lamp and stored-hint card are current-round only across hover, focus, and Escape", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await gameControls(page);
      await expectHintLamp(controls.hint, false, "empty current-round collection");
      await controls.hint.hover();
      await page.clock.runFor(149);
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "hover does not disclose before 150ms",
      );
      await page.clock.runFor(1);
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "empty collection has no readable stored card",
      );
      await controls.hint.click();
      await visibleQuestionAnswer(page);
      await expireHintReward(page);
      await expectHintLamp(controls.hint, true, "an accepted current fact");
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
      });
      await controls.hint.hover();
      await page.clock.runFor(150);
      const card = await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "stored-hint card",
      );
      assert.equal(
        await card.getByRole("listitem").count(),
        1,
        "the card exposes the earned fact once",
      );
      await pauseClockAtCurrentTime(page);
      await card.hover();
      await page.clock.runFor(250);
      assert.equal(
        await card.isVisible(),
        true,
        "moving from trigger into the card cancels its pending leave close",
      );
      await controls.hint.hover();
      await page.clock.runFor(250);
      assert.equal(
        await card.isVisible(),
        true,
        "moving from the card back to its trigger keeps the stored card open beyond the leave delay",
      );
      await pauseClockAtCurrentTime(page);
      await page.mouse.move(0, 0);
      await page.clock.runFor(200);
      assert.equal(
        await card.isVisible(),
        true,
        "leave grace remains open through 200ms",
      );
      await page.clock.runFor(1);
      assert.equal(await card.count(), 0, "card closes after its leave delay");
      await refocusShowHint(controls);
      const focusedCard = await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "focus-described stored-hint card",
      );
      assert.match(
        await controls.hint.getAttribute("aria-describedby"),
        /stored-hints/i,
        "focus associates the readable content with Show hint",
      );
      await page.keyboard.press("Escape");
      assert.equal(await focusedCard.count(), 0, "Escape closes the card");
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        "Show hint",
        "Escape returns focus to its trigger",
      );
      await controls.newRound.click();
      await expectHintLamp(controls.hint, false, "New game");
    },
  );
});

test("SC05 D09: the stored-hint close timer cannot hide a card while keyboard focus remains inside its wrapper", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      const card = page.getByRole("region", {
        name: "Stored hints",
        exact: true,
      });
      const leaveWrapper = async () => {
        await controls.hint.hover();
        await page.mouse.move(0, 0);
        await page.clock.runFor(200);
      };

      await refocusShowHint(controls);
      await exact(card, "Show hint focus-driven stored card");
      const describedCardId = await card.getAttribute("id");
      assert.equal(
        await controls.hint.getAttribute("aria-describedby"),
        describedCardId,
        "Show hint focus describes its visible stored card",
      );
      await leaveWrapper();
      assert.equal(
        await card.count(),
        1,
        "the expired pointer-leave timer preserves the card while Show hint remains focused",
      );
      assert.equal(
        await controls.hint.getAttribute("aria-describedby"),
        describedCardId,
        "the focused trigger retains its description after the close deadline",
      );

      const list = card.getByRole("list", {
        name: "Stored hint list",
        exact: true,
      });
      await exact(list, "focusable stored-hint list");
      await list.focus();
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute("aria-label"),
        ),
        "Stored hint list",
        "keyboard focus moves into the stored-hint list",
      );
      await leaveWrapper();
      assert.equal(
        await card.count(),
        1,
        "the expired pointer-leave timer preserves the card while the stored list remains focused",
      );
      assert.equal(
        await controls.hint.getAttribute("aria-describedby"),
        describedCardId,
        "the trigger keeps its stored-card description while focus is inside the wrapper",
      );

      await controls.code.focus();
      assert.equal(
        await card.count(),
        0,
        "a real blur outside the wrapper closes the stored-hint card",
      );
      assert.equal(
        await controls.hint.getAttribute("aria-describedby"),
        null,
        "a real blur removes the stale stored-card description",
      );
    },
  );
});

test("SC05 D09: a 500ms touch long press reads stored hints while a shorter tap keeps math activation", async () => {
  await withSession(
    { width: 390, height: 844 },
    { hasTouch: true, random: 0.041, clockStart: fixedClockStart },
    async ({ page, context }) => {
      await pauseClockAtCurrentTime(page);
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      const hintBox = await controls.hint.boundingBox();
      const client = await context.newCDPSession(page);
      const point = {
        x: Math.round(hintBox.x + hintBox.width / 2),
        y: Math.round(hintBox.y + hintBox.height / 2),
        id: 9,
      };
      await controls.hint.tap();
      await exact(
        page.getByRole("dialog", { name: "Solve a quick math question" }),
        "short touch math activation",
      );
      await page
        .getByRole("button", { name: "Close hint challenge", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        "Show hint",
        "closing the short-touch challenge restores its trigger without stale suppression",
      );
      await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "restored trigger focus discloses current stored facts",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "Escape closes the refocus-disclosed stored card before the next touch activation",
      );
      await controls.hint.tap();
      await exact(
        page.getByRole("dialog", { name: "Solve a quick math question" }),
        "refocused short touch math activation",
      );
      await page
        .getByRole("button", { name: "Close hint challenge", exact: true })
        .click();
      await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "second refocused short-touch stored card",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "second refocus-disclosed card closes before the manual touch-duration checks",
      );
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point],
      });
      await page.clock.runFor(499);
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "a 150-499ms touch contact does not disclose stored hints before the 500ms threshold",
      );
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.clock.runFor(500);
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "ending a short touch cannot reopen stored hints after its former deadline",
      );
      const shortTouchDialog = page.getByRole("dialog", {
        name: "Solve a quick math question",
      });
      if (await shortTouchDialog.count()) {
        await page
          .getByRole("button", { name: "Close hint challenge", exact: true })
          .click();
        await page.keyboard.press("Escape");
      }
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point],
      });
      await page.clock.runFor(300);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
      await page.clock.runFor(500);
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "touch cancellation before 500ms cannot reopen stored hints after its former deadline",
      );
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point],
      });
      await page.clock.runFor(500);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      const longPressCard = await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "500ms touch long-press card",
      );
      assert.equal(
        await page
          .getByRole("dialog", { name: "Solve a quick math question" })
          .count(),
        0,
        "long press suppresses synthetic math activation",
      );
      await page.clock.runFor(201);
      assert.equal(
        await longPressCard.isVisible(),
        true,
        "long-press stored card remains visible beyond the wrapper 200ms hover-close window",
      );
      assert.equal(
        await page
          .getByRole("dialog", { name: "Solve a quick math question" })
          .count(),
        0,
        "long-press card persistence does not restore a math dialog",
      );
    },
  );
});

test("SC05 D09-D11: four current-round hints cap visible stored rows, scroll internally, and avoid protected content", async () => {
  for (const [width, height] of [
    [320, 600],
    [390, 844],
    [768, 800],
    [1280, 600],
    [1440, 900],
  ]) {
    await withSession(
      { width, height },
      { random: 0.041, clockStart: fixedClockStart },
      async ({ page }) => {
        const controls = await earnCurrentRoundHints(page, 4);
        await refocusShowHint(controls);
        const card = await exact(
          page.getByRole("region", { name: "Stored hints", exact: true }),
          `${width}x${height} stored-hint card`,
        );
        const storedCat = await ordinaryOwner(page, "STORED_HINTS", `${width}x${height} stored-hint character`);
        await card.scrollIntoViewIfNeeded();
        const list = await exact(
          card.getByRole("list"),
          "stored-hint semantic list",
        );
        assert.equal(
          await page.evaluate(() =>
            document.activeElement?.textContent?.trim(),
          ),
          "Show hint",
          "keyboard discovery of stored facts starts from Show hint",
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await list.evaluate((element) => element === document.activeElement),
          true,
          "Tab from Show hint moves focus to the scrollable stored-fact list",
        );
        assert.equal(
          await card.evaluate((element) =>
            element.contains(document.activeElement),
          ),
          true,
          "stored-list keyboard focus remains inside the open stored-card wrapper",
        );
        assert.equal(
          await list.getByRole("listitem").count(),
          4,
          "four current-round facts remain readable rather than being discarded at the three-row cap",
        );
        const [
          metrics,
          cardBox,
          heading,
          instruction,
          safe,
          cat,
          form,
          newRound,
          surrender,
          history,
        ] = await Promise.all([
          list.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const rows = [...element.querySelectorAll("li")].filter((row) => {
              const rowRect = row.getBoundingClientRect();
              return rowRect.top >= rect.top && rowRect.bottom <= rect.bottom;
            }).length;
            const style = getComputedStyle(element);
            return {
              scrollHeight: element.scrollHeight,
              clientHeight: element.clientHeight,
              visibleRows: rows,
              overflowY: style.overflowY,
              maxHeight: Number.parseFloat(style.maxHeight),
            };
          }),
          card.boundingBox(),
          page
            .getByRole("heading", { name: "Guess the number", exact: true })
            .boundingBox(),
          controls.instruction.boundingBox(),
          page.getByLabel("Safe closed", { exact: true }).boundingBox(),
          storedCat.boundingBox(),
          controls.code.boundingBox(),
          controls.newRound.boundingBox(),
          controls.surrender.boundingBox(),
          controls.history.boundingBox(),
        ]);
        assert.equal(
          metrics.clientHeight,
          72,
          "stored fact viewport exposes exactly three complete 24px rows",
        );
        assert.equal(
          metrics.scrollHeight,
          96,
          "four short facts produce the exact four-row internal scroll extent",
        );
        assert.equal(
          metrics.visibleRows,
          3,
          "stored fact viewport exposes exactly three complete rows",
        );
        assert.equal(
          metrics.maxHeight,
          72,
          "stored fact list uses the approved 72px three-row cap",
        );
        assert.ok(
          ["auto", "scroll"].includes(metrics.overflowY),
          "stored facts expose a visible scrollable overflow path",
        );
        const documentScrollTop = await page.evaluate(() => scrollY);
        const pressListKey = async (key) => {
          await page.keyboard.press(key);
          assert.equal(
            await page.evaluate(() => scrollY),
            documentScrollTop,
            `${key} scrolls only the stored-fact list, never the document`,
          );
          assert.equal(
            await list.evaluate(
              (element) => element === document.activeElement,
            ),
            true,
            `${key} keeps keyboard focus on the stored-fact list`,
          );
          assert.equal(
            await card.evaluate((element) =>
              element.contains(document.activeElement),
            ),
            true,
            `${key} keeps focus inside the open stored-card wrapper`,
          );
          return list.evaluate((element) => element.scrollTop);
        };
        await page.keyboard.press("End");
        const endTop = await list.evaluate((element) => element.scrollTop);
        assert.ok(
          endTop > 0,
          "keyboard End scrolls the internal stored-fact list to reveal its fourth row",
        );
        assert.equal(
          await page.evaluate(() => scrollY),
          documentScrollTop,
          "End never scrolls the document",
        );
        assert.equal(
          await list.evaluate((element) => element === document.activeElement),
          true,
          "End keeps keyboard focus on the stored-fact list",
        );
        assert.equal(
          await card.evaluate((element) =>
            element.contains(document.activeElement),
          ),
          true,
          "End keeps focus inside the open stored-card wrapper",
        );
        const homeTop = await pressListKey("Home");
        assert.equal(
          homeTop,
          0,
          "keyboard Home returns the stored-fact list to its first row",
        );
        const downTop = await pressListKey("ArrowDown");
        assert.ok(
          downTop > homeTop,
          "keyboard ArrowDown advances the internal stored-fact scroll position",
        );
        const upTop = await pressListKey("ArrowUp");
        assert.ok(
          upTop < downTop,
          "keyboard ArrowUp decreases the internal stored-fact scroll position",
        );
        await pressListKey("Home");
        const pageDownTop = await pressListKey("PageDown");
        assert.ok(
          pageDownTop >=
            Math.min(
              metrics.clientHeight / 2,
              metrics.scrollHeight - metrics.clientHeight,
            ),
          "keyboard PageDown advances by a meaningful available stored-list viewport step",
        );
        const pageUpTop = await pressListKey("PageUp");
        assert.ok(
          pageUpTop < pageDownTop,
          "keyboard PageUp decreases the internal stored-fact scroll position",
        );
        assert.equal(
          await card.isVisible(),
          true,
          "keyboard scrolling the overflow list keeps its stored card open",
        );
        assert.ok(
          cardBox.x >= 12 &&
            cardBox.y >= 0 &&
            cardBox.x + cardBox.width <= width - 12,
          `${width}x${height} card preserves the 12px viewport gutter`,
        );
        for (const protectedBox of [
          heading,
          instruction,
          safe,
          cat,
          form,
          newRound,
          surrender,
          history,
        ]) {
          assert.equal(
            intersects(cardBox, protectedBox, 12),
            false,
            `${width}x${height} card avoids protected content or falls into normal flow`,
          );
        }
      },
    );
  }
});

test("SC05 D09-D10: reward is latest-wins, announces once, expires without losing storage, and New game invalidates old timers", async () => {
  await withSession(
    { width: 768, height: 800 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const controls = await earnFirstHint(page);
      const reward = await exact(
        page.getByRole("img", { name: "New hint reward", exact: true }),
        "newly-earned reward presentation",
      );
      assert.equal(
        await reward.getAttribute("role"),
        "img",
        "the named reward wrapper has the approved semantic image role",
      );
      assert.equal(
        await reward.locator('[role="status"], [aria-live]').count(),
        0,
        "reward artwork does not duplicate the separate live announcement channel",
      );
      await expectRewardReplacement(page, "earned reward replacement");
      const announcement = await exact(
        page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]'),
        "single polite reward announcement",
      );
      const firstText = await reward.innerText();
      assert.equal(
        await announcement.innerText(),
        `Earned hint: ${firstText}`,
        "reward and one polite announcement contain the exact same public fact",
      );
      await page.clock.runFor(4749);
      assert.equal(
        await reward.isVisible(),
        true,
        "reward remains through 4.75 seconds",
      );
      await page.clock.runFor(501);
      assert.equal(
        await reward.count(),
        0,
        "reward clears at 5000ms plus the approved tolerance",
      );
      await expectOrdinaryReturn(page, "PLAYING", true, "reward expiry");
      assert.equal(
        await announcement.count(),
        1,
        "the one polite atomic hint status persists after its transient reward closes",
      );
      assert.equal(
        await announcement.innerText(),
        `Earned hint: ${firstText}`,
        "transient reward expiry does not erase its announced earned fact",
      );
      await refocusShowHint(controls);
      const stored = await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "stored fact after transient expiry",
      );
      assert.equal(
        await stored.getByRole("listitem").count(),
        1,
        "expiry does not remove the persisted fact",
      );
      await page.keyboard.press("Escape");
      await controls.hint.click();
      await visibleQuestionAnswer(page);
      const laterReward = await exact(
        page.getByLabel("New hint reward", { exact: true }),
        "later latest-wins reward",
      );
      await expectRewardReplacement(page, "replacement reward");
      const laterText = await laterReward.innerText();
      assert.notEqual(
        laterText,
        firstText,
        "a later accepted eligible fact replaces rather than queues the reward",
      );
      assert.equal(
        await page
          .locator('[role="status"][aria-live="polite"][aria-atomic="true"]')
          .count(),
        1,
        "only one reward announcement region exists",
      );
      await page.clock.runFor(1000);
      assert.equal(
        await laterReward.isVisible(),
        true,
        "the earlier expiry cannot erase the newer reward",
      );
      await controls.newRound.click();
      await page.clock.runFor(0);
      assert.equal(
        await page.getByLabel("New hint reward", { exact: true }).count(),
        0,
        "New game invalidates current reward immediately",
      );
      await expectOrdinaryReturn(page, "PLAYING", true, "New game after reward");
      await expectHintLamp(controls.hint, false, "New game invalidates former-round lamp state");
      await page.clock.runFor(6000);
      assert.equal(
        await page.getByLabel("New hint reward", { exact: true }).count(),
        0,
        "stale timer callbacks cannot resurrect former-round reward state",
      );
      await expectHintLamp(controls.hint, false, "stale former-round callbacks cannot illuminate the new round");
    },
  );
});

test("SC05 provider: one persistent atomic hint status and stored-card focus races stay current-round only", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await gameControls(page);
      assert.equal(
        await controls.newRound.locator("xpath=..").getByRole("button").count(),
        4,
        "the menu remains a four-button grid without an extra hint-status action",
      );
      const announcement = await exact(
        page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]'),
        "persistent polite atomic hint status",
      );
      assert.deepEqual(
        await announcement.evaluate((element) => [
          element.getAttribute("role"),
          element.getAttribute("aria-live"),
          element.getAttribute("aria-atomic"),
        ]),
        ["status", "polite", "true"],
        "hint feedback exposes one persistent polite atomic live region",
      );
      await controls.hint.click();
      await visibleQuestionAnswer(page);
      const reward = await exact(
        page.getByLabel("New hint reward", { exact: true }),
        "single earned hint reward",
      );
      const earnedFact = await reward.innerText();
      assert.equal(
        await page.getByLabel("New hint reward", { exact: true }).count(),
        1,
        "one earned fact creates one reward presentation rather than duplicate reward statuses",
      );
      assert.equal(
        await announcement.innerText(),
        `Earned hint: ${earnedFact}`,
        "the sole persistent status announces the current earned fact",
      );

      await expireHintReward(page);
      await refocusShowHint(controls);
      const focusCard = await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "focus-opened stored card",
      );
      const focusList = await exact(
        focusCard.getByRole("list", { name: "Stored hint list", exact: true }),
        "focus-opened stored hint list",
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await focusList.evaluate(
          (element) => element === document.activeElement,
        ),
        true,
        "first Tab from Show hint enters the stored-hint list without closing its card",
      );
      assert.equal(
        await focusCard.isVisible(),
        true,
        "first Tab keeps focus inside the stored-hint wrapper and leaves its card open",
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "second Tab leaves the hint wrapper and closes the stored card through public blur behavior",
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        "History",
        "second Tab advances outside the hint wrapper to the next menu action",
      );

      await controls.hint.focus();
      await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "reopened stored card for Escape",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "Escape closes the stored card",
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        "Show hint",
        "Escape restores focus to the stored-card trigger",
      );

      await controls.hint.hover();
      await page.clock.runFor(150);
      await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "hover-opened stored card",
      );
      await page.mouse.move(0, 0);
      await page.clock.runFor(100);
      await controls.hint.hover();
      await page.clock.runFor(200);
      await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "re-entered stored card after obsolete leave deadline",
      );

      await page.mouse.move(0, 0);
      // Restore the stable top-of-game viewport after focus-driven card navigation before a distinct
      // New game activation.
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(0);
      await controls.newRound.click();
      await page.clock.runFor(500);
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "current-round reset cancels pending local card state instead of reopening stale hints",
      );
      assert.equal(
        await page.getByLabel("New hint reward", { exact: true }).count(),
        0,
        "current-round reset also clears the stale reward presentation",
      );
      assert.equal(
        await announcement.count(),
        1,
        "reset retains one persistent hint-status owner without creating duplicates",
      );
    },
  );
});

test("SC05 provider: exhausted hints retain their single public status instead of creating another reward channel", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await gameControls(page);
      const announcement = await exact(
        page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]'),
        "exhaustion status owner",
      );
      let exhausted = false;
      for (let attempt = 1; attempt <= 12; attempt += 1) {
        const rewardsBeforeClick = await page
          .getByLabel("New hint reward", { exact: true })
          .count();
        await controls.hint.click();
        const dialog = page.getByRole("dialog", {
          name: "Solve a quick math question",
        });
        if (await dialog.count()) {
          await visibleQuestionAnswer(page);
          await page.clock.runFor(5001);
          continue;
        }
        if (/no further hints/i.test(await announcement.innerText())) {
          exhausted = true;
          assert.equal(
            await dialog.count(),
            0,
            "the exhausted final Show hint activation does not open another challenge",
          );
          assert.equal(
            await page.getByLabel("New hint reward", { exact: true }).count(),
            rewardsBeforeClick,
            "the exhausted final Show hint activation adds no reward",
          );
          break;
        }
        assert.fail(
          `Show hint attempt ${attempt} neither opened a public challenge nor announced exhaustion`,
        );
      }
      assert.equal(
        exhausted,
        true,
        "a bounded public Show hint flow eventually announces exhaustion",
      );
      assert.equal(
        await page
          .locator('[role="status"][aria-live="polite"][aria-atomic="true"]')
          .count(),
        1,
        "exhaustion does not add a second live status",
      );
    },
  );
});

test("SC05 provider: current-round reset cancels a pending touch card before it can reopen", async () => {
  await withSession(
    { width: 390, height: 844 },
    { hasTouch: true, random: 0.041, clockStart: fixedClockStart },
    async ({ page, context }) => {
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      const hintBox = await controls.hint.boundingBox();
      assert.ok(hintBox, "touch reset checks a rendered Show hint target");
      const client = await context.newCDPSession(page);
      const touch = {
        x: Math.round(hintBox.x + hintBox.width / 2),
        y: Math.round(hintBox.y + hintBox.height / 2),
        id: 17,
      };
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [touch],
      });
      await page.clock.runFor(300);
      await controls.newRound.click();
      await page.clock.runFor(500);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "reset prevents an old touch timer from reopening a former-round stored card",
      );
    },
  );
});

test("SC05 provider: Escape from a keyboard-focused stored-hint list closes once and restores its trigger", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      await refocusShowHint(controls);
      const card = await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "Escape stored-hint card",
      );
      const list = await exact(
        card.getByRole("list", { name: "Stored hint list", exact: true }),
        "Escape stored-hint list",
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await list.evaluate((element) => element === document.activeElement),
        true,
        "Tab enters the stored-hint list before Escape",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "Escape from the list closes the stored card",
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        "Show hint",
        "Escape from the list restores focus to Show hint",
      );
      await page.waitForTimeout(250);
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "restored trigger focus does not reopen the just-dismissed stored card",
      );
    },
  );
});

test("SC05 provider: terminal outcomes retain earned stored hints without re-enabling math activation", async () => {
  for (const outcome of ["won", "surrendered"])
    await withSession(
      { width: 390, height: 844 },
      { random: 0.041, clockStart: fixedClockStart },
      async ({ page }) => {
        const controls = await earnFirstHint(page);
        if (outcome === "won") {
          await controls.code.fill("42");
          await controls.submit.click();
        } else {
          await controls.surrender.click();
        }
        await page.clock.runFor(5001);
        assert.equal(
          await page.getByLabel("New hint reward", { exact: true }).count(),
          0,
          `${outcome} reward expiry does not discard the earned hint`,
        );
        await expectOrdinaryReturn(
          page,
          outcome === "won" ? "WON" : "SURRENDERED",
          false,
          `${outcome} terminal presentation`,
        );
        assert.equal(
          await page.evaluate(() => document.activeElement?.textContent?.trim()),
          "New game",
          `${outcome} initial terminal transition focuses New game`,
        );
        await controls.hint.click();
        await page.clock.runFor(150);
        await exact(
          page.getByRole("region", { name: "Stored hints", exact: true }),
          `${outcome} pointer-opened stored-hint card`,
        );
        assert.equal(
          await page.evaluate(() => document.activeElement?.textContent?.trim()),
          "Show hint",
          `${outcome} pointer-opening earned hints does not refocus New game`,
        );
        await controls.hint.focus();
        const card = await exact(
          page.getByRole("region", { name: "Stored hints", exact: true }),
          `${outcome} retained stored-hint card`,
        );
        const list = await exact(
          card.getByRole("list", { name: "Stored hint list", exact: true }),
          `${outcome} retained stored-hint list`,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await list.evaluate((element) => element === document.activeElement),
          true,
          `${outcome} retains keyboard reachability for the earned hint list`,
        );
        await page.keyboard.press("Escape");
        await controls.hint.click();
        assert.equal(
          await page
            .getByRole("dialog", { name: "Solve a quick math question" })
            .count(),
          0,
          `${outcome} Show hint activation cannot open a new math challenge`,
        );
      },
    );
});

test("SC05 provider: reward row retains 12px narrow gutters while copy can reflow", async () => {
  for (const [width, height] of [
    [320, 600],
    [390, 844],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        await earnFirstHint(page);
        const reward = await exact(
          page.getByLabel("New hint reward", { exact: true }),
          `${width}px earned reward row`,
        );
        const copy = await exact(reward.locator("p"), `${width}px reward copy`);
        const [rewardBox, copyBox] = await Promise.all([
          reward.boundingBox(),
          copy.boundingBox(),
        ]);
        assert.ok(
          rewardBox && copyBox,
          `${width}px reward row and copy render`,
        );
        assert.ok(
          rewardBox.x >= 12 && rewardBox.x + rewardBox.width <= width - 12,
          `${width}px reward row itself remains inside the 12px viewport gutters`,
        );
        assert.ok(
          copyBox.width > 0 &&
            copyBox.x >= rewardBox.x &&
            copyBox.x + copyBox.width <= rewardBox.x + rewardBox.width,
          `${width}px reward copy may shrink or wrap within its row without escaping it`,
        );
        assert.equal(
          await reward.evaluate(
            (element) => getComputedStyle(element).pointerEvents,
          ),
          "none",
          `${width}px reward wrapper never intercepts scene pointer input`,
        );
        await expectRewardReplacement(page, `${width}px reward slot ownership`);
      },
    );
});

test("SC05 provider: reduced-motion safe open and close never animate", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const controls = await gameControls(page);
      const closed = await exact(
        page.getByLabel("Safe closed", { exact: true }),
        "reduced-motion closed safe",
      );
      assert.equal(
        await closed.evaluate(
          (element) => getComputedStyle(element).animationName,
        ),
        "none",
        "reduced-motion closed safe has no animation name",
      );
      await controls.code.fill("42");
      await controls.submit.click();
      const opened = await exact(
        page.getByLabel("Safe opened", { exact: true }),
        "reduced-motion opened safe",
      );
      assert.equal(
        await opened.evaluate(
          (element) => getComputedStyle(element).animationName,
        ),
        "none",
        "reduced-motion opened safe has no animation name",
      );
      await controls.newRound.click();
      const resetClosed = await exact(
        page.getByLabel("Safe closed", { exact: true }),
        "reduced-motion reset safe",
      );
      assert.equal(
        await resetClosed.evaluate(
          (element) => getComputedStyle(element).animationName,
        ),
        "none",
        "reduced-motion reset safe has no animation name",
      );
    },
  );
});
}

function register03() {


test("SC05 provider: a quick stored-hint hover then click opens only the math dialog and leaves no stale card", async () => {
  await withSession(
    { width: 1175, height: 900 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      await refocusShowHint(controls);
      await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "stored hints after an earned fact",
      );
      // Move focus outside the hint wrapper so this round starts closed, then re-enter for less than
      // the 150ms hover delay.
      await controls.code.focus();
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "stored hint card closes before the quick hover-click path",
      );
      const hintBox = await controls.hint.boundingBox();
      assert.ok(hintBox, "Show hint has a rendered pointer target");
      await page.mouse.move(
        hintBox.x + hintBox.width / 2,
        hintBox.y + hintBox.height / 2,
      );
      await page.clock.runFor(149);
      await controls.hint.click();
      const dialog = await exact(
        page.getByRole("dialog", {
          name: "Solve a quick math question",
          exact: true,
        }),
        "quick click opens the math dialog",
      );
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "stored card does not mount underneath the dialog before the queued hover deadline",
      );
      await page.clock.runFor(2);
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "expired hover callback cannot mount the stored card under an open dialog",
      );
      await page
        .getByRole("button", { name: "Close hint challenge", exact: true })
        .click();
      await dialog.waitFor({ state: "hidden" });
      const focusDrivenCard = await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "focus-restored stored card after dialog close",
      );
      assert.equal(
        await controls.hint.getAttribute("aria-describedby"),
        await focusDrivenCard.getAttribute("id"),
        "the post-close card is the approved focus-driven description of Show hint",
      );
      await controls.code.focus();
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "blurring Show hint closes its focus-driven stored card",
      );
      await page.clock.runFor(250);
      assert.equal(
        await page
          .getByRole("region", { name: "Stored hints", exact: true })
          .count(),
        0,
        "no stale hover callback can reopen the card after its legitimate focus-driven close",
      );
    },
  );
});
}

module.exports = { register01, register02, register03 };
