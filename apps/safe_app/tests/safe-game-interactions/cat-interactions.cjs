const assert = require("node:assert/strict");
const test = require("node:test");
const { withSession } = require("./shared/session.cjs");
const { runtimeBaseUrl: baseUrl, fixedClockStart } = require("./shared/runtime-context.cjs");
const { visibleAlphaBounds } = require("./shared/readiness.cjs");
const { pauseClockAtCurrentTime, exact, ordinaryOwner, expectOrdinaryReturn, gameControls, approximatelyEqual } = require("./shared/game-controls.cjs");
const { ordinaryArt, exactHiddenChild, visibleDialAngle, publicAssetPresentation, clickVisibleArtwork, assertPaintedHeaderClearance, logicalBox } = require("./shared/artwork-geometry.cjs");

function register01() {


test("SC07: public ordinary cat states map their timed, attention, and terminal modes to approved contained artwork", async () => {
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [390, 844],
    [844, 390],
  ])
    await withSession(
    { width, height },
    { random: 0.041, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await gameControls(page);
      await pauseClockAtCurrentTime(page);
      const expected = [
        ["PLAYING", "cat-playing-800.webp", [272, 272]],
        ["PET_NORMAL", "cat-pet-hover-800.webp", [272, 272]],
        ["PET_PROMPT", "cat-pet-prompt-800.webp", [272, 272]],
        ["PET_PROMPT_SUCCESS", "cat-pet-success-800.webp", [272, 272]],
        ["PET_MISSED", "cat-long-idle-800.webp", [272, 272]],
        ["LONG_IDLE", "cat-long-idle-800.webp", [272, 272]],
        ["HINT_ATTENTION", "cat-hint-attention-800.webp", [272, 272]],
        ["WRONG", "cat-wrong-800.webp", [272, 272]],
        ["WON", "cat-won-800.webp", [272, 272]],
        ["SURRENDERED", "cat-surrendered-800.webp", [272, 272]],
      ];
      const inspect = async (mode, asset, dimensions) => {
        const cat = await ordinaryArt(page, mode, asset, `${mode} public state`);
        const box = await logicalBox(cat);
        if (width === 1440 && height === 900)
          assert.deepEqual(
            [Math.round(box.width), Math.round(box.height)],
            dimensions,
            `${mode} keeps its approved desktop logical scene box before stage scale`,
          );
        else
          assert.ok(
            box.width > 0 && box.height > 0,
            `${width}x${height} ${mode} retains a measurable logical scene box`,
          );
        const presentation = await publicAssetPresentation(cat);
        assert.match(
          presentation.reference,
          new RegExp(asset),
          `${mode} loads its exact approved derivative`,
        );
        assert.equal(
          presentation.fit,
          "contain",
          `${mode} never crops the character`,
        );
        const [catAlpha, title, subtitle] = await Promise.all([
          visibleAlphaBounds(page, cat),
          page
            .getByRole("heading", { name: "Guess the number", exact: true })
            .boundingBox(),
          controls.instruction.boundingBox(),
        ]);
        assertPaintedHeaderClearance({
          catAlpha,
          title,
          subtitle,
          width,
          height,
          description: `${width}x${height} ${mode} timed-state art`,
        });
      };
      await inspect(...expected[0]);
      await clickVisibleArtwork(page, controls.cat);
      await inspect(...expected[1]);
      await page.clock.runFor(1200);
      await page.clock.runFor(15_001);
      await inspect(...expected[5]);
      await page.clock.runFor(15_000);
      await inspect(...expected[2]);
      await exact(
        page.locator("[data-pet-prompt]"),
        "timed PET_PROMPT visible Pet me activation",
      );
      await page.locator("[data-pet-prompt]").click();
      await inspect(...expected[3]);
      await page.clock.runFor(4000);
      await controls.newRound.click();
      await page.clock.runFor(15_001);
      await inspect(...expected[5]);
      await page.clock.runFor(15_000);
      await page.clock.runFor(5000);
      await inspect(...expected[4]);
      await page.clock.runFor(5000);
      await inspect(...expected[0]);
      await page.clock.runFor(15_001);
      await inspect(...expected[5]);
      await controls.hint.hover();
      await inspect(...expected[6]);
      await page.mouse.move(0, 0);
      await controls.code.fill("41");
      await controls.submit.click();
      await inspect(...expected[7]);
      await controls.newRound.click();
      await controls.code.fill("42");
      await controls.submit.click();
      await inspect(...expected[8]);
      await controls.newRound.click();
      await controls.surrender.click();
      await inspect(...expected[9]);
      assert.equal(
        await controls.code.isDisabled(),
        true,
        "terminal Safe code input retains native disabled semantics",
      );
      assert.equal(
        await controls.submit.isDisabled(),
        true,
        "terminal code submission is unavailable with the input",
      );
      assert.equal(
        await controls.code.getAttribute("placeholder"),
        "",
        "terminal Safe code input no longer invites entry with placeholder copy",
      );
      assert.equal(
        await page.getByPlaceholder("Enter a number...", { exact: true }).count(),
        0,
        "terminal screen exposes no editable-entry invitation",
      );
      const terminalInputStyle = await controls.code.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        border: getComputedStyle(element).borderColor,
        cursor: getComputedStyle(element).cursor,
      }));
      assert.notDeepEqual(
        terminalInputStyle,
        { background: "rgb(255, 255, 255)", border: "rgb(233, 229, 240)", cursor: "text" },
        "terminal code input visibly differs from the enabled entry control",
      );
    },
  );
  let interceptedIdleOptimizerRequests = 0;
  const isIdleOptimizerRequest = (url) => {
    let requestUrl;
    try {
      requestUrl = new URL(url);
    } catch {
      return false;
    }
    return (
      requestUrl.origin === new URL(baseUrl).origin &&
      requestUrl.pathname === "/_next/image" &&
      requestUrl.searchParams.get("url") === "/safe-cat/cat-playing-800.webp"
    );
  };
  await withSession(
    { width: 390, height: 844 },
    {
      beforeGoto: async (page) =>
        page.route("**/_next/image?*", (route) => {
          if (isIdleOptimizerRequest(route.request().url())) {
            interceptedIdleOptimizerRequests += 1;
            return route.abort();
          }
          return route.continue();
        }),
      isExpectedLocalFailure: isIdleOptimizerRequest,
      isExpectedConsoleFailure: (message) =>
        interceptedIdleOptimizerRequests > 0 &&
        message === "Failed to load resource: net::ERR_FAILED",
    },
    async ({ page }) => {
      const fallback = await ordinaryOwner(page, "PLAYING", "failed-asset fallback owner");
      const box = await logicalBox(fallback);
      assert.ok(
        interceptedIdleOptimizerRequests >= 1,
        "the selected idle Next/Image optimizer request is actually intercepted",
      );
      assert.deepEqual(
        [Math.round(box.width), Math.round(box.height)],
        [224, 224],
        "failed idle asset preserves the approved mobile logical scene box",
      );
      assert.equal(
        await fallback.isVisible(),
        true,
        "a failed primary asset retains the labelled cat scene instead of removing it",
      );
    },
  );
});

test("SC05 D04: each accepted public input edit advances only the decorative dial by 36 degrees", async () => {
  await withSession(
    { width: 768, height: 800 },
    {},
    async ({ page, context }) => {
      const controls = await gameControls(page);
      const dial = await exactHiddenChild(
        page.getByRole("img", { name: "Safe closed", exact: true }),
        "semantic safe dial",
      );
      const angle = () => visibleDialAngle(dial);
      const settleDial = () => page.waitForTimeout(220);
      assert.deepEqual(
        await dial.evaluate((element) => {
          const style = getComputedStyle(element);
          return [
            style.transitionProperty,
            style.transitionDuration,
            style.transitionTimingFunction,
          ];
        }),
        ["transform", "0.18s", "cubic-bezier(0.22, 0.61, 0.36, 1)"],
        "normal motion uses the approved 180ms easing",
      );
      assert.equal(
        await angle(),
        0,
        "a new round starts at the public zero angle",
      );
      await controls.code.fill("1");
      await page.waitForTimeout(90);
      const middleAngle = await angle();
      assert.ok(
        middleAngle > 0 && middleAngle < 36,
        "normal-motion dial visibly progresses before its 180ms endpoint",
      );
      await settleDial();
      assert.equal(
        await angle(),
        36,
        "an accepted insert advances the dial once",
      );
      await controls.code.press("End");
      await controls.code.press("2");
      await settleDial();
      assert.equal(
        await angle(),
        72,
        "a second accepted insertion advances another 36 degrees",
      );
      await controls.code.press("Backspace");
      await settleDial();
      assert.equal(
        await angle(),
        36,
        "a nonempty public deletion reverses one 36-degree step",
      );
      await controls.code.fill("");
      await settleDial();
      assert.equal(
        await angle(),
        0,
        "deleting to the empty input restores canonical zero",
      );
      for (const edit of [
        async () => controls.code.fill("12"),
        async () => controls.code.fill("99"),
      ]) {
        const before = await angle();
        await edit();
        await settleDial();
        assert.equal(
          await angle(),
          (before + 36) % 360,
          "an accepted nonempty insert or replacement advances the dial once",
        );
      }
      await context.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: baseUrl,
      });
      await page.evaluate(() => navigator.clipboard.writeText("123"));
      await controls.code.focus();
      await page.keyboard.press("Control+A");
      const beforePaste = await angle();
      await page.keyboard.press("Control+V");
      await settleDial();
      assert.equal(
        await angle(),
        (beforePaste + 36) % 360,
        "one accepted paste advances the dial once",
      );
      const beforeNoOp = await angle();
      await controls.code.fill(await controls.code.inputValue());
      await settleDial();
      assert.equal(
        await angle(),
        beforeNoOp,
        "an unchanged public string gives no dial signal",
      );
      await controls.submit.click();
      await settleDial();
      assert.equal(
        await angle(),
        beforeNoOp,
        "a public result cannot reveal a secret-dependent rotation",
      );
      await controls.newRound.click();
      await settleDial();
      assert.equal(await angle(), 0, "New game synchronously restores zero");
      await controls.code.fill("8");
      await settleDial();
      assert.equal(
        await angle(),
        36,
        "a nonempty public edit establishes a visible nonzero terminal baseline",
      );
      await controls.surrender.click();
      await settleDial();
      assert.equal(
        await angle(),
        36,
        "terminal states preserve rather than reset the last nonzero public angle",
      );
      await controls.code.press("1");
      await settleDial();
      assert.equal(
        await angle(),
        36,
        "the disabled terminal input rejects an actual public edit without dial movement",
      );
      assert.equal(
        await controls.code.inputValue(),
        "8",
        "the disabled terminal input preserves its accepted public value",
      );
      assert.equal(
        await dial.evaluate(
          (element) =>
            `${getComputedStyle(element).pointerEvents},${element.tabIndex}`,
        ),
        "none,-1",
        "the dial is non-interactive decoration",
      );
    },
  );
});

test("SC05 D04: the tenth accepted input change keeps an unbounded clockwise dial path and deletion reverses only 36 degrees", async () => {
  await withSession({ width: 768, height: 800 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    const dial = await exactHiddenChild(
      page.getByLabel("Safe closed", { exact: true }),
      "unbounded safe dial",
    );
    const inlineDegrees = async () => {
      const transform = await dial.evaluate(
        (element) => element.style.transform,
      );
      const match = transform.match(/^rotate\((-?\d+(?:\.\d+)?)deg\)$/);
      assert.ok(match, "the public dial exposes its authored rotate value");
      return Number(match[1]);
    };
    const settleDial = () => page.waitForTimeout(220);

    // Replacement is a real accepted edit: it cannot be inferred from a private game value.
    for (const [index, value] of [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ].entries()) {
      await controls.code.fill(value);
      await settleDial();
      assert.equal(
        await controls.code.inputValue(),
        value,
        `accepted edit ${index + 1} reaches the public input`,
      );
      assert.equal(
        await inlineDegrees(),
        (index + 1) * 36,
        `accepted edit ${index + 1} retains its logical clockwise angle`,
      );
    }

    await controls.code.fill("10");
    await page.waitForTimeout(90);
    const clockwiseCrossing = await visibleDialAngle(dial);
    assert.ok(
      clockwiseCrossing > 324 && clockwiseCrossing < 360,
      "the 324-to-360 transition stays on its short clockwise arc instead of reversing 324 degrees",
    );
    await settleDial();
    assert.equal(
      await inlineDegrees(),
      360,
      "the tenth accepted edit remains unbounded at rotate(360deg), not rotate(0deg)",
    );

    await controls.code.press("Backspace");
    await page.waitForTimeout(90);
    const counterClockwiseCrossing = await visibleDialAngle(dial);
    assert.ok(
      counterClockwiseCrossing > 324 && counterClockwiseCrossing < 360,
      "deletion crosses back through the same short 360-to-324 arc",
    );
    await settleDial();
    assert.equal(
      await inlineDegrees(),
      324,
      "a deletion reverses exactly one 36-degree logical step",
    );
  });
});

test("SC05 D04: selected-text replacement and paste turn clockwise, while real character removal turns back one step", async () => {
  await withSession(
    { width: 768, height: 800 },
    {},
    async ({ page, context }) => {
      const controls = await gameControls(page);
      const dial = await exactHiddenChild(
        page.getByLabel("Safe closed", { exact: true }),
        "directional safe dial",
      );
      const authoredDegrees = async () => {
        const transform = await dial.evaluate(
          (element) => element.style.transform,
        );
        const match = transform.match(/^rotate\((-?\d+(?:\.\d+)?)deg\)$/);
        assert.ok(
          match,
          "the decorative dial keeps an authored public rotation",
        );
        return Number(match[1]);
      };
      const settleDial = () => page.waitForTimeout(220);

      await controls.code.focus();
      await page.keyboard.type("123");
      await settleDial();
      assert.equal(
        await authoredDegrees(),
        108,
        "three inserted characters establish three public clockwise steps",
      );

      await page.keyboard.press("Control+A");
      await page.keyboard.type("8");
      await settleDial();
      assert.equal(
        await controls.code.inputValue(),
        "8",
        "selected text is replaced by the typed public value",
      );
      assert.equal(
        await authoredDegrees(),
        144,
        "a nonempty replacement advances clockwise once even when its text is shorter",
      );

      await context.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: baseUrl,
      });
      await page.evaluate(() => navigator.clipboard.writeText("42"));
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Control+V");
      await settleDial();
      assert.equal(
        await controls.code.inputValue(),
        "42",
        "paste replaces the selected public value",
      );
      assert.equal(
        await authoredDegrees(),
        180,
        "a nonempty paste replacement advances clockwise once",
      );

      await page.keyboard.press("End");
      await page.keyboard.press("Backspace");
      await settleDial();
      assert.equal(
        await controls.code.inputValue(),
        "4",
        "Backspace removes one actual public character",
      );
      assert.equal(
        await authoredDegrees(),
        144,
        "Backspace reverses exactly one 36-degree step",
      );

      await page.keyboard.type("2");
      await settleDial();
      assert.equal(
        await authoredDegrees(),
        180,
        "insertion after Backspace advances clockwise once",
      );
      await page.keyboard.press("Home");
      await page.keyboard.press("Delete");
      await settleDial();
      assert.equal(
        await controls.code.inputValue(),
        "2",
        "Delete removes one actual public character",
      );
      assert.equal(
        await authoredDegrees(),
        144,
        "Delete reverses exactly one 36-degree step",
      );

      await page.keyboard.press("Control+Z");
      await settleDial();
      assert.equal(
        await controls.code.inputValue(),
        "42",
        "undo restores the deleted public character",
      );
      assert.equal(
        await authoredDegrees(),
        180,
        "undoing a deletion restores one clockwise step",
      );
      await page.keyboard.press("Control+Y");
      await settleDial();
      assert.equal(
        await controls.code.inputValue(),
        "2",
        "redo reapplies the public deletion",
      );
      assert.equal(
        await authoredDegrees(),
        144,
        "redoing a deletion reverses exactly one 36-degree step",
      );

      await page.keyboard.press("Control+A");
      await page.keyboard.press("Backspace");
      await settleDial();
      assert.equal(
        await controls.code.inputValue(),
        "",
        "the public field can be cleared",
      );
      assert.equal(
        await authoredDegrees(),
        0,
        "clearing the public field restores neutral dial rotation",
      );
    },
  );
});

test("SC05 D14: the separate dial keeps its approved responsive size and geometric centre independently of rotation", async () => {
  for (const [width, height] of [
    [1440, 900],
    [768, 800],
    [390, 844],
    [320, 600],
  ]) {
    await withSession({ width, height }, {}, async ({ page }) => {
      const safe = page.getByLabel("Safe closed", { exact: true });
      const dial = await exactHiddenChild(safe, `${width}px separate dial`);
      const [dialLogical, safeLogical, safeBox, dialBox] = await Promise.all([
        logicalBox(dial),
        logicalBox(safe),
        safe.boundingBox(),
        dial.boundingBox(),
      ]);
      assert.ok(
        safeLogical.width > 0 && safeBox.width > 0,
        `${width}px safe has measurable logical and rendered widths`,
      );
      approximatelyEqual(
        dialLogical.width / safeLogical.width,
        104 / 500,
        0.002,
        `${width}px logical dial keeps the established 104/500 safe-relative width ratio`,
      );
      approximatelyEqual(
        dialBox.width / safeBox.width,
        104 / 500,
        0.002,
        `${width}px rendered dial keeps the established 104/500 safe-relative width ratio`,
      );
      approximatelyEqual(
        dialLogical.height,
        dialLogical.width,
        0.5,
        `${width}px logical dial remains square`,
      );
      approximatelyEqual(
        dialBox.height,
        dialBox.width,
        0.5,
        `${width}px rendered dial remains square`,
      );
      if (Math.abs(safeLogical.width - 500) <= 0.5) {
        approximatelyEqual(
          dialLogical.width,
          104,
          0.5,
          `${width}px logical 500px safe keeps a 104px dial`,
        );
        approximatelyEqual(
          dialLogical.height,
          104,
          0.5,
          `${width}px logical 500px safe keeps a square 104px dial`,
        );
      } else
        assert.ok(
          safeLogical.width < 500,
          `${width}px logical dial can shrink only after its safe is smaller than 500px`,
        );
      if (Math.abs(safeBox.width - 500) <= 0.5)
        for (const dimension of ["width", "height"])
          approximatelyEqual(
            dialBox[dimension],
            104,
            0.5,
            `${width}px rendered 500px safe keeps a 104px dial ${dimension}`,
          );
      approximatelyEqual(
        (dialBox.x + dialBox.width / 2 - safeBox.x) / safeBox.width,
        0.4805,
        0.012,
        `${width}px rendered dial horizontal door ratio`,
      );
      approximatelyEqual(
        (dialBox.y + dialBox.height / 2 - safeBox.y) / safeBox.height,
        0.5335,
        0.012,
        `${width}px rendered dial vertical door ratio`,
      );
    });
  }
});

test("SC05 D04: reduced-motion dial is synchronous and never gains a transition", async () => {
  await withSession({ width: 390, height: 844 }, {}, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const controls = await gameControls(page);
    const dial = await exactHiddenChild(
      page.getByLabel("Safe closed", { exact: true }),
      "reduced-motion safe dial",
    );
    await controls.code.fill("5");
    assert.equal(
      await visibleDialAngle(dial),
      36,
      "reduced motion retains the public step immediately",
    );
    assert.equal(
      await dial.evaluate(
        (element) => getComputedStyle(element).transitionProperty,
      ),
      "none",
      "reduced motion removes dial movement",
    );
  });
});

test("SC05 D05: cat petting supports click, touch, and keyboard while bubbles stay bounded and non-mutating", async () => {
  await withSession(
    { width: 390, height: 844 },
    { hasTouch: true, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await gameControls(page);
      const pet = await exact(
        page.getByRole("button", { name: "Pet the cat", exact: true }),
        "petting target",
      );
      const petBox = await pet.boundingBox();
      assert.ok(petBox, "petting target has a rendered click area");
      const initialLayout = await page.locator("main").boundingBox();
      const bursts = page.locator("[data-pet-burst-id]");
      const hearts = bursts.locator("i");
      await pauseClockAtCurrentTime(page);
      await pet.hover();
      assert.equal(
        await page.locator('[data-presentation-mode="PET_NORMAL"]').count(),
        0,
        "hover alone does not activate the cat or create hearts",
      );
      const pointerPoint = await clickVisibleArtwork(page, pet);
      const pointerOrigin = { x: pointerPoint.x - petBox.x, y: pointerPoint.y - petBox.y };
      await exact(bursts, "aria-hidden heart burst in PET_NORMAL");
      assert.equal(
        await hearts.count(),
        3,
        "one pet emits exactly three decorative hearts",
      );
      assert.deepEqual(await hearts.allTextContents(), ["♥", "♥", "♥"], "a pointer pet renders three decorative hearts");
      // Sample the rendered animation at one shared WAAPI instant so unused custom properties cannot
      // masquerade as three motions.
      const renderedMotion = await hearts
        .evaluateAll((elements) =>
          elements.map((element) => {
            const animation = element.getAnimations()[0];
            animation.pause();
            animation.currentTime = 0;
            const style = getComputedStyle(element);
            const sample = {
              duration: style.animationDuration,
              transform: style.transform,
            };
            animation.play();
            return sample;
          }),
        );
      assert.deepEqual(
        renderedMotion.map((sample) => sample.duration),
        ["0.9s", "1.1s", "1.3s"],
        "normal hearts use staggered public-motion durations",
      );
      const sampledRise = renderedMotion.map((sample) =>
        Number(
          sample.transform.match(
            /matrix\([^,]+, [^,]+, [^,]+, [^,]+, [^,]+, ([^)]+)\)/,
          )?.[1],
        ),
      );
      assert.equal(
        sampledRise.every((rise) => Number.isFinite(rise)),
        true,
        "normal hearts expose measurable starting profiles before ascent",
      );
      assert.equal(
        new Set(sampledRise.map((rise) => rise.toFixed(3))).size,
        3,
        "normal hearts begin from visibly staggered vertical offsets",
      );
      assert.deepEqual(
        await page.locator("main").boundingBox(),
        initialLayout,
        "petting never allocates game layout",
      );
      assert.equal(
        await controls.code.inputValue(),
        "",
        "petting does not alter controlled input",
      );
      assert.equal(
        await controls.submit.isEnabled(),
        true,
        "petting does not alter game action availability",
      );
      assert.equal(
        await bursts.first().evaluate(
          (element) => getComputedStyle(element).pointerEvents,
        ),
        "none",
        "heart overlay passes pointer input through",
      );
      assert.deepEqual(
        await bursts.first().evaluate((element) => [
          element.style.getPropertyValue("--heart-origin-x"),
          element.style.getPropertyValue("--heart-origin-y"),
        ]),
        [
          `${(pointerOrigin.x / petBox.width) * 100}%`,
          `${(pointerOrigin.y / petBox.height) * 100}%`,
        ],
        "the pointer burst originates at its actual click position",
      );
      await page.clock.runFor(1198);
      assert.equal(
        await hearts.count(),
        3,
        "pointer leave cannot end the activation-owned pet presentation early",
      );
      await page.clock.runFor(1);
      assert.equal(await hearts.count(), 3, "pointer burst survives the unchanged game-state settle until its own last profile ends");
      await page.clock.runFor(102);
      await page.waitForTimeout(0);
      assert.equal(await hearts.count(), 0, "pointer burst clears after its final 1300ms profile");
      const touchPoint = (await visibleAlphaBounds(page, pet)).opaquePoint;
      assert.ok(touchPoint, "touch pet has an opaque artwork point");
      await pet.tap({ position: { x: touchPoint.x - petBox.x, y: touchPoint.y - petBox.y } });
      await page.mouse.click(pointerPoint.x, pointerPoint.y);
      assert.equal(await bursts.count(), 2, "pointer follow-up retains the touch group and appends its own group");
      assert.equal(await hearts.count(), 6, "two valid activations render six decorative hearts");
      await page.clock.runFor(1200);
      assert.equal(await page.locator('[data-presentation-mode="PLAYING"]').count(), 1, "repeated effects do not extend the original semantic settle");
      await page.clock.runFor(101);
      await page.waitForTimeout(0);
      assert.equal(await hearts.count(), 0, "touch and pointer groups independently clean after their final profiles");
      await page.clock.runFor(101);
      await pet.focus();
      await page.keyboard.press("Enter");
      assert.equal(await bursts.count(), 1, "Enter creates one keyboard-centered burst group");
      assert.equal(await hearts.count(), 3, "Enter renders its three decorative hearts");
      await page.clock.runFor(1301);
      assert.equal(await hearts.count(), 0, "keyboard burst cleans after its final profile");
      await pet.focus();
      await page.keyboard.press("Space");
      assert.equal(await hearts.count(), 3, "Space renders three decorative hearts");
      await page.clock.runFor(1301);
      assert.equal(await hearts.count(), 0, "Space burst cleans after its final profile");
      await pet.evaluate((node) => node.click());
      assert.equal(await hearts.count(), 3, "a standalone semantic button click remains an activation without a preceding keydown");
      await controls.newRound.click();
      assert.equal(await bursts.count(), 0, "New game clears live pet bursts before their natural expiry");
    },
  );
});

test("Pet me stays above the painted cat at desktop and compact widths", async () => {
  for (const [width, height] of [[1440, 900], [390, 844]])
    await withSession(
      { width, height },
      { clockStart: fixedClockStart },
      async ({ page }) => {
        await pauseClockAtCurrentTime(page);
        await page.clock.runFor(15_001);
        await page.clock.runFor(15_000);
        const prompt = await exact(page.locator("[data-pet-prompt]"), `${width}px Pet me prompt`);
        const cat = await exact(page.getByRole("button", { name: "Pet the cat", exact: true }), `${width}px prompt cat target`);
        const [promptBox, catAlpha, heading, subtitle] = await Promise.all([
          prompt.boundingBox(),
          visibleAlphaBounds(page, cat),
          page.getByRole("heading", { name: "Guess the number", exact: true }).boundingBox(),
          gameControls(page).then((controls) => controls.instruction.boundingBox()),
        ]);
        assert.ok(promptBox && heading && subtitle, `${width}px prompt and protected header content have boxes`);
        approximatelyEqual(promptBox.x + promptBox.width / 2, catAlpha.x + catAlpha.width / 2, 8, `${width}px Pet me horizontally follows the painted cat`);
        const gap = catAlpha.y - (promptBox.y + promptBox.height);
        assert.ok(gap >= 6 && gap <= 32, `${width}px Pet me keeps the approved 6-32px painted-cat gap: ${gap}px`);
        assert.equal(promptBox.y + promptBox.height <= catAlpha.y, true, `${width}px Pet me stays above the painted cat`);
        assert.equal(promptBox.y >= subtitle.y + subtitle.height, true, `${width}px Pet me does not overlap the subtitle: prompt ${promptBox.y}-${promptBox.y + promptBox.height}, subtitle ${subtitle.y}-${subtitle.y + subtitle.height}`);
      },
    );
});

test("Each pet creates a distinct activation-point burst without extending the round presentation", async () => {
  for (const [width, height, tolerance] of [[1440, 900, 8], [390, 844, 10]])
    await withSession(
      { width, height },
      { hasTouch: true, clockStart: fixedClockStart },
      async ({ page }) => {
        await pauseClockAtCurrentTime(page);
        const pet = await exact(
          page.getByRole("button", { name: "Pet the cat", exact: true }),
          `${width}px Pet the cat target`,
        );
        const pointForCurrentArt = async (excluded) => pet.evaluate(async (button, prior) => {
          const image = button.querySelector("img");
          if (!(image instanceof HTMLImageElement) || !image.complete) return null;
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) return null;
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const rect = image.getBoundingClientRect();
          const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
          const left = rect.left + (rect.width - canvas.width * scale) / 2;
          const top = rect.bottom - canvas.height * scale;
          for (let y = 16; y < canvas.height - 16; y += 12)
            for (let x = 16; x < canvas.width - 16; x += 12) {
              if (pixels[(y * canvas.width + x) * 4 + 3] < 192) continue;
              const point = { x: Math.round(left + (x + 0.5) * scale), y: Math.round(top + (y + 0.5) * scale) };
              const hit = document.elementFromPoint(point.x, point.y);
              if (hit && (hit === button || button.contains(hit)) && prior.every((other) => Math.hypot(other.x - point.x, other.y - point.y) > 12)) return point;
            }
          return null;
        }, excluded);
        const before = await pet.boundingBox();
        assert.ok(before, `${width}px pet target has a box`);
        const points = [];
        for (let index = 0; index < 3; index += 1) {
          const point = await pointForCurrentArt(points);
          assert.ok(point, `${width}px activation ${index + 1} has an opaque point in the current art`);
          points.push(point);
          await page.mouse.click(point.x, point.y);
          await page.waitForTimeout(0);
        }
        const groups = page.locator("[data-pet-burst-id]");
        assert.equal(await groups.count(), 3, `${width}px three rapid activations retain three burst groups`);
        const burst = await groups.evaluateAll((nodes) => nodes.map((node) => ({
          id: node.getAttribute("data-pet-burst-id"),
          hidden: node.getAttribute("aria-hidden"),
          x: Number.parseFloat(node.style.getPropertyValue("--heart-origin-x")),
          y: Number.parseFloat(node.style.getPropertyValue("--heart-origin-y")),
          hearts: [...node.querySelectorAll("i")].map((heart) => ({
            offsetY: Number.parseFloat(getComputedStyle(heart).getPropertyValue("--heart-offset-y")),
            duration: Number.parseFloat(getComputedStyle(heart).animationDuration) * 1000,
            text: heart.textContent,
          })),
        })));
        assert.equal(new Set(burst.map((entry) => entry.id)).size, 3, `${width}px burst identities are unique`);
        assert.equal(burst.every((entry) => entry.hidden === "true" && entry.hearts.length === 3 && entry.hearts.every((heart) => heart.text === "♥")), true, `${width}px each group exposes exactly three decorative hearts`);
        for (let index = 0; index < burst.length; index += 1) {
          approximatelyEqual(before.x + before.width * burst[index].x / 100, points[index].x, tolerance, `${width}px burst ${index + 1} tracks its click x`);
          approximatelyEqual(before.y + before.height * burst[index].y / 100, points[index].y, tolerance, `${width}px burst ${index + 1} tracks its click y`);
        }
        const profiles = burst[0].hearts;
        const durations = profiles.map((heart) => heart.duration).sort((a, b) => a - b);
        assert.equal(durations.every((duration, index) => index === 0 || duration - durations[index - 1] >= 100), true, `${width}px heart profiles use staggered durations`);
        const offsets = profiles.map((heart) => heart.offsetY).sort((a, b) => a - b);
        assert.equal(offsets.every((offset, index) => index === 0 || offset - offsets[index - 1] >= 4), true, `${width}px heart profiles start at distinct vertical offsets: ${offsets.join(", ")}`);
        await page.clock.runFor(1200);
        assert.equal(await page.locator('[data-presentation-mode="PLAYING"]').count(), 1, `${width}px repeat petting keeps the original presentation deadline`);
        assert.equal(await groups.count(), 3, `${width}px burst groups outlive the unchanged game-state settle until their own final profile ends`);
        await page.clock.runFor(101);
        assert.equal(await groups.count(), 0, `${width}px every group cleans itself after its longest profile`);
      },
    );
});

test("A click crossing the pet deadline cannot leak its origin into the next accepted burst", async () => {
  await withSession(
    { width: 1440, height: 900 },
    { clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const pet = await exact(
        page.getByRole("button", { name: "Pet the cat", exact: true }),
        "deadline-race Pet the cat target",
      );
      const opaquePointAwayFrom = async (excluded) => pet.evaluate(async (button, prior) => {
        const image = button.querySelector("img");
        if (!(image instanceof HTMLImageElement) || !image.complete) return null;
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return null;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const rect = image.getBoundingClientRect();
        const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
        const left = rect.left + (rect.width - canvas.width * scale) / 2;
        const top = rect.bottom - canvas.height * scale;
        for (let y = 16; y < canvas.height - 16; y += 12)
          for (let x = 16; x < canvas.width - 16; x += 12) {
            if (pixels[(y * canvas.width + x) * 4 + 3] < 192) continue;
            const point = { x: Math.round(left + (x + .5) * scale), y: Math.round(top + (y + .5) * scale) };
            const hit = document.elementFromPoint(point.x, point.y);
            if (hit && (hit === button || button.contains(hit)) && prior.every((other) => Math.hypot(other.x - point.x, other.y - point.y) > 24)) return point;
          }
        return null;
      }, excluded);
      const originAt = async (index) => page.locator("[data-pet-burst-id]").nth(index).evaluate((node) => ({
        x: Number.parseFloat(node.style.getPropertyValue("--heart-origin-x")),
        y: Number.parseFloat(node.style.getPropertyValue("--heart-origin-y")),
      }));
      const assertOrigin = async (origin, point, label) => {
        const box = await pet.boundingBox();
        assert.ok(box, `${label} target has a box`);
        approximatelyEqual(origin.x, ((point.x - box.x) / box.width) * 100, 3, `${label} x uses its click origin`);
        approximatelyEqual(origin.y, ((point.y - box.y) / box.height) * 100, 3, `${label} y uses its click origin`);
      };
      const initial = await opaquePointAwayFrom([]);
      assert.ok(initial, "deadline-race initial opaque point exists");
      await page.mouse.click(initial.x, initial.y);
      const groups = page.locator("[data-pet-burst-id]");
      assert.equal(await groups.count(), 1, "initial accepted click creates one burst");
      await assertOrigin(await originAt(0), initial, "initial accepted click");
      await page.clock.runFor(1199);
      const rejected = await opaquePointAwayFrom([initial]);
      assert.ok(rejected, "deadline-race pre-deadline opaque point exists");
      const bridgeKey = "__petDeadlineNowRestore";
      await page.evaluate((key) => {
        const target = performance;
        const hadOwn = Object.prototype.hasOwnProperty.call(target, "now");
        const previous = Object.getOwnPropertyDescriptor(target, "now");
        const original = target.now.bind(target);
        Object.defineProperty(target, key, {
          configurable: true,
          value: () => {
            if (hadOwn && previous) Object.defineProperty(target, "now", previous);
            else delete target.now;
            delete target[key];
          },
        });
        Object.defineProperty(target, "now", {
          configurable: true,
          value: () => original() + 2,
        });
      }, bridgeKey);
      try {
        await page.mouse.click(rejected.x, rejected.y);
        await page.waitForTimeout(0);
      } finally {
        await page.evaluate((key) => performance[key](), bridgeKey);
      }
      assert.equal(await groups.count(), 1, "the deadline-rejected click creates no burst group");
      await assertOrigin(await originAt(0), initial, "deadline-rejected click leaves the existing origin intact");
      await page.clock.runFor(101);
      assert.equal(await groups.count(), 0, "the initial burst cleans before the subsequent accepted click");
      const fresh = await opaquePointAwayFrom([initial, rejected]);
      assert.ok(fresh, "deadline-race fresh opaque point exists");
      await page.mouse.click(fresh.x, fresh.y);
      assert.equal(await groups.count(), 1, "the subsequent accepted click creates exactly one burst");
      await assertOrigin(await originAt(0), fresh, "subsequent accepted click");
    },
  );
});

test("Dialog transitions and route unmount clear live bursts; /safe remains proportional", async () => {
  await withSession(
    { width: 1440, height: 900 },
    { clockStart: fixedClockStart, route: "/safe" },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      const pet = await exact(
        page.getByRole("button", { name: "Pet the cat", exact: true }),
        "/safe Pet the cat target",
      );
      const controls = await gameControls(page);
      const point = (await visibleAlphaBounds(page, pet)).opaquePoint;
      assert.ok(point, "/safe exposes an opaque painted cat point");
      await page.mouse.click(point.x, point.y);
      const groups = page.locator("[data-pet-burst-id]");
      assert.equal(await groups.count(), 1, "/safe one valid activation creates one burst group");
      assert.equal(await groups.locator("i").count(), 3, "/safe burst contains three hearts");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        "/safe pet feedback creates no horizontal overflow",
      );
      await controls.hint.click();
      await exact(page.getByRole("dialog"), "hint dialog entered after a live burst");
      assert.equal(await groups.count(), 0, "dialog entry clears a live burst on its next transition");
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(await groups.count(), 0, "dialog exit cannot restore a stale burst");
      await controls.newRound.click();
      const resumedPet = await exact(
        page.getByRole("button", { name: "Pet the cat", exact: true }),
        "/safe resumed Pet the cat target",
      );
      const resumedPoint = (await visibleAlphaBounds(page, resumedPet)).opaquePoint;
      assert.ok(resumedPoint, "/safe resumed cat exposes an opaque point");
      await page.mouse.click(resumedPoint.x, resumedPoint.y);
      assert.equal(await groups.count(), 1, "/safe second activation has one live burst before unmount");
      const response = await page.goto(new URL("/", baseUrl).href, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200, "route navigation after a live burst succeeds");
      assert.equal(await page.locator("[data-pet-burst-id]").count(), 0, "route unmount cannot retain a stale burst");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        "scene return after /safe unmount creates no horizontal overflow",
      );
    },
  );
});

test("SC07: transparent physical cat pixels are inert while the visible Pet me prompt is an activation", async () => {
  await withSession(
    { width: 390, height: 844 },
    { hasTouch: true, clockStart: fixedClockStart },
    async ({ page }) => {
      const controls = await gameControls(page);
      const initialAlpha = await visibleAlphaBounds(page, controls.cat);
      const catBox = await controls.cat.boundingBox();
      assert.ok(catBox, "Pet the cat button exposes a measurable physical hit target");
      for (const [kind, point, predicate] of [
        ["transparent", initialAlpha.transparentPoint, (alpha) => alpha <= 8],
        ["opaque", initialAlpha.opaquePoint, (alpha) => alpha > 8],
      ]) {
        assert.ok(point, `approved artwork exposes an in-button ${kind} alpha point`);
        assert.equal(predicate(point.sourceAlpha), true, `${kind} point has the expected source alpha threshold`);
        assert.equal(predicate(point.alpha), true, `${kind} final integer physical coordinate keeps the expected alpha threshold`);
        assert.equal(
          point.topmostHitTarget,
          true,
          `${kind} final physical coordinate is owned by Pet the cat rather than a higher layer`,
        );
        if (kind === "opaque")
          assert.ok(point.sourceAlpha >= 192, "opaque physical mouse point stays inside the painted cat rather than on an alpha edge");
        assert.ok(
          point.x >= catBox.x && point.x < catBox.x + catBox.width &&
            point.y >= catBox.y && point.y < catBox.y + catBox.height,
          `${kind} alpha point lies inside the physical Pet the cat button`,
        );
      }
      await page.mouse.click(
        initialAlpha.transparentPoint.x,
        initialAlpha.transparentPoint.y,
      );
      await ordinaryOwner(page, "PLAYING", "transparent physical click leaves the playing cat active");
      assert.equal(
        await page.locator('[data-presentation-mode="PET_NORMAL"] [aria-hidden="true"] i').count(),
        0,
        "transparent physical click creates no heart burst",
      );
      await page.mouse.click(
        initialAlpha.opaquePoint.x,
        initialAlpha.opaquePoint.y,
      );
      await ordinaryOwner(page, "PET_NORMAL", "opaque physical mouse click activates the cat");
      assert.equal(
        await page.locator('[data-presentation-mode="PET_NORMAL"] [aria-hidden="true"] i').count(),
        3,
        "opaque physical mouse click creates exactly one three-heart burst",
      );
      await page.clock.runFor(1200);
      await ordinaryOwner(page, "PLAYING", "mouse burst settles before the independent touch check");
      await controls.newRound.click();
      const touchAlpha = await visibleAlphaBounds(page, controls.cat);
      const touchBox = await controls.cat.boundingBox();
      assert.ok(touchBox, "fresh Pet the cat button exposes a touch hit target");
      for (const [kind, point, predicate] of [
        ["transparent", touchAlpha.transparentPoint, (alpha) => alpha <= 8],
        ["opaque", touchAlpha.opaquePoint, (alpha) => alpha > 8],
      ]) {
        assert.ok(point, `fresh artwork exposes an in-button ${kind} touch point`);
        assert.equal(predicate(point.sourceAlpha), true, `fresh ${kind} touch point has the expected source alpha threshold`);
        assert.equal(predicate(point.alpha), true, `fresh ${kind} final integer touch coordinate keeps the expected alpha threshold`);
        assert.equal(
          point.topmostHitTarget,
          true,
          `fresh ${kind} final touch coordinate is owned by Pet the cat rather than a higher layer`,
        );
        if (kind === "opaque")
          assert.ok(point.sourceAlpha >= 192, "opaque physical touch point stays inside the painted cat rather than on an alpha edge");
        assert.ok(
          point.x >= touchBox.x && point.x < touchBox.x + touchBox.width &&
            point.y >= touchBox.y && point.y < touchBox.y + touchBox.height,
          `fresh ${kind} touch point lies inside the physical Pet the cat button`,
        );
      }
      await controls.cat.tap({
        position: {
          x: touchAlpha.transparentPoint.x - touchBox.x,
          y: touchAlpha.transparentPoint.y - touchBox.y,
        },
      });
      await ordinaryOwner(page, "PLAYING", "transparent physical touch leaves the cat inactive");
      assert.equal(
        await page.locator('[data-presentation-mode="PET_NORMAL"] [aria-hidden="true"] i').count(),
        0,
        "transparent physical touch creates no heart burst",
      );
      await controls.cat.tap({
        position: {
          x: touchAlpha.opaquePoint.x - touchBox.x,
          y: touchAlpha.opaquePoint.y - touchBox.y,
        },
      });
      await ordinaryOwner(page, "PET_NORMAL", "opaque physical touch activates the cat");
      assert.equal(
        await page.locator('[data-presentation-mode="PET_NORMAL"] [aria-hidden="true"] i').count(),
        3,
        "opaque physical touch creates exactly one three-heart burst",
      );
      await page.clock.runFor(1200);
      await page.clock.runFor(15_001);
      await ordinaryOwner(page, "LONG_IDLE", "touch pet settles before its deferred prompt becomes due");
      await page.clock.runFor(15_000);
      await ordinaryOwner(page, "PET_PROMPT", "deferred touch prompt retains its public ordinary owner");
      const prompt = await exact(
        page.locator("[data-pet-prompt]"),
        "timed visible Pet me prompt",
      );
      await prompt.click();
      const success = await ordinaryArt(
        page,
        "PET_PROMPT_SUCCESS",
        "cat-pet-success-800.webp",
        "Pet me prompt activation",
      );
      assert.equal(
        await success.locator(':scope > [aria-hidden="true"] i').count(),
        3,
        "one visible Pet me activation emits one three-heart burst",
      );
    },
  );
});

test("SC05 provider: public presentation owners distinguish pettable and terminal game outcomes", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      await expectOrdinaryReturn(page, "PLAYING", true, "initial playing state");
      await controls.code.fill("41");
      await controls.submit.click();
      await expectOrdinaryReturn(page, "WRONG", false, "wrong state");
      await controls.newRound.click();
      await controls.code.fill("42");
      await controls.submit.click();
      await expectOrdinaryReturn(page, "WON", false, "won state");
      await controls.newRound.click();
      await controls.surrender.click();
      await expectOrdinaryReturn(page, "SURRENDERED", false, "surrendered state");
    },
  );
});

test("SC05 provider: pet origins use unscaled layout coordinates across responsive layout bands", async () => {
  for (const [width, height, expectedScale] of [
    [1440, 900, 1],
    [768, 800, 1],
  ])
    await withSession({ width, height }, { clockStart: fixedClockStart }, async ({ page }) => {
      const controls = await gameControls(page);
      const pet = await exact(
        page.getByRole("button", { name: "Pet the cat", exact: true }),
        `${width}px pet target`,
      );
      const petBox = await pet.boundingBox();
      const stageScale = await page
        .locator("main > div")
        .first()
        .evaluate((element) =>
          Math.abs(
            getComputedStyle(element)
              .transform.match(/matrix\(([^)]+)\)/)?.[1]
              .split(",")
              .map(Number)[0] ?? 1,
          ),
        );
      approximatelyEqual(
        stageScale,
        expectedScale,
        0.01,
        `${width}px pet origin test uses the approved stage scale`,
      );
      const client = {
        x: 0,
        y: 0,
      };
      await pauseClockAtCurrentTime(page);
      const point = await clickVisibleArtwork(page, pet);
      client.x = point.x;
      client.y = point.y;
      const owner = await ordinaryArt(page, "PET_NORMAL", "cat-pet-hover-800.webp", `${width}px off-center pointer owner`);
      const overlay = await exact(owner.locator(':scope > [data-pet-burst-id]'), `${width}px heart overlay`);
      const hearts = overlay.locator(":scope > i");
      assert.equal(await hearts.count(), 3, `${width}px off-center pointer activation renders three decorative hearts`);
      const origin = await overlay.evaluate((element) => [
        Number.parseFloat(element.style.getPropertyValue("--heart-origin-x")),
        Number.parseFloat(element.style.getPropertyValue("--heart-origin-y")),
      ]);
      approximatelyEqual(origin[0], ((client.x - petBox.x) / petBox.width) * 100, 0.01, `${width}px pointer heart x origin tracks the actual click`);
      approximatelyEqual(origin[1], ((client.y - petBox.y) / petBox.height) * 100, 0.01, `${width}px pointer heart y origin tracks the actual click`);
      assert.equal(await owner.boundingBox().then((box) => Boolean(box && box.width > 0 && box.height > 0)), true, `${width}px PET_NORMAL owner remains measurable after a real off-center click`);
      await page.mouse.move(0, 0);
      await page.clock.runFor(1199);
      await ordinaryOwner(page, "PET_NORMAL", `${width}px pointer activation stays active before 1200ms`);
      await page.clock.runFor(1);
      await expectOrdinaryReturn(page, "PLAYING", true, `${width}px pointer activation settles at 1200ms`);
      await page.clock.runFor(101);
      const keyboardPet = await exact(page.getByRole("button", { name: "Pet the cat", exact: true }), `${width}px restored keyboard pet target`);
      const paintedCenter = await visibleAlphaBounds(page, keyboardPet);
      await keyboardPet.focus();
      await page.keyboard.press("Enter");
      const keyboardOwner = await ordinaryOwner(page, "PET_NORMAL", `${width}px keyboard PET_NORMAL owner`);
      assert.equal(await keyboardOwner.locator(':scope > [data-pet-burst-id] i').count(), 3, `${width}px Enter renders three decorative hearts`);
      const keyboardOrigin = await keyboardOwner.locator(':scope > [data-pet-burst-id]').evaluate((element) => ({
        x: Number.parseFloat(element.style.getPropertyValue("--heart-origin-x")),
        y: Number.parseFloat(element.style.getPropertyValue("--heart-origin-y")),
      }));
      const keyboardBox = await keyboardOwner.boundingBox();
      assert.ok(keyboardBox, `${width}px keyboard owner has a box`);
      approximatelyEqual(keyboardBox.x + keyboardBox.width * keyboardOrigin.x / 100, paintedCenter.x + paintedCenter.width / 2, 8, `${width}px Enter uses painted alpha center on x`);
      approximatelyEqual(keyboardBox.y + keyboardBox.height * keyboardOrigin.y / 100, paintedCenter.y + paintedCenter.height / 2, 8, `${width}px Enter uses painted alpha center on y`);
      await page.clock.runFor(1200);
      await expectOrdinaryReturn(page, "PLAYING", true, `${width}px keyboard settle`);
    });
});

test("SC05 D05: reduced-motion petting keeps three decorative hearts fade-only for 700ms", async () => {
  await withSession(
    { width: 390, height: 844 },
    { hasTouch: true, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const pet = await exact(
        page.getByRole("button", { name: "Pet the cat", exact: true }),
        "reduced-motion petting target",
      );
      const petBox = await pet.boundingBox();
      assert.ok(
        petBox,
        "reduced-motion petting target has a rendered touch area",
      );
      const alpha = await visibleAlphaBounds(page, pet);
      assert.ok(alpha.opaquePoint, "reduced-motion test has a visible cat-art activation point");
      await page.mouse.click(alpha.opaquePoint.x, alpha.opaquePoint.y);
      const owner = await ordinaryArt(page, "PET_NORMAL", "cat-pet-hover-800.webp", "reduced-motion PET_NORMAL owner");
      const overlay = await exact(owner.locator(':scope > [aria-hidden="true"]:not(:has(img))'), "reduced-motion aria-hidden heart overlay");
      assert.equal(
        await overlay.getAttribute("aria-hidden"),
        "true",
        "reduced-motion overlay stays decorative",
      );
      const hearts = overlay.locator(":scope > *");
      assert.equal(
        await hearts.count(),
        3,
        "reduced motion retains exactly three hearts",
      );
      assert.deepEqual(await hearts.allTextContents(), ["♥", "♥", "♥"], "reduced motion preserves the public three-heart effect after an off-center real click");
      for (let index = 0; index < 3; index += 1) {
        const style = await hearts
          .nth(index)
          .evaluate((element) => [
            getComputedStyle(element).transform,
            getComputedStyle(element).animationDuration,
            getComputedStyle(element).transitionDuration,
          ]);
        assert.ok(
          style[0] === "none" || style[0] === "matrix(1, 0, 0, 1, 0, 0)",
          "reduced-motion hearts neither translate nor scale",
        );
        assert.ok(
          style[1] === "0.7s" || style[2] === "0.7s",
          "reduced-motion heart lifecycle is the approved 700ms fade",
        );
      }
      await page.waitForTimeout(240);
      const middleStates = await hearts.evaluateAll((elements) =>
        elements.map((element) => ({
          opacity: Number(getComputedStyle(element).opacity),
          transform: getComputedStyle(element).transform,
        })),
      );
      const middleOpacities = middleStates.map((state) => state.opacity);
      for (const state of middleStates) {
        assert.ok(
          state.transform === "none" ||
            state.transform === "matrix(1, 0, 0, 1, 0, 0)",
          "mid-lifecycle reduced-motion heart still has no translation or scale",
        );
        assert.ok(
          state.opacity > 0.05 && state.opacity < 0.95,
          "mid-lifecycle reduced-motion heart is visibly fading rather than static or complete",
        );
      }
      await page.waitForTimeout(260);
      const lateOpacities = await hearts.evaluateAll((elements) =>
        elements.map((element) => Number(getComputedStyle(element).opacity)),
      );
      for (let index = 0; index < 3; index += 1)
        assert.ok(
          lateOpacities[index] < middleOpacities[index],
          "late reduced-motion heart opacity progresses toward cleanup",
        );
      await page.waitForTimeout(800);
      await page.clock.runFor(1200);
      await page
        .locator('[data-presentation-mode="PLAYING"]')
        .waitFor({ state: "visible", timeout: 5000 });
      assert.equal(
        await hearts.count(),
        0,
        "reduced-motion effect DOM clears after its reducer-owned settle",
      );
    },
  );
  await withSession(
    { width: 390, height: 844 },
    { hasTouch: true, clockStart: fixedClockStart },
    async ({ page }) => {
      await pauseClockAtCurrentTime(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const pet = await exact(
        page.getByRole("button", { name: "Pet the cat", exact: true }),
        "reduced-motion deterministic petting target",
      );
      const alpha = await visibleAlphaBounds(page, pet);
      await page.mouse.click(alpha.opaquePoint.x, alpha.opaquePoint.y);
      const owner = await ordinaryOwner(
        page,
        "PET_NORMAL",
        "reduced-motion reducer-owned PET_NORMAL owner",
      );
      const hearts = owner.locator(':scope > [data-pet-burst-id] i');
      assert.equal(await hearts.count(), 3, "reduced-motion reducer owns three hearts");
      await page.clock.runFor(699);
      assert.equal(await hearts.count(), 3, "reduced-motion hearts remain through their 700ms fade");
      await page.clock.runFor(1);
      await ordinaryOwner(page, "PET_NORMAL", "reduced-motion cleanup leaves the semantic presentation active");
      assert.equal(await hearts.count(), 0, "reduced-motion hearts clear at their own 700ms lifetime");
      await page.clock.runFor(500);
      await expectOrdinaryReturn(page, "PLAYING", true, "reduced-motion semantic settle still completes at 1200ms");
    },
  );
});

test("SC05 D06: controls retain actual game semantics, visible focus, and local typography", async () => {
  await withSession({ width: 320, height: 600 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    const initialGeometry = await page.evaluate(() => {
      const input = document.querySelector("#safe-code");
      const shell = input.parentElement;
      const submit = shell.querySelector("button");
      return [
        input.getBoundingClientRect().toJSON(),
        shell.getBoundingClientRect().toJSON(),
        submit.getBoundingClientRect().toJSON(),
      ];
    });
    assert.equal(
      await controls.code.getAttribute("placeholder"),
      "Enter a number...",
      "approved inner-field placeholder is public",
    );
    const compactForm = await controls.code.evaluate((input) => {
      const shell = input.parentElement;
      const submit = shell.querySelector("button");
      const inputStyle = getComputedStyle(input);
      const submitStyle = getComputedStyle(submit);
      const context = document.createElement("canvas").getContext("2d");
      context.font = `${inputStyle.fontWeight} ${inputStyle.fontSize} ${inputStyle.fontFamily}`;
      const horizontalPadding =
        Number.parseFloat(inputStyle.paddingLeft) +
        Number.parseFloat(inputStyle.paddingRight);
      return {
        shell: shell.getBoundingClientRect().toJSON(),
        input: input.getBoundingClientRect().toJSON(),
        submit: submit.getBoundingClientRect().toJSON(),
        submitBoxSizing: submitStyle.boxSizing,
        placeholderWidth: context.measureText(input.placeholder).width,
        fourDigitWidth: context.measureText("1000").width,
        inputContentWidth: input.clientWidth - horizontalPadding,
      };
    });
    assert.ok(
      compactForm.shell.width >= 296 && compactForm.shell.width <= 320,
      "320px code form uses the available near-viewport row width",
    );
    assert.deepEqual(
      [compactForm.submitBoxSizing, Math.round(compactForm.submit.width)],
      ["border-box", 84],
      "320px OK retains its exact 84px border-box outer width",
    );
    assert.ok(
      compactForm.input.width > 0 &&
        compactForm.placeholderWidth <= compactForm.inputContentWidth &&
        compactForm.fourDigitWidth <= compactForm.inputContentWidth,
      "320px input keeps both its placeholder and four-digit code affordance unclipped",
    );
    await controls.code.focus();
    const [inputStyle, titleFont, externalFonts, focusedGeometry] =
      await page.evaluate(() => {
        const title = document.querySelector("h1");
        const input = document.querySelector("#safe-code");
        const shell = input.parentElement;
        const submit = shell.querySelector("button");
        const style = getComputedStyle(input);
        return [
          [
            style.outlineWidth,
            style.borderColor,
            style.boxShadow,
            style.caretColor,
          ],
          title && getComputedStyle(title).fontFamily,
          [
            ...document.querySelectorAll(
              "link[rel='stylesheet'], link[rel='preload']",
            ),
          ]
            .map((link) => link.href)
            .filter(
              (href) => href && new URL(href, location.href).origin !== location.origin,
            ),
          [
            input.getBoundingClientRect().toJSON(),
            shell.getBoundingClientRect().toJSON(),
            submit.getBoundingClientRect().toJSON(),
          ],
        ];
      });
    assert.equal(
      inputStyle[0],
      "0px",
      "D12 focus removes the obsolete outer outline",
    );
    assert.equal(
      inputStyle[1],
      "rgb(173, 149, 224)",
      "D12 focus uses the approved inner violet border",
    );
    assert.match(
      inputStyle[2],
      /182, 157, 227/,
      "D12 focus uses the approved inner violet glow",
    );
    assert.notEqual(
      inputStyle[3],
      "transparent",
      "focused controlled input retains a visible caret",
    );
    assert.deepEqual(
      focusedGeometry,
      initialGeometry,
      "input focus never shifts shell or OK geometry",
    );
    assert.match(
      titleFont,
      /Chewy|Trebuchet MS|cursive/i,
      "title uses the approved D12 fallback stack",
    );
    assert.deepEqual(
      externalFonts,
      [],
      "the screen does not request a remote font",
    );
    await controls.code.fill("bad");
    await controls.submit.click();
    assert.equal(
      await controls.code.getAttribute("aria-invalid"),
      "true",
      "invalid public input remains distinct from focus and disabled state",
    );
    await controls.surrender.click();
    assert.equal(
      await controls.code.isDisabled(),
      true,
      "terminal state keeps the controlled input closed",
    );
    assert.equal(
      await controls.submit.isDisabled(),
      true,
      "terminal state keeps submit disabled",
    );
  });
});
}

module.exports = { register01 };
