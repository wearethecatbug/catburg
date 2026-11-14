function withinReadinessTimeout(promise, description, timeoutMs = 30_000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${description} timed out after ${Math.ceil(timeoutMs)}ms`)), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
}

async function waitForStableVisualGeometry(page, settleFrames = true) {
  await withinReadinessTimeout(page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.complete ? image.decode().catch(() => {}) : new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
        if (image.complete) resolve();
      })));
  }), "visual geometry image readiness");
  if (settleFrames) await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function waitForArtworkReadiness(page, locator) {
  const deadline = performance.now() + 30_000;
  let snapshot;
  // Resolve the locator again on each check because React can replace the image.
  while (performance.now() < deadline) {
    const remainingMs = Math.max(1, deadline - performance.now());
    snapshot = await withinReadinessTimeout(
      locator.evaluate((element) => {
        let image = element instanceof HTMLImageElement ? element : element.querySelector("img");
        let reference;
        const kind = image ? "image" : "background";
        if (!image) {
          const owner = [element, ...element.querySelectorAll("*")]
            .find((candidate) => getComputedStyle(candidate).backgroundImage !== "none");
          reference = getComputedStyle(owner || element).backgroundImage;
          const url = reference.match(/url\(["']?(.*?)["']?\)/)?.[1];
          if (!url) return { kind, ready: false, reference };
          const images = window.__safeCatArtworkReadiness ||= new Map();
          image = images.get(url);
          if (!image) {
            image = new Image();
            image.src = url;
            images.set(url, image);
          }
        }
        return {
          kind,
          ready: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
          src: image.getAttribute("src"),
          currentSrc: image.currentSrc,
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          reference,
        };
      }, undefined, { timeout: remainingMs }),
      "visible alpha artwork evaluation",
      remainingMs,
    );
    if (snapshot.ready) return snapshot;
    if (snapshot.complete && snapshot.currentSrc) {
      throw new Error(`visible alpha artwork failed to load: ${JSON.stringify(snapshot)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(50, Math.max(0, deadline - performance.now()))));
  }
  throw new Error(`visible alpha artwork readiness timed out after 30000ms: ${JSON.stringify(snapshot)}`);
}

async function visibleAlphaBounds(page, locator, sourceCrop) {
  await waitForArtworkReadiness(page, locator);
  return locator.evaluate(async (element, sourceCrop) => {
    const rendered = element instanceof HTMLImageElement ? element : element.querySelector("img");
    const owner = rendered ? null : [element, ...element.querySelectorAll("*")].find((candidate) => getComputedStyle(candidate).backgroundImage !== "none");
    let source = rendered || window.__safeCatArtworkReadiness?.get(getComputedStyle(owner || element).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]);
    if (!source) throw new Error("visible alpha artwork readiness cache was unavailable");
    if (sourceCrop && rendered) {
      const originalUrl = new URL(rendered.currentSrc || rendered.src, document.baseURI).searchParams.get("url");
      if (!originalUrl) throw new Error("visible alpha source crop requires a public original artwork URL");
      source = new Image();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`visible alpha original artwork timed out: ${originalUrl}`)), 30_000);
        source.addEventListener("load", () => { clearTimeout(timeout); resolve(); }, { once: true });
        source.addEventListener("error", () => { clearTimeout(timeout); reject(new Error(`visible alpha original artwork failed: ${originalUrl}`)); }, { once: true });
        source.src = originalUrl;
        if (source.complete) {
          clearTimeout(timeout);
          source.naturalWidth > 0 ? resolve() : reject(new Error(`visible alpha original artwork failed: ${originalUrl}`));
        }
      });
      await source.decode();
    }
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
    const crop = sourceCrop || { left: 0, top: 0, right: canvas.width, bottom: canvas.height };
    if (crop.left < 0 || crop.top < 0 || crop.right > canvas.width || crop.bottom > canvas.height || crop.left >= crop.right || crop.top >= crop.bottom)
      throw new Error(`visible alpha source crop is outside ${canvas.width}x${canvas.height}: ${JSON.stringify(crop)}`);
    let left = crop.right, top = crop.bottom, right = -1, bottom = -1;
    for (let y = crop.top; y < crop.bottom; y += 1) for (let x = crop.left; x < crop.right; x += 1) {
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
    return { x: offsetX + left * scale, y: offsetY + top * scale, width: (right - left + 1) * scale, height: (bottom - top + 1) * scale, naturalWidth: canvas.width, naturalHeight: canvas.height, transparentPoint, opaquePoint };
  }, sourceCrop);
}

module.exports = { waitForStableVisualGeometry, waitForArtworkReadiness, visibleAlphaBounds };
