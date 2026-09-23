// DataCenterSiteScreeningDialog.js — site screening parameters (pandapower)
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

function collectLoads(graph) {
    const options = [];
    if (!graph?.getModel) return options;
    const cells = graph.getModel().getChildCells(graph.getDefaultParent(), true, true) || [];
    for (const cell of cells) {
        const style = cell.getStyle?.() || '';
        if (style.includes('Result') || !style.includes('Load')) continue;
        if (style.includes('Asymmetric') || style.includes('DC')) continue;
        const technicalName = cell.mxObjectId?.replace('#', '_') || String(cell.id);
        let label = technicalName;
        const val = cell.value;
        if (val?.attributes) {
            for (let i = 0; i < val.attributes.length; i++) {
                if (val.attributes[i].nodeName === 'name') {
                    const child = val.getElementsByTagName?.('object')?.[0]?.parentNode;
                    break;
                }
            }
            for (let i = 0; i < val.attributes.length; i++) {
                if (val.attributes[i].nodeName === 'name' && val.attributes[i].nodeValue) {
                    label = val.attributes[i].nodeValue;
                }
            }
        }
        options.push({ value: technicalName, label: `${label} (${technicalName})` });
    }
    return options;
}

export class DataCenterSiteScreeningDialog extends Dialog {
    constructor(editorUi) {
        super('Data Center Site Screening', 'Analyze');
        this.useStudyModalShell = true;
        this.studyModalBoxWidth = 760;
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        const loads = collectLoads(this.graph);
        const defaultLoads = loads.map((l) => l.value).join(',');

        this.parameters = [
            {
                id: 'site_load_ids',
                label: 'Site load cell ID(s) — comma-separated mxObjectId values',
                type: 'text',
                value: defaultLoads || '',
                description: loads.length
                    ? `Loads on diagram: ${loads.map((l) => l.label).join('; ')}`
                    : 'Place a Load at each candidate POI first.'
            },
            {
                id: 'mw_sizes',
                label: 'Candidate sizes (MW, comma-separated)',
                type: 'text',
                value: '300,500,1000'
            },
            {
                id: 'power_factor',
                label: 'Load power factor at POI',
                type: 'number',
                value: '0.95',
                min: '0.5',
                max: '1',
                step: '0.01'
            },
            {
                id: 'include_n11',
                label: 'Include N-1-1 (capped pairwise line/trafo outages)',
                type: 'radio',
                options: [
                    { value: 'true', label: 'Yes', default: true },
                    { value: 'false', label: 'N-1 only' }
                ]
            },
            {
                id: 'element_type',
                label: 'Contingency element type',
                type: 'radio',
                options: [
                    { value: 'all', label: 'Lines, transformers, generators', default: true },
                    { value: 'line', label: 'Lines only' },
                    { value: 'transformer', label: 'Transformers only' },
                    { value: 'generator', label: 'Generators only' }
                ]
            },
            {
                id: 'voltage_limits',
                label: 'Check voltage limits',
                type: 'radio',
                options: [
                    { value: 'true', label: 'Yes', default: true },
                    { value: 'false', label: 'No' }
                ]
            },
            {
                id: 'thermal_limits',
                label: 'Check thermal limits',
                type: 'radio',
                options: [
                    { value: 'true', label: 'Yes', default: true },
                    { value: 'false', label: 'No' }
                ]
            },
            { id: 'min_vm_pu', label: 'Minimum voltage (p.u.)', type: 'number', value: '0.95', step: '0.01' },
            { id: 'max_vm_pu', label: 'Maximum voltage (p.u.)', type: 'number', value: '1.05', step: '0.01' },
            { id: 'max_loading_percent', label: 'Maximum loading (%)', type: 'number', value: '100', step: '1' }
        ];
    }

    getDescription() {
        return (
            '<strong>Phase 1 site screening</strong> — headroom MW and N-1 / N-1-1 at each candidate load size. ' +
            'Import a utility case (<code>.py</code> / <code>.dss</code>) or use the ' +
            '<code>data_center_interconnection_pocket.py</code> tutorial. ' +
            '<a href="https://electrisim.com/documentation.html#data-center-site-screening" target="_blank" rel="noopener">Documentation</a>'
        );
    }

    show(callback) {
        super.show(async (values) => {
            try {
                const hasSubscription = await this.checkSubscriptionStatus();
                if (!hasSubscription) {
                    if (window.showSubscriptionModal) window.showSubscriptionModal();
                    else alert('A subscription is required for Data Center Site Screening.');
                    return;
                }
                const siteIds = String(values.site_load_ids || '').trim();
                if (!siteIds) {
                    alert('Enter at least one Load cell ID for the data-center POI block.');
                    return;
                }
                if (callback) callback({ ...values, site_load_ids: siteIds });
            } catch (e) {
                alert('Unable to verify subscription status.');
            }
        });
    }

    async checkSubscriptionStatus() {
        await ensureSubscriptionFunctions();
        if (window.checkSubscriptionStatus) return window.checkSubscriptionStatus();
        if (window.SubscriptionManager?.checkSubscriptionStatus) {
            return window.SubscriptionManager.checkSubscriptionStatus();
        }
        return false;
    }
}

globalThis.DataCenterSiteScreeningDialog = DataCenterSiteScreeningDialog;
