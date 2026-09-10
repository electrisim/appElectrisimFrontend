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

function _shapeOf(cell) {
    const style = cell?.style || '';
    const m = /shapeELXXX=([^;]+)/.exec(style);
    return m ? m[1] : '';
}

export class BessDispatchReversalDialog extends Dialog {
    constructor(editorUi) {
        super('BESS Dispatch Reversal (OpenDER + OpenDSS)', 'Calculate');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;

        const buses = [];
        const storages = [];
        try {
            const model = this.graph.getModel();
            const parent = this.graph.getDefaultParent();
            const cells = model.getChildren(parent) || [];
            cells.forEach((cell) => {
                if (!cell || cell.isEdge?.()) return;
                const shape = _shapeOf(cell);
                const id = cell.mxObjectId || cell.id;
                const label = _cellLabel(cell, id);
                if (shape === 'Bus' || shape === 'Busbar') {
                    buses.push({ value: String(id), label: `${label} (${id})` });
                }
                if (shape === 'Storage') {
                    const pMw = _attr(cell, 'p_mw', '0');
                    storages.push({
                        value: String(id),
                        label: `${label} (P=${pMw} MW)`,
                        pMw: parseFloat(pMw) || 0
                    });
                }
            });
        } catch (e) {
            console.warn('BessDispatchReversalDialog: failed to scan graph', e);
        }

        this._storageMeta = Object.fromEntries(storages.map((s) => [s.value, s]));

        this.parameters = [
            {
                id: 'storageId',
                label: 'BESS / Storage element',
                type: 'select',
                options: storages.length ? storages : [{ value: '', label: '(no Storage found)' }]
            },
            {
                id: 'pocBusId',
                label: 'POC bus (grid connection)',
                type: 'select',
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

    getDescription() {
        return '<strong>BESS dispatch reversal — voltage overshoot screening</strong><br>' +
            'Ramp active power from charge to discharge (e.g. +45 MW → −45 MW in 10 s) while co-simulating ' +
            'the IEEE 1547 inverter (EPRI <a href="https://www.epri.com/opender" target="_blank" rel="noopener noreferrer">OpenDER</a>) ' +
            'with the OpenDSS network. Plot POC voltage, P, and Q vs time to check ±2% limits during FCR / primary-market reversals.<br><br>' +
            '<em>RMS screening model — not a vendor EMT/PCS model for formal TSO submission.</em> ' +
            'Set charge/discharge PF and Volt-VAR on the Storage → Inverter Control tab; they are mapped into OpenDER.';
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

            const meta = this._storageMeta[values.storageId];
            if (meta && Number.isFinite(meta.pMw) && meta.pMw !== 0) {
                if (!values.pStartMw || values.pStartMw === '45') {
                    values.pStartMw = String(meta.pMw);
                }
                if (!values.pEndMw || values.pEndMw === '-45') {
                    values.pEndMw = String(-meta.pMw);
                }
            }
            callback?.(values);
        }, this.parameters);
    }
}

window.BessDispatchReversalDialog = BessDispatchReversalDialog;
export default BessDispatchReversalDialog;
