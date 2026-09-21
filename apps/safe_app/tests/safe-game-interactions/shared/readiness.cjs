async function waitForStableVisualGeometry(page, settleFrames = true) {
  await page.evaluate(async () => document.fonts.ready);
  let pending = [];
  for (let attempt = 0; attempt < 100; attempt += 1) {
    pending = await page.evaluate(() => [...document.images].filter((image) => !image.complete || !image.naturalWidth || !image.naturalHeight).map((image) => ({ src: image.getAttribute("src"), currentSrc: image.currentSrc, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight })));
    if (!pending.length) break;
    await page.waitForTimeout(25);
  }
  if (pending.length) throw new Error(`visual geometry image readiness timed out: ${JSON.stringify(pending)}`);
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => {}))));
  if (settleFrames) await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function waitForArtworkReadiness(page, locator) {
  let snapshot;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    snapshot = await locator.evaluate((element) => {
      const rendered = element instanceof HTMLImageElement ? element : element.querySelector("img");
      if (rendered instanceof HTMLImageElement) return { kind: "image", ready: rendered.complete && rendered.naturalWidth > 0 && rendered.naturalHeight > 0, src: rendered.getAttribute("src"), currentSrc: rendered.currentSrc, complete: rendered.complete, naturalWidth: rendered.naturalWidth, naturalHeight: rendered.naturalHeight };
      const owner = [element, ...element.querySelectorAll("*")].find((candidate) => getComputedStyle(candidate).backgroundImage !== "none"); const reference = getComputedStyle(owner || element).backgroundImage; const url = reference.match(/url\(["']?(.*?)["']?\)/)?.[1]; const images = window.__safeCatArtworkReadiness ||= new Map(); let image = images.get(url); if (!image) { image = new Image(); image.src = url; images.set(url, image); } return { kind: "background", ready: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0, src: image.src, reference, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
    });
    if (snapshot.ready) return snapshot;
    await page.waitForTimeout(25);
  }
  throw new Error(`visible alpha ${snapshot?.kind || "artwork"} readiness timed out: ${JSON.stringify(snapshot)}`);
}

async function visibleAlphaBounds(page, locator) {
  await waitForArtworkReadiness(page, locator);
  return locator.evaluate((element) => {
    const rendered = element instanceof HTMLImageElement ? element : element.querySelector("img");
    const owner = rendered ? null : [element, ...element.querySelectorAll("*")].find((candidate) => getComputedStyle(candidate).backgroundImage !== "none");
    const source = rendered || window.__safeCatArtworkReadiness?.get(getComputedStyle(owner || element).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]);
    if (!source) throw new Error("visible alpha artwork readiness cache was unavailable");
    const rect = (rendered || owner || element).getBoundingClientRect();
    const style = getComputedStyle(rendered || owner || element);
    if (style.transform !== "none") {
      const matrix = style.transform.match(/matrix\(([^)]+)\)/)?.[1].split(",").map(Number);
      if (!matrix || matrix.length !== 6 || Math.abs(matrix[1]) > 0.0001 || Math.abs(matrix[2]) > 0.0001) throw new Error(`visible alpha mapper only supports axis-aligned artwork transforms, received ${style.transform}`);
    }
    const canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
    for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 8) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
    }
    if (right < left) throw new Error("public artwork has no visible alpha pixels");
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const position = style.objectPosition.trim().split(/\s+/);
    const parse = (token, axis) => { const value = token.toLowerCase(); if (value === "center") return .5; if (value === "left" || value === "top") return 0; if (value === "right" || value === "bottom") return 1; if (value.endsWith("%")) return Number.parseFloat(value) / 100; const pixels = Number.parseFloat(value); return Number.isFinite(pixels) ? pixels / Math.max(1, axis) : .5; };
    const offsetX = rect.x + (rect.width - canvas.width * scale) * parse(position[0] || "50%", rect.width - canvas.width * scale);
    const offsetY = rect.y + (rect.height - canvas.height * scale) * parse(position[1] || position[0] || "50%", rect.height - canvas.height * scale);
    const hitTarget = element instanceof HTMLElement ? element.closest("button") : null;
    const hitBox = hitTarget?.getBoundingClientRect();
    const pointFor = (x, y, sourceAlpha) => { const point = { x: Math.round(offsetX + (x + .5) * scale), y: Math.round(offsetY + (y + .5) * scale), sourceAlpha }; const sx = Math.floor((point.x - offsetX) / scale), sy = Math.floor((point.y - offsetY) / scale); point.alpha = sx >= 0 && sx < canvas.width && sy >= 0 && sy < canvas.height ? pixels[(sy * canvas.width + sx) * 4 + 3] : null; return point; };
    let transparentPoint = null, opaquePoint = null;
    if (hitBox) for (let y = 0; y < canvas.height && (!transparentPoint || !opaquePoint); y += 1) for (let x = 0; x < canvas.width && (!transparentPoint || !opaquePoint); x += 1) { const alpha = pixels[(y * canvas.width + x) * 4 + 3], point = pointFor(x, y, alpha), topmost = document.elementFromPoint(point.x, point.y); if (point.x < hitBox.left || point.x >= hitBox.right || point.y < hitBox.top || point.y >= hitBox.bottom || !topmost || !(topmost === hitTarget || hitTarget.contains(topmost))) continue; point.topmostHitTarget = true; if (alpha <= 8 && point.alpha !== null && point.alpha <= 8 && !transparentPoint) transparentPoint = point; if (alpha >= 192 && point.alpha !== null && point.alpha > 8 && !opaquePoint) opaquePoint = point; }
    return { x: offsetX + left * scale, y: offsetY + top * scale, width: (right - left + 1) * scale, height: (bottom - top + 1) * scale, transparentPoint, opaquePoint };
  });
}

module.exports = { waitForStableVisualGeometry, waitForArtworkReadiness, visibleAlphaBounds };
