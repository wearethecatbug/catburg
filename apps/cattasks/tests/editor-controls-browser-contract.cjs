const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
const catalog = {version: 1, tasks: [{
  id: "editor-fixture",
  title: "Editor fixture",
  description: "An inert catalog task for editor presentation checks.",
  entryPoint: "echo",
  starterCode: "function echo(value) { return value; }",
  solution: "function echo(value) { return value; }",
  tests: [{args: ["fixture"], expected: "fixture"}],
}]};

function diagnosticsFor(page) {
  const diagnostics = {console: [], page: [], request: [], response: [], catalogRequests: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.request.push(`${request.method()} ${request.url()}`));
  page.on("response", response => {
    if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

async function prepare(page) {
  const diagnostics = diagnosticsFor(page);
  await page.route("**/task-catalog.v1.json", route => {
    diagnostics.catalogRequests.push(`${route.request().method()} ${route.request().url()}`);
    return route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });
  const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
  assert.equal(response?.status(), 200, "the isolated dashboard route responds successfully");
  await page.getByRole("button", {name: "Test Code", exact: true}).waitFor();
  await page.getByRole("button", {name: "Run Code", exact: true}).waitFor();
  await page.getByLabel("User JavaScript code").waitFor();
  return diagnostics;
}

async function measuredControls(page) {
  return page.evaluate(() => {
    const heading = document.getElementById("taskSolutionHeading");
    const language = heading?.parentElement?.querySelector("p");
    const output = document.getElementById("taskOutputHeading");
    const test = document.querySelector("button[aria-label='Test Code']");
    const run = document.querySelector("button[aria-label='Run Code']");
    if (!heading || !language || !output || !test || !run) throw new Error("editor controls unavailable");
    const read = node => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {width: rect.width, height: rect.height, fontSize: style.fontSize, fontWeight: style.fontWeight, color: style.color, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, border: style.border, boxShadow: style.boxShadow};
    };
    const decoration = (node, pseudo) => {
      const style = getComputedStyle(node, pseudo);
      return {
        content: style.content,
        width: style.width,
        height: style.height,
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderLeftColor: style.borderLeftColor,
        borderLeftWidth: style.borderLeftWidth,
        borderTopWidth: style.borderTopWidth,
        borderBottomWidth: style.borderBottomWidth,
        clipPath: style.clipPath,
        display: style.display,
      };
    };
    const hiddenDecoration = node => [...node.querySelectorAll("[aria-hidden='true']")].flatMap(child => {
      const rect = child.getBoundingClientRect();
      const style = getComputedStyle(child);
      const own = {text: child.textContent ?? "", width: `${rect.width}px`, height: `${rect.height}px`, color: style.color, backgroundColor: style.backgroundColor, borderLeftColor: style.borderLeftColor, borderLeftWidth: style.borderLeftWidth, borderTopWidth: style.borderTopWidth, borderBottomWidth: style.borderBottomWidth, clipPath: style.clipPath};
      return [own, decoration(child, "::before"), decoration(child, "::after")];
    });
    const solutionCard = heading.closest("section");
    const headingGroup = heading.parentElement;
    const header = heading.closest("header");
    if (!solutionCard || !headingGroup || !header) throw new Error("solution card or semantic header unavailable");
    const rect = node => { const value = node.getBoundingClientRect(); return {left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height}; };
    return {
      heading: read(heading), language: read(language), output: read(output), test: read(test), run: read(run),
      solutionCard: rect(solutionCard), header: rect(header), headingGroup: rect(headingGroup), languageBox: rect(language), headingBox: rect(heading),
      buttonPadding: {test: getComputedStyle(test).padding, run: getComputedStyle(run).padding},
      materials: [test, run].map(node => {
        const materialOwner = node.closest("[data-material]") ?? node.parentElement?.closest("[data-material]");
        return materialOwner?.getAttribute("data-material") ?? null;
      }),
      textureLayers: [test, run].map(node => {
        const style = getComputedStyle(node, "::before");
        return {backgroundImage: style.backgroundImage, opacity: style.opacity, pointerEvents: style.pointerEvents};
      }),
      labels: [test, run].map(node => [...node.children].filter(child => child.getAttribute("aria-hidden") !== "true").map(child => child.textContent?.trim() ?? "")),
      icons: [test, run].map(node => [...node.querySelectorAll("[aria-hidden='true']")].map(child => ({tagName: child.tagName, text: child.textContent?.trim() ?? ""}))),
      headingMarkers: [decoration(heading, "::before"), decoration(heading, "::after"), ...hiddenDecoration(heading)],
      triangles: [decoration(run, "::before"), decoration(run, "::after"), ...hiddenDecoration(run)],
    };
  });
}

async function replaceEditor(page, code) {
  const actual = await page.evaluate(expected => {
    const model = window.monaco?.editor.getModels().find(candidate => candidate.uri.path === "/solution-editor-fixture.js");
    if (!model) throw new Error("editor fixture model is unavailable");
    model.setValue(expected);
    return model.getValue();
  }, code);
  assert.equal(actual, code, "the editor fixture must contain the exact submitted inert program");
}

async function readTerminalOutput(page, expected) {
  const output = page.getByRole("tabpanel").locator("pre[aria-live='polite']");
  await page.waitForFunction(
    ({source, flags}) => {
      const node = document.querySelector("[role='tabpanel']:not([hidden]) pre[aria-live='polite']");
      return Boolean(node && new RegExp(source, flags).test(node.textContent?.trim() ?? ""));
    },
    {source: expected.source, flags: expected.flags},
    {timeout: 5_000},
  );
  return (await output.textContent()).trim();
}

async function assertExactButtonGeometry(page, width, expectedWidth, expectedHeight) {
  await page.setViewportSize({width, height: 900});
  const geometry = await page.evaluate(() => [...document.querySelectorAll("button[aria-label='Test Code'], button[aria-label='Run Code']")].map(node => {
    const rect = node.getBoundingClientRect();
    return {width: rect.width, height: rect.height, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom};
  }));
  assert.equal(geometry.length, 2, `both editor actions render at ${width}px`);
  for (const action of geometry) {
    assert.equal(action.width, expectedWidth, `editor action is ${expectedWidth}px wide at ${width}px`);
    assert.equal(action.height, expectedHeight, `editor action is ${expectedHeight}px tall at ${width}px`);
    assert.ok(action.left >= 0 && action.right <= width, `editor action fits horizontally at ${width}px`);
  }
  assert.equal(geometry[0].top, geometry[1].top, `editor actions stay on one row at ${width}px`);
  assert.ok(geometry[0].right <= geometry[1].left || geometry[1].right <= geometry[0].left, `editor actions stay disjoint at ${width}px`);
}

async function measuredTestFace(testButton) {
  return testButton.evaluate(node => {
    const style = getComputedStyle(node);
    return {
      hovered: node.matches(":hover"),
      borderColor: style.borderColor,
      color: style.color,
      backgroundImage: style.backgroundImage,
    };
  });
}

async function pendingVisualState(button) {
  return button.locator("[aria-hidden='true']").evaluate(icon => {
    const svg = icon.querySelector("svg");
    if (!svg) throw new Error("pending action icon SVG is unavailable");
    const ring = getComputedStyle(icon, "::after");
    return {
      svgOpacity: getComputedStyle(svg).opacity,
      ringContent: ring.content,
      ringOpacity: ring.opacity,
      ringBorderTopWidth: ring.borderTopWidth,
      ringBorderTopColor: ring.borderTopColor,
      animationName: ring.animationName,
    };
  });
}

async function waitForBusyState(page, label, expected) {
  await page.waitForFunction(
    ({label, expected}) => (document.querySelector(`button[aria-label='${label}']`)?.getAttribute("aria-busy") === "true") === expected,
    {label, expected},
    {timeout: 5_000},
  );
}

async function assertLoadingVisual(button, {visible, motion, label}) {
  const visual = await pendingVisualState(button);
  assert.equal(visual.ringContent, '""', `${label} keeps the loading-ring pseudo-element available`);
  assert.equal(visual.ringBorderTopWidth, "2px", `${label} loading ring keeps its visible border`);
  assert.notEqual(visual.ringBorderTopColor, "rgba(0, 0, 0, 0)", `${label} loading ring border is not transparent`);
  assert.equal(visual.svgOpacity, visible ? "0" : "1", `${label} ${visible ? "hides" : "retains"} its icon at this loading phase`);
  assert.equal(visual.ringOpacity, visible ? "1" : "0", `${label} ${visible ? "shows" : "hides"} its loading ring at this loading phase`);
  if (visible) {
    if (motion) assert.match(visual.animationName, /textureActionSpin$/, `${label} animates its loading ring when motion is allowed`);
    else assert.equal(visual.animationName, "none", `${label} keeps a static loading ring when motion is reduced`);
  }
}

async function exerciseDelayedAction(page, button, {key, label, motion}) {
  await button.focus();
  await page.keyboard.press(key);
  await waitForBusyState(page, label, true);
  assert.equal(await button.isDisabled(), true, `${label} is natively disabled immediately while pending`);
  assert.equal(await button.getAttribute("aria-busy"), "true", `${label} announces busy immediately while pending`);
  await assertLoadingVisual(button, {visible: false, motion, label: `${label} before the 200ms threshold`});
  await page.waitForTimeout(235);
  assert.equal(await button.getAttribute("aria-busy"), "true", `${label} remains pending after the visual delay`);
  await assertLoadingVisual(button, {visible: true, motion, label: `${label} after the 200ms threshold`});
  await waitForBusyState(page, label, false);
  assert.equal(await button.isDisabled(), false, `${label} restores native availability as soon as it completes`);
  await assertLoadingVisual(button, {visible: false, motion, label: `${label} after completion`});
}

async function traceFastPendingVisual(page, label) {
  return page.evaluate(label => new Promise(resolve => {
    const button = document.querySelector(`button[aria-label='${label}']`);
    const icon = button?.querySelector("[aria-hidden='true']");
    const svg = icon?.querySelector("svg");
    if (!button || !icon || !svg) throw new Error(`${label} loading visual is unavailable`);
    const samples = [];
    const capture = reason => {
      const ring = getComputedStyle(icon, "::after");
      samples.push({
        reason,
        busy: button.getAttribute("aria-busy"),
        disabled: button.disabled,
        svgOpacity: getComputedStyle(svg).opacity,
        ringOpacity: ring.opacity,
      });
    };
    capture("before-action");
    const observer = new MutationObserver(() => capture("attribute-change"));
    observer.observe(button, {attributes: true, attributeFilter: ["aria-busy", "disabled"]});
    const timer = window.setInterval(() => capture("sample"), 4);
    window.setTimeout(() => {
      window.clearInterval(timer);
      observer.disconnect();
      capture("after-window");
      resolve(samples);
    }, 280);
  }), label);
}

function assertFastTrace(samples, label) {
  const pendingSamples = samples.filter(sample => sample.busy === "true" || sample.disabled);
  assert.ok(pendingSamples.length > 0, `${label} trace observes its complete pending interval`);
  assert.ok(samples.every(sample => sample.svgOpacity === "1" && sample.ringOpacity === "0"), `${label} never flashes its loading ring during a fast completion`);
}

async function exerciseFastActions(page, testButton, runButton) {
  await replaceEditor(page, "function echo(value) { return value; } console.log('fast-run');");
  const testTrace = traceFastPendingVisual(page, "Test Code");
  await testButton.focus();
  await page.keyboard.press("Space");
  assert.match(await readTerminalOutput(page, /^Все тесты пройдены: 1\/1$/), /^Все тесты пройдены: 1\/1$/, "fast Test completes with its ordinary result");
  assertFastTrace(await testTrace, "fast Test");
  assert.equal(await testButton.getAttribute("aria-busy"), null, "fast Test no longer announces busy after its ordinary result");
  await assertLoadingVisual(testButton, {visible: false, motion: false, label: "fast Test after completion"});

  const runTrace = traceFastPendingVisual(page, "Run Code");
  await runButton.focus();
  await page.keyboard.press("Enter");
  assert.match(await readTerminalOutput(page, /^fast-run$/), /^fast-run$/, "fast Run completes with its ordinary result");
  assertFastTrace(await runTrace, "fast Run");
  assert.equal(await runButton.getAttribute("aria-busy"), null, "fast Run no longer announces busy after its ordinary result");
  await assertLoadingVisual(runButton, {visible: false, motion: false, label: "fast Run after completion"});
}

async function assertToolbarFits(page, width) {
  await page.setViewportSize({width, height: 900});
  const result = await page.evaluate(() => {
    const actionable = [...document.querySelectorAll("button:not([disabled])")];
    const controls = [
      document.querySelector("button[aria-label='Test Code']"),
      document.querySelector("button[aria-label='Run Code']"),
    ];
    const heading = document.getElementById("taskSolutionHeading");
    const language = heading?.parentElement?.querySelector("p");
    const headingGroup = heading?.parentElement;
    const header = heading?.closest("header");
    const marker = heading?.querySelector("[aria-hidden='true']");
    if (!heading || !language || !headingGroup || !header || controls.some(control => !control)) throw new Error("responsive editor header unavailable");
    const rect = node => {
      const value = node.getBoundingClientRect();
      return {left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height};
    };
    const docWidth = document.documentElement.scrollWidth;
    return {
      docWidth,
      bodyWidth: document.body.scrollWidth,
      viewport: window.innerWidth,
      controls: controls.map(control => {
        const rect = control.getBoundingClientRect();
        return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, hit: control.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))};
      }),
      actionableOffscreen: actionable.some(control => {
        const rect = control.getBoundingClientRect();
        return rect.width > 0 && (rect.left < 0 || rect.right > window.innerWidth);
      }),
      header: rect(header),
      headingGroup: rect(headingGroup),
      heading: rect(heading),
      markerAnchor: rect(marker || heading),
      language: rect(language),
      semanticHeaderMembership: header.contains(heading) && header.contains(language),
    };
  });
  assert.ok(result.docWidth <= result.viewport, `document has no horizontal overflow at ${width}px`);
  assert.ok(result.bodyWidth <= result.viewport, `body has no horizontal overflow at ${width}px`);
  assert.equal(result.actionableOffscreen, false, `no actionable control is offscreen at ${width}px`);
  for (const control of result.controls) {
    assert.ok(control.left >= 0 && control.right <= width, `editor control fits at ${width}px`);
    assert.equal(control.hit, true, `editor control remains hit-testable at ${width}px`);
  }
  if (width === 320) {
    const [test, run] = result.controls;
    assert.equal(test.width, run.width, "Test and Run keep equal outer widths at 320px");
    assert.equal(test.height, run.height, "Test and Run keep equal outer heights at 320px");
    assert.equal(test.top, run.top, "Test and Run stay in one compact row at 320px");
    assert.ok(test.right <= run.left || run.right <= test.left, "Test and Run stay disjoint at 320px");
    assert.ok(test.height >= 44, "compact controls retain a 44px minimum hit height");
  }
  if ([1250, 1220, 1151, 600, 601].includes(width)) {
    const contains = (outer, inner) => inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;
    const overlaps = (first, second) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    assert.equal(result.semanticHeaderMembership, true, `heading and JavaScript remain in the semantic editor header at ${width}px`);
    for (const [label, box] of [["heading group", result.headingGroup], ["heading", result.heading], ["code marker anchor", result.markerAnchor], ["JavaScript", result.language]]) {
      assert.equal(contains(result.header, box), true, `${label} stays within the semantic editor header at ${width}px`);
      for (const [action, control] of [["Test", result.controls[0]], ["Run", result.controls[1]]]) {
        assert.equal(overlaps(box, control), false, `${label} does not overlap ${action} at ${width}px`);
      }
    }
  }
}

function hasCodeMarker(decoration) {
  return decoration.content?.includes("</>") || decoration.text?.includes("</>");
}

assert.equal(hasCodeMarker({content: '"</>"'}), true, "code-marker classifier accepts a generated marker");
assert.equal(hasCodeMarker({content: "none", text: ""}), false, "code-marker classifier rejects absent decoration");

async function assertVisibleFocusAndReducedMotion(button, label) {
  await button.focus();
  const focus = await button.evaluate(node => {
    const style = getComputedStyle(node);
    return {active: document.activeElement === node, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, duration: style.transitionDuration};
  });
  assert.equal(focus.active, true, `${label} receives keyboard focus`);
  assert.notEqual(focus.outlineStyle, "none", `${label} has a visible focus style`);
  assert.ok(Number.parseFloat(focus.outlineWidth) > 0, `${label} focus style has positive width`);
  assert.ok(focus.duration.split(",").every(value => Number.parseFloat(value) === 0), `reduced-motion removes ${label} decoration motion`);
}

test("CatTasks renders accessible editor controls and Output across responsive widths without executing fixture code", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1536, height: 1024}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    const testButton = page.getByRole("button", {name: "Test Code", exact: true});
    const runButton = page.getByRole("button", {name: "Run Code", exact: true});
    const solutionHeading = page.getByRole("heading", {name: "Your solution", exact: true});
    const outputHeading = page.getByRole("heading", {name: "Output", exact: true});
    const outputMessage = page.getByRole("tabpanel").locator("pre[aria-live='polite']");

    assert.equal(await testButton.isDisabled(), false, "valid inert catalog selection enables Test");
    assert.equal(await runButton.isDisabled(), false, "valid inert catalog selection enables Run");
    assert.equal(await solutionHeading.count(), 1, "solution accessible name excludes the code marker");
    assert.equal(await runButton.count(), 1, "Run accessible name excludes its decorative triangle");
    assert.equal(await outputMessage.textContent(), "Run code or tests to see output.", "Output keeps its initial live result message");
    const flask = testButton.locator("[aria-hidden='true'] svg");
    assert.equal(await flask.count(), 1, "Test contains one decorative inline FlaskConical SVG inside its separate icon element");
    assert.deepEqual(await flask.evaluate(node => ({
      paths: [...node.querySelectorAll("path")].map(path => path.getAttribute("d")),
    })), {
      paths: ["M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2", "M6.453 15h11.094", "M8.5 2h7"],
    }, "Test renders the official decorative FlaskConical path set before its visible label");

    const desktop = await measuredControls(page);
    assert.deepEqual([desktop.heading.fontSize, desktop.heading.fontWeight, desktop.heading.color], ["26px", "650", "rgb(35, 75, 54)"], "solution heading matches approved desktop type and ink");
    assert.deepEqual([desktop.language.fontSize, desktop.language.fontWeight, desktop.language.color], ["20px", "400", "rgb(35, 75, 54)"], "language label matches approved desktop type and ink");
    assert.equal(desktop.headingMarkers.some(hasCodeMarker), true, "solution heading draws a decorative code marker through CSS or aria-hidden decoration");
    assert.ok(desktop.headingMarkers.filter(hasCodeMarker).every(marker => marker.text === undefined || marker.text.includes("</>")), "code marker is either CSS-generated or contained by aria-hidden decoration");
    assert.equal((await testButton.innerText()).trim(), "Test", "Test keeps a real visible text label after its decorative icon");
    assert.equal((await runButton.innerText()).trim(), "Run", "Run keeps a real visible text label after its decorative icon");
    assert.deepEqual(desktop.labels, [["Test"], ["Run"]], "Test and Run labels remain ordinary interactive DOM content, not CSS-generated text");
    assert.deepEqual(desktop.icons.map(icons => icons.length), [1, 1], "each editor action has one separate aria-hidden decorative icon");
    assert.ok(desktop.icons.flat().every(icon => icon.tagName === "SPAN" || icon.tagName === "SVG"), "decorative editor icons remain DOM elements instead of button-image text");
    assert.deepEqual(desktop.materials, ["wood", "wood"], "the paired editor actions share the approved painted-wood material");
    assert.ok(desktop.textureLayers.every(layer => /painted-wood-grain\.png/.test(layer.backgroundImage)), "both actions load only the painted wood PNG through their texture pseudo-layer");
    assert.ok(desktop.textureLayers.every(layer => layer.pointerEvents === "none"), "texture pseudo-layers cannot intercept action clicks");
    assert.deepEqual(desktop.textureLayers.map(layer => Number.parseFloat(layer.opacity)), [0.69, 0.46], "Test and Run retain the approved moderate wood texture strengths");
    assert.match(desktop.test.backgroundImage, /rgb\(251, 246, 233\).*rgb\(236, 229, 208\)/, "Test retains the approved cream CSS face beneath wood texture");
    assert.match(desktop.run.backgroundImage, /rgb\(73, 112, 82\).*rgb\(52, 85, 62\)/, "Run retains the approved muted green CSS face beneath wood texture");
    assert.match(desktop.test.border, /solid/, "Test keeps its visible CSS border");
    assert.match(desktop.test.boxShadow, /rgba/, "Test keeps its soft CSS shadow");
    assert.ok(desktop.output.height >= 46, "Output header meets its minimum height");
    assert.deepEqual([desktop.output.fontSize, desktop.output.color], ["26px", "rgb(35, 75, 54)"], "Output title matches approved type and ink");
    assert.ok(desktop.languageBox.left > desktop.headingBox.right, "JavaScript stays inline after Your solution on desktop");
    assert.ok(desktop.languageBox.top >= desktop.header.top && desktop.languageBox.bottom <= desktop.header.bottom, "JavaScript remains inside the desktop editor header");
    assert.ok(Math.abs(desktop.solutionCard.left - 509) <= 8 && Math.abs(desktop.solutionCard.right - 1384) <= 8 && Math.abs(desktop.solutionCard.top - 248) <= 8, "solution panel matches the approved aligned-shelf 1536px anchors");

    await assertVisibleFocusAndReducedMotion(testButton, "Test");
    await assertVisibleFocusAndReducedMotion(runButton, "Run");

    await assertExactButtonGeometry(page, 1440, 124, 48);
    await assertExactButtonGeometry(page, 1268, 124, 48);
    await assertExactButtonGeometry(page, 390, 100, 44);
    for (const width of [1536, 1250, 1220, 1151, 780, 768, 601, 600, 390, 320, 768, 780, 1151, 1220, 1250, 1536]) await assertToolbarFits(page, width);
    assert.equal(await outputMessage.getAttribute("aria-live"), "polite", "Output retains its live result semantics after selection changes");
    assert.match(await outputMessage.evaluate(node => getComputedStyle(node).overflowY), /auto|scroll/, "Output retains vertical overflow handling");
    assert.deepEqual(diagnostics, {console: [], page: [], request: [], response: [], catalogRequests: [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`]}, "inert presentation checks finish without browser diagnostics and make one catalogue request");
  } finally {
    await context.close();
    await browser.close();
  }
});

test("CatTasks delays loading visuals for fast and slow Test and Run actions", {timeout: 35_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  try {
    const finiteSlowFixture = "const until = performance.now() + 750; while (performance.now() < until) {} function echo(value) { return value; }";
    for (const [reducedMotion, motion] of [["no-preference", true], ["reduce", false]]) {
      const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion});
      const page = await context.newPage();
      try {
        const diagnostics = await prepare(page);
        const testButton = page.getByRole("button", {name: "Test Code", exact: true});
        const runButton = page.getByRole("button", {name: "Run Code", exact: true});

        await exerciseFastActions(page, testButton, runButton);

        await replaceEditor(page, finiteSlowFixture);
        const initialTestBox = await testButton.boundingBox();
        await exerciseDelayedAction(page, testButton, {key: "Space", label: "Test Code", motion});
        assert.deepEqual(await testButton.boundingBox(), initialTestBox, `${reducedMotion} pending Test preserves its button geometry and label slot`);
        assert.equal((await testButton.innerText()).trim(), "Test", `${reducedMotion} pending Test preserves its visible label`);

        await replaceEditor(page, finiteSlowFixture);
        await exerciseDelayedAction(page, runButton, {key: "Enter", label: "Run Code", motion});
        assert.equal(await testButton.isDisabled(), false, `${reducedMotion} completed Run does not disable Test`);
        assert.deepEqual(diagnostics, {console: [], page: [], request: [], response: [], catalogRequests: [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`]}, `${reducedMotion} delayed-loading checks make one inert catalogue request without browser diagnostics`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test("CatTasks keeps pending state with the newest Test or Run action", {timeout: 20_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    const testButton = page.getByRole("button", {name: "Test Code", exact: true});
    const runButton = page.getByRole("button", {name: "Run Code", exact: true});
    const finiteSlowFixture = "const until = performance.now() + 750; while (performance.now() < until) {} function echo(value) { return value; }";

    await replaceEditor(page, finiteSlowFixture);
    await testButton.focus();
    await page.keyboard.press("Space");
    await waitForBusyState(page, "Test Code", true);
    assert.equal(await runButton.isDisabled(), false, "Run remains available to supersede a pending Test action");
    assert.equal(await runButton.getAttribute("aria-busy"), null, "the inactive Run action is not announced busy");

    await runButton.focus();
    await page.keyboard.press("Enter");
    await waitForBusyState(page, "Run Code", true);
    await page.waitForTimeout(120);
    assert.equal(await testButton.getAttribute("aria-busy"), null, "the superseded Test action clears its own busy state");
    assert.equal(await testButton.isDisabled(), false, "the superseded Test action becomes available again");
    assert.equal(await runButton.isDisabled(), true, "the newer Run action is natively disabled while pending");
    assert.equal(await runButton.getAttribute("aria-busy"), "true", "a stale Test finalizer cannot clear newer Run busy state");

    await replaceEditor(page, "console.log('fresh-after-edit');");
    await waitForBusyState(page, "Run Code", false);
    assert.equal(await runButton.isDisabled(), false, "editing cancels the active Run action and restores native availability");
    await assertLoadingVisual(runButton, {visible: false, motion: false, label: "Run after editing cancellation"});

    await runButton.focus();
    await page.keyboard.press("Enter");
    assert.match(await readTerminalOutput(page, /^fresh-after-edit$/), /^fresh-after-edit$/, "keyboard Run executes the newest inert program after pending cancellation");
    assert.equal(await runButton.getAttribute("aria-busy"), null, "completed Run no longer announces busy");
    assert.equal(await runButton.isDisabled(), false, "completed Run restores native availability");
    assert.equal(await testButton.isDisabled(), false, "completed Run does not disable Test");
    assert.deepEqual(diagnostics, {console: [], page: [], request: [], response: [], catalogRequests: [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`]}, "bounded newest-wins checks make one inert catalogue request without browser diagnostics");
  } finally {
    await context.close();
    await browser.close();
  }
});

test("CatTasks retains completed Test success and failure feedback while hovered", {timeout: 15_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: "reduce"});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    const testButton = page.getByRole("button", {name: "Test Code", exact: true});
    await page.mouse.move(0, 0);
    const idle = await measuredTestFace(testButton);

    await testButton.hover();
    await testButton.click();
    assert.match(await readTerminalOutput(page, /^Все тесты пройдены: 1\/1$/), /^Все тесты пройдены: 1\/1$/, "the inert default fixture completes Test successfully");
    const successHovered = await measuredTestFace(testButton);
    assert.equal(successHovered.hovered, true, "the pointer remains over Test after mouse activation");
    assert.equal(successHovered.borderColor, "rgb(77, 139, 89)", "hover preserves the completed-success Test border rather than returning to idle border");
    assert.equal(successHovered.color, "rgb(36, 75, 51)", "hover preserves completed-success Test ink");
    assert.notEqual(successHovered.borderColor, idle.borderColor, "completed-success feedback stays visibly distinct from idle Test");

    await page.mouse.move(0, 0);
    const successUnhovered = await measuredTestFace(testButton);
    assert.equal(successUnhovered.hovered, false, "moving the pointer away removes hover state");
    assert.deepEqual([successUnhovered.borderColor, successUnhovered.color], [successHovered.borderColor, successHovered.color], "completed-success feedback persists after unhover");
    assert.notEqual(successUnhovered.backgroundImage, successHovered.backgroundImage, "hover changes the Test face without masking completed-success feedback");

    await replaceEditor(page, "function echo() { return 'wrong'; }");
    await testButton.hover();
    await testButton.click();
    assert.match(await readTerminalOutput(page, /^Тест 1: проверка не пройдена\nПройдено: 0\/1$/), /^Тест 1: проверка не пройдена\nПройдено: 0\/1$/, "the trusted wrong-value fixture completes Test with failure feedback");
    const failureHovered = await measuredTestFace(testButton);
    assert.equal(failureHovered.hovered, true, "the pointer remains over Test after a failed mouse activation");
    assert.equal(failureHovered.borderColor, "rgb(173, 99, 78)", "hover preserves the completed-failure Test border rather than returning to idle border");
    assert.equal(failureHovered.color, "rgb(105, 52, 38)", "hover preserves completed-failure Test ink");
    assert.notEqual(failureHovered.borderColor, idle.borderColor, "completed-failure feedback stays visibly distinct from idle Test");

    await page.mouse.move(0, 0);
    const failureUnhovered = await measuredTestFace(testButton);
    assert.equal(failureUnhovered.hovered, false, "moving the pointer away clears failed-Test hover state");
    assert.deepEqual([failureUnhovered.borderColor, failureUnhovered.color], [failureHovered.borderColor, failureHovered.color], "completed-failure feedback persists after unhover");
    assert.notEqual(failureUnhovered.backgroundImage, failureHovered.backgroundImage, "hover changes the Test face without masking completed-failure feedback");
    assert.deepEqual(diagnostics, {console: [], page: [], request: [], response: [], catalogRequests: [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`]}, "terminal hover checks make one inert catalogue request without browser diagnostics");
  } finally {
    await context.close();
    await browser.close();
  }
});
