const assert = require("node:assert/strict");
const test = require("node:test");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.CATTASKS_BASE_URL || "http://127.0.0.1:43852";
const shelfAssets = [
  "books_standing.png",
  "mug_paw.png",
  "plant-books.png",
  "plant-prev-left.png",
  "plant-prev-right.png",
  "plant-next-left.png",
  "plant-next-right.png",
  "plant-cup.png",
  "leaf-pair.png",
];
const catalog = {version: 1, tasks: [
  {
    id: "shelf-first",
    title: "Shelf composition fixture",
    description: "Inert shelf browser fixture.",
    entryPoint: "echo",
    starterCode: "function echo(value) { return value; }",
    solution: "function echo(value) { return value; }",
    tests: [{args: ["fixture"], expected: "fixture"}],
  },
  {
    id: "shelf-second",
    title: "A deliberately long task title that stays clear of the shelf",
    description: "Second inert fixture.",
    entryPoint: "echo",
    starterCode: "function echo(value) { return value; }",
    solution: "function echo(value) { return value; }",
    tests: [{args: ["fixture"], expected: "fixture"}],
  },
]};

const withEdges = ({x, y, width, height}) => ({x, y, width, height, left: x, right: x + width, top: y, bottom: y + height});

function installDiagnostics(page) {
  const diagnostics = {console: [], page: [], request: [], response: [], catalogRequests: []};
  page.on("console", message => { if (message.type() === "error") diagnostics.console.push(message.text()); });
  page.on("pageerror", error => diagnostics.page.push(error.message));
  page.on("requestfailed", request => diagnostics.request.push(request.url()));
  page.on("response", response => { if (response.status() >= 400) diagnostics.response.push(`${response.request().method()} ${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function prepare(page) {
  const diagnostics = installDiagnostics(page);
  await page.route("**/task-catalog.v1.json", route => {
    diagnostics.catalogRequests.push(`${route.request().method()} ${route.request().url()}`);
    return route.fulfill({contentType: "application/json", body: JSON.stringify(catalog)});
  });
  assert.equal((await page.goto(baseUrl, {waitUntil: "domcontentloaded"}))?.status(), 200);
  await page.getByRole("heading", {name: catalog.tasks[0].title, exact: true}).waitFor();
  return diagnostics;
}

function assertDiagnostics(diagnostics) {
  assert.deepEqual(diagnostics.console, []);
  assert.deepEqual(diagnostics.page, []);
  assert.deepEqual(diagnostics.request, []);
  assert.deepEqual(diagnostics.response, []);
  assert.deepEqual(diagnostics.catalogRequests, [`GET ${new URL("/task-catalog.v1.json", baseUrl).href}`]);
}

function shelfContract(page) {
  return page.evaluate(async () => {
    const selector = name => `[class*="${name}"]`;
    const box = element => {
      const {x, y, width, height} = element.getBoundingClientRect();
      return {x, y, width, height, left: x, right: x + width, top: y, bottom: y + height};
    };
    const shelf = document.querySelector(selector("shelfDecoration"));
    if (!shelf) throw new Error("decorated task shelf is unavailable");
    const physicalShelf = shelf.closest('[aria-hidden="true"]') ?? shelf.parentElement;
    if (!physicalShelf) throw new Error("physical task shelf is unavailable");
    const classBox = name => {
      const element = shelf.querySelector(selector(name));
      if (!element) throw new Error(`${name} is unavailable`);
      return {box: box(element), pointerEvents: getComputedStyle(element).pointerEvents};
    };
    const images = Array.from(shelf.querySelectorAll("img"));
    await Promise.all(images.map(image => image.decode()));
    return {
      shelf: box(physicalShelf),
      brackets: Array.from(shelf.querySelectorAll(selector("shelfBracket"))).map(element => ({box: box(element), backgroundImage: getComputedStyle(element).backgroundImage})),
      images: images.map(image => ({src: new URL(image.src).pathname, box: box(image), decoded: image.complete && image.naturalWidth > 0, pointerEvents: getComputedStyle(image).pointerEvents})),
      plants: Object.fromEntries(["shelfPlantBooks", "shelfPlantPreviousLeft", "shelfPlantPreviousRight", "shelfPlantNextLeft", "shelfPlantNextRight", "shelfPlantCup", "shelfLeafPair"].map(name => [name, classBox(name)])),
      books: classBox("shelfBooks"),
      mug: classBox("shelfMug"),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });
}

async function assertWideShelf(page, width) {
  await page.setViewportSize({width, height: 900});
  const [view, previous, next, title] = await Promise.all([
    shelfContract(page),
    page.getByRole("button", {name: "Select previous task"}).boundingBox(),
    page.getByRole("button", {name: "Select next task"}).boundingBox(),
    page.getByRole("heading", {name: catalog.tasks[0].title, exact: true}).boundingBox(),
  ]);
  assert.equal(view.brackets.length, 2, `${width}px shows two brackets from the approved sprite`);
  assert.ok(view.brackets.every(({box, backgroundImage}) => box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= width && backgroundImage.includes("/cattasks/shelf/brackets.png")), `${width}px shows contained brackets from the approved sprite`);
  assert.equal(view.images.length, shelfAssets.length, `${width}px shows nine img elements from ten supplied files`);
  assert.deepEqual(view.images.map(image => image.src).sort(), shelfAssets.map(name => `/cattasks/shelf/${name}`).sort(), `${width}px loads the approved shelf assets`);
  assert.ok(view.images.every(image => image.decoded && image.pointerEvents === "none"), `${width}px art is decoded and pointer-inert`);
  assert.ok(view.images.every(image => image.box.width > 0 && image.box.height > 0 && image.box.left >= 0 && image.box.right <= width), `${width}px art stays visible in the viewport`);
  assert.equal(view.pageWidth, view.viewportWidth, `${width}px shelf causes no horizontal overflow`);
  assert.ok(previous && next && title, `${width}px exposes title and both navigation controls`);
  const previousBox = withEdges(previous);
  const nextBox = withEdges(next);
  const titleBox = withEdges(title);
  const previousMidpoint = previousBox.x + previousBox.width / 2;
  const nextMidpoint = nextBox.x + nextBox.width / 2;
  const p = view.plants;
  assert.ok(p.shelfPlantPreviousLeft.box.right <= previousMidpoint && p.shelfPlantPreviousLeft.box.left < previousBox.left, `${width}px previous outer plant extends left of its plaque without crossing its midpoint`);
  assert.ok(p.shelfPlantPreviousRight.box.left >= previousMidpoint && p.shelfPlantPreviousRight.box.right > previousBox.right, `${width}px previous inner plant extends right of its plaque without crossing its midpoint`);
  assert.ok(p.shelfPlantNextLeft.box.right <= nextMidpoint && p.shelfPlantNextLeft.box.left < nextBox.left, `${width}px next inner plant extends left of its plaque without crossing its midpoint`);
  assert.ok(p.shelfPlantNextRight.box.left >= nextMidpoint && p.shelfPlantNextRight.box.right > nextBox.right, `${width}px next outer plant extends right of its plaque without crossing its midpoint`);
  assert.ok(p.shelfPlantNextRight.box.bottom > view.shelf.bottom, `${width}px outer right branch descends below shelf`);
  assert.ok(p.shelfPlantBooks.box.bottom >= view.shelf.top && p.shelfPlantBooks.box.top < view.shelf.top, `${width}px books plant rests on shelf`);
  assert.ok(p.shelfPlantCup.box.bottom >= view.shelf.top && p.shelfPlantCup.box.top < view.shelf.top, `${width}px cup plant rests on shelf`);
  assert.ok(titleBox.bottom < view.shelf.top, `${width}px title remains above shelf`);
  assert.ok(view.shelf.top - titleBox.bottom >= 28 && view.shelf.top - titleBox.bottom <= 36, `${width}px retains the approved title air gap`);
  for (const [arrow, expectedLabel] of [[previous, "Select previous task"], [next, "Select next task"]]) {
    const x = arrow.x + arrow.width / 2;
    const y = arrow.y + arrow.height / 2;
    const hit = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label"), {x, y});
    assert.equal(hit, expectedLabel, `${width}px shelf art cannot intercept its arrow center hit`);
  }
  assert.equal(await page.locator("[class*='shelfCenter'], [class*='titleVine'], [class*='centerOrnament']").count(), 0, `${width}px has no retired center ornament`);
}

test("approved shelf composition preserves real header targets on wide task views", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1536, height: 900}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const width of [1250, 1536]) await assertWideShelf(page, width);
    assertDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("shelf art stays wide-only and never leaks into the catalogue", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 600, height: 900}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const width of [320, 390, 600, 601, 780, 1150, 1220]) {
      await page.setViewportSize({width, height: 900});
      const decorationBoxes = await page.locator("[class*='shelfDecoration'] img, [class*='shelfDecoration'] [class*='shelfBracket']").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
      assert.ok(decorationBoxes.every(box => box.width === 0 && box.height === 0), `${width}px keeps the shelf plain`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${width}px has no horizontal overflow`);
      if (width <= 600) {
        assert.equal(await page.getByRole("button", {name: "Select previous task"}).count(), 0, `${width}px hides previous arrow from accessibility`);
        assert.equal(await page.getByRole("button", {name: "Select next task"}).count(), 0, `${width}px hides next arrow from accessibility`);
      } else {
        assert.ok(await page.getByRole("button", {name: "Select previous task"}).boundingBox(), `${width}px retains previous arrow`);
        assert.ok(await page.getByRole("button", {name: "Select next task"}).boundingBox(), `${width}px retains next arrow`);
      }
    }
    await page.setViewportSize({width: 1536, height: 900});
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor();
    assert.equal(await page.locator("[class*='shelfDecoration']").count(), 0, "catalogue keeps the shared shelf plain");
    assertDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});
