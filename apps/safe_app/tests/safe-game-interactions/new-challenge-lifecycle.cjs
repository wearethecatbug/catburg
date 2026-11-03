const assert = require("node:assert/strict");
const test = require("node:test");
const { withSession } = require("./shared/session.cjs");
const { fixedClockStart } = require("./shared/runtime-context.cjs");
const { pauseClockAtCurrentTime, exact, gameControls } = require("./shared/game-controls.cjs");

function register01() {
  test("SC06: New question replaces its public challenge, artwork, and concern deadline", async () => {
    await withSession(
      { width: 1024, height: 768 },
      { random: 0.041, clockStart: fixedClockStart },
      async ({ page }) => {
        await pauseClockAtCurrentTime(page);
        const controls = await gameControls(page);
        await controls.hint.click();
        const dialog = await exact(
          page.getByRole("dialog", { name: "Solve a quick math question", exact: true }),
          "new-question lifecycle dialog",
        );
        const question = dialog.locator("label[for='hint-answer']");
        const originalQuestion = await question.innerText();
        const artwork = (asset) =>
          dialog.locator(
            `picture:has(source[srcset*="${asset}"]) img, img[src*="${asset}"]`,
          );

        await page.clock.runFor(10_000);
        const concernedAsset = "hint-popup-cat-concerned-640.png";
        await artwork(concernedAsset).first().waitFor({ state: "visible" });
        assert.equal(
          await artwork(concernedAsset).count(),
          1,
          "the initial challenge reaches exactly one public concerned artwork",
        );

        await page.evaluate(() => {
          Math.random = () => 0.99;
        });
        await dialog.getByRole("button", { name: "New question", exact: true }).click();

        const thinkingAsset = "hint-popup-cat-thinking-640.png";
        await artwork(thinkingAsset).first().waitFor({ state: "visible" });
        assert.notEqual(
          await question.innerText(),
          originalQuestion,
          "New question exposes a distinct public challenge before its replacement artwork is accepted",
        );
        assert.equal(
          await artwork(thinkingAsset).count(),
          1,
          "New question exposes exactly one desktop thinking artwork",
        );
        assert.equal(
          await artwork(concernedAsset).count(),
          0,
          "the old challenge concern artwork cannot satisfy the replacement assertion",
        );

        await page.clock.runFor(9_999);
        assert.equal(
          await artwork(thinkingAsset).count(),
          1,
          "the replacement challenge remains thinking before its fresh deadline",
        );
        await page.clock.runFor(1);
        await artwork(concernedAsset).first().waitFor({ state: "visible" });
        assert.equal(
          await artwork(concernedAsset).count(),
          1,
          "the replacement challenge reaches exactly one concerned artwork at its deadline",
        );
      },
    );
  });
}

module.exports = { register01 };
