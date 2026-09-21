const assert = require("node:assert/strict");
const test = require("node:test");
const { withSession } = require("./shared/session.cjs");
const { runtimeBaseUrl: baseUrl, fixedClockStart } = require("./shared/runtime-context.cjs");
const { sc06RenderedReferences } = require("./shared/sc06.cjs");
const { waitForStableVisualGeometry, visibleAlphaBounds } = require("./shared/readiness.cjs");
const { pauseClockAtCurrentTime, exact, ordinaryOwner, expectRewardReplacement, expectOrdinaryReturn, gameControls, solveVisibleQuestion, approximatelyEqual } = require("./shared/game-controls.cjs");
const { intersects, visibleTextBounds, paintedCatSafeGap, assertPaintedHeaderClearance, transformScale, transformTranslation, isPurple, isErrorRed } = require("./shared/artwork-geometry.cjs");



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



function register01() {


test("SC06: ordinary Close and Escape restore Show hint focus and its nonpettable attention owner", async () => {
  for (const [viewport, exit] of [
    [{ width: 1440, height: 900 }, "close"],
    [{ width: 390, height: 844 }, "escape"],
  ])
    await withSession(viewport, {}, async ({ page }) => {
      const controls = await gameControls(page);
      await controls.hint.click();
      const hint = await sc06Dialog(page);
      if (exit === "close") {
        await hint.dialog
          .getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          })
          .click();
      } else {
        await page.keyboard.press("Escape");
      }
      await hint.dialog.waitFor({ state: "hidden" });
      assert.equal(
        await controls.hint.evaluate((element) => element === document.activeElement),
        true,
        `${viewport.width}x${viewport.height} ordinary ${exit} restores Show hint focus`,
      );
      await ordinaryOwner(
        page,
        "HINT_ATTENTION",
        `${viewport.width}x${viewport.height} ordinary ${exit} attention owner`,
      );
      const unavailableCat = await exact(
        page.getByLabel("Cat is waiting while the hint is open", { exact: true }),
        `${viewport.width}x${viewport.height} ordinary ${exit} nonpettable cat`,
      );
      assert.equal(
        await unavailableCat.isDisabled(),
        true,
        `${viewport.width}x${viewport.height} ordinary ${exit} attention cat is not pettable`,
      );
    });
});

async function advanceFrozenViewportResize(page, viewport) {
  await page.setViewportSize(viewport);
  // Advance enough frozen time for resize observers and two animation frames. The
  // caller verifies the resulting public geometry and subtracts this exact budget.
  await page.clock.runFor(100);
  return 100;
}

async function assertNativeDraggingDisabled(images, description) {
  const states = await images.evaluateAll((elements) =>
    elements.map((image) => ({
      source: image.currentSrc || image.src,
      draggable: image.draggable,
    })),
  );
  assert.ok(states.length > 0, `${description} renders at least one cat image`);
  assert.equal(
    states.every((state) => state.draggable === false),
    true,
    `${description} disables native image dragging for every rendered cat image: ${JSON.stringify(states)}`,
  );
}

async function sc06SceneSnapshot(page) {
  return page.locator("main").evaluate((main) => {
    const backgroundOwner = [
      main,
      main.parentElement,
      main.parentElement?.parentElement,
    ].find(
      (candidate) =>
        candidate && getComputedStyle(candidate).backgroundImage !== "none",
    );
    const stage = main.querySelector("div");
    const ownerRect = backgroundOwner.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      image: getComputedStyle(backgroundOwner).backgroundImage,
      position: getComputedStyle(backgroundOwner).backgroundPosition,
      scrollY,
      owner: {
        x: ownerRect.x,
        y: ownerRect.y,
        width: ownerRect.width,
        height: ownerRect.height,
      },
      stage: {
        x: stageRect.x,
        y: stageRect.y,
        width: stageRect.width,
        height: stageRect.height,
        transform: getComputedStyle(stage).transform,
      },
    };
  });
}

async function sc06ResponsiveGeometry(hint) {
  const mobileVignette = await hint.dialog.evaluate(() => innerWidth <= 600);
  const title = await exact(
    hint.dialog.getByRole("heading", {
      name: "Solve a quick math question",
      exact: true,
    }),
    "SC06 responsive title",
  );
  const close = await exact(
    hint.dialog.getByRole("button", {
      name: "Close hint challenge",
      exact: true,
    }),
    "SC06 responsive close paw",
  );
  const content = hint.dialog.locator("section");
  const equation = hint.dialog
    .locator("label[for='hint-answer']")
    .locator("xpath=..");
  const vignette = hint.dialog.locator("aside");
  const cat = await exact(
    vignette.locator('img[src*="hint-popup-cat-"]'),
    "SC06 responsive vignette cat",
  );
  const bubble = await exact(
    vignette.getByText("Solve this and I’ll give you a hint!", { exact: true }),
    "SC06 responsive vignette bubble",
  );
  const lamp = await exact(
    vignette.locator('img[src*="hint-popup-lamp-"]'),
    "SC06 responsive vignette lamp",
  );
  const notice = vignette.locator("p");
  const actions = hint.newQuestion.locator("xpath=..");
  const [
    dialogBox,
    titleBox,
    closeBox,
    contentBox,
    equationBox,
    answerBox,
    checkBox,
    vignetteBox,
    catBox,
    bubbleBox,
    lampBox,
    noticeBox,
    actionsBox,
  ] = await Promise.all([
    hint.dialog.boundingBox(),
    title.boundingBox(),
    close.boundingBox(),
    content.boundingBox(),
    equation.boundingBox(),
    hint.answer.boundingBox(),
    hint.check.boundingBox(),
    vignette.boundingBox(),
    cat.boundingBox(),
    bubble.boundingBox(),
    lamp.boundingBox(),
    notice.boundingBox(),
    actions.boundingBox(),
  ]);
  const dialogMetrics = await hint.dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    const scaleTokens =
      style.scale === "none" ? [1] : style.scale.split(/\s+/).map(Number);
    const values =
      style.backgroundColor.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
    const maxScroll = element.scrollHeight - element.clientHeight;
    element.scrollTop = maxScroll;
    const reachesBottom = maxScroll === 0 || element.scrollTop === maxScroll;
    element.scrollTop = 0;
    return {
      cssWidth: Number.parseFloat(style.width),
      cssHeight: Number.parseFloat(style.height),
      scaleTokens,
      background: style.backgroundColor,
      backgroundAlpha: values[3] ?? 1,
      borderRadius: style.borderRadius,
      overflowY: style.overflowY,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      reachesBottom,
    };
  });
  const shellBacking = await hint.dialog
    .locator("xpath=..")
    .evaluate((shell) => {
      const before = getComputedStyle(shell, "::before");
      const style = getComputedStyle(shell);
      const box = shell.getBoundingClientRect();
      return {
        background: before.backgroundImage,
        borderRadius: before.borderRadius,
        top: Number.parseFloat(before.top),
        right: Number.parseFloat(before.right),
        bottom: Number.parseFloat(before.bottom),
        left: Number.parseFloat(before.left),
        shellBackground: style.backgroundColor,
        shellBackgroundImage: style.backgroundImage,
        shellRadius: style.borderRadius,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
      };
    });
  const required = {
    titleBox,
    closeBox,
    contentBox,
    equationBox,
    answerBox,
    checkBox,
    vignetteBox,
    catBox,
    actionsBox,
    ...(!mobileVignette ? { bubbleBox, lampBox } : {}),
  };
  for (const [name, box] of Object.entries(required))
    assert.ok(
      box && box.width > 0 && box.height > 0,
      `SC06 responsive ${name} has a rendered box`,
    );
  const contained = { ...required, ...(noticeBox ? { noticeBox } : {}) };
  for (const [name, box] of Object.entries(contained))
    assert.ok(
      box.x >= dialogBox.x - 2 &&
        box.y >= dialogBox.y - 2 &&
        box.x + box.width <= dialogBox.x + dialogBox.width + 2 &&
        box.y + box.height <= dialogBox.y + dialogBox.height + 2,
      `SC06 responsive ${name} stays contained by the frame`,
    );
  const paintedSafeFrame = {
    left: shellBacking.box.x + shellBacking.left,
    right: shellBacking.box.x + shellBacking.box.width - shellBacking.right,
    top: shellBacking.box.y + shellBacking.top,
    bottom: shellBacking.box.y + shellBacking.box.height - shellBacking.bottom,
  };
  if (
    [
      shellBacking.top,
      shellBacking.right,
      shellBacking.bottom,
      shellBacking.left,
    ].every((inset) => Number.isFinite(inset) && inset > 0)
  )
    for (const [name, box] of Object.entries(contained).filter(
      ([name]) => name !== "closeBox",
    ))
      assert.ok(
        box.x >= paintedSafeFrame.left &&
          box.y >= paintedSafeFrame.top &&
          box.x + box.width <= paintedSafeFrame.right &&
          box.y + box.height <= paintedSafeFrame.bottom,
        `SC06 responsive ${name} stays inside the painted safe frame rather than crossing frame artwork`,
      );
  for (const [firstName, secondName] of [
    ["closeBox", "contentBox"],
    ["closeBox", "vignetteBox"],
    ["closeBox", "actionsBox"],
    ["equationBox", "answerBox"],
    ["equationBox", "checkBox"],
    ["actionsBox", "contentBox"],
    ["actionsBox", "vignetteBox"],
  ])
    assert.equal(
      intersects(required[firstName], required[secondName], 0),
      false,
      `SC06 responsive ${firstName} does not overlap ${secondName}`,
    );
  const relative = Object.fromEntries(
    Object.entries(required).map(([name, box]) => [
      name,
      {
        x: (box.x - dialogBox.x) / dialogBox.width,
        y: (box.y - dialogBox.y) / dialogBox.height,
        width: box.width / dialogBox.width,
        height: box.height / dialogBox.height,
      },
    ]),
  );
  const contentCenter = contentBox.x + contentBox.width / 2;
  const vignetteCenter = vignetteBox.x + vignetteBox.width / 2;
  const composition =
    Math.abs(contentCenter - vignetteCenter) >= dialogBox.width * 0.2
      ? "columns"
      : "stacked";
  return {
    dialog: dialogBox,
    relative,
    composition,
    shellBacking,
    ...dialogMetrics,
  };
}

test("SC06: full responsive matrix preserves one semantic modal, background owner, decorative vignette, targets, and no horizontal overflow", async () => {
  const matrix = [
    [1440, 900],
    [1280, 800],
    [1280, 600],
    [1279, 800],
    [1024, 768],
    [943, 708],
    [820, 920],
    [821, 1040],
    [768, 1024],
    [601, 900],
    [600, 900],
    [390, 844],
    [320, 568],
  ];
  for (const [width, height] of matrix)
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.scrollIntoViewIfNeeded();
        const before = await sc06SceneSnapshot(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const during = await sc06SceneSnapshot(page);
        assert.equal(
          await page
            .getByRole("dialog", {
              name: "Solve a quick math question",
              exact: true,
            })
            .count(),
          1,
          `${width}x${height} opens exactly one modal`,
        );
        assert.match(
          during.image,
          new RegExp(
            width <= 600 ? "scene-background-tall" : "scene-background-wide",
          ),
          `${width}x${height} retains the selected background variant`,
        );
        assert.deepEqual(
          {
            image: during.image,
            position: during.position,
            owner: during.owner,
            stage: during.stage,
          },
          {
            image: before.image,
            position: before.position,
            owner: before.owner,
            stage: before.stage,
          },
          `${width}x${height} opening does not move, crop, or transform the scene`,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${width}x${height} has no horizontal overflow`,
        );
        assert.equal(
          await hint.dialog.getAttribute("aria-modal"),
          "true",
          `${width}x${height} retains modal semantics`,
        );
        assert.equal(
          await page.evaluate(() => document.activeElement?.id),
          "hint-answer",
          `${width}x${height} starts focus in the answer field`,
        );
        for (const control of [
          hint.answer,
          hint.check,
          hint.newQuestion,
          hint.giveUp,
          hint.randomOperator,
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
        ]) {
          const box = await control.boundingBox();
          assert.ok(
            box && box.width >= 44 && box.height >= 44,
            `${width}x${height} modal control retains a 44px target`,
          );
        }
        const closeHintChallenge = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} labeled hint-challenge close control`,
        );
        const closePaw = await exact(
          closeHintChallenge.locator(
            'img[src*="hint-popup-close-paw-128.png"][alt=""]',
          ),
          `${width}x${height} decorative close paw`,
        );
        assert.equal(
          await closeHintChallenge.innerText(),
          "",
          `${width}x${height} close control removes visible Close text`,
        );
        assert.equal(
          await closePaw.getAttribute("draggable"),
          "false",
          `${width}x${height} close paw disables native image dragging`,
        );
        if (width > 820) {
          const desktopCloseGeometry = await closeHintChallenge.evaluate(
            (element) => {
              const style = getComputedStyle(element);
              return { top: style.top, right: style.right };
            },
          );
          assert.deepEqual(
            desktopCloseGeometry,
            { top: "36px", right: "-15px" },
            `${width}px desktop/tablet close paw uses the approved 36px/-15px computed inset`,
          );
        }
        if (width === 390 && height === 844) {
          const mobileCloseGeometry = await closeHintChallenge.evaluate(
            (element) => {
              const style = getComputedStyle(element);
              return {
                right: style.right,
                rightEdge: element.getBoundingClientRect().right,
                viewportWidth: innerWidth,
              };
            },
          );
          assert.equal(
            mobileCloseGeometry.right,
            "8px",
            "390x844 mobile keeps the close paw fixed 8px from the right edge",
          );
          assert.ok(
            mobileCloseGeometry.rightEdge <=
              mobileCloseGeometry.viewportWidth - 4,
            "390x844 close paw stays at least 4px inside the viewport right edge",
          );
        }
        const references = await sc06RenderedReferences(hint.dialog);
        for (const filename of [
          "hint-popup-calculator-320.png",
          width <= 820
            ? "hint-popup-cat-thinking-new-1448.png"
            : "hint-popup-cat-thinking-640.png",
          ...(width > 600 ? ["hint-popup-lamp-320.png"] : []),
        ]) {
          assert.equal(
            references.some(
              (reference) =>
                reference.background.includes(filename) ||
                reference.source.includes(filename),
            ),
            true,
            `${width}x${height} renders ${filename} inside the dialog`,
          );
        }
        const decorativeImages = hint.dialog.locator("img[alt='']");
        assert.ok(
          (await decorativeImages.count()) >= 3,
          `${width}x${height} keeps the vignette artwork decorative`,
        );
        const bubble = await exact(
          hint.dialog.getByText("Solve this and I’ll give you a hint!", {
            exact: true,
          }),
          `${width}x${height} decorative cat bubble`,
        );
        const operatorHelper = await exact(
          hint.dialog.getByText(
            "Choose which operations can appear in the examples.",
            {
              exact: true,
            },
          ),
          `${width}x${height} operator helper copy`,
        );
        assert.equal(
          await hint.answer.getAttribute("placeholder"),
          "Enter your answer…",
          `${width}x${height} answer has the approved visible placeholder`,
        );
        assert.equal(
          await bubble.evaluate(
            (element) => element.closest('[aria-hidden="true"]') !== null,
          ),
          true,
          `${width}x${height} cat bubble remains decorative and non-announcing`,
        );
        const bubbleStyle = await bubble.evaluate((element) => {
          const style = getComputedStyle(element);
          const tail = getComputedStyle(element, "::after");
          return {
            radius: Number.parseFloat(style.borderTopLeftRadius),
            background: style.backgroundColor,
            tail: tail.content,
            tailWidth: Number.parseFloat(tail.width),
            tailHeight: Number.parseFloat(tail.height),
          };
        });
        if (width > 600) {
          assert.ok(
            bubbleStyle.radius >= 14 &&
              bubbleStyle.background !== "rgba(0, 0, 0, 0)",
            `${width}x${height} vignette bubble uses a rounded comic speech surface`,
          );
          assert.ok(
            bubbleStyle.tail !== "none" &&
              bubbleStyle.tailWidth > 0 &&
              bubbleStyle.tailHeight > 0,
            `${width}x${height} vignette bubble exposes a visible pseudo-element speech tail`,
          );
        }
        const lamp = await exact(
          hint.dialog.locator('img[src*="hint-popup-lamp"]'),
          `${width}x${height} decorative popup lamp`,
        );
        const popupCat = await exact(
          hint.dialog.locator('img[src*="hint-popup-cat-"]'),
          `${width}x${height} decorative popup cat`,
        );
        const [
          lampAlpha,
          popupCatAlpha,
          bubbleBox,
          lampZIndex,
          catZIndex,
          lampDisplay,
          bubbleDisplay,
        ] = await Promise.all([
          visibleAlphaBounds(page, lamp),
          visibleAlphaBounds(page, popupCat),
          bubble.boundingBox(),
          lamp.evaluate(
            (element) =>
              Number.parseFloat(getComputedStyle(element).zIndex) || 0,
          ),
          popupCat.evaluate(
            (element) =>
              Number.parseFloat(getComputedStyle(element).zIndex) || 0,
          ),
          lamp.evaluate((element) => getComputedStyle(element).display),
          bubble.evaluate((element) => getComputedStyle(element).display),
        ]);
        assert.equal(
          await controls.cat.isVisible(),
          false,
          `${width}x${height} ordinary dialog hides the normal CatAvatar behind its popup`,
        );
        assert.equal(
          await popupCat.isVisible(),
          true,
          `${width}x${height} ordinary dialog keeps its vignette cat visible`,
        );
        if (width <= 600) {
          assert.equal(
            lampDisplay,
            "none",
            `${width}x${height} mobile hides the decorative lamp`,
          );
          assert.equal(
            bubbleDisplay,
            "none",
            `${width}x${height} mobile hides the decorative bubble`,
          );
          assert.equal(
            bubbleBox,
            null,
            `${width}x${height} mobile bubble has no visible box`,
          );
        } else {
          assert.equal(
            intersects(lampAlpha, popupCatAlpha, 0),
            true,
            `${width}x${height} popup lamp stays visually attached to the cat artwork`,
          );
        }
        if (width > 600)
          assert.ok(
            lampZIndex > catZIndex,
            `${width}x${height} popup lamp paints above the cat where their visible alpha regions meet`,
          );
        if (width > 600)
          assert.ok(
            bubbleBox.x + bubbleBox.width / 2 >
              popupCatAlpha.x + popupCatAlpha.width / 2,
            `${width}x${height} speech bubble body remains on the cat's right while its tail points back to the cat`,
          );
        if (width > 600)
          assert.equal(
            intersects(bubbleBox, lampAlpha, 0),
            false,
            `${width}x${height} speech bubble does not cover its companion lamp`,
          );
        const title = hint.dialog.getByRole("heading", {
          name: "Solve a quick math question",
          exact: true,
        });
        const expression = await exact(
          hint.dialog.locator("label[for='hint-answer']"),
          `${width}x${height} public math expression label`,
        );
        const equation = expression.locator("xpath=..");
        const calculator = await exact(
          equation.locator('img[src*="hint-popup-calculator-320.png"]'),
          `${width}x${height} equation-card calculator`,
        );
        const operatorRow = hint.dialog.getByLabel("Choose a math operation", {
          exact: true,
        });
        const feedback = hint.dialog.getByRole("status");
        const [
          dialogBox,
          headerBox,
          vignetteBox,
          contentBox,
          titleBox,
          equationBox,
          expressionBox,
          calculatorBox,
          operatorRowBox,
          operatorHelperBox,
          feedbackBox,
          answerBox,
          checkBox,
          newQuestionBox,
          giveUpBox,
        ] = await Promise.all([
          hint.dialog.boundingBox(),
          hint.dialog.locator("header").boundingBox(),
          hint.dialog.locator("aside").boundingBox(),
          hint.dialog.locator("section").boundingBox(),
          title.boundingBox(),
          equation.boundingBox(),
          expression.boundingBox(),
          calculator.boundingBox(),
          operatorRow.boundingBox(),
          operatorHelper.boundingBox(),
          feedback.boundingBox(),
          hint.answer.boundingBox(),
          hint.check.boundingBox(),
          hint.newQuestion.boundingBox(),
          hint.giveUp.boundingBox(),
        ]);
        const dialogScale = await hint.dialog.evaluate(
          (element) => Number.parseFloat(getComputedStyle(element).scale) || 1,
        );
        assert.ok(
          dialogBox && answerBox && checkBox && newQuestionBox && giveUpBox,
          `${width}x${height} dialog, answer, Check, and bottom actions render`,
        );
        if (width === 390 && height === 844) {
          assert.ok(
            contentBox.x >= dialogBox.x - 2 &&
              contentBox.x + contentBox.width <=
                dialogBox.x + dialogBox.width + 2,
            "390x844 challenge calculation section stays horizontally inside the dialog",
          );
          assert.ok(
            contentBox.x >= -2 && contentBox.x + contentBox.width <= width + 2,
            "390x844 challenge calculation section stays horizontally inside the viewport",
          );
        }
        assert.equal(
          await hint.dialog
            .getByText("Earn one public Safe Cat hint by solving it.", {
              exact: true,
            })
            .count(),
          0,
          `${width}x${height} removes the duplicate hint-earning subtitle`,
        );
        assert.equal(
          await hint.dialog.getByText("Example", { exact: true }).count(),
          0,
          `${width}x${height} removes the obsolete Example label`,
        );
        assert.equal(
          await expression.getAttribute("for"),
          "hint-answer",
          `${width}x${height} math expression label remains associated with hint-answer`,
        );
        assert.equal(
          await hint.answer.getAttribute("id"),
          "hint-answer",
          `${width}x${height} answer field retains its public hint-answer identity`,
        );
        const operatorHelperTranslation = transformTranslation(
          await operatorHelper.evaluate(
            (element) => getComputedStyle(element).transform,
          ),
        );
        assert.deepEqual(
          operatorHelperTranslation,
          width > 820 ? { x: 0, y: 15 } : { x: 0, y: 0 },
          `${width}x${height} operator helper uses the approved wide-only 15px vertical translation`,
        );
        assert.equal(
          await operatorHelper.isVisible(),
          true,
          `${width}x${height} operator helper remains visible`,
        );
        assert.ok(
          operatorHelperBox.width > 0 && operatorHelperBox.height > 0,
          `${width}x${height} operator helper has a rendered box`,
        );
        for (const [name, box] of Object.entries({
          equationBox,
          answerBox,
          checkBox,
          operatorRowBox,
        }))
          assert.equal(
            intersects(operatorHelperBox, box, 0),
            false,
            `${width}x${height} operator helper does not overlap ${name}`,
          );
        if (width > 820) {
          assert.ok(
            operatorHelperBox.x >= contentBox.x &&
              operatorHelperBox.x + operatorHelperBox.width <=
                contentBox.x + contentBox.width &&
              operatorHelperBox.y >= contentBox.y &&
              operatorHelperBox.y + operatorHelperBox.height <=
                contentBox.y + contentBox.height - 4,
            `${width}x${height} translated operator helper remains inside the calculation card with positive bottom clearance`,
          );
        }
        approximatelyEqual(
          expressionBox.y + expressionBox.height / 2,
          equationBox.y + equationBox.height / 2,
          2,
          `${width}x${height} math expression stays vertically centered in its card`,
        );
        assert.ok(
          calculatorBox.x >= equationBox.x &&
            calculatorBox.y >= equationBox.y &&
            calculatorBox.x + calculatorBox.width <=
              equationBox.x + equationBox.width &&
            calculatorBox.y + calculatorBox.height <=
              equationBox.y + equationBox.height,
          `${width}x${height} calculator remains contained by the equation card`,
        );
        assert.equal(
          intersects(expressionBox, calculatorBox, 0),
          false,
          `${width}x${height} calculator does not overlap the centered math expression`,
        );
        if (width <= 600)
          assert.ok(
            calculatorBox.x - (expressionBox.x + expressionBox.width) >= 4,
            `${width}x${height} mobile calculator keeps at least a 4px rendered horizontal gap from the expression`,
          );
        const answerRowHeights = await Promise.all(
          [
            ["answer", hint.answer],
            ["Check", hint.check],
          ].map(async ([name, control]) => ({
            name,
            computed: await control.evaluate((element) =>
              Number.parseFloat(getComputedStyle(element).height),
            ),
            rendered: (await control.boundingBox()).height,
          })),
        );
        const minimumAnswerHeight =
          width <= 600 && height <= 760
            ? 48
            : width <= 600
              ? 54
              : width <= 820
                ? 56
                : 60;
        for (const { name, computed, rendered } of answerRowHeights) {
          assert.ok(
            computed >= minimumAnswerHeight,
            `${width}x${height} ${name} keeps its breakpoint-sized ${minimumAnswerHeight}px minimum height`,
          );
          approximatelyEqual(
            rendered,
            computed * dialogScale,
            1,
            `${width}x${height} ${name} rendered height follows the dialog scale`,
          );
        }
        approximatelyEqual(
          answerBox.y,
          checkBox.y,
          1,
          `${width}x${height} answer and Check share their row top`,
        );
        approximatelyEqual(
          answerBox.y + answerBox.height,
          checkBox.y + checkBox.height,
          1,
          `${width}x${height} answer and Check share their row bottom`,
        );
        if (width > 600)
          for (const [name, box] of [
            ["New question", newQuestionBox],
            ["Give up", giveUpBox],
          ])
            assert.ok(
              box.width < dialogBox.width * 0.42,
              `${width}x${height} ${name} remains individually bounded rather than stretching across the frame row`,
            );
        if (width > 600) {
          approximatelyEqual(
            (Math.min(newQuestionBox.x, giveUpBox.x) +
              Math.max(
                newQuestionBox.x + newQuestionBox.width,
                giveUpBox.x + giveUpBox.width,
              )) /
              2,
            dialogBox.x + dialogBox.width / 2,
            8,
            `${width}x${height} bottom action pair is centered in the dialog`,
          );
          assert.ok(
            Math.abs(
              newQuestionBox.y +
                newQuestionBox.height / 2 -
                (giveUpBox.y + giveUpBox.height / 2),
            ) <= 2 &&
              (newQuestionBox.x + newQuestionBox.width <= giveUpBox.x ||
                giveUpBox.x + giveUpBox.width <= newQuestionBox.x),
            `${width}x${height} labelled bottom actions stay side-by-side in the lower framed area`,
          );
        } else {
          approximatelyEqual(
            newQuestionBox.x,
            giveUpBox.x,
            2,
            `${width}x${height} stacked mobile actions share a left edge`,
          );
          assert.ok(
            newQuestionBox.y + newQuestionBox.height <= giveUpBox.y,
            `${width}x${height} stacks New question above Give up`,
          );
        }
        for (const [name, control] of [
          ["New question refresh", hint.newQuestion],
          ["Give up flag", hint.giveUp],
        ]) {
          const icon = await exact(
            control.locator("svg"),
            `${width}x${height} ${name} decorative icon`,
          );
          assert.equal(
            await icon.getAttribute("aria-hidden"),
            "true",
            `${width}x${height} ${name} icon stays decorative`,
          );
          assert.equal(
            await icon.evaluate((element) => getComputedStyle(element).color),
            await control.evaluate(
              (element) => getComputedStyle(element).color,
            ),
            `${width}x${height} ${name} icon inherits currentColor without an external image asset`,
          );
        }
        if (width > 820) {
          approximatelyEqual(
            dialogBox.width / dialogBox.height,
            1327 / 1185,
            0.025,
            `${width}x${height} visible background preserves its 1327x1185 source ratio uniformly`,
          );
          approximatelyEqual(
            dialogBox.width / 1327,
            dialogBox.height / 1185,
            0.02,
            `${width}x${height} background ornaments and strokes use one x/y scale`,
          );
          assert.ok(
            headerBox && vignetteBox && contentBox,
            `${width}x${height} frame has public header, vignette, and challenge content`,
          );
          const occupiedTop = Math.min(
            headerBox.y,
            vignetteBox.y,
            contentBox.y,
            newQuestionBox.y,
            giveUpBox.y,
          );
          const occupiedBottom = Math.max(
            headerBox.y + headerBox.height,
            vignetteBox.y + vignetteBox.height,
            contentBox.y + contentBox.height,
            newQuestionBox.y + newQuestionBox.height,
            giveUpBox.y + giveUpBox.height,
          );
          assert.ok(
            occupiedBottom - occupiedTop >= dialogBox.height * 0.7 &&
              dialogBox.y + dialogBox.height - occupiedBottom <=
                dialogBox.height * 0.18,
            `${width}x${height} challenge/vignette/actions fill the frame without compressed top content or excessive lower void`,
          );
          for (const [name, box] of Object.entries({
            headerBox,
            vignetteBox,
            contentBox,
            titleBox,
            equationBox,
            operatorRowBox,
            answerBox,
            checkBox,
            newQuestionBox,
            giveUpBox,
          }))
            assert.ok(
              box.x >= dialogBox.x &&
                box.y >= dialogBox.y &&
                box.x + box.width <= dialogBox.x + dialogBox.width &&
                box.y + box.height <= dialogBox.y + dialogBox.height,
              `${width}x${height} ${name} remains inside the clear framed center`,
            );
          assert.ok(
            titleBox.y >= dialogBox.y + dialogBox.height * 0.07 &&
              titleBox.y <= dialogBox.y + dialogBox.height * 0.12 &&
              titleBox.y + titleBox.height <=
                dialogBox.y + dialogBox.height * 0.22,
            `${width}x${height} title sits fully in the lowered clear-paper header inset`,
          );
          assert.ok(
            equationBox.height <= 150 &&
              contentBox.height <= dialogBox.height * 0.58,
            `${width}x${height} calculation content is compact rather than vertically stretched`,
          );
          assert.ok(
            checkBox.width >= 44 && checkBox.x >= answerBox.x + answerBox.width,
            `${width}x${height} styled Check remains enlarged beside its answer input`,
          );
          assert.equal(
            await hint.check.evaluate((element) => {
              const style = getComputedStyle(element);
              return (
                style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
                style.backgroundImage !== "none"
              );
            }),
            true,
            `${width}x${height} Check remains visibly styled rather than plain text`,
          );
          assert.equal(
            await hint.dialog
              .locator("aside")
              .evaluate((element) => getComputedStyle(element).pointerEvents),
            "none",
            `${width}x${height} decorative vignette cannot intercept Check or other controls`,
          );
          const vignetteCenter = vignetteBox.x + vignetteBox.width / 2;
          const catCenter = popupCatAlpha.x + popupCatAlpha.width / 2;
          const upperBottom = Math.max(
            lampAlpha.y + lampAlpha.height,
            bubbleBox.y + bubbleBox.height,
          );
          assert.ok(
            Math.abs(catCenter - vignetteCenter) <= vignetteBox.width * 0.25 &&
              popupCatAlpha.y - upperBottom <= 80 &&
              popupCatAlpha.y + popupCatAlpha.height <=
                dialogBox.y + dialogBox.height - 48,
            `${width}x${height} cat, lamp, and bubble form a raised centered vignette group`,
          );
          for (const [name, box] of [
            ["New question", newQuestionBox],
            ["Give up", giveUpBox],
          ])
            assert.ok(
              box.y + box.height <= dialogBox.y + dialogBox.height - 24 &&
                box.height >= 44,
              `${width}x${height} ${name} remains inside the clear frame above the bottom artwork inset`,
            );
          if (width >= 946) {
            const operatorMetrics = await operatorRow
              .getByRole("button")
              .evaluateAll((buttons) =>
                buttons.map((button) => {
                  const buttonBox = button.getBoundingClientRect();
                  const image = button.querySelector("img");
                  const imageBox = image?.getBoundingClientRect();
                  const style = getComputedStyle(button);
                  return {
                    computed: Number.parseFloat(style.height),
                    minHeight: Number.parseFloat(style.minHeight),
                    padding: [
                      style.paddingTop,
                      style.paddingRight,
                      style.paddingBottom,
                      style.paddingLeft,
                    ],
                    buttonBox,
                    imageBox,
                    imageComputedWidth: image
                      ? Number.parseFloat(getComputedStyle(image).width)
                      : Number.NaN,
                    imageComputedHeight: image
                      ? Number.parseFloat(getComputedStyle(image).height)
                      : Number.NaN,
                  };
                }),
              );
            assert.equal(
              operatorMetrics.length,
              5,
              `${width}x${height} desktop keeps five operator buttons`,
            );
            for (const [
              index,
              {
                computed,
                minHeight,
                padding,
                buttonBox,
                imageBox,
                imageComputedWidth,
                imageComputedHeight,
              },
            ] of operatorMetrics.entries()) {
              assert.ok(
                minHeight >= 92 && computed >= 92,
                `${width}x${height} desktop operator ${index + 1} has at least a 92px computed minimum and height`,
              );
              assert.deepEqual(
                padding,
                ["0px", "0px", "0px", "0px"],
                `${width}x${height} desktop operator ${index + 1} has no padding that can constrain its 76px image`,
              );
              approximatelyEqual(
                buttonBox.height,
                computed * dialogScale,
                1,
                `${width}x${height} desktop operator ${index + 1} rendered height follows the dialog scale`,
              );
              assert.ok(
                imageBox &&
                  imageBox.x >= buttonBox.x &&
                  imageBox.y >= buttonBox.y &&
                  imageBox.x + imageBox.width <=
                    buttonBox.x + buttonBox.width &&
                  imageBox.y + imageBox.height <=
                    buttonBox.y + buttonBox.height,
                `${width}x${height} desktop operator ${index + 1} image remains contained`,
              );
              approximatelyEqual(
                imageComputedWidth,
                76,
                1,
                `${width}x${height} desktop operator ${index + 1} image computed width`,
              );
              approximatelyEqual(
                imageComputedHeight,
                76,
                1,
                `${width}x${height} desktop operator ${index + 1} image computed height`,
              );
              approximatelyEqual(
                imageBox.width,
                imageComputedWidth * dialogScale,
                1,
                `${width}x${height} desktop operator ${index + 1} image rendered width follows the dialog scale`,
              );
              approximatelyEqual(
                imageBox.height,
                imageComputedHeight * dialogScale,
                1,
                `${width}x${height} desktop operator ${index + 1} image rendered height follows the dialog scale`,
              );
              approximatelyEqual(
                imageBox.x + imageBox.width / 2,
                buttonBox.x + buttonBox.width / 2,
                1,
                `${width}x${height} desktop operator ${index + 1} image is horizontally centered`,
              );
              approximatelyEqual(
                imageBox.y + imageBox.height / 2,
                buttonBox.y + buttonBox.height / 2,
                1,
                `${width}x${height} desktop operator ${index + 1} image is vertically centered`,
              );
            }
            for (let first = 0; first < operatorMetrics.length; first += 1)
              for (
                let second = first + 1;
                second < operatorMetrics.length;
                second += 1
              )
                assert.equal(
                  intersects(
                    operatorMetrics[first].imageBox,
                    operatorMetrics[second].imageBox,
                    0,
                  ),
                  false,
                  `${width}x${height} desktop operator images ${first + 1} and ${second + 1} do not overlap`,
                );
          }
          if (width === 943 && height === 708) {
            const shellBox = await hint.dialog
              .locator("xpath=..")
              .boundingBox();
            const gameSubtitleBox = await controls.instruction.boundingBox();
            assert.ok(
              shellBox &&
                gameSubtitleBox &&
                shellBox.y >= gameSubtitleBox.y + gameSubtitleBox.height + 8 &&
                shellBox.y + shellBox.height <= height - 12 &&
                Math.abs(shellBox.height - (height - 12 - shellBox.y)) <= 1,
              "943x708 popup shell fills the protected remaining lane with its 12px bottom reserve",
            );
          }
        }
        if (width <= 600)
          assert.equal(
            await hint.dialog.evaluate(
              (element) => getComputedStyle(element).backgroundSize,
            ),
            "cover",
            `${width}x${height} mobile dialog crops its background without squeezing the artwork`,
          );
        await hint.answer.focus();
        const answerFocus = await hint.answer.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.outlineColor, style.boxShadow, style.borderColor];
        });
        assert.equal(
          answerFocus.some(isPurple),
          true,
          `${width}x${height} focused answer uses a purple outline or ring rather than the browser-blue focus style`,
        );
        const dialogMetrics = await hint.dialog.evaluate((element) => ({
          overflowY: getComputedStyle(element).overflowY,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }));
        const shellMetrics = await hint.dialog
          .locator("xpath=..")
          .evaluate((element) => ({
            overflowY: getComputedStyle(element).overflowY,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
          }));
        if (height === 600 || height === 568) {
          const scrollOwner = [dialogMetrics, shellMetrics].find((metrics) =>
            ["auto", "scroll"].includes(metrics.overflowY),
          );
          assert.ok(
            scrollOwner,
            `${width}x${height} popup exposes an internal short-height scroll path`,
          );
          assert.ok(
            scrollOwner.scrollHeight >= scrollOwner.clientHeight,
            `${width}x${height} never clips overflow outside the dialog`,
          );
        }
      },
    );
});

test("SC06: responsive clean frame keeps geometry stable, scales before 820px, and makes one deliberate narrow reflow", async () => {
  const widths = [
    1440, 1280, 1279, 1200, 1078, 1026, 946, 945, 822, 821, 820, 819, 700, 601,
    600, 480, 390, 320,
  ];
  const snapshots = [];
  for (const width of widths)
    await withSession(
      { width, height: 1040 },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${width}x1040 responsive clean frame has no horizontal page overflow`,
        );
        snapshots.push({ width, ...(await sc06ResponsiveGeometry(hint)) });
      },
    );
  const maximumRelativeDelta = (first, second) =>
    Math.max(
      ...Object.keys(first.relative)
        .filter((name) => second.relative[name])
        .flatMap((name) =>
          Object.keys(first.relative[name]).map((metric) =>
            Math.abs(
              first.relative[name][metric] - second.relative[name][metric],
            ),
          ),
        ),
    );
  const atWidth = (width) => snapshots.find((sample) => sample.width === width);
  const boundary = [822, 821, 820, 819].map(atWidth);
  for (const sample of boundary.filter((sample) => sample.width > 820)) {
    const shell = sample.shellBacking.box;
    approximatelyEqual(
      shell.x,
      24,
      2,
      `${sample.width}px boundary shell keeps the common 24px left gutter`,
    );
    approximatelyEqual(
      shell.width,
      sample.width - 48,
      2,
      `${sample.width}px boundary shell follows the common viewport-minus-48px width function`,
    );
    approximatelyEqual(
      sample.dialog.x,
      shell.x,
      2,
      `${sample.width}px boundary dialog stays centered with its shell`,
    );
    approximatelyEqual(
      sample.dialog.width,
      shell.width,
      2,
      `${sample.width}px boundary dialog width stays continuous with its shell`,
    );
  }
  for (let index = 1; index < 2; index += 1) {
    const previous = boundary[index - 1];
    const current = boundary[index];
    approximatelyEqual(
      current.dialog.x,
      previous.dialog.x,
      2,
      `${previous.width}/${current.width}px boundary dialog x has no breakpoint jump`,
    );
    approximatelyEqual(
      current.dialog.width,
      previous.dialog.width - (previous.width - current.width),
      2,
      `${previous.width}/${current.width}px boundary dialog width changes only with the viewport`,
    );
  }
  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1];
    const current = snapshots[index];
    const sameFrame =
      Math.abs(previous.dialog.width - current.dialog.width) <= 1 &&
      Math.abs(previous.dialog.height - current.dialog.height) <= 1;
    const crossesMobileComposition =
      previous.width > 600 && current.width <= 600;
    if (sameFrame && !crossesMobileComposition)
      assert.ok(
        maximumRelativeDelta(previous, current) <= 0.015,
        `${previous.width}/${current.width}px unchanged frame keeps dialog-relative geometry stable`,
      );
    if (previous.width > 820 && current.width > 820 && !sameFrame)
      assert.ok(
        maximumRelativeDelta(previous, current) <= 0.035,
        `${previous.width}/${current.width}px shrinking frame preserves proportional dialog-relative geometry before narrow reflow`,
      );
  }
  const columns = snapshots.filter((sample) => sample.width >= 821);
  const narrow = snapshots.filter((sample) => sample.width <= 820);
  assert.equal(
    columns.every((sample) => sample.composition === "columns"),
    true,
    "all widths above the selected narrow breakpoint retain one columnar composition",
  );
  assert.equal(
    narrow.every((sample) => sample.composition === "stacked"),
    true,
    "all widths at or below the selected narrow breakpoint retain one stacked composition",
  );
  const reflows = snapshots
    .slice(1)
    .filter(
      (sample, index) => sample.composition !== snapshots[index].composition,
    );
  assert.deepEqual(
    reflows.map((sample) => sample.width),
    [820],
    "exactly one deliberate structural reflow occurs at the selected 821/820px boundary",
  );
  for (const sample of snapshots) {
    assert.equal(
      sample.scaleTokens.every((value) => value === sample.scaleTokens[0]),
      true,
      `${sample.width}px dialog exposes one uniform shell-derived scale`,
    );
    const scale = sample.scaleTokens[0];
    if (sample.width <= 820)
      approximatelyEqual(
        scale,
        1,
        0.001,
        `${sample.width}px narrow reflow resets computed dialog scale to one`,
      );
    else
      assert.ok(
        scale > 0 && scale < 1,
        `${sample.width}px wide layout retains one reduced shell-derived dialog scale`,
      );
    approximatelyEqual(
      sample.dialog.width / sample.cssWidth,
      scale,
      0.01,
      `${sample.width}px rendered dialog width follows its one computed scale`,
    );
    approximatelyEqual(
      sample.dialog.height / sample.cssHeight,
      scale,
      0.01,
      `${sample.width}px rendered dialog height follows its one computed scale`,
    );
    if (sample.width > 820) {
      assert.notEqual(
        sample.shellBacking.background,
        "none",
        `${sample.width}px dialog shell ::before paints a nontransparent backing behind the alpha frame PNG`,
      );
      assert.ok(
        sample.shellBacking.borderRadius === "50%" ||
          Number.parseFloat(sample.shellBacking.borderRadius) > 0,
        `${sample.width}px dialog shell ::before backing is rounded`,
      );
      assert.ok(
        sample.shellBacking.top > 0 &&
          sample.shellBacking.right > 0 &&
          sample.shellBacking.bottom > 0 &&
          sample.shellBacking.left > 0,
        `${sample.width}px shell ::before is inset on every side so it cannot create a rectangular exterior slab`,
      );
    } else {
      approximatelyEqual(
        sample.shellBacking.box.x,
        0,
        1,
        `${sample.width}px narrow shell starts at the viewport left edge`,
      );
      approximatelyEqual(
        sample.shellBacking.box.width,
        sample.width,
        1,
        `${sample.width}px narrow shell spans the full viewport width`,
      );
      assert.equal(
        sample.shellBacking.shellBackgroundImage,
        "none",
        `${sample.width}px narrow shell removes the decorative frame image`,
      );
      assert.ok(
        Number.parseFloat(sample.shellBacking.shellRadius) === 0,
        `${sample.width}px narrow shell has no rounded outer frame`,
      );
      assert.ok(
        ["auto", "scroll"].includes(sample.overflowY),
        `${sample.width}px narrow dialog exposes bounded internal scrolling when its protected lane is exceeded`,
      );
    }
  }
  for (const [beforeWidth, afterWidth] of [
    [1280, 1279],
    [946, 945],
  ]) {
    const before = snapshots.find((sample) => sample.width === beforeWidth);
    const after = snapshots.find((sample) => sample.width === afterWidth);
    assert.equal(
      before.composition,
      after.composition,
      `${beforeWidth}/${afterWidth}px has no accidental structural jump`,
    );
    assert.ok(
      maximumRelativeDelta(before, after) <= 0.035,
      `${beforeWidth}/${afterWidth}px has no accidental dialog-relative geometry jump`,
    );
  }
});

test("SC06: desktop and tablet composition use the approved micro-adjustments while narrow overrides remain unchanged", async () => {
  for (const [width, height] of [
    [1440, 1040],
    [1024, 1040],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const content = hint.dialog.locator("section");
        const vignette = hint.dialog.locator("aside");
        const lamp = await exact(
          vignette.locator('img[src*="hint-popup-lamp-"]'),
          `${width}x${height} desktop/tablet lamp`,
        );
        const bubble = await exact(
          vignette.getByText("Solve this and I’ll give you a hint!", {
            exact: true,
          }),
          `${width}x${height} desktop/tablet bubble`,
        );
        const title = await exact(
          hint.dialog.getByRole("heading", {
            name: "Solve a quick math question",
            exact: true,
          }),
          `${width}x${height} desktop/tablet title`,
        );
        const close = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} desktop/tablet close paw`,
        );
        const cat = await exact(
          vignette.locator('img[src*="hint-popup-cat-"]'),
          `${width}x${height} desktop/tablet cat`,
        );
        const actions = hint.newQuestion.locator("xpath=..");
        const notice = vignette.locator("p");
        const catNoticeStack = notice.locator("xpath=..");
        const [
          contentTransform,
          lampGeometry,
          bubbleGeometry,
          closeGeometry,
          actionsTransform,
          stackBottom,
          dialogBox,
          contentBox,
          titleBox,
          lampBox,
          bubbleBox,
          closeBox,
          catBox,
          noticeBox,
          pageMetrics,
        ] = await Promise.all([
          content.evaluate((element) => getComputedStyle(element).transform),
          lamp.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              left: Number.parseFloat(style.left),
              top: Number.parseFloat(style.top),
            };
          }),
          bubble.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              right: Number.parseFloat(style.right),
              top: Number.parseFloat(style.top),
            };
          }),
          close.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              right: Number.parseFloat(style.right),
              top: Number.parseFloat(style.top),
              width: Number.parseFloat(style.width),
              height: Number.parseFloat(style.height),
            };
          }),
          actions.evaluate((element) => getComputedStyle(element).transform),
          catNoticeStack.evaluate((element) =>
            Number.parseFloat(getComputedStyle(element).bottom),
          ),
          hint.dialog.boundingBox(),
          content.boundingBox(),
          visibleTextBounds(title),
          lamp.boundingBox(),
          bubble.boundingBox(),
          close.boundingBox(),
          cat.boundingBox(),
          notice.boundingBox(),
          page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            viewportWidth: innerWidth,
          })),
        ]);
        assert.deepEqual(
          transformTranslation(contentTransform),
          { x: 14, y: 0 },
          `${width}x${height} calculation card moves exactly 14px right`,
        );
        assert.deepEqual(
          lampGeometry,
          { left: 6, top: 37 },
          `${width}x${height} lamp uses the approved 6px/37px computed anchor`,
        );
        assert.deepEqual(
          bubbleGeometry,
          { right: 37, top: -21 },
          `${width}x${height} speech bubble uses the approved 37px/-21px computed anchor`,
        );
        assert.deepEqual(
          closeGeometry,
          { right: -15, top: 36, width: 76, height: 76 },
          `${width}x${height} close paw uses the approved -15px/36px 76px geometry`,
        );
        assert.deepEqual(
          transformTranslation(actionsTransform),
          { x: 14, y: -15 },
          `${width}x${height} bottom action row follows the card 14px right and 15px up`,
        );
        approximatelyEqual(
          stackBottom,
          0,
          0.01,
          `${width}x${height} cat/notice stack uses a zero logical bottom inset`,
        );
        approximatelyEqual(
          noticeBox.y + noticeBox.height,
          contentBox.y + contentBox.height,
          1,
          `${width}x${height} notice bottom aligns with calculation-card bottom under dialog scale`,
        );
        for (const [name, box] of Object.entries({
          contentBox,
          lampBox,
          bubbleBox,
          closeBox,
        }))
          assert.ok(
            box.x >= dialogBox.x - 1 &&
              box.y >= dialogBox.y - 1 &&
              box.x + box.width <= dialogBox.x + dialogBox.width + 1 &&
              box.y + box.height <= dialogBox.y + dialogBox.height + 1,
            `${width}x${height} moved ${name} remains attached inside the rendered safe frame`,
          );
        for (const [firstName, secondName] of [
          ["contentBox", "titleBox"],
          ["contentBox", "catBox"],
          ["lampBox", "titleBox"],
          ["lampBox", "contentBox"],
          ["bubbleBox", "titleBox"],
          ["bubbleBox", "contentBox"],
          ["closeBox", "titleBox"],
          ["closeBox", "contentBox"],
          ["closeBox", "catBox"],
        ])
          assert.equal(
            intersects(
              { contentBox, titleBox, lampBox, bubbleBox, closeBox, catBox }[
                firstName
              ],
              { contentBox, titleBox, lampBox, bubbleBox, closeBox, catBox }[
                secondName
              ],
              0,
            ),
            false,
            `${width}x${height} ${firstName} does not collide with ${secondName}`,
          );
        assert.ok(
          pageMetrics.scrollWidth <= pageMetrics.viewportWidth,
          `${width}x${height} desktop/tablet composition creates no horizontal page overflow`,
        );
      },
    );
  for (const [width, height] of [
    [820, 1040],
    [768, 1024],
    [700, 920],
    [601, 900],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const content = hint.dialog.locator("section");
        const vignette = hint.dialog.locator("aside");
        const lamp = await exact(
          vignette.locator('img[src*="hint-popup-lamp-"]'),
          `${width}x${height} narrow lamp`,
        );
        const bubble = await exact(
          vignette.getByText("Solve this and I’ll give you a hint!", {
            exact: true,
          }),
          `${width}x${height} narrow bubble`,
        );
        const actions = hint.newQuestion.locator("xpath=..");
        const [
          contentTransform,
          vignetteBox,
          bubbleBox,
          catAlpha,
          lampAlpha,
          lampMetrics,
          bubbleTransform,
          tailTransform,
          tailMetrics,
          actionsTransform,
        ] = await Promise.all([
          content.evaluate((element) => getComputedStyle(element).transform),
          vignette.boundingBox(),
          bubble.boundingBox(),
          visibleAlphaBounds(page, vignette.locator('img[src*="hint-popup-cat-"]')),
          visibleAlphaBounds(page, lamp),
          lamp.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              left: Number.parseFloat(style.left),
              top: Number.parseFloat(style.top),
              transform: style.transform,
              width: Number.parseFloat(style.width),
              zIndex: Number.parseInt(style.zIndex, 10),
            };
          }),
          bubble.evaluate((element) => getComputedStyle(element).transform),
          bubble.evaluate(
            (element) => getComputedStyle(element, "::after").transform,
          ),
          bubble.evaluate((element) => {
            const readTail = (tail) => ({
              borderBottomWidth: Number.parseFloat(tail.borderBottomWidth),
              borderLeftWidth: Number.parseFloat(tail.borderLeftWidth),
              borderRightColor: tail.borderRightColor,
              borderRightWidth: Number.parseFloat(tail.borderRightWidth),
              borderTopColor: tail.borderTopColor,
              borderTopWidth: Number.parseFloat(tail.borderTopWidth),
              bottom: Number.parseFloat(tail.bottom),
              content: tail.content,
              height: Number.parseFloat(tail.height),
              left: Number.parseFloat(tail.left),
              top: Number.parseFloat(tail.top),
              transform: tail.transform,
              visibility: tail.visibility,
              width: Number.parseFloat(tail.width),
            });
            return {
              inner: readTail(getComputedStyle(element, "::before")),
              outer: readTail(getComputedStyle(element, "::after")),
            };
          }),
          actions.evaluate((element) => getComputedStyle(element).transform),
        ]);
        assert.deepEqual(
          transformTranslation(contentTransform),
          { x: 0, y: 0 },
          `${width}x${height} narrow calculation card retains its explicit unshifted override`,
        );
        approximatelyEqual(
          lampMetrics.top,
          10,
          0.01,
          `${width}x${height} narrow lamp retains its explicit 10px anchor`,
        );
        const bubbleTranslation = transformTranslation(bubbleTransform);
        const isTablet = width > 600;
        if (isTablet) {
          assert.deepEqual(
            transformTranslation(lampMetrics.transform),
            { x: 172, y: 0 },
            `${width}x${height} tablet lamp shifts 172px right without changing its anchor dimensions`,
          );
          approximatelyEqual(
            lampMetrics.left,
            Math.max(14, vignetteBox.width * 0.04),
            1,
            `${width}x${height} tablet lamp preserves its original left anchor`,
          );
          approximatelyEqual(
            lampMetrics.width,
            Math.min(76, Math.max(56, width * 0.09)),
            1,
            `${width}x${height} tablet lamp preserves its original responsive width`,
          );
          assert.equal(
            lampMetrics.zIndex,
            3,
            `${width}x${height} tablet lamp preserves its foreground stacking order`,
          );
          assert.deepEqual(
            bubbleTranslation,
            { x: -20, y: 10 },
            `${width}x${height} tablet moves the whole bubble and tail 20px left while preserving its vertical placement`,
          );
          assert.ok(
            vignetteBox && bubbleBox && catAlpha && lampAlpha,
            `${width}x${height} tablet vignette, bubble, and cat remain rendered`,
          );
          assert.ok(
            bubbleBox.y >= vignetteBox.y + 10,
            `${width}x${height} tablet bubble border stays at least 10px below the vignette top`,
          );
          assert.ok(
            bubbleBox.x >= vignetteBox.x &&
              bubbleBox.y >= vignetteBox.y &&
              bubbleBox.x + bubbleBox.width <=
                vignetteBox.x + vignetteBox.width &&
              bubbleBox.y + bubbleBox.height <=
                vignetteBox.y + vignetteBox.height,
            `${width}x${height} tablet bubble body remains fully inside its vignette`,
          );
          assert.ok(
            lampAlpha.x >= vignetteBox.x &&
              lampAlpha.y >= vignetteBox.y &&
              lampAlpha.x + lampAlpha.width <=
                vignetteBox.x + vignetteBox.width &&
              lampAlpha.y + lampAlpha.height <=
                vignetteBox.y + vignetteBox.height &&
              !intersects(lampAlpha, bubbleBox, 0),
            `${width}x${height} shifted tablet lamp remains contained and clear of the bubble`,
          );
          assert.ok(
            bubbleBox.x - (lampAlpha.x + lampAlpha.width) > 0,
            `${width}x${height} tablet lamp keeps a positive horizontal clearance before the bubble`,
          );
          assert.ok(
            catAlpha.x + catAlpha.width / 2 < bubbleBox.x + bubbleBox.width / 2,
            `${width}x${height} tablet bubble remains to the cat-facing side of the vignette`,
          );
        } else
          assert.deepEqual(
            bubbleTranslation,
            { x: -15, y: 10 },
            `${width}x${height} mobile bubble moves 25px right and 40px down from its former correction`,
          );
        assert.match(
          tailTransform,
          /^matrix\(/,
          `${width}x${height} narrow bubble tail retains its transformed orientation`,
        );
        const tailMatrix = tailTransform
          .match(/matrix\(([^)]+)\)/)?.[1]
          .split(",")
          .map(Number);
        if (bubbleBox) {
          assert.deepEqual(
            transformTranslation(tailTransform),
            { x: 0, y: 0 },
            `${width}x${height} narrow tail retains its original attachment coordinates`,
          );
          assert.ok(
            tailMetrics.outer.content !== "none" &&
              tailMetrics.outer.visibility !== "hidden" &&
              tailMetrics.outer.borderLeftWidth === 12 &&
              tailMetrics.outer.borderRightWidth === 0 &&
              tailMetrics.outer.borderTopWidth === 18 &&
              tailMetrics.outer.borderBottomWidth === 0 &&
              isPurple(tailMetrics.outer.borderTopColor),
            `${width}x${height} narrow tail retains the approved single purple triangle construction`,
          );
          assert.equal(
            tailMetrics.inner.content,
            "none",
            `${width}x${height} narrow tail reuses the reward bubble's single ::after triangle`,
          );
          assert.ok(
            tailMatrix?.length === 6 &&
              Math.abs(tailMatrix[0]) <= 0.01 &&
              Math.abs(tailMatrix[1] - 1) <= 0.01 &&
              Math.abs(tailMatrix[2] + 1) <= 0.01 &&
              Math.abs(tailMatrix[3]) <= 0.01,
            `${width}x${height} narrow tail uses the reward bubble's rotate(90deg) orientation`,
          );
          approximatelyEqual(
            tailMetrics.outer.bottom,
            isTablet ? 22.3 : 18.3,
            0.01,
            `${width}x${height} ${isTablet ? "tablet" : "mobile"} tail uses its approved bottom attachment`,
          );
          approximatelyEqual(
            tailMetrics.outer.left,
            bubbleBox.width * 0.04 - (isTablet ? 24.5 : 22.5),
            2,
            `${width}x${height} ${isTablet ? "tablet" : "mobile"} tail uses its approved relative left attachment`,
          );
        }
        assert.deepEqual(
          transformTranslation(actionsTransform),
          { x: 0, y: 0 },
          `${width}x${height} narrow bottom actions retain their explicit unshifted override`,
        );
      },
    );
});

test.skip("SC06: superseded mobile lamp-and-bubble vignette geometry", async () => {
  const samples = [];
  for (const width of [390, 405, 481, 500, 540, 586, 600])
    await withSession(
      { width, height: 1040 },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const vignette = await exact(
          hint.dialog.locator("aside"),
          `${width}px mobile vignette`,
        );
        const lamp = await exact(
          vignette.locator('img[src*="hint-popup-lamp-"]'),
          `${width}px mobile vignette lamp`,
        );
        const cat = await exact(
          vignette.locator('img[src*="hint-popup-cat-"]'),
          `${width}px mobile vignette cat`,
        );
        const bubble = await exact(
          vignette.getByText("Solve this and I’ll give you a hint!", {
            exact: true,
          }),
          `${width}px mobile vignette bubble`,
        );
        const [
          vignetteBox,
          lampBox,
          catBox,
          bubbleBox,
          lampAlpha,
          lampMetrics,
          tailMetrics,
        ] = await Promise.all([
          vignette.boundingBox(),
          lamp.boundingBox(),
          cat.boundingBox(),
          bubble.boundingBox(),
          visibleAlphaBounds(page, lamp),
          lamp.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              left: Number.parseFloat(style.left),
              top: Number.parseFloat(style.top),
              transform: style.transform,
              width: Number.parseFloat(style.width),
              zIndex: Number.parseInt(style.zIndex, 10),
            };
          }),
          bubble.evaluate((element) => {
            const tail = getComputedStyle(element, "::after");
            return {
              borderLeftWidth: Number.parseFloat(tail.borderLeftWidth),
              borderTopWidth: Number.parseFloat(tail.borderTopWidth),
              bottom: Number.parseFloat(tail.bottom),
              left: Number.parseFloat(tail.left),
              transform: tail.transform,
            };
          }),
        ]);
        assert.ok(
          vignetteBox && lampBox && catBox && bubbleBox,
          `${width}px ordinary-height mobile keeps every vignette child rendered`,
        );
        const inset = Math.min(24, Math.max(12, width * 0.04));
        approximatelyEqual(
          vignetteBox.width,
          Math.min(440, width - 2 * inset),
          2,
          `${width}px mobile vignette keeps its responsive width`,
        );
        approximatelyEqual(
          vignetteBox.height,
          Math.min(184, Math.max(150, width * 0.44)),
          2,
          `${width}px mobile vignette keeps its responsive height`,
        );
        assert.deepEqual(
          transformTranslation(lampMetrics.transform),
          { x: 0, y: 15 },
          `${width}px mobile lamp uses the approved vertical-only placement`,
        );
        approximatelyEqual(
          lampMetrics.left,
          vignetteBox.width * 0.71 - 159,
          2,
          `${width}px mobile lamp uses its calc(71% - 159px) left anchor`,
        );
        approximatelyEqual(
          lampMetrics.top,
          6,
          0.01,
          `${width}px mobile lamp preserves its 6px top anchor`,
        );
        approximatelyEqual(
          lampMetrics.width,
          Math.min(58, Math.max(44, width * 0.14)),
          1,
          `${width}px mobile lamp preserves its responsive width`,
        );
        assert.equal(
          lampMetrics.zIndex,
          3,
          `${width}px mobile lamp preserves foreground stacking`,
        );
        const tailTranslation = transformTranslation(tailMetrics.transform);
        const tailEnvelope = {
          height: tailMetrics.borderLeftWidth + tailMetrics.borderTopWidth,
          width: tailMetrics.borderLeftWidth + tailMetrics.borderTopWidth,
          x:
            bubbleBox.x +
            tailMetrics.left +
            tailTranslation.x -
            tailMetrics.borderTopWidth,
          y:
            bubbleBox.y +
            bubbleBox.height -
            tailMetrics.bottom +
            tailTranslation.y -
            tailMetrics.borderLeftWidth,
        };
        assert.ok(
          lampAlpha.x >= vignetteBox.x &&
            lampAlpha.y >= vignetteBox.y &&
            lampAlpha.x + lampAlpha.width <=
              vignetteBox.x + vignetteBox.width &&
            lampAlpha.y + lampAlpha.height <=
              vignetteBox.y + vignetteBox.height &&
            !intersects(lampAlpha, bubbleBox, 0) &&
            !intersects(lampAlpha, tailEnvelope, 0),
          `${width}px mobile lamp remains contained and clear of bubble text and tail`,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${width}px mobile vignette creates no horizontal page scroll`,
        );
        if (width >= 481)
          samples.push({
            width,
            vignette: { height: vignetteBox.height, width: vignetteBox.width },
            children: Object.fromEntries(
              Object.entries({
                lamp: lampBox,
                cat: catBox,
                bubble: bubbleBox,
              }).map(([name, box]) => [
                name,
                {
                  height: box.height,
                  width: box.width,
                  x: box.x - vignetteBox.x,
                  y: box.y - vignetteBox.y,
                },
              ]),
            ),
          });
      },
    );
  const baseline = samples[0];
  for (const sample of samples.slice(1)) {
    approximatelyEqual(
      sample.vignette.width,
      baseline.vignette.width,
      1,
      `${baseline.width}/${sample.width}px mobile vignette width remains stable`,
    );
    approximatelyEqual(
      sample.vignette.height,
      baseline.vignette.height,
      1,
      `${baseline.width}/${sample.width}px mobile vignette height remains stable`,
    );
    for (const name of ["lamp", "cat", "bubble"])
      for (const property of ["x", "y", "width", "height"])
        approximatelyEqual(
          sample.children[name][property],
          baseline.children[name][property],
          1,
          `${baseline.width}/${sample.width}px mobile ${name} ${property} remains stable relative to the vignette`,
        );
  }
  for (const width of [320, 390, 600])
    await withSession(
      { width, height: 760 },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const vignette = await exact(
          hint.dialog.locator('aside[aria-hidden="true"]'),
          "compact vignette",
        );
        const cat = await exact(
          vignette.locator('img[src*="hint-popup-cat-"]'),
          `${width}x760px compact state cat`,
        );
        const bubble = await exact(
          vignette.locator(":scope > div").first(),
          `${width}x760px compact speech bubble`,
        );
        const notice = await exact(
          vignette.getByText(
            "A correct answer will unlock a hint in the game!",
            { exact: true },
          ),
          `${width}x760px compact earned-hint notice`,
        );
        const [
          vignetteStyle,
          vignetteBox,
          catBox,
          catAlpha,
          bubbleBox,
          noticeBox,
        ] = await Promise.all([
          vignette.evaluate((element) => getComputedStyle(element).display),
          vignette.boundingBox(),
          cat.boundingBox(),
          visibleAlphaBounds(page, cat),
          bubble.boundingBox(),
          notice.boundingBox(),
        ]);
        assert.equal(
          vignetteStyle,
          "grid",
          `${width}x760px compact-height mobile keeps the state vignette visible as a grid`,
        );
        assert.equal(
          await vignette.isVisible(),
          true,
          `${width}x760px compact vignette is visible`,
        );
        assert.ok(
          vignetteBox && catBox && bubbleBox && noticeBox,
          `${width}x760px compact scene keeps every state region rendered`,
        );
        const contained = (inner, outer) =>
          inner.x >= outer.x - 1 &&
          inner.y >= outer.y - 1 &&
          inner.x + inner.width <= outer.x + outer.width + 1 &&
          inner.y + inner.height <= outer.y + outer.height + 1;
        assert.equal(
          contained(catAlpha, vignetteBox),
          true,
          `${width}x760px compact visible cat art remains inside the vignette`,
        );
        assert.equal(
          intersects(catAlpha, bubbleBox, 0),
          false,
          `${width}x760px compact bubble does not obscure cat art`,
        );
        assert.equal(
          intersects(catAlpha, noticeBox, 0),
          false,
          `${width}x760px compact notice does not obscure cat art`,
        );
        assert.equal(
          intersects(bubbleBox, noticeBox, 0),
          false,
          `${width}x760px compact bubble does not obscure notice copy`,
        );
        const lockBefore = await page.evaluate(() => ({
          bodyOverflowY: getComputedStyle(document.body).overflowY,
          documentOverflowY: getComputedStyle(document.documentElement)
            .overflowY,
          scrollY,
        }));
        await page.keyboard.press("End");
        await page.mouse.wheel(0, 1_000);
        const lockAfter = await page.evaluate(() => ({
          bodyOverflowY: getComputedStyle(document.body).overflowY,
          documentOverflowY: getComputedStyle(document.documentElement)
            .overflowY,
          scrollY,
        }));
        assert.deepEqual(
          [lockBefore.bodyOverflowY, lockBefore.documentOverflowY],
          ["hidden", "hidden"],
          `${width}x760px keeps body and document overflow hidden even when DOM extent exceeds the viewport`,
        );
        assert.deepEqual(
          lockAfter,
          lockBefore,
          `${width}x760px End and wheel cannot activate page scrolling under the modal lock`,
        );
      },
    );
});

test("SC06: 601-820px narrow challenge presents one decorated fullscreen card with its concise subtitle", async () => {
  for (const [width, height] of [
    [820, 1064],
    [820, 920],
    [768, 1024],
    [601, 900],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        const preOpenPage = await page.evaluate(() => ({
          scrollHeight: document.documentElement.scrollHeight,
          scrollY,
        }));
        const gameSubtitleBox = await controls.instruction.boundingBox();
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const close = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} tablet-header close control`,
        );
        const header = hint.dialog.locator("header");
        const title = await exact(
          header.getByRole("heading", {
            name: "Solve a quick math question",
            exact: true,
          }),
          `${width}x${height} tablet header title`,
        );
        const subtitle = await exact(
          header.locator("p"),
          `${width}x${height} concise tablet header subtitle`,
        );
        const content = hint.dialog.locator("section");
        const vignette = hint.dialog.locator("aside");
        const expression = await exact(
          hint.dialog.locator("label[for='hint-answer']"),
          `${width}x${height} tablet equation`,
        );
        const operatorRow = hint.dialog.getByLabel("Choose a math operation", {
          exact: true,
        });
        const helper = hint.dialog.getByText(
          "Choose which operations can appear in the examples.",
          {
            exact: true,
          },
        );
        const feedback = hint.dialog.getByRole("status");
        const actions = hint.newQuestion.locator("xpath=..");
        const [
          dialogBox,
          shellMetrics,
          dialogMetrics,
          contentInner,
          headerBox,
          titleBox,
          subtitleBox,
          contentBox,
          vignetteBox,
          closeBox,
          expressionBox,
          answerBox,
          checkBox,
          operatorBox,
          helperBox,
          feedbackBox,
          actionsBox,
          newQuestionBox,
          giveUpBox,
          operatorMetrics,
          imageMetrics,
        ] = await Promise.all([
          hint.dialog.boundingBox(),
          hint.dialog.locator("xpath=..").evaluate((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            const alpha =
              style.backgroundColor.match(/\d+(?:\.\d+)?/g)?.map(Number)?.[3] ??
              1;
            return {
              box,
              radius: Number.parseFloat(style.borderRadius),
              image: style.backgroundImage,
              alpha,
            };
          }),
          hint.dialog.evaluate((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            const alpha =
              style.backgroundColor.match(/\d+(?:\.\d+)?/g)?.map(Number)?.[3] ??
              1;
            return {
              box,
              overflowY: style.overflowY,
              alpha,
              background: style.backgroundImage,
              scrollHeight: element.scrollHeight,
              clientHeight: element.clientHeight,
            };
          }),
          content.evaluate((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return {
              left:
                box.x +
                Number.parseFloat(style.borderLeftWidth) +
                Number.parseFloat(style.paddingLeft),
              bottom:
                box.y + box.height - Number.parseFloat(style.borderBottomWidth),
            };
          }),
          header.boundingBox(),
          title.boundingBox(),
          subtitle.boundingBox(),
          content.boundingBox(),
          vignette.boundingBox(),
          close.boundingBox(),
          expression.boundingBox(),
          hint.answer.boundingBox(),
          hint.check.boundingBox(),
          operatorRow.boundingBox(),
          helper.boundingBox(),
          feedback.boundingBox(),
          actions.boundingBox(),
          hint.newQuestion.boundingBox(),
          hint.giveUp.boundingBox(),
          operatorRow.getByRole("button").evaluateAll((buttons) =>
            buttons.map((button) => {
              const style = getComputedStyle(button);
              const box = button.getBoundingClientRect();
              return {
                pressed: button.getAttribute("aria-pressed") === "true",
                computedWidth: Number.parseFloat(style.width),
                computedHeight: Number.parseFloat(style.height),
                box: {
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height,
                },
              };
            }),
          ),
          hint.dialog.locator("img").evaluateAll((images) =>
            images.map((image) => ({
              visible: (() => {
                const style = getComputedStyle(image);
                const box = image.getBoundingClientRect();
                return (
                  style.display !== "none" &&
                  style.visibility !== "hidden" &&
                  box.width > 0 &&
                  box.height > 0
                );
              })(),
              complete: image.complete,
              naturalWidth: image.naturalWidth,
            })),
          ),
        ]);
        assert.ok(
          dialogBox &&
            headerBox &&
            titleBox &&
            contentBox &&
            vignetteBox &&
            closeBox &&
            expressionBox &&
            answerBox &&
            checkBox &&
            operatorBox &&
            helperBox &&
            feedbackBox &&
            actionsBox &&
            newQuestionBox &&
            giveUpBox &&
            gameSubtitleBox,
          `${width}x${height} keeps all approved tablet regions rendered`,
        );
        approximatelyEqual(
          shellMetrics.box.x,
          0,
          1,
          `${width}x${height} tablet shell begins at the viewport left edge`,
        );
        approximatelyEqual(
          shellMetrics.box.width,
          width,
          1,
          `${width}x${height} tablet shell spans the viewport width`,
        );
        const backdropBox = await hint.dialog.locator("xpath=../..").boundingBox();
        assert.ok(
          backdropBox &&
            backdropBox.x <= 1 && backdropBox.y <= 1 &&
            backdropBox.x + backdropBox.width >= width - 1 &&
            backdropBox.y + backdropBox.height >= height - 1,
          `${width}x${height} tablet backdrop intercepts the full visual viewport`,
        );
        approximatelyEqual(
          shellMetrics.box.height,
          height - shellMetrics.box.y,
          1,
          `${width}x${height} tablet shell occupies the viewport below its protected lane`,
        );
        assert.equal(
          shellMetrics.alpha,
          1,
          `${width}x${height} tablet surface remains opaque`,
        );
        assert.match(
          `${shellMetrics.image} ${dialogMetrics.background}`,
          /hint-popup-narrow-background-1254\.png/,
          `${width}x${height} uses the approved shared narrow decoration asset`,
        );
        approximatelyEqual(
          dialogMetrics.box.width,
          width,
          1,
          `${width}x${height} tablet dialog spans the viewport width`,
        );
        assert.ok(
          dialogMetrics.box.y >= gameSubtitleBox.y + gameSubtitleBox.height + 8,
          `${width}x${height} tablet dialog begins below the protected header lane`,
        );
        assert.ok(
          ["auto", "scroll"].includes(dialogMetrics.overflowY),
          `${width}x${height} tablet dialog exposes bounded internal scrolling`,
        );
        const pageScrollDuringDialog = await page.evaluate(() => {
          const initialY = scrollY;
          window.scrollTo(0, initialY + 100);
          const attemptedY = scrollY;
          window.scrollTo(0, initialY);
          return {
            scrollHeight: document.documentElement.scrollHeight,
            initialY,
            attemptedY,
          };
        });
        assert.ok(
          pageScrollDuringDialog.scrollHeight <= preOpenPage.scrollHeight,
          `${width}x${height} tablet dialog does not increase the pre-existing page extent`,
        );
        assert.equal(
          pageScrollDuringDialog.attemptedY,
          pageScrollDuringDialog.initialY,
          `${width}x${height} modal body lock prevents active page scrolling`,
        );
        assert.equal(
          await subtitle.evaluate(
            (element) => getComputedStyle(element).display,
          ),
          "block",
          `${width}x${height} header subtitle remains visible throughout the tablet range`,
        );
        assert.ok(
          subtitleBox && subtitleBox.width > 0 && subtitleBox.height > 0,
          `${width}x${height} visible tablet subtitle has rendered bounds`,
        );
        approximatelyEqual(
          closeBox.width,
          60,
          1,
          `${width}x${height} tablet close control keeps its 60px rendered target`,
        );
        approximatelyEqual(
          closeBox.height,
          60,
          1,
          `${width}x${height} tablet close control keeps its 60px rendered target`,
        );
        approximatelyEqual(
          dialogBox.x + dialogBox.width - (closeBox.x + closeBox.width),
          18,
          1,
          `${width}x${height} tablet close control sits 18px from the full dialog right edge`,
        );
        approximatelyEqual(
          closeBox.y - dialogBox.y,
          12,
          1,
          `${width}x${height} tablet close control sits 12px from the full dialog top edge`,
        );
        assert.equal(
          intersects(closeBox, titleBox, 0),
          false,
          `${width}x${height} tablet close control remains clear of the title`,
        );
        approximatelyEqual(
          contentBox.x + contentBox.width / 2,
          width / 2,
          3,
          `${width}x${height} unified math card remains centered`,
        );
        assert.equal(
          await vignette.isVisible(),
          true,
          `${width}x${height} cohesive lamp/cat/bubble/notice vignette remains visible`,
        );
        assert.equal(
          await helper.isVisible(),
          true,
          `${width}x${height} operator helper remains visible`,
        );
        approximatelyEqual(
          helperBox.x,
          contentInner.left,
          1,
          `${width}x${height} operator helper matches the calculation-card left content inset`,
        );
        approximatelyEqual(
          contentInner.bottom - (helperBox.y + helperBox.height),
          5,
          1,
          `${width}x${height} operator helper bottom remains 5px above the calculation-card inner border`,
        );
        assert.equal(
          intersects(helperBox, operatorBox, 0),
          false,
          `${width}x${height} operator helper does not overlap the operator controls`,
        );
        assert.equal(
          intersects(helperBox, feedbackBox, 0),
          false,
          `${width}x${height} operator helper does not overlap challenge status`,
        );
        assert.ok(
          helperBox.x >= contentBox.x &&
            helperBox.y >= contentBox.y &&
            helperBox.x + helperBox.width <= contentBox.x + contentBox.width &&
            helperBox.y + helperBox.height <= contentInner.bottom,
          `${width}x${height} operator helper remains unclipped inside the calculation card`,
        );
        assert.equal(
          operatorMetrics.length,
          5,
          `${width}x${height} retains all five operator buttons`,
        );
        assert.equal(
          operatorMetrics.every(
            (metric) =>
              metric.computedWidth >= 68 &&
              metric.computedWidth <= 80 &&
              metric.computedHeight >= 68 &&
              metric.computedHeight <= 80 &&
              metric.box.width >= 68 &&
              metric.box.width <= 80 &&
              metric.box.height >= 68 &&
              metric.box.height <= 80,
          ),
          true,
          `${width}x${height} operator controls use the approved expanded square tablet tiles`,
        );
        const orderedOperators = [...operatorMetrics].sort(
          (first, second) => first.box.x - second.box.x,
        );
        assert.equal(
          orderedOperators.every(
            (metric, index) =>
              index === 0 ||
              Math.abs(metric.box.y - orderedOperators[0].box.y) <= 1,
          ),
          true,
          `${width}x${height} operators remain in one horizontal row`,
        );
        for (let index = 1; index < orderedOperators.length; index += 1)
          assert.ok(
            orderedOperators[index].box.x -
              (orderedOperators[index - 1].box.x +
                orderedOperators[index - 1].box.width) >=
              0 &&
              orderedOperators[index].box.x -
                (orderedOperators[index - 1].box.x +
                  orderedOperators[index - 1].box.width) <=
                64,
            `${width}x${height} adjacent tablet operator controls keep a compact gap`,
          );
        const selectedOperator = operatorMetrics.find(
          (metric) => metric.pressed,
        );
        assert.ok(
          selectedOperator &&
            selectedOperator.box.width <= selectedOperator.computedWidth + 1,
          `${width}x${height} selected operator surface never exceeds its control width`,
        );
        for (const [name, box] of Object.entries({
          contentBox, vignetteBox, expressionBox, answerBox, checkBox,
          operatorBox, helperBox, actionsBox, newQuestionBox, giveUpBox,
        }))
          assert.ok(
            box.x >= -1 &&
              box.x + box.width <= width + 1 &&
              box.y >= dialogMetrics.box.y - 1 &&
              box.y + box.height <= dialogMetrics.box.y + dialogMetrics.scrollHeight + 1,
            `${width}x${height} ${name} stays horizontally contained in the dialog scroll canvas`,
          );
        for (const [name, box] of Object.entries({ headerBox, closeBox }))
          assert.ok(
            box.x >= -1 && box.x + box.width <= width + 1 &&
              box.y >= -1 && box.y + box.height <= height + 1,
            `${width}x${height} positioned ${name} stays viewport-contained`,
          );
        for (const [first, second] of [
          ["headerBox", "contentBox"],
          ["contentBox", "vignetteBox"],
          ["answerBox", "checkBox"],
          ["operatorBox", "actionsBox"],
          ["newQuestionBox", "giveUpBox"],
        ])
          assert.equal(
            intersects(
              {
                headerBox,
                contentBox,
                vignetteBox,
                answerBox,
                checkBox,
                operatorBox,
                actionsBox,
                newQuestionBox,
                giveUpBox,
              }[first],
              {
                headerBox,
                contentBox,
                vignetteBox,
                answerBox,
                checkBox,
                operatorBox,
                actionsBox,
                newQuestionBox,
                giveUpBox,
              }[second],
              0,
            ),
            false,
            `${width}x${height} ${first} does not overlap ${second}`,
          );
        assert.ok(
          actionsBox.y >= vignetteBox.y + vignetteBox.height &&
            actionsBox.y - (vignetteBox.y + vignetteBox.height) <= 48,
          `${width}x${height} equal-width actions follow the cohesive hint vignette without a detached lower void`,
        );
        approximatelyEqual(
          newQuestionBox.width,
          giveUpBox.width,
          2,
          `${width}x${height} tablet actions retain equal widths`,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${width}x${height} tablet has no horizontal page overflow`,
        );
        assert.equal(
          imageMetrics
            .filter((image) => image.visible)
            .every((image) => image.complete && image.naturalWidth > 0),
          true,
          `${width}x${height} visible tablet images are fully loaded`,
        );
        if (dialogMetrics.scrollHeight > dialogMetrics.clientHeight + 1) {
          await hint.dialog.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          const [actionsReach, newQuestionReach, giveUpReach, dialogReach] =
            await Promise.all([
              actions.boundingBox(),
              hint.newQuestion.boundingBox(),
              hint.giveUp.boundingBox(),
              hint.dialog.boundingBox(),
            ]);
          assert.ok(
            [actionsReach, newQuestionReach, giveUpReach].every(
              (box) => box && box.x >= -1 && box.x + box.width <= width + 1 &&
                box.y >= dialogReach.y && box.y + box.height <= dialogReach.y + dialogReach.height,
            ),
            `${width}x${height} internal scrolling reaches the tablet actions without horizontal escape`,
          );
        }
      },
    );
});

test("SC06: tablet operators fill the answer-form span with responsive equal tiles without shifting the scene", async () => {
  const tabletSamples = [];
  for (const [width, height] of [
    [601, 900],
    [700, 920],
    [768, 1024],
    [820, 1064],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const content = hint.dialog.locator("section");
        const vignette = hint.dialog.locator('aside[aria-hidden="true"]');
        const actions = hint.newQuestion.locator("xpath=..");
        const answerForm = hint.answer.locator("xpath=..");
        const board = hint.dialog.getByLabel("Choose a math operation", {
          exact: true,
        });
        const helper = await exact(
          hint.dialog.getByText(
            "Choose which operations can appear in the examples.",
            {
              exact: true,
            },
          ),
          `${width}x${height} tablet operator helper`,
        );
        const snapshot = async () => {
          const [
            contentBox,
            contentInnerBottom,
            vignetteBox,
            actionsBox,
            formBox,
            boardBox,
            helperBox,
            dialogMetrics,
            buttons,
          ] = await Promise.all([
            content.boundingBox(),
            content.evaluate((element) => {
              const box = element.getBoundingClientRect();
              return (
                box.y +
                box.height -
                Number.parseFloat(getComputedStyle(element).borderBottomWidth)
              );
            }),
            vignette.boundingBox(),
            actions.boundingBox(),
            answerForm.boundingBox(),
            board.boundingBox(),
            helper.boundingBox(),
            hint.dialog.evaluate((element) => {
              const style = getComputedStyle(element);
              const box = element.getBoundingClientRect();
              return {
                contentBottom: box.y + box.height,
                overflowY: style.overflowY,
                scrollHeight: element.scrollHeight,
                clientHeight: element.clientHeight,
                scrollWidth: document.documentElement.scrollWidth,
              };
            }),
            board.getByRole("button").evaluateAll((elements) =>
              elements.map((button) => {
                const box = button.getBoundingClientRect();
                const image = button.querySelector("img");
                const imageBox = image?.getBoundingClientRect();
                const imageStyle = image && getComputedStyle(image);
                return {
                  box: {
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                  },
                  image: imageBox && {
                    x: imageBox.x,
                    y: imageBox.y,
                    width: imageBox.width,
                    height: imageBox.height,
                    loaded:
                      image.complete &&
                      image.naturalWidth > 0 &&
                      image.naturalHeight > 0,
                    objectFit: imageStyle.objectFit,
                  },
                  pressed: button.getAttribute("aria-pressed") === "true",
                };
              }),
            ),
          ]);
          assert.ok(
            contentBox &&
              vignetteBox &&
              actionsBox &&
              formBox &&
              boardBox &&
              helperBox,
            `${width}x${height} tablet operator snapshot has every required region`,
          );
          return {
            actions: actionsBox,
            board: boardBox,
            buttons,
            content: contentBox,
            contentInnerBottom,
            dialogMetrics,
            form: formBox,
            helper: helperBox,
            vignette: vignetteBox,
          };
        };
        const beforeSelection = await snapshot();
        const ordered = [...beforeSelection.buttons].sort(
          (first, second) => first.box.x - second.box.x,
        );
        assert.equal(
          ordered.length,
          5,
          `${width}x${height} tablet renders exactly five operators`,
        );
        const first = ordered[0];
        const last = ordered.at(-1);
        assert.ok(
          first && last,
          `${width}x${height} tablet has first and last operator tiles`,
        );
        approximatelyEqual(
          beforeSelection.board.x,
          beforeSelection.form.x,
          1,
          `${width}x${height} operator board aligns its left edge to the answer form`,
        );
        approximatelyEqual(
          beforeSelection.board.x + beforeSelection.board.width,
          beforeSelection.form.x + beforeSelection.form.width,
          1,
          `${width}x${height} operator board aligns its right edge to the answer form`,
        );
        approximatelyEqual(
          first.box.x,
          beforeSelection.board.x,
          1,
          `${width}x${height} first operator aligns to the board left edge`,
        );
        approximatelyEqual(
          first.box.x,
          beforeSelection.form.x,
          1,
          `${width}x${height} first operator aligns to the answer-form left edge`,
        );
        approximatelyEqual(
          last.box.x + last.box.width,
          beforeSelection.board.x + beforeSelection.board.width,
          1,
          `${width}x${height} last operator aligns to the board right edge`,
        );
        approximatelyEqual(
          last.box.x + last.box.width,
          beforeSelection.form.x + beforeSelection.form.width,
          1,
          `${width}x${height} last operator aligns to the answer-form right edge`,
        );
        for (const [index, button] of ordered.entries()) {
          assert.ok(
            button.box.width >= 68 &&
              button.box.width <= 80 &&
              button.box.height >= 68 &&
              button.box.height <= 80,
            `${width}x${height} tablet operator ${index + 1} uses a 68-80px tile`,
          );
          approximatelyEqual(
            button.box.width,
            button.box.height,
            0.25,
            `${width}x${height} tablet operator ${index + 1} remains square`,
          );
          approximatelyEqual(
            button.box.width,
            first.box.width,
            0.25,
            `${width}x${height} tablet operator ${index + 1} has an equal width`,
          );
          approximatelyEqual(
            button.box.height,
            first.box.height,
            0.25,
            `${width}x${height} tablet operator ${index + 1} has an equal height`,
          );
          approximatelyEqual(
            button.box.y,
            first.box.y,
            1,
            `${width}x${height} tablet operator ${index + 1} remains in one row`,
          );
          assert.ok(
            button.image,
            `${width}x${height} tablet operator ${index + 1} renders artwork`,
          );
          assert.equal(
            button.image.loaded,
            true,
            `${width}x${height} tablet operator ${index + 1} artwork is loaded`,
          );
          assert.equal(
            button.image.objectFit,
            "contain",
            `${width}x${height} tablet operator ${index + 1} artwork preserves its proportions`,
          );
          assert.ok(
            button.image.x >= button.box.x &&
              button.image.y >= button.box.y &&
              button.image.x + button.image.width <=
                button.box.x + button.box.width &&
              button.image.y + button.image.height <=
                button.box.y + button.box.height,
            `${width}x${height} tablet operator ${index + 1} artwork remains inside its tile`,
          );
        }
        assert.ok(
          beforeSelection.helper.y + beforeSelection.helper.height <=
            beforeSelection.content.y + beforeSelection.content.height,
          `${width}x${height} helper remains inside the tablet calculation card`,
        );
        approximatelyEqual(
          beforeSelection.contentInnerBottom -
            (beforeSelection.helper.y + beforeSelection.helper.height),
          5,
          1,
          `${width}x${height} helper remains approximately five pixels above the card bottom`,
        );
        assert.equal(
          intersects(beforeSelection.helper, beforeSelection.board, 0),
          false,
          `${width}x${height} helper does not overlap tablet operators`,
        );
        assert.ok(
          ["auto", "scroll"].includes(
            beforeSelection.dialogMetrics.overflowY,
          ) && beforeSelection.dialogMetrics.scrollWidth <= width,
          `${width}x${height} expanded tablet operators retain bounded vertical scrolling without horizontal overflow`,
        );
        if (beforeSelection.dialogMetrics.scrollHeight > beforeSelection.dialogMetrics.clientHeight) {
          await hint.dialog.evaluate((element) => { element.scrollTop = element.scrollHeight; });
          const [actionsReach, newQuestionReach, giveUpReach, dialogReach] = await Promise.all([
            actions.boundingBox(), hint.newQuestion.boundingBox(), hint.giveUp.boundingBox(), hint.dialog.boundingBox(),
          ]);
          assert.ok([actionsReach, newQuestionReach, giveUpReach].every((box) =>
            box && box.y >= dialogReach.y && box.y + box.height <= dialogReach.y + dialogReach.height),
            `${width}x${height} tablet internal scrolling reaches every action`);
          await hint.dialog.evaluate((element) => { element.scrollTop = 0; });
        }
        tabletSamples.push({ width, size: first.box.width });

        await board
          .getByRole("button", { name: "Multiplication", exact: true })
          .click();
        const afterSelection = await snapshot();
        for (const region of ["content", "vignette", "actions"])
          for (const property of ["x", "y", "width", "height"])
            approximatelyEqual(
              afterSelection[region][property],
              beforeSelection[region][property],
              1,
              `${width}x${height} selecting an operator does not move ${region} ${property}`,
            );
        const selected = afterSelection.buttons.filter(
          (button) => button.pressed,
        );
        assert.equal(
          selected.length,
          1,
          `${width}x${height} selection remains bounded to one tile`,
        );
        assert.ok(
          selected[0].box.x >= afterSelection.board.x &&
            selected[0].box.y >= afterSelection.board.y &&
            selected[0].box.x + selected[0].box.width <=
              afterSelection.board.x + afterSelection.board.width &&
            selected[0].box.y + selected[0].box.height <=
              afterSelection.board.y + afterSelection.board.height,
          `${width}x${height} selected surface remains inside its operator board`,
        );
      },
    );
  for (let index = 1; index < tabletSamples.length; index += 1)
    assert.ok(
      tabletSamples[index].size >= tabletSamples[index - 1].size - 0.25,
      `${tabletSamples[index - 1].width}/${tabletSamples[index].width}px tablet operator tiles do not shrink as width grows`,
    );

  for (const [width, height, frozenWidth, frozenHeight] of [
    [600, 900, 56, 56],
    [821, 1040, 80, 92],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const board = hint.dialog.getByLabel("Choose a math operation", {
          exact: true,
        });
        const [boardBox, buttons, contentBox, vignetteBox, actionsBox] =
          await Promise.all([
            board.boundingBox(),
            board.getByRole("button").evaluateAll((elements) =>
              elements.map((button) => {
                const box = button.getBoundingClientRect();
                const style = getComputedStyle(button);
                return {
                  computedHeight: Number.parseFloat(style.height),
                  computedWidth: Number.parseFloat(style.width),
                  height: box.height,
                  width: box.width,
                  y: box.y,
                };
              }),
            ),
            hint.dialog.locator("section").boundingBox(),
            hint.dialog.locator('aside[aria-hidden="true"]').boundingBox(),
            hint.newQuestion.locator("xpath=..").boundingBox(),
          ]);
        assert.ok(
          boardBox && contentBox && vignetteBox && actionsBox,
          `${width}x${height} boundary operator smoke keeps its established layout regions`,
        );
        assert.equal(
          buttons.length,
          5,
          `${width}x${height} boundary keeps five operator tiles`,
        );
        for (const [index, button] of buttons.entries()) {
          approximatelyEqual(
            button.computedWidth,
            frozenWidth,
            0.01,
            `${width}x${height} boundary operator ${index + 1} retains its frozen logical width`,
          );
          approximatelyEqual(
            button.computedHeight,
            frozenHeight,
            0.01,
            `${width}x${height} boundary operator ${index + 1} retains its frozen logical height`,
          );
          approximatelyEqual(
            button.y,
            buttons[0].y,
            1,
            `${width}x${height} boundary operators remain in one row`,
          );
        }
      },
    );
});

test("SC06: responsive narrow challenge title and range-specific subtitle remain centered and clear of the close paw", async () => {
  for (const [width, height] of [
    [320, 920],
    [390, 844],
    [600, 900],
    [601, 900],
    [700, 920],
    [768, 1024],
    [820, 920],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const title = await exact(
          hint.dialog.getByRole("heading", {
            name: "Solve a quick math question",
            exact: true,
          }),
          `${width}x${height} centered narrow challenge title`,
        );
        const close = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} tablet close paw beside centered title`,
        );
        const subtitle = hint.dialog.locator("header p");
        const [titleBox, closeBox, subtitleBox, titleMetrics] =
          await Promise.all([
            title.boundingBox(),
            close.boundingBox(),
            subtitle.boundingBox(),
            title.evaluate((element) => {
              const style = getComputedStyle(element);
              const box = element.getBoundingClientRect();
              return {
                display: style.display,
                textAlign: style.textAlign,
                visibility: style.visibility,
                width: box.width,
              };
            }),
          ]);
        assert.ok(
          titleBox &&
            closeBox &&
            titleMetrics.display !== "none" &&
            titleMetrics.visibility !== "hidden",
          `${width}x${height} narrow title and close paw remain visibly rendered`,
        );
        assert.ok(
          titleMetrics.width > 0,
          `${width}x${height} narrow title remains unclipped`,
        );
        approximatelyEqual(
          titleBox.x + titleBox.width / 2,
          width / 2,
          1,
          `${width}x${height} narrow title center matches the full page center`,
        );
        assert.equal(
          intersects(titleBox, closeBox, 0),
          false,
          `${width}x${height} centered narrow title remains clear of the close paw`,
        );
        assert.equal(
          titleMetrics.textAlign,
          "center",
          `${width}x${height} narrow title text stays centered`,
        );
        const expectedSubtitleDisplay = width <= 600 ? "none" : "block";
        assert.equal(
          await subtitle.evaluate(
            (element) => getComputedStyle(element).display,
          ),
          expectedSubtitleDisplay,
          `${width}x${height} subtitle follows the approved mobile/tablet visibility boundary`,
        );
        if (width <= 600)
          assert.equal(
            subtitleBox,
            null,
            `${width}x${height} mobile subtitle has no rendered bounds`,
          );
        else
          assert.ok(
            subtitleBox && subtitleBox.width > 0 && subtitleBox.height > 0,
            `${width}x${height} tablet subtitle has rendered bounds`,
          );
      },
    );
});

test("SC06: <=360px phones keep the exact challenge title on one centered line and lift only the fixed close paw", async () => {
  let baselineCloseInsets;
  for (const [width, height, narrow] of [
    [361, 844, false],
    [320, 844, true],
    [322, 844, true],
    [350, 844, true],
    [360, 844, true],
    [320, 568, true],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const title = await exact(
          hint.dialog.getByRole("heading", {
            name: "Solve a quick math question",
            exact: true,
          }),
          `${width}x${height} narrow-phone challenge title`,
        );
        const close = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} narrow-phone close paw`,
        );
        const content = hint.dialog.locator("section");
        const vignette = hint.dialog.locator('aside[aria-hidden="true"]');
        const actions = hint.newQuestion.locator("xpath=..");
        const [
          titleBox,
          closeBox,
          contentBox,
          vignetteBox,
          actionsBox,
          titleMetrics,
          closeMetrics,
        ] = await Promise.all([
          title.boundingBox(),
          close.boundingBox(),
          content.boundingBox(),
          vignette.boundingBox(),
          actions.boundingBox(),
          title.evaluate((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return {
              clientWidth: element.clientWidth,
              lineHeight: Number.parseFloat(style.lineHeight),
              scrollWidth: element.scrollWidth,
              text: element.textContent?.trim(),
              visibility: style.visibility,
              width: box.width,
            };
          }),
          close.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              height: Number.parseFloat(style.height),
              width: Number.parseFloat(style.width),
            };
          }),
        ]);
        assert.ok(
          titleBox && closeBox && contentBox && vignetteBox && actionsBox,
          `${width}x${height} narrow-phone title, close, and established regions render`,
        );
        assert.equal(
          titleMetrics.text,
          "Solve a quick math question",
          `${width}x${height} keeps the exact approved title copy`,
        );
        assert.equal(
          titleMetrics.visibility,
          "visible",
          `${width}x${height} title remains visible`,
        );
        assert.ok(
          titleBox.x >= 0 &&
            titleBox.x + titleBox.width <= width &&
            titleBox.y >= 0,
          `${width}x${height} title is fully contained in the viewport`,
        );
        approximatelyEqual(
          titleBox.x + titleBox.width / 2,
          width / 2,
          1,
          `${width}x${height} title center matches the full viewport center`,
        );
        assert.ok(
          titleMetrics.scrollWidth <= titleMetrics.clientWidth + 1,
          `${width}x${height} title has no horizontal clipping`,
        );
        if (narrow)
          assert.ok(
            titleBox.height <= titleMetrics.lineHeight + 1,
            `${width}x${height} title occupies exactly one rendered line`,
          );

        approximatelyEqual(
          closeMetrics.width,
          56,
          0.01,
          `${width}x${height} close paw retains its 56px logical width`,
        );
        approximatelyEqual(
          closeMetrics.height,
          56,
          0.01,
          `${width}x${height} close paw retains its 56px logical height`,
        );
        assert.ok(
          closeBox.x >= 0 &&
            closeBox.y >= 0 &&
            closeBox.x + closeBox.width <= width &&
            closeBox.y + closeBox.height <= height,
          `${width}x${height} fixed close paw stays fully contained`,
        );
        assert.equal(
          intersects(closeBox, titleBox, 0),
          false,
          `${width}x${height} fixed close paw remains clear of the title`,
        );

        const closeInsets = {
          right: width - (closeBox.x + closeBox.width),
          top: closeBox.y,
        };
        if (!narrow) {
          assert.ok(
            closeInsets.right >= 8 && closeInsets.top >= 8,
            "361px keeps the close paw inside the shell-relative safe gutter",
          );
          baselineCloseInsets = closeInsets;
        } else {
          assert.ok(
            baselineCloseInsets,
            "361px close-paw baseline is captured before narrow checks",
          );
          approximatelyEqual(closeInsets.right, 8, 1,
            `${width}x${height} keeps the exact 8px viewport right gutter`);
          assert.ok(
            titleBox.y >= closeBox.y,
            `${width}x${height} keeps the title in the protected header lane below the shell-relative Close control`,
          );
        }

        for (const [name, box] of Object.entries({
          content: contentBox,
          vignette: vignetteBox,
          actions: actionsBox,
        }))
          assert.ok(
            box.x >= 0 &&
              box.y >= 0 &&
              box.x + box.width <= width &&
              box.y + box.height <= height,
            `${width}x${height} established ${name} region remains contained`,
          );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${width}x${height} narrow title and close rule adds no horizontal overflow`,
        );
        const scrollYBefore = await page.evaluate(() => scrollY);
        await page.keyboard.press("End");
        await page.mouse.wheel(0, 600);
        assert.equal(
          await page.evaluate(() => scrollY),
          scrollYBefore,
          `${width}x${height} narrow title and close rule leaves page scrolling locked`,
        );

        await close.focus();
        assert.equal(
          await page.evaluate(() =>
            document.activeElement?.getAttribute("aria-label"),
          ),
          "Close hint challenge",
          `${width}x${height} close paw retains its accessible name and keyboard focus`,
        );
        await page.keyboard.press("Enter");
        await hint.dialog.waitFor({ state: "hidden" });
        assert.equal(
          await page.evaluate(() =>
            document.activeElement?.textContent?.trim(),
          ),
          "Show hint",
          `${width}x${height} keyboard close restores focus to Show hint`,
        );

        await controls.hint.click();
        const reopenedHint = await sc06Dialog(page);
        const reopenedClose = await exact(
          reopenedHint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} reopened narrow-phone close paw`,
        );
        await reopenedClose.click();
        await reopenedHint.dialog.waitFor({ state: "hidden" });
        assert.equal(
          await page.evaluate(() =>
            document.activeElement?.textContent?.trim(),
          ),
          "Show hint",
          `${width}x${height} pointer close restores focus to Show hint`,
        );
      },
    );
});

test("SC06: responsive narrow title-centering rule does not change the accepted desktop heading scope", async () => {
  for (const [
    width,
    height,
    expectedPaddingLeft,
    expectedPaddingRight,
    expectedTitleMarginTop,
  ] of [[821, 1040, "0px", "0px", "30px"]])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const title = await exact(
          hint.dialog.getByRole("heading", {
            name: "Solve a quick math question",
            exact: true,
          }),
          `${width}x${height} non-tablet title smoke target`,
        );
        const close = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} non-tablet close smoke target`,
        );
        const [titleBox, closeBox, headingMetrics, titleMetrics] =
          await Promise.all([
            visibleTextBounds(title),
            close.boundingBox(),
            title.locator("xpath=..").evaluate((element) => {
              const style = getComputedStyle(element);
              return {
                paddingLeft: style.paddingLeft,
                paddingRight: style.paddingRight,
              };
            }),
            title.evaluate((element) => {
              const style = getComputedStyle(element);
              return {
                marginTop: style.marginTop,
                textAlign: style.textAlign,
              };
            }),
          ]);
        assert.ok(
          titleBox && closeBox,
          `${width}x${height} non-tablet heading remains rendered`,
        );
        assert.equal(
          headingMetrics.paddingLeft,
          expectedPaddingLeft,
          `${width}x${height} retains its pre-tablet heading left inset`,
        );
        assert.equal(
          headingMetrics.paddingRight,
          expectedPaddingRight,
          `${width}x${height} retains its pre-tablet heading right inset`,
        );
        assert.equal(
          titleMetrics.marginTop,
          expectedTitleMarginTop,
          `${width}x${height} retains its pre-tablet title top margin`,
        );
        assert.equal(
          titleMetrics.textAlign,
          "center",
          `${width}x${height} title stays readable`,
        );
        assert.equal(
          intersects(titleBox, closeBox, 0),
          false,
          `${width}x${height} title remains clear of the close paw`,
        );
      },
    );
});

test("SC06: 600px mobile and 821px desktop retain their non-tablet geometry", async () => {
  for (const [width, height, closeSize, composition] of [
    [600, 900, 56, "stacked"],
    [821, 1040, 76, "columns"],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const close = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} boundary close control`,
        );
        const [dialogBox, closeBox, contentBox, vignetteBox, dialogScale] =
          await Promise.all([
            hint.dialog.boundingBox(),
            close.boundingBox(),
            hint.dialog.locator("section").boundingBox(),
            hint.dialog.locator("aside").boundingBox(),
            hint.dialog.evaluate(
              (element) =>
                Number.parseFloat(getComputedStyle(element).scale) || 1,
            ),
          ]);
        approximatelyEqual(
          closeBox.width,
          closeSize * dialogScale,
          1,
          `${width}x${height} boundary retains its approved close target size`,
        );
        approximatelyEqual(
          closeBox.height,
          closeSize * dialogScale,
          1,
          `${width}x${height} boundary retains its approved close target size`,
        );
        assert.ok(
          dialogBox && closeBox && contentBox && vignetteBox,
          `${width}x${height} boundary keeps all public geometry rendered`,
        );
        if (composition === "stacked") {
          approximatelyEqual(
            dialogBox.width,
            width,
            1,
            "600px mobile dialog remains fullscreen",
          );
          assert.ok(
            Math.abs(
              contentBox.x +
                contentBox.width / 2 -
                (vignetteBox.x + vignetteBox.width / 2),
            ) <=
              dialogBox.width * 0.2,
            "600px mobile retains its stacked composition",
          );
        } else
          assert.ok(
            contentBox.x + contentBox.width <= vignetteBox.x,
            "821px desktop retains its side-by-side composition",
          );
      },
    );
});

test("SC06: canonical dialog cascade keeps the 600/601px and 820/821px seams intentional", async () => {
  for (const [width, height, subtitleVisible, composition, closeSize] of [
    [600, 900, false, "stacked", 56],
    [601, 900, true, "stacked", 60],
    [820, 920, true, "stacked", 60],
    [821, 1040, false, "columns", 76],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const backdrop = hint.dialog.locator("xpath=../..");
        const close = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}px responsive-cascade close control`,
        );
        const subtitle = hint.dialog.locator("header p");
        const [
          backdropMetrics,
          dialogMetrics,
          contentBox,
          vignetteBox,
          closeWidth,
        ] = await Promise.all([
          backdrop.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return {
              height: box.height,
              position: getComputedStyle(element).position,
              role: element.getAttribute("role"),
              width: box.width,
              x: box.x,
              y: box.y,
            };
          }),
          hint.dialog.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              display: style.display,
              gridTemplateColumns: style.gridTemplateColumns,
            };
          }),
          hint.dialog.locator("section").boundingBox(),
          hint.dialog.locator("aside").boundingBox(),
          close.evaluate((element) =>
            Number.parseFloat(getComputedStyle(element).width),
          ),
        ]);
        assert.deepEqual(
          {
            position: backdropMetrics.position,
            role: backdropMetrics.role,
          },
          { position: "fixed", role: "presentation" },
          `${width}px presentation backdrop remains the fixed modal boundary`,
        );
        for (const [property, expected] of [
          ["x", 0],
          ["y", 0],
          ["width", width],
          ["height", height],
        ])
          approximatelyEqual(
            backdropMetrics[property],
            expected,
            1,
            `${width}px presentation backdrop covers the viewport at the responsive seam`,
          );
        assert.equal(
          dialogMetrics.display,
          "grid",
          `${width}px semantic dialog keeps its canonical grid boundary`,
        );
        assert.ok(
          contentBox && vignetteBox,
          `${width}px responsive seam renders both public dialog story regions`,
        );
        assert.equal(
          await subtitle.isVisible(),
          subtitleVisible,
          `${width}px subtitle visibility changes only at the approved mobile/tablet seams`,
        );
        approximatelyEqual(
          closeWidth,
          closeSize,
          0.01,
          `${width}px close control retains its cascade-specific logical target`,
        );
        if (composition === "stacked") {
          assert.equal(
            dialogMetrics.gridTemplateColumns.split(" ").length,
            1,
            `${width}px mobile/tablet cascade keeps one dialog column`,
          );
          assert.ok(
            contentBox.y + contentBox.height <= vignetteBox.y,
            `${width}px mobile/tablet content remains above its vignette`,
          );
          approximatelyEqual(
            contentBox.x + contentBox.width / 2,
            vignetteBox.x + vignetteBox.width / 2,
            2,
            `${width}px stacked story regions retain one horizontal center`,
          );
        } else {
          assert.equal(
            dialogMetrics.gridTemplateColumns.split(" ").length,
            2,
            "821px desktop cascade restores the two-column dialog grid",
          );
          assert.ok(
            contentBox.x + contentBox.width <= vignetteBox.x,
            "821px desktop content remains left of its vignette",
          );
          const desktopNotice = await exact(
            hint.dialog.getByText(
              "A correct answer will unlock a hint in the game!",
              { exact: true },
            ),
            "821px visible desktop cat notice",
          );
          const desktopNoticeBox = await desktopNotice.boundingBox();
          assert.equal(
            await desktopNotice.isVisible(),
            true,
            "821px desktop vignette renders its approved visible cat notice",
          );
          assert.ok(
            desktopNoticeBox &&
              desktopNoticeBox.x >= vignetteBox.x &&
              desktopNoticeBox.y >= vignetteBox.y &&
              desktopNoticeBox.x + desktopNoticeBox.width <=
                vignetteBox.x + vignetteBox.width &&
              desktopNoticeBox.y + desktopNoticeBox.height <=
                vignetteBox.y + vignetteBox.height,
            "821px desktop cat notice remains contained by the vignette",
          );
        }
      },
    );
});

test("SC06: narrow background remains the sole <=820px challenge surface while desktop assets stay isolated", async () => {
  for (const [width, height, expectedSurface] of [
    [820, 1064, "narrow"],
    [820, 920, "narrow"],
    [601, 900, "narrow"],
    [600, 900, "narrow"],
    [390, 844, "narrow"],
    [320, 568, "narrow"],
    [821, 1040, "desktop"],
    [1024, 768, "desktop"],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const [challengeSurface, renderedLayers] = await Promise.all([
          hint.dialog.locator("xpath=..").evaluate((shell) => {
            const dialog = shell.querySelector('[role="dialog"]');
            return [
              ["shell", shell, null],
              ["shell::before", shell, "::before"],
              ["shell::after", shell, "::after"],
              ["dialog", dialog, null],
              ["dialog::before", dialog, "::before"],
              ["dialog::after", dialog, "::after"],
            ].map(([name, element, pseudo]) => {
              const style = getComputedStyle(element, pseudo || undefined);
              const box = element.getBoundingClientRect();
              return {
                name,
                image: style.backgroundImage,
                size: style.backgroundSize,
                position: style.backgroundPosition,
                repeat: style.backgroundRepeat,
                box: {
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height,
                },
              };
            });
          }),
          page
            .locator("body")
            .evaluate((root) =>
              [root, ...root.querySelectorAll("*")].flatMap((element) => [
                getComputedStyle(element).backgroundImage,
                getComputedStyle(element, "::before").backgroundImage,
                getComputedStyle(element, "::after").backgroundImage,
                element instanceof HTMLImageElement
                  ? element.currentSrc || element.src
                  : "",
              ]),
            ),
        ]);
        const artwork = challengeSurface.map((layer) => layer.image).join(" ");
        const challengeBackgroundUrls = [
          ...artwork.matchAll(/url\(["']?([^"')]+)["']?\)/g),
        ].map((match) => match[1]);
        const mobileFrameRendered =
          artwork.includes("hint-popup-mobile-frame-941x1672.png") ||
          renderedLayers.some((layer) =>
            layer.includes("hint-popup-mobile-frame-941x1672.png"),
          );
        const tabletBackgroundRendered =
          artwork.includes("hint-popup-tablet-background-1448.png") ||
          renderedLayers.some((layer) =>
            layer.includes("hint-popup-tablet-background-1448.png"),
          );
        const narrowBackground = "hint-popup-narrow-background-1254.png";
        const narrowBackgroundRendered =
          artwork.includes(narrowBackground) ||
          renderedLayers.some((layer) => layer.includes(narrowBackground));
        assert.equal(
          mobileFrameRendered,
          false,
          `${width}x${height} renders no mobile-frame URL or CSS/image layer`,
        );
        assert.equal(
          narrowBackgroundRendered,
          expectedSurface === "narrow",
          `${width}x${height} narrow background selection stays isolated at the 820/821px boundary`,
        );
        assert.equal(
          tabletBackgroundRendered,
          false,
          `${width}x${height} does not retain the superseded tablet background`,
        );
        if (expectedSurface === "narrow") {
          assert.deepEqual(
            challengeBackgroundUrls,
            [new URL(`/safe-cat/${narrowBackground}`, baseUrl).href],
            `${width}x${height} renders the shared narrow artwork as its sole decorative challenge-surface background`,
          );
          const [narrowLayer] = challengeSurface.filter((layer) =>
            layer.image.includes(narrowBackground),
          );
          assert.ok(
            narrowLayer,
            `${width}x${height} exposes one computed narrow-background owner`,
          );
          assert.equal(
            narrowLayer.size,
            "cover",
            `${width}x${height} narrow background uses computed cover sizing`,
          );
          assert.match(
            narrowLayer.position,
            /^(center( center)?|50% 50%)$/,
            `${width}x${height} narrow background stays centered`,
          );
          assert.equal(
            narrowLayer.repeat,
            "no-repeat",
            `${width}x${height} narrow background does not tile`,
          );
          assert.notEqual(
            narrowLayer.size,
            "100% 100%",
            `${width}x${height} narrow background rejects anisotropic 100% 100% stretching`,
          );
          const surface = await hint.dialog.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const channels =
              getComputedStyle(element)
                .backgroundColor.match(/\d+(?:\.\d+)?/g)
                ?.map(Number) || [];
            return {
              rect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
              alpha: channels[3] ?? 1,
              red: channels[0] ?? 0,
              green: channels[1] ?? 0,
              blue: channels[2] ?? 0,
            };
          });
          const [backdropBox, gameSubtitleBox] = await Promise.all([
            hint.dialog.locator("xpath=../..").boundingBox(), controls.instruction.boundingBox(),
          ]);
          approximatelyEqual(
            surface.rect.width,
            width,
            1,
            `${width}x${height} narrow surface spans the viewport width`,
          );
          assert.ok(backdropBox && backdropBox.x <= 1 && backdropBox.y <= 1 &&
            backdropBox.x + backdropBox.width >= width - 1 && backdropBox.y + backdropBox.height >= height - 1,
            `${width}x${height} narrow backdrop intercepts the viewport`);
          assert.ok(gameSubtitleBox && surface.rect.y >= gameSubtitleBox.y + gameSubtitleBox.height + 8 &&
            Math.abs(surface.rect.height - (height - surface.rect.y)) <= 1,
            `${width}x${height} narrow surface fills its protected remaining lane`);
          assert.equal(
            surface.alpha,
            1,
            `${width}x${height} narrow surface remains opaque`,
          );
          assert.ok(
            surface.red + surface.green + surface.blue > 120 &&
              !(surface.red < 16 && surface.green < 16 && surface.blue < 16),
            `${width}x${height} narrow surface remains warm and non-black`,
          );
          assert.ok(
            narrowLayer.box.x <= surface.rect.x + 1 &&
              narrowLayer.box.y <= surface.rect.y + 1 &&
              narrowLayer.box.x + narrowLayer.box.width >=
                surface.rect.x + surface.rect.width - 1 &&
              narrowLayer.box.y + narrowLayer.box.height >=
                surface.rect.y + surface.rect.height - 1,
            `${width}x${height} narrow background owner covers the full opaque surface without edge gaps`,
          );
        }
        if (width > 820)
          assert.ok(
            (await hint.dialog.locator("section").boundingBox()).x <
              (await hint.dialog.locator("aside").boundingBox()).x,
            `${width}x${height} desktop keeps its two-column challenge/vignette geometry`,
          );
      },
    );
});

test("SC06: mobile portrait surface forms one readable no-scroll story and retains short-height essentials", async () => {
  for (const [width, height, ordinary] of [
    [600, 900, true],
    [390, 844, true],
    [320, 568, false],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        const preOpenPage = await page.evaluate(() => ({
          scrollHeight: document.documentElement.scrollHeight,
          scrollY,
        }));
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const header = hint.dialog.locator("header");
        const title = await exact(
          header.getByRole("heading", {
            name: "Solve a quick math question",
            exact: true,
          }),
          `${width}x${height} mobile title`,
        );
        const subtitle = await exact(
          header.locator("p"),
          `${width}x${height} mobile subtitle node`,
        );
        const close = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} mobile header close control`,
        );
        const content = hint.dialog.locator("section");
        const vignette = hint.dialog.locator("aside");
        const equation = await exact(
          hint.dialog.locator("label[for='hint-answer']"),
          `${width}x${height} mobile equation`,
        );
        const operatorRow = hint.dialog.getByLabel("Choose a math operation", {
          exact: true,
        });
        const helper = hint.dialog.getByText(
          "Choose which operations can appear in the examples.",
          {
            exact: true,
          },
        );
        const actions = hint.newQuestion.locator("xpath=..");
        const [
          dialogBox,
          dialogStyle,
          headerBox,
          titleBox,
          subtitleBox,
          closeBox,
          contentBox,
          equationBox,
          answerBox,
          checkBox,
          operatorBox,
          vignetteBox,
          helperBox,
          actionsBox,
          newQuestionBox,
          giveUpBox,
          operatorMetrics,
        ] = await Promise.all([
          hint.dialog.boundingBox(),
          hint.dialog.evaluate((element) => {
            const style = getComputedStyle(element);
            const channels =
              style.backgroundColor.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
            return {
              overflowY: style.overflowY,
              scrollHeight: element.scrollHeight,
              clientHeight: element.clientHeight,
              background: style.backgroundColor,
              alpha: channels[3] ?? 1,
              red: channels[0] ?? 0,
              green: channels[1] ?? 0,
              blue: channels[2] ?? 0,
            };
          }),
          header.boundingBox(),
          title.boundingBox(),
          subtitle.boundingBox(),
          close.boundingBox(),
          content.boundingBox(),
          equation.boundingBox(),
          hint.answer.boundingBox(),
          hint.check.boundingBox(),
          operatorRow.boundingBox(),
          vignette.boundingBox(),
          helper.boundingBox(),
          actions.boundingBox(),
          hint.newQuestion.boundingBox(),
          hint.giveUp.boundingBox(),
          operatorRow.getByRole("button").evaluateAll((buttons) =>
            buttons.map((button) => {
              const style = getComputedStyle(button);
              const box = button.getBoundingClientRect();
              return {
                width: Number.parseFloat(style.width),
                height: Number.parseFloat(style.height),
                pressed: button.getAttribute("aria-pressed") === "true",
                box: {
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height,
                },
              };
            }),
          ),
        ]);
        assert.ok(
          dialogBox &&
            headerBox &&
            titleBox &&
            closeBox &&
            contentBox &&
            equationBox &&
            answerBox &&
            checkBox &&
            operatorBox &&
            actionsBox &&
            newQuestionBox &&
            giveUpBox,
          `${width}x${height} keeps all essential mobile regions rendered`,
        );
        assert.equal(
          await subtitle.evaluate(
            (element) => getComputedStyle(element).display,
          ),
          "none",
          `${width}x${height} mobile subtitle is visually and accessibility hidden`,
        );
        assert.equal(
          subtitleBox,
          null,
          `${width}x${height} hidden mobile subtitle has no rendered bounds`,
        );
        assert.equal(
          dialogStyle.alpha,
          1,
          `${width}x${height} mobile center surface is opaque`,
        );
        assert.ok(
          dialogStyle.red + dialogStyle.green + dialogStyle.blue > 120 &&
            !(
              dialogStyle.red < 16 &&
              dialogStyle.green < 16 &&
              dialogStyle.blue < 16
            ),
          `${width}x${height} mobile center surface is warm/light rather than black or transparent`,
        );
        assert.ok(
          ["auto", "scroll"].includes(dialogStyle.overflowY),
          `${width}x${height} mobile dialog retains its bounded internal scroll owner`,
        );
        const pageScrollDuringDialog = await page.evaluate(() => {
          const initialY = scrollY;
          window.scrollTo(0, initialY + 100);
          const attemptedY = scrollY;
          window.scrollTo(0, initialY);
          return {
            scrollHeight: document.documentElement.scrollHeight,
            initialY,
            attemptedY,
            scrollWidth: document.documentElement.scrollWidth,
          };
        });
        assert.ok(
          pageScrollDuringDialog.scrollHeight <= preOpenPage.scrollHeight,
          `${width}x${height} mobile dialog does not add to the underlying page extent`,
        );
        assert.equal(
          pageScrollDuringDialog.attemptedY,
          pageScrollDuringDialog.initialY,
          `${width}x${height} mobile modal body lock prevents active page scrolling`,
        );
        assert.ok(
          pageScrollDuringDialog.scrollWidth <= width,
          `${width}x${height} mobile dialog creates no horizontal page overflow`,
        );
        assert.equal(
          operatorMetrics.length,
          5,
          `${width}x${height} mobile retains five operator actions including Random`,
        );
        assert.equal(
          operatorMetrics.every(
            (metric) =>
              metric.width >= 44 &&
              metric.width <= 72 &&
              metric.height >= 44 &&
              metric.height <= 72,
          ),
          true,
          `${width}x${height} mobile operators remain compact squares`,
        );
        const orderedOperators = [...operatorMetrics].sort(
          (left, right) => left.box.x - right.box.x,
        );
        assert.equal(
          orderedOperators.every(
            (metric, index) =>
              index === 0 ||
              Math.abs(metric.box.y - orderedOperators[0].box.y) <= 1,
          ),
          true,
          `${width}x${height} mobile operators remain in one compact row`,
        );
        assert.ok(
          operatorMetrics.some((metric) => metric.pressed),
          `${width}x${height} mobile exposes the selected operator state`,
        );
        for (const [name, box] of Object.entries({
          headerBox,
          titleBox,
          closeBox,
          contentBox,
          equationBox,
          answerBox,
          checkBox,
          operatorBox,
          actionsBox,
          newQuestionBox,
          giveUpBox,
        }))
          assert.ok(
            box.x >= -1 && box.x + box.width <= width + 1,
            `${width}x${height} ${name} remains horizontally contained in the dialog lane`,
          );
        const internalReach = await hint.dialog.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
          return { max: element.scrollHeight - element.clientHeight };
        });
        const [checkReach, newQuestionReach, giveUpReach, laneReach] =
          await Promise.all([
            hint.check.boundingBox(),
            hint.newQuestion.boundingBox(),
            hint.giveUp.boundingBox(),
            hint.dialog.boundingBox(),
          ]);
        assert.ok(
          internalReach.max >= 0 &&
            [checkReach, newQuestionReach, giveUpReach].every(
              (box) => box && box.y >= laneReach.y && box.y + box.height <= laneReach.y + laneReach.height,
            ),
          `${width}x${height} internal dialog scrolling reaches Check, New question, and Give up without page scrolling`,
        );
        for (const [first, second] of [
          ["headerBox", "contentBox"],
          ["answerBox", "checkBox"],
          ["contentBox", "actionsBox"],
          ["newQuestionBox", "giveUpBox"],
        ])
          assert.equal(
            intersects(
              {
                headerBox,
                contentBox,
                answerBox,
                checkBox,
                actionsBox,
                newQuestionBox,
                giveUpBox,
              }[first],
              {
                headerBox,
                contentBox,
                answerBox,
                checkBox,
                actionsBox,
                newQuestionBox,
                giveUpBox,
              }[second],
              0,
            ),
            false,
            `${width}x${height} ${first} does not overlap ${second}`,
          );
        if (ordinary) {
          assert.ok(
            vignetteBox &&
              helperBox &&
              (await vignette.isVisible()) &&
              (await helper.isVisible()),
            `${width}x${height} ordinary portrait keeps the cohesive vignette and helper`,
          );
          assert.ok(
            actionsBox.y >= vignetteBox.y + vignetteBox.height &&
              actionsBox.y - (vignetteBox.y + vignetteBox.height) <= 48,
            `${width}x${height} stacked actions follow the vignette without a detached gap`,
          );
          assert.ok(
            newQuestionBox.y + newQuestionBox.height <= giveUpBox.y,
            `${width}x${height} actions stack with New question first`,
          );
          approximatelyEqual(
            newQuestionBox.x,
            giveUpBox.x,
            2,
            `${width}x${height} stacked actions share a left edge`,
          );
          approximatelyEqual(
            newQuestionBox.width,
            giveUpBox.width,
            2,
            `${width}x${height} stacked actions share a full-width treatment`,
          );
          assert.ok(
            newQuestionBox.width >= contentBox.width * 0.85,
            `${width}x${height} stacked actions use the mobile content width`,
          );
          const actionColors = await Promise.all(
            [hint.newQuestion, hint.giveUp].map((control) =>
              control.evaluate((element) => {
                const style = getComputedStyle(element);
                return (
                  style.backgroundImage.match(/rgba?\([^)]+\)/)?.[0] ||
                  style.backgroundColor
                );
              }),
            ),
          );
          assert.equal(
            isPurple(actionColors[0]),
            true,
            `${width}x${height} New question remains the purple mobile primary action`,
          );
          const giveUpChannels =
            actionColors[1]
              .match(/\d+(?:\.\d+)?/g)
              ?.slice(0, 3)
              .map(Number) || [];
          assert.equal(
            giveUpChannels.length === 3 &&
              giveUpChannels[2] >= giveUpChannels[1] &&
              giveUpChannels[1] >= giveUpChannels[0],
            true,
            `${width}x${height} Give up remains the light-blue mobile secondary action`,
          );
        } else {
          const cat = await exact(
            vignette.locator('img[src*="hint-popup-cat-"]'),
            `${width}x${height} short-height state cat`,
          );
          const bubble = await exact(
            vignette.locator(":scope > div").first(),
            `${width}x${height} short-height speech bubble`,
          );
          const notice = await exact(
            vignette.getByText(
              "A correct answer will unlock a hint in the game!",
              { exact: true },
            ),
            `${width}x${height} short-height earned-hint notice`,
          );
          const [
            vignetteDisplay,
            catBox,
            catAlpha,
            bubbleBox,
            noticeBox,
            bubbleDisplay,
          ] = await Promise.all([
            vignette.evaluate((element) => getComputedStyle(element).display),
            cat.boundingBox(),
            visibleAlphaBounds(page, cat),
            bubble.boundingBox(),
            notice.boundingBox(),
            bubble.evaluate((element) => getComputedStyle(element).display),
          ]);
          assert.equal(
            vignetteDisplay,
            "grid",
            `${width}x${height} compact vignette remains a grid`,
          );
          assert.equal(
            await vignette.isVisible(),
            true,
            `${width}x${height} compact vignette remains visible`,
          );
          assert.ok(
            vignetteBox && catBox && noticeBox,
            `${width}x${height} compact state scene remains rendered`,
          );
          const contained = (inner, outer) =>
            inner.x >= outer.x - 1 &&
            inner.y >= outer.y - 1 &&
            inner.x + inner.width <= outer.x + outer.width + 1 &&
            inner.y + inner.height <= outer.y + outer.height + 1;
          assert.equal(
            contained(catAlpha, vignetteBox),
            true,
            `${width}x${height} compact cat art remains inside the vignette`,
          );
          assert.equal(
            bubbleDisplay,
            "none",
            `${width}x${height} compact hides its decorative bubble`,
          );
          assert.equal(
            bubbleBox,
            null,
            `${width}x${height} compact bubble has no visible bounds`,
          );
          assert.equal(
            intersects(catAlpha, noticeBox, 0),
            false,
            `${width}x${height} compact notice stays clear of cat art`,
          );
          assert.equal(
            await helper.isVisible(),
            true,
            `${width}x${height} short-height fallback retains the anchored operator helper`,
          );
        }
      },
    );
});

test("SC06: mobile close paw, answer cadence, and five equal operators remain safely anchored", async () => {
  const closeInsetsByWidth = new Map();
  for (const [width, height, expectedLabelGap, expectedFormGap] of [
    [320, 568, 8, 8],
    [390, 677, 8, 8],
    [390, 844, 9, 11],
    [558, 677, 8, 8],
    [586, 844, 9, 11],
    [600, 900, 9, 11],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const header = hint.dialog.locator("header");
        const title = await exact(
          header.getByRole("heading", {
            name: "Solve a quick math question",
            exact: true,
          }),
          `${width}x${height} mobile title`,
        );
        const close = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} mobile close paw`,
        );
        const content = hint.dialog.locator("section");
        const answerLabel = await exact(
          content.getByText("Your answer", { exact: true }),
          `${width}x${height} answer label`,
        );
        const answerForm = hint.answer.locator("xpath=..");
        const operatorLabel = await exact(
          content.getByText("Choose operator", { exact: true }),
          `${width}x${height} operator label`,
        );
        const operatorRow = hint.dialog.getByLabel("Choose a math operation", {
          exact: true,
        });
        const actions = hint.newQuestion.locator("xpath=..");
        const [
          dialogBox,
          titleBox,
          closeBox,
          contentBox,
          answerLabelBox,
          answerFormBox,
          operatorLabelBox,
          operatorRowBox,
          answerBox,
          checkBox,
          actionsBox,
          operatorMetrics,
          scrollLock,
        ] = await Promise.all([
          hint.dialog.boundingBox(),
          title.boundingBox(),
          close.boundingBox(),
          content.boundingBox(),
          answerLabel.boundingBox(),
          answerForm.boundingBox(),
          operatorLabel.boundingBox(),
          operatorRow.boundingBox(),
          hint.answer.boundingBox(),
          hint.check.boundingBox(),
          actions.boundingBox(),
          operatorRow.getByRole("button").evaluateAll((buttons) =>
            buttons.map((button) => {
              const box = button.getBoundingClientRect();
              return {
                box: {
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height,
                },
                pressed: button.getAttribute("aria-pressed") === "true",
              };
            }),
          ),
          page.evaluate(() => ({
            bodyOverflowY: getComputedStyle(document.body).overflowY,
            documentOverflowY: getComputedStyle(document.documentElement)
              .overflowY,
            scrollWidth: document.documentElement.scrollWidth,
            scrollY,
          })),
        ]);
        assert.ok(
          dialogBox &&
            titleBox &&
            closeBox &&
            contentBox &&
            answerLabelBox &&
            answerFormBox &&
            operatorLabelBox &&
            operatorRowBox &&
            answerBox &&
            checkBox &&
            actionsBox,
          `${width}x${height} mobile contract anchors all essential controls`,
        );
        for (const [name, box] of Object.entries({
          title: titleBox,
          content: contentBox,
          answer: answerBox,
          check: checkBox,
          operators: operatorRowBox,
        }))
          assert.ok(
            box.x >= 0 &&
              box.y >= 0 &&
              box.x + box.width <= width &&
              box.y + box.height <= height,
            `${width}x${height} essential ${name} remains contained`,
          );
        assert.ok(
          actionsBox.x >= 0 && actionsBox.x + actionsBox.width <= width,
          `${width}x${height} essential actions remain horizontally contained`,
        );

        const closeInsets = {
          right: width - (closeBox.x + closeBox.width),
        };
        assert.ok(
          closeInsets.right >= 8 && closeBox.y >= (width <= 360 ? 0 : 8),
          `${width}x${height} close paw stays inside the viewport top-right safe inset`,
        );
        assert.ok(
          closeBox.x >= 0 &&
            closeBox.y >= 0 &&
            closeBox.x + closeBox.width <= width &&
            closeBox.y + closeBox.height <= height,
          `${width}x${height} close paw remains fully visible`,
        );
        assert.equal(
          intersects(closeBox, titleBox, 0),
          false,
          `${width}x${height} close paw remains clear of the title`,
        );
        for (const [name, controlBox] of Object.entries({
          answer: answerBox,
          check: checkBox,
          operators: operatorRowBox,
          actions: actionsBox,
        }))
          assert.equal(
            intersects(closeBox, controlBox, 0),
            false,
            `${width}x${height} close paw remains clear of the ${name} control region`,
          );
        const stableInsets = closeInsetsByWidth.get(width);
        if (stableInsets) {
          approximatelyEqual(
            closeInsets.right,
            stableInsets.right,
            1,
            `${width}px close paw right inset is stable across ordinary and reduced heights`,
          );
        } else closeInsetsByWidth.set(width, closeInsets);

        approximatelyEqual(
          answerFormBox.y - (answerLabelBox.y + answerLabelBox.height),
          expectedLabelGap,
          0.25,
          `${width}x${height} answer label gains exactly three pixels before its form`,
        );
        approximatelyEqual(
          operatorLabelBox.y - (answerFormBox.y + answerFormBox.height),
          expectedFormGap,
          0.25,
          `${width}x${height} answer form gains exactly three pixels before Choose operator`,
        );

        assert.equal(
          operatorMetrics.length,
          5,
          `${width}x${height} exposes all five operators`,
        );
        const orderedOperators = [...operatorMetrics].sort(
          (left, right) => left.box.x - right.box.x,
        );
        const referenceOperator = orderedOperators[0];
        for (const [index, operator] of orderedOperators.entries()) {
          assert.ok(
            operator.box.width >= 48 &&
              operator.box.width <= 56 &&
              operator.box.height >= 48 &&
              operator.box.height <= 56,
            `${width}x${height} operator ${index + 1} stays within the 48-56px target`,
          );
          approximatelyEqual(
            operator.box.width,
            referenceOperator.box.width,
            0.25,
            `${width}x${height} operator ${index + 1} has an equal width`,
          );
          approximatelyEqual(
            operator.box.height,
            referenceOperator.box.height,
            0.25,
            `${width}x${height} operator ${index + 1} has an equal height`,
          );
          approximatelyEqual(
            operator.box.y,
            referenceOperator.box.y,
            1,
            `${width}x${height} operator ${index + 1} stays in the single operator row`,
          );
          assert.ok(
            operator.box.x >= operatorRowBox.x &&
              operator.box.x + operator.box.width <=
                operatorRowBox.x + operatorRowBox.width,
            `${width}x${height} operator ${index + 1} remains inside its row`,
          );
          if (index > 0)
            assert.ok(
              orderedOperators[index - 1].box.x +
                orderedOperators[index - 1].box.width <=
                operator.box.x,
              `${width}x${height} operator ${index + 1} does not overlap its predecessor`,
            );
        }
        approximatelyEqual(
          operatorRowBox.x + operatorRowBox.width / 2,
          contentBox.x + contentBox.width / 2,
          1,
          `${width}x${height} five-operator row remains centered in the challenge card`,
        );
        assert.ok(
          operatorRowBox.x >= contentBox.x &&
            operatorRowBox.x + operatorRowBox.width <=
              contentBox.x + contentBox.width,
          `${width}x${height} operator row remains contained in the challenge card`,
        );
        assert.ok(
          operatorMetrics.some((operator) => operator.pressed),
          `${width}x${height} selected operator stays present inside its compact control`,
        );

        assert.equal(
          scrollLock.bodyOverflowY,
          "hidden",
          `${width}x${height} body scroll stays locked`,
        );
        assert.equal(
          scrollLock.documentOverflowY,
          "hidden",
          `${width}x${height} document scroll stays locked`,
        );
        assert.ok(
          scrollLock.scrollWidth <= width,
          `${width}x${height} mobile operator row creates no horizontal overflow`,
        );
        await page.keyboard.press("End");
        await page.mouse.wheel(0, 600);
        assert.equal(
          await page.evaluate(() => scrollY),
          scrollLock.scrollY,
          `${width}x${height} End and wheel cannot activate page scrolling`,
        );
        await hint.dialog.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        const [actionsReach, newQuestionReach, giveUpReach, dialogReach] =
          await Promise.all([
            actions.boundingBox(),
            hint.newQuestion.boundingBox(),
            hint.giveUp.boundingBox(),
            hint.dialog.boundingBox(),
          ]);
        assert.ok(
          [actionsReach, newQuestionReach, giveUpReach].every(
            (box) => box && box.x >= 0 && box.x + box.width <= width &&
              box.y >= dialogReach.y && box.y + box.height <= dialogReach.y + dialogReach.height,
          ),
          `${width}x${height} internal dialog scrolling reaches every action`,
        );

        await close.focus();
        assert.equal(
          await page.evaluate(() =>
            document.activeElement?.getAttribute("aria-label"),
          ),
          "Close hint challenge",
          `${width}x${height} close paw retains keyboard focus`,
        );
        await page.keyboard.press("Enter");
        await hint.dialog.waitFor({ state: "hidden" });
        assert.equal(
          await page.evaluate(() =>
            document.activeElement?.textContent?.trim(),
          ),
          "Show hint",
          `${width}x${height} closing restores focus to Show hint`,
        );
      },
    );

  for (const [width, height, closeSize] of [
    [601, 900, 60],
    [821, 1040, 76],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const close = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} non-mobile close paw`,
        );
        const title = await exact(
          hint.dialog.getByRole("heading", {
            name: "Solve a quick math question",
            exact: true,
          }),
          `${width}x${height} non-mobile title`,
        );
        const [closeBox, titleBox, contentBox, dialogScale] = await Promise.all(
          [
            close.boundingBox(),
            visibleTextBounds(title),
            hint.dialog.locator("section").boundingBox(),
            hint.dialog.evaluate(
              (element) =>
                Number.parseFloat(getComputedStyle(element).scale) || 1,
            ),
          ],
        );
        assert.ok(
          closeBox && titleBox && contentBox,
          `${width}x${height} non-mobile smoke renders`,
        );
        approximatelyEqual(
          closeBox.width,
          closeSize * dialogScale,
          1,
          `${width}x${height} keeps its accepted non-mobile close target size`,
        );
        assert.equal(
          intersects(closeBox, titleBox, 0),
          false,
          `${width}x${height} non-mobile close paw stays clear of its title`,
        );
      },
    );
});

test("SC06: <=600px operator helper stays readable and inset five pixels above the calculation-card bottom", async () => {
  for (const [width, height] of [
    [600, 900],
    [390, 844],
    [320, 568],
    [390, 677],
    [558, 677],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const content = hint.dialog.locator("section");
        const helper = await exact(
          hint.dialog.getByText(
            "Choose which operations can appear in the examples.",
            {
              exact: true,
            },
          ),
          `${width}x${height} anchored mobile helper`,
        );
        const operatorRow = hint.dialog.getByLabel("Choose a math operation", {
          exact: true,
        });
        const feedback = hint.dialog.getByRole("status");
        const [
          contentMetrics,
          helperBox,
          operatorBox,
          feedbackBox,
          helperMetrics,
        ] = await Promise.all([
          content.evaluate((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return {
              position: style.position,
              paddingBottom: Number.parseFloat(style.paddingBottom),
              innerLeft:
                box.x +
                Number.parseFloat(style.borderLeftWidth) +
                Number.parseFloat(style.paddingLeft),
              innerRight:
                box.x +
                box.width -
                Number.parseFloat(style.borderRightWidth) -
                Number.parseFloat(style.paddingRight),
              innerBottom:
                box.y + box.height - Number.parseFloat(style.borderBottomWidth),
            };
          }),
          helper.boundingBox(),
          operatorRow.boundingBox(),
          feedback.boundingBox(),
          helper.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              display: style.display,
              overflowX: style.overflowX,
              overflowY: style.overflowY,
              position: style.position,
              text: element.textContent?.trim(),
              whiteSpace: style.whiteSpace,
              clientHeight: element.clientHeight,
              clientWidth: element.clientWidth,
              scrollHeight: element.scrollHeight,
              scrollWidth: element.scrollWidth,
            };
          }),
        ]);
        assert.equal(
          contentMetrics.position === "relative" ||
            contentMetrics.position === "absolute" ||
            contentMetrics.position === "fixed",
          true,
          `${width}x${height} helper owner establishes a positioned content containing block`,
        );
        assert.equal(
          helperMetrics.position,
          "absolute",
          `${width}x${height} helper is absolutely positioned`,
        );
        assert.notEqual(
          helperMetrics.display,
          "none",
          `${width}x${height} helper remains visible in compact mobile mode`,
        );
        assert.equal(
          helperMetrics.text,
          "Choose which operations can appear in the examples.",
          `${width}x${height} helper retains its approved copy`,
        );
        assert.ok(
          helperMetrics.whiteSpace !== "nowrap" &&
            helperMetrics.scrollWidth <= helperMetrics.clientWidth &&
            helperMetrics.scrollHeight <= helperMetrics.clientHeight,
          `${width}x${height} helper can wrap without clipping its readable copy`,
        );
        assert.ok(
          helperBox && operatorBox,
          `${width}x${height} helper and operator row render`,
        );
        assert.ok(
          helperBox.x >= contentMetrics.innerLeft - 1 &&
            helperBox.x + helperBox.width <= contentMetrics.innerRight + 1 &&
            helperBox.y >= 0 &&
            helperBox.y + helperBox.height <= contentMetrics.innerBottom,
          `${width}x${height} helper remains horizontally inset and fully contained`,
        );
        assert.ok(
          contentMetrics.paddingBottom >= helperBox.height + 5,
          `${width}x${height} content reserves bottom padding for the helper`,
        );
        approximatelyEqual(
          contentMetrics.innerBottom - (helperBox.y + helperBox.height),
          5,
          1,
          `${width}x${height} helper keeps an approximately five-pixel visual bottom gap`,
        );
        assert.equal(
          intersects(helperBox, operatorBox, 0),
          false,
          `${width}x${height} helper does not overlap operators`,
        );
        if (feedbackBox)
          assert.equal(
            intersects(helperBox, feedbackBox, 0),
            false,
            `${width}x${height} helper does not overlap feedback status`,
          );
      },
    );
});

test("SC06: close paw retains its breakpoint-sized visible target, fine-pointer states, reduced-motion behavior, and keyboard close path", async () => {
  for (const [width, height] of [
    [1440, 900],
    [820, 1064],
    [390, 844],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const close = await exact(
          hint.dialog.getByRole("button", {
            name: "Close hint challenge",
            exact: true,
          }),
          `${width}x${height} refined close target`,
        );
        const paw = await exact(
          close.locator('img[src*="hint-popup-close-paw-128.png"][alt=""]'),
          `${width}x${height} refined decorative close paw`,
        );
        const dialogScale = await hint.dialog.evaluate(
          (element) => Number.parseFloat(getComputedStyle(element).scale) || 1,
        );
        const [closeBox, pawBox, base, closeCssSize, pawCssSize] =
          await Promise.all([
            close.boundingBox(),
            paw.boundingBox(),
            close.evaluate((element) => {
              const style = getComputedStyle(element);
              const values =
                style.backgroundColor.match(/\d+(?:\.\d+)?/g)?.map(Number) ||
                [];
              return {
                background: style.backgroundColor,
                alpha: values[3] ?? 1,
                borderRadius: style.borderRadius,
              };
            }),
            close.evaluate((element) => {
              const style = getComputedStyle(element);
              return {
                width: Number.parseFloat(style.width),
                height: Number.parseFloat(style.height),
              };
            }),
            paw.evaluate((element) => {
              const style = getComputedStyle(element);
              return {
                width: Number.parseFloat(style.width),
                height: Number.parseFloat(style.height),
              };
            }),
          ]);
        const expectedCloseSize = width <= 600 ? 56 : width <= 820 ? 60 : 76;
        approximatelyEqual(
          closeCssSize.width,
          expectedCloseSize,
          0.01,
          `${width}x${height} close button has the approved ${expectedCloseSize}px computed CSS width`,
        );
        approximatelyEqual(
          closeCssSize.height,
          expectedCloseSize,
          0.01,
          `${width}x${height} close button has the approved ${expectedCloseSize}px computed CSS height`,
        );
        approximatelyEqual(
          pawCssSize.width,
          expectedCloseSize,
          0.01,
          `${width}x${height} close paw image has the approved ${expectedCloseSize}px computed CSS width`,
        );
        approximatelyEqual(
          pawCssSize.height,
          expectedCloseSize,
          0.01,
          `${width}x${height} close paw image has the approved ${expectedCloseSize}px computed CSS height`,
        );
        approximatelyEqual(
          closeBox.width,
          expectedCloseSize * dialogScale,
          0.2,
          `${width}x${height} close button rendered width follows the dialog scale`,
        );
        approximatelyEqual(
          closeBox.height,
          expectedCloseSize * dialogScale,
          0.2,
          `${width}x${height} close button rendered height follows the dialog scale`,
        );
        approximatelyEqual(
          pawBox.width,
          expectedCloseSize * dialogScale,
          0.2,
          `${width}x${height} close paw image rendered width follows the dialog scale`,
        );
        approximatelyEqual(
          pawBox.height,
          expectedCloseSize * dialogScale,
          0.2,
          `${width}x${height} close paw image rendered height follows the dialog scale`,
        );
        assert.equal(
          isPurple(base.background),
          true,
          `${width}x${height} close button base uses a lilac background`,
        );
        assert.ok(
          base.alpha > 0 && base.alpha < 1,
          `${width}x${height} close button base background is translucent and nontransparent`,
        );
        assert.ok(
          base.borderRadius === "50%" ||
            Number.parseFloat(base.borderRadius) >= closeBox.width / 2,
          `${width}x${height} close button base is circular`,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${width}x${height} refined close paw adds no horizontal overflow`,
        );
        if (width >= 946) {
          await close.hover();
          await page.waitForTimeout(200);
          const hover = await close.evaluate((element) => {
            const style = getComputedStyle(element);
            const values =
              style.backgroundColor.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
            return { alpha: values[3] ?? 1, transform: style.transform };
          });
          assert.ok(
            hover.alpha > base.alpha,
            "desktop fine-pointer hover strengthens the close-paw background",
          );
          approximatelyEqual(
            transformScale(hover.transform),
            1.04,
            0.01,
            "desktop fine-pointer hover scales the close paw to approximately 1.04",
          );
          const box = await close.boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.waitForTimeout(200);
          const activeTransform = await close.evaluate(
            (element) => getComputedStyle(element).transform,
          );
          approximatelyEqual(
            transformScale(activeTransform),
            0.94,
            0.01,
            "desktop active close paw remains at approximately 0.94 scale",
          );
          await page.mouse.move(0, 0);
          await page.mouse.up();
        }
        await close.focus();
        assert.equal(
          await page.evaluate(() =>
            document.activeElement?.getAttribute("aria-label"),
          ),
          "Close hint challenge",
          `${width}x${height} close paw remains keyboard focusable by its accessible name`,
        );
        await page.keyboard.press("Enter");
        await hint.dialog.waitFor({ state: "hidden" });
      },
    );
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const controls = await gameControls(page);
      await controls.hint.click();
      const hint = await sc06Dialog(page);
      const close = await exact(
        hint.dialog.getByRole("button", {
          name: "Close hint challenge",
          exact: true,
        }),
        "reduced-motion close paw",
      );
      await close.hover();
      const reduced = await close.evaluate((element) => ({
        transition: getComputedStyle(element).transitionProperty,
        transform: getComputedStyle(element).transform,
      }));
      assert.equal(
        reduced.transition,
        "none",
        "reduced motion removes close-paw transitions",
      );
      approximatelyEqual(
        transformScale(reduced.transform),
        1,
        0.001,
        "reduced motion removes decorative close-paw scaling",
      );
    },
  );
});

test("SC06: live breakpoint crossings preserve the active question, answer, and unresolved-deadline identity", async () => {
  await withSession(
    { width: 599, height: 844 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const controls = await gameControls(page);
      await controls.hint.click();
      const hint = await sc06Dialog(page);
      const question = await hint.dialog
        .locator("label[for='hint-answer']")
        .innerText();
      await hint.answer.fill("7");
      await page.clock.runFor(9000);
      let resizeElapsed = 0;
      for (const width of [600, 601, 1279, 1280, 1279]) {
        resizeElapsed += await advanceFrozenViewportResize(page, {
          width,
          height: 844,
        });
        const current = await sc06Dialog(page);
        assert.equal(
          await current.dialog.locator("label[for='hint-answer']").innerText(),
          question,
          `${width}px preserves the same active challenge`,
        );
        assert.equal(
          await current.answer.inputValue(),
          "7",
          `${width}px preserves entered answer text`,
        );
        assert.equal(
          await page
            .getByRole("dialog", {
              name: "Solve a quick math question",
              exact: true,
            })
            .count(),
          1,
          `${width}px does not duplicate the dialog`,
        );
      }
      await page.clock.runFor(9999 - 9000 - resizeElapsed);
      assert.equal(
        (await sc06RenderedReferences(hint.dialog)).some((reference) =>
          reference.source.includes("hint-popup-cat-concerned-640.png"),
        ),
        false,
        "9,999ms keeps the thinking cat despite resize",
      );
      await page.clock.runFor(1);
      assert.equal(
        (await sc06RenderedReferences(hint.dialog)).some((reference) =>
          reference.source.includes("hint-popup-cat-concerned-640.png"),
        ),
        true,
        "10,000ms changes the same unresolved challenge to concerned desktop cat",
      );
    },
  );
});

test("SC06: concerned deadline, Give up, replacement, and stale callbacks preserve math-only and secret-neutral behavior", async () => {
  await withSession(
    { width: 1024, height: 768 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const controls = await gameControls(page);
      await controls.hint.click();
      let hint = await sc06Dialog(page);
      await hint.answer.fill("999");
      await hint.check.click();
      await page.clock.runFor(9999);
      assert.equal(
        (await sc06RenderedReferences(hint.dialog)).some((reference) =>
          reference.source.includes("hint-popup-cat-concerned-640.png"),
        ),
        true,
        "a wrong answer immediately selects the concerned desktop cat without waiting for the deadline",
      );
      await page.clock.runFor(1);
      assert.equal(
        (await sc06RenderedReferences(hint.dialog)).some((reference) =>
          reference.source.includes("hint-popup-cat-concerned-640.png"),
        ),
        true,
        "the exact deadline retains the concerned desktop cat",
      );
      assert.equal(
        await hint.dialog
          .locator('img[src*="hint-popup-lamp-320.png"]')
          .count(),
        1,
        "active unresolved challenge keeps one decorative popup lamp",
      );
      const revealedMathAnswer = solveVisibleQuestion(
        await hint.dialog.locator("label[for='hint-answer']").innerText(),
      );
      await hint.giveUp.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        (await sc06RenderedReferences(hint.dialog)).some((reference) =>
          reference.source.includes("hint-popup-cat-sad-640.png"),
        ),
        true,
        "math Give up swaps only the decorative cat to sad",
      );
      assert.equal(
        await hint.dialog
          .locator('img[src*="hint-popup-lamp-320.png"]')
          .count(),
        0,
        "abandoned Give up state removes decorative popup lamp",
      );
      const encouragement = await exact(
        hint.dialog.getByText(
          `The answer is ${revealedMathAnswer}. No worries — try another one!`,
          {
            exact: true,
          },
        ),
        "Give up answer-aware encouraging decorative bubble",
      );
      assert.equal(
        await encouragement.evaluate(
          (element) => element.closest("aside[aria-hidden='true']") !== null,
        ),
        true,
        "Give up encouragement remains decorative cat speech",
      );
      const giveUpStatus = await exact(
        hint.dialog
          .getByRole("status")
          .getByText(
            `The answer is ${revealedMathAnswer}. No hint was earned.`,
            { exact: true },
          ),
        "screen-reader-only Give up answer announcement",
      );
      assert.equal(
        await giveUpStatus.evaluate(
          (element) => element.closest("aside[aria-hidden='true']") === null,
        ),
        true,
        "Give up answer announcement remains outside decorative vignette",
      );
      const giveUpMessage = `The answer is ${revealedMathAnswer}. No hint was earned.`;
      assert.equal(
        await hint.dialog.locator("*").evaluateAll(
          (elements, message) =>
            elements.filter(
              (element) =>
                element.textContent?.trim() === message &&
                !element.closest("aside[aria-hidden='true']") &&
                (() => {
                  const style = getComputedStyle(element);
                  const rect = element.getBoundingClientRect();
                  return (
                    style.visibility !== "hidden" &&
                    style.display !== "none" &&
                    style.opacity !== "0" &&
                    rect.width > 2 &&
                    rect.height > 2
                  );
                })(),
            ).length,
          giveUpMessage,
        ),
        0,
        "Give up answer announcement does not duplicate a visible lower feedback line",
      );
      assert.equal(
        await page
          .getByRole("status")
          .getByText(/Earned hint:/)
          .count(),
        0,
        "math Give up awards no Safe Cat hint",
      );
      assert.equal(
        /safe code is/i.test(await page.locator("body").innerText()),
        false,
        "math Give up never discloses the Safe Cat secret",
      );
      await hint.newQuestion.click();
      hint = await sc06Dialog(page);
      assert.equal(
        (await sc06RenderedReferences(hint.dialog)).some((reference) =>
          reference.source.includes("hint-popup-cat-thinking-640.png"),
        ),
        true,
        "New question restores thinking with a fresh deadline",
      );
      assert.equal(
        await hint.dialog
          .locator('img[src*="hint-popup-lamp-320.png"]')
          .count(),
        1,
        "new challenge restores exactly one decorative popup lamp",
      );
      await exact(
        hint.dialog.getByText("Solve this and I’ll give you a hint!", {
          exact: true,
        }),
        "new challenge restores normal decorative cat bubble",
      );
      await page.clock.runFor(9999);
      assert.equal(
        (await sc06RenderedReferences(hint.dialog)).some((reference) =>
          reference.source.includes("hint-popup-cat-concerned-640.png"),
        ),
        false,
        "a stale deadline from the abandoned challenge cannot update its replacement",
      );
    },
  );
});

test("SC06: <=600px simplifies the vignette to one state cat beside the persistent key notice", async () => {
  const assets = {
    thinking: "hint-popup-cat-thinking-new-1448.png",
    concerned: "hint-popup-cat-encouraging-1448.png",
    happy: "hint-popup-cat-success-1448.png",
    sad: "hint-popup-cat-sad-give-up-1448.png",
  };
  for (const [width, height] of [
    [320, 568],
    [322, 1110],
    [390, 677],
    [390, 844],
    [558, 677],
    [600, 900],
  ])
    await withSession(
      { width, height },
      { random: 0.041, clockStart: fixedClockStart },
      async ({ page }) => {
        await pauseClockAtCurrentTime(page);
        const controls = await gameControls(page);
        await controls.hint.click();
        let hint = await sc06Dialog(page);
        let acceptedOuter;
        let acceptedLayout;
        const inspect = async (state, asset) => {
          await hint.dialog.evaluate((element) => {
            element.scrollTop = 0;
          });
          await waitForStableVisualGeometry(page, false);
          const vignette = await exact(
            hint.dialog.locator('aside[aria-hidden="true"]'),
            `${width}x${height} ${state} simplified vignette`,
          );
          const cat = await exact(
            vignette.locator(`img[src*="${asset}"]`),
            `${width}x${height} ${state} mapped cat`,
          );
          const lamp = vignette.locator('img[src*="hint-popup-lamp-320.png"]');
          const lampCount = await lamp.count();
          const bubble = await exact(
            vignette.locator(":scope > div").first(),
            `${width}x${height} ${state} decorative bubble node`,
          );
          const notice = await exact(
            vignette.getByText(
              "A correct answer will unlock a hint in the game!",
              { exact: true },
            ),
            `${width}x${height} ${state} persistent key notice`,
          );
          const key = await exact(
            notice.locator("xpath=..").locator("img"),
            `${width}x${height} ${state} key notice icon`,
          );
          const noticeText = notice;
          const [
            headingBox,
            contentBox,
            vignetteBox,
            actionsBox,
            catBox,
            catAlpha,
            noticeBox,
            keyBox,
            noticeTextBox,
            lampBox,
            bubbleBox,
            metrics,
          ] = await Promise.all([
            hint.dialog.locator("header").boundingBox(),
            hint.dialog.locator("section").boundingBox(),
            vignette.boundingBox(),
            hint.newQuestion.locator("xpath=..").boundingBox(),
            cat.boundingBox(),
            visibleAlphaBounds(page, cat),
            notice.boundingBox(),
            key.boundingBox(),
            noticeText.boundingBox(),
            lampCount ? lamp.boundingBox() : Promise.resolve(null),
            bubble.boundingBox(),
            Promise.all([
              lampCount
                ? lamp.evaluate((element) => getComputedStyle(element).display)
                : "none",
              bubble.evaluate((element) => getComputedStyle(element).display),
              cat.evaluate((element) => ({
                loaded:
                  element.complete &&
                  element.naturalWidth > 0 &&
                  element.naturalHeight > 0,
              })),
              page.evaluate(() => ({
                bodyOverflowY: getComputedStyle(document.body).overflowY,
                documentOverflowY: getComputedStyle(document.documentElement)
                  .overflowY,
                scrollWidth: document.documentElement.scrollWidth,
                scrollY,
              })),
            ]),
          ]);
          const [lampDisplay, bubbleDisplay, catMetrics, scroll] = metrics;
          assert.ok(
            headingBox &&
              contentBox &&
              vignetteBox &&
              actionsBox &&
              catBox &&
              catAlpha &&
              noticeBox &&
              keyBox &&
              noticeTextBox,
            `${width}x${height} ${state} keeps every simplified-vignette region rendered`,
          );
          assert.equal(
            lampDisplay,
            "none",
            `${width}x${height} ${state} hides the decorative lamp`,
          );
          assert.ok(
            lampCount <= 1,
            `${width}x${height} ${state} has at most one lamp node`,
          );
          assert.equal(
            bubbleDisplay,
            "none",
            `${width}x${height} ${state} hides the decorative bubble`,
          );
          assert.equal(
            lampBox,
            null,
            `${width}x${height} ${state} lamp has no visible box`,
          );
          assert.equal(
            bubbleBox,
            null,
            `${width}x${height} ${state} bubble has no visible box`,
          );
          assert.equal(
            catMetrics.loaded,
            true,
            `${width}x${height} ${state} cat asset is loaded`,
          );
          assert.equal(
            await vignette.locator('img[src*="hint-popup-cat-"]').count(),
            1,
            `${width}x${height} ${state} renders exactly one state cat`,
          );
          assert.ok(
            catAlpha.x >= vignetteBox.x &&
              catAlpha.y >= vignetteBox.y &&
              catAlpha.x + catAlpha.width <=
                vignetteBox.x + vignetteBox.width &&
              catAlpha.y + catAlpha.height <=
                vignetteBox.y + vignetteBox.height,
            `${width}x${height} ${state} visible cat art remains inside the unchanged vignette`,
          );
          assert.ok(
            keyBox.x + keyBox.width <= noticeTextBox.x,
            `${width}x${height} ${state} keeps the key before the notice copy`,
          );
          assert.equal(
            intersects(catAlpha, noticeBox, 0),
            false,
            `${width}x${height} ${state} key notice does not cover cat art`,
          );
          for (const [name, box] of Object.entries({
            heading: headingBox,
            content: contentBox,
            vignette: vignetteBox,
            actions: actionsBox,
            cat: catBox,
            notice: noticeBox,
          }))
            assert.ok(
              box.x >= 0 && box.x + box.width <= width,
              `${width}x${height} ${state} ${name} remains horizontally contained while the dialog owns vertical reachability`,
            );
          assert.equal(
            scroll.bodyOverflowY,
            "hidden",
            `${width}x${height} ${state} keeps body scroll locked`,
          );
          assert.equal(
            scroll.documentOverflowY,
            "hidden",
            `${width}x${height} ${state} keeps document scroll locked`,
          );
          assert.ok(
            scroll.scrollWidth <= width,
            `${width}x${height} ${state} has no horizontal overflow`,
          );
          await hint.dialog.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          const [checkBox, newQuestionBox, giveUpBox, laneBox] =
            await Promise.all([
              hint.check.boundingBox(),
              hint.newQuestion.boundingBox(),
              hint.giveUp.boundingBox(),
              hint.dialog.boundingBox(),
            ]);
          assert.ok(
            [checkBox, newQuestionBox, giveUpBox].every(
              (box) => box && box.y >= laneBox.y && box.y + box.height <= laneBox.y + laneBox.height,
            ),
            `${width}x${height} ${state} vignette state keeps essential actions reachable after bounded internal scrolling`,
          );
          await hint.dialog.evaluate((element) => {
            element.scrollTop = 0;
          });
          const layout = {
            actions: actionsBox,
            content: contentBox,
            heading: headingBox,
            vignette: vignetteBox,
          };
          if (!acceptedOuter) {
            acceptedOuter = vignetteBox;
            acceptedLayout = layout;
          } else {
            for (const property of ["x", "y", "width", "height"]) {
              approximatelyEqual(
                vignetteBox[property],
                acceptedOuter[property],
                1,
                `${width}x${height} ${state} preserves the accepted vignette ${property}`,
              );
              for (const region of ["heading", "content", "actions"])
                approximatelyEqual(
                  layout[region][property],
                  acceptedLayout[region][property],
                  1,
                  `${width}x${height} ${state} does not move ${region} ${property}`,
                );
            }
          }
        };

        await inspect("thinking", assets.thinking);
        await hint.answer.fill("not-a-number");
        await hint.check.click();
        await inspect("immediate wrong-answer concern", assets.concerned);
        const retry = await exact(
          hint.dialog
            .getByRole("status")
            .getByText("Try again — you’ve got this!", { exact: true }),
          `${width}x${height} accessible retry status`,
        );
        assert.equal(
          await retry.evaluate(
            (element) => element.closest('[aria-hidden="true"]') === null,
          ),
          true,
          `${width}x${height} retry status remains outside the decorative vignette`,
        );
        await hint.answer.fill("1");
        await inspect("retry-cleared concern", assets.concerned);
        await hint.newQuestion.click();
        hint = await sc06Dialog(page);
        await inspect("new-question thinking", assets.thinking);
        await page.clock.runFor(10_000);
        await inspect("ten-second concern", assets.concerned);
        await hint.giveUp.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
        await inspect("Give up sadness", assets.sad);
        await hint.newQuestion.click();
        hint = await sc06Dialog(page);
        const answer = solveVisibleQuestion(
          await hint.dialog.locator("label[for='hint-answer']").innerText(),
        );
        await hint.answer.fill(String(answer));
        await hint.check.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
        await inspect("correct-answer happiness", assets.happy);
      },
    );

  for (const [width, height] of [
    [601, 900],
    [821, 1040],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const vignette = hint.dialog.locator('aside[aria-hidden="true"]');
        const lamp = await exact(
          vignette.locator('img[src*="hint-popup-lamp-320.png"]'),
          `${width}px lamp`,
        );
        const bubble = await exact(
          vignette.locator(":scope > div").first(),
          `${width}px bubble`,
        );
        assert.equal(
          await lamp.isVisible(),
          true,
          `${width}px tablet/desktop lamp remains visible`,
        );
        assert.equal(
          await bubble.isVisible(),
          true,
          `${width}px tablet/desktop bubble remains visible`,
        );
      },
    );
});

test("SC06: responsive cat states keep exactly one visible mapped cat and an unobscured contained vignette", async () => {
  const narrowAssets = {
    thinking: "hint-popup-cat-thinking-new-1448.png",
    concerned: "hint-popup-cat-encouraging-1448.png",
    sad: "hint-popup-cat-sad-give-up-1448.png",
    happy: "hint-popup-cat-success-1448.png",
  };
  const desktopAssets = {
    thinking: "hint-popup-cat-thinking-640.png",
    concerned: "hint-popup-cat-concerned-640.png",
    sad: "hint-popup-cat-sad-640.png",
    happy: "hint-popup-cat-happy-640.png",
  };
  for (const [width, height, assets, reflected, requiresNarrowGeometry] of [
    [320, 568, narrowAssets, true, true],
    [390, 677, narrowAssets, true, true],
    [558, 677, narrowAssets, true, true],
    [700, 677, narrowAssets, true, true],
    [390, 844, narrowAssets, true, true],
    [600, 900, narrowAssets, true, true],
    [768, 900, narrowAssets, true, true],
    [820, 1064, narrowAssets, true, true],
    [821, 1040, desktopAssets, false, false],
  ])
    await withSession(
      { width, height },
      { random: 0.041, clockStart: fixedClockStart },
      async ({ page }) => {
        await pauseClockAtCurrentTime(page);
        const controls = await gameControls(page);
        await controls.hint.click();
        let hint = await sc06Dialog(page);
        let priorAsset = null;
        const assertNarrowGeometry = async (description) => {
          if (!requiresNarrowGeometry) return;
          const mobileSimplified = width <= 600;
          const vignette = await exact(
            hint.dialog.locator('aside[aria-hidden="true"]'),
            `${width}x${height} ${description} vignette`,
          );
          const bubble = await exact(
            vignette.locator(":scope > div").first(),
            `${width}x${height} ${description} speech bubble`,
          );
          const notice = await exact(
            vignette.getByText(
              "A correct answer will unlock a hint in the game!",
              { exact: true },
            ),
            `${width}x${height} ${description} earned-hint notice copy`,
          );
          const close = await exact(
            hint.dialog.getByRole("button", {
              name: "Close hint challenge",
              exact: true,
            }),
            `${width}x${height} ${description} close paw`,
          );
          const actions = hint.newQuestion.locator("xpath=..");
          const cat = await exact(
            vignette.locator('img[src*="hint-popup-cat-"]'),
            `${width}x${height} ${description} visible cat`,
          );
          const [
            dialogMetrics,
            vignetteBox,
            catBox,
            catAlpha,
            bubbleBox,
            noticeBox,
            contentBox,
            actionsBox,
            closeBox,
            scrollLock,
          ] = await Promise.all([
            hint.dialog.evaluate((element) => {
              const style = getComputedStyle(element);
              return {
                clientHeight: element.clientHeight,
                overflowY: style.overflowY,
                scrollHeight: element.scrollHeight,
              };
            }),
            vignette.boundingBox(),
            cat.boundingBox(),
            visibleAlphaBounds(page, cat),
            bubble.boundingBox(),
            notice.boundingBox(),
            hint.dialog.locator("section").boundingBox(),
            actions.boundingBox(),
            close.boundingBox(),
            page.evaluate(() => ({
              bodyOverflowY: getComputedStyle(document.body).overflowY,
              documentOverflowY: getComputedStyle(document.documentElement)
                .overflowY,
              scrollWidth: document.documentElement.scrollWidth,
              scrollY,
            })),
          ]);
          assert.equal(
            await vignette.isVisible(),
            true,
            `${width}x${height} ${description} keeps the compact vignette visible`,
          );
          assert.ok(
            vignetteBox &&
              catBox &&
              noticeBox &&
              contentBox &&
              actionsBox &&
              closeBox &&
              (mobileSimplified || bubbleBox),
            `${width}x${height} ${description} renders every responsive scene region`,
          );
          const contained = (inner, outer) =>
            inner.x >= outer.x - 1 &&
            inner.y >= outer.y - 1 &&
            inner.x + inner.width <= outer.x + outer.width + 1 &&
            inner.y + inner.height <= outer.y + outer.height + 1;
          assert.equal(
            contained(catAlpha, vignetteBox),
            true,
            `${width}x${height} ${description} visible cat art remains inside its vignette`,
          );
          for (const [name, box] of Object.entries({
            vignette: vignetteBox,
            cat: catBox,
            notice: noticeBox,
            content: contentBox,
            actions: actionsBox,
            close: closeBox,
            ...(!mobileSimplified ? { bubble: bubbleBox } : {}),
          }))
            assert.ok(
              box.x >= 0 && box.x + box.width <= width,
              `${width}x${height} ${description} ${name} remains horizontally contained while vertical reachability is owned by the dialog`,
            );
          if (mobileSimplified) {
            assert.equal(
              await bubble.isVisible(),
              false,
              `${width}x${height} ${description} mobile hides the decorative bubble`,
            );
            assert.equal(
              bubbleBox,
              null,
              `${width}x${height} ${description} mobile bubble has no visible bounds`,
            );
          } else
            assert.equal(
              intersects(catAlpha, bubbleBox, 0),
              false,
              `${width}x${height} ${description} bubble does not obscure cat state art`,
            );
          assert.equal(
            intersects(catAlpha, noticeBox, 0),
            false,
            `${width}x${height} ${description} notice does not obscure cat state art`,
          );
          if (!mobileSimplified)
            assert.equal(
              intersects(bubbleBox, noticeBox, 0),
              false,
              `${width}x${height} ${description} bubble does not obscure earned-hint copy`,
            );
          assert.ok(
            ["auto", "scroll"].includes(dialogMetrics.overflowY) ||
              dialogMetrics.scrollHeight <= dialogMetrics.clientHeight,
            `${width}x${height} ${description} retains reachable bounded content`,
          );
          assert.equal(
            scrollLock.bodyOverflowY,
            "hidden",
            `${width}x${height} ${description} keeps page body locked`,
          );
          assert.equal(
            scrollLock.documentOverflowY,
            "hidden",
            `${width}x${height} ${description} keeps document scrolling locked`,
          );
          assert.ok(
            scrollLock.scrollWidth <= width,
            `${width}x${height} ${description} creates no horizontal overflow`,
          );
          await page.keyboard.press("End");
          await page.mouse.wheel(0, 600);
          assert.equal(
            await page.evaluate(() => scrollY),
            scrollLock.scrollY,
            `${width}x${height} ${description} cannot activate page scrolling`,
          );
          await hint.dialog.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          const [checkBox, operatorBox, newQuestionBox, giveUpBox, laneBox] =
            await Promise.all([
              hint.check.boundingBox(),
              hint.dialog.getByLabel("Choose a math operation", { exact: true }).boundingBox(),
              hint.newQuestion.boundingBox(),
              hint.giveUp.boundingBox(),
              hint.dialog.boundingBox(),
            ]);
          assert.ok(
            [checkBox, operatorBox, newQuestionBox, giveUpBox].every(
              (box) => box && box.y >= laneBox.y && box.y + box.height <= laneBox.y + laneBox.height,
            ),
            `${width}x${height} ${description} internal scrolling reaches Check, operators, New question, and Give up`,
          );
        };
        const stateAsset = async (filename, description, reflected) => {
          await page.waitForFunction((expectedFilename) => {
            const cats = document.querySelectorAll(
              'aside[aria-hidden="true"] img[src*="hint-popup-cat-"]',
            );
            if (cats.length !== 1) return false;
            const cat = cats[0];
            const source = cat.currentSrc || cat.src;
            return (
              cat.complete &&
              cat.naturalWidth > 0 &&
              cat.naturalHeight > 0 &&
              source.includes(expectedFilename)
            );
          }, filename);
          const cats = hint.dialog.locator(
            'aside[aria-hidden="true"] img[src*="hint-popup-cat-"]',
          );
          assert.equal(
            await cats.count(),
            1,
            `${width}x${height} ${description} keeps exactly one decorative cat source without a duplicate layout`,
          );
          const cat = await exact(cats, description);
          assert.equal(
            await cat.isVisible(),
            true,
            `${width}x${height} ${description} keeps its sole decorative cat visible`,
          );
          const horizontalDirection = await cat.evaluate((element) => {
            const style = getComputedStyle(element);
            const matrixScaleX = new DOMMatrixReadOnly(style.transform).a;
            const independentScaleX =
              style.scale === "none" ? 1 : Number(style.scale.split(/\s+/)[0]);
            return {
              direction: matrixScaleX * independentScaleX,
              loaded:
                element.complete &&
                element.naturalWidth > 0 &&
                element.naturalHeight > 0,
              source: element.currentSrc || element.src,
            };
          });
          assert.equal(
            horizontalDirection.loaded,
            true,
            `${width}x${height} ${description} source is loaded exactly once`,
          );
          assert.equal(
            horizontalDirection.source.includes(filename),
            true,
            `${width}x${height} ${description} renders the approved responsive source`,
          );
          assert.equal(
            horizontalDirection.direction < 0,
            reflected,
            `${width}x${height} ${description} ${reflected ? "is" : "is not"} horizontally reflected by presentation CSS`,
          );
          if (priorAsset)
            assert.equal(
              (await sc06RenderedReferences(hint.dialog)).some((reference) =>
                reference.source.includes(priorAsset),
              ),
              false,
              `${width}x${height} ${description} removes the prior cat source`,
            );
          priorAsset = filename;
          await assertNarrowGeometry(description);
          return cat;
        };
        await stateAsset(assets.thinking, "initial thinking cat", reflected);

        await hint.answer.fill("not-a-number");
        await hint.check.click();
        await stateAsset(
          assets.concerned,
          "wrong-answer concerned cat",
          reflected,
        );
        assert.equal(
          (await sc06RenderedReferences(hint.dialog)).some((reference) =>
            reference.source.includes(assets.thinking),
          ),
          false,
          `${width}x${height} wrong submission immediately replaces thinking artwork`,
        );

        await hint.newQuestion.click();
        hint = await sc06Dialog(page);
        await stateAsset(
          assets.thinking,
          "New question restored thinking cat",
          reflected,
        );
        await page.clock.runFor(9_999);
        assert.equal(
          (await sc06RenderedReferences(hint.dialog)).some((reference) =>
            reference.source.includes(assets.concerned),
          ),
          false,
          `${width}x${height} 9,999ms unresolved challenge remains thinking`,
        );
        await page.clock.runFor(1);
        await stateAsset(
          assets.concerned,
          "10,000ms unresolved concerned cat",
          reflected,
        );

        await hint.giveUp.click();
        await stateAsset(assets.sad, "Give up sad cat", reflected);

        await hint.newQuestion.click();
        hint = await sc06Dialog(page);
        const correctAnswer = solveVisibleQuestion(
          await hint.dialog.locator("label[for='hint-answer']").innerText(),
        );
        await hint.answer.fill(String(correctAnswer));
        await hint.check.click();
        await stateAsset(assets.happy, "correct-answer happy cat", false);
      },
    );
});

test("SC06: desktop challenge cat preserves a loaded square silhouette inside its vignette", async () => {
  for (const [width, height] of [
    [821, 900],
    [1280, 900],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const vignette = hint.dialog.locator('aside[aria-hidden="true"]');
        const cat = await exact(
          vignette.locator('img[src*="hint-popup-cat-"]'),
          `${width}x${height} desktop challenge cat`,
        );
        const [
          catBox,
          catAlpha,
          vignetteBox,
          headerBox,
          contentBox,
          actionsBox,
        ] = await Promise.all([
          cat.boundingBox(),
          visibleAlphaBounds(page, cat),
          vignette.boundingBox(),
          hint.dialog.locator("header").boundingBox(),
          hint.dialog.locator("section").boundingBox(),
          hint.newQuestion.locator("xpath=..").boundingBox(),
        ]);
        assert.ok(
          catBox &&
            catAlpha &&
            vignetteBox &&
            headerBox &&
            contentBox &&
            actionsBox,
          `${width}x${height} desktop cat, vignette, and protected dialog regions render`,
        );
        const source = await cat.evaluate((element) => ({
          loaded:
            element.complete &&
            element.naturalWidth > 0 &&
            element.naturalHeight > 0,
          source: element.currentSrc || element.src,
        }));
        assert.equal(
          source.loaded,
          true,
          `${width}x${height} desktop cat source is loaded`,
        );
        assert.equal(
          source.source.includes("hint-popup-cat-thinking-640.png"),
          true,
          `${width}x${height} desktop cat uses its approved wide source`,
        );
        approximatelyEqual(
          catBox.width,
          catBox.height,
          1,
          `${width}x${height} desktop cat remains visually square`,
        );
        assert.equal(
          catAlpha.x >= vignetteBox.x - 1 &&
            catAlpha.y >= vignetteBox.y - 1 &&
            catAlpha.x + catAlpha.width <=
              vignetteBox.x + vignetteBox.width + 1 &&
            catAlpha.y + catAlpha.height <=
              vignetteBox.y + vignetteBox.height + 1,
          true,
          `${width}x${height} desktop cat alpha remains contained by its vignette`,
        );
        for (const [name, box] of Object.entries({
          header: headerBox,
          challenge: contentBox,
          actions: actionsBox,
        }))
          assert.equal(
            intersects(catAlpha, box, 0),
            false,
            `${width}x${height} desktop cat does not cover protected ${name} content`,
          );
      },
    );
});

test("SC06: wrong-answer feedback never shifts the responsive challenge layout while retry is cleared", async () => {
  const narrowConcernedAsset = "hint-popup-cat-encouraging-1448.png";
  const desktopConcernedAsset = "hint-popup-cat-concerned-640.png";
  for (const [width, height] of [
    [320, 568],
    [390, 677],
    [390, 844],
    [558, 677],
    [600, 900],
    [700, 677],
    [768, 900],
    [820, 1064],
    [821, 1040],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const heading = hint.dialog.locator("header");
        const content = hint.dialog.locator("section");
        const vignette = hint.dialog.locator('aside[aria-hidden="true"]');
        const actions = hint.newQuestion.locator("xpath=..");
        const snapshot = async () => {
          const [
            headingBox,
            contentBox,
            vignetteBox,
            actionsBox,
            dialogBox,
            scroll,
          ] = await Promise.all([
            heading.boundingBox(),
            content.boundingBox(),
            vignette.boundingBox(),
            actions.boundingBox(),
            hint.dialog.boundingBox(),
            hint.dialog.evaluate((element) => ({
              bodyOverflowY: getComputedStyle(document.body).overflowY,
              clientHeight: element.clientHeight,
              documentOverflowY: getComputedStyle(document.documentElement)
                .overflowY,
              overflowY: getComputedStyle(element).overflowY,
              scrollHeight: element.scrollHeight,
              scrollWidth: document.documentElement.scrollWidth,
              scrollY,
            })),
          ]);
          assert.ok(
            headingBox && contentBox && vignetteBox && actionsBox && dialogBox,
            `${width}x${height} responsive wrong-answer snapshot has every layout region`,
          );
          return {
            actions: actionsBox,
            content: contentBox,
            dialog: dialogBox,
            heading: headingBox,
            scroll,
            vignette: vignetteBox,
          };
        };
        const assertStable = (before, after, stage) => {
          for (const region of [
            "heading",
            "content",
            "vignette",
            "actions",
            "dialog",
          ])
            for (const property of ["x", "y", "width", "height"])
              approximatelyEqual(
                after[region][property],
                before[region][property],
                1,
                `${width}x${height} ${stage} keeps ${region} ${property} stable`,
              );
          for (const frame of [before, after]) {
            assert.equal(
              frame.scroll.bodyOverflowY,
              "hidden",
              `${width}x${height} ${stage} keeps the body scroll lock`,
            );
            assert.equal(
              frame.scroll.documentOverflowY,
              "hidden",
              `${width}x${height} ${stage} keeps the document scroll lock`,
            );
            assert.ok(
              ["auto", "scroll"].includes(frame.scroll.overflowY) ||
                frame.scroll.scrollHeight <= frame.scroll.clientHeight,
              `${width}x${height} ${stage} retains reachable bounded content`,
            );
            assert.ok(
              frame.scroll.scrollWidth <= width,
              `${width}x${height} ${stage} introduces no horizontal overflow`,
            );
          }
        };

        const beforeWrong = await snapshot();
        await hint.answer.fill("not-a-number");
        await hint.check.click();
        const afterWrong = await snapshot();
        assertStable(beforeWrong, afterWrong, "immediate wrong submission");
        assert.equal(
          await hint.answer.getAttribute("aria-invalid"),
          "true",
          `${width}x${height} wrong input remains programmatically invalid`,
        );
        const errorSurface = await hint.answer.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.borderColor, style.outlineColor, style.boxShadow];
        });
        assert.equal(
          errorSurface.some(isErrorRed),
          true,
          `${width}x${height} wrong input visibly exposes its red error treatment`,
        );
        const concerned = await exact(
          vignette.locator('img[src*="hint-popup-cat-"]'),
          `${width}x${height} wrong-answer concerned cat`,
        );
        assert.equal(
          await concerned.isVisible(),
          true,
          `${width}x${height} wrong-answer concerned cat remains visible`,
        );
        assert.equal(
          await concerned.evaluate(
            (image, expectedAsset) =>
              image.complete &&
              image.naturalWidth > 0 &&
              image.currentSrc.includes(expectedAsset),
            width <= 820 ? narrowConcernedAsset : desktopConcernedAsset,
          ),
          true,
          `${width}x${height} wrong-answer concerned cat source is loaded`,
        );
        const retryCopy = "Try again — you’ve got this!";
        const decorativeRetry = await exact(
          vignette.getByText(retryCopy, { exact: true }),
          `${width}x${height} decorative retry copy`,
        );
        const liveRetry = await exact(
          hint.dialog.getByRole("status").getByText(retryCopy, { exact: true }),
          `${width}x${height} live retry copy`,
        );
        assert.equal(
          await decorativeRetry.isVisible(),
          width > 600,
          `${width}x${height} decorative retry copy is ${width > 600 ? "visible" : "hidden"} in the vignette`,
        );
        assert.equal(
          await liveRetry.evaluate(
            (element) => element.closest('aside[aria-hidden="true"]') === null,
          ),
          true,
          `${width}x${height} live retry region remains accessible outside decorative aria-hidden artwork`,
        );
        const retryPresentations = await hint.dialog
          .getByText(retryCopy, { exact: true })
          .evaluateAll((elements) =>
            elements.map((element) => {
              const box = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return {
                inDecorativeVignette:
                  element.closest('aside[aria-hidden="true"]') !== null,
                visuallyRendered:
                  style.display !== "none" &&
                  style.visibility !== "hidden" &&
                  style.opacity !== "0" &&
                  style.clip !== "rect(0px, 0px, 0px, 0px)" &&
                  style.clipPath === "none" &&
                  box.width > 0 &&
                  box.height > 0,
              };
            }),
          );
        assert.equal(
          retryPresentations.filter(
            (presentation) => presentation.inDecorativeVignette,
          ).length,
          1,
          `${width}x${height} renders one decorative retry message`,
        );
        assert.equal(
          retryPresentations.filter(
            (presentation) => !presentation.inDecorativeVignette,
          ).length,
          1,
          `${width}x${height} retains one non-decorative live retry message`,
        );
        assert.equal(
          retryPresentations.filter(
            (presentation) => presentation.visuallyRendered,
          ).length,
          width <= 600 ? 0 : 1,
          `${width}x${height} ${width <= 600 ? "keeps retry copy nonvisual in the simplified vignette" : "visually renders retry copy only once"}`,
        );

        await hint.answer.fill("1");
        const afterEdit = await snapshot();
        assertStable(beforeWrong, afterEdit, "first actual answer edit");
        assert.equal(
          await hint.answer.getAttribute("aria-invalid"),
          null,
          `${width}x${height} first actual edit clears the retry-invalid state without a reverse layout jump`,
        );
        assert.equal(
          await hint.dialog.getByText(retryCopy, { exact: true }).count(),
          0,
          `${width}x${height} first actual edit clears both retry presentations`,
        );
        assert.equal(
          await concerned.isVisible(),
          true,
          `${width}x${height} retry clearing does not replace the concerned state art`,
        );
        await page.keyboard.press("End");
        await page.mouse.wheel(0, 600);
        assert.equal(
          await page.evaluate(() => scrollY),
          beforeWrong.scroll.scrollY,
          `${width}x${height} retry transitions cannot activate page scrolling`,
        );
        await hint.dialog.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        const [checkBox, operatorBox, newQuestionBox, giveUpBox, laneBox] =
          await Promise.all([
            hint.check.boundingBox(),
            hint.dialog.getByLabel("Choose a math operation", { exact: true }).boundingBox(),
            hint.newQuestion.boundingBox(),
            hint.giveUp.boundingBox(),
            hint.dialog.boundingBox(),
          ]);
        assert.ok(
          [checkBox, operatorBox, newQuestionBox, giveUpBox].every(
            (box) => box && box.y >= laneBox.y && box.y + box.height <= laneBox.y + laneBox.height,
          ),
          `${width}x${height} wrong-feedback state retains reachable Check, operators, New question, and Give up controls`,
        );
      },
    );
});

test("SC06: invalid math answers persist a red accessible error until the first real edit, then may be rejected again", async () => {
  await withSession(
    { width: 943, height: 708 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const controls = await gameControls(page);
      await controls.hint.click();
      const hint = await sc06Dialog(page);
      const normalBubble = hint.dialog.getByText(
        "Solve this and I’ll give you a hint!",
        {
          exact: true,
        },
      );
      await exact(normalBubble, "initial decorative math bubble");
      await hint.answer.fill("not-a-number");
      await hint.check.click();
      const errorBubble = await exact(
        hint.dialog
          .locator("aside")
          .getByText("Try again — you’ve got this!", { exact: true }),
        "wrong-answer decorative bubble",
      );
      assert.equal(
        await hint.answer.getAttribute("aria-invalid"),
        "true",
        "invalid math syntax exposes an accessible invalid input state",
      );
      const errorSurface = await hint.answer.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.borderColor, style.outlineColor, style.boxShadow];
      });
      assert.equal(
        errorSurface.some(isErrorRed),
        true,
        "invalid math syntax visibly uses a red error border or ring",
      );
      assert.equal(
        await errorBubble.evaluate(
          (element) => element.closest("aside[aria-hidden='true']") !== null,
        ),
        true,
        "Try again bubble remains decorative inside the hidden vignette",
      );
      assert.equal(
        await normalBubble.count(),
        0,
        "wrong answer replaces rather than duplicates the normal decorative bubble",
      );
      const liveRetry = await exact(
        hint.dialog
          .getByRole("status")
          .getByText("Try again — you’ve got this!", { exact: true }),
        "polite encouragement announcement outside the decorative vignette",
      );
      assert.equal(
        await liveRetry.evaluate(
          (element) => element.closest("aside[aria-hidden='true']") === null,
        ),
        true,
        "retry announcement is not hidden with vignette artwork",
      );
      assert.equal(
        await hint.dialog.locator("*").evaluateAll(
          (elements) =>
            elements.filter(
              (element) =>
                element.textContent?.trim() ===
                  "Try again — you’ve got this!" &&
                !element.closest("aside[aria-hidden='true']") &&
                (() => {
                  const style = getComputedStyle(element);
                  const rect = element.getBoundingClientRect();
                  return (
                    style.visibility !== "hidden" &&
                    style.display !== "none" &&
                    rect.width > 2 &&
                    rect.height > 2
                  );
                })(),
            ).length,
        ),
        1,
        "the live retry announcement is the only visible bottom message",
      );
      await page.clock.runFor(30_000);
      assert.equal(
        await hint.answer.getAttribute("aria-invalid"),
        "true",
        "error state persists without a timer until input really changes",
      );
      assert.equal(
        await errorBubble.count(),
        1,
        "retry bubble persists without a timer until input really changes",
      );
      await hint.answer.press("1");
      assert.equal(
        await hint.answer.getAttribute("aria-invalid"),
        null,
        "first real answer edit clears invalid accessibility state immediately",
      );
      const clearedSurface = await hint.answer.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.borderColor, style.outlineColor, style.boxShadow];
      });
      assert.equal(
        clearedSurface.some(isErrorRed),
        false,
        "first real answer edit clears the red error border and ring immediately",
      );
      await exact(normalBubble, "normal bubble restored after first real edit");
      assert.equal(
        await hint.dialog
          .getByText("Try again — you’ve got this!", { exact: true })
          .count(),
        0,
        "first real answer edit clears retry bubble and announcement together",
      );
      await hint.answer.fill("still-invalid");
      await hint.check.click();
      assert.equal(
        await hint.answer.getAttribute("aria-invalid"),
        "true",
        "a later invalid submission re-establishes invalid accessibility state",
      );
      await exact(
        hint.dialog
          .getByRole("status")
          .getByText("Try again — you’ve got this!", { exact: true }),
        "later wrong answer retry bubble",
      );
      assert.equal(
        /answer is|safe code|higher|lower|closer/i.test(
          await hint.dialog.innerText(),
        ),
        false,
        "wrong math feedback never reveals an answer, secret, or proximity signal",
      );
    },
  );
});

test("SC06: Random operator creates one fresh deterministic challenge and follows the active challenge freeze rules", async () => {
  await withSession(
    { width: 1024, height: 768 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const controls = await gameControls(page);
      await controls.hint.click();
      let hint = await sc06Dialog(page);
      const originalQuestion = await hint.dialog
        .locator("label[for='hint-answer']")
        .innerText();
      assert.equal(
        await hint.dialog
          .getByLabel("Choose a math operation", { exact: true })
          .getByRole("button")
          .count(),
        5,
        "exactly five accessible operator controls are present",
      );
      const randomImage = await exact(
        hint.randomOperator.locator(
          'img[src*="operator-random-256.png"][alt=""]',
        ),
        "Random operator approved decorative PNG",
      );
      const [randomControlBox, randomImageBox, randomImageState] =
        await Promise.all([
          hint.randomOperator.boundingBox(),
          randomImage.boundingBox(),
          randomImage.evaluate((image) => ({
            complete: image.complete,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            draggable: image.draggable,
          })),
        ]);
      assert.ok(
        randomControlBox && randomImageBox,
        "Random operator control and approved PNG have rendered bounds",
      );
      assert.equal(
        randomImageState.complete &&
          randomImageState.naturalWidth > 0 &&
          randomImageState.naturalHeight > 0,
        true,
        "Random operator approved PNG loads successfully",
      );
      assert.equal(
        randomImageState.draggable,
        false,
        "Random operator approved PNG suppresses native dragging",
      );
      assert.ok(
        randomImageBox.x >= randomControlBox.x &&
          randomImageBox.y >= randomControlBox.y &&
          randomImageBox.x + randomImageBox.width <=
            randomControlBox.x + randomControlBox.width &&
          randomImageBox.y + randomImageBox.height <=
            randomControlBox.y + randomControlBox.height,
        "Random operator approved PNG remains contained by its accessible control",
      );
      const originalOperator = originalQuestion.match(/[+\-−×÷]/)?.[0];
      assert.ok(
        originalOperator,
        "initial visible question has one public operator",
      );
      await page.evaluate(() => {
        Math.random = () => 0.99;
      });
      await hint.randomOperator.click();
      hint = await sc06Dialog(page);
      const replacementQuestion = await hint.dialog
        .locator("label[for='hint-answer']")
        .innerText();
      const replacementOperator = replacementQuestion.match(/[+\-−×÷]/)?.[0];
      assert.ok(
        replacementOperator &&
          ["+", "-", "−", "×", "÷"].includes(replacementOperator),
        "Random operator selects exactly one supported public operator",
      );
      assert.notEqual(
        replacementOperator,
        originalOperator,
        "the deterministic random sample selects a different public operator from the initial addition challenge",
      );
      assert.notEqual(
        replacementQuestion,
        originalQuestion,
        "Random operator replaces the active visible question identity",
      );
      assert.equal(
        await hint.answer.inputValue(),
        "",
        "a random replacement clears the prior answer input",
      );
      assert.equal(
        (await sc06RenderedReferences(hint.dialog)).some((reference) =>
          reference.source.includes("hint-popup-cat-thinking-640.png"),
        ),
        true,
        "a random replacement restores the desktop thinking state",
      );
      await hint.giveUp.click();
      assert.equal(
        await hint.randomOperator.isDisabled(),
        true,
        "Random operator freezes with the other challenge replacement controls after Give up",
      );
    },
  );
});

test("SC06: correct answer immediately replaces the cat behind one full 2,500ms fade, then starts the reward lifetime", async () => {
  await withSession(
    { width: 1440, height: 900 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const controls = await gameControls(page);
      await controls.hint.click();
      const hint = await sc06Dialog(page);
      const backdrop = hint.dialog.locator("xpath=../..");
      assert.equal(
        await backdrop.getAttribute("role"),
        "presentation",
        "the dialog is wrapped by its public presentation backdrop",
      );
      const answer = solveVisibleQuestion(
        await hint.dialog.locator("label[for='hint-answer']").innerText(),
      );
      const firstAwardCommit = page.evaluate(
        () =>
          new Promise((resolve) => {
            const observer = new MutationObserver(() => {
              const rewardCount = document.querySelectorAll(
                '[aria-label="New hint reward"]',
              ).length;
              const normalCatCount = document.querySelectorAll(
                "button[data-presentation-mode]",
              ).length;
              const vignette = document.querySelector(
                'aside[aria-hidden="true"]',
              );
              const desktopCatSource = vignette?.querySelector(
                'picture source[media="(min-width: 821px)"]',
              );
              const fallbackCat = vignette?.querySelector(
                'img[src*="hint-popup-cat-"]',
              );
              if (
                rewardCount !== 0 ||
                normalCatCount !== 0 ||
                !desktopCatSource
                  ?.getAttribute("srcset")
                  ?.includes("hint-popup-cat-happy-640.png") ||
                !fallbackCat
                  ?.getAttribute("src")
                  ?.includes("hint-popup-cat-success-1448.png")
              )
                return;
              observer.disconnect();
              resolve({
                rewardCount,
                normalCatCount,
                dialogCount:
                  document.querySelectorAll('[role="dialog"]').length,
                successCopyCount: [
                  ...document.querySelectorAll('aside[aria-hidden="true"]'),
                ].filter((element) =>
                  element.textContent?.includes(
                    "Great job! You earned a hint!",
                  ),
                ).length,
                initialPromptCount: [
                  ...document.querySelectorAll('aside[aria-hidden="true"]'),
                ].filter((element) =>
                  element.textContent?.includes(
                    "Solve this and I’ll give you a hint!",
                  ),
                ).length,
                desktopCatSourceSet: desktopCatSource.getAttribute("srcset"),
                fallbackCatSource: (() => {
                  const source = new URL(
                    fallbackCat.getAttribute("src") || "",
                    document.baseURI,
                  );
                  return source.searchParams.get("url") || source.pathname;
                })(),
              });
            });
            observer.observe(document.body, {
              childList: true,
              characterData: true,
              subtree: true,
            });
          }),
      );
      await hint.answer.fill(String(answer));
      await hint.check.click();
      const awardCommit = await firstAwardCommit;
      assert.deepEqual(
        awardCommit,
        {
          rewardCount: 0,
          normalCatCount: 0,
          dialogCount: 1,
          successCopyCount: 1,
          initialPromptCount: 0,
          desktopCatSourceSet: "/safe-cat/hint-popup-cat-happy-640.png",
          fallbackCatSource: "/safe-cat/hint-popup-cat-success-1448.png",
        },
        "the first public pending-success state removes the normal cat and prompt while keeping one happy success vignette",
      );
      assert.equal(
        (await sc06RenderedReferences(hint.dialog)).some((reference) =>
          reference.source.includes("hint-popup-cat-happy-640.png"),
        ),
        true,
        "correct answer immediately selects happy desktop cat",
      );
      const successBubble = await exact(
        hint.dialog.getByText("Great job! You earned a hint!", { exact: true }),
        "immediate success congratulation bubble",
      );
      assert.equal(
        await successBubble.evaluate(
          (element) => element.closest("aside[aria-hidden='true']") !== null,
        ),
        true,
        "success congratulation remains decorative inside the cat vignette",
      );
      assert.equal(
        await hint.dialog
          .getByText("Solve this and I’ll give you a hint!", { exact: true })
          .count(),
        0,
        "success congratulation replaces the normal cat bubble before fade begins",
      );
      assert.equal(
        await hint.check.isDisabled(),
        true,
        "success blocks duplicate Check submissions during its fade",
      );
      const disabledCheckMetrics = await hint.check.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          computed: Number.parseFloat(getComputedStyle(element).height),
          rendered: rect.height,
        };
      });
      const disabledDialogScale = await hint.dialog.evaluate(
        (element) => Number.parseFloat(getComputedStyle(element).scale) || 1,
      );
      assert.ok(
        disabledCheckMetrics.computed >= 60,
        "disabled Check retains at least a 60px computed height during success fade",
      );
      approximatelyEqual(
        disabledCheckMetrics.rendered,
        disabledCheckMetrics.computed * disabledDialogScale,
        1,
        "disabled Check rendered height follows the dialog scale during success fade",
      );
      const initialOpacity = await hint.dialog.evaluate(
        (element) => getComputedStyle(element).opacity,
      );
      await page.clock.runFor(2499);
      assert.equal(
        await hint.dialog.isVisible(),
        true,
        "dialog remains modal through 2,499ms of fade",
      );
      assert.equal(
        await backdrop.isVisible(),
        true,
        "presentation backdrop remains active through 2,499ms of the success fade",
      );
      assert.ok(
        Number(
          await hint.dialog.evaluate(
            (element) => getComputedStyle(element).opacity,
          ),
        ) <= Number(initialOpacity),
        "dialog opacity never rises during synchronized fade",
      );
      await page.clock.runFor(1);
      await hint.dialog.waitFor({ state: "hidden" });
      assert.equal(
        await backdrop.count(),
        0,
        "presentation backdrop unmounts with the dialog at 2,500ms",
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        "Show hint",
        "completion restores Show hint focus once",
      );
      const reward = await exact(
        page.getByLabel("New hint reward", { exact: true }),
        "same deferred reward presentation after dialog completion",
      );
      await expectRewardReplacement(page, "post-handoff reward replacement");
      await exact(
        page.getByRole("status").getByText(/Earned hint:/),
        "earned fact status after success handoff",
      );
      await page.clock.runFor(4999);
      assert.equal(
        await reward.isVisible(),
        true,
        "reward keeps its complete approximately five-second duration after close",
      );
      await page.clock.runFor(1);
      assert.equal(
        await reward.count(),
        0,
        "reward closes once after its full duration",
      );
    },
  );
});

test("SC06 P2: pending success keeps keyboard focus in the public math modal", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      await controls.hint.click();
      const hint = await sc06Dialog(page);
      const close = await exact(
        hint.dialog.getByRole("button", {
          name: "Close hint challenge",
          exact: true,
        }),
        "pending-success accessible close paw",
      );
      await hint.answer.fill(
        String(
          solveVisibleQuestion(
            await hint.dialog.locator("label[for='hint-answer']").innerText(),
          ),
        ),
      );
      await hint.check.click();
      await page.waitForFunction(
        () => document.querySelector("#hint-answer")?.disabled === true,
      );
      await exact(
        hint.dialog.getByText("Great job! You earned a hint!", { exact: true }),
        "pending-success public confirmation",
      );
      assert.equal(
        await hint.answer.isDisabled(),
        true,
        "a correct answer disables the public answer input during pending success",
      );
      assert.equal(
        await close.isEnabled(),
        true,
        "pending success retains the accessible close paw as a usable modal exit",
      );

      const gameNavigation = await exact(
        page.getByRole("navigation", {
          name: "Safe game controls",
          exact: true,
        }),
        "underlying Safe game controls navigation",
      );
      const underlyingControls = [
        controls.code,
        controls.submit,
        gameNavigation.getByRole("button", {
          name: "New game",
          exact: true,
        }),
        gameNavigation.getByRole("button", { name: "Give up", exact: true }),
        gameNavigation.getByRole("button", {
          name: "Show hint",
          exact: true,
        }),
        gameNavigation.getByRole("button", { name: "History", exact: true }),
      ];
      for (const control of underlyingControls)
        await exact(control, "one underlying Safe game controls action");
      const assertModalFocus = async (description) => {
        const [insideModal, underlyingActive] = await Promise.all([
          hint.dialog.evaluate((dialog) =>
            dialog.contains(document.activeElement),
          ),
          Promise.all(
            underlyingControls.map((control) =>
              control.evaluate((element) => element === document.activeElement),
            ),
          ),
        ]);
        assert.equal(
          insideModal,
          true,
          `${description} keeps keyboard focus inside the pending modal`,
        );
        assert.equal(
          underlyingActive.some(Boolean),
          false,
          `${description} does not move keyboard focus to an underlying game control`,
        );
      };

      const focusStartsOnClose = await close.evaluate(
        (element) => element === document.activeElement,
      );
      if (!focusStartsOnClose) {
        await page.keyboard.press("Tab");
        await assertModalFocus("the pending-success focus trap recovery Tab");
      }
      for (const key of ["Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
        await page.keyboard.press(key);
        await assertModalFocus(`pending-success ${key}`);
      }
      await close.click();
      await hint.dialog.waitFor({ state: "hidden" });
      assert.equal(
        await page.getByRole("dialog", {
          name: "Solve a quick math question",
          exact: true,
        }).count(),
        0,
        "early Close after public success unmounts the only hint dialog",
      );
      assert.equal(
        await controls.hint.evaluate(
          (element) => element === document.activeElement,
        ),
        true,
        "early Close after public success restores Show hint focus once",
      );
      await exact(
        page.getByLabel("New hint reward", { exact: true }),
        "early Close after public success keeps the fresh earned reward",
      );
    },
  );
});

test("SC06 Copilot P1: a late correct Check after Give up cannot freeze or award the abandoned challenge", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      await controls.hint.click();
      let hint = await sc06Dialog(page);
      await hint.answer.fill(
        String(
          solveVisibleQuestion(
            await hint.dialog.locator("label[for='hint-answer']").innerText(),
          ),
        ),
      );
      await hint.giveUp.click();
      await page.waitForFunction(
        () => document.querySelector("#hint-answer")?.disabled === true,
      );
      const staleSubmitWasPrevented = await hint.answer.evaluate((input) => {
        const form = input.closest("form");
        if (!form) return null;
        return form.dispatchEvent(
          new SubmitEvent("submit", { bubbles: true, cancelable: true }),
        );
      });
      assert.equal(
        staleSubmitWasPrevented,
        false,
        "the real abandoned answer form still routes its stale submit through the public onSubmit handler",
      );
      await page.waitForTimeout(100);

      assert.equal(
        await hint.dialog
          .getByText("Great job! You earned a hint!", { exact: true })
          .count(),
        0,
        "a delayed correct Check cannot promote an abandoned challenge to success",
      );
      assert.equal(
        await page
          .getByRole("status")
          .getByText(/Earned hint:/)
          .count(),
        0,
        "a delayed correct Check cannot publish an earned fact",
      );
      assert.equal(
        await page.getByLabel("New hint reward", { exact: true }).count(),
        0,
        "a delayed correct Check cannot create the reward presentation",
      );
      const close = await exact(
        hint.dialog.getByRole("button", {
          name: "Close hint challenge",
          exact: true,
        }),
        "abandoned challenge close control",
      );
      assert.equal(
        await hint.dialog.isVisible(),
        true,
        "abandoned challenge remains an open dialog",
      );
      assert.equal(
        await close.isEnabled(),
        true,
        "abandoned challenge remains closable",
      );
      assert.equal(
        await hint.newQuestion.isEnabled(),
        true,
        "abandoned challenge retains New question instead of freezing",
      );

      await hint.newQuestion.click();
      hint = await sc06Dialog(page);
      assert.equal(
        await hint.answer.isEnabled(),
        true,
        "New question restores an answerable challenge",
      );
      assert.equal(
        await hint.check.isEnabled(),
        true,
        "New question restores Check",
      );
      assert.equal(
        await hint.dialog
          .getByText("Great job! You earned a hint!", { exact: true })
          .count(),
        0,
        "the replacement challenge does not inherit stale success presentation",
      );
      await hint.dialog
        .getByRole("button", { name: "Close hint challenge", exact: true })
        .click();
      await hint.dialog.waitFor({ state: "hidden" });
    },
  );
});

test("SC06 Copilot: programmatic submits cannot replace active-abandoned or inactive-success presentation state", async () => {
  const dispatchSubmit = async (input) =>
    input.evaluate((element) => {
      const form = element.closest("form");
      if (!form) return null;
      return form.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true }),
      );
    });
  const setDisabledInputValue = async (input, value) =>
    input.evaluate((element, nextValue) => {
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!nativeValueSetter) return null;
      nativeValueSetter.call(element, nextValue);
      element.dispatchEvent(
        new Event("input", { bubbles: true, cancelable: true }),
      );
      return element.value;
    }, value);

  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      await controls.hint.click();
      const abandoned = await sc06Dialog(page);
      await abandoned.answer.fill("0");
      await abandoned.giveUp.click();
      await abandoned.answer.waitFor({ state: "attached" });
      assert.equal(
        await abandoned.answer.isDisabled(),
        true,
        "active abandoned state disables the public answer input before a stale form submit",
      );
      const staleSubmitWasPrevented = await dispatchSubmit(abandoned.answer);
      assert.equal(
        staleSubmitWasPrevented,
        false,
        "the real active-abandoned form routes a synthetic submit through public onSubmit handling",
      );
      await page.waitForTimeout(100);
      assert.equal(
        await abandoned.dialog
          .locator('img[src*="hint-popup-cat-sad-give-up-1448.png"]')
          .count(),
        1,
        "a stale wrong submit cannot replace the active-abandoned sad cat",
      );
      assert.equal(
        await abandoned.dialog
          .locator('img[src*="hint-popup-cat-encouraging-1448.png"]')
          .count(),
        0,
        "a stale wrong submit cannot present retry concern art over active abandonment",
      );
      assert.equal(
        await abandoned.answer.getAttribute("aria-invalid"),
        null,
        "a stale wrong submit cannot restore retry-invalid state after active abandonment",
      );
      await abandoned.dialog
        .getByRole("button", {
          name: "Close hint challenge",
          exact: true,
        })
        .click();
      await abandoned.dialog.waitFor({ state: "hidden" });

      await controls.hint.click();
      const successful = await sc06Dialog(page);
      await successful.answer.fill(
        String(
          solveVisibleQuestion(
            await successful.dialog
              .locator("label[for='hint-answer']")
              .innerText(),
          ),
        ),
      );
      await successful.check.click();
      const successCopy = successful.dialog.getByText(
        "Great job! You earned a hint!",
        { exact: true },
      );
      await page.waitForFunction(
        () => document.querySelector("#hint-answer")?.disabled === true,
      );
      await successCopy.waitFor({ state: "attached" });
      await exact(
        successCopy,
        "inactive success presentation before its stale synthetic submit",
      );
      assert.equal(
        await successCopy.evaluate(
          (element) => element.closest("aside[aria-hidden='true']") !== null,
        ),
        true,
        "inactive success remains decorative rather than becoming a live announcement",
      );
      assert.equal(
        await successful.answer.isDisabled(),
        true,
        "inactive success disables the public answer input before its stale form submit",
      );
      assert.equal(
        await setDisabledInputValue(successful.answer, "0"),
        "0",
        "the inactive success input receives the public wrong stale value before submit",
      );
      await page.waitForTimeout(0);
      const successSubmitWasPrevented = await dispatchSubmit(successful.answer);
      assert.equal(
        successSubmitWasPrevented,
        false,
        "the real inactive-success form routes a synthetic submit through public onSubmit handling",
      );
      await page.waitForTimeout(100);
      assert.equal(
        await successful.dialog
          .getByText("Great job! You earned a hint!", { exact: true })
          .count(),
        1,
        "a synthetic submit cannot replace the public inactive-success presentation",
      );
      assert.equal(
        await successful.dialog
          .locator('img[src*="hint-popup-cat-success-1448.png"]')
          .count(),
        1,
        "a synthetic submit cannot replace the inactive-success happy cat",
      );
      assert.equal(
        await successful.answer.getAttribute("aria-invalid"),
        null,
        "an inactive-success submit cannot introduce retry-invalid state",
      );
    },
  );
});

test("SC07 Copilot P2: an initially hidden document pauses presentation deadlines until first visibility", async () => {
  await withSession(
    { width: 1024, height: 768 },
    {
      clockStart: fixedClockStart,
      beforeGoto: async (page) => {
        await page.clock.pauseAt(fixedClockStart);
        await page.addInitScript(() => {
          let hidden = true;
          Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
          Object.defineProperty(document, "visibilityState", { configurable: true, get: () => hidden ? "hidden" : "visible" });
          globalThis.__safeCatRevealDocument = () => {
            hidden = false;
            document.dispatchEvent(new Event("visibilitychange"));
          };
        });
      },
    },
    async ({ page }) => {
      await page.clock.runFor(30_000);
      await ordinaryOwner(page, "PLAYING", "initially hidden mount before first visibility");
      await page.evaluate(() => globalThis.__safeCatRevealDocument());
      await page.clock.runFor(0);
      await page.clock.runFor(15_000);
      await ordinaryOwner(page, "PLAYING", "first visible interval preserves its full idle deadline");
      await page.clock.runFor(1);
      await ordinaryOwner(page, "LONG_IDLE", "first visible idle deadline begins after reconciliation");
    },
  );
});

test("SC06 Copilot P2: visibility reconciliation keeps one absolute concern deadline and cancels replaced callbacks", async () => {
  await withSession(
    { width: 1024, height: 768 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const controls = await gameControls(page);
      await controls.hint.click();
      let hint = await sc06Dialog(page);
      const concerned = () =>
        hint.dialog.locator('img[src*="hint-popup-cat-encouraging-1448.png"]');
      const reconcileVisibility = () =>
        page.evaluate(() =>
          document.dispatchEvent(new Event("visibilitychange")),
        );

      for (const elapsed of [2_000, 2_000, 2_000]) {
        await page.clock.runFor(elapsed);
        await reconcileVisibility();
      }
      await page.clock.runFor(3_999);
      assert.equal(
        await concerned().count(),
        0,
        "repeated visibility reconciliations do not shorten the unresolved challenge deadline",
      );
      await page.clock.runFor(1);
      await concerned().waitFor({ state: "visible" });
      assert.equal(
        await concerned().count(),
        1,
        "one absolute 10,000ms deadline reaches exactly one public concerned cat",
      );
      assert.equal(
        await page
          .getByRole("dialog", {
            name: "Solve a quick math question",
            exact: true,
          })
          .count(),
        1,
        "one deadline reconciliation never duplicates the public dialog",
      );

      await hint.newQuestion.click();
      hint = await sc06Dialog(page);
      await page.clock.runFor(5_000);
      await hint.newQuestion.click();
      hint = await sc06Dialog(page);
      await page.clock.runFor(5_000);
      assert.equal(
        await concerned().count(),
        0,
        "the abandoned replacement deadline cannot turn a newer challenge concerned",
      );
      assert.equal(
        await page
          .getByRole("dialog", {
            name: "Solve a quick math question",
            exact: true,
          })
          .count(),
        1,
        "stale deadline callbacks do not duplicate or close the replacement dialog",
      );
      await page.clock.runFor(4_999);
      assert.equal(
        await concerned().count(),
        0,
        "the replacement keeps its own absolute deadline after stale callbacks expire",
      );
      await page.clock.runFor(1);
      await concerned().waitFor({ state: "visible" });
      assert.equal(
        await concerned().count(),
        1,
        "the replacement reaches one concerned state only at its own 10,000ms deadline",
      );
    },
  );
});

test("SC06: every rendered decorative cat image disables native browser dragging across normal, challenge, and reward states", async () => {
  await withSession(
    { width: 1440, height: 900 },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const controls = await gameControls(page);
      await assertNativeDraggingDisabled(
        controls.cat.locator("img"),
        "normal CatAvatar",
      );

      await controls.hint.click();
      const hint = await sc06Dialog(page);
      await assertNativeDraggingDisabled(
        hint.dialog.locator('img[src*="hint-popup-cat-"]'),
        "active hint-challenge vignette cat",
      );

      const answer = solveVisibleQuestion(
        await hint.dialog.locator("label[for='hint-answer']").innerText(),
      );
      await hint.answer.fill(String(answer));
      await hint.check.click();
      await exact(
        hint.dialog.getByText("Great job! You earned a hint!", { exact: true }),
        "committed success copy before the reward handoff",
      );
      await page.clock.runFor(2500);
      await hint.dialog.waitFor({ state: "hidden" });
      const reward = await exact(
        page.getByLabel("New hint reward", { exact: true }),
        "earned reward presentation",
      );
      await assertNativeDraggingDisabled(
        reward.locator('img[src*="cat-hint-reward-lying-1448.png"]'),
        "earned reward cat",
      );
    },
  );
});

test("SC06: every rendered ordinary-popup image suppresses selection and native dragging", async () => {
  await withSession(
    { width: 1024, height: 768 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      await controls.hint.click();
      const hint = await sc06Dialog(page);
      const images = await hint.dialog.locator("img").evaluateAll((elements) =>
        elements
          .filter((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              box.width > 0 &&
              box.height > 0
            );
          })
          .map((image) => {
            const style = getComputedStyle(image);
            return {
              source: image.currentSrc || image.src,
              userSelect: style.userSelect,
              webkitUserDrag: style.webkitUserDrag,
              draggable: image.draggable,
            };
          }),
      );
      assert.ok(
        images.length > 0,
        "ordinary popup renders visible imagery before testing selection suppression",
      );
      for (const filename of [
        "hint-popup-close-paw-128.png",
        "hint-popup-calculator-320.png",
        "hint-popup-lamp-320.png",
        "hint-popup-cat-thinking-640.png",
        "operator-add-256.png",
      ])
        assert.equal(
          images.some((image) => image.source.includes(filename)),
          true,
          `ordinary popup includes representative ${filename} imagery`,
        );
      for (const image of images) {
        assert.equal(
          image.userSelect,
          "none",
          `ordinary popup image suppresses text/image selection: ${image.source}`,
        );
        assert.ok(
          image.webkitUserDrag === "none" || image.draggable === false,
          `ordinary popup image suppresses native drag through its effective browser property: ${image.source}`,
        );
      }
    },
  );
});

test("SC06: Escape can finish success early, while reduced motion keeps the success frame static for the same 2,500ms interval", async () => {
  for (const reduced of [false, true])
    await withSession(
      { width: 390, height: 844 },
      { random: 0.041, clockStart: fixedClockStart },
      async ({ page }) => {
        await pauseClockAtCurrentTime(page);
        if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        await hint.answer.fill(
          String(
            solveVisibleQuestion(
              await hint.dialog.locator("label[for='hint-answer']").innerText(),
            ),
          ),
        );
        await hint.check.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
        await exact(
          hint.dialog.getByText("Great job! You earned a hint!", {
            exact: true,
          }),
          `${reduced ? "reduced-motion" : "ordinary"} committed success presentation`,
        );
        const opacity = await hint.dialog.evaluate(
          (element) => getComputedStyle(element).opacity,
        );
        if (reduced) {
          await page.clock.runFor(2499);
          assert.equal(
            await hint.dialog.evaluate(
              (element) => getComputedStyle(element).opacity,
            ),
            opacity,
            "reduced motion keeps the success composite static during the interval",
          );
          await page.clock.runFor(1);
          await hint.dialog.waitFor({ state: "hidden" });
        } else {
          await page.keyboard.press("Escape");
          await hint.dialog.waitFor({ state: "hidden" });
          await exact(
            page.getByLabel("New hint reward", { exact: true }),
            "Escape starts the matching deferred reward without changing the earned fact",
          );
        }
      },
    );
});

test("SC06: reward replaces the normal cat without shrinking its safe-top anchor or covering protected game content", async () => {
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [390, 844],
  ])
    await withSession(
      { width, height },
      { random: 0.041, clockStart: fixedClockStart },
      async ({ page }) => {
        await pauseClockAtCurrentTime(page);
        const controls = await gameControls(page);
        const safe = page.getByLabel("Safe closed", { exact: true });
        const [normalCat, safeAlpha, titleBefore, subtitleBefore] =
          await Promise.all([
            visibleAlphaBounds(page, controls.cat),
            visibleAlphaBounds(page, safe),
            page
              .getByRole("heading", { name: "Guess the number", exact: true })
              .boundingBox(),
            controls.instruction.boundingBox(),
          ]);
        const initialScrollY = await page.evaluate(() => scrollY);
        const toDocumentCoordinates = (box, scrollOffset) => ({
          ...box,
          y: box.y + scrollOffset,
        });
        const normalCatDocument = toDocumentCoordinates(
          normalCat,
          initialScrollY,
        );
        const safeDocument = toDocumentCoordinates(safeAlpha, initialScrollY);
        const titleBeforeDocument = toDocumentCoordinates(
          titleBefore,
          initialScrollY,
        );
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        await hint.answer.fill(
          String(
            solveVisibleQuestion(
              await hint.dialog.locator("label[for='hint-answer']").innerText(),
            ),
          ),
        );
        await hint.check.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
        await exact(
          hint.dialog.getByText("Great job! You earned a hint!", {
            exact: true,
          }),
          `${width}x${height} committed reward success presentation`,
        );
        await page.keyboard.press("Escape");
        await hint.dialog.waitFor({ state: "hidden" });
        const reward = await exact(
          page.getByLabel("New hint reward", { exact: true }),
          `${width}x${height} reward replacement`,
        );
        await expectRewardReplacement(page, `${width}x${height} reward slot ownership`);
        const rewardComposite = await exact(
          reward.locator('img[src*="cat-hint-reward-lying-1448.png"][alt=""]'),
          `${width}x${height} approved composite cat-with-lamp reward artwork`,
        );
        const rewardEnvelope = await visibleAlphaBounds(page, rewardComposite);
        const postDialogScrollY = await page.evaluate(() => scrollY);
        const rewardEnvelopeDocument = toDocumentCoordinates(
          rewardEnvelope,
          postDialogScrollY,
        );
        assert.ok(
          rewardEnvelope.height >= normalCat.height * 0.9 &&
            rewardEnvelope.width >= normalCat.width * 0.75,
          `${width}x${height} reward envelope does not visually shrink the normal cat presentation: normal=${JSON.stringify(normalCat)}, reward=${JSON.stringify(rewardEnvelope)}`,
        );
        if (width >= 1280 && height > 600)
          approximatelyEqual(
            rewardEnvelopeDocument.y + rewardEnvelopeDocument.height,
            normalCatDocument.y + normalCatDocument.height,
            Math.max(18, normalCat.height * 0.18),
            `${width}x${height} large-tall reward preserves the approved ordinary anchor`,
          );
        const safeGap = safeDocument.y -
          (rewardEnvelopeDocument.y + rewardEnvelopeDocument.height);
        assert.ok(
          safeGap >= -28 && safeGap <= 8,
          `${width}x${height} lying reward visibly rests across the painted safe edge: ${safeGap}px`,
        );
        const factBubble = await exact(
          reward.locator("p"),
          `${width}x${height} reward fact bubble`,
        );
        const [bubbleBox, titleAfter, subtitleAfter, formBox] =
          await Promise.all([
            factBubble.boundingBox(),
            page
              .getByRole("heading", { name: "Guess the number", exact: true })
              .boundingBox(),
            controls.instruction.boundingBox(),
            controls.code.boundingBox(),
          ]);
        const bubbleDocument = toDocumentCoordinates(
          bubbleBox,
          postDialogScrollY,
        );
        const titleAfterDocument = toDocumentCoordinates(
          titleAfter,
          postDialogScrollY,
        );
        const subtitleAfterDocument = toDocumentCoordinates(
          subtitleAfter,
          postDialogScrollY,
        );
        const formDocument = toDocumentCoordinates(formBox, postDialogScrollY);
        const comic = await factBubble.evaluate((element) => {
          const style = getComputedStyle(element);
          const tail = getComputedStyle(element, "::after");
          return {
            radius: Number.parseFloat(style.borderTopLeftRadius),
            background: style.backgroundColor,
            tail: tail.content,
            tailWidth: Number.parseFloat(tail.width),
            tailHeight: Number.parseFloat(tail.height),
          };
        });
        assert.ok(
          comic.radius >= 14 &&
            comic.background !== "rgba(0, 0, 0, 0)" &&
            comic.tail !== "none" &&
            comic.tailWidth > 0 &&
            comic.tailHeight > 0,
          `${width}x${height} reward fact uses a rounded comic dialog bubble with visible tail`,
        );
        for (const [name, protectedBox] of Object.entries({
          title: titleAfterDocument,
          subtitle: subtitleAfterDocument,
          safe: safeDocument,
          form: formDocument,
        }))
          assert.equal(
            intersects(bubbleDocument, protectedBox, 8),
            false,
            `${width}x${height} elevated reward bubble avoids ${name}: bubble=${JSON.stringify(bubbleDocument)}, protected=${JSON.stringify(protectedBox)}`,
          );
        await page.evaluate(() => scrollTo(0, 0));
        const [titleRewardViewport, subtitleRewardViewport] = await Promise.all(
          [
            page
              .getByRole("heading", {
                name: "Guess the number",
                exact: true,
              })
              .boundingBox(),
            controls.instruction.boundingBox(),
          ],
        );
        for (const [state, title, subtitle] of [
          ["before", titleBefore, subtitleBefore],
          ["reward", titleRewardViewport, subtitleRewardViewport],
        ]) {
          assert.ok(
            title.y >= 0 &&
              title.y + title.height <= height &&
              subtitle.y >= 0 &&
              subtitle.y + subtitle.height <= height,
            `${width}x${height} ${state} title and subtitle remain fully visible: title=${JSON.stringify(title)}, subtitle=${JSON.stringify(subtitle)}`,
          );
          if (width > 600)
            assert.ok(
              title.y <= height * 0.2,
              `${width}x${height} ${state} title stays consistently raised above the scene`,
            );
        }
        approximatelyEqual(
          titleAfterDocument.y,
          titleBeforeDocument.y,
          2,
          `${width}x${height} title does not jump between normal and reward states`,
        );
        await page.clock.runFor(4999);
        assert.equal(
          await reward.isVisible(),
          true,
          `${width}x${height} reward lasts through 4,999ms`,
        );
        await page.clock.runFor(1);
        assert.equal(
          await reward.count(),
          0,
          `${width}x${height} reward expires exactly at 5,000ms`,
        );
        await expectOrdinaryReturn(page, "PLAYING", true, `${width}x${height} reward expiry`);
      },
    );
});

test("SC06: dense narrow widths retain one continuous safe-top anchor for the ordinary and reward cats", async () => {
  const widths = [
    600, 575, 550, 530, 529, 520, 480, 420, 391, 390, 350, 321, 320,
  ];
  const idleAnchors = [];
  const rewardAnchors = [];
  const inspectAnchor = async (
    page,
    label,
    cat,
    safe,
    subtitle,
    form,
    menu,
    width,
    height,
  ) => {
    const [catAlpha, safeAlpha, subtitleBox, formBox, menuBox] =
      await Promise.all([
        visibleAlphaBounds(page, cat),
        visibleAlphaBounds(page, safe),
        subtitle.boundingBox(),
        form.boundingBox(),
        menu.boundingBox(),
      ]);
    for (const [name, box] of Object.entries({
      catAlpha,
      safeAlpha,
      subtitleBox,
      formBox,
      menuBox,
    }))
      assert.ok(
        box && box.width > 0 && box.height > 0,
        `${width}x${height} ${label} ${name} renders`,
      );
    const anchor = paintedCatSafeGap(catAlpha, safeAlpha);
    assert.ok(
      anchor >= -8 && anchor <= 8,
      `${width}x${height} ${label} painted cat-to-safe gap ${anchor}px remains in the approved -8..8px contact band`,
    );
    const titleBox = await page
      .getByRole("heading", { name: "Guess the number", exact: true })
      .boundingBox();
    assertPaintedHeaderClearance({
      catAlpha,
      title: titleBox,
      subtitle: subtitleBox,
      width,
      height,
      description: `${width}x${height} ${label} art`,
    });
    assert.equal(
      intersects(catAlpha, formBox, 0),
      false,
      `${width}x${height} ${label} cat remains clear of the form`,
    );
    assert.equal(
      intersects(catAlpha, menuBox, 0),
      false,
      `${width}x${height} ${label} cat remains clear of the menu`,
    );
    assert.ok(
      catAlpha.x >= 0 &&
        catAlpha.y >= 0 &&
        catAlpha.x + catAlpha.width <= width &&
        catAlpha.y + catAlpha.height <= height,
      `${width}x${height} ${label} cat remains inside the viewport`,
    );
    return anchor;
  };
  for (const width of widths)
    await withSession(
      { width, height: 919 },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        const safe = page.getByLabel("Safe closed", { exact: true });
        const menu = controls.newRound.locator("xpath=..");
        idleAnchors.push({
          width,
          anchor: await inspectAnchor(
            page,
            "idle",
            controls.cat,
            safe,
            controls.instruction,
            controls.code,
            menu,
            width,
            919,
          ),
        });
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        await hint.answer.fill(
          String(
            solveVisibleQuestion(
              await hint.dialog.locator("label[for='hint-answer']").innerText(),
            ),
          ),
        );
        await hint.check.click();
        await page.keyboard.press("Escape");
        await hint.dialog.waitFor({ state: "hidden" });
        const reward = await exact(
          page.getByLabel("New hint reward", { exact: true }),
          `${width}x919 reward slot`,
        );
        const rewardCat = await exact(
          reward.locator('img[src*="cat-hint-reward-lying-1448.png"][alt=""]'),
          `${width}x919 reward cat artwork`,
        );
        rewardAnchors.push({
          width,
          anchor: await inspectAnchor(
            page,
            "reward",
            rewardCat,
            safe,
            controls.instruction,
            controls.code,
            menu,
            width,
            919,
          ),
        });
      },
    );
  for (const anchors of [idleAnchors, rewardAnchors]) {
    for (let index = 1; index < anchors.length; index += 1)
      if (Math.abs(anchors[index].width - anchors[index - 1].width) <= 1)
        assert.ok(
          Math.abs(anchors[index].anchor - anchors[index - 1].anchor) <= 2,
          `${anchors[index - 1].width}/${anchors[index].width}px ${anchors === idleAnchors ? "idle" : "reward"} safe-top anchor has no breakpoint jump above 2px`,
        );
  }
  for (const { width, anchor } of rewardAnchors)
    approximatelyEqual(
      anchor,
      idleAnchors.find((sample) => sample.width === width).anchor,
      2,
      `${width}px reward retains the ordinary cat safe-top anchor`,
    );
});

test("SC06: fullscreen narrow modal keeps fallback overflow inactive and does not create page scrolling", async () => {
  await withSession(
    { width: 320, height: 568 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      await controls.hint.click();
      const hint = await sc06Dialog(page);
      const [shellBox, protectedHeader] = await Promise.all([
        hint.dialog.locator("xpath=..").boundingBox(),
        page.getByRole("heading", { name: "Guess the number", exact: true }).boundingBox(),
      ]);
      assert.ok(
        shellBox &&
          shellBox.x <= 1 && shellBox.y <= 1 &&
          shellBox.x + shellBox.width >= 319 && shellBox.y + shellBox.height >= 567,
        "fullscreen narrow backdrop intercepts the complete visual viewport",
      );
      const dialogBox = await hint.dialog.boundingBox();
      assert.ok(
        dialogBox.y >= protectedHeader.y + protectedHeader.height + 8,
        "short narrow dialog begins after the protected header lane",
      );
      const internalScroll = await hint.dialog.evaluate((element) => {
        element.scrollTop = 0;
        const origin = element.scrollTop;
        element.scrollTop = element.scrollHeight;
        return {
          origin,
          changed: element.scrollTop,
          overflowY: getComputedStyle(element).overflowY,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      });
      assert.ok(
        internalScroll.scrollHeight >= internalScroll.clientHeight &&
          internalScroll.changed === internalScroll.scrollHeight - internalScroll.clientHeight,
        "fullscreen narrow dialog reaches its bounded scroll maximum when needed and remains exact when fitting",
      );
      await hint.dialog.evaluate((element) => {
        element.scrollTop = 0;
      });
      const [checkBox, operatorBox, laneBox] = await Promise.all([
        hint.check.boundingBox(),
        hint.dialog.getByLabel("Choose a math operation", { exact: true }).boundingBox(),
        hint.dialog.boundingBox(),
      ]);
      await hint.dialog.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      const [newQuestionBox, giveUpBox, closeBox] = await Promise.all([
        hint.newQuestion.boundingBox(),
        hint.giveUp.boundingBox(),
        hint.dialog.getByRole("button", { name: "Close hint challenge", exact: true }).boundingBox(),
      ]);
      assert.ok(
        [checkBox, operatorBox, newQuestionBox, giveUpBox, closeBox].every(
          (box) => box && box.y >= laneBox.y && box.y + box.height <= laneBox.y + laneBox.height,
        ),
        "internal scrolling leaves Check, operators, New question, Give up, and Close reachable",
      );
      const lockBefore = await page.evaluate(() => ({
        bodyOverflowY: getComputedStyle(document.body).overflowY,
        documentOverflowY: getComputedStyle(document.documentElement).overflowY,
        scrollY,
      }));
      await page.keyboard.press("End");
      await page.mouse.wheel(0, 1_000);
      const lockAfter = await page.evaluate(() => ({
        bodyOverflowY: getComputedStyle(document.body).overflowY,
        documentOverflowY: getComputedStyle(document.documentElement).overflowY,
        scrollY,
      }));
      assert.deepEqual(
        [lockBefore.bodyOverflowY, lockBefore.documentOverflowY],
        ["hidden", "hidden"],
        "short fullscreen modal locks body and document scrolling even when DOM extent exceeds the viewport",
      );
      assert.deepEqual(
        lockAfter,
        lockBefore,
        "End and wheel cannot activate page scrolling under the modal lock",
      );
      await hint.dialog
        .getByRole("button", { name: "Close hint challenge", exact: true })
        .click();
      await hint.dialog.waitFor({ state: "hidden" });
    },
  );
});

test("SC06: closing a short-tablet dialog restores its nonzero pre-open page scroll", async () => {
  await withSession(
    { width: 1024, height: 600 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      await controls.hint.scrollIntoViewIfNeeded();
      const [preOpenScrollY, hintBox] = await Promise.all([
        page.evaluate(() => scrollY),
        controls.hint.boundingBox(),
      ]);
      assert.ok(
        preOpenScrollY > 0,
        "short-tablet fixture exposes a nonzero page position before the modal opens",
      );
      assert.ok(
        hintBox &&
          hintBox.x >= 0 &&
          hintBox.y >= 0 &&
          hintBox.x + hintBox.width <= 1024 &&
          hintBox.y + hintBox.height <= 600,
        "the pointer opens the dialog from the already visible Show hint control",
      );
      await page.mouse.click(
        hintBox.x + hintBox.width / 2,
        hintBox.y + hintBox.height / 2,
      );
      const hint = await sc06Dialog(page);
      const captureLock = () =>
        page.evaluate(() => {
          const bodyStyle = getComputedStyle(document.body);
          return {
            bodyOverflowY: bodyStyle.overflowY,
            bodyPosition: bodyStyle.position,
            bodyTop: Number.parseFloat(bodyStyle.top),
            bodyVisualTop: document.body.getBoundingClientRect().top,
            documentOverflowY: getComputedStyle(document.documentElement)
              .overflowY,
          };
        });
      const lock = await captureLock();
      assert.deepEqual(
        {
          bodyOverflowY: lock.bodyOverflowY,
          bodyPosition: lock.bodyPosition,
          documentOverflowY: lock.documentOverflowY,
        },
        {
          bodyOverflowY: "hidden",
          bodyPosition: "fixed",
          documentOverflowY: "hidden",
        },
        "opening from a nonzero position installs the document scroll lock",
      );
      approximatelyEqual(
        lock.bodyTop,
        -preOpenScrollY,
        1,
        "the fixed body top retains the nonzero pre-open document offset",
      );
      approximatelyEqual(
        lock.bodyVisualTop,
        lock.bodyTop,
        1,
        "the fixed body visibly occupies its preserved negative offset",
      );
      await page.keyboard.press("End");
      await page.mouse.wheel(0, 1_000);
      assert.deepEqual(
        await captureLock(),
        lock,
        "End and wheel leave the fixed-body lock representation and visual offset unchanged",
      );
      await hint.dialog
        .getByRole("button", { name: "Close hint challenge", exact: true })
        .click();
      await hint.dialog.waitFor({ state: "hidden" });
      assert.equal(
        await page.evaluate(() => scrollY),
        preOpenScrollY,
        "closing restores the exact nonzero page position that was locked",
      );
    },
  );
});
}

module.exports = { register01 };
