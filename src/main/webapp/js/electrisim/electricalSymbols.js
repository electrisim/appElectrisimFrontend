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

/** Same visual language as sidebar / map editor: SVG symbol + shapeELXXX (used by Pandapower import). */
export const ELECTRISIM_SYMBOL_VERTEX_BASE =
  'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;aspect=fixed;imageAspect=1;';

export function vertexStyleFromElectrisimSymbol(symbolKey, shapeELXXX) {
  const sym = ELECTRICAL_SYMBOLS[symbolKey];
  if (!sym) {
    return `shapeELXXX=${shapeELXXX}`;
  }
  return `${ELECTRISIM_SYMBOL_VERTEX_BASE}shape=image;image=${sym.url};shapeELXXX=${shapeELXXX}`;
}

export function vertexSizeFromElectrisimSymbol(symbolKey, fallbackW = 56, fallbackH = 56) {
  const sym = ELECTRICAL_SYMBOLS[symbolKey];
  if (!sym) return [fallbackW, fallbackH];
  return [sym.w, sym.h];
}

/**
 * Horizontal bus for Pandapower / map import and any long busbar cell.
 *
 * Matches the palette sidebar bus from ``app.min.js`` (electricalBusbars → "Bus"):
 *   ``line;strokeWidth=2;html=1;shapeELXXX=Bus;points=[[0,0.5],[0.05,0.5,0], …, [1,0.5]]``
 * — ``shape=line`` (thin horizontal stroke at cell centre) plus a connection-point grid every
 * 5 % so edges can dock anywhere along the bar.
 */
export function vertexStyleImportedBusbar(shapeELXXX = 'Bus') {
  const pts = [[0, 0.5]];
  for (let x = 5; x < 100; x += 5) {
    pts.push([x / 100, 0.5, 0]);
  }
  pts.push([1, 0.5]);
  const pointsJson = JSON.stringify(pts);
  return (
    `shape=line;strokeWidth=2;html=1;shapeELXXX=${shapeELXXX};points=${pointsJson}`
  );
}
