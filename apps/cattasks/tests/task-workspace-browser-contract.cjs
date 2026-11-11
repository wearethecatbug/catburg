const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const {selectTaskFromCatalogue} = require("./helpers/catalogue-selection.cjs");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43814";

function writeBrowserDiagnostics(name, diagnostics) {
  const outputDirectory = process.env.CATTASKS_BROWSER_DIAGNOSTICS_DIR;
  if (!outputDirectory) return;
  fs.mkdirSync(outputDirectory, {recursive: true});
  fs.writeFileSync(path.join(outputDirectory, `${name}.json`), `${JSON.stringify(diagnostics, null, 2)}\n`);
}

const catalog = {
  version: 1,
  tasks: [
    {
      id: "foo/../../solution-other",
      title: "Unsafe ID task",
      description: "First task.",
      entryPoint: "echo",
      starterCode: "function echo(value) { return value; }",
      solution: "function echo(value) { return value; }",
      tests: [{args: ["first"], expected: "first"}],
    },
    {
      id: "other",
      title: "Other task",
      description: "Second task.",
      entryPoint: "echo",
      starterCode: "function echo(value) { return value + '!'; }",
      solution: "function echo(value) { return value + '!'; }",
      tests: [{args: ["second"], expected: "second!"}],
    },
  ],
};

async function visibleEditorText(page) {
  return page.locator(".monaco-editor .view-lines").innerText();
}

async function setActiveDraft(page, starterCode, value) {
  const changed = await page.evaluate(({starterCode, value}) => {
    const models = window.monaco?.editor.getModels() ?? [];
    const current = models.find(model => model.getValue() === starterCode);
    if (!current) return false;
    current.setValue(value);
    return true;
  }, {starterCode, value});
  assert.equal(changed, true, "the visible Monaco editor model must be available through its public API");
  await page.waitForFunction(expected => {
    const models = window.monaco?.editor.getModels() ?? [];
    return models.some(model => model.getValue() === expected);
  }, value);
}

async function waitForReferenceSolutionsLayout(page, expectedCodes, finalLineMarker) {
  await page.waitForFunction(({expectedCodes, finalLineMarker}) => {
    const editors = Array.from(document.querySelectorAll("[class*='editorHost'] .monaco-editor"));
    const monacoEditors = window.monaco?.editor.getEditors() ?? [];
    return editors.length === expectedCodes.length && editors.every((editor, index) => {
      const monacoEditor = monacoEditors.find(candidate => {
        const domNode = candidate.getDomNode();
        return domNode === editor || editor.contains(domNode);
      });
      const bounds = editor.getBoundingClientRect();
      const model = monacoEditor?.getModel();
      if (model?.getValue() !== expectedCodes[index] || bounds.width <= 0 || bounds.height <= 0) return false;
      if (!expectedCodes[index].endsWith(finalLineMarker)) return true;
      monacoEditor.revealLineInCenter(model.getLineCount());
      return Array.from(editor.querySelectorAll(".view-line")).some(line => line.textContent?.includes(finalLineMarker));
    });
  }, {expectedCodes, finalLineMarker});
}

async function assertReferenceSolutionsReachable(page, expectedCodes, expectedLabels, finalLineMarker, learnerDraft) {
  const learnerScrollBefore = await page.evaluate(learnerDraft => {
    const editor = (window.monaco?.editor.getEditors() ?? []).find(candidate => candidate.getModel()?.getValue() === learnerDraft);
    return editor?.getScrollTop() ?? null;
  }, learnerDraft);
  const evidence = await page.evaluate(({expectedCodes, expectedLabels, finalLineMarker}) => {
    const scroller = document.querySelector("[class*='contentContainerFrame'][class*='taskSolutionContainer']");
    const host = scroller?.querySelector("[class*='editorHost']");
    const cards = host ? Array.from(host.children).filter(card => card.querySelector(".monaco-editor") && card.querySelector(":scope > dl")) : [];
    if (!scroller || !host || cards.length !== expectedCodes.length) return {ready: false};

    const verticalRoundingTolerance = 0.5;
    const monacoEditors = window.monaco?.editor.getEditors() ?? [];
    const cardsEvidence = cards.map((card, index) => {
      const editor = card.querySelector(".monaco-editor");
      const textarea = editor?.querySelector("textarea");
      const monacoEditor = monacoEditors.find(candidate => {
        const domNode = candidate.getDomNode();
        return domNode === editor || Boolean(domNode?.contains(textarea)) || Boolean(editor?.contains(domNode));
      });
      const analysis = card.querySelector(":scope > dl");
      const label = Array.from(card.children).find(child => child.textContent?.trim() === expectedLabels[index]);
      const precedingElement = analysis?.previousElementSibling;
      const codeImmediatelyBeforeAnalysis = precedingElement === editor || Boolean(precedingElement?.contains(editor));
      scroller.scrollTop = 0;
      analysis?.scrollIntoView({block: "nearest"});
      const analysisBounds = analysis?.getBoundingClientRect();
      const scrollerBounds = scroller.getBoundingClientRect();
      const editorBounds = editor?.getBoundingClientRect();
      const cardBounds = card.getBoundingClientRect();
      const contentHeight = monacoEditor?.getContentHeight() ?? 0;
      const editorLayoutHeight = monacoEditor?.getLayoutInfo().height ?? 0;
      return {
        editorHeight: editorBounds?.height ?? 0,
        cardHeight: cardBounds.height,
        contentHeight,
        editorLayoutHeight,
        editorScrolls: Boolean(monacoEditor && monacoEditor.getScrollHeight() > editorLayoutHeight),
        analysisGap: analysisBounds && editorBounds ? analysisBounds.top - editorBounds.bottom : null,
        readonly: textarea?.readOnly ?? false,
        codeMatches: monacoEditor?.getModel()?.getValue() === expectedCodes[index],
        renderedLinesNonblank: Boolean(editor?.querySelector(".view-lines")?.textContent?.trim()),
        label: label?.textContent?.trim() ?? null,
        labelVisible: Boolean(label?.getBoundingClientRect().width && label.getBoundingClientRect().height),
        labelPrecedesCode: Boolean(label && editor && label.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING),
        finalSourceLineVisible: !expectedCodes[index].endsWith(finalLineMarker) || Array.from(editor?.querySelectorAll(".view-line") ?? []).some(line => line.textContent?.includes(finalLineMarker)),
        codeImmediatelyBeforeAnalysis,
        parentScrolled: scroller.scrollTop > 0,
        analysisVisibleWithinParent: Boolean(analysisBounds && analysisBounds.top >= scrollerBounds.top - verticalRoundingTolerance && analysisBounds.bottom <= scrollerBounds.bottom + verticalRoundingTolerance),
        analysisVisibleInViewport: Boolean(analysisBounds && analysisBounds.top >= -verticalRoundingTolerance && analysisBounds.bottom <= window.innerHeight + verticalRoundingTolerance),
      };
    });
    return {
      ready: true,
      scrollable: scroller.scrollHeight > scroller.clientHeight,
      parentClientHeight: scroller.clientHeight,
      parentScrollHeight: scroller.scrollHeight,
      viewport: {width: window.innerWidth, height: window.innerHeight},
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      cards: cardsEvidence,
    };
  }, {expectedCodes, expectedLabels, finalLineMarker});
  const learnerScrollAfter = await page.evaluate(learnerDraft => {
    const editor = (window.monaco?.editor.getEditors() ?? []).find(candidate => candidate.getModel()?.getValue() === learnerDraft);
    return editor?.getScrollTop() ?? null;
  }, learnerDraft);

  assert.equal(evidence.ready, true, "two rendered reference-solution cards must be present before geometry assertions");
  const fixedWorkbenchViewport = evidence.viewport.width >= 768;
  if (fixedWorkbenchViewport) {
    assert.equal(evidence.scrollable, true, `the fixed desktop reference viewer's parent scrolls when multiple solution cards overflow: ${JSON.stringify(evidence)}`);
  }
  assert.equal(evidence.noHorizontalOverflow, true, "the reference viewer must not create horizontal page overflow");
  assert.deepEqual(evidence.cards.map(card => card.codeMatches), [true, true], "the ordered mounted Monaco editors retain their exact code payloads");
  assert.deepEqual(evidence.cards.map(card => card.renderedLinesNonblank), [true, true], "each mounted Monaco editor renders nonblank code lines");
  assert.deepEqual(evidence.cards.map(card => card.label), expectedLabels, "each reference solution exposes its correct label in source order");
  assert.deepEqual(evidence.cards.map(card => card.labelVisible), [true, true], "each reference solution label is visible");
  assert.deepEqual(evidence.cards.map(card => card.labelPrecedesCode), [true, true], "each reference solution label precedes its own editor");
  assert.deepEqual(evidence.cards.map(card => card.finalSourceLineVisible), [true, true], "the final long-reference source line is visible in its actual Monaco editor");
  assert.deepEqual(evidence.cards.map(card => card.readonly), [true, true], "both rendered reference editors retain native read-only semantics");
  assert.ok(evidence.cards[0].editorHeight > 100, "the long reference editor has meaningful visible height");
  assert.equal(evidence.cards[0].editorScrolls, true, "long reference code is capped and scrolls inside its own Monaco viewport");
  assert.ok(evidence.cards[1].editorHeight <= Math.max(130, evidence.cards[1].contentHeight + 72), "short reference code does not retain a large blank editor viewport");
  assert.ok(evidence.cards.every(card => card.analysisGap !== null && card.analysisGap >= 0 && card.analysisGap <= 24), "each complexity block follows its code editor directly");
  assert.deepEqual(evidence.cards.map(card => card.codeImmediatelyBeforeAnalysis), [true, true], "each reference code block is immediately followed by its own analysis");
  assert.deepEqual(evidence.cards.map(card => card.analysisVisibleWithinParent), [true, true], "each reference analysis is reachable inside the viewer's actual scroll parent");
  assert.deepEqual(evidence.cards.map(card => card.analysisVisibleInViewport), [true, true], "each reference analysis is brought into the user's viewport by its natural scroll owner");
  if (fixedWorkbenchViewport) {
    assert.equal(evidence.cards[1].parentScrolled, true, "the second desktop reference analysis cannot remain clipped outside an inert editor host");
  }
  assert.ok(learnerScrollBefore > 0, "the learner editor must have a meaningful nonzero scroll position before reference scrolling");
  assert.equal(learnerScrollAfter, learnerScrollBefore, "reference scrolling does not change the learner editor scroll position");
  return evidence;
}

test("CatTasks keeps drafts per catalog identity through catalogue and arrow navigation", {timeout: 30_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const catalogRequests = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => requestFailures.push({url: request.url(), method: request.method(), error: request.failure()?.errorText ?? null}));
  await context.route("**/task-catalog.v1.json", async route => {
    catalogRequests.push(route.request().url());
    await route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
    await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));
    await page.getByRole("heading", {name: /Unsafe ID task/}).waitFor({state: "visible"});

    const firstDraft = "// draft: first\nfunction echo(value) { return value; }";
    const secondDraft = "// draft: second\nfunction echo(value) { return value + '!'; }";
    await setActiveDraft(page, catalog.tasks[0].starterCode, firstDraft);
    const draftInput = page.getByLabel("User JavaScript code");
    assert.equal(await draftInput.evaluate(element => element.readOnly), false, "the user draft editor remains editable");
    await selectTaskFromCatalogue(page, "Other task");
    await setActiveDraft(page, catalog.tasks[1].starterCode, secondDraft);
    await selectTaskFromCatalogue(page, "Unsafe ID task");
    await page.waitForFunction(expected => document.querySelector(".monaco-editor .view-lines")?.textContent?.replace(/\s/g, "") === expected.replace(/\s/g, ""), firstDraft, {timeout: 10_000});
    assert.equal((await visibleEditorText(page)).replace(/\s/g, ""), firstDraft.replace(/\s/g, ""), "A→B→A restores the draft owned by the URI-unsafe stable ID");

    await page.getByRole("button", {name: "Give up: Показать решение"}).click();
    const solutionInput = page.locator("[class*='taskSolutionContainer'] .monaco-editor textarea");
    await solutionInput.waitFor({state: "visible"});
    const solutionBeforeEdit = catalog.tasks[0].solution;
    assert.equal(await solutionInput.evaluate(element => element.readOnly), true, "the reference solution editor exposes native read-only semantics");
    await solutionInput.focus();
    await page.keyboard.type("// blocked");
    assert.equal(await page.evaluate(expected => (window.monaco?.editor.getModels() ?? []).some(model => model.getValue() === expected), solutionBeforeEdit), true, "typing cannot change the reference solution");
    await page.getByRole("button", {name: "Task: Показать описание"}).click();

    await page.getByRole("button", {name: "Select next task"}).click();
    await page.getByRole("heading", {name: /Other task/}).waitFor({state: "visible"});
    await page.waitForFunction(expected => document.querySelector(".monaco-editor .view-lines")?.textContent?.replace(/\s/g, "") === expected.replace(/\s/g, ""), secondDraft);
    assert.equal((await visibleEditorText(page)).replace(/\s/g, ""), secondDraft.replace(/\s/g, ""), "arrow navigation uses the same selection state and preserves B draft");

    assert.deepEqual(catalogRequests, [new URL("/task-catalog.v1.json", baseUrl).href], "the dashboard issues one catalog request in this isolated scenario");
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(requestFailures, []);
  } finally {
    writeBrowserDiagnostics("draft-isolation", {catalogRequests, consoleErrors, pageErrors, requestFailures});
    await context.close();
    await browser.close();
  }
});

test("CatTasks shows a retryable catalog failure without claiming that it is still loading", {timeout: 30_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  let catalogAttempts = 0;
  await context.route("**/task-catalog.v1.json", async route => {
    catalogAttempts += 1;
    if (catalogAttempts === 1) {
      await route.fulfill({status: 503, contentType: "application/json", body: "{}"});
      return;
    }
    await route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });

  try {
    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response.status(), 200);
    await page.getByRole("button", {name: "All tasks"}).click();
    const catalogError = page.getByRole("alert").filter({hasText: "Tasks could not be loaded."});
    await catalogError.waitFor({state: "visible"});

    await page.getByRole("button", {name: "Try again"}).click();
    await catalogError.waitFor({state: "hidden"});
    await page.getByRole("searchbox", {name: "Search tasks"}).waitFor({state: "visible"});
    await page.getByRole("heading", {name: "Unsafe ID task", exact: true}).waitFor({state: "visible"});
    assert.equal(await catalogError.count(), 0, "a successful retry clears the catalog failure alert");
    assert.equal(catalogAttempts, 2, "retry makes one additional catalog request");
  } finally {
    await context.close();
    await browser.close();
  }
});

test("Hint uses independent native disclosures and tab changes preserve the selected draft without producing Output", {timeout: 30_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({width: 1536, height: 1024});
  const finalLineMarker = "LONG_REFERENCE_FINAL_MARKER";
  const longReferenceCode = [
    "function echo(value) {",
    `  // WRAPPED_REFERENCE_${"long-reference-content ".repeat(18)}`,
    ...Array.from({length: 70}, (_, index) => `  // reference line ${index + 1}`),
    "  return value;",
    "}",
    `// ${finalLineMarker}`,
  ].join("\n");
  const longLearnerDraft = [
    "function echo(value) {",
    ...Array.from({length: 70}, (_, index) => `  // learner line ${index + 1}`),
    "  return value;",
    "}",
  ].join("\n");
  const hintCatalog = {
    version: 1,
    tasks: [
      {id: "ct-js-01", slug: "first-hint-task", title: "First hint task", description: "First fixture.", hints: ["Identify the input first.", "Then keep the return value deterministic.", "Finally check the empty case."], entryPoint: "echo", starterCode: "function echo(value) { return value; }", solution: "function echo(value) { return value; }", tests: [{args: ["first"], expected: "first"}], solutions: [{id: "reference", label: "Reference", code: longReferenceCode, timeComplexity: "O(1)", spaceComplexity: "O(1)", rationale: "It returns one value."}, {id: "variant", label: "Variant", code: "function echo(value) { return String(value); }", timeComplexity: "O(n)", spaceComplexity: "O(n)", rationale: "String conversion copies the input representation."}], difficulty: "Easy"},
      {id: "ct-js-02", slug: "second-hint-task", title: "Second hint task", description: "Second fixture.", hints: ["Read the input shape.", "Use a direct comparison."], entryPoint: "echo", starterCode: "function echo(value) { return `${value}!`; }", solution: "function echo(value) { return `${value}!`; }", tests: [{args: ["second"], expected: "second!"}], solutions: [{id: "reference", label: "Reference", code: "function echo(value) { return `${value}!`; }", timeComplexity: "O(1)", spaceComplexity: "O(1)", rationale: "It appends one character."}], difficulty: "Easy"},
    ],
  };
  const catalogRequests = [];
  await context.route("**/task-catalog.v1.json", route => {
    catalogRequests.push(route.request().method());
    return route.fulfill({contentType: "application/json", body: JSON.stringify(hintCatalog)});
  });

  try {
    await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
    await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));
    const originalDraft = hintCatalog.tasks[0].starterCode;
    const editedDraft = "function echo(value) { return value; } // retained";
    await setActiveDraft(page, originalDraft, editedDraft);
    await setActiveDraft(page, editedDraft, longLearnerDraft);
    await page.waitForFunction(learnerDraft => {
      const editor = (window.monaco?.editor.getEditors() ?? []).find(candidate => candidate.getModel()?.getValue() === learnerDraft);
      if (!editor) return false;
      editor.revealLineInCenter(editor.getModel().getLineCount());
      return editor.getScrollTop() > 0;
    }, longLearnerDraft);

    await page.getByRole("button", {name: /Give up: Показать решение|Give up: Показано решение/}).click();
    const referenceCodes = hintCatalog.tasks[0].solutions.map(solution => solution.code);
    const referenceLabels = hintCatalog.tasks[0].solutions.map(solution => solution.label);
    await waitForReferenceSolutionsLayout(page, referenceCodes, finalLineMarker);
    const desktopReference = await assertReferenceSolutionsReachable(page, referenceCodes, referenceLabels, finalLineMarker, longLearnerDraft);
    await page.setViewportSize({width: 390, height: 844});
    await waitForReferenceSolutionsLayout(page, referenceCodes, finalLineMarker);
    const compactReference = await assertReferenceSolutionsReachable(page, referenceCodes, referenceLabels, finalLineMarker, longLearnerDraft);
    assert.ok(compactReference.cards[0].contentHeight > desktopReference.cards[0].contentHeight, "wrapped reference code recomputes its real rendered height after compact reflow");
    await page.setViewportSize({width: 1536, height: 1024});
    await waitForReferenceSolutionsLayout(page, referenceCodes, finalLineMarker);
    await assertReferenceSolutionsReachable(page, referenceCodes, referenceLabels, finalLineMarker, longLearnerDraft);
    await setActiveDraft(page, longLearnerDraft, editedDraft);
    assert.equal(await page.evaluate(expected => (window.monaco?.editor.getModels() ?? []).some(model => model.getValue() === expected), editedDraft), true, "desktop-to-compact-to-desktop resizing retains the selected draft model");
    const analyses = page.locator("dl").filter({hasText: "Time complexity"});
    assert.equal(await analyses.count(), 2, "each ordered solution has its own visible analysis block");
    assert.deepEqual(await analyses.allInnerTexts(), ["Time complexity\nO(1)\nSpace complexity\nO(1)\nRationale\nIt returns one value.", "Time complexity\nO(n)\nSpace complexity\nO(n)\nRationale\nString conversion copies the input representation."], "each code block is followed by its own time, space, and rationale in source order");
    await page.getByLabel(/Task: Показано описание|Task: Показать описание/).click();

    const hintButton = page.getByLabel(/Hint: Показать подсказки|Hint: Показаны подсказки/);
    await hintButton.click();
    const summaries = page.getByRole("group").getByText(/^Hint [1-3]$/, {exact: true});
    assert.equal(await summaries.count(), 3, "each normalized hint gets its own native disclosure summary");
    const first = page.locator("details").filter({has: page.getByText("Identify the input first.")});
    const second = page.locator("details").filter({has: page.getByText("Then keep the return value deterministic.")});
    assert.equal(await first.getAttribute("open"), null, "Hint pane mounts closed");
    await first.locator("summary").click();
    assert.equal(await first.getAttribute("open"), "", "opening one hint is a native details interaction");
    assert.equal(await second.getAttribute("open"), null, "opening one hint does not reveal another");
    await second.locator("summary").focus();
    assert.equal(await second.locator("summary").evaluate(node => node === document.activeElement), true, "the native summary receives keyboard focus without focus theft");
    await page.keyboard.press("Enter");
    assert.equal(await second.getAttribute("open"), "", "Enter independently opens a second native hint disclosure");
    await page.keyboard.press("Space");
    assert.equal(await second.getAttribute("open"), null, "Space independently closes the focused native disclosure");
    assert.equal(await first.getAttribute("open"), "", "keyboard operation does not close an already opened sibling hint");

    await page.getByLabel(/Task: Показано описание|Task: Показать описание/).click();
    await hintButton.click();
    assert.equal(await first.getAttribute("open"), null, "remounting Hint resets disclosure state without a React/storage open-state owner");
    await selectTaskFromCatalogue(page, "Second hint task");
    await selectTaskFromCatalogue(page, "First hint task");
    await hintButton.click();
    assert.equal(await first.getAttribute("open"), null, "A→B→A cannot leak an old disclosure state");
    await page.waitForFunction(expected => document.querySelector(".monaco-editor .view-lines")?.textContent?.replace(/\s/g, "") === expected.replace(/\s/g, ""), editedDraft);
    assert.equal((await visibleEditorText(page)).replace(/\s/g, ""), editedDraft.replace(/\s/g, ""), "Hint interactions and task switches retain the independently owned Monaco draft");
    assert.equal(await page.getByRole("tabpanel").locator("pre").innerText(), "Run code or tests to see output.", "Hint ownership never writes result output");
    assert.deepEqual(catalogRequests, ["GET"]);
  } finally {
    await context.close();
    await browser.close();
  }
});
