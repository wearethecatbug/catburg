const assert = require("node:assert/strict");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.SAFE_CAT_BASE_URL || "http://127.0.0.1:3213";

async function withSession(viewport, options, executeCase) {
  let browser;
  let context;
  let page;
  const monitorFailures = [];
  let caseFailure;
  try {
    browser = await playwright.chromium.launch({
      channel: "chrome",
      headless: true,
    });
    context = await browser.newContext({
      viewport,
      colorScheme: options.colorScheme || "light",
      hasTouch: Boolean(options.hasTouch),
      isMobile: Boolean(options.hasTouch),
    });
    if (options.random !== undefined) {
      await context.addInitScript((randomValue) => {
        Math.random = () => randomValue;
      }, options.random);
    }
    page = await context.newPage();
    if (options.clockStart) await page.clock.install({ time: options.clockStart });
    if (options.beforeGoto) await options.beforeGoto(page);
    page.on("pageerror", (error) => monitorFailures.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !options.isExpectedConsoleFailure?.(message.text()) &&
        !options.isExpectedLocalFailure?.(message.text())
      )
        monitorFailures.push(`console ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      // A superseded responsive image request may be cancelled while the cat changes state.
      const requestUrl = new URL(request.url());
      const isSupersededSafeCatImage =
        request.failure()?.errorText === "net::ERR_ABORTED" &&
        request.resourceType() === "image" &&
        requestUrl.origin === new URL(baseUrl).origin &&
        requestUrl.pathname === "/_next/image" &&
        requestUrl.searchParams.get("url")?.startsWith("/safe-cat/");
      if (isSupersededSafeCatImage) return;
      if (
        request.url().startsWith(baseUrl) &&
        !options.isExpectedLocalFailure?.(request.url())
      )
        monitorFailures.push(`failed ${request.url()}`);
    });
    page.on("response", (response) => {
      if (
        response.url().startsWith(baseUrl) &&
        response.status() >= 400 &&
        !response.url().endsWith("/favicon.ico") &&
        !options.isExpectedLocalFailure?.(response.url())
      ) {
        monitorFailures.push(`${response.status()} ${response.url()}`);
      }
    });
    const response = await page.goto(
      new URL(options.route || "/", baseUrl).href,
      {
        waitUntil: "networkidle",
      },
    );
    assert.equal(
      response.status(),
      200,
      "the selected route responds successfully",
    );
    return await executeCase({ page, context, monitorFailures });
  } catch (error) {
    caseFailure = error;
    throw error;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    // Do not replace an already-reached product assertion with a cleanup monitor failure.
    if (!caseFailure)
      assert.deepEqual(
        monitorFailures,
        [],
        "browser failure monitors stay empty",
      );
  }
}

module.exports = { withSession };
