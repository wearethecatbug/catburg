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
const sparseShelfAssets = [
  "plant-prev-left.png",
  "plant-prev-right.png",
  "plant-next-left.png",
  "plant-next-right.png",
  "leaf-pair.png",
];
const intermediateShelfAssets = sparseShelfAssets.filter(name => name !== "leaf-pair.png");
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
    const optionalClassBox = name => {
      const element = shelf.querySelector(selector(name));
      return element ? {src: new URL(element.src).pathname, box: box(element), pointerEvents: getComputedStyle(element).pointerEvents, visible: isVisible(element)} : null;
    };
    const images = Array.from(shelf.querySelectorAll("img:not([data-mobile-shelf-art])"));
    const mobileImages = Array.from(physicalShelf.querySelectorAll("img[data-mobile-shelf-art]"));
    const isVisible = element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden";
    };
    await Promise.all(images.filter(isVisible).map(image => image.decode()));
    return {
      shelf: box(physicalShelf),
      brackets: Array.from(shelf.querySelectorAll(selector("shelfBracket"))).map(element => ({box: box(element), backgroundImage: getComputedStyle(element).backgroundImage})),
      images: images.map(image => ({src: new URL(image.src).pathname, box: box(image), visible: isVisible(image), decoded: image.complete && image.naturalWidth > 0, pointerEvents: getComputedStyle(image).pointerEvents})),
      mobileImages: mobileImages.map(image => ({role: image.dataset.mobileShelfArt, box: box(image), visible: isVisible(image), pointerEvents: getComputedStyle(image).pointerEvents})),
      plants: Object.fromEntries(["shelfPlantBooks", "shelfPlantPreviousLeft", "shelfPlantPreviousRight", "shelfPlantNextLeft", "shelfPlantNextRight", "shelfPlantCup", "shelfLeafPair"].map(name => [name, classBox(name)])),
      books: classBox("shelfBooks"),
      mug: classBox("shelfMug"),
      owl: optionalClassBox("shelfOwl"),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });
}

async function assertSparseShelf(page, width, minimumTitleClearance, expectedAssets = sparseShelfAssets) {
  await page.setViewportSize({width, height: 900});
  const [view, previous, next, title] = await Promise.all([
    shelfContract(page),
    page.getByRole("button", {name: "Select previous task"}).boundingBox(),
    page.getByRole("button", {name: "Select next task"}).boundingBox(),
    page.getByRole("heading", {name: catalog.tasks[0].title, exact: true}).boundingBox(),
  ]);
  assert.equal(view.shelf.height, 22, `${width}px sparse shelf stays 22px tall`);
  assert.equal(view.brackets.length, 2, `${width}px sparse shelf keeps both brackets`);
  assert.ok(view.brackets.every(({box, backgroundImage}) => box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= width && backgroundImage.includes("/cattasks/shelf/brackets.png")), `${width}px sparse brackets stay contained`);
  assert.deepEqual(view.images.filter(image => image.visible).map(image => image.src).sort(), expectedAssets.map(name => `/cattasks/shelf/${name}`).sort(), `${width}px shows only its approved sparse arrow foliage`);
  assert.ok(view.mobileImages.every(image => !image.visible), `${width}px keeps compact shelf art hidden outside its approved range`);
  assert.ok(view.images.filter(image => image.visible).every(image => image.decoded && image.pointerEvents === "none"), `${width}px decodes only visible sparse art and keeps it pointer-inert`);
  assert.equal(view.books.box.width, 0, `${width}px hides books`);
  assert.equal(view.mug.box.width, 0, `${width}px hides mug`);
  assert.equal(view.plants.shelfPlantBooks.box.width, 0, `${width}px hides the books plant`);
  assert.equal(view.plants.shelfPlantCup.box.width, 0, `${width}px hides the mug plant`);
  assert.ok(previous && next && title, `${width}px retains the title and both navigation controls`);
  const titleBox = withEdges(title);
  assert.ok(titleBox.bottom + minimumTitleClearance <= view.shelf.top, `${width}px keeps the title ${minimumTitleClearance}px clear of the shelf beam`);
  assert.equal(view.pageWidth, view.viewportWidth, `${width}px sparse shelf causes no horizontal overflow`);
  for (const [arrow, expectedLabel] of [[previous, "Select previous task"], [next, "Select next task"]]) {
    assert.ok(arrow.x >= view.shelf.left && arrow.x + arrow.width <= view.shelf.right, `${width}px ${expectedLabel} stays horizontally on the shelf`);
    const x = arrow.x + arrow.width / 2;
    const y = arrow.y + arrow.height / 2;
    const hit = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label"), {x, y});
    assert.equal(hit, expectedLabel, `${width}px transition art cannot intercept its arrow center hit`);
  }
}

async function assertArrowKeyboardNavigation(page) {
  const allTasks = page.getByRole("button", {name: "All tasks"});
  const previous = page.getByRole("button", {name: "Select previous task"});
  const next = page.getByRole("button", {name: "Select next task"});
  await allTasks.focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Select previous task", "Tab from All tasks reaches the actual previous arrow");
  assert.equal(await page.evaluate(() => document.activeElement?.matches(":focus-visible")), true, "previous arrow exposes its keyboard focus indicator");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Select next task", "Tab then reaches the actual next arrow");
  assert.equal(await page.evaluate(() => document.activeElement?.matches(":focus-visible")), true, "next arrow exposes its keyboard focus indicator");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", {name: catalog.tasks[1].title, exact: true}).waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => document.activeElement?.matches("pre[aria-label='Описание задачи'][tabindex='-1']")), true, "Enter on next moves focus to the newly selected description after RAF");
  await previous.focus();
  assert.equal(await page.evaluate(() => document.activeElement?.matches(":focus-visible")), true, "previous arrow remains visibly focused before Space activation");
  await page.keyboard.press(" ");
  await page.getByRole("heading", {name: catalog.tasks[0].title, exact: true}).waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => document.activeElement?.matches("pre[aria-label='Описание задачи'][tabindex='-1']")), true, "Space on previous returns focus to the newly selected description after RAF");
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
  const visibleImages = view.images.filter(image => image.visible);
  const nonOwlImages = visibleImages.filter(image => image.src !== "/cattasks/shelf/owl.png");
  assert.equal(nonOwlImages.length, shelfAssets.length, `${width}px keeps the nine approved non-owl shelf assets`);
  assert.deepEqual(nonOwlImages.map(image => image.src).sort(), shelfAssets.map(name => `/cattasks/shelf/${name}`).sort(), `${width}px loads the approved non-owl shelf assets`);
  assert.ok(view.mobileImages.every(image => !image.visible), `${width}px keeps mobile art hidden on wide task views`);
  assert.ok(visibleImages.every(image => image.decoded && image.pointerEvents === "none"), `${width}px visible art is decoded and pointer-inert`);
  assert.ok(visibleImages.every(image => image.box.width > 0 && image.box.height > 0 && image.box.left >= 0 && image.box.right <= width), `${width}px visible art stays in the viewport`);
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
  if (width >= 1440) {
    assert.ok(view.owl?.visible, `${width}px exposes the desktop owl`);
    assert.equal(view.owl.src, "/cattasks/shelf/owl.png", `${width}px uses the approved owl asset`);
    assert.equal(Math.round(view.owl.box.width * 10) / 10, 52.8, `${width}px owl is enlarged by 10% to 52.8px`);
    assert.equal(view.owl.pointerEvents, "none", `${width}px owl remains pointer-inert`);
    assert.ok(view.owl.box.left >= p.shelfPlantNextRight.box.right - 1 && view.owl.box.right <= p.shelfPlantCup.box.left + 1, `${width}px owl sits between the right arrow vine and the mug plant`);
  } else {
    assert.ok(!view.owl || !view.owl.visible, `${width}px keeps the desktop-only owl hidden below 1440px`);
  }
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
    for (const width of [1221, 1250, 1439, 1440, 1536]) await assertWideShelf(page, width);
    assertDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("601–1200px keeps the sparse wooden arrow shelf outside the catalogue", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 600, height: 900}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const width of [601, 780, 1150, 1200]) await assertSparseShelf(page, width, 0, intermediateShelfAssets);
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

test("catalogue shelf and Back to task use the approved independent composition", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor();

    const mossRailOffsets = new Map();
    for (const [width, expectedShelfHeight, expectedBrackets, expectedMascotWidth, expectedButtonHeight] of [
      [1757, 22, 2, 101, 60],
      [1440, 22, 2, 101, 60],
      [1151, 22, 2, 101, 60],
      [1150, 22, 2, 101, 60],
      [1149, 22, 2, 101, 60],
      [1120, 22, 2, 101, 60],
      [761, 22, 2, 101, 60],
      [760, 22, 2, 101, 60],
      [602, 22, 2, 101, 60],
      [601, 11, 0, 77, 46],
      [600, 11, 0, 77, 46],
      [582, 11, 0, 77, 46],
      [320, 11, 0, 77, 46],
    ]) {
      await page.setViewportSize({width, height: 900});
      const nunito = width === 1757
        ? await page.evaluate(async () => {
          await document.fonts.ready;
          const faces = await document.fonts.load('900 56px "Nunito"');
          return {
            loaded: faces.length > 0,
            available: document.fonts.check('900 56px "Nunito"'),
          };
        })
        : null;
      const view = await page.evaluate(async () => {
        const box = element => {
          const {x, y, width, height} = element.getBoundingClientRect();
          return {x, y, width, height, left: x, right: x + width, top: y, bottom: y + height};
        };
        const shelf = document.querySelector("[class*='catalogueShelf']");
        const brackets = Array.from(document.querySelectorAll("[class*='catalogueShelfBracket']"));
        const capybara = document.querySelector("img[data-catalogue-back-capybara]");
        const visible = image => getComputedStyle(image).display !== "none" && image.getBoundingClientRect().width > 0;
        const stickerImages = [
          document.querySelector("img[data-catalogue-shelf-sticker='samoyed']"),
          document.querySelector("img[data-catalogue-shelf-sticker='yarn']"),
        ];
        const rabbit = document.querySelector("img[class*='backRabbit']");
        const candles = document.querySelector("img[class*='compactCandles']");
        const button = Array.from(document.querySelectorAll("button")).find(node => node.textContent?.trim() === "←Back to task");
        const backControl = button?.closest("[class*='backControl']");
        const arrow = button?.querySelector("span");
        const title = document.querySelector("h1");
        if (!shelf || !capybara || stickerImages.some(image => !image) || !rabbit || !candles || !button || !backControl || !arrow || !title) throw new Error("catalogue shelf, title, stickers, rabbit, candles, capybara, Back control, button, or arrow is unavailable");
        await capybara.decode();
        await Promise.all([...stickerImages, rabbit, candles].filter(visible).map(image => image.decode()));
        const paintedBottom = image => {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d", {willReadFrequently: true});
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let bottom = -1;
          for (let y = canvas.height - 1; y >= 0 && bottom < 0; y -= 1) for (let x = 0; x < canvas.width; x += 1) if (pixels[(y * canvas.width + x) * 4 + 3] >= 240) { bottom = y; break; }
          const imageBox = box(image);
          return bottom < 0 ? null : imageBox.top + (bottom + 1) * imageBox.height / canvas.height;
        };
        const titleStyle = getComputedStyle(title);
        const moss = getComputedStyle(title, "::after");
        return {
          shelf: box(shelf),
          shelfHeight: getComputedStyle(shelf).height,
          taskDecorationCount: document.querySelectorAll("[class*='shelfDecoration']").length,
          brackets: brackets.map(bracket => ({box: box(bracket), visible: getComputedStyle(bracket).display !== "none", pointerEvents: getComputedStyle(bracket).pointerEvents, backgroundImage: getComputedStyle(bracket).backgroundImage})),
          capybara: {box: box(capybara), src: new URL(capybara.src).pathname, alt: capybara.alt, decoded: capybara.complete && capybara.naturalWidth > 0, pointerEvents: getComputedStyle(capybara).pointerEvents},
          stickers: stickerImages.map(image => ({
            box: box(image),
            src: new URL(image.src).pathname,
            alt: image.alt,
            decoded: image.complete && image.naturalWidth > 0,
            visible: getComputedStyle(image).display !== "none" && getComputedStyle(image).visibility !== "hidden" && image.getBoundingClientRect().width > 0,
            pointerEvents: getComputedStyle(image).pointerEvents,
            ariaHidden: image.closest("[aria-hidden='true']")?.getAttribute("aria-hidden") ?? null,
          })),
          rabbit: {visible: visible(rabbit), decoded: rabbit.complete && rabbit.naturalWidth > 0, pointerEvents: getComputedStyle(rabbit).pointerEvents, bottom: getComputedStyle(rabbit).bottom},
          candles: {visible: visible(candles), decoded: candles.complete && candles.naturalWidth > 0, pointerEvents: getComputedStyle(candles).pointerEvents, translate: getComputedStyle(candles).translate, box: box(candles), paintedBottom: visible(candles) ? paintedBottom(candles) : null},
          backFoliage: ["::before", "::after"].map(pseudo => {
            const style = getComputedStyle(backControl, pseudo);
            return {content: style.content, backgroundImage: style.backgroundImage, zIndex: style.zIndex, pointerEvents: style.pointerEvents};
          }),
          button: {...box(button), zIndex: getComputedStyle(button).zIndex},
          arrow: {box: box(arrow), text: arrow.textContent, visible: getComputedStyle(arrow).display !== "none"},
          title: {
            box: box(title),
            fontFamily: titleStyle.fontFamily,
            fontSize: titleStyle.fontSize,
            fontWeight: titleStyle.fontWeight,
            moss: {
              content: moss.content,
              backgroundImage: moss.backgroundImage,
              left: moss.left,
              top: moss.top,
              width: moss.width,
              height: moss.height,
              pointerEvents: moss.pointerEvents,
            },
          },
          pageWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      const visibleBrackets = view.brackets.filter(bracket => bracket.visible && bracket.box.width > 0 && bracket.box.height > 0);
      assert.equal(view.shelfHeight, `${expectedShelfHeight}px`, `${width}px catalogue shelf uses the approved height`);
      assert.equal(view.taskDecorationCount, 0, `${width}px catalogue retains no task-only shelfDecoration subtree`);
      assert.equal(visibleBrackets.length, expectedBrackets, `${width}px catalogue exposes exactly its approved bracket count`);
      assert.ok(visibleBrackets.every(bracket => bracket.pointerEvents === "none" && bracket.backgroundImage.includes("/cattasks/shelf/brackets.png") && bracket.box.left >= 0 && bracket.box.right <= width), `${width}px visible catalogue brackets are contained and pointer-inert`);
      assert.equal(view.capybara.src, "/cattasks/catalogue-back-capybara.png", `${width}px uses the supplied sleeping capybara`);
      assert.equal(view.capybara.alt, "", `${width}px capybara is decorative`);
      assert.equal(view.capybara.decoded, true, `${width}px capybara decodes`);
      assert.equal(view.capybara.pointerEvents, "none", `${width}px capybara cannot intercept the button`);
      assert.equal(Math.round(view.capybara.box.width), expectedMascotWidth, `${width}px capybara keeps its approved responsive width`);
      assert.ok(Math.abs((view.capybara.box.left + view.capybara.box.right) / 2 - (view.button.left + view.button.right) / 2) <= 1, `${width}px capybara stays centered over Back to task`);
      assert.deepEqual(view.backFoliage.map(foliage => foliage.backgroundImage.includes("catalogue-back-vine.png") || foliage.backgroundImage.includes("catalogue-back-leaves.png")).sort(), [true, true], `${width}px keeps both approved Back foliage layers`);
      assert.ok(view.backFoliage.every(foliage => foliage.content === '""' && foliage.zIndex === "0" && foliage.pointerEvents === "none"), `${width}px Back foliage stays visible, decorative, and behind the front button edge`);
      assert.equal(view.button.zIndex, "1", `${width}px Back to task remains above its foliage layers`);
      const [samoyed, yarn] = view.stickers;
      assert.equal(samoyed.src, "/cattasks/catalogue/samoyed-cushion.png", `${width}px uses the approved Samoyed crop`);
      assert.equal(yarn.src, "/cattasks/catalogue/yarn-ball.png", `${width}px uses the approved yarn crop`);
      assert.ok(view.stickers.every(sticker => sticker.alt === "" && sticker.decoded && sticker.pointerEvents === "none" && sticker.ariaHidden === "true"), `${width}px stickers remain decoded, inert, and outside the accessibility tree`);
      assert.equal(samoyed.visible, width >= 900, `${width}px Samoyed visibility follows the approved 900px catalogue breakpoint`);
      assert.equal(yarn.visible, width >= 1000, `${width}px yarn visibility follows the approved 1000px catalogue breakpoint`);
      assert.equal(view.rabbit.visible, width >= 761, `${width}px rabbit and carrot follow the approved full-shelf breakpoint`);
      assert.equal(view.rabbit.pointerEvents, "none", `${width}px rabbit and carrot remain decorative`);
      if (view.rabbit.visible) {
        assert.equal(view.rabbit.decoded, true, `${width}px rabbit and carrot asset decodes`);
        assert.equal(view.rabbit.bottom, "-8px", `${width}px rabbit and carrot retain the approved lowered placement`);
      }
      assert.equal(view.candles.visible, width <= 601, `${width}px candles appear only on the compact shelf`);
      assert.equal(view.candles.pointerEvents, "none", `${width}px candles remain decorative`);
      if (width <= 601) {
        assert.equal(view.candles.decoded, true, `${width}px candle asset decodes`);
        assert.equal(view.candles.translate, "0px 4px", `${width}px candles retain the approved compact lowering`);
        assert.ok(view.candles.paintedBottom >= view.shelf.top + 2 && view.candles.paintedBottom <= view.shelf.bottom, `${width}px visible candle foot remains seated within the compact shelf rail`);
      }
      if (width >= 1000) {
        assert.equal(Math.round(samoyed.box.width), 116, `${width}px Samoyed has the approved width`);
        assert.equal(Math.round(yarn.box.width), 44, `${width}px yarn has the approved width`);
        assert.ok(Math.abs(samoyed.box.left - view.title.box.right - 22) <= 1, `${width}px Samoyed begins 22px after All tasks`);
        assert.ok(Math.abs(yarn.box.left - samoyed.box.right - 9) <= 1, `${width}px yarn remains 9px after the Samoyed`);
        assert.ok(Math.abs(samoyed.box.bottom - view.shelf.top - 14) <= 1, `${width}px Samoyed sits 14px into the shelf`);
        assert.ok(Math.abs(yarn.box.bottom - view.shelf.top - 14) <= 1, `${width}px yarn sits 14px into the shelf`);
      }
      assert.equal(Math.round(view.button.height), expectedButtonHeight, `${width}px Back to task keeps its approved height`);
      assert.ok(Math.abs(view.button.bottom - view.shelf.top) <= 1, `${width}px Back to task sits on the shelf top edge`);
      if (width > 760) assert.ok(view.button.width >= 235, `${width}px Back to task keeps the desktop minimum width`);
      assert.equal(view.arrow.text, "←", `${width}px Back to task keeps its arrow`);
      assert.equal(view.arrow.visible, true, `${width}px Back to task arrow remains visible`);
      if (width > 601) {
        const raisedTransitionTitle = width <= 760;
        assert.ok(Math.abs(view.title.box.left - (view.shelf.left + 16)) <= 1, `${width}px All tasks starts 16px from the shelf edge`);
        assert.ok(Math.abs(view.title.box.bottom - (view.shelf.top + (raisedTransitionTitle ? -1 : 7))) <= 1, `${width}px All tasks uses its approved shelf clearance`);
        assert.equal(view.title.moss.backgroundImage.includes("/cattasks/catalogue/title-moss.png"), true, `${width}px title uses the local approved moss texture`);
        assert.equal(view.title.moss.pointerEvents, "none", `${width}px title moss is pointer-inert`);
        assert.equal(parseFloat(view.title.moss.left), -21, `${width}px title moss starts 21px left of the title`);
        assert.ok(Math.abs(parseFloat(view.title.moss.top) - (view.title.box.height - (raisedTransitionTitle ? 4 : 12))) <= 0.1, `${width}px title moss uses its approved title-relative overlap`);
        assert.ok(Math.abs(parseFloat(view.title.moss.width) - (view.title.box.width + 21)) <= 0.1, `${width}px title moss extends 21px beyond the title`);
        mossRailOffsets.set(width, {
          top: view.title.box.top + parseFloat(view.title.moss.top) - view.shelf.top,
          bottom: view.title.box.top + parseFloat(view.title.moss.top) + parseFloat(view.title.moss.height) - view.shelf.top,
        });
      } else {
        assert.equal(view.title.moss.content, '""', `${width}px compact title retains its decorative moss pseudo-element`);
        assert.equal(view.title.moss.backgroundImage.includes("/cattasks/catalogue/title-moss.png"), true, `${width}px compact title retains the approved moss texture`);
        assert.equal(view.title.fontFamily.includes("Nunito"), true, `${width}px compact title retains Nunito`);
        if (width === 601) {
          assert.ok(Math.abs(view.title.box.bottom - (view.shelf.top + 2)) <= 1, "601px retains the compact title's approved shelf position");
          assert.ok(Math.abs(view.title.box.top + parseFloat(view.title.moss.top) - (view.shelf.top - 7)) <= 1, "601px retains the compact moss position against the shelf");
        }
      }
      if (width === 1757) {
        assert.deepEqual(nunito, {loaded: true, available: true}, "1757px waits for the loaded local Nunito face");
        assert.equal(view.title.fontFamily.includes("Nunito"), true, "1757px All tasks uses Nunito");
        assert.equal(view.title.fontWeight, "900", "1757px All tasks uses Nunito 900");
        assert.equal(view.title.fontSize, "56px", "1757px All tasks uses the approved reference size");
      }
      assert.equal(view.pageWidth, view.viewportWidth, `${width}px catalogue shelf and button avoid horizontal overflow`);
      const button = page.getByRole("button", {name: "Back to task"});
      await button.focus();
      assert.equal(await button.evaluate(node => node === document.activeElement), true, `${width}px Back to task remains keyboard focusable`);
      const hit = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.closest("button")?.textContent?.trim(), {x: view.button.left + view.button.width / 2, y: view.button.top + view.button.height / 2});
      assert.equal(hit, "←Back to task", `${width}px capybara and shelf do not block Back to task`);
    }
    const normalMossOffsets = mossRailOffsets.get(761);
    for (const width of [602, 760]) {
      const transitionMossOffsets = mossRailOffsets.get(width);
      assert.ok(Math.abs(transitionMossOffsets.top - normalMossOffsets.top) <= .1 && Math.abs(transitionMossOffsets.bottom - normalMossOffsets.bottom) <= .1, `${width}px raised title preserves the moss's absolute position against the shelf`);
    }
    await page.setViewportSize({width: 1440, height: 900});
    await page.getByRole("button", {name: "Back to task"}).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", {name: catalog.tasks[0].title, exact: true}).waitFor();
    assert.equal(await page.locator("img[data-catalogue-shelf-sticker]").count(), 0, "task page has no catalogue shelf stickers");
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor();
    await page.emulateMedia({reducedMotion: "reduce"});
    assert.equal(await page.getByRole("button", {name: "Back to task"}).evaluate(node => getComputedStyle(node).transitionDuration), "0s", "reduced motion removes Back to task animation");
    await page.setViewportSize({width: 1757, height: 900});
    await page.emulateMedia({forcedColors: "active"});
    const forcedColors = await page.getByRole("heading", {name: "All tasks", exact: true}).evaluate(title => {
      const style = getComputedStyle(title);
      const moss = getComputedStyle(title, "::after");
      return {
        color: style.color,
        textFillColor: style.webkitTextFillColor,
        backgroundImage: style.backgroundImage,
        mossContent: moss.content,
        mossBackgroundImage: moss.backgroundImage,
        mossDisplay: moss.display,
      };
    });
    assert.notEqual(forcedColors.color, "rgba(0, 0, 0, 0)", "forced colors keeps All tasks readable");
    assert.equal(forcedColors.textFillColor, forcedColors.color, "forced colors restores the All tasks text fill");
    assert.equal(forcedColors.backgroundImage, "none", "forced colors removes All tasks gradient text paint");
    assert.ok(
      forcedColors.mossDisplay === "none" || forcedColors.mossContent === "none" || forcedColors.mossBackgroundImage === "none",
      "forced colors hides the decorative title moss",
    );
    assertDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("approved mobile shelf composition swaps exact task-only art without blocking controls", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 390, height: 900}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    const expectedVisible = new Map([
      [320, []],
      [321, ["sprig"]],
      [390, ["sprig"]],
      [430, ["sprig"]],
      [431, ["sprig"]],
      [598, ["sprig"]],
      [600, ["sprig"]],
      [601, []],
    ]);

    for (const [width, expected] of expectedVisible) {
      await page.setViewportSize({width, height: 900});
      await page.mouse.move(0, 899);
      await page.waitForTimeout(240);
      const view = await page.evaluate(async () => {
        const box = element => {
          const {x, y, width, height} = element.getBoundingClientRect();
          return {x, y, width, height, left: x, right: x + width, top: y, bottom: y + height};
        };
        const visible = element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && style.display !== "none" && style.visibility !== "hidden";
        };
        const art = Array.from(document.querySelectorAll("[data-mobile-shelf-art]"));
        const fox = Array.from(document.querySelectorAll("[data-mobile-fox]"));
        const legacyArt = Array.from(document.querySelectorAll("[class*='taskShelf'] [class*='shelfDecoration'] img:not([data-mobile-shelf-art])"));
        await Promise.all([...art, ...fox].filter(visible).map(image => image.decode()));
        const identity = document.querySelector("[class*='taskIdentity']");
        const shelf = document.querySelector("[class*='taskShelf']");
        const heading = document.querySelector("#taskSolutionHeading");
        const language = document.querySelector("[class*='languageLabel']");
        return {
          art: art.map(image => ({role: image.dataset.mobileShelfArt, visible: visible(image), src: new URL(image.src).pathname, decoded: image.complete && image.naturalWidth > 0, pointerEvents: getComputedStyle(image).pointerEvents, box: box(image)})),
          fox: fox.map(image => ({role: image.dataset.mobileFox, visible: visible(image), src: new URL(image.src).pathname, decoded: image.complete && image.naturalWidth > 0, pointerEvents: getComputedStyle(image).pointerEvents, ariaHidden: image.getAttribute("aria-hidden"), width: getComputedStyle(image).width, zIndex: getComputedStyle(image).zIndex, clipPath: getComputedStyle(image).clipPath, box: box(image)})),
          legacyArt: legacyArt.map(image => ({src: new URL(image.src).pathname, visible: visible(image), box: box(image)})),
          identity: identity && box(identity),
          shelf: shelf && box(shelf),
          heading: heading && box(heading),
          language: language && box(language),
          pageWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      const visible = view.art.filter(art => art.visible);
      assert.deepEqual(visible.map(art => art.role).sort(), [...expected].sort(), `${width}px has only its approved mobile shelf art`);
      if (width <= 600) assert.ok(view.legacyArt.every(art => !art.visible), `${width}px hides every desktop shelf asset from the mobile composition`);
      assert.ok(visible.every(art => art.decoded && art.pointerEvents === "none" && art.src === `/cattasks/mobile-shelf/${art.role}.png`), `${width}px visible art is exact, decoded, and pointer-inert`);
      assert.equal(view.pageWidth, view.viewportWidth, `${width}px has no horizontal overflow`);
      assert.ok(view.identity && view.shelf && view.identity.bottom <= view.shelf.top, `${width}px identity clears the shelf`);
      if (width <= 600) assert.ok(view.heading && view.language && Math.abs((view.heading.y + view.heading.height / 2) - (view.language.y + view.language.height / 2)) <= 1 && view.heading.right <= view.language.left, `${width}px solution title and language share a row`);
      const [previous, next] = await Promise.all([
        page.getByRole("button", {name: "Select previous task"}),
        page.getByRole("button", {name: "Select next task"}),
      ]);
      assert.equal(await previous.count(), 1, `${width}px keeps the approved previous navigation control`);
      assert.equal(await next.count(), 1, `${width}px keeps the approved next navigation control`);

      const visibleFox = view.fox.filter(fox => fox.visible);
      if (width > 320 && width <= 600) {
        assert.deepEqual(visibleFox.map(fox => fox.role).sort(), ["body", "paws"], `${width}px exposes both approved fox layers`);
        assert.ok(visibleFox.every(fox => fox.src === "/cattasks/mobile-shelf/raised-paws-fox.png" && fox.decoded && fox.pointerEvents === "none" && fox.ariaHidden === "true" && fox.width === "60px"), `${width}px fox is the exact decoded, decorative, pointer-inert crop`);
        const [previousBox, nextBox] = await Promise.all([previous.boundingBox(), next.boundingBox()]);
        assert.ok(previousBox && nextBox, `${width}px retains both real navigation buttons`);
        const arrowPositions = new Map([
          [321, [86, 225]],
          [390, [91, 289]],
          [430, [94, 326]],
          [431, [94, 327]],
          [598, [108, 480]],
          [600, [108, 482]],
        ]);
        const [expectedPreviousX, expectedNextX] = arrowPositions.get(width) ?? [];
        for (const [arrow, box, expectedX] of [[previous, previousBox, expectedPreviousX], [next, nextBox, expectedNextX]]) {
          assert.equal(Math.round(box.width), 44, `${width}px ${await arrow.getAttribute("aria-label")} is 44px wide`);
          assert.equal(Math.round(box.height), 44, `${width}px ${await arrow.getAttribute("aria-label")} is 44px tall`);
          assert.equal(Math.round(box.x), expectedX, `${width}px ${await arrow.getAttribute("aria-label")} keeps its approved shelf position`);
          assert.ok(Math.abs((box.y + box.height) - (view.shelf.top + 4)) <= 1, `${width}px ${await arrow.getAttribute("aria-label")} sits 4px below the rail`);
          const hit = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label"), {x: box.x + box.width / 2, y: box.y + box.height / 2});
          assert.equal(hit, await arrow.getAttribute("aria-label"), `${width}px decorative fox cannot intercept the native arrow`);
        }
        const byRole = Object.fromEntries(visibleFox.map(fox => [fox.role, fox]));
        assert.ok(byRole.body.box.left < previousBox.x + previousBox.width && byRole.body.box.right > previousBox.x, `${width}px fox body horizontally overlaps the previous button`);
        assert.equal(byRole.body.zIndex, "1", `${width}px fox body stays behind the previous button`);
        assert.equal(byRole.paws.zIndex, "3", `${width}px fox paws stay above the previous button`);
        assert.notEqual(byRole.paws.clipPath, "none", `${width}px fox paws use the approved upper crop`);
      } else {
        assert.equal(visibleFox.length, 0, `${width}px has no fox outside its approved 321–600px range`);
      }

      if (width === 320) {
        const [previousBox, nextBox] = await Promise.all([previous.boundingBox(), next.boundingBox()]);
        assert.ok(previousBox && nextBox, "320px retains both real navigation buttons");
        assert.deepEqual([Math.round(previousBox.x), Math.round(nextBox.x)], [54, 222], "320px arrows retain the approved 54px symmetric viewport insets");
        assert.ok(Math.abs((previousBox.y + previousBox.height) - (view.shelf.top + 4)) <= 1 && Math.abs((nextBox.y + nextBox.height) - (view.shelf.top + 4)) <= 1, "320px arrows sit 4px below the rail");
      }


      for (const name of ["Test Code", "Run Code"]) {
        const button = page.getByRole("button", {name});
        const buttonBox = await button.boundingBox();
        assert.ok(buttonBox && buttonBox.height >= 44, `${width}px ${name} keeps a 44px target`);
        await button.focus();
        assert.equal(await page.evaluate(() => document.activeElement?.matches(":focus-visible")), true, `${width}px ${name} remains keyboard focusable`);
        const hit = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label"), {x: buttonBox.x + buttonBox.width / 2, y: buttonBox.y + buttonBox.height / 2});
        assert.equal(hit, name, `${width}px decorative art does not intercept ${name}`);
      }
    }
    assertDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("mobile shelf clears a long selected task title", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 390, height: 900}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    await page.getByRole("button", {name: "All tasks"}).click();
    await page.getByRole("heading", {name: "All tasks", exact: true}).waitFor();
    await page.getByRole("button", {name: `Open ${catalog.tasks[1].title}`}).click();
    const title = page.getByRole("heading", {name: catalog.tasks[1].title, exact: true});
    await title.waitFor();
    const view = await page.evaluate(async () => {
      const box = element => {
        const {x, y, width, height} = element.getBoundingClientRect();
        return {x, y, width, height, left: x, right: x + width, top: y, bottom: y + height};
      };
      const visible = element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      const art = Array.from(document.querySelectorAll("[data-mobile-shelf-art]")).filter(visible);
      const fox = Array.from(document.querySelectorAll("[data-mobile-fox]")).filter(visible);
      await Promise.all([...art, ...fox].map(image => image.decode()));
      const title = document.querySelector("[class*='taskTitle']");
      const shelf = document.querySelector("[class*='taskShelf']");
      return {
        title: title && box(title),
        shelf: shelf && box(shelf),
        art: art.map(image => ({role: image.dataset.mobileShelfArt, box: box(image), pointerEvents: getComputedStyle(image).pointerEvents})),
        fox: fox.map(image => ({role: image.dataset.mobileFox, box: box(image), pointerEvents: getComputedStyle(image).pointerEvents})),
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    assert.ok(view.title && view.shelf && view.title.bottom <= view.shelf.top, "long title clears the shelf");
    assert.deepEqual(view.art.map(art => art.role), ["sprig"], "390px long title keeps only the approved shelf sprig");
    assert.deepEqual(view.fox.map(fox => fox.role).sort(), ["body", "paws"], "390px long title keeps the approved two-layer fox");
    assert.ok([...view.art, ...view.fox].every(art => art.pointerEvents === "none"), "long title remains clear of pointer-inert decoration");
    const titleLines = await title.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); return [...range.getClientRects()].map(rect => ({left: rect.left, right: rect.right})); });
    const foxRight = Math.max(...view.fox.map(fox => fox.box.right));
    assert.ok(titleLines.every(line => line.left >= foxRight || line.right <= Math.min(...view.fox.map(fox => fox.box.left))), "long title text rectangles remain horizontally clear of the fox");
    assert.equal(view.pageWidth, view.viewportWidth, "long title does not create horizontal overflow");
    for (const name of ["Test Code", "Run Code"]) assert.ok(await page.getByRole("button", {name}).boundingBox(), `long title retains ${name}`);
    assertDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("transition shelf preserves sparse art, keyboard navigation, and title clearance", {timeout: 45_000}, async () => {
  const browser = await playwright.chromium.launch({channel: "chrome", headless: true});
  const context = await browser.newContext({viewport: {width: 1220, height: 900}});
  const page = await context.newPage();
  try {
    const diagnostics = await prepare(page);
    for (const width of [1201, 1220]) await assertSparseShelf(page, width, 20);
    await page.setViewportSize({width: 1220, height: 900});
    await assertArrowKeyboardNavigation(page);
    assertDiagnostics(diagnostics);
  } finally {
    await context.close();
    await browser.close();
  }
});
