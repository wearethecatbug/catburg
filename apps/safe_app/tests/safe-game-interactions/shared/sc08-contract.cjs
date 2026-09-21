const assert = require("node:assert/strict");
const { exact } = require("./game-controls.cjs");

async function hintLamp(button, description) {
  const icon = await exact(
    button.locator(':scope > svg[aria-hidden="true"]'),
    `${description} left decorative SVG`,
  );
  assert.equal(await button.locator(":scope > img").count(), 0, `${description} has no right lamp image`);
  assert.equal(await icon.getAttribute("focusable"), "false", `${description} SVG stays non-focusable`);
  const parts = icon.locator(":scope > path");
  assert.equal(await parts.count(), 3, `${description} keeps separate bulb, rays, and base paths`);
  return { icon, bulb: parts.nth(0), rays: parts.nth(1), base: parts.nth(2) };
}

// Snapshot final lamp tokens after native CSS transitions, not an intermediate animation frame.
async function settleHintLampTransitions(icon) {
  await icon.evaluate(async (element) => {
    const transitions = element
      .getAnimations({ subtree: true })
      .filter((animation) => animation instanceof CSSTransition && ["pending", "running"].includes(animation.playState));
    await Promise.all(transitions.map(async (transition) => {
      await transition.ready.catch(() => undefined);
      if (transition.playState === "running") await transition.finished.catch(() => undefined);
    }));
  });
}

async function expectHintLamp(button, ready, description) {
  const { icon, bulb, rays, base } = await hintLamp(button, description);
  await settleHintLampTransitions(icon);
  const appearance = await icon.evaluate((element) => {
    const [bulbPath, raysPath, basePath] = element.querySelectorAll(":scope > path");
    const read = (path) => {
      const style = getComputedStyle(path);
      return { fill: style.fill, stroke: style.stroke, filter: style.filter, transitionProperty: style.transitionProperty };
    };
    const box = element.getBoundingClientRect();
    return {
      box: { width: box.width, height: box.height },
      buttonColor: getComputedStyle(element.parentElement).color,
      bulb: read(bulbPath),
      rays: read(raysPath),
      base: read(basePath),
    };
  });
  assert.deepEqual(appearance.box, { width: 30, height: 30 }, `${description} keeps the approved 30px footprint`);
  assert.equal(await bulb.getAttribute("fill"), "currentColor", `${description} bulb remains styleable from the inline SVG`);
  assert.equal(await rays.getAttribute("fill"), "none", `${description} rays remain stroke-only`);
  assert.equal(await base.getAttribute("fill"), "none", `${description} base remains stroke-only`);
  if (ready) {
    assert.equal(appearance.bulb.fill, "rgb(255, 212, 94)", `${description} illuminates only the bulb gold`);
    assert.equal(appearance.bulb.stroke, "rgb(168, 117, 32)", `${description} outlines the lit bulb`);
    assert.equal(appearance.rays.stroke, "rgb(180, 123, 22)", `${description} illuminates the rays gold`);
    assert.equal(appearance.base.stroke, appearance.buttonColor, `${description} keeps the base dark`);
    assert.notEqual(appearance.bulb.filter, "none", `${description} gives the lit bulb its contained glow`);
  } else {
    assert.equal(appearance.bulb.fill, appearance.buttonColor, `${description} keeps the bulb at normal control color`);
    assert.equal(appearance.rays.stroke, appearance.buttonColor, `${description} keeps the rays at normal control color`);
    assert.equal(appearance.base.stroke, appearance.buttonColor, `${description} keeps the base at normal control color`);
    assert.equal(appearance.bulb.filter, "none", `${description} has no off-state glow`);
  }
  return { icon, bulb, rays, base };
}

module.exports = { hintLamp, expectHintLamp };
