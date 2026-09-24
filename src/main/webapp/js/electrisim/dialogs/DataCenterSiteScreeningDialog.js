// DataCenterSiteScreeningDialog.js — site screening parameters (pandapower)
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

function loadDisplayName(graph, cell) {
    const val = graph.getModel().getValue(cell);
    if (val?.getAttribute) {
        const n = String(val.getAttribute('name') || '').trim();
        if (n && n !== 'Load') return n;
    } else if (val?.attributes) {
        for (let i = 0; i < val.attributes.length; i++) {
            if (val.attributes[i].nodeName === 'name' && val.attributes[i].nodeValue) {
                const n = String(val.attributes[i].nodeValue).trim();
                if (n && n !== 'Load') return n;
            }
        }
    }
    const children = graph.getModel().getChildCells(cell, true, false) || [];
    for (const ch of children) {
        if (typeof ch.value === 'string' && ch.value.trim()) return ch.value.trim();
    }
    return '';
}

function isSiteScreeningLoadCell(style) {
    if (!style || style.includes('Result')) return false;
    if (style.includes('Asymmetric') || style.includes('Load DC') || style.includes('Load 1ph')) return false;
    return style.includes('shapeELXXX=Load');
}

function collectLoads(graph) {
    const options = [];
    if (!graph?.getModel) return options;
    const model = graph.getModel();
    const parent = graph.getDefaultParent?.() || model.getRoot();
    const cells = [];
    const walk = (p) => {
        const kids = model.getChildCells(p, true, false) || [];
        for (const cell of kids) {
            cells.push(cell);
            walk(cell);
        }
    };
    walk(parent);
    const seen = new Set();
    for (const cell of cells) {
        if (cell.edge) continue;
        const style = cell.getStyle?.() || model.getStyle(cell) || '';
        if (!isSiteScreeningLoadCell(style)) continue;
        let label = loadDisplayName(graph, cell);
        if (!label) label = 'Load';
        if (seen.has(label)) {
            let n = 2;
            while (seen.has(`${label} (${n})`)) n += 1;
            label = `${label} (${n})`;
        }
        seen.add(label);
        options.push({ value: label, label, cell });
    }
    options.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    return options;
}

export class DataCenterSiteScreeningDialog extends Dialog {
    constructor(editorUi) {
        super('Data Center Site Screening (Beta)', 'Analyze');
        this.useStudyModalShell = true;
        this.studyModalParkable = true;
        this.studyModalBoxWidth = 760;
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this._siteLoads = collectLoads(this.graph);

        this.parameters = [
            {
                id: 'site_load_ids',
                label: 'Site loads',
                type: 'custom',
                value: '',
                description: this._siteLoads.length
                    ? 'Tick the loads at the data-center point of connection. Filter the list when the diagram has many loads.'
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

    createCustomParameter(param) {
        if (param.id !== 'site_load_ids') return null;
        const loads = this._siteLoads || [];
        const wrap = document.createElement('div');
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.id = param.id;
        hidden.value = '';
        this.inputs.set(param.id, hidden);
        wrap.appendChild(hidden);

        if (!loads.length) {
            const empty = document.createElement('div');
            empty.textContent = 'No loads on this diagram.';
            Object.assign(empty.style, { fontSize: '13px', color: '#6c757d' });
            wrap.appendChild(empty);
            return wrap;
        }

        const toolbar = document.createElement('div');
        Object.assign(toolbar.style, {
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '6px'
        });
        const search = document.createElement('input');
        search.type = 'search';
        search.placeholder = `Filter ${loads.length} loads…`;
        Object.assign(search.style, {
            flex: '1',
            minWidth: '0',
            padding: '6px 10px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
        });
        const btnStyle = {
            padding: '6px 10px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            background: '#fff',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap'
        };
        const selectShown = document.createElement('button');
        selectShown.type = 'button';
        selectShown.textContent = 'Select shown';
        Object.assign(selectShown.style, btnStyle);
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = 'Clear';
        Object.assign(clearBtn.style, btnStyle);
        toolbar.appendChild(search);
        toolbar.appendChild(selectShown);
        toolbar.appendChild(clearBtn);
        wrap.appendChild(toolbar);

        const count = document.createElement('div');
        Object.assign(count.style, { fontSize: '12px', color: '#495057', marginBottom: '4px' });
        wrap.appendChild(count);

        const list = document.createElement('div');
        Object.assign(list.style, {
            border: '1px solid #ced4da',
            borderRadius: '4px',
            maxHeight: '220px',
            overflowY: 'auto',
            background: '#fff'
        });

        const boxes = [];
        const sync = () => {
            const names = boxes.filter((cb) => cb.checked).map((cb) => cb.value);
            hidden.value = names.join(',');
            count.textContent = !names.length
                ? 'None selected'
                : names.length <= 6
                    ? `${names.length} selected: ${names.join(', ')}`
                    : `${names.length} selected`;
        };

        loads.forEach((load) => {
            const row = document.createElement('div');
            row.dataset.name = load.label.toLowerCase();
            Object.assign(row.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 8px',
                borderBottom: '1px solid #f1f3f5'
            });
            const label = document.createElement('label');
            Object.assign(label.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flex: '1',
                minWidth: '0',
                cursor: 'pointer',
                fontSize: '13px'
            });
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = load.value;
            Object.assign(cb.style, { width: '15px', height: '15px', accentColor: '#0066cc' });
            const name = document.createElement('span');
            name.textContent = load.label;
            label.appendChild(cb);
            label.appendChild(name);
            const showBtn = document.createElement('button');
            showBtn.type = 'button';
            showBtn.textContent = 'Show';
            showBtn.title = 'Hide this dialog and show the load on the diagram';
            Object.assign(showBtn.style, {
                border: 'none',
                background: 'transparent',
                color: '#0066cc',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'inherit',
                padding: '2px 4px'
            });
            showBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._focusLoad(load.cell, load.label);
            });
            cb.addEventListener('change', sync);
            row.appendChild(label);
            row.appendChild(showBtn);
            list.appendChild(row);
            boxes.push(cb);
        });

        const applyFilter = () => {
            const q = search.value.trim().toLowerCase();
            list.querySelectorAll('[data-name]').forEach((row) => {
                row.style.display = !q || row.dataset.name.includes(q) ? '' : 'none';
            });
        };
        search.addEventListener('input', applyFilter);
        selectShown.addEventListener('click', (e) => {
            e.preventDefault();
            list.querySelectorAll('[data-name]').forEach((row) => {
                if (row.style.display === 'none') return;
                const cb = row.querySelector('input[type="checkbox"]');
                if (cb) cb.checked = true;
            });
            sync();
        });
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            boxes.forEach((cb) => { cb.checked = false; });
            sync();
        });

        wrap.appendChild(list);
        sync();
        return wrap;
    }

    _focusLoad(cell, label) {
        const graph = this.graph;
        if (!graph || !cell) return;
        graph.setSelectionCell(cell);
        if (typeof graph.scrollCellToVisible === 'function') {
            graph.scrollCellToVisible(cell, true);
        }
        const name = label ? ` — ${label}` : '';
        this.parkStudyModal(`Back to site screening${name}`);
    }

    getFormValues() {
        const values = {};
        (this.parameters || []).forEach((param) => {
            if (param.type === 'radio') {
                const selected = (param.options || []).find((option) =>
                    this.inputs.get(`${param.id}_${option.value}`)?.checked
                );
                values[param.id] = selected
                    ? selected.value
                    : (param.options || []).find((option) => option.default)?.value;
            } else if (param.type === 'checkbox') {
                const input = this.inputs.get(param.id);
                values[param.id] = input ? input.checked : param.value;
            } else {
                const input = this.inputs.get(param.id);
                values[param.id] = input && input.value != null ? input.value : (param.value ?? '');
            }
        });
        return values;
    }

    getDescription() {
        return (
            '<strong>Phase 1 site screening (Beta)</strong> — headroom MW and N-1 / N-1-1 at each candidate load size. ' +
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
                    alert('Select at least one load.');
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
