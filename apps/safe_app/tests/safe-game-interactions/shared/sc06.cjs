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

module.exports = { sc06RenderedReferences };
