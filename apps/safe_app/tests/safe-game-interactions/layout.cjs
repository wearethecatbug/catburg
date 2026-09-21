const assert = require("node:assert/strict");
const test = require("node:test");
const { withSession } = require("./shared/session.cjs");
const { fixedClockStart, viewportCases } = require("./shared/runtime-context.cjs");
const { sc06RenderedReferences } = require("./shared/sc06.cjs");
const { waitForStableVisualGeometry, visibleAlphaBounds } = require("./shared/readiness.cjs");
const { exact, ordinaryOwner, expectOrdinaryReturn, gameControls, solveVisibleQuestion, visibleQuestionAnswer, approximatelyEqual } = require("./shared/game-controls.cjs");
const { exactHiddenChild, intersects, visibleTextBounds, visibleRotationDegrees, visibleDialAngle, publicAssetPresentation, clickVisibleArtwork, requiredHeaderGap, paintedCatSafeGap, assertPaintedHeaderClearance, logicalBox, titleControlPointY, transformScale, transformTranslation, isPurple, isErrorRed } = require("./shared/artwork-geometry.cjs");



async function settleViewportAtTop(page) {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    scrollTo(0, 0);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}



function contrastRatio(foreground, background) {
  function relativeLuminance(color) {
    const channels = color
      .match(/\d+(?:\.\d+)?/g)
      .slice(0, 3)
      .map(Number)
      .map((channel) => {
        const normalizedChannel = channel / 255;
        return normalizedChannel <= 0.03928
          ? normalizedChannel / 12.92
          : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}



// Transparent text containers inherit their visual background from the first opaque ancestor.
async function opaqueAncestorBackground(locator) {
  return locator.evaluate((element) => {
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      const backgroundColor = getComputedStyle(ancestor).backgroundColor;
      if (
        !backgroundColor.startsWith("rgba") ||
        !backgroundColor.endsWith(", 0)")
      )
        return backgroundColor;
    }
    return getComputedStyle(document.body).backgroundColor;
  });
}

// SC08-D05 independently confirms these approved visible gradient stops.
const HISTORY_SHELL_GRADIENT_STOPS = [
  "rgb(251, 247, 255)",
  "rgb(234, 220, 255)",
  "rgb(217, 193, 250)",
];

// Entries contrast with their owned surface; header and grip must pass each visible shell stop.
async function historyContrastMeasurements(entry, heading, handle) {
  const [entryColor, entrySurface, headingColor, handleColor] = await Promise.all([
    entry.evaluate((element) => getComputedStyle(element).color),
    entry.evaluate((element) => {
      const surface = element.closest("[aria-live='polite']");
      if (!surface) throw new Error("History entry has no entries surface");
      return getComputedStyle(surface).backgroundColor;
    }),
    heading.evaluate((element) => getComputedStyle(element).color),
    handle.evaluate((element) => getComputedStyle(element).color),
  ]);
  return [
    contrastRatio(entryColor, entrySurface),
    ...HISTORY_SHELL_GRADIENT_STOPS.map((surface) => contrastRatio(headingColor, surface)),
    ...HISTORY_SHELL_GRADIENT_STOPS.map((surface) => contrastRatio(handleColor, surface)),
  ];
}

function register01() {
test("SC06: narrow mobile menu keeps an eight-pixel icon gap without disturbing the two-column menu", async () => {
  const entries = [
    ["New game", "newRound"],
    ["Give up", "surrender"],
    ["Show hint", "hint"],
    ["History", "history"],
  ];
  const measurements = async (controls) =>
    Promise.all(
      entries.map(async ([name, key]) =>
        controls[key].evaluate((button, label) => {
          const box = button.getBoundingClientRect();
          const icon = button.querySelector("svg");
          const text = [...button.querySelectorAll("span")].find(
            (element) => element.textContent?.trim() === label,
          );
          const lamp = button.querySelector('img[aria-hidden="true"]');
          const toBox = (element) => element && element.getBoundingClientRect();
          return {
            name: label,
            box,
            icon: toBox(icon),
            label: toBox(text),
            lamp: toBox(lamp),
            clipped: Boolean(text && text.scrollWidth > text.clientWidth),
          };
        }, name),
      ),
    );

  for (const width of [390, 420])
    await withSession({ width, height: 844 }, {}, async ({ page }) => {
      const menu = await gameControls(page);
      const items = await measurements(menu);
      for (const item of items) {
        assert.ok(
          item.icon && item.label,
          `${width}px ${item.name} exposes visible leading icon and label boxes`,
        );
        approximatelyEqual(
          item.label.x - (item.icon.x + item.icon.width),
          8,
          1,
          `${width}px ${item.name} keeps the visible eight-pixel icon-to-label gap`,
        );
        assert.equal(
          item.clipped,
          false,
          `${width}px ${item.name} label is not clipped`,
        );
        assert.ok(
          item.box.x >= 0 && item.box.x + item.box.width <= width,
          `${width}px ${item.name} remains contained in the viewport`,
        );
        assert.ok(
          item.icon.x >= item.box.x &&
            item.label.x >= item.box.x &&
            item.label.x + item.label.width <= item.box.x + item.box.width &&
            item.icon.y >= item.box.y &&
            item.label.y + item.label.height <= item.box.y + item.box.height,
          `${width}px ${item.name} icon and label remain inside their button`,
        );
      }
      const [newGame, giveUp, showHint, history] = items;
      approximatelyEqual(
        newGame.box.y,
        giveUp.box.y,
        1,
        `${width}px New game and Give up retain their first menu row`,
      );
      approximatelyEqual(
        showHint.box.y,
        history.box.y,
        1,
        `${width}px Show hint and History retain their second menu row`,
      );
      approximatelyEqual(
        newGame.box.x,
        showHint.box.x,
        1,
        `${width}px left menu column remains aligned`,
      );
      approximatelyEqual(
        giveUp.box.x,
        history.box.x,
        1,
        `${width}px right menu column remains aligned`,
      );
      assert.ok(
        newGame.box.x + newGame.box.width <= giveUp.box.x &&
          showHint.box.x + showHint.box.width <= history.box.x,
        `${width}px two menu columns do not overlap`,
      );
      assert.ok(
        showHint.lamp &&
          showHint.lamp.x >= showHint.box.x &&
          showHint.lamp.y >= showHint.box.y &&
          showHint.lamp.x + showHint.lamp.width <=
            showHint.box.x + showHint.box.width &&
          showHint.lamp.y + showHint.lamp.height <=
            showHint.box.y + showHint.box.height &&
          showHint.lamp.x >= showHint.label.x + showHint.label.width,
        `${width}px trailing Show hint lamp remains contained after its label`,
      );
    });

  await withSession({ width: 421, height: 844 }, {}, async ({ page }) => {
    const items = await measurements(await gameControls(page));
    for (const item of items) {
      assert.ok(
        item.icon && item.label,
        `421px ${item.name} retains its ordinary icon and label`,
      );
      approximatelyEqual(
        item.label.x - (item.icon.x + item.icon.width),
        18,
        1,
        `421px ${item.name} retains its pre-narrow-breakpoint spacing`,
      );
    }
  });
})
}

function register02() {


test("each viewport scrolls controls individually before checking reachable geometry", async () => {
  for (const [width, height] of viewportCases) {
    await withSession({ width, height }, {}, async ({ page }) => {
      const controls = await gameControls(page);
      await controls.code.scrollIntoViewIfNeeded();
      const codeBox = await controls.code.boundingBox();
      assert.ok(
        codeBox.y >= 0 && codeBox.y + codeBox.height <= height,
        "code row is reachable after its own scroll",
      );
      await controls.submit.scrollIntoViewIfNeeded();
      const submitBox = await controls.submit.boundingBox();
      assert.ok(
        submitBox.y >= 0 && submitBox.y + submitBox.height <= height,
        "submit is reachable after its own scroll",
      );
      await controls.cat.scrollIntoViewIfNeeded();
      const [catBox, safeBox, scrollY] = await Promise.all([
        controls.cat.boundingBox(),
        page.getByLabel("Safe closed", { exact: true }).boundingBox(),
        page.evaluate(() => scrollY),
      ]);
      assert.ok(
        catBox.y + scrollY >= 0,
        "cat remains in document coordinates even when viewport is short",
      );
      assert.ok(Math.abs(safeBox.x + safeBox.width / 2 - width / 2) <= 2);
      assert.ok(Math.abs(catBox.x + catBox.width / 2 - width / 2) <= 2);
      assert.ok(
        catBox.y < safeBox.y + safeBox.height &&
          catBox.y + catBox.height > safeBox.y,
        "cat and safe retain intentional overlap",
      );
    });
  }
});

test("empty and populated History contrast are collected separately in light and dark", async () => {
  for (const colorScheme of ["light", "dark"]) {
    await withSession(
      { width: 1175, height: 1098 },
      { colorScheme, random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.history.click();
        const panel = page.getByRole("region", {
          name: "History",
          exact: true,
        });
        const emptyText = panel.getByText("No valid attempts yet.", {
          exact: true,
        });
        const heading = panel.getByRole("heading", {
          name: "History",
          exact: true,
        });
        const handle = page.getByRole("button", {
          name: "Move History",
          exact: true,
        });
        const emptyMeasurements = await historyContrastMeasurements(emptyText, heading, handle);
        await controls.history.focus();
        await page.keyboard.press("Enter");
        for (const guess of [
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
        ]) {
          await controls.code.fill(guess);
          await controls.submit.click();
        }
        await controls.history.click();
        const populatedPanel = page.getByRole("region", {
          name: "History",
          exact: true,
        });
        const populatedEntries = populatedPanel.locator("[aria-live='polite'] li");
        assert.equal(await populatedEntries.count(), 10, `${colorScheme} populated History retains all valid attempts`);
        const populatedMeasurements = await historyContrastMeasurements(
          populatedEntries.first(),
          populatedPanel.getByRole("heading", { name: "History", exact: true }),
          page.getByRole("button", { name: "Move History", exact: true }),
        );
        assert.ok(
          emptyMeasurements.every((ratio) => ratio >= 4.5),
          `${colorScheme} empty History contrast meets 4.5:1`,
        );
        assert.ok(
          populatedMeasurements.every((ratio) => ratio >= 4.5),
          `${colorScheme} populated History contrast meets 4.5:1`,
        );
      },
    );
  }
});

test("direct /safe keeps readable opaque route coverage in light and dark", async () => {
  for (const colorScheme of ["light", "dark"])
    await withSession(
      { width: 390, height: 844 },
      { colorScheme, route: "/safe" },
      async ({ page }) => {
        const title = await exact(
          page.getByRole("heading", { name: "Guess the number", exact: true }),
          `${colorScheme} direct-safe title`,
        );
        const instruction = await exact(
          page.getByText("Enter a whole code from 1 to 1000.", { exact: true }),
          `${colorScheme} direct-safe instruction`,
        );
        for (const target of [title, instruction]) {
          const ratio = contrastRatio(
            await target.evaluate((element) => getComputedStyle(element).color),
            await opaqueAncestorBackground(target),
          );
          assert.ok(
            ratio >= 4.5,
            `${colorScheme} direct /safe ${await target.innerText()} contrast meets 4.5:1 against its first opaque ancestor`,
          );
        }
        const surface = await title.evaluate((element) => {
          for (let owner = element; owner; owner = owner.parentElement) {
            const style = getComputedStyle(owner);
            if (
              !style.backgroundColor.startsWith("rgba") ||
              !style.backgroundColor.endsWith(", 0)")
            ) {
              const rect = owner.getBoundingClientRect();
              return {
                top: rect.y + scrollY,
                bottom: rect.y + scrollY + rect.height,
                color: style.backgroundColor,
                scrollHeight: document.documentElement.scrollHeight,
              };
            }
          }
          throw new Error("direct /safe title has no opaque route ancestor");
        });
        assert.match(
          surface.color,
          /^rgb\(/,
          `${colorScheme} direct /safe uses an opaque non-transparent route surface`,
        );
        assert.notEqual(
          surface.color,
          "rgb(0, 0, 0)",
          `${colorScheme} direct /safe route surface is not a black tail`,
        );
        assert.ok(
          surface.top <= 0 && surface.bottom >= surface.scrollHeight,
          `${colorScheme} direct /safe opaque surface covers the complete legitimate document height`,
        );
      },
    );
});

test("code input has visible keyboard focus in light and dark", async () => {
  for (const colorScheme of ["light", "dark"]) {
    await withSession(
      { width: 1175, height: 1098 },
      { colorScheme },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.code.focus();
        const focusStyle = await controls.code.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.outlineStyle, style.outlineWidth, style.boxShadow];
        });
        assert.ok(
          (focusStyle[0] !== "none" && focusStyle[1] !== "0px") ||
            focusStyle[2] !== "none",
        );
      },
    );
  }
});

test("preserved routes load without local asset failures", async () => {
  for (const route of ["/", "/safe", "/example", "/example2"]) {
    await withSession(
      { width: 1175, height: 1098 },
      { route },
      async ({ page }) => {
        assert.equal(await page.locator("body").isVisible(), true);
      },
    );
  }
});
}

function register03() {


test("SC05 D09-D11: approved protected zones remain reachable and non-overlapping at every viewport", async () => {
  for (const [width, height] of [
    [320, 600],
    [390, 844],
    [768, 800],
    [1280, 600],
    [1440, 900],
  ]) {
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        const normalCat = await visibleAlphaBounds(page, controls.cat);
        await controls.hint.click();
        await visibleQuestionAnswer(page);
        await waitForStableVisualGeometry(page);
        await settleViewportAtTop(page);
        const rewardBubble = await exact(
          page.getByLabel("New hint reward", { exact: true }).locator("p"),
          `${width}x${height} reward speech bubble`,
        );
        const safeScene = page.getByLabel("Safe closed", { exact: true });
        const [heading, instruction, safeBox, form, bubble, safeAlpha] =
          await Promise.all([
            page
              .getByRole("heading", { name: "Guess the number", exact: true })
              .boundingBox(),
            controls.instruction.boundingBox(),
            safeScene.boundingBox(),
            controls.code.boundingBox(),
            rewardBubble.boundingBox(),
            visibleAlphaBounds(page, safeScene),
          ]);
        for (const [name, box] of Object.entries({
          heading,
          instruction,
          safeBox,
          form,
          bubble,
          safeAlpha,
          normalCat,
        }))
          assert.ok(
            box && box.width > 0 && box.height > 0,
            `${width}x${height} ${name} renders`,
          );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth),
          width,
          `${width}x${height} has no horizontal overflow`,
        );
        const protectedZones = {
          heading,
          instruction,
          form,
          ...(width > 600 ? { safe: safeAlpha } : {}),
        };
        for (const [name, protectedBox] of Object.entries(protectedZones))
          assert.equal(
            intersects(bubble, protectedBox, requiredHeaderGap(width, height)),
            false,
            `${width}x${height} speech bubble preserves its breakpoint protected gap from ${name}: bubble=${JSON.stringify(bubble)}, protected=${JSON.stringify(protectedBox)}`,
          );
        for (const control of [
          controls.code,
          controls.submit,
          controls.newRound,
          controls.surrender,
          controls.hint,
          controls.history,
        ]) {
          await control.scrollIntoViewIfNeeded();
          const box = await control.boundingBox();
          assert.ok(
            box.x >= 0 &&
              box.x + box.width <= width &&
              box.y >= 0 &&
              box.y + box.height <= height,
            `${width}x${height} ${await control.innerText()} remains reachable`,
          );
        }
      },
    );
  }
});

test("SC05 D10: New game alone runs the 720ms title curve, restarts cleanly, and settles canonically", async () => {
  await withSession({ width: 768, height: 800 }, { clockStart: fixedClockStart }, async ({ page }) => {
    const controls = await gameControls(page);
    const curve = await exact(
      page
        .getByRole("heading", { name: "Guess the number", exact: true })
        .locator('svg[aria-hidden="true"] defs path'),
      "decorative title curve",
    );
    const canonical = "M 36 59 Q 200 4 364 59";
    assert.equal(
      await curve.getAttribute("d"),
      canonical,
      "initial title is canonical",
    );
    await controls.code.fill("7");
    await controls.submit.click();
    await page.clock.runFor(800);
    assert.equal(
      await curve.getAttribute("d"),
      canonical,
      "guess feedback cannot trigger title motion",
    );
    await controls.hint.click();
    await page.keyboard.press("Escape");
    assert.equal(
      await curve.getAttribute("d"),
      canonical,
      "hint activity cannot trigger title motion",
    );
    const keyframes = [
      [130, 76],
      [288, -30],
      [439, 32],
      [569, 0],
    ];
    for (const [elapsed, expectedY] of keyframes) {
      await controls.newRound.click();
      await page.clock.runFor(0);
      assert.equal(
        await curve.getAttribute("d"),
        canonical,
        "each New game begins the replacement sequence at canonical",
      );
      await page.clock.runFor(elapsed);
      approximatelyEqual(
        titleControlPointY(await curve.getAttribute("d")),
        expectedY,
        4,
        `approved damped keyframe near ${elapsed}ms`,
      );
    }
    await controls.newRound.click();
    await page.clock.runFor(0);
    assert.equal(
      await curve.getAttribute("d"),
      canonical,
      "rapid New game cancels and restarts from canonical",
    );
    await page.clock.runFor(721);
    assert.equal(
      await curve.getAttribute("d"),
      canonical,
      "one 720ms sequence settles exactly at canonical",
    );
  });
});

test("SC05 D10: title remains static at 390px and under reduced motion", async () => {
  for (const options of [
    { viewport: { width: 390, height: 844 } },
    { viewport: { width: 768, height: 800 }, reduced: true },
  ]) {
    await withSession(options.viewport, { clockStart: fixedClockStart }, async ({ page }) => {
      if (options.reduced) await page.emulateMedia({ reducedMotion: "reduce" });
      const controls = await gameControls(page);
      const curve = await exact(
        page
          .getByRole("heading", { name: "Guess the number", exact: true })
          .locator('svg[aria-hidden="true"] defs path'),
        "static title curve",
      );
      const canonical = await curve.getAttribute("d");
      await controls.newRound.click();
      await page.clock.runFor(750);
      assert.equal(
        await curve.getAttribute("d"),
        canonical,
        "suppressed-motion title does not bend",
      );
    });
  }
});

test("SC05 D12: menu controls preserve exact source geometry and default, hover, active, focus, disabled, narrow, and reduced-motion states", async () => {
  await withSession({ width: 1280, height: 600 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    for (const [button, expectedPath] of [
      [
        controls.newRound,
        "M6 4.5c0-1.2 1.3-1.9 2.3-1.2l11 7.5a1.5 1.5 0 0 1 0 2.4l-11 7.5C7.3 21.4 6 20.7 6 19.5Z",
      ],
      [
        controls.surrender,
        "M20 4v5h-5M4 20v-5h5M4.8 8a8 8 0 0 1 13.1-3L20 9M4 15l2.1 4A8 8 0 0 0 19.2 16",
      ],
      [controls.hint, "M12 5a6 6 0 0 0-4 10.5V18h8v-2.5A6 6 0 0 0 12 5Z"],
    ]) {
      const icon = await exact(
        button.locator('svg[viewBox="0 0 24 24"]'),
        "D12 menu SVG icon",
      );
      assert.equal(
        await icon.locator("path").first().getAttribute("d"),
        expectedPath,
        "D12 keeps exact supplied SVG path geometry",
      );
      assert.deepEqual(
        await icon.evaluate((element) => [
          getComputedStyle(element).width,
          getComputedStyle(element).height,
        ]),
        ["30px", "30px"],
        "D12 keeps the 30px icon box",
      );
    }
    const initial = await controls.newRound.evaluate((element) => {
      const style = getComputedStyle(element);
      return [
        style.borderTopWidth,
        style.borderRadius,
        style.minHeight,
        style.backgroundImage,
      ];
    });
    assert.deepEqual(
      initial.slice(0, 3),
      ["3px", "24px", "64px"],
      "D12 default menu border, radius, and height match source CSS",
    );
    assert.match(
      initial[3],
      /linear-gradient/,
      "D12 default menu background is a gradient",
    );
    const defaultStyle = await controls.newRound.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.boxShadow, style.transitionDuration];
    });
    assert.match(
      defaultStyle[0],
      /0px 5px 14px/,
      "D12 default shadow retains 5px/14px component",
    );
    assert.match(
      defaultStyle[0],
      /0px 1px 0px 0px inset|inset 0px 1px 0px/,
      "D12 default shadow retains serialized inset component",
    );
    assert.equal(
      defaultStyle[1],
      "0.16s, 0.16s, 0.16s",
      "D12 default transition is 160ms",
    );
    for (const [button, top, bottom] of [
      [controls.newRound, "rgb(217, 248, 220)", "rgb(191, 237, 196)"],
      [controls.surrender, "rgb(214, 235, 255)", "rgb(185, 218, 245)"],
      [controls.hint, "rgb(231, 220, 255)", "rgb(216, 199, 248)"],
      [controls.history, "rgb(255, 231, 210)", "rgb(255, 212, 178)"],
    ]) {
      const background = await button.evaluate(
        (element) => getComputedStyle(element).backgroundImage,
      );
      assert.equal(
        background.includes(top),
        true,
        "D12 keeps exact top gradient colour",
      );
      assert.equal(
        background.includes(bottom),
        true,
        "D12 keeps exact bottom gradient colour",
      );
    }
    await controls.newRound.focus();
    assert.deepEqual(
      await controls.newRound.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.outlineWidth, style.outlineColor, style.outlineOffset];
      }),
      ["3px", "rgb(128, 99, 210)", "4px"],
      "D12 keyboard focus uses supplied violet outline",
    );
    await controls.newRound.hover();
    await page.waitForTimeout(180);
    const hoverStyle = await controls.newRound.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.transform, style.filter, style.boxShadow];
    });
    assert.match(
      hoverStyle[0],
      /matrix\(1, 0, 0, 1, 0, -2\)/,
      "fine-pointer hover lifts exactly 2px",
    );
    assert.match(
      hoverStyle[1],
      /brightness\(1\.025\)/,
      "fine-pointer hover applies exact brightness",
    );
    assert.match(
      hoverStyle[2],
      /0px 9px 20px/,
      "fine-pointer hover applies 9px/20px shadow",
    );
    const hoverBox = await controls.newRound.boundingBox();
    await page.mouse.move(
      hoverBox.x + hoverBox.width / 2,
      hoverBox.y + hoverBox.height / 2,
    );
    await page.mouse.down();
    await page.waitForTimeout(180);
    const activeStyle = await controls.newRound.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.transform, style.boxShadow];
    });
    assert.match(
      activeStyle[0],
      /matrix\(1, 0, 0, 1, 0, 1\)/,
      "held active presses exactly 1px",
    );
    assert.match(
      activeStyle[1],
      /0px 2px 5px/,
      "held active uses source 2px/5px shadow",
    );
    assert.match(
      activeStyle[1],
      /0px 2px 3px 0px inset|inset 0px 2px 3px/,
      "held active uses serialized inset shadow",
    );
    await page.mouse.up();
    await controls.code.fill("bad");
    await controls.submit.click();
    assert.equal(
      await controls.code.evaluate(
        (element) => getComputedStyle(element).borderColor,
      ),
      "rgb(197, 101, 123)",
      "D12 invalid input uses exact rose border",
    );
    await controls.surrender.click();
    await page.waitForTimeout(180);
    assert.equal(
      await controls.surrender.evaluate(
        (element) => getComputedStyle(element).opacity,
      ),
      "0.5",
      "D12 disabled control is visibly distinct",
    );
    assert.equal(
      await controls.surrender.evaluate(
        (element) => getComputedStyle(element).boxShadow,
      ),
      "none",
      "D12 disabled menu control removes its shadow",
    );
    assert.equal(
      await controls.code.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
      "rgb(235, 231, 238)",
      "D12 disabled input background is exact",
    );
    assert.deepEqual(
      await controls.code.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.color, style.cursor];
      }),
      ["rgb(98, 91, 109)", "not-allowed"],
      "D12 disabled input uses muted not-allowed state",
    );
  });
  await withSession({ width: 390, height: 844 }, {}, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const controls = await gameControls(page);
    assert.equal(
      await controls.newRound.evaluate(
        (element) => getComputedStyle(element).transitionProperty,
      ),
      "none",
      "D12 reduced motion removes menu transitions",
    );
    const box = await controls.newRound.boundingBox();
    assert.ok(
      box.width <= 420 && box.width > 0,
      "D12 narrow menu respects its 420px maximum",
    );
    const shell = controls.code.locator("xpath=..");
    assert.deepEqual(
      await Promise.all([
        controls.code.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.height, style.paddingLeft, style.fontSize];
        }),
        controls.submit.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.height, style.flexBasis, style.fontSize];
        }),
        shell.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.borderRadius, style.paddingLeft, style.gap];
        }),
      ]),
      [
        ["56px", "14px", "16px"],
        ["56px", "84px", "18px"],
        ["24px", "8px", "8px"],
      ],
      "D12 <=600px exact shell/input/submit gaps, padding, radius, and fonts apply",
    );
  });
  await withSession(
    { width: 390, height: 844 },
    { hasTouch: true },
    async ({ page }) => {
      const controls = await gameControls(page);
      const box = await controls.newRound.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(180);
      assert.equal(
        await controls.newRound.evaluate(
          (element) => getComputedStyle(element).transform,
        ),
        "none",
        "coarse/touch pointer does not receive fine-pointer hover lift",
      );
    },
  );
});

test("SC05 D13 / SC06: selected scene, safe, dial, dialog, operator, and approved popup artwork render at their public states", async () => {
  await withSession(
    { width: 1440, height: 900 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      const renderedReferences = await page
        .locator("*")
        .evaluateAll((elements) =>
          elements.map((element) => ({
            background: getComputedStyle(element).backgroundImage,
            src:
              element instanceof HTMLImageElement
                ? element.currentSrc || element.src
                : "",
          })),
        );
      for (const filename of [
        "scene-background-wide.webp",
        "safe-closed-720.webp",
        "safe-dial-256.webp",
      ])
        assert.equal(
          renderedReferences.some(
            (reference) =>
              reference.background.includes(filename) ||
              reference.src.includes(filename),
          ),
          true,
          `${filename} renders in its approved initial state`,
        );
      await controls.hint.click();
      const dialog = await exact(
        page.getByRole("dialog", { name: "Solve a quick math question" }),
        "D13 hint dialog",
      );
      const dialogReferences = await sc06RenderedReferences(dialog);
      for (const filename of [
        "operator-add-256.png",
        "operator-subtract-256.png",
        "operator-multiply-256.png",
        "operator-divide-256.png",
        "hint-popup-background-1327.png",
        "hint-popup-calculator-320.png",
        "hint-popup-lamp-320.png",
        "hint-popup-cat-thinking-640.png",
      ])
        assert.equal(
          dialogReferences.some(
            (reference) =>
              reference.background.includes(filename) ||
              reference.source.includes(filename),
          ),
          true,
          `${filename} renders in the dialog`,
        );
      for (const name of [
        "Addition",
        "Subtraction",
        "Multiplication",
        "Division",
        "Random operator",
      ])
        await exact(
          page.getByRole("button", { name, exact: true }),
          `${name} keeps its accessible label`,
        );
      await exact(
        page.getByRole("button", { name: "New question", exact: true }),
        "New question accessible action",
      );
      await page
        .getByRole("button", { name: "Close hint challenge", exact: true })
        .click();
      await controls.code.fill("42");
      await controls.submit.click();
      const openedReferences = await page.locator("*").evaluateAll((elements) =>
        elements.map((element) => ({
          background: getComputedStyle(element).backgroundImage,
          src:
            element instanceof HTMLImageElement
              ? element.currentSrc || element.src
              : "",
        })),
      );
      assert.equal(
        openedReferences.some(
          (reference) =>
            reference.background.includes("safe-open-720.webp") ||
            reference.src.includes("safe-open-720.webp"),
        ),
        true,
        "open safe artwork renders after a public win",
      );
    },
  );
  await withSession({ width: 390, height: 844 }, {}, async ({ page }) => {
    const backgroundOwner = await exact(
      page.locator("main").locator("xpath=.."),
      "D13 route background owner",
    );
    assert.match(
      await backgroundOwner.evaluate(
        (element) => getComputedStyle(element).backgroundImage,
      ),
      /scene-background-tall\.webp/,
      "D13 narrow route selects the portrait scene background from its actual route owner",
    );
    const controls = await gameControls(page);
    await controls.hint.click();
    const dialog = await exact(
      page.getByRole("dialog", { name: "Solve a quick math question" }),
      "D13 narrow dialog",
    );
    const paintedBackground = await dialog.evaluate((element) => ({
      image: getComputedStyle(element).backgroundImage,
      size: getComputedStyle(element).backgroundSize,
    }));
    assert.match(
      paintedBackground.image,
      /hint-popup-narrow-background-1254\.png/,
      "D13 paints the approved narrow popup background on mobile",
    );
    assert.equal(
      paintedBackground.size,
      "cover",
      "D13 mobile crops the narrow background without squeezing its decorations",
    );
  });
  await withSession(
    { width: 390, height: 844 },
    {
      beforeGoto: async (page) =>
        page.route("**/safe-closed-720.webp", (route) => route.abort()),
      isExpectedLocalFailure: (url) => url.endsWith("/safe-closed-720.webp"),
      isExpectedConsoleFailure: (message) =>
        message === "Failed to load resource: net::ERR_FAILED",
    },
    async ({ page }) => {
      const safe = await exact(
        page.getByLabel("Safe closed", { exact: true }),
        "failed selected-safe fallback",
      );
      const box = await safe.boundingBox();
      assert.ok(
        box.width > 0 && box.height > 0,
        "failed selected safe retains a labelled visible fallback box",
      );
    },
  );
});

test("SC05 D12: every enabled action control shares the authoritative fine-pointer, active, focus, and coarse-pointer contract", async () => {
  await withSession({ width: 1280, height: 600 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    const historyIcon = await exact(
      controls.history.locator('svg[viewBox="0 0 24 24"]'),
      "History source SVG",
    );
    assert.equal(
      await historyIcon.locator("rect").count(),
      3,
      "History has exactly three source bars",
    );
    assert.deepEqual(
      await historyIcon
        .locator("rect")
        .evaluateAll((rectangles) =>
          rectangles.map((rect) => [
            rect.getAttribute("x"),
            rect.getAttribute("y"),
            rect.getAttribute("width"),
            rect.getAttribute("height"),
            rect.getAttribute("rx"),
          ]),
        ),
      [
        ["2", "12", "5", "10", "1.5"],
        ["9.5", "2", "5", "20", "1.5"],
        ["17", "7", "5", "15", "1.5"],
      ],
      "History preserves authoritative bar geometry",
    );
    for (const control of [
      controls.newRound,
      controls.surrender,
      controls.hint,
      controls.history,
      controls.submit,
    ]) {
      assert.equal(
        await control.evaluate((element) =>
          getComputedStyle(element)
            .transitionDuration.split(",")
            .every((duration) => duration.trim() === "0.16s"),
        ),
        true,
        `${await control.innerText()} has only 160ms shared transitions`,
      );
      await control.focus();
      assert.deepEqual(
        await control.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.outlineWidth, style.outlineColor, style.outlineOffset];
        }),
        ["3px", "rgb(128, 99, 210)", "4px"],
        `${await control.innerText()} has shared focus-visible treatment`,
      );
      await control.hover();
      await page.waitForTimeout(180);
      const hovered = await control.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.transform, style.filter, style.boxShadow];
      });
      assert.match(
        hovered[0],
        /matrix\(1, 0, 0, 1, 0, -2\)/,
        `${await control.innerText()} fine hover lifts -2px`,
      );
      assert.match(
        hovered[1],
        /brightness\(1\.025\)/,
        `${await control.innerText()} fine hover brightens 1.025`,
      );
      assert.match(
        hovered[2],
        /0px 9px 20px/,
        `${await control.innerText()} fine hover has 9px/20px shadow`,
      );
      const box = await control.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(180);
      const active = await control.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.transform, style.boxShadow];
      });
      assert.match(
        active[0],
        /matrix\(1, 0, 0, 1, 0, 1\)/,
        `${await control.innerText()} held active presses 1px`,
      );
      assert.match(
        active[1],
        /0px 2px 5px/,
        `${await control.innerText()} held active has source shadow`,
      );
      assert.match(
        active[1],
        /0px 2px 3px 0px inset|inset 0px 2px 3px/,
        `${await control.innerText()} held active has serialized inset shadow`,
      );
      await page.mouse.move(0, 0);
      await page.mouse.up();
    }
  });
  await withSession(
    { width: 390, height: 844 },
    { hasTouch: true },
    async ({ page }) => {
      const controls = await gameControls(page);
      for (const control of [
        controls.newRound,
        controls.surrender,
        controls.hint,
        controls.history,
        controls.submit,
      ]) {
        const box = await control.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(180);
        assert.equal(
          await control.evaluate(
            (element) => getComputedStyle(element).transform,
          ),
          "none",
          `${await control.innerText()} coarse pointer does not hover-lift`,
        );
      }
    },
  );
});

test("SC05 D15/D18/D23: one accessible curved title and subtitle retain the canonical public SVG and responsive typography", async () => {
  for (const [width, height, fontSize, subtitleSize, subtitleWeight] of [
    [1440, 900, "44px", "18px", "600"],
    [390, 844, "38px", "16px", "600"],
    [321, 838, "38px", "16px", "600"],
  ]) {
    await withSession({ width, height }, {}, async ({ page }) => {
      const heading = await exact(
        page.getByRole("heading", { name: "Guess the number", exact: true }),
        `${width}px accessible title`,
      );
      assert.equal(
        await page.getByRole("heading").count(),
        1,
        "D15 exposes exactly one title heading",
      );
      const svg = await exact(
        heading.locator('svg[aria-hidden="true"]'),
        "D18 decorative title SVG",
      );
      assert.equal(
        await svg.getAttribute("viewBox"),
        "0 0 400 72",
        "D18 current title viewBox is 400 by 72",
      );
      const arc = await exact(
        svg.locator("defs path"),
        "D15 title arc definition",
      );
      assert.equal(
        await arc.getAttribute("d"),
        "M 36 59 Q 200 4 364 59",
        "D15 canonical title arc is exact",
      );
      const textPath = await exact(
        svg.locator("textPath"),
        "D15 curved title text",
      );
      assert.deepEqual(
        [
          await textPath.getAttribute("textLength"),
          await textPath.getAttribute("startOffset"),
          await textPath.textContent(),
        ],
        ["300", "50%", "Guess the number"],
        "D15 title copy and arc length are exact",
      );
      const marks = await exact(
        svg.locator(":scope > path"),
        "D23 separated decorative side marks",
      );
      assert.equal(
        await marks.getAttribute("d"),
        "M 15 35 L 24 40 M 14 51 L 23 47 M 376 40 L 385 35 M 377 47 L 386 51",
        "D23 side marks are separate and symmetric",
      );
      assert.equal(
        await heading.evaluate((element) => getComputedStyle(element).fontSize),
        fontSize,
        "D18 title typography follows the active scale band",
      );
      const instruction = await exact(
        page.getByText("Enter a whole code from 1 to 1000.", { exact: true }),
        "D15 single subtitle",
      );
      assert.equal(
        await instruction.count(),
        1,
        "D15 keeps one public subtitle",
      );
      assert.deepEqual(
        await instruction.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.fontSize, style.fontWeight];
        }),
        [subtitleSize, subtitleWeight],
        "D15 keeps the approved subtitle weight and active breakpoint size",
      );
    });
  }
  await withSession({ width: 768, height: 800 }, { clockStart: fixedClockStart }, async ({ page }) => {
    const controls = await gameControls(page);
    const arc = page
      .getByRole("heading", { name: "Guess the number", exact: true })
      .locator("defs path");
    for (const [elapsed, expected] of [
      [0, 4],
      [130, 76],
      [288, -30],
      [439, 32],
      [569, 0],
      [720, 4],
    ]) {
      await controls.newRound.click();
      await page.clock.runFor(elapsed);
      approximatelyEqual(
        titleControlPointY(await arc.getAttribute("d")),
        expected,
        4,
        `D15 damped title control at ${elapsed}ms`,
      );
    }
  });
});

test("SC05 D16/D17/D19/D22/D24/D26: visible artwork, scale bands, dial and subtitle clearance stay coherent", async () => {
  const viewports = [
    [2560, 1277],
    [1440, 900],
    [1280, 800],
    [605, 838],
    [599, 838],
    [390, 844],
    [321, 838],
    [2554, 436],
    [2554, 450],
  ];
  for (const [width, height] of viewports)
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        const safe = page.getByLabel("Safe closed", { exact: true });
        const [safeAlpha, idleAlpha, subtitle] = await Promise.all([
          visibleAlphaBounds(page, safe),
          visibleAlphaBounds(page, controls.cat),
          controls.instruction.boundingBox(),
        ]);
        const title = await page
          .getByRole("heading", { name: "Guess the number", exact: true })
          .boundingBox();
        const safeGap = paintedCatSafeGap(idleAlpha, safeAlpha);
        assert.ok(
          safeGap >= -8 && safeGap <= 8,
          `${width}x${height} D16 painted idle cat rests on the painted safe edge: ${safeGap}px`,
        );
        assertPaintedHeaderClearance({
          catAlpha: idleAlpha,
          title,
          subtitle,
          width,
          height,
          description: `${width}x${height} D26 idle art`,
        });
        const dial = await exactHiddenChild(safe, "D22 dial");
        const [safeBox, dialBox] = await Promise.all([
          safe.boundingBox(),
          dial.boundingBox(),
        ]);
        approximatelyEqual(
          (dialBox.x + dialBox.width / 2 - safeBox.x) / safeBox.width,
          0.4805,
          0.012,
          `${width}x${height} D22 dial x ratio`,
        );
        approximatelyEqual(
          (dialBox.y + dialBox.height / 2 - safeBox.y) / safeBox.height,
          0.5335,
          0.012,
          `${width}x${height} D22 dial y ratio`,
        );
        for (const target of [safe, controls.cat])
          assert.equal(
            (await publicAssetPresentation(target)).fit,
            "contain",
            "D17 artwork remains contained",
          );
        const shell = controls.code.locator("xpath=..");
        const expectedGap = width <= 600 ? "8px" : "12px";
        assert.deepEqual(
          await shell.evaluate((element) => {
            const style = getComputedStyle(element);
            return [style.gap, style.backgroundColor];
          }),
          [expectedGap, "rgba(255, 253, 254, 0.95)"],
          `${width}x${height} D16 form shell uses its real paper surface and active gap`,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${width}x${height} D24 has no horizontal page overflow`,
        );
        if (width >= 1280 && height > 600)
          assert.deepEqual(
            await page.evaluate(() => [
              document.documentElement.scrollHeight,
              innerHeight,
            ]),
            [height, height],
            `${width}x${height} D24 desktop has no empty vertical scroll`,
          );
        if (width >= 1280 && height <= 600)
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollHeight >= 860 && innerHeight <= 600),
            true,
            `${width}x${height} D24 short-wide preserves readable controls through intentional vertical scroll`,
          );
        if (width === 321) {
          const background = await page.locator("main").evaluate((element) => {
            const owner = [
              element,
              ...(element.parentElement
                ? [
                    element.parentElement,
                    ...(element.parentElement.parentElement
                      ? [element.parentElement.parentElement]
                      : []),
                  ]
                : []),
            ].find(
              (candidate) =>
                getComputedStyle(candidate).backgroundImage !== "none",
            );
            const rect = owner.getBoundingClientRect();
            const style = getComputedStyle(owner);
            return {
              image: style.backgroundImage,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              scrollHeight: document.documentElement.scrollHeight,
            };
          });
          assert.match(
            background.image,
            /scene-background-tall\.webp/,
            "D24 selects the actual tall-scene background owner at 321px",
          );
          assert.ok(
            background.x <= 0 && background.x + background.width >= width,
            "D24 background owner covers the full compact document width",
          );
          assert.ok(
            background.y <= 0 &&
              background.y + background.height >= background.scrollHeight,
            "D24 selected background owner covers legitimate compact scrolling through the document bottom",
          );
        }
      },
    );
  for (const [width, height, expectedScale] of [
    [1440, 900, 1],
    [768, 800, 1],
    [390, 844, 1],
  ])
    await withSession({ width, height }, {}, async ({ page }) => {
      const stage = await exact(
        page.locator("main > div").first(),
        `${width}x${height} responsive stage`,
      );
      const transform = await stage.evaluate(
        (element) => getComputedStyle(element).transform,
      );
      const matrix =
        transform === "none"
          ? [1, 0, 0, 1, 0, 0]
          : transform
              .match(/matrix\(([^)]+)\)/)?.[1]
              .split(",")
              .map(Number);
      assert.ok(
        matrix && matrix.length === 6,
        `${width}x${height} stage exposes a measurable scale transform`,
      );
      approximatelyEqual(
        Math.abs(matrix[0]),
        expectedScale,
        0.01,
        `${width}x${height} D17 effective ordinary-height stage scale`,
      );
      approximatelyEqual(
        Math.abs(matrix[3]),
        expectedScale,
        0.01,
        `${width}x${height} D17 preserves uniform effective scale`,
      );
    });
});

test("SC05 D19/D26: every public cat outcome has a comparable visible silhouette and preserves subtitle clearance", async () => {
  for (const [width, height] of [
    [2560, 1277],
    [1440, 900],
    [1280, 800],
    [1024, 768],
    [605, 838],
    [390, 844],
    [321, 838],
    [844, 390],
    [2554, 436],
    [2554, 450],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
        async ({ page }) => {
        const controls = await gameControls(page);
        const safe = page.getByLabel("Safe closed", { exact: true });
        const samples = [];
        const inspect = async (mode) => {
          const cat = await ordinaryOwner(page, mode, `${mode} ordinary owner`);
          const [bounds, safeAlpha] = mode === "SURRENDERED"
            ? await Promise.all([visibleAlphaBounds(page, cat), visibleAlphaBounds(page, safe)])
            : [await visibleAlphaBounds(page, cat), null];
          const subtitle = await controls.instruction.boundingBox();
          const title = await page
            .getByRole("heading", { name: "Guess the number", exact: true })
            .boundingBox();
          assertPaintedHeaderClearance({
            catAlpha: bounds,
            title,
            subtitle,
            width,
            height,
            description: `${width}px ${mode} D26 art`,
          });
          if (mode === "SURRENDERED") {
            const safeGap = paintedCatSafeGap(bounds, safeAlpha);
            assert.ok(
              safeGap >= -8 && safeGap <= 8,
              `${width}x${height} SURRENDERED painted paws remain in the approved -8..8px safe-contact band: ${safeGap}px`,
            );
          }
          samples.push({ label: mode, bounds });
        };
        await inspect("PLAYING");
        await clickVisibleArtwork(page, controls.cat);
        await inspect("PET_NORMAL");
        await controls.code.fill("41");
        await controls.submit.click();
        await inspect("WRONG");
        await controls.newRound.click();
        await controls.code.fill("42");
        await controls.submit.click();
        await inspect("WON");
        await controls.newRound.click();
        await controls.surrender.click();
        await inspect("SURRENDERED");
        const idleArea = samples[0].bounds.width * samples[0].bounds.height;
        for (const sample of samples.slice(1)) {
          const ratio = (sample.bounds.width * sample.bounds.height) / idleArea;
          const heightRatio = sample.bounds.height / samples[0].bounds.height;
          assert.ok(
            sample.label === "WON"
              ? heightRatio >= 0.9 && heightRatio <= 1.65 && ratio >= 0.5 && ratio <= 1.65
              : ratio >= 0.62 && ratio <= 1.65,
            `${width}px D19 ${sample.label} visible alpha scale remains comparable to idle: area=${ratio}, height=${heightRatio}`,
          );
        }
      },
    );
});

test("SC05 D20/D21: menu never intersects or overflows and every control remains reachable at breakpoint edges", async () => {
  for (const [width, height] of [
    [320, 838],
    [321, 838],
    [547, 838],
    [599, 838],
    [600, 838],
    [601, 838],
    [605, 838],
    [768, 800],
    [1024, 800],
  ])
    await withSession({ width, height }, {}, async ({ page }) => {
      const controls = await gameControls(page);
      const all = [
        controls.newRound,
        controls.surrender,
        controls.hint,
        controls.history,
      ];
      await page.evaluate(() => scrollTo(0, 0));
      await waitForStableVisualGeometry(page);
      const boxes = [];
      for (const control of all) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        const scroll = await page.evaluate(() => scrollY);
        assert.ok(
          box.x >= 0 &&
            box.x + box.width <= width &&
            box.y >= 0 &&
            box.y + box.height <= height,
          `${width}px ${await control.innerText()} is reachable`,
        );
        boxes.push({ ...box, y: box.y + scroll });
      }
      for (let index = 0; index < boxes.length; index += 1)
        for (let other = index + 1; other < boxes.length; other += 1)
          assert.equal(
            intersects(boxes[index], boxes[other]),
            false,
            `${width}px menu buttons ${index}/${other} do not intersect`,
          );
      const menu = controls.newRound.locator("xpath=..");
      assert.ok(
        (await menu.boundingBox()).width <= width,
        `${width}px menu container has no lateral overflow`,
      );
      if (width <= 321) {
        await page.evaluate(() => scrollTo(0, 0));
        await waitForStableVisualGeometry(page);
        const content = await Promise.all(
          all.map((control) =>
            control.evaluate((button) => {
              const scroll = scrollY;
              const buttonRect = button.getBoundingClientRect();
              const buttonBox = {
                x: buttonRect.x,
                y: buttonRect.y + scroll,
                width: buttonRect.width,
                height: buttonRect.height,
              };
              const children = [...button.children]
                .filter((child) => child.matches("svg, span, img"))
                .map((child) => {
                  const rect = child.getBoundingClientRect();
                  const style = getComputedStyle(child);
                  const textRange = document.createRange();
                  textRange.selectNodeContents(child);
                  const textRect = textRange.getBoundingClientRect();
                  return {
                    tag: child.tagName.toLowerCase(),
                    text: child.textContent.trim(),
                    x: rect.x,
                    y: rect.y + scroll,
                    width: rect.width,
                    height: rect.height,
                    clientWidth: child.clientWidth,
                    scrollWidth: child.scrollWidth,
                    lineHeight: Number.parseFloat(style.lineHeight),
                    textBox:
                      child.matches("span") && textRect.width > 0
                        ? {
                            x: textRect.x,
                            y: textRect.y + scroll,
                            width: textRect.width,
                            height: textRect.height,
                          }
                        : null,
                  };
                })
                .filter((child) => child.width > 0 && child.height > 0);
              return { buttonBox, children };
            }),
          ),
        );
        for (let index = 0; index < content.length; index += 1) {
          for (const child of content[index].children) {
            const parent = content[index].buttonBox;
            assert.ok(
              child.x >= parent.x - 1 &&
                child.y >= parent.y - 1 &&
                child.x + child.width <= parent.x + parent.width + 1 &&
                child.y + child.height <= parent.y + parent.height + 1,
              `${width}px ${child.tag} stays inside its own menu button border box`,
            );
            if (child.tag === "span" && child.text) {
              assert.ok(
                child.textBox &&
                  child.textBox.x >= parent.x - 1 &&
                  child.textBox.y >= parent.y - 1 &&
                  child.textBox.x + child.textBox.width <=
                    parent.x + parent.width + 1 &&
                  child.textBox.y + child.textBox.height <=
                    parent.y + parent.height + 1,
                `${width}px ${child.text} rendered label stays inside its own menu button border box`,
              );
              assert.ok(
                !Number.isFinite(child.lineHeight) ||
                  child.height <= child.lineHeight + 1,
                `${width}px ${child.text} label remains on one line`,
              );
            }
            for (let other = 0; other < content.length; other += 1)
              if (other !== index)
                assert.equal(
                  intersects(child, content[other].buttonBox),
                  false,
                  `${width}px ${child.tag} content does not intrude into adjacent menu button ${other}`,
                );
          }
        }
      }
    });
  const continuity = [];
  for (const [width, height] of [
    [1280, 1070],
    [1279, 1070],
    [1280, 838],
    [1279, 838],
    [769, 838],
    [768, 838],
    [601, 838],
    [600, 838],
    [599, 838],
    [360, 740],
  ])
    await withSession({ width, height }, {}, async ({ page }) => {
      const controls = await gameControls(page);
      const safe = page.getByLabel("Safe closed", { exact: true });
      const dial = await exactHiddenChild(safe, `${width}px responsive dial`);
      const [title, cat, safeBox, dialBox, form, menu, catAlpha, safeAlpha] =
        await Promise.all([
          page
            .getByRole("heading", { name: "Guess the number", exact: true })
            .boundingBox(),
          controls.cat.boundingBox(),
          safe.boundingBox(),
          dial.boundingBox(),
          controls.code.locator("xpath=..").boundingBox(),
          controls.newRound.locator("xpath=..").boundingBox(),
          visibleAlphaBounds(page, controls.cat),
          visibleAlphaBounds(page, safe),
        ]);
      for (const [name, box] of Object.entries({
        title,
        cat,
        safe: safeBox,
        dial: dialBox,
        form,
        menu,
      }))
        assert.ok(
          box && box.width > 0 && box.height > 0,
          `${width}px D21 ${name} anchor renders`,
        );
      if (width <= 600)
        assert.ok(
          title.y < catAlpha.y &&
            catAlpha.y < safeAlpha.y &&
            safeAlpha.y < form.y &&
            form.y < menu.y,
          `${width}px D21 keeps title, cat, safe, form, and menu in the approved narrow top-to-bottom order`,
        );
      else
        assert.ok(
          menu.x >= 0 &&
            menu.y >= 0 &&
            menu.x + menu.width <= width &&
            menu.y + menu.height <= height,
          `${width}x${height}px D21 desktop/tablet menu remains rendered and contained beside the scene`,
        );
      continuity.push({ width, height, safe: safeBox, dial: dialBox });
    });
  for (const width of [601, 600, 599]) {
    const sample = continuity.find((candidate) => candidate.width === width);
    approximatelyEqual(
      sample.safe.width,
      500,
      0.5,
      `${width}px D21 safe keeps its fixed 500px width`,
    );
    approximatelyEqual(
      sample.dial.width,
      104,
      0.5,
      `${width}px D21 dial keeps its fixed 104px width`,
    );
    approximatelyEqual(
      sample.dial.height,
      104,
      0.5,
      `${width}px D21 dial keeps its fixed 104px height`,
    );
  }
  const fullSizeSamples = continuity.filter(
    (sample) => Math.abs(sample.safe.width - 500) <= 0.5,
  );
  assert.ok(
    fullSizeSamples.length >= 3,
    "D21 observes the fixed 500px safe before checking its dial lock",
  );
  for (const sample of fullSizeSamples) {
    approximatelyEqual(
      sample.dial.width,
      104,
      0.5,
      `${sample.width}x${sample.height}px D21 keeps the dial at 104px while the safe is 500px`,
    );
    approximatelyEqual(
      sample.dial.height,
      104,
      0.5,
      `${sample.width}x${sample.height}px D21 keeps the dial square at 104px while the safe is 500px`,
    );
  }
  const compactSample = continuity.find((candidate) => candidate.width === 360);
  assert.ok(
    compactSample.safe.width < 500,
    "360px D21 verifies proportional dial sizing only after the safe actually shrinks below 500px",
  );
  approximatelyEqual(
    compactSample.dial.width / compactSample.safe.width,
    104 / 500,
    0.002,
    "360px D21 preserves the established 104/500 rendered dial-to-safe ratio after shrinkage",
  );
  for (const [wider, narrower] of [
    [continuity[0], continuity[1]],
    [continuity[2], continuity[3]],
    [continuity[4], continuity[5]],
    [continuity[6], continuity[7]],
    [continuity[7], continuity[8]],
  ])
    for (const part of ["safe", "dial"]) {
      for (const dimension of ["width", "height"]) {
        approximatelyEqual(
          narrower[part][dimension],
          wider[part][dimension],
          2,
          `${wider.width}x${wider.height}/${narrower.width}x${narrower.height}px D21 ${part} ${dimension} has no breakpoint-scale jump`,
        );
        assert.ok(
          narrower[part][dimension] <= wider[part][dimension] + 1,
          `${wider.width}x${wider.height}/${narrower.width}x${narrower.height}px D21 ${part} does not grow while its viewport narrows`,
        );
      }
    }
});

test("SC06 Codex P1: short tablet keeps code entry and menu separate and reachable", async () => {
  await withSession({ width: 1024, height: 600 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    const namedControls = [
      ["Safe code", controls.code],
      ["OK", controls.submit],
      ["New game", controls.newRound],
      ["Give up", controls.surrender],
      ["Show hint", controls.hint],
      ["History", controls.history],
    ];
    const documentBoxes = await Promise.all(
      namedControls.map(async ([name, control]) => {
        const box = await control.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x + scrollX,
            y: rect.y + scrollY,
            width: rect.width,
            height: rect.height,
          };
        });
        return { name, box };
      }),
    );
    const codeEntry = documentBoxes.slice(0, 2);
    const menuButtons = documentBoxes.slice(2);
    for (const entry of codeEntry)
      for (const menu of menuButtons)
        assert.equal(
          intersects(entry.box, menu.box),
          false,
          `1024x600 ${entry.name} does not overlap ${menu.name}: entry=${JSON.stringify(entry.box)}, menu=${JSON.stringify(menu.box)}`,
        );

    for (const [name, control] of namedControls) {
      await control.scrollIntoViewIfNeeded();
      const reachability = await control.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const target = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return {
          contained:
            box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= innerWidth &&
            box.y + box.height <= innerHeight,
          receivesPointer: target === element || element.contains(target),
        };
      });
      assert.deepEqual(
        reachability,
        { contained: true, receivesPointer: true },
        `1024x600 ${name} remains visibly reachable without an overlap overlay`,
      );
    }
  });
});

test("SC06 D21: the 360x740 scene keeps essential controls reachable through intentional page scrolling", async () => {
  await withSession({ width: 360, height: 740 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    await page.evaluate(() => scrollTo(0, 0));
    await waitForStableVisualGeometry(page);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "360x740 layout has no horizontal page overflow",
    );
    assert.deepEqual(
      await page.evaluate(() => ({
        clientHeight: document.documentElement.clientHeight,
        scrollHeight: document.documentElement.scrollHeight,
        scrollY,
      })),
      { clientHeight: 740, scrollHeight: 863, scrollY: 0 },
      "360x740 exposes the intentional short-document scroll path before wheel input",
    );
    await page.mouse.move(180, 370);
    await page.mouse.wheel(0, 1_000);
    await page.waitForFunction(() => scrollY > 0);
    assert.deepEqual(
      await page.evaluate(() => ({
        maxScrollY:
          document.documentElement.scrollHeight - document.documentElement.clientHeight,
        scrollY,
      })),
      { maxScrollY: 123, scrollY: 123 },
      "360x740 real wheel input reaches the intentional document-scroll endpoint",
    );
    for (const [name, control] of Object.entries({
      code: controls.code,
      newGame: controls.newRound,
      giveUp: controls.surrender,
      showHint: controls.hint,
      history: controls.history,
    })) {
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      assert.ok(
        box && box.width > 0 && box.height >= 44 &&
          box.x >= 0 && box.y >= 0 && box.x + box.width <= 360 && box.y + box.height <= 740,
        `360x740 ${name} remains reachable with a usable in-viewport target`,
      );
    }
  });
});

test("SC06: short desktop header stays visible and clear of the cat across the header cascade boundary", async () => {
  for (const [width, height] of [
    [1280, 600],
    [1280, 720],
  ])
    await withSession({ width, height }, {}, async ({ page }) => {
      const controls = await gameControls(page);
      const [title, subtitle, cat] = await Promise.all([
        page
          .getByRole("heading", { name: "Guess the number", exact: true })
          .boundingBox(),
        controls.instruction.boundingBox(),
        visibleAlphaBounds(page, controls.cat),
      ]);
      for (const [name, box] of Object.entries({ title, subtitle, cat }))
        assert.ok(
          box &&
            box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= width &&
            box.y + box.height <= height,
          `${width}x${height} short-desktop ${name} stays visible in the viewport`,
        );
      assert.ok(
        subtitle.y + subtitle.height <= cat.y - 16,
        `${width}x${height} short-desktop subtitle keeps the approved 16px cat clearance`,
      );
    });
});

test("SC05 D20: compact 2x2 menu keeps 64px controls, 18px labels, visible lamp, and all children within their own buttons", async () => {
  for (const width of [361, 375, 390, 391, 403, 420, 421])
    await withSession({ width, height: 844 }, {}, async ({ page }) => {
      const controls = await gameControls(page);
      const buttons = [
        controls.newRound,
        controls.surrender,
        controls.hint,
        controls.history,
      ];
      await page.evaluate(() => scrollTo(0, 0));
      await waitForStableVisualGeometry(page);
      const buttonBoxes = await Promise.all(
        buttons.map(async (button) => {
          const box = await button.boundingBox();
          assert.ok(box, `${width}px menu button has a visible box`);
          assert.ok(
            box.width > 0 && box.height >= 64,
            `${width}px menu button preserves a 64px minimum hit target`,
          );
          assert.equal(
            await button.evaluate(
              (element) => getComputedStyle(element).minHeight,
            ),
            "64px",
            `${width}px menu control keeps the public 64px minimum`,
          );
          return box;
        }),
      );

      assert.ok(
        Math.abs(buttonBoxes[0].y - buttonBoxes[1].y) <= 1,
        `${width}px New game and Give up are the first compact row`,
      );
      assert.ok(
        Math.abs(buttonBoxes[2].y - buttonBoxes[3].y) <= 1,
        `${width}px Show hint and History are the second compact row`,
      );
      assert.ok(
        buttonBoxes[0].x < buttonBoxes[1].x &&
          buttonBoxes[2].x < buttonBoxes[3].x,
        `${width}px both compact rows retain left-to-right columns`,
      );
      assert.ok(
        buttonBoxes[0].y + buttonBoxes[0].height <= buttonBoxes[2].y,
        `${width}px compact rows remain ordered without overlap`,
      );
      for (let index = 0; index < buttonBoxes.length; index += 1)
        for (let other = index + 1; other < buttonBoxes.length; other += 1)
          assert.equal(
            intersects(buttonBoxes[index], buttonBoxes[other]),
            false,
            `${width}px buttons ${index}/${other} never overlap`,
          );

      const children = await Promise.all(
        buttons.map((button) =>
          button.evaluate((element) => {
            const parent = element.getBoundingClientRect();
            return [...element.children].map((child) => {
              const rect = child.getBoundingClientRect();
              const style = getComputedStyle(child);
              return {
                tag: child.tagName.toLowerCase(),
                text: child.textContent.trim(),
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                fontSize: style.fontSize,
                visible:
                  style.visibility !== "hidden" &&
                  style.display !== "none" &&
                  rect.width > 0 &&
                  rect.height > 0,
              };
            });
          }),
        ),
      );
      for (let index = 0; index < children.length; index += 1)
        for (const child of children[index]) {
          const parent = buttonBoxes[index];
          assert.equal(
            child.visible,
            true,
            `${width}px ${child.tag} is visible in its menu control`,
          );
          assert.ok(
            child.x >= parent.x - 1 &&
              child.y >= parent.y - 1 &&
              child.x + child.width <= parent.x + parent.width + 1 &&
              child.y + child.height <= parent.y + parent.height + 1,
            `${width}px ${child.tag} stays inside its own button border box`,
          );
          for (let other = 0; other < buttonBoxes.length; other += 1)
            if (other !== index)
              assert.equal(
                intersects(child, buttonBoxes[other]),
                false,
                `${width}px ${child.tag} does not intrude into adjacent button ${other}`,
              );
          if (child.tag === "span")
            assert.equal(
              child.fontSize,
              "18px",
              `${width}px ${child.text} keeps the approved 18px compact label`,
            );
        }
      const lamp = await exact(
        controls.hint.locator(":scope > svg[aria-hidden='true'][focusable='false']"),
        `${width}px hint lamp`,
      );
      const expectedLampSize = 30;
      assert.deepEqual(
        await lamp.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return [
            getComputedStyle(element).visibility,
            rect.width,
            rect.height,
          ];
        }),
        ["visible", expectedLampSize, expectedLampSize],
        `${width}px hint lamp stays visibly measurable beside its label`,
      );
    });
});

test("SC05 D25: a wrong valid code is visibly rejected and any real input edit clears only transient feedback", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      await controls.code.fill("41");
      await controls.submit.click();
      assert.equal(
        await controls.code.getAttribute("aria-invalid"),
        "true",
        "D25 wrong but valid code exposes invalid state",
      );
      assert.equal(
        await controls.code.evaluate(
          (element) => getComputedStyle(element).borderColor,
        ),
        "rgb(197, 101, 123)",
        "D25 wrong code has red border",
      );
      assert.match(
        await controls.code.evaluate(
          (element) => getComputedStyle(element).boxShadow,
        ),
        /197, 101, 123/,
        "D25 wrong code has red ring",
      );
      await exact(
        page.getByText("Incorrect code, try again.", { exact: true }),
        "D25 neutral wrong feedback",
      );
      const wrongCat = await ordinaryOwner(page, "WRONG", "D25 wrong ordinary owner");
      await wrongCat.hover();
      await page.waitForTimeout(300);
      await ordinaryOwner(page, "WRONG", "D25 wrong owner survives hover");
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      await ordinaryOwner(page, "WRONG", "D25 wrong owner survives pointer leave");
      await controls.code.focus();
      await controls.code.press("Backspace");
      assert.equal(
        await controls.code.getAttribute("aria-invalid"),
        null,
        "D25 deletion clears invalid ring",
      );
      assert.equal(
        await page
          .getByText("Incorrect code, try again.", { exact: true })
          .count(),
        0,
        "D25 deletion clears transient feedback",
      );
      await expectOrdinaryReturn(page, "PLAYING", true, "D25 deletion restores playing owner");
      await controls.code.fill("77");
      assert.equal(
        await controls.code.getAttribute("aria-invalid"),
        null,
        "D25 replacement stays neutral after a real edit",
      );
      await controls.history.click();
      const history = await exact(
        page.getByRole("region", { name: "History", exact: true }),
        "D25 retained attempts History",
      );
      assert.deepEqual(
        await history.getByRole("listitem").allTextContents(),
        ["41"],
        "D25 insertion and replacement preserve completed public attempts",
      );
      await controls.history.click();
      await history.waitFor({ state: "hidden" });
      await controls.code.fill("");
      assert.equal(
        await controls.code.inputValue(),
        "",
        "D25 full clear reaches the controlled empty value",
      );
      await controls.history.click();
      const reopenedHistory = await exact(
        page.getByRole("region", { name: "History", exact: true }),
        "D25 retained attempts History after input clear",
      );
      assert.deepEqual(
        await reopenedHistory.getByRole("listitem").allTextContents(),
        ["41"],
        "D25 full clear preserves completed public attempts",
      );
      await controls.history.click();
      await reopenedHistory.waitFor({ state: "hidden" });
      await controls.code.fill("bad");
      await controls.submit.click();
      assert.equal(
        await controls.code.getAttribute("aria-invalid"),
        "true",
        "D25 invalid syntax is distinct",
      );
      await controls.code.fill("");
      assert.equal(
        await controls.code.getAttribute("aria-invalid"),
        null,
        "D25 clear after invalid syntax restores neutral input",
      );
      await expectOrdinaryReturn(page, "PLAYING", true, "D25 invalid-edit recovery uses playing owner");
    },
  );
});
}

module.exports = { register01, register02, register03 };
