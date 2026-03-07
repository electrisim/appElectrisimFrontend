const fs = require('fs');
const path = require('path');

const websiteSvg = fs.readFileSync(
  path.join(__dirname, '../../../website/website/electrical_symbols.svg'),
  'utf8'
);

const outDir = path.join(__dirname, '../src/main/webapp/images/electrical');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const symbolRe = /<symbol id="(sym-[^"]+)" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g;
let m;
while ((m = symbolRe.exec(websiteSvg)) !== null) {
  const [, id, viewBox, content] = m;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
${content.trim()}
</svg>
`;
  fs.writeFileSync(path.join(outDir, id + '.svg'), svg);
  console.log('Created', id + '.svg');
}
