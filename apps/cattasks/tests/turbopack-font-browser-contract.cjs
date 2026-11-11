const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const appRoot = path.resolve(__dirname, "..");
const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43850";
const layoutPath = path.join(appRoot, "src", "app", "layout.tsx");
const globalsPath = path.join(appRoot, "src", "app", "globals.css");

// This catalogue is valid and nonempty, but this contract never activates Test or Run.
const catalog = {version: 1, tasks: [{
  id: "font-fixture",
  title: "Font fixture",
  description: "Inert route fixture.",
  entryPoint: "echo",
  starterCode: "function echo(value) { return value; }",
  solution: "function echo(value) { return value; }",
  tests: [{args: ["fixture"], expected: "fixture"}],
}]};

function sourceFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const candidate = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(candidate) : [candidate];
  });
}

test("font startup source contract removes dead Next loaders and preserves live fallback", {concurrency: false}, () => {
  const layout = fs.readFileSync(layoutPath, "utf8");
  const globals = fs.readFileSync(globalsPath, "utf8");
  const appSources = sourceFiles(path.join(appRoot, "src", "app"))
    .filter(file => /\.(?:css|tsx?|jsx?)$/.test(file))
    .map(file => ({file, source: fs.readFileSync(file, "utf8")}));

  assert.doesNotMatch(layout, /next\/font\/google/, "layout must not import a Google font loader");
  assert.doesNotMatch(layout, /\b(?:Geist|Geist_Mono|Orbitron)\s*\(/, "layout must not register dead Google font loaders");
  assert.doesNotMatch(layout, /--font-(?:geist-sans|geist-mono|orbitron)/, "layout body must not apply generated font variables");
  for (const {file, source} of appSources) {
    assert.doesNotMatch(source, /--font-(?:geist-sans|geist-mono|orbitron)/, `${path.relative(appRoot, file)} must not consume a removed generated font variable`);
  }

  assert.match(globals, /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com\/css2\?family=Orbitron:wght@400;700&display=swap['"]\)\s*;/, "globals retains the approved Orbitron 400/700 CSS import");
  assert.match(globals, /body\s*\{[\s\S]*?font-family:\s*sans-serif\s*;/, "body retains the live sans-serif fallback");
});

test("ordinary Turbopack page retains fallback and Monaco without task execution", {timeout: 45_000, concurrency: false}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 900}});
  const page = await context.newPage();
  const diagnostics = {console: [], page: [], request: [], response: []};
  try {
    // Install every observer and the inert catalogue route before navigation.
    page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
    page.on("pageerror", error => diagnostics.page.push(error.message));
    page.on("requestfailed", request => diagnostics.request.push(`${request.method()} ${request.url()}`));
    page.on("response", response => { if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`); });
    await context.route("**/task-catalog.v1.json", route => route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)}));

    const response = await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
    assert.equal(response?.status(), 200, "the ordinary configured URL responds with HTTP 200");
    const editor = page.getByLabel("User JavaScript code");
    await editor.waitFor({state: "visible"});
    await page.waitForFunction(() => Boolean(window.monaco?.editor.getModels().length));

    assert.match(await page.locator("body").evaluate(node => getComputedStyle(node).fontFamily), /sans-serif/i, "rendered body retains its global fallback");
    const outputMessage = page.getByRole("tabpanel").locator("pre[aria-live='polite']");
    await outputMessage.waitFor({state: "visible"});
    assert.equal(await outputMessage.textContent(), "Run code or tests to see output.", "the contract reaches the editor without executing task code");
    assert.deepEqual(diagnostics, {console: [], page: [], request: [], response: []}, "startup and inert navigation emit no browser diagnostics");
  } finally {
    await context.close();
    await browser.close();
  }
});
