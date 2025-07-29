// ControllerSimulationResultsDialog.js
(function() {
    class ControllerSimulationResultsDialog {
        constructor(results) {
            this.results = results;
            this.title = 'Controller Simulation Results';
        }

        show() {
            // Overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
            `;

            // Dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                max-width: 900px; max-height: 90vh; overflow-y: auto; padding: 24px; margin: 20px;
                font-family: Arial, sans-serif;
            `;

            // Title
            const title = document.createElement('h2');
            title.textContent = this.title;
            dialog.appendChild(title);

            // Summary
            const summary = document.createElement('div');
            summary.innerHTML = `
                <b>Status:</b> ${this.results.controller_converged ? 'Converged' : 'Not converged'}<br>
                <b>Controllers Active:</b> ${this.results.controller_status ? this.results.controller_status.length : 0}<br>
            `;
            summary.style.marginBottom = '16px';
            dialog.appendChild(summary);

            // Controller Status
            if (this.results.controller_status && this.results.controller_status.length > 0) {
                const controllerSection = document.createElement('div');
                controllerSection.innerHTML = '<h3 style="margin-top:18px">Controller Status</h3>';
                
                const controllerTable = document.createElement('table');
                controllerTable.style.cssText = 'border-collapse:collapse;width:100%;margin-bottom:12px;border:1px solid #ddd;';
                controllerTable.innerHTML = `
                    <tr style="background:#f5f5f5;">
                        <th style="border:1px solid #ddd;padding:8px;">Controller ID</th>
                        <th style="border:1px solid #ddd;padding:8px;">Type</th>
                        <th style="border:1px solid #ddd;padding:8px;">Status</th>
                    </tr>
                `;
                
                this.results.controller_status.forEach(ctrl => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td style="border:1px solid #ddd;padding:8px;">${ctrl.controller_id}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${ctrl.controller_type}</td>
                        <td style="border:1px solid #ddd;padding:8px;color:${ctrl.active ? 'green' : 'red'};">${ctrl.active ? 'Active' : 'Inactive'}</td>
                    `;
                    controllerTable.appendChild(row);
                });
                
                controllerSection.appendChild(controllerTable);
                dialog.appendChild(controllerSection);
            }

            // Helper to create tables
            function createTable(title, arr, columns) {
                if (!arr || !arr.length) return '';
                let html = `<h3 style="margin-top:18px">${title}</h3><table border="1" style="border-collapse:collapse;width:100%;margin-bottom:12px"><tr>`;
                columns.forEach(col => html += `<th>${col}</th>`);
                html += '</tr>';
                arr.forEach(row => {
                    html += '<tr>';
                    columns.forEach(col => html += `<td>${row[col] ?? ''}</td>`);
                    html += '</tr>';
                });
                html += '</table>';
                return html;
            }

            // Busbars
            dialog.innerHTML += createTable('Busbars', this.results.busbars, ['name','id','vm_pu','va_degree','p_mw','q_mvar']);
            // Generators
            dialog.innerHTML += createTable('Generators', this.results.generators, ['name','id','p_mw','q_mvar','vm_pu','va_degree']);
            // Loads
            dialog.innerHTML += createTable('Loads', this.results.loads, ['name','id','p_mw','q_mvar']);
            // Lines
            dialog.innerHTML += createTable('Lines', this.results.lines, ['name','id','loading_percent','p_from_mw','p_to_mw','q_from_mvar','q_to_mvar']);

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.cssText = 'margin-top:20px;padding:8px 24px;font-size:16px;';
            closeBtn.onclick = () => document.body.removeChild(overlay);
            dialog.appendChild(closeBtn);

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) document.body.removeChild(overlay);
            });
        }
    }

    if (typeof globalThis !== 'undefined') {
        globalThis.ControllerSimulationResultsDialog = ControllerSimulationResultsDialog;
    } else if (typeof window !== 'undefined') {
        window.ControllerSimulationResultsDialog = ControllerSimulationResultsDialog;
    }
})(); 