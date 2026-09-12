// BessDispatchReversalDialog.js - BESS charge/discharge P-step study (OpenDER + OpenDSS)
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

function _cellLabel(cell, fallback) {
    try {
        const name = cell?.value?.getAttribute?.('name') || cell?.value?.attributes?.getNamedItem?.('name')?.value;
        if (name) return String(name);
    } catch (e) { /* ignore */ }
    return fallback || String(cell?.mxObjectId || cell?.id || 'element');
}

function _attr(cell, name, fallback = '') {
    try {
        const attrs = cell?.value?.attributes;
        if (!attrs) return fallback;
        for (let i = 0; i < attrs.length; i++) {
            if (attrs[i].nodeName === name) return attrs[i].nodeValue;
        }
    } catch (e) { /* ignore */ }
    return fallback;
}

function _styleOf(cell) {
    try {
        if (typeof cell.getStyle === 'function') return cell.getStyle() || '';
    } catch (e) { /* ignore */ }
    return cell?.style || '';
}

function _shapeOf(cell) {
    const m = /shapeELXXX=([^;]+)/.exec(_styleOf(cell));
    return m ? m[1] : '';
}

function _cellId(cell) {
    try {
        if (typeof cell.getId === 'function' && cell.getId() != null) return String(cell.getId());
    } catch (e) { /* ignore */ }
    if (cell?.id != null) return String(cell.id);
    if (cell?.mxObjectId != null) return String(cell.mxObjectId);
    return '';
}

function _connectedBusId(cell) {
    const edges = cell?.edges || [];
    for (const e of edges) {
        const other = e.source === cell ? e.target : e.source;
        if (!other) continue;
        const shape = _shapeOf(other);
        if (shape === 'Bus' || shape === 'Busbar' || _styleOf(other).includes('shapeELXXX=Bus')) {
            return _cellId(other);
        }
    }
    return '';
}

function _defaultPocBusId(buses) {
    if (!buses.length) return '';
    const namedPoc = buses.find((b) => /poc/i.test(b.name || b.label || ''));
    if (namedPoc) return namedPoc.value;
    const notSource = buses.filter((b) => !b.isSource);
    const pool = [...(notSource.length ? notSource : buses)];
    pool.sort((a, b) => (b.vnKv || 0) - (a.vnKv || 0));
    return pool[0].value;
}

function _scanGraph(graph) {
    const buses = [];
    const storages = [];
    const sourceBusIds = new Set();
    if (!graph?.getModel) return { buses, storages };
    const model = graph.getModel();
    const cells = (typeof model.getDescendants === 'function' ? model.getDescendants() : []) || [];
    cells.forEach((cell) => {
        if (!cell || (typeof cell.isEdge === 'function' && cell.isEdge()) || cell.edge) return;
        const style = _styleOf(cell);
        const shape = _shapeOf(cell);
        const id = _cellId(cell);
        if (!id) return;
        if (shape === 'External Grid' || style.includes('shapeELXXX=External Grid')) {
            const busId = _connectedBusId(cell);
            if (busId) sourceBusIds.add(busId);
        }
        if (shape === 'Storage' || style.includes('shapeELXXX=Storage') || style.includes('multicell_battery')) {
            const pMw = _attr(cell, 'p_mw', '0');
            const curveOn = /^(true|1|yes|on)$/i.test(String(_attr(cell, 'reactive_capability_curve', '')));
            const qMode = String(_attr(cell, 'q_setpoint_mode', 'manual') || 'manual').toLowerCase();
            let qSource = 'inverter';
            if (curveOn) {
                qSource = qMode === 'capacitive_max' ? 'curve_absorb' : 'curve_inject';
            }
            storages.push({
                value: id,
                label: `${_cellLabel(cell, id)} (P=${pMw} MW)`,
                pMw: parseFloat(pMw) || 0,
                curveOn,
                voltDep: /^(true|1|yes|on)$/i.test(String(_attr(cell, 'q_cap_voltage_dependent', ''))),
                qSource
            });
        }
        if (shape === 'Bus' || shape === 'Busbar' || style.includes('shapeELXXX=Bus')) {
            const vnKv = parseFloat(_attr(cell, 'vn_kv', '0')) || 0;
            const name = _cellLabel(cell, id);
            buses.push({ value: id, name, vnKv, isSource: false, label: name });
        }
    });
    buses.forEach((b) => {
        b.isSource = sourceBusIds.has(b.value);
        const kv = b.vnKv > 0 ? `${b.vnKv} kV` : 'kV?';
        const src = b.isSource ? ' — source/slack' : '';
        b.label = `${b.name} — ${kv}${src}`;
    });
    return { buses, storages };
}

export class BessDispatchReversalDialog extends Dialog {
    constructor(editorUi) {
        super('BESS Dispatch Reversal (OpenDER + OpenDSS)', 'Calculate');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;

        let buses = [];
        let storages = [];
        try {
            ({ buses, storages } = _scanGraph(this.graph));
        } catch (e) {
            console.warn('BessDispatchReversalDialog: failed to scan graph', e);
        }

        this._storageMeta = Object.fromEntries(storages.map((s) => [s.value, s]));

        this.parameters = [
            {
                id: 'storageId',
                label: 'BESS / Storage element',
                type: 'select',
                value: storages[0]?.value || '',
                options: storages.length ? storages : [{ value: '', label: '(no Storage found)' }]
            },
            {
                id: 'pocBusId',
                label: 'POC bus (plant HV / grid connection — not the source bus)',
                type: 'select',
                value: _defaultPocBusId(buses),
                options: buses.length ? buses : [{ value: '', label: '(no buses found)' }]
            },
            {
                id: 'pStartMw',
                label: 'Start P [MW] (+ charge, − discharge)',
                type: 'number',
                value: '45',
                step: '1'
            },
            {
                id: 'pEndMw',
                label: 'End P [MW] after ramp',
                type: 'number',
                value: '-45',
                step: '1'
            },
            {
                id: 'preHoldS',
                label: 'Pre-hold at start P [s]',
                type: 'number',
                value: '2',
                step: '0.5',
                min: '0'
            },
            {
                id: 'rampS',
                label: 'Ramp duration [s]',
                type: 'number',
                value: '10',
                step: '0.5',
                min: '0.1'
            },
            {
                id: 'postHoldS',
                label: 'Post-hold at end P [s]',
                type: 'number',
                value: '60',
                step: '1',
                min: '0'
            },
            {
                id: 'dt',
                label: 'Time step [s]',
                type: 'number',
                value: '0.1',
                step: '0.05',
                min: '0.01'
            },
            {
                id: 'vminPu',
                label: 'Min voltage limit [pu]',
                type: 'number',
                value: '0.98',
                step: '0.001'
            },
            {
                id: 'vmaxPu',
                label: 'Max voltage limit [pu]',
                type: 'number',
                value: '1.02',
                step: '0.001'
            },
            {
                id: 'olrtS',
                label: 'Open-loop response time [s] (IEEE 1547 Volt-VAR / PF)',
                type: 'number',
                value: '5',
                step: '0.5',
                min: '0.1'
            },
            {
                id: 'qSource',
                label: 'Reactive power during the ramp',
                type: 'radio',
                options: [
                    {
                        value: 'inverter',
                        label: 'Storage inverter settings (Fixed PF / Q setpoint / Volt-VAR)',
                        default: (storages[0]?.qSource || 'inverter') === 'inverter'
                    },
                    {
                        value: 'curve_inject',
                        label: 'Q capability — inject max (q_min). Use this to see the P–Q curve and voltage derate.',
                        default: (storages[0]?.qSource || 'inverter') === 'curve_inject'
                    },
                    {
                        value: 'curve_absorb',
                        label: 'Q capability — absorb max (q_max)',
                        default: (storages[0]?.qSource || 'inverter') === 'curve_absorb'
                    }
                ]
            },
            {
                id: 'engine',
                label: 'Simulation engine',
                type: 'radio',
                options: [
                    { value: 'opender', label: 'OpenDER + OpenDSS (IEEE 1547 inverter, recommended)', default: true },
                    { value: 'opendss', label: 'OpenDSS only (fixed PF / InvControl on Storage, no OLRT)' }
                ]
            },
            {
                id: 'frequency',
                label: 'Frequency [Hz]',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ]
            }
        ];
    }

    getFormValues() {
        const values = {};
        (this.parameters || []).forEach((param) => {
            if (!param || param.type === 'section') return;
            if (param.type === 'radio') {
                const selected = (param.options || []).find((option) =>
                    this.inputs.get(`${param.id}_${option.value}`)?.checked
                );
                values[param.id] = selected
                    ? selected.value
                    : (param.options || []).find((opt) => opt.default)?.value;
                return;
            }
            const input = this.inputs.get(param.id);
            if (param.type === 'checkbox') {
                values[param.id] = input ? input.checked : !!param.value;
            } else {
                values[param.id] = input ? input.value : (param.value ?? '');
            }
        });
        return values;
    }

    getDescription() {
        return '<strong>BESS dispatch reversal — voltage overshoot screening</strong><br>' +
            'Ramp active power from charge to discharge (e.g. +45 MW → −45 MW in 10 s) while co-simulating ' +
            'the IEEE 1547 inverter (EPRI <a href="https://www.epri.com/opender" target="_blank" rel="noopener noreferrer">OpenDER</a>) ' +
            'with the OpenDSS network. Plot POC voltage, P, and Q vs time to check ±2% limits during FCR / primary-market reversals.<br><br>' +
            'Set charge/discharge PF and Volt-VAR on the Storage → Inverter Control tab; they are mapped into OpenDER.<br>' +
            '<strong>Use Q capability curve</strong> and <strong>Voltage-dependent Q envelope</strong> only change V(t)/Q(t) when Q is taken from the envelope ' +
            '(choose inject or absorb max below) or when a non-unity PF hits the kVA / curve limit. Unity PF with inverter Q stays at Q = 0.';
    }

    async checkSubscriptionStatus() {
        try {
            await ensureSubscriptionFunctions();
            if (typeof window.checkSubscriptionStatus === 'function') {
                return await window.checkSubscriptionStatus();
            }
            if (window.SubscriptionManager?.checkSubscriptionStatus) {
                return await window.SubscriptionManager.checkSubscriptionStatus();
            }
        } catch (e) {
            console.warn('BessDispatchReversalDialog subscription check failed', e);
        }
        return true;
    }

    show(callback) {
        super.show(async (values) => {
            if (!values) {
                callback?.(null);
                return;
            }
            const form = (values && !Array.isArray(values)) ? values : this.getFormValues();
            try {
                const hasSubscription = await this.checkSubscriptionStatus();
                if (!hasSubscription) {
                    if (this.modalOverlay?.parentNode) {
                        document.body.removeChild(this.modalOverlay);
                    }
                    if (window.showSubscriptionModal) {
                        window.showSubscriptionModal();
                    } else {
                        alert('A subscription is required to use BESS Dispatch Reversal study.');
                    }
                    return;
                }
            } catch (e) {
                console.warn('Subscription check error', e);
            }

            const meta = this._storageMeta[form.storageId];
            if (meta && Number.isFinite(meta.pMw) && meta.pMw !== 0) {
                if (!form.pStartMw || form.pStartMw === '45') {
                    form.pStartMw = String(meta.pMw);
                }
                if (!form.pEndMw || form.pEndMw === '-45') {
                    form.pEndMw = String(-meta.pMw);
                }
            }
            callback?.(form);
        }, this.parameters);
    }
}

window.BessDispatchReversalDialog = BessDispatchReversalDialog;
export default BessDispatchReversalDialog;
