const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.SAFE_CAT_BASE_URL || "http://127.0.0.1:3213";
const viewportCases = [
  [1175, 1098],
  [1440, 900],
  [768, 900],
  [390, 844],
  [320, 844],
  [1280, 600],
];

async function withSession(viewport, options, executeCase) {
  let browser;
  let context;
  let page;
  const monitorFailures = [];
  let caseFailure;
  try {
    browser = await playwright.chromium.launch({
      channel: "chrome",
      headless: true,
    });
    context = await browser.newContext({
      viewport,
      colorScheme: options.colorScheme || "light",
      hasTouch: Boolean(options.hasTouch),
      isMobile: Boolean(options.hasTouch),
    });
    if (options.random !== undefined) {
      await context.addInitScript((randomValue) => {
        Math.random = () => randomValue;
      }, options.random);
    }
    page = await context.newPage();
    if (options.beforeGoto) await options.beforeGoto(page);
    page.on("pageerror", (error) => monitorFailures.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !options.isExpectedConsoleFailure?.(message.text()) &&
        !options.isExpectedLocalFailure?.(message.text())
      )
        monitorFailures.push(`console ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      // A superseded responsive image request may be cancelled while the cat changes state.
      const requestUrl = new URL(request.url());
      const isSupersededSafeCatImage =
        request.failure()?.errorText === "net::ERR_ABORTED" &&
        request.resourceType() === "image" &&
        requestUrl.origin === new URL(baseUrl).origin &&
        requestUrl.pathname === "/_next/image" &&
        requestUrl.searchParams.get("url")?.startsWith("/safe-cat/");
      if (isSupersededSafeCatImage) return;
      if (
        request.url().startsWith(baseUrl) &&
        !options.isExpectedLocalFailure?.(request.url())
      )
        monitorFailures.push(`failed ${request.url()}`);
    });
    page.on("response", (response) => {
      if (
        response.url().startsWith(baseUrl) &&
        response.status() >= 400 &&
        !response.url().endsWith("/favicon.ico") &&
        !options.isExpectedLocalFailure?.(response.url())
      ) {
        monitorFailures.push(`${response.status()} ${response.url()}`);
      }
    });
    const response = await page.goto(
      new URL(options.route || "/", baseUrl).href,
      {
        waitUntil: "networkidle",
      },
    );
    assert.equal(
      response.status(),
      200,
      "the selected route responds successfully",
    );
    return await executeCase({ page, context, monitorFailures });
  } catch (error) {
    caseFailure = error;
    throw error;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    // Do not replace an already-reached product assertion with a cleanup monitor failure.
    if (!caseFailure)
      assert.deepEqual(
        monitorFailures,
        [],
        "browser failure monitors stay empty",
      );
  }
}

async function exact(locator, description) {
  assert.equal(
    await locator.count(),
    1,
    `${description} has exactly one public match`,
  );
  return locator;
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
    cat: page.getByLabel(/^Cat /),
  };
  for (const [description, locator] of Object.entries(controls))
    await exact(locator, description);
  return controls;
}

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
});

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

async function waitForStableVisualGeometry(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? image.decode().catch(() => {})
          : new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            }),
      ),
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}

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

async function exactHiddenChild(locator, description) {
  const child = locator.locator('[aria-hidden="true"]');
  assert.equal(
    await child.count(),
    1,
    `${description} has one decorative public layer`,
  );
  return child;
}

function intersects(first, second, gap = 0) {
  return (
    first.x < second.x + second.width + gap &&
    first.x + first.width + gap > second.x &&
    first.y < second.y + second.height + gap &&
    first.y + first.height + gap > second.y
  );
}

async function visibleTextBounds(locator) {
  return locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().toJSON();
  });
}

function visibleRotationDegrees(transform) {
  if (transform === "none") return 0;
  const values = transform
    .match(/matrix\(([^)]+)\)/)?.[1]
    .split(",")
    .map(Number);
  assert.ok(
    values && values.length === 6,
    "the visible dial transform is a 2D matrix",
  );
  return (
    (Math.round((Math.atan2(values[1], values[0]) * 180) / Math.PI) + 360) % 360
  );
}

async function visibleDialAngle(dial) {
  return visibleRotationDegrees(
    await dial.evaluate((element) => getComputedStyle(element).transform),
  );
}

async function publicAssetPresentation(locator) {
  return locator.evaluate((element) => {
    const image =
      element instanceof HTMLImageElement
        ? element
        : element.querySelector("img");
    if (image)
      return {
        reference: image.currentSrc || image.src,
        fit: getComputedStyle(image).objectFit,
      };
    const renderedElement =
      [element, ...element.querySelectorAll("*")].find(
        (candidate) => getComputedStyle(candidate).backgroundImage !== "none",
      ) || element;
    const style = getComputedStyle(renderedElement);
    return { reference: style.backgroundImage, fit: style.backgroundSize };
  });
}

// Reads the opaque pixels from the public same-origin artwork, then maps them to
// the rendered contain box.  Layout boxes include transparent WebP padding and
// are therefore not evidence of the visible cat/safe contact contract.
async function visibleAlphaBounds(locator) {
  return locator.evaluate(async (element) => {
    const rendered =
      element instanceof HTMLImageElement
        ? element
        : element.querySelector("img");
    const backgroundOwner = rendered
      ? null
      : [element, ...element.querySelectorAll("*")].find(
          (candidate) => getComputedStyle(candidate).backgroundImage !== "none",
        );
    if (
      rendered instanceof HTMLImageElement &&
      (!rendered.complete || !rendered.naturalWidth)
    ) {
      await new Promise((resolve, reject) => {
        rendered.addEventListener("load", resolve, { once: true });
        rendered.addEventListener("error", reject, { once: true });
      });
    }
    const source =
      rendered ||
      (await new Promise((resolve, reject) => {
        const url = getComputedStyle(
          backgroundOwner || element,
        ).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      }));
    const rect = (
      rendered ||
      backgroundOwner ||
      element
    ).getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width;
    let top = canvas.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < canvas.height; y += 1)
      for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    if (right < left)
      throw new Error("public artwork has no visible alpha pixels");
    const scale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height,
    );
    const offsetX = rect.x + (rect.width - canvas.width * scale) / 2;
    const offsetY = rect.y + (rect.height - canvas.height * scale) / 2;
    return {
      x: offsetX + left * scale,
      y: offsetY + top * scale,
      width: (right - left + 1) * scale,
      height: (bottom - top + 1) * scale,
    };
  });
}

// Computed dimensions are the logical component contract.  boundingBox() is
// intentionally reserved for rendered contact/overflow checks because the
// stage can apply a responsive visual scale to the entire game.
async function logicalBox(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      width: Number.parseFloat(style.width),
      height: Number.parseFloat(style.height),
      left: Number.parseFloat(style.left) || 0,
      top: Number.parseFloat(style.top) || 0,
      rendered: rect.toJSON(),
    };
  });
}

function visibleContact(first, second) {
  return intersects(first, second, 0);
}

function titleControlPointY(pathData) {
  const match = pathData?.match(/Q\s*200\s*(-?\d+(?:\.\d+)?)\s*364\s*59/);
  assert.ok(
    match,
    "the public title path retains its approved quadratic-curve geometry",
  );
  return Number(match[1]);
}

function approximatelyEqual(actual, expected, tolerance, description) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${description}: expected ${expected} ±${tolerance}, received ${actual}`,
  );
}

function transformScale(transform) {
  if (transform === "none") return 1;
  const values = transform
    .match(/matrix\(([^)]+)\)/)?.[1]
    .split(",")
    .map(Number);
  assert.ok(
    values?.length === 6,
    `expected a two-dimensional CSS transform matrix, received ${transform}`,
  );
  return values[0];
}

function transformTranslation(transform) {
  if (transform === "none") return { x: 0, y: 0 };
  const values = transform
    .match(/matrix\(([^)]+)\)/)?.[1]
    .split(",")
    .map(Number);
  assert.ok(
    values?.length === 6,
    `expected a two-dimensional CSS transform matrix, received ${transform}`,
  );
  return { x: values[4], y: values[5] };
}

function isPurple(color) {
  const channels =
    color
      .match(/\d+(?:\.\d+)?/g)
      ?.slice(0, 3)
      .map(Number) || [];
  return (
    channels.length === 3 &&
    channels[0] > channels[1] &&
    channels[2] > channels[1]
  );
}

function isErrorRed(color) {
  const channels =
    color
      .match(/\d+(?:\.\d+)?/g)
      ?.slice(0, 3)
      .map(Number) || [];
  return (
    channels.length === 3 &&
    channels[0] > 150 &&
    channels[0] > channels[1] * 1.25 &&
    channels[0] > channels[2] * 1.1
  );
}

async function earnCurrentRoundHints(page, amount) {
  const controls = await gameControls(page);
  for (let count = 0; count < amount; count += 1) {
    await controls.hint.click();
    await visibleQuestionAnswer(page);
  }
  return controls;
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
  if (await dialog.isVisible()) await page.locator("body").press("Escape");
  await dialog.waitFor({ state: "hidden" });
}

async function earnFirstHint(page) {
  const controls = await gameControls(page);
  await controls.hint.click();
  await visibleQuestionAnswer(page);
  return controls;
}

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
    { random: 0.041 },
    async ({ page }) => {
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
      await exact(
        page
          .getByRole("status")
          .getByText("Earned hint: The code is even.", { exact: true }),
        "immediate earned even fact status",
      );
      await hint.dialog.waitFor({ state: "hidden" });
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

test("controlled clock rejects obsolete leave callbacks across re-entry, restart, and terminal transitions", async () => {
  await withSession(
    { width: 1175, height: 1098 },
    { random: 0.041 },
    async ({ page }) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      const controls = await gameControls(page);
      await controls.cat.hover();
      await page.mouse.move(0, 0);
      await page.clock.runFor(100);
      await controls.cat.hover();
      await page.clock.runFor(150);
      await exact(
        page.getByLabel("Cat hover", { exact: true }),
        "re-entered cat after obsolete deadline",
      );
      await page.mouse.move(0, 0);
      await controls.newRound.click();
      await controls.cat.hover();
      await page.clock.runFor(250);
      await exact(
        page.getByLabel("Cat hover", { exact: true }),
        "new-round hover after old leave deadline",
      );
      await page.mouse.move(0, 0);
      await controls.surrender.click();
      await page.clock.runFor(250);
      await exact(
        page.getByLabel("Cat surrendered", { exact: true }),
        "terminal cat after pending leave deadline",
      );
      await page.goto("about:blank");
      await page.clock.runFor(250);
    },
  );
});

test("History anchors eight document pixels below its button and Home restores the anchor", async () => {
  await withSession({ width: 390, height: 844 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    await controls.history.click();
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
    { random: 0.041 },
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
        const targets = [emptyText, heading, handle];
        const emptyMeasurements = [];
        for (const target of targets) {
          emptyMeasurements.push(
            contrastRatio(
              await target.evaluate(
                (element) => getComputedStyle(element).color,
              ),
              await opaqueAncestorBackground(target),
            ),
          );
        }
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
        const populatedMeasurements = [];
        for (const target of [
          populatedPanel.getByRole("heading", { name: "History", exact: true }),
          page.getByRole("button", { name: "Move History", exact: true }),
        ]) {
          populatedMeasurements.push(
            contrastRatio(
              await target.evaluate(
                (element) => getComputedStyle(element).color,
              ),
              await opaqueAncestorBackground(target),
            ),
          );
        }
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

test("SC05 D02: public cat states use the approved contained WebP family and retain a labelled stable fallback box", async () => {
  await withSession(
    { width: 1440, height: 900 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      const expected = [
        ["Cat idle", "cat-idle-768.webp", [272, 204]],
        ["Cat hover", "cat-attention-768.webp", [272, 204]],
        ["Cat wrong", "cat-wrong-768.webp", [272, 204]],
        ["Cat won", "cat-won-640.webp", [272, 204]],
        ["Cat surrendered", "cat-surrendered-640.webp", [272, 204]],
      ];
      const inspect = async (label, asset, dimensions) => {
        const cat = await exact(
          page.getByLabel(label, { exact: true }),
          `${label} public state`,
        );
        const box = await logicalBox(cat);
        assert.deepEqual(
          [Math.round(box.width), Math.round(box.height)],
          dimensions,
          `${label} keeps its approved logical scene box before stage scale`,
        );
        const presentation = await publicAssetPresentation(cat);
        assert.match(
          presentation.reference,
          new RegExp(asset),
          `${label} loads its exact approved derivative`,
        );
        assert.equal(
          presentation.fit,
          "contain",
          `${label} never crops the character`,
        );
      };
      await inspect(...expected[0]);
      await controls.cat.hover();
      await inspect(...expected[1]);
      await page.mouse.move(0, 0);
      await controls.code.fill("41");
      await controls.submit.click();
      await inspect(...expected[2]);
      await controls.newRound.click();
      await controls.code.fill("42");
      await controls.submit.click();
      await inspect(...expected[3]);
      await controls.newRound.click();
      await controls.surrender.click();
      await inspect(...expected[4]);
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
      requestUrl.searchParams.get("url") === "/safe-cat/cat-idle-768.webp"
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
      const fallback = await exact(
        page.getByLabel("Cat idle", { exact: true }),
        "failed-asset fallback",
      );
      const box = await logicalBox(fallback);
      assert.ok(
        interceptedIdleOptimizerRequests >= 1,
        "the selected idle Next/Image optimizer request is actually intercepted",
      );
      assert.deepEqual(
        [Math.round(box.width), Math.round(box.height)],
        [208, 156],
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
    { hasTouch: true },
    async ({ page }) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      const controls = await gameControls(page);
      const pet = await exact(
        page.getByRole("button", { name: "Pet the cat", exact: true }),
        "petting target",
      );
      const petBox = await pet.boundingBox();
      assert.ok(petBox, "petting target has a rendered click area");
      const initialLayout = await page.locator("main").boundingBox();
      const bubbles = await exact(
        pet.locator(':scope > [aria-hidden="true"]:not(:has(img))'),
        "aria-hidden heart overlay",
      );
      const heartOrigins = () =>
        bubbles
          .locator(":scope > *")
          .evaluateAll((elements) =>
            elements.map((element) => [
              element.style.getPropertyValue("--origin-x"),
              element.style.getPropertyValue("--origin-y"),
            ]),
          );
      const resolvedPointerOrigin = (position, round = Math.floor) => ({
        x: round(petBox.x + position.x) - petBox.x,
        y: round(petBox.y + position.y) - petBox.y,
      });
      const originStyle = (position, round) => [
        `${resolvedPointerOrigin(position, round).x}px`,
        `${resolvedPointerOrigin(position, round).y}px`,
      ];
      const pointerOrigin = {
        x: Math.round(petBox.width * 0.24),
        y: Math.round(petBox.height * 0.36),
      };
      await page.mouse.click(
        petBox.x + pointerOrigin.x,
        petBox.y + pointerOrigin.y,
      );
      assert.equal(
        await bubbles.locator(":scope > *").count(),
        3,
        "one pet emits exactly three decorative hearts",
      );
      assert.deepEqual(
        await heartOrigins(),
        Array.from({ length: 3 }, () => originStyle(pointerOrigin)),
        "a pointer pet starts every heart at its actual in-target coordinate",
      );
      // Sample the rendered animation at one shared WAAPI instant so unused custom properties cannot
      // masquerade as three motions.
      const renderedMotion = await bubbles
        .locator(":scope > *")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const animation = element.getAnimations()[0];
            animation.pause();
            animation.currentTime = 700;
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
        ["1.4s", "1.6s", "1.8s"],
        "normal hearts render three distinct computed animation durations",
      );
      const sampledRise = renderedMotion.map((sample) =>
        Number(
          sample.transform.match(
            /matrix\([^,]+, [^,]+, [^,]+, [^,]+, [^,]+, ([^)]+)\)/,
          )?.[1],
        ),
      );
      assert.equal(
        sampledRise.every((rise) => Number.isFinite(rise) && rise < 0),
        true,
        "normal hearts visibly rise at the representative WAAPI sample",
      );
      assert.equal(
        new Set(sampledRise.map((rise) => rise.toFixed(3))).size,
        3,
        "normal hearts render three distinct sampled rises instead of static or identical motion",
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
        await bubbles.evaluate(
          (element) => getComputedStyle(element).pointerEvents,
        ),
        "none",
        "heart overlay passes pointer input through",
      );
      await page.clock.runFor(1401);
      assert.equal(
        await bubbles.locator(":scope > *").count(),
        2,
        "the 1.4s heart cleans up independently before the longer hearts",
      );
      await page.clock.runFor(200);
      assert.equal(
        await bubbles.locator(":scope > *").count(),
        1,
        "the 1.6s heart cleans up independently before the 1.8s heart",
      );
      await page.clock.runFor(200);
      assert.equal(
        await bubbles.locator(":scope > *").count(),
        0,
        "the first burst is fully cleaned up by its 1.8s lifecycle",
      );
      const rejectedTouchOrigin = {
        x: Math.round(petBox.width * 0.72),
        y: Math.round(petBox.height * 0.62),
      };
      await pet.tap({ position: rejectedTouchOrigin });
      assert.equal(
        await bubbles.locator(":scope > *").count(),
        3,
        "a fresh touch burst emits exactly three hearts",
      );
      await pet.tap({ position: pointerOrigin });
      assert.equal(
        await bubbles.locator(":scope > *").count(),
        3,
        "the 900ms throttle rejects an immediate touch burst",
      );
      await page.clock.runFor(900);
      await pet.tap({ position: pointerOrigin });
      assert.equal(
        await bubbles.locator(":scope > *").count(),
        6,
        "two throttled bursts cap the DOM at six hearts",
      );
      assert.deepEqual(
        (await heartOrigins()).slice(-3),
        Array.from({ length: 3 }, () => originStyle(pointerOrigin, Math.round)),
        "a later touch pet resolves to its own distinct in-target coordinate",
      );
      await page.clock.runFor(2701);
      assert.equal(
        await bubbles.locator(":scope > *").count(),
        0,
        "both throttled bursts complete their individual 1.8s cleanup",
      );
      await pet.focus();
      await page.keyboard.press("Enter");
      assert.deepEqual(
        await heartOrigins(),
        Array.from({ length: 3 }, () => [
          `${petBox.width / 2}px`,
          `${petBox.height / 2}px`,
        ]),
        "keyboard petting resolves every heart at the exact target center",
      );
      const durationsAndRises = await bubbles
        .locator(":scope > *")
        .evaluateAll((elements) =>
          elements.map((element) => [
            element.style.getPropertyValue("--duration"),
            element.style.getPropertyValue("--rise"),
          ]),
        );
      assert.deepEqual(
        durationsAndRises,
        [
          ["1400ms", "38px"],
          ["1600ms", "46px"],
          ["1800ms", "54px"],
        ],
        "normal motion uses the approved deterministic lifecycles and rises",
      );
      await page.clock.runFor(1801);
      assert.equal(
        await bubbles.locator(":scope > *").count(),
        0,
        "keyboard burst is completely cleaned up after its 1.8s maximum lifecycle",
      );
      await page.keyboard.press("Space");
      assert.deepEqual(
        await heartOrigins(),
        Array.from({ length: 3 }, () => [
          `${petBox.width / 2}px`,
          `${petBox.height / 2}px`,
        ]),
        "Space petting matches Enter at the exact target center",
      );
      await page.clock.runFor(1801);
      assert.equal(
        await bubbles.locator(":scope > *").count(),
        0,
        "Space burst is also completely cleaned up after its 1.8s maximum lifecycle",
      );
    },
  );
});

test("SC05 provider: pet status is externally described for every game outcome", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
      const controls = await gameControls(page);
      const pet = await exact(
        page.getByRole("button", { name: "Pet the cat", exact: true }),
        "petting target with external status",
      );
      const inspectDescription = async (label, state) => {
        await exact(
          page.getByLabel(label, { exact: true }),
          `${state} public cat state`,
        );
        const descriptionId = await pet.getAttribute("aria-describedby");
        assert.ok(
          descriptionId,
          `${state} pet target has an external description reference`,
        );
        const description = await exact(
          page.locator(`#${descriptionId}`),
          `${state} external pet description`,
        );
        assert.equal(
          await pet.evaluate(
            (element, id) => element.contains(document.getElementById(id)),
            descriptionId,
          ),
          false,
          `${state} pet state is not supplied only by a button descendant`,
        );
        assert.match(
          await description.innerText(),
          new RegExp(state, "i"),
          `${state} external pet description updates with the public cat outcome`,
        );
      };
      await inspectDescription("Cat idle", "idle");
      await controls.code.fill("41");
      await controls.submit.click();
      await inspectDescription("Cat wrong", "wrong");
      await controls.newRound.click();
      await controls.code.fill("42");
      await controls.submit.click();
      await inspectDescription("Cat won", "won");
      await controls.newRound.click();
      await controls.surrender.click();
      await inspectDescription("Cat surrendered", "surrendered");
    },
  );
});

test("SC05 provider: pet origins use unscaled layout coordinates across responsive layout bands", async () => {
  for (const [width, height, expectedScale] of [
    [1440, 900, 1],
    [768, 800, 1],
  ])
    await withSession({ width, height }, {}, async ({ page }) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      const controls = await gameControls(page);
      const pet = await exact(
        page.getByRole("button", { name: "Pet the cat", exact: true }),
        `${width}px pet target`,
      );
      const overlay = await exact(
        pet.locator(':scope > [aria-hidden="true"]:not(:has(img))'),
        `${width}px heart overlay`,
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
        x: Math.round(petBox.x + petBox.width * 0.27),
        y: Math.round(petBox.y + petBox.height * 0.63),
      };
      await page.mouse.click(client.x, client.y);
      const origins = await overlay
        .locator(":scope > *")
        .evaluateAll((elements) =>
          elements.map((element) => [
            Number.parseFloat(element.style.getPropertyValue("--origin-x")),
            Number.parseFloat(element.style.getPropertyValue("--origin-y")),
          ]),
        );
      const expectedPointer = [
        (client.x - petBox.x) / stageScale,
        (client.y - petBox.y) / stageScale,
      ];
      for (const origin of origins) {
        approximatelyEqual(
          origin[0],
          expectedPointer[0],
          1,
          `${width}px pointer heart x origin converts back to unscaled layout space`,
        );
        approximatelyEqual(
          origin[1],
          expectedPointer[1],
          1,
          `${width}px pointer heart y origin converts back to unscaled layout space`,
        );
      }
      await page.clock.runFor(1801);
      await pet.focus();
      await page.keyboard.press("Enter");
      const keyboardOrigins = await overlay
        .locator(":scope > *")
        .evaluateAll((elements) =>
          elements.map((element) => [
            Number.parseFloat(element.style.getPropertyValue("--origin-x")),
            Number.parseFloat(element.style.getPropertyValue("--origin-y")),
          ]),
        );
      const expectedKeyboard = [
        petBox.width / (2 * stageScale),
        petBox.height / (2 * stageScale),
      ];
      for (const origin of keyboardOrigins) {
        approximatelyEqual(
          origin[0],
          expectedKeyboard[0],
          0.01,
          `${width}px keyboard heart x origin is the exact unscaled layout centre`,
        );
        approximatelyEqual(
          origin[1],
          expectedKeyboard[1],
          0.01,
          `${width}px keyboard heart y origin is the exact unscaled layout centre`,
        );
      }
    });
});

test("SC05 D05: reduced-motion petting keeps three decorative hearts fade-only for 700ms", async () => {
  await withSession(
    { width: 390, height: 844 },
    { hasTouch: true },
    async ({ page }) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      await page.clock.pauseAt(new Date("2026-01-01T00:00:00Z"));
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
      const overlay = await exact(
        pet.locator(':scope > [aria-hidden="true"]:not(:has(img))'),
        "reduced-motion aria-hidden heart overlay",
      );
      const origin = {
        x: Math.round(petBox.width * 0.68),
        y: Math.round(petBox.height * 0.31),
      };
      const client = {
        x: Math.floor(petBox.x + origin.x),
        y: Math.floor(petBox.y + origin.y),
      };
      await pet.dispatchEvent("click", {
        detail: 1,
        clientX: client.x,
        clientY: client.y,
      });
      const hearts = overlay.locator(":scope > *");
      assert.equal(
        await hearts.count(),
        3,
        "reduced motion retains exactly three hearts",
      );
      const resolvedOrigin = [
        `${client.x - petBox.x}px`,
        `${client.y - petBox.y}px`,
      ];
      assert.deepEqual(
        await hearts.evaluateAll((elements) =>
          elements.map((element) => [
            element.style.getPropertyValue("--origin-x"),
            element.style.getPropertyValue("--origin-y"),
          ]),
        ),
        Array.from({ length: 3 }, () => resolvedOrigin),
        "reduced motion keeps the actual resolved touch origin",
      );
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
      // CSS animation progress uses the browser clock, while the paused page clock keeps cleanup
      // deterministic.
      await page.waitForTimeout(260);
      const lateOpacities = await hearts.evaluateAll((elements) =>
        elements.map((element) => Number(getComputedStyle(element).opacity)),
      );
      for (let index = 0; index < 3; index += 1)
        assert.ok(
          lateOpacities[index] < middleOpacities[index],
          "late reduced-motion heart opacity progresses toward cleanup",
        );
      await page.clock.runFor(699);
      assert.equal(
        await hearts.count(),
        3,
        "reduced-motion hearts remain present through controlled 699ms",
      );
      await page.clock.runFor(1);
      assert.equal(
        await hearts.count(),
        0,
        "reduced-motion hearts clean up exactly at controlled 700ms",
      );
      assert.equal(
        await overlay.getAttribute("aria-hidden"),
        "true",
        "reduced-motion overlay stays decorative",
      );
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
            .filter((href) => !new URL(href).origin.includes(location.origin)),
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

test("SC05 D07-D09: lamp and stored-hint card are current-round only across hover, focus, and Escape", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      const controls = await gameControls(page);
      const lamp = await exact(
        controls.hint.locator(
          'img[src$="hint-lamp-off-96.webp"], img[src$="hint-lamp-on-96.webp"]',
        ),
        "hint lamp image",
      );
      assert.match(
        await lamp.getAttribute("src"),
        /hint-lamp-off-96\.webp$/,
        "empty current-round collection renders the off lamp",
      );
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
      assert.match(
        await lamp.getAttribute("src"),
        /hint-lamp-on-96\.webp$/,
        "an accepted current fact immediately derives lamp-on",
      );
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
      await page.clock.pauseAt(await page.evaluate(() => Date.now()));
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
      await page.clock.pauseAt(await page.evaluate(() => Date.now()));
      await page.mouse.move(0, 0);
      await page.clock.runFor(199);
      assert.equal(
        await card.isVisible(),
        true,
        "leave delay is exactly 200ms",
      );
      await page.clock.runFor(1);
      assert.equal(await card.count(), 0, "card closes after its leave delay");
      await controls.hint.focus();
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
      assert.match(
        await lamp.getAttribute("src"),
        /hint-lamp-off-96\.webp$/,
        "New game removes former-round lamp state",
      );
    },
  );
});

test("SC05 D09: the stored-hint close timer cannot hide a card while keyboard focus remains inside its wrapper", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      const controls = await earnFirstHint(page);
      const card = page.getByRole("region", {
        name: "Stored hints",
        exact: true,
      });
      const leaveWrapper = async () => {
        await controls.hint.hover();
        await page.mouse.move(0, 0);
        await page.clock.runFor(200);
      };

      await controls.hint.focus();
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
    { hasTouch: true, random: 0.041 },
    async ({ page, context }) => {
      const clockStart = new Date("2026-01-01T00:00:00Z");
      await page.clock.install({ time: clockStart });
      await page.clock.pauseAt(clockStart);
      const controls = await earnFirstHint(page);
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
      if (await shortTouchDialog.count())
        await page
          .getByRole("button", { name: "Close hint challenge", exact: true })
          .click();
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
      { random: 0.041 },
      async ({ page }) => {
        const controls = await earnCurrentRoundHints(page, 4);
        await controls.hint.focus();
        const card = await exact(
          page.getByRole("region", { name: "Stored hints", exact: true }),
          `${width}x${height} stored-hint card`,
        );
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
          controls.cat.boundingBox(),
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
    { random: 0.041 },
    async ({ page }) => {
      const clockStart = new Date("2026-01-01T00:00:00Z");
      await page.clock.install({ time: clockStart });
      await page.clock.pauseAt(clockStart);
      const controls = await earnFirstHint(page);
      const reward = await exact(
        page.getByLabel("New hint reward", { exact: true }),
        "newly-earned reward presentation",
      );
      assert.equal(
        await page.getByLabel(/^Cat /).count(),
        0,
        "the earned reward replaces rather than duplicates the normal CatAvatar",
      );
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
      assert.equal(
        await page.getByLabel(/^Cat /).count(),
        1,
        "normal CatAvatar returns exactly once after reward expiry",
      );
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
      await controls.hint.focus();
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
      assert.equal(
        await page.getByLabel(/^Cat /).count(),
        0,
        "a replacement reward still owns the sole cat slot",
      );
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
      assert.equal(
        await page.getByLabel(/^Cat /).count(),
        1,
        "New game restores one normal CatAvatar when it cancels reward presentation",
      );
      await page.clock.runFor(6000);
      assert.equal(
        await page.getByLabel("New hint reward", { exact: true }).count(),
        0,
        "stale timer callbacks cannot resurrect former-round reward state",
      );
    },
  );
});

test("SC05 provider: one persistent atomic hint status and stored-card focus races stay current-round only", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
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

      await controls.hint.focus();
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
    { random: 0.041 },
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
    { hasTouch: true, random: 0.041 },
    async ({ page, context }) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      const controls = await earnFirstHint(page);
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
    { random: 0.041 },
    async ({ page }) => {
      const controls = await earnFirstHint(page);
      await controls.hint.focus();
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
      { random: 0.041 },
      async ({ page }) => {
        await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
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
        assert.equal(
          await page.getByLabel(/^Cat /).count(),
          0,
          `${width}px reward owns the cat slot instead of leaving an invisible or duplicate pet target`,
        );
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
        const normalCat = await visibleAlphaBounds(controls.cat);
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
            visibleAlphaBounds(safeScene),
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
            intersects(bubble, protectedBox, 12),
            false,
            `${width}x${height} speech bubble preserves a 12px protected gap from ${name}: bubble=${JSON.stringify(bubble)}, protected=${JSON.stringify(protectedBox)}`,
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
  await withSession({ width: 768, height: 800 }, {}, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
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
    await withSession(options.viewport, {}, async ({ page }) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
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
      "rgb(245, 242, 247)",
      "D12 disabled input background is exact",
    );
    assert.deepEqual(
      await controls.code.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.color, style.cursor];
      }),
      ["rgb(116, 109, 130)", "not-allowed"],
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
    [390, 844, "38px", "18px", "600"],
    [321, 838, "38px", "18px", "600"],
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
  await withSession({ width: 768, height: 800 }, {}, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
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
          visibleAlphaBounds(safe),
          visibleAlphaBounds(controls.cat),
          controls.instruction.boundingBox(),
        ]);
        assert.ok(
          visibleContact(safeAlpha, idleAlpha),
          `${width}x${height} D16 visible idle cat contacts visible safe`,
        );
        assert.ok(
          idleAlpha.y - (subtitle.y + subtitle.height) >= 16,
          `${width}x${height} D26 idle alpha starts at least 16px below subtitle`,
        );
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
        if (width >= 1280)
          assert.deepEqual(
            await page.evaluate(() => [
              document.documentElement.scrollHeight,
              innerHeight,
            ]),
            [height, height],
            `${width}x${height} D24 desktop has no empty vertical scroll`,
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
          ? [1, 0, 0, 1]
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
    [605, 838],
    [390, 844],
    [321, 838],
    [2554, 436],
    [2554, 450],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        const samples = [];
        const inspect = async (label) => {
          const cat = await exact(
            page.getByLabel(label, { exact: true }),
            label,
          );
          const bounds = await visibleAlphaBounds(cat);
          const subtitle = await controls.instruction.boundingBox();
          assert.ok(
            bounds.y - (subtitle.y + subtitle.height) >= 16,
            `${width}px ${label} retains D26 subtitle clearance`,
          );
          samples.push({ label, bounds });
        };
        await inspect("Cat idle");
        await controls.cat.hover();
        await inspect("Cat hover");
        await page.mouse.move(0, 0);
        await controls.code.fill("41");
        await controls.submit.click();
        await inspect("Cat wrong");
        await controls.newRound.click();
        await controls.code.fill("42");
        await controls.submit.click();
        await inspect("Cat won");
        await controls.newRound.click();
        await controls.surrender.click();
        await inspect("Cat surrendered");
        const idleArea = samples[0].bounds.width * samples[0].bounds.height;
        for (const sample of samples.slice(1)) {
          const ratio = (sample.bounds.width * sample.bounds.height) / idleArea;
          assert.ok(
            ratio >= 0.62 && ratio <= 1.65,
            `${width}px D19 ${sample.label} visible alpha scale remains comparable to idle`,
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
                child.scrollWidth <= child.clientWidth + 1,
                `${width}px ${child.text} label does not clip horizontally`,
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
          visibleAlphaBounds(controls.cat),
          visibleAlphaBounds(safe),
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

test("SC06 D21: the initial 360x740 main scene fits every essential control without page scrolling", async () => {
  await withSession({ width: 360, height: 740 }, {}, async ({ page }) => {
    const controls = await gameControls(page);
    await page.evaluate(() => scrollTo(0, 0));
    await waitForStableVisualGeometry(page);
    const safe = page.getByLabel("Safe closed", { exact: true });
    const [
      title,
      subtitle,
      cat,
      safeBox,
      form,
      newGame,
      giveUp,
      showHint,
      history,
    ] = await Promise.all([
      page
        .getByRole("heading", { name: "Guess the number", exact: true })
        .boundingBox(),
      controls.instruction.boundingBox(),
      controls.cat.boundingBox(),
      safe.boundingBox(),
      controls.code.locator("xpath=..").boundingBox(),
      controls.newRound.boundingBox(),
      controls.surrender.boundingBox(),
      controls.hint.boundingBox(),
      controls.history.boundingBox(),
    ]);
    const essential = {
      title,
      subtitle,
      cat,
      safe: safeBox,
      form,
      newGame,
      giveUp,
      showHint,
      history,
    };
    for (const [name, box] of Object.entries(essential)) {
      assert.ok(
        box && box.width > 0 && box.height > 0,
        `360x740 ${name} renders initially`,
      );
      assert.ok(
        box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= 360 &&
          box.y + box.height <= 740,
        `360x740 ${name} is fully contained in the initial viewport`,
      );
    }
    for (const [name, control] of Object.entries({
      newGame: controls.newRound,
      giveUp: controls.surrender,
      showHint: controls.hint,
      history: controls.history,
    })) {
      const metrics = await control.evaluate((element) => ({
        renderedHeight: element.getBoundingClientRect().height,
        minHeight: getComputedStyle(element).minHeight,
      }));
      assert.ok(
        metrics.renderedHeight >= 48,
        `360x740 ${name} retains a 48px rendered target`,
      );
      assert.equal(
        metrics.minHeight,
        "48px",
        `360x740 ${name} declares the compact 48px minimum`,
      );
    }
    for (const [firstName, first, secondName, second] of [
      ["title", title, "subtitle", subtitle],
      ["subtitle", subtitle, "cat", cat],
      ["safe", safeBox, "form", form],
      ["form", form, "newGame", newGame],
      ["form", form, "giveUp", giveUp],
      ["form", form, "showHint", showHint],
      ["form", form, "history", history],
      ["newGame", newGame, "giveUp", giveUp],
      ["newGame", newGame, "showHint", showHint],
      ["newGame", newGame, "history", history],
      ["giveUp", giveUp, "showHint", showHint],
      ["giveUp", giveUp, "history", history],
      ["showHint", showHint, "history", history],
    ])
      assert.equal(
        intersects(first, second),
        false,
        `360x740 ${firstName} and ${secondName} do not overlap: first=${JSON.stringify(first)}, second=${JSON.stringify(second)}`,
      );
    const before = await page.evaluate(() => ({
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
      scrollY,
    }));
    assert.ok(
      before.documentHeight <= before.viewportHeight,
      "360x740 document has no page-scroll range before interaction",
    );
    await page.keyboard.press("End");
    await page.mouse.wheel(0, 1000);
    assert.equal(
      await page.evaluate(() => scrollY),
      before.scrollY,
      "360x740 End and wheel do not require or activate page scrolling",
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
        controls.hint.locator("img[aria-hidden='true']"),
        `${width}px hint lamp`,
      );
      const expectedLampSize = width <= 420 ? 14 : 20;
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
      const wrongCat = await exact(
        page.getByLabel("Cat wrong", { exact: true }),
        "D25 wrong cat",
      );
      await wrongCat.hover();
      await page.waitForTimeout(300);
      await exact(
        page.getByLabel("Cat wrong", { exact: true }),
        "D25 wrong cat survives hover",
      );
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      await exact(
        page.getByLabel("Cat wrong", { exact: true }),
        "D25 wrong cat survives pointer leave",
      );
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
      await exact(
        page.getByLabel("Cat idle", { exact: true }),
        "D25 deletion restores idle cat",
      );
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
      await controls.code.fill("");
      assert.equal(
        await controls.code.inputValue(),
        "",
        "D25 full clear reaches the controlled empty value",
      );
      assert.deepEqual(
        await history.getByRole("listitem").allTextContents(),
        ["41"],
        "D25 full clear preserves completed public attempts",
      );
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
      await exact(
        page.getByLabel("Cat idle", { exact: true }),
        "D25 invalid-edit recovery uses idle cat",
      );
    },
  );
});

test("SC05 provider: a quick stored-hint hover then click opens only the math dialog and leaves no stale card", async () => {
  await withSession(
    { width: 1175, height: 900 },
    { random: 0.041 },
    async ({ page }) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      const controls = await earnFirstHint(page);
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

test("SC05 provider: desktop History keeps its eight-pixel anchor and both pointer and keyboard movements visibly update position", async () => {
  await withSession({ width: 1280, height: 600 }, {}, async ({ page }) => {
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
      initialPanel.y +
        initialScrollY -
        (historyButton.y + initialScrollY + historyButton.height),
      8,
      1,
      "desktop History initially anchors eight rendered pixels below its button",
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

async function advanceFrozenViewportResize(page, viewport) {
  await page.setViewportSize(viewport);
  // Advance enough frozen time for resize observers and two animation frames. The
  // caller verifies the resulting public geometry and subtracts this exact budget.
  await page.clock.runFor(100);
  return 100;
}

async function sc06RenderedReferences(locator) {
  return locator.evaluate((root) =>
    [root, ...root.querySelectorAll("*")].map((element) => ({
      background: getComputedStyle(element).backgroundImage,
      source:
        element instanceof HTMLImageElement
          ? element.currentSrc || element.src
          : "",
    })),
  );
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
          visibleAlphaBounds(lamp),
          visibleAlphaBounds(popupCat),
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
            assert.ok(
              shellBox &&
                shellBox.height >= height * 0.88 &&
                shellBox.height <= height - 24 &&
                shellBox.y >= 12 &&
                shellBox.y + shellBox.height <= height - 12,
              "943x708 popup scroll shell uses nearly all safe viewport height without shrinking its controls",
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

test("SC06: ordinary popup close and Give up restore the normal CatAvatar without replacing its visible vignette cat", async () => {
  for (const [width, height, ending] of [
    [1440, 900, "close"],
    [390, 844, "give up"],
  ])
    await withSession(
      { width, height },
      { random: 0.041 },
      async ({ page }) => {
        const controls = await gameControls(page);
        await controls.hint.click();
        const hint = await sc06Dialog(page);
        const popupCat = await exact(
          hint.dialog.locator('img[src*="hint-popup-cat-"]'),
          `${width}x${height} ordinary popup vignette cat`,
        );
        assert.equal(
          await controls.cat.isVisible(),
          false,
          `${width}x${height} ordinary popup starts with the normal CatAvatar hidden`,
        );
        assert.equal(
          await popupCat.isVisible(),
          true,
          `${width}x${height} ordinary popup starts with a visible vignette cat`,
        );
        if (ending === "close") {
          await hint.dialog
            .getByRole("button", { name: "Close hint challenge", exact: true })
            .click();
          await hint.dialog.waitFor({ state: "hidden" });
        } else await hint.giveUp.click();
        assert.equal(
          await controls.cat.isVisible(),
          true,
          `${width}x${height} ${ending} restores the normal CatAvatar after the ordinary popup state`,
        );
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
        sample.shellBacking.box.y,
        0,
        1,
        `${sample.width}px narrow shell starts at the viewport top edge`,
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
        ["auto", "scroll"].includes(sample.overflowY) &&
          sample.scrollHeight <= sample.clientHeight,
        `${sample.width}px narrow dialog keeps overflow:auto as a fallback without active dialog scrolling`,
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
          visibleAlphaBounds(vignette.locator('img[src*="hint-popup-cat-"]')),
          visibleAlphaBounds(lamp),
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
          visibleAlphaBounds(lamp),
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
          visibleAlphaBounds(cat),
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

test("SC06: 601-820px narrow challenge presents one decorated fullscreen card without scrolling", async () => {
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
            giveUpBox,
          `${width}x${height} keeps all approved tablet regions rendered`,
        );
        approximatelyEqual(
          shellMetrics.box.x,
          0,
          1,
          `${width}x${height} tablet shell begins at the viewport left edge`,
        );
        approximatelyEqual(
          shellMetrics.box.y,
          0,
          1,
          `${width}x${height} tablet shell begins at the viewport top edge`,
        );
        approximatelyEqual(
          shellMetrics.box.width,
          width,
          1,
          `${width}x${height} tablet shell spans the viewport width`,
        );
        approximatelyEqual(
          shellMetrics.box.height,
          height,
          1,
          `${width}x${height} tablet shell spans the viewport height`,
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
        approximatelyEqual(
          dialogMetrics.box.height,
          height,
          1,
          `${width}x${height} tablet dialog spans the viewport height`,
        );
        assert.ok(
          ["auto", "scroll"].includes(dialogMetrics.overflowY) &&
            dialogMetrics.scrollHeight <= dialogMetrics.clientHeight,
          `${width}x${height} tablet has no active dialog scroll range`,
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
          "none",
          `${width}x${height} header subtitle is visually and accessibility hidden`,
        );
        assert.equal(
          subtitleBox,
          null,
          `${width}x${height} hidden header subtitle has no rendered bounds`,
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
          headerBox,
          contentBox,
          vignetteBox,
          closeBox,
          expressionBox,
          answerBox,
          checkBox,
          operatorBox,
          helperBox,
          actionsBox,
          newQuestionBox,
          giveUpBox,
        }))
          assert.ok(
            box.x >= -1 &&
              box.y >= -1 &&
              box.x + box.width <= width + 1 &&
              box.y + box.height <= height + 1,
            `${width}x${height} ${name} stays visible without clipping`,
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
          ) &&
            beforeSelection.dialogMetrics.scrollHeight <=
              beforeSelection.dialogMetrics.clientHeight &&
            beforeSelection.dialogMetrics.scrollWidth <= width,
          `${width}x${height} expanded tablet operators do not clip or create scroll`,
        );
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

test("SC06: responsive narrow challenge title is centered on the full page without colliding with its close paw", async () => {
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
        assert.equal(
          await subtitle.evaluate(
            (element) => getComputedStyle(element).display,
          ),
          "none",
          `${width}x${height} narrow subtitle stays hidden`,
        );
        assert.equal(
          subtitleBox,
          null,
          `${width}x${height} hidden narrow subtitle has no bounds`,
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
          approximatelyEqual(
            closeInsets.right,
            8,
            1,
            "361px baseline keeps the established no-safe-area right inset",
          );
          approximatelyEqual(
            closeInsets.top,
            8,
            1,
            "361px baseline keeps the established no-safe-area top inset",
          );
          baselineCloseInsets = closeInsets;
        } else {
          assert.ok(
            baselineCloseInsets,
            "361px close-paw baseline is captured before narrow checks",
          );
          approximatelyEqual(
            closeInsets.right,
            baselineCloseInsets.right,
            1,
            `${width}x${height} preserves the established close-paw right inset`,
          );
          approximatelyEqual(
            closeInsets.top,
            baselineCloseInsets.top - 8,
            1,
            `${width}x${height} lifts the close paw exactly 8px above the no-safe-area baseline`,
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
          approximatelyEqual(
            surface.rect.x,
            0,
            1,
            `${width}x${height} narrow surface starts at the viewport left edge`,
          );
          approximatelyEqual(
            surface.rect.y,
            0,
            1,
            `${width}x${height} narrow surface starts at the viewport top edge`,
          );
          approximatelyEqual(
            surface.rect.width,
            width,
            1,
            `${width}x${height} narrow surface spans the viewport width`,
          );
          approximatelyEqual(
            surface.rect.height,
            height,
            1,
            `${width}x${height} narrow surface spans the viewport height`,
          );
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
          ["auto", "scroll"].includes(dialogStyle.overflowY) &&
            dialogStyle.scrollHeight <= dialogStyle.clientHeight,
          `${width}x${height} mobile dialog keeps fallback overflow inactive`,
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
            box.x >= -1 &&
              box.y >= -1 &&
              box.x + box.width <= width + 1 &&
              box.y + box.height <= height + 1,
            `${width}x${height} ${name} remains contained`,
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
            visibleAlphaBounds(cat),
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
          actions: actionsBox,
        }))
          assert.ok(
            box.x >= 0 &&
              box.y >= 0 &&
              box.x + box.width <= width &&
              box.y + box.height <= height,
            `${width}x${height} essential ${name} remains contained`,
          );

        const closeInsets = {
          right: width - (closeBox.x + closeBox.width),
          top: closeBox.y,
        };
        assert.ok(
          closeInsets.right >= 8 && closeInsets.top >= (width <= 360 ? 0 : 8),
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
        assert.equal(
          intersects(closeBox, contentBox, 0),
          false,
          `${width}x${height} close paw remains clear of challenge controls`,
        );
        const stableInsets = closeInsetsByWidth.get(width);
        if (stableInsets) {
          approximatelyEqual(
            closeInsets.right,
            stableInsets.right,
            1,
            `${width}px close paw right inset is stable across ordinary and reduced heights`,
          );
          approximatelyEqual(
            closeInsets.top,
            stableInsets.top,
            1,
            `${width}px close paw top inset is stable across ordinary and reduced heights`,
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
    { random: 0.041 },
    async ({ page }) => {
      const clockStart = new Date("2026-01-01T00:00:00Z");
      await page.clock.install({ time: clockStart });
      await page.clock.pauseAt(clockStart);
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
    { random: 0.041 },
    async ({ page }) => {
      const clockStart = new Date("2026-01-01T00:00:00Z");
      await page.clock.install({ time: clockStart });
      await page.clock.pauseAt(clockStart);
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
      { random: 0.041 },
      async ({ page }) => {
        const clockStart = new Date("2026-01-01T00:00:00Z");
        await page.clock.install({ time: clockStart });
        await page.clock.pauseAt(clockStart);
        const controls = await gameControls(page);
        await controls.hint.click();
        let hint = await sc06Dialog(page);
        let acceptedOuter;
        let acceptedLayout;
        const inspect = async (state, asset) => {
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
            visibleAlphaBounds(cat),
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
              box.x >= 0 &&
                box.y >= 0 &&
                box.x + box.width <= width &&
                box.y + box.height <= height,
              `${width}x${height} ${state} ${name} remains viewport-contained`,
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
      { random: 0.041 },
      async ({ page }) => {
        const clockStart = new Date("2026-01-01T00:00:00Z");
        await page.clock.install({ time: clockStart });
        await page.clock.pauseAt(clockStart);
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
            visibleAlphaBounds(cat),
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
              box.x >= 0 &&
                box.y >= 0 &&
                box.x + box.width <= width &&
                box.y + box.height <= height,
              `${width}x${height} ${description} ${name} remains viewport-contained`,
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
          if (height >= 768)
            assert.ok(
              dialogMetrics.scrollHeight <= dialogMetrics.clientHeight,
              `${width}x${height} ${description} keeps dialog fallback scrolling inactive when the full composition fits`,
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
            if (height >= 768)
              assert.ok(
                frame.scroll.scrollHeight <= frame.scroll.clientHeight,
                `${width}x${height} ${stage} leaves dialog fallback scrolling inactive when the full composition fits`,
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
      },
    );
});

test("SC06: invalid math answers persist a red accessible error until the first real edit, then may be rejected again", async () => {
  await withSession(
    { width: 943, height: 708 },
    { random: 0.041 },
    async ({ page }) => {
      const clockStart = new Date("2026-01-01T00:00:00Z");
      await page.clock.install({ time: clockStart });
      await page.clock.pauseAt(clockStart);
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
    { random: 0.041 },
    async ({ page }) => {
      const clockStart = new Date("2026-01-01T00:00:00Z");
      await page.clock.install({ time: clockStart });
      await page.clock.pauseAt(clockStart);
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
    { random: 0.041 },
    async ({ page }) => {
      const clockStart = new Date("2026-01-01T00:00:00Z");
      await page.clock.install({ time: clockStart });
      await page.clock.pauseAt(clockStart);
      const controls = await gameControls(page);
      await controls.hint.click();
      const hint = await sc06Dialog(page);
      const answer = solveVisibleQuestion(
        await hint.dialog.locator("label[for='hint-answer']").innerText(),
      );
      const firstAwardCommit = page.evaluate(
        () =>
          new Promise((resolve) => {
            const observer = new MutationObserver(() => {
              const earnedStatus = [
                ...document.querySelectorAll('[role="status"]'),
              ].find((element) =>
                /Earned hint:/.test(element.textContent || ""),
              );
              if (!earnedStatus) return;
              observer.disconnect();
              resolve({
                rewardCount: document.querySelectorAll(
                  '[aria-label="New hint reward"]',
                ).length,
                normalCatCount: document.querySelectorAll(
                  '[aria-label^="Cat "]',
                ).length,
                dialogCount:
                  document.querySelectorAll('[role="dialog"]').length,
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
        { rewardCount: 1, normalCatCount: 0, dialogCount: 1 },
        "the first committed earned-status DOM state already synchronously replaces the normal cat with exactly one reward behind its dialog",
      );
      await exact(
        page.getByRole("status").getByText(/Earned hint:/),
        "immediate earned fact status",
      );
      const earlyReward = await exact(
        page.getByLabel("New hint reward", { exact: true }),
        "reward cat replacement behind the success dialog",
      );
      assert.equal(
        await page.getByLabel(/^Cat /).count(),
        0,
        "earned fact immediately replaces normal CatAvatar while success dialog is still mounted",
      );
      assert.equal(
        await earlyReward.isVisible(),
        true,
        "replacement reward cat is already visible behind the success dialog",
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
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        "Show hint",
        "completion restores Show hint focus once",
      );
      const reward = await exact(
        page.getByLabel("New hint reward", { exact: true }),
        "same deferred reward presentation after dialog completion",
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
    },
  );
});

test("SC06: close paw exits at the earliest observable correct-submit completion state", async () => {
  await withSession(
    { width: 390, height: 844 },
    { random: 0.041 },
    async ({ page }) => {
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
      const close = await exact(
        hint.dialog.getByRole("button", {
          name: "Close hint challenge",
          exact: true,
        }),
        "correct-submit completion close paw",
      );
      assert.equal(
        await close.isEnabled(),
        true,
        "the close paw is enabled before correct-submit completion begins",
      );
      const completionClose = await hint.answer.evaluate((input) => {
        const form = input.closest("form");
        const dialog = input.closest('[role="dialog"]');
        const close = [...(dialog?.querySelectorAll("button") ?? [])].find(
          (button) =>
            button.getAttribute("aria-label") === "Close hint challenge",
        );
        if (!form || !dialog || !close) return null;
        const successCopy = "Great job! You earned a hint!";
        let successAbsentAtCloseActivation = false;
        close.addEventListener(
          "click",
          () => {
            successAbsentAtCloseActivation =
              !dialog.textContent?.includes(successCopy);
          },
          { capture: true, once: true },
        );
        const submitWasPrevented = !form.dispatchEvent(
          new SubmitEvent("submit", { bubbles: true, cancelable: true }),
        );
        close.click();
        return { submitWasPrevented, successAbsentAtCloseActivation };
      });
      assert.deepEqual(
        completionClose,
        { submitWasPrevented: true, successAbsentAtCloseActivation: true },
        "the public close paw activates during completionPending before success presentation is rendered",
      );
      await hint.dialog.waitFor({ state: "hidden" });
      assert.equal(
        await page
          .getByRole("dialog", {
            name: "Solve a quick math question",
            exact: true,
          })
          .count(),
        0,
        "close paw unmounts the completed dialog",
      );
      assert.equal(
        await controls.hint.evaluate(
          (element) => element === document.activeElement,
        ),
        true,
        "close paw restores focus to Show hint instead of leaking it to underlying controls",
      );
      const reward = await exact(
        page.getByLabel("New hint reward", { exact: true }),
        "earned reward after completion close",
      );
      assert.equal(
        await reward.isVisible(),
        true,
        "completion close preserves the already-earned reward",
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

test("SC06 Copilot P2: visibility reconciliation keeps one absolute concern deadline and cancels replaced callbacks", async () => {
  await withSession(
    { width: 1024, height: 768 },
    { random: 0.041 },
    async ({ page }) => {
      const clockStart = new Date("2026-01-01T00:00:00Z");
      await page.clock.install({ time: clockStart });
      await page.clock.pauseAt(clockStart);
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
    { random: 0.041 },
    async ({ page }) => {
      const clockStart = new Date("2026-01-01T00:00:00Z");
      await page.clock.install({ time: clockStart });
      await page.clock.pauseAt(clockStart);
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
      { random: 0.041 },
      async ({ page }) => {
        const clockStart = new Date("2026-01-01T00:00:00Z");
        await page.clock.install({ time: clockStart });
        await page.clock.pauseAt(clockStart);
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
      { random: 0.041 },
      async ({ page }) => {
        const clockStart = new Date("2026-01-01T00:00:00Z");
        await page.clock.install({ time: clockStart });
        await page.clock.pauseAt(clockStart);
        const controls = await gameControls(page);
        const safe = page.getByLabel("Safe closed", { exact: true });
        const [normalCat, safeAlpha, titleBefore, subtitleBefore] =
          await Promise.all([
            visibleAlphaBounds(controls.cat),
            visibleAlphaBounds(safe),
            page
              .getByRole("heading", { name: "Guess the number", exact: true })
              .boundingBox(),
            controls.instruction.boundingBox(),
          ]);
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
        assert.equal(
          await page.getByLabel(/^Cat /).count(),
          0,
          `${width}x${height} hides normal CatAvatar while reward owns its slot`,
        );
        const rewardComposite = await exact(
          reward.locator('img[src*="cat-hint-reward-lying-1448.png"][alt=""]'),
          `${width}x${height} approved composite cat-with-lamp reward artwork`,
        );
        const rewardEnvelope = await visibleAlphaBounds(rewardComposite);
        assert.ok(
          rewardEnvelope.height >= normalCat.height * 0.9 &&
            rewardEnvelope.width >= normalCat.width * 0.75,
          `${width}x${height} reward envelope does not visually shrink the normal cat presentation: normal=${JSON.stringify(normalCat)}, reward=${JSON.stringify(rewardEnvelope)}`,
        );
        approximatelyEqual(
          rewardEnvelope.y + rewardEnvelope.height,
          normalCat.y + normalCat.height,
          Math.max(18, normalCat.height * 0.18),
          `${width}x${height} reward keeps the normal cat bottom/safe-top anchor`,
        );
        assert.ok(
          Math.abs(rewardEnvelope.y + rewardEnvelope.height - safeAlpha.y) <=
            Math.max(40, safeAlpha.height * 0.18),
          `${width}x${height} reward remains aligned to the safe top`,
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
          title: titleAfter,
          subtitle: subtitleAfter,
          safe: safeAlpha,
          form: formBox,
        }))
          assert.equal(
            intersects(bubbleBox, protectedBox, 8),
            false,
            `${width}x${height} elevated reward bubble avoids ${name}: bubble=${JSON.stringify(bubbleBox)}, protected=${JSON.stringify(protectedBox)}`,
          );
        for (const [state, title, subtitle] of [
          ["before", titleBefore, subtitleBefore],
          ["reward", titleAfter, subtitleAfter],
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
          titleAfter.y,
          titleBefore.y,
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
        assert.equal(
          await page.getByLabel(/^Cat /).count(),
          1,
          `${width}x${height} normal CatAvatar returns exactly once after reward expiry`,
        );
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
        visibleAlphaBounds(cat),
        visibleAlphaBounds(safe),
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
    const anchor = safeAlpha.y - (catAlpha.y + catAlpha.height);
    assert.ok(
      anchor >= -38 && anchor <= -34,
      `${width}x${height} ${label} visible cat-to-safe anchor ${anchor}px remains in the approved -38..-34px band`,
    );
    assert.ok(
      catAlpha.y >= subtitleBox.y + subtitleBox.height + 16,
      `${width}x${height} ${label} cat remains below the subtitle`,
    );
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
        ["auto", "scroll"].includes(internalScroll.overflowY),
        "fullscreen narrow dialog retains overflow:auto as a fallback",
      );
      assert.ok(
        internalScroll.scrollHeight <= internalScroll.clientHeight &&
          internalScroll.changed === internalScroll.origin,
        "short fullscreen dialog has no active internal scroll range",
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
