/**
 * OpenDSS spectrum is a string; expose two built-in choices as a switch while
 * preserving other stored names until the user changes the toggle.
 */

export function syncSpectrumCustomFlag(param, storedValue) {
    if (param.type !== 'harmonicSpectrumToggle') return;
    const off = String(param.spectrumOff ?? '');
    const on = String(param.spectrumOn ?? '');
    const v = storedValue != null ? String(storedValue) : '';
    const isOn = v.toLowerCase() === on.toLowerCase();
    const isOff = v.toLowerCase() === off.toLowerCase();
    param._spectrumCustom = !isOn && !isOff && v ? v : null;
}

/**
 * @param {object} param - dialog field with spectrumOff, spectrumOn, value, id, label
 * @param {HTMLElement} rightColumn
 * @param {Map} inputsMap - dialog.inputs
 */
export function mountHarmonicSpectrumToggle(param, rightColumn, inputsMap) {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '12px',
        width: '100%',
        flexWrap: 'wrap'
    });

    const off = String(param.spectrumOff ?? '');
    const on = String(param.spectrumOn ?? '');
    const cur = String(param.value != null ? param.value : off);
    const checked = cur.toLowerCase() === on.toLowerCase();

    const sw = document.createElement('input');
    sw.type = 'checkbox';
    sw.id = param.id;
    sw.checked = checked;
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-label', param.label || 'Harmonic spectrum');
    sw.setAttribute('aria-checked', checked ? 'true' : 'false');
    Object.assign(sw.style, {
        width: '42px',
        height: '24px',
        cursor: 'pointer',
        accentColor: '#007bff',
        flexShrink: 0
    });

    const state = document.createElement('span');
    Object.assign(state.style, {
        fontSize: '12px',
        fontWeight: '600',
        color: '#495057',
        minWidth: '100px',
        textAlign: 'left',
        lineHeight: '1.3'
    });

    const updateState = () => {
        const isAlt = sw.checked;
        sw.setAttribute('aria-checked', isAlt ? 'true' : 'false');
        if (param._spectrumCustom != null && param._spectrumCustom !== '' && !isAlt) {
            state.textContent = param._spectrumCustom;
        } else {
            state.textContent = isAlt ? on : off;
        }
    };

    sw.addEventListener('change', () => {
        param._spectrumCustom = null;
        updateState();
    });

    updateState();
    wrap.appendChild(sw);
    wrap.appendChild(state);
    rightColumn.appendChild(wrap);
    inputsMap.set(param.id, sw);
}

export function valueFromHarmonicSpectrumToggle(param, input) {
    if (!input) return param.spectrumOff;
    if (input.checked) return param.spectrumOn;
    if (param._spectrumCustom != null && param._spectrumCustom !== '') return param._spectrumCustom;
    return param.spectrumOff;
}
