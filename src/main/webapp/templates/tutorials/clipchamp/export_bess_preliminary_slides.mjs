/**
 * One-off: npx playwright install chromium && node export_bess_preliminary_slides.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'bess_preliminary_design_intro.html');
const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

const out = [
  ['bess_preliminary_design_01_title.png', 0],
  ['bess_preliminary_design_02_agenda.png', 1080],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(fileUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

for (const [name, scrollY] of out) {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(__dirname, name),
    clip: { x: 0, y: 0, width: 1920, height: 1080 },
  });
  console.log('Wrote', name);
}

await browser.close();
