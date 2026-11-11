async function selectTaskFromCatalogue(page, title) {
  await page.getByRole("button", {name: "All tasks"}).click();
  await page.getByRole("heading", {name: "All tasks"}).waitFor({state: "visible"});
  const search = page.getByRole("searchbox", {name: "Search tasks"});
  await search.fill(title);
  const row = page.locator("main ul > li").filter({has: page.getByRole("heading", {name: title, exact: true})});
  await row.waitFor({state: "visible"});
  await row.getByRole("button").click();
  await page.getByRole("heading", {level: 1, name: title, exact: true}).waitFor({state: "visible"});
  await page.getByLabel("User JavaScript code").waitFor({state: "visible"});
}

module.exports = {selectTaskFromCatalogue};
