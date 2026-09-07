import { SIMULATION_FORM_SCROLL_STYLE, SIMULATION_INFO_BANNER_STYLE } from '../utils/dialogStyles.js';
import { createDialogBracketGroup } from '../utils/dialogBracketGroup.js';
import { ParkControllerDialog } from './ParkControllerDialog.js';
import {
    RPCDialog,
    estimateRpcInstalledMw
} from './RPCDialog.js';

console.log('GridCodePqDialog.js LOADED');

function parseCellStyle(style) {
    if (!style) return null;
    const o = {};
    String(style).split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i > 0) o[part.slice(0, i)] = part.slice(i + 1);
    });
    return o;
}

function cellAttr(cell, name) {
    if (!cell?.value?.getAttribute) return undefined;
    return cell.value.getAttribute(name);
}

/**
 * Grid Code Compliance (P-Q) dialog: P-Q/Pmax study with optional Park Controller.
 * Extends RPCDialog for templates and form widgets; no U-Q section.
 */
export class GridCodePqDialog extends RPCDialog {
    constructor(editorUi) {
        super(editorUi);
        this.title = 'Grid Code Compliance (P-Q)';
        this.uqRequirementRows = [];
        this._canvasEq = { trafo2w: false, trafo3w: false, shuntReactor: false, shuntComp: false };

        this.parameters = [
            {
                id: 'pccBusId',
                label: 'PCC bus (point of connection)',
                type: 'select',
                options: [],
                bracketGroup: 'poc',
                bracketGroupTitle: 'Point of connection'
            },
            {
                id: 'extGridId',
                label: 'External grid at the point of connection',
                type: 'select',
                options: [],
                bracketGroup: 'poc'
            },
            {
                id: 'unKv',
                label: 'Un — rated voltage of the PCC bus (kV, 0 = from PCC bus)',
                type: 'number',
                value: '0',
                placeholder: '0',
                help: 'Nameplate / busbar voltage Un at the point of connection. Leave 0 to use vn_kv from the selected PCC bus. Un is the per-unit voltage base.',
                bracketGroup: 'poc'
            },
            {
                id: 'ucKv',
                label: 'Uc — declared supply voltage at the connection point (kV, 0 = Un)',
                type: 'number',
                value: '0',
                placeholder: '0',
                help: 'Grid-code declared voltage Uc, which can differ from Un. Leave 0 to use Un. Each value in “Voltage levels at PCC” is applied on the PCC bus as (p.u.) × Uc/Un. Example: Un = 110 kV, Uc = 115 kV, then 1.0 pu is applied as 1.045 pu.',
                bracketGroup: 'poc'
            },
            {
                id: 'voltageLevels',
                label: 'Voltage levels at PCC (p.u., comma-separated)',
                type: 'text',
                value: '0.9, 0.95, 1.0, 1.05, 1.1',
                placeholder: '0.9, 0.95, 1.0, 1.05, 1.1',
                bracketGroup: 'poc'
            },
            {
                id: 'frequency',
                label: 'Frequency',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ],
                help: 'System frequency used by the load flows in this study.',
                bracketGroup: 'poc'
            },
            {
                id: 'qDispatchMode',
                label: 'Plant Q dispatch',
                type: 'radio',
                options: [
                    {
                        value: 'local',
                        label: 'Local Q on each static generator / wind turbine',
                        default: true
                    },
                    {
                        value: 'park',
                        label: 'Park Controller — constant Q at the point of connection'
                    }
                ],
                help: 'Local Q sets each unit’s q_mvar from its P–Q capability (same idea as Grid Code Compliance P-Q & U-Q). Park Controller uses BinarySearchControl so the plant meets a constant-Q setpoint at the point of connection. Other park controllers are taken out of service so they cannot overwrite Q.',
                bracketGroup: 'plant',
                bracketGroupTitle: 'Plant'
            },
            {
                id: 'parkControllerId',
                label: 'Park Controller',
                type: 'select',
                options: [],
                help: 'If a Park Controller is on the diagram, it is selected automatically. Configure… opens that element’s dialog (also when Plant Q dispatch is Local Q). Park dispatch uses this controller for constant Q at the point of connection.',
                bracketGroup: 'plant'
            },
            {
                id: 'generatorIds',
                label: 'Static generators and wind turbines',
                type: 'multiselect',
                options: [],
                bracketGroup: 'plant'
            },
            {
                id: 'excludeGeneratorIds',
                label: 'Units that keep their diagram P (optional)',
                type: 'multiselect',
                options: [],
                help: 'The P–Q sweep scales plant P across the generators ticked above, in proportion to their ratings. Leave this empty unless a machine should keep the P already set on the diagram (for example a neighbouring unit that is not part of this plant). Ticked units here are not scaled.',
                bracketGroup: 'plant'
            },
            {
                id: 'shuntIds',
                label: 'Additional shunts',
                type: 'multiselect',
                options: [],
                bracketGroup: 'plant'
            },
            {
                id: 'pnMw',
                label: 'Pn — reference active power (MW, 0 = auto)',
                type: 'number',
                value: '0',
                placeholder: '0',
                bracketGroup: 'plant'
            },
            {
                id: 'pStartPct',
                label: 'Sweep start (% of Pn)',
                type: 'number',
                value: '0',
                placeholder: '0',
                bracketGroup: 'sweep',
                bracketGroupTitle: 'P–Q sweep',
                inlineRow: 'sweepP'
            },
            {
                id: 'pStepPct',
                label: 'Sweep step (% of Pn)',
                type: 'number',
                value: '10',
                placeholder: '10',
                bracketGroup: 'sweep',
                inlineRow: 'sweepP'
            },
            {
                id: 'pEndPct',
                label: 'Sweep end (% of Pn)',
                type: 'number',
                value: '100',
                placeholder: '100',
                bracketGroup: 'sweep',
                inlineRow: 'sweepP'
            },
            {
                id: 'qStepPct',
                label: 'Q reduction step (% of Pn)',
                type: 'number',
                value: '0.5',
                placeholder: '0.5',
                bracketGroup: 'sweep'
            },
            {
                id: 'iOpRange',
                label: 'Operating range',
                type: 'radio',
                options: [
                    { value: '0', label: 'Generation — P ≥ 0 (export)', default: true },
                    { value: '1', label: 'Consumption — P ≤ 0 (import / storage charging)' },
                    { value: '2', label: 'Generation and consumption — both signs of P' }
                ],
                help: 'Which plant P values are evaluated. Generation sweeps Pstart…Pend as export. Consumption uses the same percentages as import (negative P). Both runs the export sweep and the import sweep.',
                bracketGroup: 'sweep'
            },
            {
                id: 'iTrfCtrl',
                label: 'Two-winding transformer tap changer',
                checkboxLabel: 'DiscreteTapControl on two-winding transformers that have discrete tap control enabled. Worst case: two voltage setpoints; keep the more restrictive Q envelope. Deadband is never narrower than one tap step. Results flag points where the tap could not keep the controlled bus inside its band.',
                type: 'checkbox',
                value: false,
                requiresCanvas: 'trafo2w',
                unavailableHint: 'No two-winding transformer on the diagram.',
                bracketGroup: 'tapShunt',
                bracketGroupTitle: 'Transformer and shunt control'
            },
            {
                id: 'iTrf3wCtrl',
                label: 'Three-winding transformer tap changer',
                checkboxLabel: 'DiscreteTapControl on three-winding transformers that have discrete tap control enabled (hv / mv / lv control side). Same worst-case tap logic as two-winding transformers.',
                type: 'checkbox',
                value: false,
                requiresCanvas: 'trafo3w',
                unavailableHint: 'No three-winding transformer on the diagram.',
                bracketGroup: 'tapShunt'
            },
            {
                id: 'run_control_shunt',
                label: 'Shunt reactor control',
                checkboxLabel: 'DiscreteShuntController (voltage / target step) and Line P→shunt step, as configured on the shunt dialog. Both require this tick. Same controllers as Load Flow / Grid Code Compliance (P-Q & U-Q).',
                type: 'checkbox',
                value: false,
                requiresCanvas: 'shuntReactor',
                unavailableHint: 'No shunt reactor on the diagram.',
                bracketGroup: 'tapShunt'
            },
            {
                id: 'shntCtrl',
                label: 'Shunt on/off (reduce steps before plant Q)',
                checkboxLabel: 'Switch shunt compensation on/off automatically. If the loading limit is on, reduce shunt steps toward zero before cutting plant Q. Independent of Shunt reactor control above.',
                type: 'checkbox',
                value: false,
                requiresCanvas: 'shuntComp',
                unavailableHint: 'No shunt reactor or capacitor on the diagram.',
                bracketGroup: 'tapShunt'
            },
            {
                id: 'limitOverloads',
                label: 'Loading limit',
                checkboxLabel: 'Limit Q to avoid branch overloads. With shunt on/off, compensation steps are reduced before plant Q.',
                type: 'checkbox',
                value: false,
                bracketGroup: 'loading',
                bracketGroupTitle: 'Loading limit'
            },
            {
                id: 'maxLoadingPercent',
                label: 'Max loading (%)',
                type: 'number',
                value: '100',
                placeholder: '100',
                bracketGroup: 'loading'
            },
            {
                id: 'limQUprot',
                label: 'Limit Q for voltage protection',
                checkboxLabel: 'Reduce Q when generating-unit LV terminal voltage leaves the min…max band.',
                type: 'checkbox',
                value: false,
                bracketGroup: 'voltProt',
                bracketGroupTitle: 'Voltage protection'
            },
            {
                id: 'uMaxProt',
                label: 'Max LV terminal voltage (p.u.)',
                type: 'number',
                value: '1.15',
                placeholder: '1.15',
                bracketGroup: 'voltProt',
                inlineRow: 'lvBand'
            },
            {
                id: 'uMinProt',
                label: 'Min LV terminal voltage (p.u.)',
                type: 'number',
                value: '0.85',
                placeholder: '0.85',
                bracketGroup: 'voltProt',
                inlineRow: 'lvBand'
            },
            {
                id: 'iShowPQ0',
                label: 'Q at the point of connection with units not operating',
                checkboxLabel: 'Run an extra load flow with the selected units at P = Q = 0 (plant off).',
                type: 'checkbox',
                value: true,
                help: 'The results then show residual P and Q at the PCC from the rest of the network (loads, cables, shunts). This is not the P = 0 point on the red capability chart — that point is plant Qmin/Qmax while the units are still providing reactive power.',
                bracketGroup: 'results',
                bracketGroupTitle: 'Results'
            },
            {
                id: 'iOutput',
                label: 'Table of Q capability at 10% … 100% of Pn',
                checkboxLabel: 'Add a numeric table of Qmax and Qmin at 10%, 20%, … 100% of Pn (in addition to the P–Q chart).',
                type: 'checkbox',
                value: false,
                help: 'Each row is a voltage level and active-power step, with Qmax, Qmin, and over-/underexcited power factor. The chart is always produced; this only adds the table and includes it in the CSV download.',
                bracketGroup: 'results'
            }
        ];
    }

    getDescription() {
        return '<strong>Grid Code Compliance (P-Q)</strong><br>' +
            'Sweeps plant active power and maps the reactive capability envelope at the point of connection. ' +
            'The results chart plots net P and Q at the PCC (not generator-terminal P). ' +
            '<strong>Plant Q dispatch</strong> is either local Q on each static generator / wind turbine, or a diagram ' +
            '<strong>Park Controller</strong> (constant Q at the point of connection). ' +
            'Two- and three-winding DiscreteTapControl and shunt reactor control (DiscreteShuntController and Line P→shunt step) ' +
            'can be enabled independently; shunt on/off still reduces compensation steps before plant Q when the loading limit binds. ' +
            'Pandapower only. Park Q applies to wind turbines and static generators. ' +
            'Q limits come from each machine’s Q capability tab when that curve is enabled; otherwise a circular S<sub>n</sub>–P limit. ' +
            'See the <a href="https://electrisim.com/documentation.html#grid-code-pq" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
    }

    populateOptions() {
        super.populateOptions();
        if (!this.graph) {
            this._canvasEq = { trafo2w: false, trafo3w: false, shuntReactor: false, shuntComp: false };
            return;
        }
        const model = this.graph.getModel();
        const parks = [];
        const shunts = [];
        const plantGens = [];
        const canvasEq = { trafo2w: false, trafo3w: false, shuntReactor: false, shuntComp: false };
        const cellsArray = model.getDescendants();

        cellsArray.forEach((cell) => {
            if (!cell || cell.edge) return;
            const style = parseCellStyle(cell.getStyle()) || {};
            const shape = style.shapeELXXX || '';
            if (shape === 'Three Winding Transformer') canvasEq.trafo3w = true;
            else if (shape === 'Transformer') canvasEq.trafo2w = true;
            if (shape === 'Shunt Reactor' || shape === 'Shunt') {
                canvasEq.shuntReactor = true;
                canvasEq.shuntComp = true;
            } else if (shape === 'Capacitor') {
                canvasEq.shuntComp = true;
            }
            if (!cell.value) return;
            const name = this._getCellName(cell);
            if (shape === 'ParkController') {
                parks.push({
                    value: cell.getId(),
                    label: name || `ParkController ${cell.getId()}`
                });
            }
            if (shape === 'Shunt Reactor' || shape === 'Capacitor' || shape === 'Shunt') {
                shunts.push({
                    value: cell.getId(),
                    label: `${name || shape} (${shape})`
                });
            }
            if (shape === 'Wind Turbine' || shape === 'Static Generator') {
                const fallback = shape === 'Wind Turbine' ? `WT ${cell.getId()}` : `SGen ${cell.getId()}`;
                plantGens.push({
                    value: cell.getId(),
                    label: `${name || fallback} (${shape})`
                });
            }
        });

        const parkParam = this.parameters.find((p) => p.id === 'parkControllerId');
        if (parkParam) {
            if (parks.length) {
                parkParam.options = [
                    { value: '', label: '— none —' },
                    ...parks.map((p, i) => ({ ...p, default: i === 0 }))
                ];
            } else {
                parkParam.options = [{ value: '', label: 'No Park Controller on diagram' }];
            }
        }

        const shuntParam = this.parameters.find((p) => p.id === 'shuntIds');
        if (shuntParam) {
            shuntParam.options = shunts.length
                ? shunts
                : [{ value: '', label: 'No shunts / capacitors found' }];
        }

        const exclParam = this.parameters.find((p) => p.id === 'excludeGeneratorIds');
        if (exclParam) {
            exclParam.options = plantGens.length
                ? plantGens
                : [{ value: '', label: 'No static generators or wind turbines found' }];
        }
        // Exclude-from-P-scaling defaults to none selected (unlike generatorIds).
        this._uncheckExcludeByDefault = true;
        this._canvasEq = canvasEq;
    }

    _canvasHas(kind) {
        return Boolean(this._canvasEq && this._canvasEq[kind]);
    }

    _shadowUnavailableField(formGroup, param) {
        const kind = param.requiresCanvas;
        if (!kind || this._canvasHas(kind)) return;
        const hint = param.unavailableHint || 'Not available: no matching element on the diagram.';
        const cb = this.inputs.get(param.id);
        if (cb) {
            cb.checked = false;
            cb.disabled = true;
            cb.title = hint;
        }
        formGroup.style.opacity = '0.45';
        formGroup.style.pointerEvents = 'none';
        formGroup.title = hint;
        formGroup.setAttribute('aria-disabled', 'true');
        formGroup.querySelectorAll('label, div').forEach((el) => {
            el.style.cursor = 'not-allowed';
            el.style.color = '#adb5bd';
        });
    }

    createMultiSelect(param) {
        const container = super.createMultiSelect(param);
        if (param.id === 'excludeGeneratorIds' || param.id === 'shuntIds') {
            const data = this.inputs.get(param.id);
            if (data && data._multiCheckboxes) {
                data._multiCheckboxes.forEach((cb) => {
                    cb.checked = false;
                });
            }
        }
        return container;
    }

    _qDispatchMode() {
        const radios = this._qDispatchRadioInputs;
        if (radios && radios.length) {
            const checked = radios.find((r) => r.checked);
            if (checked) return checked.value === 'park' ? 'park' : 'local';
        }
        const stored = this.inputs.get('qDispatchMode');
        if (stored && stored.value === 'park' && stored.checked) return 'park';
        return 'local';
    }

    _syncQDispatchUi() {
        const parkOn = this._qDispatchMode() === 'park';
        this._setParkFieldShadowed(!parkOn);
        if (parkOn) this._syncGeneratorsFromPark();
        this._syncParkConfigureButton();
    }

    _setParkFieldShadowed(shadowed) {
        const group = this._parkFieldGroup;
        const parkSel = this.inputs.get('parkControllerId');
        if (parkSel) parkSel.disabled = shadowed;
        if (!group) return;
        if (shadowed) {
            group.style.opacity = '0.45';
            group.style.pointerEvents = 'none';
            group.title = 'Select “Park Controller — constant Q at the point of connection” to use and configure this element.';
            group.querySelectorAll('label').forEach((el) => {
                el.style.color = '#adb5bd';
            });
        } else {
            group.style.opacity = '1';
            group.style.pointerEvents = '';
            group.title = '';
            const title = group.querySelector('label');
            if (title) Object.assign(title.style, { fontWeight: '600', color: '#495057' });
        }
    }

    _syncParkConfigureButton() {
        const parkOn = this._qDispatchMode() === 'park';
        const parkSel = this.inputs.get('parkControllerId');
        const hasPark = Boolean(parkSel && parkSel.value);
        const enable = parkOn && hasPark;
        const btn = this._parkCfgBtn;
        if (!btn) return;
        btn.disabled = !enable;
        btn.style.opacity = enable ? '1' : '0.45';
        btn.style.cursor = enable ? 'pointer' : 'not-allowed';
        btn.style.color = enable ? '#007bff' : '#6c757d';
        btn.style.borderColor = enable ? '#007bff' : '#ced4da';
        if (!parkOn) {
            btn.title = 'Select Park Controller dispatch to configure this element';
        } else if (!hasPark) {
            btn.title = 'No Park Controller on the diagram';
        } else {
            btn.title = 'Open the Park Controller dialog for the selected element';
        }
    }

    _syncGeneratorsFromPark() {
        const parkSel = this.inputs.get('parkControllerId');
        const parkId = parkSel && parkSel.value;
        if (!parkId || this._qDispatchMode() !== 'park') return;
        const cell = this.graph.getModel().getCell(parkId);
        if (!cell) return;
        let machines = [];
        try {
            machines = JSON.parse(cellAttr(cell, 'machines_json') || '[]');
        } catch (e) {
            machines = [];
        }
        const names = new Set(
            (Array.isArray(machines) ? machines : [])
                .filter((m) => m && m.connected !== false && m.connected !== 'false')
                .map((m) => String(m.name || ''))
        );
        const data = this.inputs.get('generatorIds');
        if (!data || !data._multiCheckboxes) return;
        data._multiCheckboxes.forEach((cb) => {
            if (!cb.value) return;
            const genCell = this.graph.getModel().getCell(cb.value);
            const n = cellAttr(genCell, 'name') || cellAttr(genCell, 'userFriendlyName') || '';
            cb.checked = names.has(String(n));
        });
    }

    _openParkControllerDialog() {
        if (this._qDispatchMode() !== 'park') return;
        const parkSel = this.inputs.get('parkControllerId');
        const parkId = parkSel && parkSel.value;
        if (!parkId) {
            alert('Select a Park Controller first.');
            return;
        }
        const cell = this.graph.getModel().getCell(parkId);
        if (!cell) {
            alert('Park Controller cell not found.');
            return;
        }
        try {
            const dialog = new ParkControllerDialog(this.ui);
            dialog.populateDialog(cell.value);
            dialog.show((values) => {
                if (!values) return;
                let value = cell.value;
                if (!value || typeof value.setAttribute !== 'function') {
                    value = mxUtils.createXmlDocument().createElement('object');
                }
                Object.entries(values).forEach(([name, fieldValue]) => {
                    const stored = typeof fieldValue === 'boolean' ? String(fieldValue) : fieldValue;
                    value.setAttribute(name, stored);
                });
                if (values.name != null) {
                    value.setAttribute('label', values.name);
                }
                this.graph.getModel().setValue(cell, value);
                this.graph.refresh(cell);
                this._syncGeneratorsFromPark();
            }, { stacked: true });
        } catch (err) {
            console.error('Failed to open Park Controller dialog:', err);
            alert('Could not open the Park Controller dialog: ' + (err && err.message ? err.message : err));
        }
    }

    getFormValues() {
        const values = super.getFormValues();
        delete values.uqRequirements;
        delete values.uqGridCodeTemplateKey;
        values.pMaxMw = values.pnMw;
        values.iParkCtrl = values.qDispatchMode === 'park';
        if (this.container) {
            [
                'iTrfCtrl', 'iTrf3wCtrl', 'run_control_shunt', 'shntCtrl', 'limQUprot',
                'iShowPQ0', 'iOutput',
                'limitOverloads'
            ].forEach((id) => {
                const el = this.container.querySelector(`input[type="checkbox"][id="${id}"]`);
                if (el) values[id] = el.disabled ? false : el.checked;
            });
        }
        return values;
    }

    _countInlineRow(startIndex, rowId) {
        let n = 0;
        for (let i = startIndex; i < this.parameters.length; i++) {
            if (this.parameters[i].inlineRow === rowId) n++;
            else break;
        }
        return n;
    }

    _createParamField(param) {
        const formGroup = document.createElement('div');
        Object.assign(formGroup.style, { marginBottom: '0' });

        if (param.type !== 'checkbox' || param.checkboxLabel != null) {
            const label = document.createElement('label');
            Object.assign(label.style, {
                display: 'block', marginBottom: '2px', fontWeight: '600',
                fontSize: '13px', color: '#495057'
            });
            label.textContent = param.label;
            formGroup.appendChild(label);
        }

        let input;
        if (param.type === 'radio') input = this.createRadioGroup(param);
        else if (param.type === 'select') input = this.createSelect(param);
        else if (param.type === 'multiselect') input = this.createMultiSelect(param);
        else if (param.type === 'checkbox') input = this.createCheckbox(param);
        else input = this.createTextInput(param);

        if (input instanceof Node) formGroup.appendChild(input);

        if (param.id === 'qDispatchMode') {
            this._qDispatchRadioInputs = [...formGroup.querySelectorAll('input[type="radio"][name="qDispatchMode"]')];
            this._qDispatchRadioInputs.forEach((el) => {
                el.addEventListener('change', () => this._syncQDispatchUi());
            });
        }

        if (param.help) {
            const hint = document.createElement('div');
            hint.textContent = param.help;
            Object.assign(hint.style, {
                fontSize: '12px', color: '#6c757d', marginTop: '4px', lineHeight: '1.45'
            });
            formGroup.appendChild(hint);
        }

        if (param.id === 'parkControllerId') {
            this._parkFieldGroup = formGroup;
            const btnRow = document.createElement('div');
            Object.assign(btnRow.style, { marginTop: '6px', display: 'flex', gap: '8px' });
            const cfg = document.createElement('button');
            cfg.type = 'button';
            cfg.textContent = 'Configure…';
            Object.assign(cfg.style, {
                padding: '5px 12px', fontSize: '13px', border: '1px solid #007bff',
                borderRadius: '4px', backgroundColor: '#fff', color: '#007bff', cursor: 'pointer'
            });
            cfg.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (cfg.disabled) return;
                this._openParkControllerDialog();
            };
            this._parkCfgBtn = cfg;
            btnRow.appendChild(cfg);
            formGroup.appendChild(btnRow);
        }

        this._shadowUnavailableField(formGroup, param);
        return formGroup;
    }

    _appendGroupedParameters(form, options = {}) {
        const skipGroups = options.skipGroups || [];
        const onlyGroups = options.onlyGroups || null;
        let bracketWrap = null;
        let inlineWrap = null;

        this.parameters.forEach((param, index) => {
            if (param.type === 'sectionTitle') return;
            if (skipGroups.includes(param.bracketGroup)) return;
            if (onlyGroups && !onlyGroups.includes(param.bracketGroup)) return;

            const prev = this.parameters.slice(0, index).reverse().find((p) => {
                if (p.type === 'sectionTitle') return false;
                if (skipGroups.includes(p.bracketGroup)) return false;
                if (onlyGroups && !onlyGroups.includes(p.bracketGroup)) return false;
                return true;
            }) || null;
            if (param.bracketGroup && (!prev || prev.bracketGroup !== param.bracketGroup)) {
                bracketWrap = createDialogBracketGroup(param.bracketGroupTitle || '');
                form.appendChild(bracketWrap);
            }
            if (!param.bracketGroup) bracketWrap = null;

            const parent = bracketWrap || form;
            const field = this._createParamField(param);

            if (param.inlineRow) {
                if (!prev || prev.inlineRow !== param.inlineRow) {
                    inlineWrap = document.createElement('div');
                    Object.assign(inlineWrap.style, {
                        display: 'grid',
                        gridTemplateColumns: `repeat(${this._countInlineRow(index, param.inlineRow)}, minmax(0, 1fr))`,
                        gap: '10px',
                        alignItems: 'start'
                    });
                    parent.appendChild(inlineWrap);
                }
                inlineWrap.appendChild(field);
            } else {
                parent.appendChild(field);
            }
        });
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

        const reqWrap = createDialogBracketGroup('Grid code requirement');
        const reqSection = this._createRequirementsSection();
        const reqTitle = reqSection.firstElementChild;
        if (reqTitle && reqTitle.tagName === 'LABEL') {
            reqTitle.remove();
        }
        Object.assign(reqSection.style, { marginTop: '0' });
        reqWrap.appendChild(reqSection);
        form.appendChild(reqWrap);

        this._appendGroupedParameters(form, { onlyGroups: ['results'] });

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

        if (this._templateSelect) {
            this._templateSelect.value = 'entsoe_ppm_inner';
            this._templateSelect.dispatchEvent(new Event('change'));
            this._applyTemplate('entsoe_ppm_inner', { silent: true });
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
                    else alert('A subscription is required to use Grid Code Compliance (P-Q) analysis.');
                    return;
                }
                const values = this.getFormValues();
                if (this.callback) this.callback(values);
                cleanupAndClose();
            } catch (error) {
                console.error('GridCodePqDialog error:', error);
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

window.GridCodePqDialog = GridCodePqDialog;
export { estimateRpcInstalledMw };
