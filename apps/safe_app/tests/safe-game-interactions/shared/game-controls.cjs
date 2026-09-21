const assert = require("node:assert/strict");



async function pauseClockAtCurrentTime(page) {
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 1),
  );
}



async function exact(locator, description) {
  assert.equal(
    await locator.count(),
    1,
    `${description} has exactly one public match`,
  );
  return locator;
}



// The character artwork is deliberately decorative.  Its public owner is the
// presentation-mode carrier; only pettable modes expose a named button.
async function ordinaryOwner(page, mode, description = `ordinary ${mode} owner`) {
  await exact(
    page.locator("[data-presentation-mode]"),
    `${description} global ordinary owner`,
  );
  const owner = page.locator(`[data-presentation-mode="${mode}"]`);
  await exact(owner, description);
  return owner;
}



async function expectRewardReplacement(page, description) {
  await exact(page.getByLabel("New hint reward", { exact: true }), `${description} reward`);
  assert.equal(await page.locator("[data-presentation-mode]").count(), 0, `${description} has no ordinary character owner`);
  assert.equal(await page.getByRole("button", { name: "Pet the cat", exact: true }).count(), 0, `${description} has no pet target`);
}



async function expectOrdinaryReturn(page, mode, pettable, description) {
  await ordinaryOwner(page, mode, `${description} ordinary owner`);
  assert.equal(await page.getByLabel("New hint reward", { exact: true }).count(), 0, `${description} clears reward`);
  assert.equal(await page.getByRole("button", { name: "Pet the cat", exact: true }).count(), pettable ? 1 : 0, `${description} pet target cardinality`);
}



async function gameControls(page) {
  const controls = {
    instruction: page.getByText("Enter a whole code from 1 to 1000.", {
      exact: true,
    }),
    code: page.getByLabel("Safe code", { exact: true }),
    submit: page.getByRole("button", { name: "OK", exact: true }),
    newRound: page.getByRole("button", { name: "New game", exact: true }),
    surrender: page.getByRole("button", { name: "Give up", exact: true }),
    hint: page.getByRole("button", { name: "Show hint", exact: true }),
    history: page.getByRole("button", { name: "History", exact: true }),
    cat: page.getByRole("button", { name: "Pet the cat", exact: true }),
  };
  for (const [description, locator] of Object.entries(controls))
    await exact(locator, description);
  return controls;
}

async function openHintDialog(page) {
  const controls = await gameControls(page);
  await controls.hint.click();
  const dialog = page.getByRole("dialog", {
    name: "Solve a quick math question",
  });
  const answer = page.locator("#hint-answer");
  await exact(dialog, "math challenge dialog");
  await exact(answer, "math challenge answer input");
  return { ...controls, dialog, answer };
}



function solveVisibleQuestion(questionText) {
  const [, leftText, operator, rightText] =
    questionText.match(/^(\d+) ([+\-−×÷]) (\d+) = \?$/) || [];
  assert.ok(
    leftText && rightText,
    "the visible question has two operands and an operator",
  );
  const leftOperand = Number(leftText);
  const rightOperand = Number(rightText);
  return {
    "+": leftOperand + rightOperand,
    "-": leftOperand - rightOperand,
    "−": leftOperand - rightOperand,
    "×": leftOperand * rightOperand,
    "÷": leftOperand / rightOperand,
  }[operator];
}



async function visibleQuestionAnswer(page) {
  const dialog = page.getByRole("dialog", {
    name: "Solve a quick math question",
  });
  const question = await dialog.locator("label[for='hint-answer']").innerText();
  const answer = solveVisibleQuestion(question);
  await dialog.locator("#hint-answer").fill(String(answer));
  await page.getByRole("button", { name: "Check", exact: true }).click();
  // This is deliberately document-scoped: a successful Check disables the field,
  // so the helper cannot depend on focus remaining in the fading dialog.
  await page.waitForFunction(() =>
    [...document.images].some((image) =>
      (image.currentSrc || image.src).includes(
        innerWidth <= 820
          ? "hint-popup-cat-success-1448.png"
          : "hint-popup-cat-happy-640.png",
      ),
    ),
  );
  if (await dialog.isVisible()) {
    await page.waitForFunction(
      (element) => element.dataset.successPresentation === "true",
      await dialog.elementHandle(),
    );
    await dialog
      .getByRole("button", { name: "Close hint challenge", exact: true })
      .focus();
    await page.keyboard.press("Escape");
  }
  await dialog.waitFor({ state: "hidden" });
}



function approximatelyEqual(actual, expected, tolerance, description) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${description}: expected ${expected} ±${tolerance}, received ${actual}`,
  );
}

module.exports = { pauseClockAtCurrentTime, exact, ordinaryOwner, expectRewardReplacement, expectOrdinaryReturn, gameControls, openHintDialog, solveVisibleQuestion, visibleQuestionAnswer, approximatelyEqual };
