import { SIMULATION_FORM_SCROLL_STYLE, SIMULATION_INFO_BANNER_STYLE } from '../utils/dialogStyles.js';
import { createDialogBracketGroup } from '../utils/dialogBracketGroup.js';
import { GridCodePqDialog } from './GridCodePqDialog.js';
import { RPCDialog } from './RPCDialog.js';

console.log('GridCodeVqDialog.js LOADED');

const VQ_SKIP_PARAM_IDS = new Set([
    'pStartPct', 'pStepPct', 'pEndPct', 'iOpRange', 'iOutput', 'iShowPQ0',
    'voltageLevels', 'frequency'
]);

/**
 * Grid Code Compliance (V-Q): U-Q/Pmax at the PCC with optional Park Controller.
 */
export class GridCodeVqDialog extends GridCodePqDialog {
    constructor(editorUi) {
        super(editorUi);
        this.title = 'Grid Code Compliance (V-Q)';

        const pMaxField = {
            id: 'pMaxPct',
            label: 'P at Pmax (% of Pn)',
            type: 'number',
            value: '100',
            placeholder: '100',
            help: 'Active-power setpoint for the U-Q/Pmax study. 100% uses rated plant P (Pn).',
            bracketGroup: 'plant'
        };

        const filtered = this.parameters.filter((p) => !VQ_SKIP_PARAM_IDS.has(p.id));
        const un = filtered.find((p) => p.id === 'unKv');
        if (un) {
            un.help = 'Nameplate / busbar voltage Un at the point of connection. Leave 0 to use vn_kv from the selected PCC bus. Un is the per-unit voltage base. You only need to type a value if it differs from the bus.';
        }
        const uc = filtered.find((p) => p.id === 'ucKv');
        if (uc) {
            uc.help = 'Grid-code declared voltage Uc. Leave 0 to use Un (usual case). Each U (p.u.) in the U-Q/Pmax table is applied on the PCC bus as (p.u.) × Uc/Un. Example: Un = 110 kV, Uc = 115 kV, then 1.0 pu is applied as 1.045 pu.';
        }
        const excl = filtered.find((p) => p.id === 'excludeGeneratorIds');
        if (excl) {
            excl.help = 'Plant P at Pmax is scaled across the generators ticked above, in proportion to their ratings. Leave empty unless a neighbouring machine should keep the P already set on the diagram.';
        }
        const pn = filtered.find((p) => p.id === 'pnMw');
        if (pn) {
            pn.help = 'Registered / rated plant P. 0 uses the sum of selected unit ratings. Blue U-Q/Pmax is Q/Pmax × Pn. Plant active power is held at “P at Pmax”.';
        }
        const qStep = filtered.find((p) => p.id === 'qStepPct');
        if (qStep) {
            qStep.bracketGroupTitle = 'Q search';
            qStep.help = 'Resolution of the Qmax/Qmin search at each envelope voltage. Smaller is slower and more precise.';
        }
        const pnIdx = filtered.findIndex((p) => p.id === 'pnMw');
        if (pnIdx >= 0) {
            filtered.splice(pnIdx + 1, 0, pMaxField);
        } else {
            filtered.push(pMaxField);
        }
        this.parameters = filtered;
    }

    getDescription() {
        return '<strong>Grid Code Compliance (V-Q)</strong><br>' +
            'Maps reactive capability versus voltage at the point of connection while plant active power is held at Pmax. ' +
            'The chart plots Qmax and Qmin at the PCC (red) against the U-Q/Pmax grid-code envelope (blue, Q/Pmax × Pn). ' +
            '<strong>Plant Q dispatch</strong> is local Q on each unit or a <strong>Park Controller</strong> (constant Q at the PoC). ' +
            'Pandapower only. ' +
            'See the <a href="https://electrisim.com/documentation.html#grid-code-vq" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
    }

    _retargetUqSectionCopy(section) {
        if (!section) return;
        section.querySelectorAll('label, div').forEach((el) => {
            if (el.childElementCount) return;
            const t = (el.textContent || '').trim();
            if (t === 'U-Q Template (optional)') {
                el.textContent = 'U-Q/Pmax template';
            } else if (t.includes('Shares P rated')) {
                el.textContent = 'U (p.u.) at the PCC and Q_min/Q_max (Mvar) at Pmax. The voltage sweep uses these U values. Q is scaled from the template using Pn.';
            }
        });
    }

    getFormValues() {
        const values = RPCDialog.prototype.getFormValues.call(this);
        delete values.requirements;
        delete values.gridCodeTemplateKey;
        values.iParkCtrl = values.qDispatchMode === 'park';
        if (this.container) {
            [
                'iTrfCtrl', 'iTrf3wCtrl', 'run_control_shunt', 'shntCtrl', 'limQUprot',
                'limitOverloads'
            ].forEach((id) => {
                const el = this.container.querySelector(`input[type="checkbox"][id="${id}"]`);
                if (el) values[id] = el.disabled ? false : el.checked;
            });
        }
        return values;
    }

    displayDialog(callback) {
        this.callback = callback;
        this.ui = this.ui || window.App?.main?.editor?.editorUi;

        const container = document.createElement('div');
        Object.assign(container.style, {
            fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.5',
            color: '#333', padding: '0', margin: '0', width: '100%', height: '100%',
            minHeight: '0', maxHeight: '100%', overflow: 'hidden', flex: '1 1 auto',
            boxSizing: 'border-box', display: 'flex', flexDirection: 'column'
        });

        if (this.getDescription) {
            const desc = document.createElement('div');
            Object.assign(desc.style, SIMULATION_INFO_BANNER_STYLE);
            desc.innerHTML = this.getDescription();
            container.appendChild(desc);
        }

        const contentArea = document.createElement('div');
        Object.assign(contentArea.style, {
            ...SIMULATION_FORM_SCROLL_STYLE,
            overflowX: 'hidden'
        });

        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', boxSizing: 'border-box'
        });
        this._appendGroupedParameters(form, { skipGroups: ['results'] });

        const reqWrap = createDialogBracketGroup('Grid code requirement (U-Q/Pmax)');
        const reqSection = this._createUqRequirementsSection();
        const reqTitle = reqSection.firstElementChild;
        if (reqTitle && reqTitle.tagName === 'LABEL') {
            reqTitle.remove();
        }
        Object.assign(reqSection.style, { marginTop: '0' });
        this._retargetUqSectionCopy(reqSection);
        const sweepNote = document.createElement('p');
        Object.assign(sweepNote.style, {
            margin: '0 0 8px', fontSize: '12px', color: '#495057', lineHeight: '1.4'
        });
        sweepNote.textContent = 'The voltage sweep uses the U (p.u.) values in this table. You do not set a separate voltage list at the PCC.';
        reqWrap.appendChild(sweepNote);
        reqWrap.appendChild(reqSection);
        form.appendChild(reqWrap);

        contentArea.appendChild(form);
        container.appendChild(contentArea);

        const parkSel = this.inputs.get('parkControllerId');
        if (parkSel) {
            if (!parkSel.value) {
                const firstPark = [...parkSel.options].find((o) => o.value);
                if (firstPark) parkSel.value = firstPark.value;
            }
            parkSel.addEventListener('change', () => {
                this._syncGeneratorsFromPark();
                this._syncParkConfigureButton();
            });
        }
        this._syncQDispatchUi();

        if (this._uqTemplateSelect) {
            this._uqTemplateSelect.value = 'entsoe_ppm_uq_inner';
            this._uqTemplateSelect.dispatchEvent(new Event('change'));
            this._applyUqTemplate('entsoe_ppm_uq_inner', { silent: true, fillVoltageLevels: false });
        }

        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex', gap: '8px', justifyContent: 'flex-end',
            marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e9ecef',
            flexShrink: '0'
        });

        const cancelButton = this.createButton('Cancel', '#6c757d', '#5a6268');
        const applyButton = this.createButton(this.submitButtonText, '#007bff', '#0056b3');

        const cleanupAndClose = () => {
            if (this._previewChart) { this._previewChart.destroy(); this._previewChart = null; }
            if (this._uqPreviewChart) { this._uqPreviewChart.destroy(); this._uqPreviewChart = null; }
            this.destroy();
        };

        cancelButton.onclick = (e) => {
            e.preventDefault();
            cleanupAndClose();
        };

        applyButton.onclick = async (e) => {
            e.preventDefault();
            try {
                const hasSub = await this.checkSubscriptionStatus();
                if (!hasSub) {
                    cleanupAndClose();
                    if (window.showSubscriptionModal) window.showSubscriptionModal();
                    else alert('A subscription is required to use Grid Code Compliance (V-Q) analysis.');
                    return;
                }
                const values = this.getFormValues();
                if (this.callback) this.callback(values);
                cleanupAndClose();
            } catch (error) {
                console.error('GridCodeVqDialog error:', error);
                alert('Unable to verify subscription status. Please try again.');
            }
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);
        container.appendChild(buttonContainer);

        this.container = container;

        if (this.ui && typeof this.ui.showDialog === 'function') {
            this.mountStudyModalShell(800);
        } else {
            this.showModalFallback(container);
        }
    }
}

window.GridCodeVqDialog = GridCodeVqDialog;
