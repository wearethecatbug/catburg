const assert = require("node:assert/strict");
const { waitForArtworkReadiness, waitForStableVisualGeometry, visibleAlphaBounds } = require("./readiness.cjs");
const { exact, ordinaryOwner } = require("./game-controls.cjs");



async function ordinaryArt(page, mode, asset, description = `ordinary ${mode} art`) {
  const owner = await ordinaryOwner(page, mode, description);
  const image = await exact(owner.locator("img"), `${description} image`);
  await waitForStableVisualGeometry(page, false);
  await image.waitFor({ state: "visible" });
  assert.equal(await image.isVisible(), true, `${description} image is visible`);
  let state;
  for (let attempt = 0; attempt < 100 && !state?.ready; attempt += 1) {
    state = await image.evaluate((element) => {
      if (!(element instanceof HTMLImageElement))
        throw new Error("ordinary art image is not an HTMLImageElement");
      const box = element.getBoundingClientRect();
      return {
        ready: element.complete && element.naturalWidth > 0 && element.naturalHeight > 0 && box.width > 0 && box.height > 0,
        src: element.getAttribute("src"),
        currentSrc: element.currentSrc,
        complete: element.complete,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
        loading: element.loading,
      };
    });
    if (!state.ready) await page.waitForTimeout(25);
  }
  assert.equal(state?.ready, true, `${description} image is decoded and measurable: ${JSON.stringify(state)}`);
  assert.match(
    await image.getAttribute("src"),
    new RegExp(asset),
    `${description} uses its approved current artwork`,
  );
  return owner;
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



async function clickVisibleArtwork(page, locator) {
  const { opaquePoint } = await visibleAlphaBounds(page, locator);
  assert.ok(opaquePoint, "physical artwork activation has an opaque hit point");
  await page.mouse.click(opaquePoint.x, opaquePoint.y);
  return opaquePoint;
}



function requiredHeaderGap(width, height) {
  if (height <= 600) return 8;
  if (width <= 600) return 8;
  if (width <= 1279) return 12;
  return 16;
}



function paintedCatSafeGap(catAlpha, safeAlpha) {
  return safeAlpha.y - (catAlpha.y + catAlpha.height);
}



function assertPaintedHeaderClearance({ catAlpha, title, subtitle, width, height, description }) {
  const gap = requiredHeaderGap(width, height);
  for (const [name, box] of Object.entries({ title, subtitle })) {
    assert.equal(
      intersects(catAlpha, box, 0),
      false,
      `${description} painted cat stays disjoint from the permanent ${name}`,
    );
  }
  assert.ok(
    catAlpha.y - (subtitle.y + subtitle.height) >= gap,
    `${description} painted cat keeps the ${gap}px breakpoint header gap`,
  );
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



function titleControlPointY(pathData) {
  const match = pathData?.match(/Q\s*200\s*(-?\d+(?:\.\d+)?)\s*364\s*59/);
  assert.ok(
    match,
    "the public title path retains its approved quadratic-curve geometry",
  );
  return Number(match[1]);
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

module.exports = { ordinaryArt, exactHiddenChild, intersects, visibleTextBounds, visibleRotationDegrees, visibleDialAngle, publicAssetPresentation, clickVisibleArtwork, requiredHeaderGap, paintedCatSafeGap, assertPaintedHeaderClearance, logicalBox, titleControlPointY, transformScale, transformTranslation, isPurple, isErrorRed };
