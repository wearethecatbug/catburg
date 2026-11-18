const assert = require("node:assert/strict");
const test = require("node:test");
const { withSession } = require("./shared/session.cjs");
const { fixedClockStart } = require("./shared/runtime-context.cjs");
const { expectHintLamp } = require("./shared/sc08-contract.cjs");
const { pauseClockAtCurrentTime, exact, ordinaryOwner, expectRewardReplacement, expectOrdinaryReturn, gameControls, openHintDialog, solveVisibleQuestion, visibleQuestionAnswer, approximatelyEqual } = require("./shared/game-controls.cjs");
const { intersects, clickVisibleArtwork } = require("./shared/artwork-geometry.cjs");
const { waitForStableVisualGeometry } = require("./shared/readiness.cjs");



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
      const abandonedAnswer = solveVisibleQuestion(
        await hint.dialog.locator("label[for='hint-answer']").innerText(),
      );
      await hint.dialog
        .getByRole("button", { name: "Give up", exact: true })
        .click();
      assert.equal(await hint.answer.isDisabled(), true);
      assert.equal(
        await hint.answer.inputValue(),
        String(abandonedAnswer),
        "SCV03 Give up replaces the former blank-input expectation with the visible equation answer",
      );
      assert.equal(
        await page.getByText(/even|odd/i).count(),
        0,
        "abandonment yields no safe parity fact",
      );
      await page
        .getByRole("button", { name: "New question", exact: true })
        .click();
      assert.equal(
        await hint.answer.inputValue(),
        "",
        "New question still starts the replacement challenge with a blank answer input",
      );
      const solvedQuestion = await hint.dialog
        .locator("label[for='hint-answer']")
        .innerText();
      await hint.answer.fill(String(solveVisibleQuestion(solvedQuestion)));
      await page.getByRole("button", { name: "Check", exact: true }).click();
      await hint.dialog
        .getByText("Great job! You earned a hint!", { exact: true })
        .waitFor({ state: "visible" });
      await page.clock.runFor(200);
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

test("SC05 D09: physical card hover keeps Stored hints readable, highlights its sticky surface, and hides its text caret", async () => {
  await withSession(
    { width: 1175, height: 900 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      await pauseClockAtCurrentTime(page);
      await controls.hint.evaluate((element) => element.blur());
      await page.mouse.move(1, 1);

      const stored = page.getByRole("region", { name: "Stored hints", exact: true });
      const hintBox = await controls.hint.boundingBox();
      assert.ok(hintBox, "Show hint has a measurable pointer target");
      await page.mouse.move(hintBox.x + hintBox.width / 2, hintBox.y + hintBox.height / 2);
      await page.clock.runFor(150);
      const card = await exact(stored, "pointer-opened stored hints for hover-surface checks");
      const title = await exact(
        card.getByRole("heading", { name: "Stored hints", exact: true }),
        "sticky Stored hints heading",
      );
      const list = await exact(
        card.getByRole("list", { name: "Stored hint list", exact: true }),
        "stored hint list",
      );
      const beforeHover = await card.evaluate((element) => {
        const titleElement = element.querySelector("h2");
        const cardStyle = getComputedStyle(element);
        const titleStyle = getComputedStyle(titleElement);
        return {
          cardBackground: cardStyle.backgroundColor,
          border: cardStyle.borderColor,
          shadow: cardStyle.boxShadow,
          titleBackground: titleStyle.backgroundColor,
        };
      });
      const cardBox = await card.boundingBox();
      assert.ok(cardBox, "stored hints card has measurable physical hover geometry");
      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      const onCardHover = await card.evaluate((element) => {
        const titleElement = element.querySelector("h2");
        const cardStyle = getComputedStyle(element);
        const titleStyle = getComputedStyle(titleElement);
        return {
          cardBackground: cardStyle.backgroundColor,
          border: cardStyle.borderColor,
          shadow: cardStyle.boxShadow,
          titleBackground: titleStyle.backgroundColor,
          cardCaret: cardStyle.caretColor,
          titleCaret: titleStyle.caretColor,
          cardEditable: element.isContentEditable,
          titleEditable: titleElement.isContentEditable,
          editableDescendants: element.querySelectorAll("[contenteditable]:not([contenteditable='false'])").length,
        };
      });
      assert.notDeepEqual(
        {
          cardBackground: onCardHover.cardBackground,
          border: onCardHover.border,
          shadow: onCardHover.shadow,
        },
        {
          cardBackground: beforeHover.cardBackground,
          border: beforeHover.border,
          shadow: beforeHover.shadow,
        },
        "physical Stored hints hover changes its own visible surface without fixing a particular color token",
      );
      assert.equal(
        onCardHover.titleBackground,
        onCardHover.cardBackground,
        "the sticky Stored hints heading shares the highlighted card surface",
      );
      for (const [elementName, caretColor] of [
        ["card", onCardHover.cardCaret],
        ["heading", onCardHover.titleCaret],
      ])
        assert.match(
          caretColor,
          /(?:transparent|rgba\([^)]*,\s*0\))$/,
          `${elementName} inherits a transparent caret color`,
        );
      assert.equal(onCardHover.cardEditable, false, "stored hints card is not editable");
      assert.equal(onCardHover.titleEditable, false, "stored hints heading is not editable");
      assert.equal(onCardHover.editableDescendants, 0, "stored hints contains no editable text surface");

      await title.click();
      await page.clock.runFor(5001);
      assert.equal(
        await stored.isVisible(),
        true,
        "clicking the heading cannot close Stored hints while the physical pointer remains inside the card",
      );
      await list.focus();
      assert.equal(
        await list.evaluate((element) => element === document.activeElement),
        true,
        "the semantic hint list remains keyboard-focusable while the pointer is inside the card",
      );
      await page.clock.runFor(250);
      assert.equal(await stored.isVisible(), true, "focused Stored hints remains open during physical hover");
    },
  );
});

test("Stored hints: early browser timer callbacks settle earned stored-hint open and close deadlines", async () => {
  await withSession(
    { width: 1440, height: 900 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const controls = await gameControls(page);
      await controls.hint.click();
      await visibleQuestionAnswer(page);
      await page.clock.runFor(5001);
      await controls.hint.evaluate((element) => element.blur());
      await page.mouse.move(1, 1);
      await page.clock.runFor(240);

      const stored = page.getByRole("region", {
        name: "Stored hints",
        exact: true,
      });
      await page.evaluate(() => {
        const nativeSetTimeout = window.setTimeout;
        const earlyWake = { delay: null, trace: [] };
        window.__safeCatHintTimerEarlyWake = {
          arm(delay) {
            earlyWake.delay = delay;
          },
          readTrace() {
            return earlyWake.trace;
          },
          restore() {
            window.setTimeout = nativeSetTimeout;
            delete window.__safeCatHintTimerEarlyWake;
          },
        };
        window.setTimeout = function (callback, delay, ...args) {
          const armedDelay = earlyWake.delay;
          if (
            armedDelay === null ||
            typeof callback !== "function" ||
            delay < armedDelay - 4 ||
            delay > armedDelay + 1
          )
            return nativeSetTimeout.call(this, callback, delay, ...args);
          earlyWake.delay = null;
          const scheduledAt = performance.now();
          return nativeSetTimeout.call(
            this,
            (...callbackArgs) => {
              earlyWake.trace.push({
                delay,
                elapsed: performance.now() - scheduledAt,
              });
              return callback(...callbackArgs);
            },
            Math.max(0, delay - 2),
            ...args,
          );
        };
      });

      try {
        await page.evaluate(() => window.__safeCatHintTimerEarlyWake.arm(150));
        await controls.hint.hover();
        await page.clock.runFor(149);
        assert.equal(
          await stored.count(),
          0,
          "an open callback delivered at 148ms cannot disclose stored hints before the 150ms deadline",
        );
        await page.clock.runFor(10);
        await exact(
          stored,
          "stored hints settle open after the ignored early open callback without pointer re-entry",
        );

        await page.evaluate(() => window.__safeCatHintTimerEarlyWake.arm(201));
        await page.mouse.move(1, 1);
        await page.clock.runFor(200);
        assert.equal(
          await stored.count(),
          1,
          "a close callback delivered at 199ms cannot hide stored hints before the 201ms grace deadline",
        );
        await page.clock.runFor(10);
        assert.equal(
          await stored.count(),
          0,
          "stored hints settle closed after the ignored early close callback without another pointer movement",
        );

        const trace = await page.evaluate(() => window.__safeCatHintTimerEarlyWake.readTrace());
        assert.deepEqual(
          trace.map((entry) => Math.round(entry.elapsed)),
          [148, 199],
          "the oracle exercised an early callback for each native deadline",
        );
      } finally {
        await page.evaluate(() => window.__safeCatHintTimerEarlyWake?.restore());
      }
    },
  );
});

test("SC05 D09: an earned hint remains hover-discoverable after a wrong guess", async () => {
  await withSession(
    { width: 630, height: 994 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await controls.code.fill("333");
      await controls.submit.click();
      await ordinaryOwner(page, "WRONG", "wrong guess keeps its ordinary cat owner");
      await exact(
        page.getByText("Incorrect code, try again.", { exact: true }),
        "wrong guess feedback",
      );
      await pauseClockAtCurrentTime(page);

      const storedCard = page.getByRole("region", {
        name: "Stored hints",
        exact: true,
      });
      await page.mouse.move(0, 0);
      const hintBox = await controls.hint.boundingBox();
      assert.ok(hintBox, "Show hint has a pointer target after the wrong guess");
      await page.mouse.move(
        hintBox.x + hintBox.width / 2,
        hintBox.y + hintBox.height / 2,
      );
      await page.clock.runFor(149);
      assert.equal(
        await storedCard.count(),
        0,
        "wrong-guess hover keeps the existing 150ms dwell before revealing stored hints",
      );
      await page.clock.runFor(1);
      const card = await exact(storedCard, "wrong-guess pointer-opened stored card");
      const cardBox = await card.boundingBox();
      assert.ok(cardBox, "wrong-guess stored card has measurable hover geometry");

      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.mouse.move(0, 0);
      await page.clock.runFor(200);
      assert.equal(
        await storedCard.count(),
        1,
        "wrong-guess stored card remains through the existing 201ms pointer-leave grace",
      );
      await page.mouse.move(
        hintBox.x + hintBox.width / 2,
        hintBox.y + hintBox.height / 2,
      );
      await page.clock.runFor(250);
      assert.equal(
        await storedCard.count(),
        1,
        "re-entering Show hint cancels the pending wrong-guess close timer",
      );

      await page.mouse.move(0, 0);
      await page.clock.runFor(201);
      assert.equal(
        await storedCard.count(),
        0,
        "wrong-guess stored card closes after its existing leave grace",
      );
      await ordinaryOwner(page, "WRONG", "closing stored hints resumes the wrong-guess cat owner");
      await exact(
        page.getByText("Incorrect code, try again.", { exact: true }),
        "closing stored hints retains wrong-guess feedback",
      );
    },
  );
});

test("SC05 D09: earned stored hints remain hover-discoverable across active pet animations", async () => {
  await withSession(
    { width: 1175, height: 900 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      await pauseClockAtCurrentTime(page);
      await controls.hint.evaluate((element) => element.blur());
      const stored = page.getByRole("region", {
        name: "Stored hints",
        exact: true,
      });
      const hoverHint = async () => {
        const hintBox = await controls.hint.boundingBox();
        assert.ok(hintBox, "Show hint has a rendered pointer target during pet feedback");
        await page.mouse.move(hintBox.x + hintBox.width / 2, hintBox.y + hintBox.height / 2);
      };
      const leaveHint = () => page.mouse.move(0, 0);

      await clickVisibleArtwork(page, controls.cat);
      await ordinaryOwner(page, "PET_NORMAL", "pet click starts the normal cat animation");
      await leaveHint();
      await hoverHint();
      await page.clock.runFor(149);
      assert.equal(await stored.count(), 0, "normal pet feedback retains the 150ms stored-hint dwell");
      await page.clock.runFor(1);
      await exact(stored, "stored hint opens at the 150ms dwell during normal pet feedback");
      await ordinaryOwner(page, "PET_NORMAL", "stored hints do not replace the active normal cat animation");
      await page.clock.runFor(1051);
      assert.equal(await stored.isVisible(), true, "stationary pointer keeps stored hints open through normal-pet settle");
      await ordinaryOwner(page, "PLAYING", "normal pet feedback settles while stored hints stays open");
      await leaveHint();
      await page.clock.runFor(201);
      assert.equal(await stored.count(), 0, "normal-pet stored hints close after the 201ms leave grace");

      await clickVisibleArtwork(page, controls.cat);
      await ordinaryOwner(page, "PET_NORMAL", "second pet starts a fresh normal animation");
      await page.clock.runFor(1100);
      await hoverHint();
      await page.clock.runFor(149);
      assert.equal(await stored.count(), 0, "near-settle normal-pet hover keeps its pending dwell until 150ms");
      await page.clock.runFor(1);
      await exact(stored, "near-settle hover survives normal-pet settlement without re-entry");
      await ordinaryOwner(page, "PLAYING", "near-settle stored hint leaves the settled cat visible");
      await leaveHint();
      await page.clock.runFor(201);
      assert.equal(await stored.count(), 0, "near-settle stored hints retain the 201ms leave grace");
    },
  );

  await withSession(
    { width: 1175, height: 900 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      await pauseClockAtCurrentTime(page);
      await controls.hint.evaluate((element) => element.blur());
      const missed = page.locator('[data-presentation-mode="PET_MISSED"]');
      for (let elapsed = 0; elapsed < 40_000 && await missed.count() === 0; elapsed += 1000)
        await page.clock.runFor(1000);
      await ordinaryOwner(page, "PET_MISSED", "unheeded pet prompt reaches missed-cat feedback");

      const stored = page.getByRole("region", {
        name: "Stored hints",
        exact: true,
      });
      await page.mouse.move(0, 0);
      const hintBox = await controls.hint.boundingBox();
      assert.ok(hintBox, "Show hint remains pointer reachable during missed-cat feedback");
      await page.mouse.move(hintBox.x + hintBox.width / 2, hintBox.y + hintBox.height / 2);
      await page.clock.runFor(149);
      assert.equal(await stored.count(), 0, "missed-cat feedback retains the 150ms stored-hint dwell");
      await page.clock.runFor(1);
      await exact(stored, "stored hint opens at the 150ms dwell during missed-cat feedback");
      await ordinaryOwner(page, "PET_MISSED", "stored hints do not replace missed-cat feedback");
      await page.clock.runFor(5000);
      assert.equal(await stored.isVisible(), true, "stationary pointer keeps stored hints open through missed-cat settle");
      await ordinaryOwner(page, "PLAYING", "missed-cat feedback settles while stored hints stays open");
      await page.mouse.move(0, 0);
      await page.clock.runFor(201);
      assert.equal(await stored.count(), 0, "missed-cat stored hints close after the 201ms leave grace");
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

test("SC05 D09-D11: Stored hints stays inside the compact gameplay viewport and scrolls as one card", async () => {
  for (const factCount of [2, 4]) {
    await withSession(
      { width: 630, height: 994 },
      { random: 0.041, clockStart: fixedClockStart },
      async ({ page }) => {
        const controls = await earnCurrentRoundHints(page, factCount);
        const closedDocumentHeight = await page.evaluate(
          () => document.documentElement.scrollHeight,
        );
        await refocusShowHint(controls);
        await waitForStableVisualGeometry(page);
        const card = await exact(
          page.getByRole("region", { name: "Stored hints", exact: true }),
          `${factCount}-fact compact Stored hints card`,
        );
        const list = await exact(
          card.getByRole("list", { name: "Stored hint list", exact: true }),
          `${factCount}-fact compact Stored hints list`,
        );
        const title = await exact(
          card.getByRole("heading", { name: "Stored hints", exact: true }),
          `${factCount}-fact compact Stored hints heading`,
        );
        const [cardBox, titleBox, cardMetrics] = await Promise.all([
          card.boundingBox(),
          title.boundingBox(),
          card.evaluate((element) => ({
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
          })),
        ]);
        assert.ok(cardBox && titleBox, "compact card and sticky heading have measured geometry");
        assert.ok(
          cardBox.x >= 12 &&
            cardBox.y >= 12 &&
            cardBox.x + cardBox.width <= 630 - 12 &&
            cardBox.y + cardBox.height <= 994 - 12,
          `${factCount} compact facts stay entirely inside the pale gameplay viewport`,
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollHeight),
          closedDocumentHeight,
          `${factCount} compact facts do not extend the document below its background`,
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
          `${factCount} compact facts do not create horizontal overflow`,
        );
        assert.equal(
          await list.getByRole("listitem").count(),
          factCount,
          `${factCount} compact facts remain in the named semantic list`,
        );

        assert.ok(
          cardMetrics.scrollHeight > cardMetrics.clientHeight,
          `${factCount} wrapped facts genuinely overflow the single stored-card scrollport`,
        );
        const documentScrollTop = await page.evaluate(() => scrollY);
        await page.mouse.move(
          titleBox.x + titleBox.width / 2,
          titleBox.y + titleBox.height / 2,
        );
        await page.mouse.wheel(0, 1000);
        await page.waitForFunction(
          () => document.getElementById("stored-hints-card")?.scrollTop > 0,
        );
        const scrolledTop = await card.evaluate((element) => element.scrollTop);
        assert.ok(scrolledTop > 0, "wheel over the sticky title scrolls the whole stored card");
        assert.equal(
          await page.evaluate(() => scrollY),
          documentScrollTop,
          "wheel over the title never transfers scrolling to the document",
        );
        const [stickyTitleBox, scrolledCardBox] = await Promise.all([
          title.boundingBox(),
          card.boundingBox(),
        ]);
        assert.ok(stickyTitleBox && scrolledCardBox, "scrolled card keeps measurable sticky-title geometry");
        assert.ok(
          Math.abs(stickyTitleBox.y - scrolledCardBox.y) <= 4,
          "Stored hints heading remains pinned to the card while its facts scroll",
        );
        await page.mouse.move(
          scrolledCardBox.x + 6,
          scrolledCardBox.y + scrolledCardBox.height - 6,
        );
        await page.mouse.wheel(0, 1000);
        assert.equal(
          await page.evaluate(() => scrollY),
          documentScrollTop,
          "wheel at the card edge stays contained after its final fact",
        );
      },
    );
  }
});

test("SC05 D09-D11: four current-round hints use the stored card as the scrollport and avoid protected content", async () => {
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
          cardMetrics,
          listMetrics,
          cardBox,
          heading,
          instruction,
          safe,
          cat,
          form,
          hint,
          newRound,
          surrender,
          history,
        ] = await Promise.all([
          card.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              scrollHeight: element.scrollHeight,
              clientHeight: element.clientHeight,
              overflowY: style.overflowY,
              maxHeight: Number.parseFloat(style.maxHeight),
            };
          }),
          list.evaluate((element) => ({
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            overflowY: getComputedStyle(element).overflowY,
          })),
          card.boundingBox(),
          page
            .getByRole("heading", { name: "Guess the number", exact: true })
            .boundingBox(),
          controls.instruction.boundingBox(),
          page.getByLabel("Safe closed", { exact: true }).boundingBox(),
          storedCat.boundingBox(),
          controls.code.boundingBox(),
          controls.hint.boundingBox(),
          controls.newRound.boundingBox(),
          controls.surrender.boundingBox(),
          controls.history.boundingBox(),
        ]);
        assert.ok(
          cardMetrics.scrollHeight > cardMetrics.clientHeight,
          "four facts genuinely overflow the stored-card scrollport",
        );
        assert.ok(
          ["auto", "scroll"].includes(cardMetrics.overflowY),
          "the stored card exposes the native vertical scrollport",
        );
        assert.equal(
          listMetrics.scrollHeight,
          listMetrics.clientHeight,
          "the named semantic list no longer owns a separate scrollport",
        );
        assert.equal(
          listMetrics.overflowY,
          "visible",
          "the named semantic list preserves normal visible overflow inside its card",
        );
        const documentScrollTop = await page.evaluate(() => scrollY);
        const pressListKey = async (key) => {
          await page.keyboard.press(key);
          assert.equal(
            await page.evaluate(() => scrollY),
            documentScrollTop,
            `${key} scrolls only the stored card, never the document`,
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
          return card.evaluate((element) => element.scrollTop);
        };
        await page.keyboard.press("End");
        const endTop = await card.evaluate((element) => element.scrollTop);
        assert.ok(
          endTop > 0,
          "keyboard End scrolls the stored card to reveal its fourth fact",
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
          "keyboard Home returns the stored card to its first fact",
        );
        const downTop = await pressListKey("ArrowDown");
        assert.ok(
          downTop > homeTop,
          "keyboard ArrowDown advances the stored-card scroll position",
        );
        const upTop = await pressListKey("ArrowUp");
        assert.ok(
          upTop < downTop,
          "keyboard ArrowUp decreases the stored-card scroll position",
        );
        await pressListKey("Home");
        const pageDownTop = await pressListKey("PageDown");
        assert.ok(
          pageDownTop >=
            Math.min(
              cardMetrics.clientHeight / 2,
              cardMetrics.scrollHeight - cardMetrics.clientHeight,
            ),
          "keyboard PageDown advances by a meaningful stored-card viewport step",
        );
        const pageUpTop = await pressListKey("PageUp");
        assert.ok(
          pageUpTop < pageDownTop,
          "keyboard PageUp decreases the stored-card scroll position",
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
        const opensAboveHint = cardBox.y + cardBox.height <= hint.y;
        for (const protectedBox of [
          heading,
          instruction,
          safe,
          cat,
          form,
          hint,
          newRound,
          ...(opensAboveHint ? [] : [surrender, history]),
        ]) {
          assert.equal(
            intersects(cardBox, protectedBox, 12),
            false,
            `${width}x${height} card avoids protected content; nearby menu buttons may sit below an above-opened card`,
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

test("SC05 provider: Escape closes an animation-previewed stored-hint list after the cat settles", async () => {
  await withSession(
    { width: 1175, height: 900 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      await pauseClockAtCurrentTime(page);
      await controls.hint.evaluate((element) => element.blur());

      await clickVisibleArtwork(page, controls.cat);
      await ordinaryOwner(page, "PET_NORMAL", "pet animation before the local stored-hint preview");
      const hintBox = await controls.hint.boundingBox();
      assert.ok(hintBox, "Show hint remains reachable during pet animation");
      await page.mouse.move(hintBox.x + hintBox.width / 2, hintBox.y + hintBox.height / 2);
      await page.clock.runFor(150);
      const card = await exact(
        page.getByRole("region", { name: "Stored hints", exact: true }),
        "animation-previewed stored-hint card",
      );
      await page.clock.runFor(1051);
      await ordinaryOwner(page, "PLAYING", "animation settles while its stored-hint preview remains open");

      const list = await exact(
        card.getByRole("list", { name: "Stored hint list", exact: true }),
        "animation-previewed stored-hint list",
      );
      await list.focus();
      assert.equal(
        await list.evaluate((element) => element === document.activeElement),
        true,
        "keyboard focus reaches the animation-previewed hint list before Escape",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.getByRole("region", { name: "Stored hints", exact: true }).count(),
        0,
        "Escape closes the settled animation preview without immediately reopening stored hints",
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        "Show hint",
        "Escape from the settled animation preview restores Show hint focus",
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

test("SC05: a scheduled History-preview close preserves focus inside Stored hints and closes after outside blur", async () => {
  await withSession(
    { width: 2560, height: 1440 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      await controls.history.click();
      await controls.history.focus();
      await pauseClockAtCurrentTime(page);
      assert.equal(
        await controls.history.evaluate((element) => element === document.activeElement),
        true,
        "History is focused before its local Stored hints preview opens",
      );

      const stored = page.getByRole("region", { name: "Stored hints", exact: true });
      const hintBox = await controls.hint.boundingBox();
      assert.ok(hintBox, "Show hint has a pointer target while focused History is open");
      await page.mouse.move(hintBox.x + hintBox.width / 2, hintBox.y + hintBox.height / 2);
      await page.clock.runFor(150);
      const card = await exact(stored, "History-previewed Stored hints card");
      const list = await exact(
        card.getByRole("list", { name: "Stored hint list", exact: true }),
        "History-previewed Stored hints list",
      );

      await page.mouse.move(0, 0);
      await list.focus();
      assert.equal(
        await list.evaluate((element) => element === document.activeElement),
        true,
        "focus enters Stored hints after its pointer-leave close is scheduled",
      );
      await page.clock.runFor(201);
      assert.equal(
        await stored.count(),
        1,
        "the scheduled close keeps History-previewed Stored hints visible while its list is focused",
      );

      await controls.code.focus();
      assert.equal(await stored.count(), 0, "blurring the focused list outside its wrapper closes the preview");
    },
  );
});

test("Stored hints: earned stored hints coexist with History when room permits and restore compact History", async () => {
  await withSession(
    { width: 2560, height: 1440 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      await controls.history.click();
      await pauseClockAtCurrentTime(page);

      const history = page.getByRole("region", { name: "History", exact: true });
      const stored = page.getByRole("region", { name: "Stored hints", exact: true });
      await page.mouse.move(0, 0);
      const hintBox = await controls.hint.boundingBox();
      assert.ok(hintBox, "wide Show hint has a pointer target while History is open");
      await page.mouse.move(hintBox.x + hintBox.width / 2, hintBox.y + hintBox.height / 2);
      await page.clock.runFor(149);
      assert.equal(await stored.count(), 0, "History-open hover retains the 150ms disclosure delay");
      await page.clock.runFor(1);
      await exact(history, "wide visible History");
      await exact(stored, "wide pointer-opened stored hints");
      const [historyBox, storedBox] = await Promise.all([
        history.boundingBox(),
        stored.boundingBox(),
      ]);
      assert.ok(historyBox && storedBox, "wide cards have measurable geometry");
      assert.ok(
        historyBox.x + historyBox.width <= storedBox.x || storedBox.x + storedBox.width <= historyBox.x,
        `wide History and Stored hints occupy separate horizontal space (History ${historyBox.x}-${historyBox.x + historyBox.width}; Stored ${storedBox.x}-${storedBox.x + storedBox.width})`,
      );

      await page.keyboard.press("Escape");
      assert.equal(await stored.count(), 0, "Escape closes the wide stored-hints card");
      await controls.hint.click();
      await exact(
        page.getByRole("dialog", { name: "Solve a quick math question", exact: true }),
        "Show hint click still opens the math question while History was open",
      );
    },
  );

  await withSession(
    { width: 390, height: 844 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await expireHintReward(page);
      await controls.history.click();
      const history = page.getByRole("region", { name: "History", exact: true });
      const handle = page.getByRole("button", { name: "Move History", exact: true });
      const beforeDrag = await (await exact(history, "compact History before drag")).boundingBox();
      const handleBox = await (await exact(handle, "compact History drag handle")).boundingBox();
      assert.ok(beforeDrag && handleBox, "compact History can be positioned before coexistence");
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(Math.max(8, handleBox.x - 40), Math.max(8, handleBox.y - 40));
      await page.mouse.up();
      const dragged = await history.boundingBox();
      assert.ok(dragged, "compact History remains measurable after drag");
      assert.ok(
        Math.round(dragged.x) !== Math.round(beforeDrag.x) || Math.round(dragged.y) !== Math.round(beforeDrag.y),
        "compact History drag creates a distinct position before its temporary hide",
      );

      await pauseClockAtCurrentTime(page);
      const stored = page.getByRole("region", { name: "Stored hints", exact: true });
      await page.mouse.move(0, 0);
      const hintBox = await controls.hint.boundingBox();
      assert.ok(hintBox, "compact Show hint remains pointer reachable while History is open");
      await page.mouse.move(hintBox.x + hintBox.width / 2, hintBox.y + hintBox.height / 2);
      await page.clock.runFor(149);
      assert.equal(await stored.count(), 0, "compact History-open hover retains the 150ms disclosure delay");
      await page.clock.runFor(1);
      await exact(stored, "compact pointer-opened stored hints");
      assert.equal(await history.count(), 0, "compact History is temporarily unavailable while Stored hints is readable");

      await page.keyboard.press("Escape");
      assert.equal(await stored.count(), 0, "Escape closes compact Stored hints");
      const restored = await (await exact(history, "restored compact History")).boundingBox();
      assert.ok(restored, "restored compact History has measurable geometry");
      approximatelyEqual(restored.x, dragged.x, 2, "compact History keeps its dragged x after Stored hints closes");
      approximatelyEqual(restored.y, dragged.y, 2, "compact History keeps its dragged y after Stored hints closes");

      await controls.newRound.click();
      assert.equal(await history.count(), 0, "New game closes restored History");
      assert.equal(await stored.count(), 0, "New game leaves no stale stored-hints card");
    },
  );
});

test("SCV05 AC4/AC5: Stored hints follows Show hint through resize, internal scrolling, close, and reopen", async () => {
  await withSession(
    { width: 1440, height: 900 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await earnCurrentRoundHints(page, 4);
      const checkAlignment = async (width, label) => {
        const card = await exact(
          page.getByRole("region", { name: "Stored hints", exact: true }),
          `${label} Stored hints card`,
        );
        const [cardBox, triggerBox, list] = await Promise.all([
          card.boundingBox(),
          controls.hint.boundingBox(),
          exact(card.getByRole("list", { name: "Stored hint list", exact: true }), `${label} Stored hints list`),
        ]);
        assert.ok(cardBox && triggerBox, `${label} card and Show hint have measurable boxes`);
        const canShareLeftEdge =
          triggerBox.x >= 12 && triggerBox.x + cardBox.width <= width - 12;
        if (canShareLeftEdge)
          assert.ok(
            Math.abs(cardBox.x - triggerBox.x) <= 2 ||
              cardBox.x >= 12 && cardBox.x + cardBox.width <= width - 12,
            `${label} Stored hints either shares Show hint's left edge or takes a gutter-bounded alternate x to keep controls clear`,
          );
        else
          assert.ok(
            cardBox.x >= 12 && cardBox.x + cardBox.width <= width - 12,
            `${label} Stored hints clamps only to the approved 12px gutters`,
          );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
          `${label} stored-card placement does not create horizontal overflow`,
        );
        return { card, list };
      };

      await refocusShowHint(controls);
      let state = await checkAlignment(1440, "1440px initial");
      await page.keyboard.press("Tab");
      assert.equal(
        await state.list.evaluate((element) => element === document.activeElement),
        true,
        "initial Tab enters the Stored hints internal list",
      );
      await page.keyboard.press("End");
      assert.ok(
        await state.card.evaluate((element) => element.scrollTop) > 0,
        "End reveals the fourth stored fact through the stored-card scrollport",
      );

      for (const [width, height] of [[1074, 1134], [390, 1134]]) {
        await page.setViewportSize({ width, height });
        await waitForStableVisualGeometry(page);
        state = await checkAlignment(width, `${width}px after resize`);
        assert.equal(
          await state.list.evaluate((element) => element === document.activeElement),
          true,
          `${width}px resize keeps keyboard focus in the stored-fact scrollport`,
        );
        assert.ok(
          await state.card.evaluate((element) => element.scrollTop) > 0,
          `${width}px resize retains the already-revealed stored-card position`,
        );
      }

      await page.keyboard.press("Escape");
      assert.equal(
        await page.getByRole("region", { name: "Stored hints", exact: true }).count(),
        0,
        "Escape closes the resized Stored hints card",
      );
      assert.equal(
        await controls.hint.evaluate((element) => element === document.activeElement),
        true,
        "Escape restores focus to Show hint after resize",
      );
      await controls.newRound.focus();
      await controls.hint.focus();
      state = await checkAlignment(390, "390px reopened");
      await page.keyboard.press("Tab");
      assert.equal(
        await state.list.evaluate((element) => element === document.activeElement),
        true,
        "reopened card still exposes its internal list as Show hint's next focus target",
      );
      await page.keyboard.press("End");
      assert.ok(
        await state.card.evaluate((element) => element.scrollTop) > 0,
        "reopened card keeps genuine card overflow available to keyboard users",
      );
    },
  );
});


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
