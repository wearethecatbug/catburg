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
      labels: {test: getComputedStyle(test, "::after").content, run: getComputedStyle(run, "::after").content},
      headingMarkers: [decoration(heading, "::before"), decoration(heading, "::after"), ...hiddenDecoration(heading)],
      triangles: [decoration(run, "::before"), decoration(run, "::after"), ...hiddenDecoration(run)],
    };
  });
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
        return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, hit: control.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))};
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

function matchesCream(decoration) {
  return [decoration.color, decoration.backgroundColor, decoration.borderLeftColor].includes("rgb(255, 242, 207)");
}

function hasCodeMarker(decoration) {
  return decoration.content?.includes("</>") || decoration.text?.includes("</>");
}

function isTriangleSize(decoration) {
  return (decoration.width === "13px" && decoration.height === "16px") ||
    (decoration.borderLeftWidth === "13px" && Number.parseFloat(decoration.borderTopWidth) + Number.parseFloat(decoration.borderBottomWidth) === 16);
}

assert.equal(hasCodeMarker({content: '"</>"'}), true, "code-marker classifier accepts a generated marker");
assert.equal(hasCodeMarker({content: "none", text: ""}), false, "code-marker classifier rejects absent decoration");
assert.equal(matchesCream({borderLeftColor: "rgb(255, 242, 207)"}), true, "cream classifier accepts the approved border color");
assert.equal(matchesCream({borderLeftColor: "rgb(255, 242, 206)"}), false, "cream classifier rejects a near color");
assert.equal(isTriangleSize({width: "13px", height: "16px"}), true, "triangle classifier accepts a box triangle");
assert.equal(isTriangleSize({borderLeftWidth: "13px", borderTopWidth: "8px", borderBottomWidth: "8px"}), true, "triangle classifier accepts a border triangle");
assert.equal(isTriangleSize({borderLeftWidth: "12px", borderTopWidth: "8px", borderBottomWidth: "8px"}), false, "triangle classifier rejects wrong geometry");

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
    const outputMessage = page.locator("pre[aria-live='polite']");

    assert.equal(await testButton.isDisabled(), false, "valid inert catalog selection enables Test");
    assert.equal(await runButton.isDisabled(), false, "valid inert catalog selection enables Run");
    assert.equal(await solutionHeading.count(), 1, "solution accessible name excludes the code marker");
    assert.equal(await runButton.count(), 1, "Run accessible name excludes its decorative triangle");
    assert.equal(await outputMessage.textContent(), "Run code or tests to see output.", "Output keeps its initial live result message");

    const desktop = await measuredControls(page);
    assert.deepEqual([desktop.heading.fontSize, desktop.heading.fontWeight, desktop.heading.color], ["26px", "650", "rgb(35, 75, 54)"], "solution heading matches approved desktop type and ink");
    assert.deepEqual([desktop.language.fontSize, desktop.language.fontWeight, desktop.language.color], ["20px", "400", "rgb(35, 75, 54)"], "language label matches approved desktop type and ink");
    assert.equal(desktop.headingMarkers.some(hasCodeMarker), true, "solution heading draws a decorative code marker through CSS or aria-hidden decoration");
    assert.ok(desktop.headingMarkers.filter(hasCodeMarker).every(marker => marker.text === undefined || marker.text.includes("</>")), "code marker is either CSS-generated or contained by aria-hidden decoration");
    assert.deepEqual([desktop.test.width >= 124, desktop.test.height >= 48], [true, true], "Test meets approved minimum geometry");
    assert.equal(desktop.labels.test.includes("Test"), true, "Test keeps its visible generated label");
    assert.equal(desktop.labels.run.includes("Run"), true, "Run keeps its visible generated label");
    assert.doesNotMatch(desktop.test.backgroundImage, /url\(/, "Test light fill does not load a decorative image");
    assert.ok(desktop.test.backgroundImage !== "none" || desktop.test.backgroundColor !== "rgba(0, 0, 0, 0)", "Test has a visible light fill");
    assert.match(desktop.test.border, /solid/, "Test keeps its visible border");
    assert.match(desktop.test.color, /rgb\(35, 75, 54\)/, "Test keeps the approved ink");
    assert.match(desktop.test.boxShadow, /rgba/, "Test keeps a visible soft shadow");
    assert.deepEqual([desktop.run.width >= 152, desktop.run.height >= 48], [true, true], "Run meets approved minimum geometry");
    assert.equal(desktop.test.height, desktop.run.height, "Test and Run have equal outer height");
    assert.deepEqual(desktop.buttonPadding, {test: "10px 24px", run: "10px 24px"}, "Test and Run have equal approved padding");
    assert.match(desktop.run.backgroundImage, /rgb\(66, 132, 97\).*rgb\(43, 105, 72\).*rgb\(28, 80, 53\)/, "Run uses the approved three-stop green gradient");
    assert.equal(desktop.triangles.some(decoration => isTriangleSize(decoration) && matchesCream(decoration)), true, "Run draws an opaque cream 13 by 16 decorative triangle through any valid CSS technique");
    assert.ok(desktop.output.height >= 46, "Output header meets its minimum height");
    assert.deepEqual([desktop.output.fontSize, desktop.output.color], ["26px", "rgb(35, 75, 54)"], "Output title matches approved type and ink");
    assert.ok(desktop.languageBox.left > desktop.headingBox.right, "JavaScript stays inline after Your solution on desktop");
    assert.ok(desktop.languageBox.top >= desktop.header.top && desktop.languageBox.bottom <= desktop.header.bottom, "JavaScript remains inside the desktop editor header");
    assert.ok(Math.abs(desktop.solutionCard.left - 609) <= 8 && Math.abs(desktop.solutionCard.right - 1484) <= 8 && Math.abs(desktop.solutionCard.top - 181) <= 8, "solution panel matches approved 1536px desktop anchors");

    await assertVisibleFocusAndReducedMotion(testButton, "Test");
    await assertVisibleFocusAndReducedMotion(runButton, "Run");

    for (const width of [1536, 1250, 1220, 1151, 780, 768, 601, 600, 390, 768, 780, 1151, 1220, 1250, 1536]) await assertToolbarFits(page, width);
    await page.getByRole("button", {name: "Очистить выбор задачи", exact: true}).click();
    assert.equal(await testButton.isDisabled(), true, "clearing selection retains Test disabled policy");
    assert.equal(await runButton.isDisabled(), true, "clearing selection retains Run disabled policy");
    assert.equal(await outputMessage.getAttribute("aria-live"), "polite", "Output retains its live result semantics after selection changes");
    assert.match(await outputMessage.evaluate(node => getComputedStyle(node).overflowY), /auto|scroll/, "Output retains vertical overflow handling");
    assert.deepEqual(diagnostics, {console: [], page: [], request: [], response: [], catalogRequests: [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`]}, "inert presentation checks finish without browser diagnostics and make one catalogue request");
  } finally {
    await context.close();
    await browser.close();
  }
});

test("Test result states retain the approved control without legacy PNG paint", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1536, height: 1024}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    const testButton = page.getByRole("button", {name: "Test Code", exact: true});
    const output = page.locator("pre[aria-live='polite']");
    const base = await measuredControls(page);
    await testButton.click();
    await page.waitForFunction(() => document.querySelector("pre[aria-live='polite']")?.textContent?.includes("Все тесты пройдены"));
    const passed = await measuredControls(page);
    assert.doesNotMatch(passed.test.backgroundImage, /url\(/, "a successful Test result does not paint a legacy image");
    assert.deepEqual([passed.test.width, passed.test.height], [base.test.width, base.test.height], "a successful Test result retains Test geometry");
    const changed = await page.evaluate(() => {
      const textarea = document.querySelector('textarea[aria-label="User JavaScript code"]');
      const editor = (window.monaco?.editor.getEditors() ?? []).find(candidate => candidate.getDomNode()?.contains(textarea));
      editor?.getModel()?.setValue("function echo(value) { return 'wrong'; }");
      return Boolean(editor?.getModel());
    });
    assert.equal(changed, true, "the reviewed mismatch updates the active user editor only");
    await testButton.click();
    await page.waitForFunction(() => document.querySelector("pre[aria-live='polite']")?.textContent?.includes("Тест 1:"));
    const failed = await measuredControls(page);
    assert.doesNotMatch(failed.test.backgroundImage, /url\(/, "a failed Test result does not paint a legacy image");
    assert.deepEqual([failed.test.width, failed.test.height], [base.test.width, base.test.height], "a failed Test result retains Test geometry");
    assert.match(await output.innerText(), /Тест 1:/, "the reviewed inert mismatch reaches a public failed Test result");
    assert.deepEqual(diagnostics, {console: [], page: [], request: [], response: [], catalogRequests: [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`]});
  } finally {
    await context.close();
    await browser.close();
  }
});
