/**
 * Shared time-series profile presets (scale factors 0–1+).
 * Used by Time Series Simulation dialog for fill/preview and aligned with backend shapes.
 */

function repeatToLength(values, timeSteps) {
    if (!values || values.length === 0) {
        return Array.from({ length: timeSteps }, () => 1);
    }
    return Array.from({ length: timeSteps }, (_, i) => values[i % values.length]);
}

function addVariation(baseProfile, timeSteps, seed, variationRange, minVal, maxVal) {
    const out = [];
    for (let i = 0; i < timeSteps; i++) {
        const base = baseProfile[i % baseProfile.length];
        const pseudo = Math.sin((seed + i) * 12.9898) * 43758.5453;
        const rand = pseudo - Math.floor(pseudo);
        const variation = (rand * 2 - 1) * variationRange;
        out.push(Math.max(minVal, Math.min(maxVal, base + variation)));
    }
    return out;
}

export function buildLoadPresetProfile(preset, timeSteps) {
    const n = Math.max(1, parseInt(timeSteps, 10) || 24);
    const daily = [0.3, 0.25, 0.2, 0.15, 0.2, 0.4, 0.7, 0.9, 1.0, 1.1, 1.05, 1.0,
        0.95, 1.0, 1.05, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35];
    const industrial = [0.1, 0.05, 0.05, 0.05, 0.1, 0.2, 0.6, 0.9, 1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0, 1.0, 0.9, 0.7, 0.5, 0.3, 0.2, 0.1, 0.05];

    if (preset === 'daily') {
        return addVariation(daily, n, 42, 0.2, 0.1, 1.3);
    }
    if (preset === 'industrial') {
        return addVariation(industrial, n, 42, 0.1, 0.02, 1.1);
    }
    if (preset === 'variable') {
        return Array.from({ length: n }, (_, hour) => {
            const base = 0.4 + 0.6 * Math.sin(2 * Math.PI * hour / 8);
            const pseudo = Math.sin((42 + hour) * 12.9898) * 43758.5453;
            const rand = pseudo - Math.floor(pseudo);
            const spike = rand < 0.4 ? 0.6 + rand : 1.0;
            return Math.max(0.05, Math.min(1.8, base * spike));
        });
    }
    return Array.from({ length: n }, () => 1);
}

export function buildGenerationPresetProfile(preset, timeSteps) {
    const n = Math.max(1, parseInt(timeSteps, 10) || 24);
    const solar = [0, 0, 0, 0, 0, 0, 0.05, 0.2, 0.5, 0.8, 0.95, 1.0,
        1.0, 0.95, 0.8, 0.5, 0.2, 0.05, 0, 0, 0, 0, 0, 0];

    if (preset === 'solar') {
        return repeatToLength(solar, n).map((val, i) => {
            if (val <= 0.3) return val;
            const pseudo = Math.sin((42 + i) * 12.9898) * 43758.5453;
            const rand = pseudo - Math.floor(pseudo);
            return Math.max(0, Math.min(1.2, val * (0.7 + rand * 0.4)));
        });
    }
    if (preset === 'wind') {
        return Array.from({ length: n }, (_, hour) => {
            const base = 0.5 + 0.5 * Math.sin(2 * Math.PI * hour / 24);
            const pseudo = Math.sin((42 + hour) * 12.9898) * 43758.5453;
            const rand = pseudo - Math.floor(pseudo);
            return Math.max(0.1, Math.min(1.1, base * (0.6 + rand * 0.8)));
        });
    }
    if (preset === 'variable') {
        return Array.from({ length: n }, (_, hour) => {
            const base = 0.5 + 0.5 * Math.cos(2 * Math.PI * hour / 6);
            const pseudo = Math.sin((42 + hour) * 12.9898) * 43758.5453;
            const rand = pseudo - Math.floor(pseudo);
            const fluctuation = rand < 0.5 ? 0.5 + rand : 1.0;
            return Math.max(0.1, Math.min(1.4, base * fluctuation));
        });
    }
    return Array.from({ length: n }, () => 1);
}

/** Notebook-style random absolute P profile (MW). */
export function buildRandomAbsoluteProfile(timeSteps, maxMw) {
    const n = Math.max(1, parseInt(timeSteps, 10) || 24);
    const cap = Math.max(0.001, parseFloat(maxMw) || 1);
    return Array.from({ length: n }, () => Math.random() * cap);
}

export function parseProfileValues(text) {
    if (!text || !String(text).trim()) return [];
    return String(text)
        .split(/[\s,;]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter(n => !Number.isNaN(n));
}

export function formatProfileValues(values) {
    return (values || []).map(v => {
        const n = Number(v);
        if (Number.isNaN(n)) return '';
        return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, '');
    }).join(', ');
}

export function normalizeProfileLength(values, timeSteps, fallback = 1) {
    const n = Math.max(1, parseInt(timeSteps, 10) || 24);
    if (!values || values.length === 0) {
        return Array.from({ length: n }, () => fallback);
    }
    return Array.from({ length: n }, (_, i) => values[i % values.length]);
}
