import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.SMOKE_BASE_URL ?? "https://wolfshunter-collective-test.limoorange99.workers.dev";
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
async function gotoWithRetry(page, url) {
  let response;
  for (let attempt = 1; attempt <= 3; attempt++) {
    response = await page.goto(url, { waitUntil: "domcontentloaded" });
    if (response?.status() !== 503 || attempt === 3) return response;
    await page.waitForTimeout(250 * attempt);
  }
  return response;
}
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    for (const path of ["/", "/auth/login"]) {
      const response = await gotoWithRetry(page, `${baseUrl}${path}`);
      assert.equal(response?.status(), 200, `${viewport.name} ${path} must return 200`);
      assert.equal(await page.locator("body").count(), 1, `${viewport.name} ${path} must render a body`);
    }
    const appResponse = await gotoWithRetry(page, `${baseUrl}/app`);
    assert.ok([200, 302, 401, 410].includes(appResponse?.status() ?? 0), `${viewport.name} /app returned an unexpected status`);
    console.log(JSON.stringify({ viewport: viewport.name, appStatus: appResponse?.status() }));
    await page.close();
  }
} finally {
  await browser.close();
}

console.log("Playwright smoke passed for desktop and mobile viewports.");
