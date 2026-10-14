import path from 'path';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'sc_powerfactory_comparison_intro.html');
const names = [
  'sc_powerfactory_comparison_01_title.png',
  'sc_powerfactory_comparison_02_agenda.png'
];

const playwrightPath = pathToFileURL(
  'C:/Users/DELL/.vscode/appElectrisim/appElectrisim/src/main/webapp/node_modules/playwright/index.mjs'
).href;
const { chromium } = await import(playwrightPath);

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--hide-scrollbars', '--disable-gpu']
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 1200));

const slides = await page.$$('.slide');
if (slides.length !== names.length) {
  throw new Error(`Expected ${names.length} slides, found ${slides.length}`);
}
for (let i = 0; i < slides.length; i++) {
  const out = path.join(__dirname, names[i]);
  await slides[i].screenshot({ path: out, type: 'png' });
  console.log('wrote', out);
}
await browser.close();
