const assert = require("node:assert/strict");
const test = require("node:test");
const { withSession } = require("./shared/session.cjs");
const { exact, gameControls, openHintDialog, solveVisibleQuestion, visibleQuestionAnswer, approximatelyEqual } = require("./shared/game-controls.cjs");
const { expectHintLamp } = require("./shared/sc08-contract.cjs");

async function closeChallenge(page) {
  await page.getByRole("button", { name: "Close hint challenge", exact: true }).click();
  await page.getByRole("dialog", { name: "Solve a quick math question", exact: true }).waitFor({ state: "hidden" });
}

async function expectLampOffAfterChallengeOutcome(page, controls, outcome) {
  const hint = await openHintDialog(page);
  const retryFeedback = hint.dialog
    .getByRole("status")
    .getByText("Try again — you’ve got this!", { exact: true });
  await expectHintLamp(controls.hint, false, `${outcome} leaves the current round unearned`);
  if (outcome === "wrong") {
    await hint.answer.fill("0");
    await hint.dialog.getByRole("button", { name: "Check", exact: true }).click();
    await retryFeedback.waitFor();
  } else if (outcome === "invalid") {
    await hint.answer.fill("not-a-number");
    await hint.dialog.getByRole("button", { name: "Check", exact: true }).click();
    await retryFeedback.waitFor();
  } else if (outcome === "give-up") {
    await hint.answer.fill(String(solveVisibleQuestion(await hint.dialog.locator("label[for='hint-answer']").innerText())));
    await hint.dialog.getByRole("button", { name: "Give up", exact: true }).click();
    const staleSubmitWasPrevented = await hint.answer.evaluate((input) => {
      const form = input.closest("form");
      return form?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    });
    assert.equal(staleSubmitWasPrevented, false, "abandoned Check still reaches the public handler as a stale submission");
  } else {
    await closeChallenge(page);
    await expectHintLamp(controls.hint, false, `${outcome} does not earn a lamp`);
    return;
  }
  await expectHintLamp(controls.hint, false, `${outcome} does not earn a lamp`);
  await closeChallenge(page);
  await expectHintLamp(controls.hint, false, `${outcome} close keeps the lamp off`);
}

function register01() {
  test("SC08 lamp: the sole left SVG stays off through all non-award outcomes and only current correct answers illuminate it", async () => {
    for (const outcome of ["wrong", "invalid", "close", "give-up"])
      await withSession({ width: 1175, height: 1098 }, { random: 0.041 }, async ({ page }) => {
        const controls = await gameControls(page);
        await expectHintLamp(controls.hint, false, `fresh ${outcome} case`);
        await expectLampOffAfterChallengeOutcome(page, controls, outcome);
      });

    await withSession({ width: 390, height: 844 }, { random: 0.041 }, async ({ page }) => {
      const controls = await gameControls(page);
      await openHintDialog(page);
      await visibleQuestionAnswer(page);
      await expectHintLamp(controls.hint, true, "accepted current answer immediately illuminates the left lamp");
      await controls.hint.click();
      await page.getByRole("dialog", { name: "Solve a quick math question", exact: true }).waitFor();
      await closeChallenge(page);
      await expectHintLamp(controls.hint, true, "rereading retains the current earned lamp");
      await controls.newRound.click();
      await expectHintLamp(controls.hint, false, "New game makes old-round earned state unable to illuminate the new round");
    });
  });

  test("SC08 lamp: compact layout and reduced motion retain decorative, non-overflowing state semantics", async () => {
    for (const [width, height] of [[1175, 1098], [390, 844]])
      await withSession({ width, height }, { random: 0.041 }, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const controls = await gameControls(page);
        const { icon, bulb, rays } = await expectHintLamp(controls.hint, false, `${width}px reduced-motion lamp`);
        const [buttonBox, iconBox] = await Promise.all([controls.hint.boundingBox(), icon.boundingBox()]);
        assert.ok(buttonBox && iconBox && iconBox.x >= buttonBox.x && iconBox.y >= buttonBox.y && iconBox.x + iconBox.width <= buttonBox.x + buttonBox.width && iconBox.y + iconBox.height <= buttonBox.y + buttonBox.height, `${width}px lamp stays inside Show hint`);
        assert.equal(await bulb.evaluate((element) => getComputedStyle(element).transitionProperty), "none", `${width}px reduced motion removes bulb transition`);
        assert.equal(await rays.evaluate((element) => getComputedStyle(element).transitionProperty), "none", `${width}px reduced motion removes ray transition`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px lamp has no horizontal overflow`);
      });
  });

  test("SC08 History: desktop follows its menu button while compact simplifies the decorative grip", async () => {
    const measurements = new Map();
    for (const [width, height, compact] of [[1440, 900, false], [2560, 1440, false], [1280, 600, true], [1175, 1098, true], [390, 844, true]])
      await withSession({ width, height }, {}, async ({ page }) => {
        const controls = await gameControls(page);
        await controls.history.click();
        const panel = await exact(page.getByRole("region", { name: "History", exact: true }), `${width}px History region`);
        const heading = await exact(panel.getByRole("heading", { name: "History", exact: true }), `${width}px History heading`);
        const grip = await exact(page.getByRole("button", { name: "Move History", exact: true }), `${width}px History grip`);
        const close = await exact(panel.getByRole("button", { name: "Close History", exact: true }), `${width}px History close`);
        assert.equal(await page.getByRole("button", { name: "Move History", exact: true }).count(), 1, `${width}px has one Move History control`);
        const [panelBox, buttonBox, gripBox, closeBox, appearance, headingStyle, panelHeight] = await Promise.all([
          panel.boundingBox(), controls.history.boundingBox(), grip.boundingBox(), close.boundingBox(), panel.evaluate((element) => {
            const entries = element.querySelector("[aria-live='polite']");
            const shell = getComputedStyle(element);
            const entry = getComputedStyle(entries);
            return { backgroundImage: shell.backgroundImage, boxShadow: shell.boxShadow, borderColor: shell.borderColor, entriesBackground: entry.backgroundColor, entriesBorder: entry.borderColor, entriesColor: entry.color, entriesPadding: entry.padding };
          }), heading.evaluate((element) => ({ fontSize: Number.parseFloat(getComputedStyle(element).fontSize), fontWeight: Number.parseInt(getComputedStyle(element).fontWeight, 10) })), panel.evaluate((element) => getComputedStyle(element).height),
        ]);
        assert.ok(panelBox && buttonBox && gripBox && closeBox, `${width}px History controls have measurable geometry`);
        assert.equal(panelHeight, "180px", `${width}px History preserves its scrollable panel height`);
        assert.ok(gripBox.width >= 44 && gripBox.height >= 44, `${width}px History grip retains the 44px target`);
        assert.ok(closeBox.x >= panelBox.x && closeBox.x + closeBox.width <= panelBox.x + panelBox.width, `${width}px Close stays inside History`);
        approximatelyEqual(gripBox.x + gripBox.width / 2, panelBox.x + panelBox.width / 2, 1, `${width}px grip remains centered in History`);
        assert.match(appearance.backgroundImage, /linear-gradient/, `${width}px History has the lavender layered shell`);
        assert.notEqual(appearance.boxShadow, "none", `${width}px History retains shell depth`);
        assert.notEqual(appearance.entriesBackground, "rgb(0, 0, 0)", `${width}px History entries are never black`);
        assert.equal(appearance.entriesBackground, "rgb(255, 253, 252)", `${width}px History entries use the approved light surface`);
        assert.equal(appearance.entriesBorder, "rgb(217, 200, 238)", `${width}px History entries retain their lavender border`);
        assert.equal(appearance.entriesColor, "rgb(52, 39, 74)", `${width}px History entries retain readable dark text`);
        assert.equal(appearance.entriesPadding, "8px", `${width}px History entries retain 8px padding`);
        const paws = grip.locator('svg[aria-hidden="true"]');
        assert.equal(await paws.count(), 1, `${width}px grip keeps one decorative paw in its semantic-free markup`);
        assert.equal(await paws.isVisible(), !compact, `${width}px grip ${compact ? "hides" : "shows"} its decorative paw`);
        assert.equal(await grip.locator("img").count(), 0, `${width}px grip does not use the retired raster paw`);
        const dotColumns = grip.locator(":scope > span[aria-hidden=\"true\"] > span");
        assert.equal(await dotColumns.count(), 2, `${width}px grip retains two six-dot column groups`);
        const dotState = await dotColumns.evaluateAll((elements) => elements.map((element) => {
          const style = getComputedStyle(element);
          return { display: style.display, width: style.width, height: style.height, backgroundImage: style.backgroundImage, backgroundSize: style.backgroundSize };
        }));
        assert.deepEqual(dotState[0], { display: "block", width: "16px", height: "24px", backgroundImage: dotState[0].backgroundImage, backgroundSize: "8px 8px" }, `${width}px visible dot group is two columns by three rows`);
        assert.match(dotState[0].backgroundImage, /radial-gradient/, `${width}px visible dot group draws round dots`);
        assert.equal(dotState[1].display === "none", compact, `${width}px ${compact ? "hides" : "shows"} the second six-dot group`);
        if (!compact) {
          const paw = await exact(paws, `${width}px flat decorative paw`);
        const pawState = await paw.evaluate((element) => {
          const style = getComputedStyle(element);
          const matrix = style.transform.match(/^matrix\(([^)]+)\)$/);
          const values = matrix ? matrix[1].split(",").map(Number) : null;
          return { ariaHidden: element.getAttribute("aria-hidden"), tabIndex: element.tabIndex, pointerEvents: style.pointerEvents, width: style.width, height: style.height, angle: values ? Math.atan2(values[1], values[0]) * 180 / Math.PI : null };
        });
        assert.deepEqual({ ariaHidden: pawState.ariaHidden, tabIndex: pawState.tabIndex, pointerEvents: pawState.pointerEvents }, { ariaHidden: "true", tabIndex: -1, pointerEvents: "none" }, `${width}px paw is decorative and noninteractive`);
        }
        if (!compact) {
          approximatelyEqual(panelBox.x, buttonBox.x, 1, `${width}px History aligns with its menu button`);
          approximatelyEqual(panelBox.width, buttonBox.width, 1, `${width}px History follows its menu button width`);
        }
        measurements.set(compact ? `compact-${width}` : `desktop-${width}`, { panelWidth: panelBox.width, headingStyle });
        await grip.focus();
        assert.equal(await heading.count(), 1, `${width}px heading stays distinct from the movable grip`);
      });
    const desktop = measurements.get("desktop-1440");
    for (const width of [1280, 1175, 390]) {
      const compact = measurements.get(`compact-${width}`);
      assert.ok(compact.panelWidth < desktop.panelWidth, `${width}px compact History is narrower than desktop History`);
      assert.ok(compact.headingStyle.fontSize < desktop.headingStyle.fontSize, `${width}px compact History title is smaller`);
      assert.ok(compact.headingStyle.fontWeight < desktop.headingStyle.fontWeight, `${width}px compact History title is lighter`);
    }
  });

  test("SC08 terminal menu: disabled controls and their real gap hold the ordinary arrow without effects", async () => {
    for (const [width, height] of [[1175, 1098], [390, 844]])
      await withSession({ width, height }, {}, async ({ page }) => {
        const controls = await gameControls(page);
        await controls.surrender.click();
        assert.equal(await controls.surrender.isDisabled(), true, `${width}px surrendered Give up remains natively disabled`);
        assert.equal(await controls.hint.isDisabled(), true, `${width}px surrendered Show hint remains natively disabled without an earned fact`);
        for (const [name, control] of Object.entries({ newGame: controls.newRound, history: controls.history }))
          assert.equal(await control.evaluate((element) => getComputedStyle(element).cursor), "pointer", `${width}px enabled ${name} keeps pointer cursor`);
        const [giveBox, hintBox] = await Promise.all([controls.surrender.boundingBox(), controls.hint.boundingBox()]);
        assert.ok(giveBox && hintBox, `${width}px terminal menu controls render`);
        approximatelyEqual(hintBox.y - (giveBox.y + giveBox.height), 12, 1, `${width}px retains the real 12px grid gap`);
        const gap = await page.evaluate(({ x, y }) => {
          const element = document.elementFromPoint(x, y);
          return { cursor: element ? getComputedStyle(element).cursor : null, control: element?.closest("button")?.textContent?.trim() ?? null, tabIndex: element?.getAttribute("tabindex") ?? null };
        }, { x: giveBox.x + giveBox.width / 2, y: giveBox.y + giveBox.height + 6 });
        assert.deepEqual(gap, { cursor: "default", control: null, tabIndex: null }, `${width}px inter-button gap is an ordinary non-control arrow surface`);
        const hintWrap = controls.hint.locator("xpath=..");
        assert.deepEqual(await hintWrap.evaluate((element) => ({ cursor: getComputedStyle(element).cursor, role: element.getAttribute("role"), tabIndex: element.tabIndex })), { cursor: "default", role: null, tabIndex: -1 }, `${width}px hint wrapper dead space remains noninteractive`);
        for (const [name, control] of Object.entries({ giveUp: controls.surrender, showHint: controls.hint })) {
          await control.hover();
          const box = await control.boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          const style = await control.evaluate((element) => {
            const computed = getComputedStyle(element);
            return { cursor: computed.cursor, transform: computed.transform, filter: computed.filter, boxShadow: computed.boxShadow, transitionProperty: computed.transitionProperty };
          });
          await page.mouse.up();
          assert.deepEqual(style, { cursor: "default", transform: "none", filter: "none", boxShadow: "none", transitionProperty: "none" }, `${width}px disabled ${name} has no hover or held-pointer motion/effect`);
        }
        await page.emulateMedia({ reducedMotion: "reduce" });
        for (const control of [controls.surrender, controls.hint])
          assert.equal(await control.evaluate((element) => getComputedStyle(element).transitionProperty), "none", `${width}px reduced motion keeps disabled control static`);
      });
  });
}

module.exports = { register01 };
