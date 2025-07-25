// OptimalPowerFlowResultsDialog.js
(function() {
    class OptimalPowerFlowResultsDialog {
        constructor(results) {
            this.results = results;
            this.title = 'Optimal Power Flow Results';
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
                max-width: 800px; max-height: 90vh; overflow-y: auto; padding: 24px; margin: 20px;
                font-family: Arial, sans-serif;
            `;

            // Title
            const title = document.createElement('h2');
            title.textContent = this.title;
            dialog.appendChild(title);

            // Summary
            const summary = document.createElement('div');
            summary.innerHTML = `
                <b>Status:</b> ${this.results.opf_converged ? 'Converged' : 'Not converged'}<br>
                <b>Total Cost:</b> ${this.results.total_cost ?? 'N/A'}<br>
            `;
            summary.style.marginBottom = '16px';
            dialog.appendChild(summary);

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
            dialog.innerHTML += createTable('Busbars', this.results.busbars, ['name','id','p_mw','q_mvar','vm_pu','va_degree','lam_p','lam_q']);
            // Generators
            dialog.innerHTML += createTable('Generators', this.results.generators, ['name','id','p_mw','q_mvar','vm_pu','va_degree','gen_cost','marginal_cost']);
            // Loads
            dialog.innerHTML += createTable('Loads', this.results.loads, ['name','id','p_mw','q_mvar','vm_pu','va_degree']);
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
        globalThis.OptimalPowerFlowResultsDialog = OptimalPowerFlowResultsDialog;
    } else if (typeof window !== 'undefined') {
        window.OptimalPowerFlowResultsDialog = OptimalPowerFlowResultsDialog;
    }
})(); 