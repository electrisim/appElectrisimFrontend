/**
 * Electrical symbol image URLs from website/electrical_symbols.svg
 * Used for map-to-electrical conversion, data import, and palette
 */
const BASE = 'images/electrical/';

/** Longest side of the symbol on the diagram; keeps icons similar in size without stretching SVGs. */
export const ELECTRISIM_SYMBOL_MAX = 56;

function fit(nw, nh) {
  const m = Math.max(nw, nh);
  const s = ELECTRISIM_SYMBOL_MAX / m;
  return { w: Math.round(nw * s), h: Math.round(nh * s) };
}

export const ELECTRICAL_SYMBOLS = {
  'sym-bus': { url: BASE + 'sym-bus.svg', ...fit(80, 20) },
  'sym-dc-bus': { url: BASE + 'sym-dc-bus.svg', ...fit(80, 24) },
  'sym-ext-grid': { url: BASE + 'sym-ext-grid.svg', ...fit(58, 58) },
  'sym-generator': { url: BASE + 'sym-generator.svg', ...fit(58, 58) },
  'sym-static-gen': { url: BASE + 'sym-static-gen.svg', ...fit(58, 58) },
  'sym-asym-static-gen': { url: BASE + 'sym-asym-static-gen.svg', ...fit(64, 62) },
  'sym-source-dc': { url: BASE + 'sym-source-dc.svg', ...fit(100, 100) },
  'sym-transformer': { url: BASE + 'sym-transformer.svg', ...fit(72, 48) },
  'sym-3w-transformer': { url: BASE + 'sym-3w-transformer.svg', ...fit(72, 72) },
  'sym-shunt': { url: BASE + 'sym-shunt.svg', ...fit(38, 58) },
  'sym-capacitor': { url: BASE + 'sym-capacitor.svg', ...fit(50, 80) },
  'sym-load': { url: BASE + 'sym-load.svg', ...fit(52, 62) },
  'sym-asym-load': { url: BASE + 'sym-asym-load.svg', ...fit(52, 62) },
  'sym-impedance': { url: BASE + 'sym-impedance.svg', ...fit(74, 28) },
  'sym-ward': { url: BASE + 'sym-ward.svg', ...fit(74, 38) },
  'sym-ext-ward': { url: BASE + 'sym-ext-ward.svg', ...fit(74, 38) },
  'sym-motor': { url: BASE + 'sym-motor.svg', ...fit(58, 58) },
  'sym-storage': { url: BASE + 'sym-storage.svg', ...fit(54, 54) },
  'sym-svc': { url: BASE + 'sym-svc.svg', ...fit(58, 68) },
  'sym-tcsc': { url: BASE + 'sym-tcsc.svg', ...fit(92, 46) },
  'sym-ssc': { url: BASE + 'sym-ssc.svg', ...fit(58, 62) },
  'sym-dc-line': { url: BASE + 'sym-dc-line.svg', ...fit(74, 48) },
  'sym-load-dc': { url: BASE + 'sym-load-dc.svg', ...fit(46, 60) },
  'sym-switch': { url: BASE + 'sym-switch.svg', ...fit(74, 38) },
  'sym-switch-closed': { url: BASE + 'sym-switch-closed.svg', ...fit(74, 38) },
  'sym-vsc': { url: BASE + 'sym-vsc.svg', ...fit(80, 52) },
  'sym-b2b-vsc': { url: BASE + 'sym-b2b-vsc.svg', ...fit(116, 52) },
  'sym-pv': { url: BASE + 'sym-pv.svg', ...fit(68, 104) },
  'sym-bess-ac': { url: BASE + 'sym-bess-ac.svg', ...fit(100, 60) },
};

/** Build style string for shape=image with given symbol key */
export function symbolStyle(symbolKey, baseStyle = '') {
  const s = ELECTRICAL_SYMBOLS[symbolKey];
  if (!s) return baseStyle;
  const imgPart = `shape=image;image=${s.url};aspect=fixed;imageAspect=1;`;
  return (baseStyle ? baseStyle + ';' : '') + imgPart;
}
