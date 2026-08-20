// DgInterconnectionDialog.js - OpenDSS DG interconnection screening parameters
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

function _cellLabel(cell, fallback) {
    try {
        const name = cell?.value?.getAttribute?.('name') || cell?.value?.attributes?.getNamedItem?.('name')?.value;
        if (name) return String(name);
    } catch (e) { /* ignore */ }
    return fallback || String(cell?.mxObjectId || cell?.id || 'element');
}

function _shapeOf(cell) {
    const style = cell?.style || '';
    const m = /shapeELXXX=([^;]+)/.exec(style);
    return m ? m[1] : '';
}

export class DgInterconnectionDialog extends Dialog {
    constructor(editorUi) {
        super('DG Interconnection Screening (OpenDSS)', 'Calculate');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;

        const buses = [];
        const ders = [];
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
                if (shape === 'PVSystem' || shape === 'Storage' || shape === 'Generator' || shape === 'Static Generator') {
                    ders.push({ value: String(id), label: `${shape}: ${label}`, derType: shape === 'Static Generator' ? 'Generator' : shape });
                }
            });
        } catch (e) {
            console.warn('DgInterconnectionDialog: failed to scan graph', e);
        }

        this._derMeta = Object.fromEntries(ders.map((d) => [d.value, d.derType]));

        this.parameters = [
            {
                id: 'pocBusId',
                label: 'POC Bus (Point of Coupling)',
                type: 'select',
                options: buses.length ? buses : [{ value: '', label: '(no buses found)' }]
            },
            {
                id: 'derId',
                label: 'DER element (PVSystem / Storage / Generator)',
                type: 'select',
                options: ders.length ? ders : [{ value: '', label: '(no DER found — add PVSystem, Storage, or Generator)' }]
            },
            {
                id: 'proposedKw',
                label: 'Proposed DER size (kW)',
                type: 'number',
                value: '500',
                step: '10'
            },
            {
                id: 'proposedKva',
                label: 'Proposed inverter kVA (optional)',
                type: 'number',
                value: '',
                step: '10'
            },
            {
                id: 'vminPu',
                label: 'Min voltage limit (pu)',
                type: 'number',
                value: '0.95',
                step: '0.01'
            },
            {
                id: 'vmaxPu',
                label: 'Max voltage limit (pu)',
                type: 'number',
                value: '1.05',
                step: '0.01'
            },
            {
                id: 'maxLoadingPercent',
                label: 'Max line loading (%)',
                type: 'number',
                value: '100',
                step: '1'
            },
            {
                id: 'runHostingCapacity',
                label: 'Run hosting-capacity binary search',
                type: 'checkbox',
                value: true
            },
            {
                id: 'hcMaxKw',
                label: 'Hosting capacity search max (kW)',
                type: 'number',
                value: '5000',
                step: '50'
            },
            {
                id: 'compareInvControl',
                label: 'Compare with Volt-VAR InvControl mitigation',
                type: 'checkbox',
                value: true
            },
            {
                id: 'frequency',
                label: 'Frequency (Hz)',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ]
            }
        ];
    }

    getDescription() {
        return '<strong>DG Interconnection Screening (OpenDSS)</strong><br>' +
            'Screens a proposed DER at a POC for voltage band, thermal loading, and reverse power. ' +
            'Optionally compares Volt-VAR InvControl mitigation and estimates hosting capacity by binary search. ' +
            'Related: BESS sizing (pandapower) and Grid Code Compliance (RPC).';
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
            console.warn('DgInterconnectionDialog subscription check failed', e);
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
                        alert('A subscription is required to use DG Interconnection Screening.');
                    }
                    return;
                }
            } catch (e) {
                console.warn('Subscription check error', e);
            }

            const derId = values.derId;
            values.derType = this._derMeta[derId] || 'PVSystem';
            callback?.(values);
        }, this.parameters);
    }
}

window.DgInterconnectionDialog = DgInterconnectionDialog;
export default DgInterconnectionDialog;
