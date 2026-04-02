/**
 * Harmonic spectrum UI: Default / Linear / Custom CSV / None
 * (spectrum + spectrum_csv on the model; backend creates New Spectrum.* from CSV when custom).
 * None → spectrum=none: omit harmonic injection (OpenDSS convention; see https://opendss.epri.com/).
 */

import {
    drawHarmonicSpectrumChart,
    getHarmonicSpectrumPreviewSeries
} from './harmonicSpectrumChart.js';

export const MODE_DEFAULT = 'default';
export const MODE_LINEAR = 'linear';
export const MODE_CUSTOM = 'custom';
/** Stored as spectrum "none"; backend omits spectrum= or treats as no harmonics */
export const MODE_NONE = 'none';

const selectStyle = {
    width: '180px',
    padding: '10px 14px',
    border: '2px solid #ced4da',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
    outline: 'none',
    cursor: 'pointer',
    alignSelf: 'flex-end'
};

export function deriveHarmonicSpectrumMode(spectrum, csv) {
    const s = String(spectrum ?? '').trim().toLowerCase();
    if (s === 'none') return MODE_NONE;
    const c = String(csv ?? '').trim();
    if (c.length > 0) return MODE_CUSTOM;
    if (s === 'linear') return MODE_LINEAR;
    return MODE_DEFAULT;
}

/** @deprecated use deriveHarmonicSpectrumMode */
export function deriveLoadHarmonicSpectrumMode(spectrum, csv) {
    return deriveHarmonicSpectrumMode(spectrum, csv);
}

/**
 * @param {object} param - spectrumValue, csvValue, rows (optional)
 * @param {HTMLElement} rightColumn
 * @param {Map} inputsMap
 * @param {{ modeSelectId: string, defaultSpectrum: string, spectrumCsvInputId?: string, textareaRows?: number }} options
 */
export function mountHarmonicSpectrumTriState(param, rightColumn, inputsMap, options) {
    const {
        modeSelectId,
        defaultSpectrum,
        spectrumCsvInputId = 'spectrum_csv',
        textareaRows
    } = options;
    const resolvedDefault = defaultSpectrum || 'defaultload';
    const mode = deriveHarmonicSpectrumMode(param.spectrumValue, param.csvValue);

    const sel = document.createElement('select');
    sel.id = modeSelectId;

    [
        [MODE_DEFAULT, 'Default'],
        [MODE_LINEAR, 'Linear'],
        [MODE_CUSTOM, 'Custom'],
        [MODE_NONE, 'None']
    ].forEach(([val, label]) => {
        const o = document.createElement('option');
        o.value = val;
        o.textContent = label;
        if (val === mode) o.selected = true;
        sel.appendChild(o);
    });
    Object.assign(sel.style, selectStyle);

    const ta = document.createElement('textarea');
    ta.id = spectrumCsvInputId;
    ta.value = param.csvValue || '';
    ta.rows = param.rows || textareaRows || 5;
    Object.assign(ta.style, {
        width: '100%',
        minHeight: '100px',
        padding: '10px 14px',
        border: '2px solid #ced4da',
        borderRadius: '6px',
        fontSize: '13px',
        fontFamily: 'Consolas, monospace',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
        resize: 'vertical',
        display: mode === MODE_CUSTOM ? 'block' : 'none'
    });

    const chartWrap = document.createElement('div');
    Object.assign(chartWrap.style, {
        marginTop: '8px',
        padding: '12px',
        backgroundColor: '#ffffff',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        width: '100%',
        boxSizing: 'border-box'
    });
    const chartHeading = document.createElement('div');
    chartHeading.textContent = 'Spectrum characteristic';
    Object.assign(chartHeading.style, {
        fontWeight: '600',
        fontSize: '13px',
        color: '#495057',
        marginBottom: '6px'
    });
    const chartStatus = document.createElement('div');
    Object.assign(chartStatus.style, {
        fontSize: '11px',
        color: '#6c757d',
        minHeight: '18px',
        lineHeight: '1.35',
        marginBottom: '4px'
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.assign(svg.style, {
        width: '100%',
        maxHeight: '260px',
        display: 'block'
    });
    chartWrap.appendChild(chartHeading);
    chartWrap.appendChild(chartStatus);
    chartWrap.appendChild(svg);

    function redrawHarmonicSpectrumChart() {
        const m = sel.value;
        const csv = ta ? ta.value : '';
        const series = getHarmonicSpectrumPreviewSeries(m, resolvedDefault, csv);
        drawHarmonicSpectrumChart(svg, chartStatus, series);
    }

    sel.addEventListener('change', () => {
        ta.style.display = sel.value === MODE_CUSTOM ? 'block' : 'none';
        redrawHarmonicSpectrumChart();
    });

    let csvDebounce = null;
    ta.addEventListener('input', () => {
        if (csvDebounce) clearTimeout(csvDebounce);
        csvDebounce = setTimeout(() => {
            csvDebounce = null;
            redrawHarmonicSpectrumChart();
        }, 200);
    });
    ta.addEventListener('change', redrawHarmonicSpectrumChart);

    rightColumn.appendChild(sel);
    rightColumn.appendChild(ta);
    rightColumn.appendChild(chartWrap);
    inputsMap.set(modeSelectId, sel);
    inputsMap.set(spectrumCsvInputId, ta);
    inputsMap.set(`${modeSelectId}__harmonicSpectrumPreviewRedraw`, redrawHarmonicSpectrumChart);
    redrawHarmonicSpectrumChart();
}

/**
 * Sync mode select + CSV textarea + preview after populateDialog (when DOM already exists).
 * @param {Map} inputsMap
 * @param {{ modeSelectId: string, defaultSpectrum: string, spectrumCsvInputId?: string, spectrum: string, spectrum_csv?: string }} options
 */
export function syncHarmonicSpectrumTriStateDom(inputsMap, options) {
    const {
        modeSelectId,
        defaultSpectrum,
        spectrumCsvInputId = 'spectrum_csv',
        spectrum,
        spectrum_csv
    } = options;
    const sel = inputsMap.get(modeSelectId);
    if (!sel) return;
    const ta = inputsMap.get(spectrumCsvInputId);
    const mode = deriveHarmonicSpectrumMode(spectrum, spectrum_csv);
    sel.value = mode;
    if (ta) {
        ta.value = spectrum_csv != null ? String(spectrum_csv) : '';
        ta.style.display = mode === MODE_CUSTOM ? 'block' : 'none';
    }
    const redraw = inputsMap.get(`${modeSelectId}__harmonicSpectrumPreviewRedraw`);
    if (typeof redraw === 'function') {
        redraw();
    }
}

/**
 * @param {Map} inputsMap
 * @param {object[]|undefined} harmonicParameters
 * @param {{ spectrum?: string, spectrum_csv?: string }} data
 */
export function syncHarmonicSpectrumTriStateFromDialogData(inputsMap, harmonicParameters, data) {
    const tri = (harmonicParameters || []).find(p => p.type === 'harmonicSpectrumTriState');
    if (!tri || !data) return;
    syncHarmonicSpectrumTriStateDom(inputsMap, {
        modeSelectId: tri.triStateModeSelectId,
        spectrumCsvInputId: tri.spectrumCsvInputId,
        defaultSpectrum: tri.defaultSpectrum,
        spectrum: data.spectrum,
        spectrum_csv: data.spectrum_csv != null ? data.spectrum_csv : ''
    });
}

/**
 * @param {Map} inputsMap
 * @param {{ modeSelectId: string, defaultSpectrum: string, spectrumCsvInputId?: string }} options
 * @returns {{ spectrum: string, spectrum_csv: string }}
 */
export function valuesFromHarmonicSpectrumTriState(inputsMap, options) {
    const {
        modeSelectId,
        defaultSpectrum,
        spectrumCsvInputId = 'spectrum_csv'
    } = options;
    const sel = inputsMap.get(modeSelectId);
    const ta = inputsMap.get(spectrumCsvInputId);
    const m = sel ? sel.value : MODE_DEFAULT;
    if (m === MODE_LINEAR) {
        return { spectrum: 'Linear', spectrum_csv: '' };
    }
    if (m === MODE_CUSTOM) {
        return { spectrum: 'custom', spectrum_csv: ta ? ta.value : '' };
    }
    if (m === MODE_NONE) {
        return { spectrum: 'none', spectrum_csv: '' };
    }
    return { spectrum: defaultSpectrum, spectrum_csv: '' };
}

export function mountLoadHarmonicSpectrumTriState(param, rightColumn, inputsMap) {
    mountHarmonicSpectrumTriState(param, rightColumn, inputsMap, {
        modeSelectId: 'load_harm_spectrum_mode',
        defaultSpectrum: 'defaultload',
        spectrumCsvInputId: 'spectrum_csv',
        textareaRows: param.rows
    });
}

export function valuesFromLoadHarmonicSpectrumTriState(inputsMap) {
    return valuesFromHarmonicSpectrumTriState(inputsMap, {
        modeSelectId: 'load_harm_spectrum_mode',
        defaultSpectrum: 'defaultload',
        spectrumCsvInputId: 'spectrum_csv'
    });
}
