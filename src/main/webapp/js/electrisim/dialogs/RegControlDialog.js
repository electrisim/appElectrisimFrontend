import { Dialog } from '../Dialog.js';

export class RegControlDialog extends Dialog {
    constructor(editorUi) {
        super('RegControl Parameters', 'Apply');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.fields = [
            ['name', 'Control name', 'text', 'RegControl'],
            ['transformer', 'Transformer name (or bus reference)', 'text', ''],
            ['winding', 'Controlled winding', 'number', '2'],
            ['vreg', 'Regulated voltage (V)', 'number', '120'],
            ['band', 'Bandwidth (V)', 'number', '3'],
            ['ptratio', 'PT ratio', 'number', '60'],
            ['ctprim', 'CT primary rating (A)', 'number', '300'],
            ['delaying', 'Delay (s)', 'number', '15'],
            ['enabled', 'Enabled', 'checkbox', true]
        ];
    }

    populateDialog(cellData) {
        const attributes = cellData?.attributes || [];
        for (const attribute of attributes) {
            const field = this.fields.find(([id]) => id === attribute.name);
            if (field) field[3] = field[2] === 'checkbox'
                ? attribute.value === true || attribute.value === 'true'
                : attribute.value;
        }
    }

    show(callback) {
        const container = document.createElement('div');
        container.style.cssText = 'padding:12px;font:14px Arial;min-width:420px';
        const intro = document.createElement('p');
        intro.textContent = 'Attach this OpenDSS RegControl to a transformer by its canvas name.';
        container.appendChild(intro);
        const inputs = new Map();
        for (const [id, label, type, value] of this.fields) {
            const row = document.createElement('label');
            row.style.cssText = 'display:grid;grid-template-columns:1fr 180px;gap:12px;align-items:center;margin:9px 0';
            row.textContent = label;
            const input = document.createElement('input');
            input.type = type;
            if (type === 'checkbox') input.checked = Boolean(value);
            else input.value = value;
            input.style.padding = '6px';
            row.appendChild(input);
            inputs.set(id, input);
            container.appendChild(row);
        }
        const buttons = document.createElement('div');
        buttons.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px';
        const cancel = mxUtils.button('Cancel', () => this.closeDialog());
        const apply = mxUtils.button('Apply', () => {
            const values = {};
            for (const [id, , type] of this.fields) {
                const input = inputs.get(id);
                values[id] = type === 'checkbox' ? input.checked : input.value;
            }
            callback?.(values);
            this.closeDialog();
        });
        buttons.append(cancel, apply);
        container.appendChild(buttons);
        if (this.ui?.showDialog) this.ui.showDialog(container, 560, 460, true, false);
        else this.showModalFallback(container);
    }
}

globalThis.RegControlDialog = RegControlDialog;
