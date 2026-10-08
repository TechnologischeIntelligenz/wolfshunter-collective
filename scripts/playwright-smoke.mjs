import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.SMOKE_BASE_URL ?? "https://wolfshunter-collective-test.limoorange99.workers.dev";
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    for (const path of ["/", "/auth/login"]) {
      const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, `${viewport.name} ${path} must return 200`);
      assert.equal(await page.locator("body").count(), 1, `${viewport.name} ${path} must render a body`);
    }
    const appResponse = await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
    assert.ok([200, 302, 401].includes(appResponse?.status() ?? 0), `${viewport.name} /app returned an unexpected status`);
    console.log(JSON.stringify({ viewport: viewport.name, appStatus: appResponse?.status() }));
    await page.close();
  }
} finally {
  await browser.close();
}

console.log("Playwright smoke passed for desktop and mobile viewports.");
