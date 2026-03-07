/**
 * Electrical symbol image URLs from website/electrical_symbols.svg
 * Used for map-to-electrical conversion, data import, and palette
 */
const BASE = 'images/electrical/';

export const ELECTRICAL_SYMBOLS = {
  'sym-bus': { url: BASE + 'sym-bus.svg', w: 80, h: 20 },
  'sym-dc-bus': { url: BASE + 'sym-dc-bus.svg', w: 80, h: 24 },
  'sym-ext-grid': { url: BASE + 'sym-ext-grid.svg', w: 58, h: 58 },
  'sym-generator': { url: BASE + 'sym-generator.svg', w: 58, h: 58 },
  'sym-static-gen': { url: BASE + 'sym-static-gen.svg', w: 58, h: 58 },
  'sym-asym-static-gen': { url: BASE + 'sym-asym-static-gen.svg', w: 64, h: 62 },
  'sym-source-dc': { url: BASE + 'sym-source-dc.svg', w: 100, h: 100 },
  'sym-transformer': { url: BASE + 'sym-transformer.svg', w: 72, h: 48 },
  'sym-3w-transformer': { url: BASE + 'sym-3w-transformer.svg', w: 72, h: 72 },
  'sym-shunt': { url: BASE + 'sym-shunt.svg', w: 38, h: 58 },
  'sym-capacitor': { url: BASE + 'sym-capacitor.svg', w: 50, h: 80 },
  'sym-load': { url: BASE + 'sym-load.svg', w: 52, h: 62 },
  'sym-asym-load': { url: BASE + 'sym-asym-load.svg', w: 52, h: 62 },
  'sym-impedance': { url: BASE + 'sym-impedance.svg', w: 74, h: 28 },
  'sym-ward': { url: BASE + 'sym-ward.svg', w: 74, h: 38 },
  'sym-ext-ward': { url: BASE + 'sym-ext-ward.svg', w: 74, h: 38 },
  'sym-motor': { url: BASE + 'sym-motor.svg', w: 58, h: 58 },
  'sym-storage': { url: BASE + 'sym-storage.svg', w: 54, h: 54 },
  'sym-svc': { url: BASE + 'sym-svc.svg', w: 58, h: 68 },
  'sym-tcsc': { url: BASE + 'sym-tcsc.svg', w: 92, h: 46 },
  'sym-ssc': { url: BASE + 'sym-ssc.svg', w: 58, h: 62 },
  'sym-dc-line': { url: BASE + 'sym-dc-line.svg', w: 74, h: 48 },
  'sym-load-dc': { url: BASE + 'sym-load-dc.svg', w: 46, h: 60 },
  'sym-switch': { url: BASE + 'sym-switch.svg', w: 74, h: 38 },
  'sym-vsc': { url: BASE + 'sym-vsc.svg', w: 80, h: 52 },
  'sym-b2b-vsc': { url: BASE + 'sym-b2b-vsc.svg', w: 116, h: 52 },
  'sym-pv': { url: BASE + 'sym-pv.svg', w: 68, h: 104 },
  'sym-bess-ac': { url: BASE + 'sym-bess-ac.svg', w: 100, h: 60 },
};

/** Build style string for shape=image with given symbol key */
export function symbolStyle(symbolKey, baseStyle = '') {
  const s = ELECTRICAL_SYMBOLS[symbolKey];
  if (!s) return baseStyle;
  const imgPart = `shape=image;image=${s.url};imageAspect=0;`;
  return (baseStyle ? baseStyle + ';' : '') + imgPart;
}
