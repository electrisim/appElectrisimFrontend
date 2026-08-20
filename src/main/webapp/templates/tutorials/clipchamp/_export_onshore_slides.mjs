import path from 'path';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'onshore_33mw_intro.html');
const names = [
  'onshore_33mw_01_title.png',
  'onshore_33mw_02_agenda.png',
  'onshore_33mw_03_network.png',
  'onshore_33mw_04_wind_turbine.png',
  'onshore_33mw_05_park_controller.png',
  'onshore_33mw_06_load_flow.png',
  'onshore_33mw_07_expand.png',
  'onshore_33mw_08_outro.png'
];

const puppeteerPath = path.join(process.env.TEMP, 'slide-export', 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js');
const puppeteerMod = await import(pathToFileURL(puppeteerPath).href);
const puppeteer = puppeteerMod.default ?? puppeteerMod;

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--hide-scrollbars', '--disable-gpu']
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: 60000 });
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
