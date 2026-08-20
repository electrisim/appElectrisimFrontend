import { Dialog } from '../Dialog.js';

export class CapControlDialog extends Dialog {
    constructor(editorUi) {
        super('CapControl Parameters', 'Apply');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.fields = [
            ['name', 'Control name', 'text', 'CapControl'],
            ['capacitor', 'Capacitor name (or bus reference)', 'text', ''],
            ['type', 'Control type', 'select', 'Voltage', ['Voltage', 'Current', 'kvar', 'Time']],
            ['on_setting', 'ON setting', 'number', '115'],
            ['off_setting', 'OFF setting', 'number', '125'],
            ['ctratio', 'CT ratio', 'number', '1'],
            ['ptratio', 'PT ratio', 'number', '1'],
            ['delay', 'Delay (s)', 'number', '15'],
            ['enabled', 'Enabled', 'checkbox', true]
        ];
    }

    populateDialog(cellData) {
        for (const attribute of cellData?.attributes || []) {
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
        intro.textContent = 'Attach this OpenDSS CapControl to a capacitor by its canvas name.';
        container.appendChild(intro);
        const inputs = new Map();
        for (const [id, label, type, value, options] of this.fields) {
            const row = document.createElement('label');
            row.style.cssText = 'display:grid;grid-template-columns:1fr 180px;gap:12px;align-items:center;margin:9px 0';
            row.textContent = label;
            const input = type === 'select' ? document.createElement('select') : document.createElement('input');
            if (type === 'select') {
                for (const option of options) input.add(new Option(option, option, false, option === value));
            } else {
                input.type = type;
                if (type === 'checkbox') input.checked = Boolean(value);
                else input.value = value;
            }
            input.style.padding = '6px';
            row.appendChild(input);
            inputs.set(id, input);
            container.appendChild(row);
        }
        const buttons = document.createElement('div');
        buttons.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px';
        buttons.append(
            mxUtils.button('Cancel', () => this.closeDialog()),
            mxUtils.button('Apply', () => {
                const values = {};
                for (const [id, , type] of this.fields) {
                    const input = inputs.get(id);
                    values[id] = type === 'checkbox' ? input.checked : input.value;
                }
                callback?.(values);
                this.closeDialog();
            })
        );
        container.appendChild(buttons);
        if (this.ui?.showDialog) this.ui.showDialog(container, 560, 460, true, false);
        else this.showModalFallback(container);
    }
}

globalThis.CapControlDialog = CapControlDialog;
