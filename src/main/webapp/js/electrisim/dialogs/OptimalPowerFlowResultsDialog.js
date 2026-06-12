// OptimalPowerFlowResultsDialog.js — formatted OPF summary for Electrisim
(function () {
    const STYLE_ID = 'electrisim-opf-results-styles';

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .opf-results-dialog {
                background: #fafbfc;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(15, 23, 42, 0.18);
                max-width: min(1120px, 96vw);
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
                color: #1e293b;
            }
            .opf-results-dialog header {
                padding: 20px 24px 16px;
                border-bottom: 1px solid #e2e8f0;
                background: #fff;
                flex-shrink: 0;
            }
            .opf-results-dialog h2 {
                margin: 0 0 8px;
                font-size: 1.35rem;
                font-weight: 650;
                letter-spacing: -0.02em;
            }
            .opf-results-intro {
                margin: 0;
                font-size: 0.875rem;
                line-height: 1.55;
                color: #475569;
            }
            .opf-results-body {
                overflow-y: auto;
                padding: 16px 24px 24px;
                flex: 1;
            }
            .opf-summary-cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 12px;
                margin-bottom: 20px;
            }
            .opf-summary-card {
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 14px 16px;
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
            }
            .opf-summary-card dt {
                margin: 0 0 6px;
                font-size: 0.7rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                color: #64748b;
            }
            .opf-summary-card dd {
                margin: 0;
                font-size: 1.05rem;
                font-weight: 600;
                color: #0f172a;
            }
            .opf-badge {
                display: inline-block;
                padding: 4px 10px;
                border-radius: 999px;
                font-size: 0.78rem;
                font-weight: 600;
            }
            .opf-badge.ok { background: #dcfce7; color: #166534; }
            .opf-badge.fail { background: #fee2e2; color: #991b1b; }
            .opf-section {
                margin-top: 22px;
            }
            .opf-section h3 {
                margin: 0 0 6px;
                font-size: 1rem;
                font-weight: 650;
                color: #0f172a;
            }
            .opf-section-desc {
                margin: 0 0 10px;
                font-size: 0.8125rem;
                line-height: 1.5;
                color: #64748b;
            }
            .opf-table-wrap {
                overflow-x: auto;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
                background: #fff;
            }
            .opf-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.8125rem;
            }
            .opf-table th {
                text-align: left;
                padding: 10px 12px;
                background: #f1f5f9;
                font-weight: 600;
                color: #334155;
                border-bottom: 1px solid #e2e8f0;
                white-space: nowrap;
            }
            .opf-table th.num, .opf-table td.num {
                text-align: right;
                font-variant-numeric: tabular-nums;
            }
            .opf-table td {
                padding: 9px 12px;
                border-bottom: 1px solid #f1f5f9;
                vertical-align: middle;
            }
            .opf-table tbody tr:nth-child(even) td { background: #fafbfc; }
            .opf-table tbody tr:last-child td { border-bottom: none; }
            .opf-results-footer {
                padding: 14px 24px;
                border-top: 1px solid #e2e8f0;
                background: #fff;
                flex-shrink: 0;
            }
            .opf-results-footer button {
                padding: 10px 22px;
                font-size: 0.9rem;
                font-weight: 600;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                background: #2563eb;
                color: #fff;
            }
            .opf-solver-log {
                margin-top: 18px;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                background: #fff;
                overflow: hidden;
            }
            .opf-solver-log summary {
                padding: 12px 14px;
                cursor: pointer;
                font-weight: 600;
                font-size: 0.875rem;
                color: #334155;
                background: #f1f5f9;
                list-style-position: outside;
            }
            .opf-solver-log pre {
                margin: 0;
                padding: 12px 14px;
                max-height: min(50vh, 420px);
                overflow: auto;
                font-family: ui-monospace, Consolas, monospace;
                font-size: 11px;
                line-height: 1.35;
                white-space: pre;
                background: #fafafa;
                border-top: 1px solid #e2e8f0;
                color: #1e293b;
            }
        `;
        document.head.appendChild(style);
    }

    function stripTechnicalSuffix(displayName) {
        if (displayName == null || displayName === '') return '';
        let s = String(displayName);
        s = s.replace(/\s*\([^)]*mxCell[^)]*\)\s*/gi, ' ').trim();
        s = s.replace(/\s*\([^)]{12,}\)\s*$/g, '').trim();
        return s || String(displayName);
    }

    function formatNumber(val, decimals) {
        if (val === null || val === undefined || val === '') return '—';
        const n = Number(val);
        if (!Number.isFinite(n)) return '—';
        if (Math.abs(n) < 1e-12 && n !== 0) return '0';
        return n.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals,
        });
    }

    /** Non-breaking space + symbol or code for dispatch-cost display (matches opfCostCurrency.js). */
    function dispatchCostCurrencySuffix(currencyCode) {
        const c = currencyCode != null && String(currencyCode).trim() !== ''
            ? String(currencyCode).trim().toUpperCase()
            : 'EUR';
        const map = {
            EUR: '€',
            USD: '$',
            GBP: '£',
            CHF: 'CHF',
            PLN: 'zł',
            SEK: 'kr',
            NOK: 'kr',
            DKK: 'kr',
            JPY: '¥',
            CNY: '¥',
            INR: '₹',
            AUD: 'A$',
            CAD: 'C$',
        };
        if (c === 'OTHER') return '';
        const sym = map[c];
        return '\u00a0' + (sym != null ? sym : c);
    }

    /** Column visible if any row has a finite numeric (or non-empty string) value; keeps zeros. */
    function columnAnyFinite(rows, key) {
        return rows.some((row) => {
            const v = row[key];
            if (v === null || v === undefined || v === '') return false;
            const n = Number(v);
            if (Number.isFinite(n)) return true;
            return typeof v === 'string' && v.trim() !== '';
        });
    }

    /** For OPF duals / shadow prices: hide column when all entries are ~0. */
    function columnAnySignificant(rows, key, eps) {
        const e = eps != null ? eps : 1e-6;
        return rows.some((row) => {
            const v = row[key];
            if (v === null || v === undefined || v === '') return false;
            const n = Number(v);
            return Number.isFinite(n) && Math.abs(n) > e;
        });
    }

    function buildColumns(rows, spec) {
        if (!rows || !rows.length) return [];
        return spec.filter((col) => {
            if (col.ifPresent === 'significant') {
                return columnAnySignificant(rows, col.key, col.significantEps);
            }
            if (col.ifPresent) {
                return columnAnyFinite(rows, col.key);
            }
            return true;
        });
    }

    function renderTable(sectionTitle, sectionDesc, rows, spec) {
        const cols = buildColumns(rows, spec);
        if (!cols.length || !rows.length) return null;

        const section = document.createElement('section');
        section.className = 'opf-section';

        const h3 = document.createElement('h3');
        h3.textContent = sectionTitle;
        section.appendChild(h3);

        if (sectionDesc) {
            const p = document.createElement('p');
            p.className = 'opf-section-desc';
            p.textContent = sectionDesc;
            section.appendChild(p);
        }

        const wrap = document.createElement('div');
        wrap.className = 'opf-table-wrap';

        const table = document.createElement('table');
        table.className = 'opf-table';

        const thead = document.createElement('thead');
        const trh = document.createElement('tr');
        cols.forEach((col) => {
            const th = document.createElement('th');
            th.textContent = col.header;
            if (col.align === 'right') th.classList.add('num');
            trh.appendChild(th);
        });
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        rows.forEach((row) => {
            const tr = document.createElement('tr');
            cols.forEach((col) => {
                const td = document.createElement('td');
                if (col.align === 'right') td.classList.add('num');
                const raw = row[col.key];
                td.textContent = col.format ? col.format(raw, row) : (raw ?? '—');
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        section.appendChild(wrap);
        return section;
    }

    class OptimalPowerFlowResultsDialog {
        constructor(results) {
            this.results = results || {};
            this.title = 'Optimal Power Flow Results';
        }

        show() {
            ensureStyles();

            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; inset: 0;
                background: rgba(15, 23, 42, 0.45);
                z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                padding: 16px;
            `;

            const shell = document.createElement('div');
            shell.className = 'opf-results-dialog';

            const header = document.createElement('header');
            const titleEl = document.createElement('h2');
            titleEl.textContent = this.title;
            header.appendChild(titleEl);

            const intro = document.createElement('p');
            intro.className = 'opf-results-intro';
            intro.innerHTML =
                'This dialog shows the <strong>AC optimal power flow</strong> solution: voltages and flows that satisfy the network equations while minimizing whatever pandapower cost rows exist (<code>poly_cost</code> / <code>pwl_cost</code> on generators, static generators, and optionally on external grid, storage, controllable loads, and DC lines when marginal prices are set). ' +
                'Slack / external grid absorbs mismatch unless it too carries a cost; generators may sit at minimum power if imports are cheaper. ' +
                'Lagrange multipliers (when shown) relate to OPF stationarity at buses; line shadow prices appear when a flow limit binds. ' +
                'If you turned off <strong>Suppress warnings</strong>, PyPower verbose text appears in a collapsible section below.';
            header.appendChild(intro);
            shell.appendChild(header);

            const body = document.createElement('div');
            body.className = 'opf-results-body';

            const converged = !!this.results.opf_converged;
            const totalCost = this.results.total_cost;
            const costCurrency = this.results.cost_currency;

            const summary = document.createElement('dl');
            summary.className = 'opf-summary-cards';

            const cardStatus = document.createElement('div');
            cardStatus.className = 'opf-summary-card';
            const badgeClass = converged ? 'ok' : 'fail';
            const badgeText = converged ? 'Converged' : 'Did not converge';
            cardStatus.innerHTML =
                `<dt>Optimizer status</dt><dd><span class="opf-badge ${badgeClass}">${badgeText}</span></dd>`;
            summary.appendChild(cardStatus);

            const cardCost = document.createElement('div');
            cardCost.className = 'opf-summary-card';
            let costValueHtml = '—';
            if (totalCost != null && Number.isFinite(Number(totalCost))) {
                costValueHtml = formatNumber(totalCost, 4) + dispatchCostCurrencySuffix(costCurrency);
            }
            const costLabel = '<dt>Dispatch cost</dt><dd>' + costValueHtml + '</dd>';
            cardCost.innerHTML = costLabel;
            summary.appendChild(cardCost);

            const cardHint = document.createElement('div');
            cardHint.className = 'opf-summary-card';
            cardHint.innerHTML =
                '<dt>About dispatch cost</dt><dd style="font-size:0.8125rem;font-weight:500;line-height:1.45;color:#475569">' +
                'Sum of pandapower <code>poly_cost</code> / <code>pwl_cost</code> terms (generators and static generators by default; external grid, storage, controllable load, and DC line when you set marginal costs). Coefficient column names are EUR-style in pandapower; the amount above is labeled with the study currency from your diagram when the backend sends it. ' +
                'Treat as relative dispatch cost unless you have calibrated monetary values.</dd>';
            summary.appendChild(cardHint);

            body.appendChild(summary);

            const num = (d) => (v) => formatNumber(v, d);

            const busSpec = [
                {
                    key: 'name',
                    header: 'Bus',
                    format: (v) => stripTechnicalSuffix(v),
                },
                {
                    key: 'vm_pu',
                    header: 'Voltage Vm [pu]',
                    align: 'right',
                    format: num(3),
                },
                {
                    key: 'va_degree',
                    header: 'Angle θ [°]',
                    align: 'right',
                    format: num(2),
                },
                {
                    key: 'p_mw',
                    header: 'Injection P [MW]',
                    align: 'right',
                    format: num(3),
                },
                {
                    key: 'q_mvar',
                    header: 'Injection Q [MVAr]',
                    align: 'right',
                    format: num(3),
                },
                {
                    key: 'pf',
                    header: 'Power factor',
                    align: 'right',
                    format: num(3),
                    ifPresent: true,
                },
                {
                    key: 'lam_p',
                    header: 'λP (OPF)',
                    align: 'right',
                    format: num(4),
                    ifPresent: 'significant',
                },
                {
                    key: 'lam_q',
                    header: 'λQ (OPF)',
                    align: 'right',
                    format: num(4),
                    ifPresent: 'significant',
                },
            ];

            const genSpec = [
                { key: 'name', header: 'Generator', format: (v) => stripTechnicalSuffix(v) },
                { key: 'p_mw', header: 'P [MW]', align: 'right', format: num(3) },
                { key: 'q_mvar', header: 'Q [MVAr]', align: 'right', format: num(3) },
                { key: 'vm_pu', header: 'Vm setpoint [pu]', align: 'right', format: num(3) },
                { key: 'va_degree', header: 'θ [°]', align: 'right', format: num(2) },
                {
                    key: 'gen_cost',
                    header: 'Cost contrib. [€]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
                {
                    key: 'marginal_cost',
                    header: 'Marginal ∂C/∂P [€/MW]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
            ];

            const loadSpec = [
                { key: 'name', header: 'Load', format: (v) => stripTechnicalSuffix(v) },
                { key: 'p_mw', header: 'P demand [MW]', align: 'right', format: num(3) },
                { key: 'q_mvar', header: 'Q demand [MVAr]', align: 'right', format: num(3) },
                {
                    key: 'gen_cost',
                    header: 'Cost contrib. [€]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
                {
                    key: 'marginal_cost',
                    header: 'Marginal ∂C/∂P [€/MW]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
            ];

            const sgenSpec = [
                { key: 'name', header: 'Static generator', format: (v) => stripTechnicalSuffix(v) },
                { key: 'p_mw', header: 'P [MW]', align: 'right', format: num(3) },
                { key: 'q_mvar', header: 'Q [MVAr]', align: 'right', format: num(3) },
                {
                    key: 'gen_cost',
                    header: 'Cost contrib. [€]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
                {
                    key: 'marginal_cost',
                    header: 'Marginal ∂C/∂P [€/MW]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
            ];

            const dclineSpec = [
                { key: 'name', header: 'DC line', format: (v) => stripTechnicalSuffix(v) },
                { key: 'p_mw', header: 'P sched. [MW]', align: 'right', format: num(3) },
                { key: 'p_from_mw', header: 'P from [MW]', align: 'right', format: num(3) },
                { key: 'p_to_mw', header: 'P to [MW]', align: 'right', format: num(3) },
                { key: 'pl_mw', header: 'Losses [MW]', align: 'right', format: num(3), ifPresent: true },
                {
                    key: 'gen_cost',
                    header: 'Cost contrib. [€]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
                {
                    key: 'marginal_cost',
                    header: 'Marginal ∂C/∂P [€/MW]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
            ];

            const extSpec = [
                { key: 'name', header: 'External grid', format: (v) => stripTechnicalSuffix(v) },
                { key: 'p_mw', header: 'P [MW]', align: 'right', format: num(3) },
                { key: 'q_mvar', header: 'Q [MVAr]', align: 'right', format: num(3) },
                { key: 'pf', header: 'Power factor', align: 'right', format: num(3), ifPresent: true },
                {
                    key: 'gen_cost',
                    header: 'Cost contrib. [€]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
                {
                    key: 'marginal_cost',
                    header: 'Marginal ∂C/∂P [€/MW]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
            ];

            const storageSpec = [
                { key: 'name', header: 'Storage', format: (v) => stripTechnicalSuffix(v) },
                { key: 'p_mw', header: 'P [MW]', align: 'right', format: num(3) },
                { key: 'q_mvar', header: 'Q [MVAr]', align: 'right', format: num(3) },
                {
                    key: 'gen_cost',
                    header: 'Cost contrib. [€]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
                {
                    key: 'marginal_cost',
                    header: 'Marginal ∂C/∂P [€/MW]',
                    align: 'right',
                    format: num(4),
                    ifPresent: true,
                },
            ];

            const lineSpec = [
                { key: 'name', header: 'Line', format: (v) => stripTechnicalSuffix(v) },
                {
                    key: 'loading_percent',
                    header: 'Loading [%]',
                    align: 'right',
                    format: num(2),
                },
                { key: 'p_from_mw', header: 'P from [MW]', align: 'right', format: num(3) },
                { key: 'p_to_mw', header: 'P to [MW]', align: 'right', format: num(3) },
                { key: 'q_from_mvar', header: 'Q from [MVAr]', align: 'right', format: num(3) },
                { key: 'q_to_mvar', header: 'Q to [MVAr]', align: 'right', format: num(3) },
                {
                    key: 'i_from_ka',
                    header: 'Ifrom [kA]',
                    align: 'right',
                    format: num(3),
                    ifPresent: true,
                },
                {
                    key: 'i_to_ka',
                    header: 'Ito [kA]',
                    align: 'right',
                    format: num(3),
                    ifPresent: true,
                },
                {
                    key: 'mu_sf',
                    header: 'μ flow (from)',
                    align: 'right',
                    format: num(4),
                    ifPresent: 'significant',
                },
                {
                    key: 'mu_st',
                    header: 'μ flow (to)',
                    align: 'right',
                    format: num(4),
                    ifPresent: 'significant',
                },
            ];

            const sections = [
                renderTable(
                    'Buses',
                    'Nodal AC solution: voltage magnitude and angle, and net active/reactive injection (sum of devices at the bus). λ columns are OPF duals when available.',
                    this.results.busbars,
                    busSpec,
                ),
                renderTable(
                    'External grid',
                    'Slack / coupling point: actual P and Q after OPF. Extra cost columns appear when a polynomial or piecewise-linear cost is defined on this grid (OPF dialog or External Grid OPF tab).',
                    this.results.externalgrids,
                    extSpec,
                ),
                renderTable(
                    'Generators',
                    'Dispatch and reactive output at PV/PQ-capable machines. Very small P can mean the optimum prefers grid imports. Cost columns reflect pandapower <code>poly_cost</code> (polynomial) or <code>pwl_cost</code> (piecewise linear) when present (omit economic objective by choosing <strong>No cost function</strong> in the OPF dialog).',
                    this.results.generators,
                    genSpec,
                ),
                renderTable(
                    'Static generators',
                    'Controllable static generators (PV plants, etc.) when marked controllable and given OPF costs in the device OPF tab.',
                    this.results.staticgenerators || [],
                    sgenSpec,
                ),
                renderTable(
                    'Storage',
                    'Battery / BESS dispatch when included in the study and controllable for OPF. Cost applies only if you assigned marginal coefficients for storage.',
                    this.results.storages || [],
                    storageSpec,
                ),
                renderTable(
                    'Loads',
                    'PQ demand after OPF. For controllable loads with marginal cost, P (and Q bounds) can be optimized; cost columns appear when a cost row exists.',
                    this.results.loads,
                    loadSpec,
                ),
                renderTable(
                    'DC lines',
                    'HVDC-style elements: scheduled active power and branch-flow result. DC lines are controllable by default in pandapower OPF; cost columns when defined.',
                    this.results.dclines || [],
                    dclineSpec,
                ),
                renderTable(
                    'Lines',
                    'Branch flows and thermal loading. Shadow prices μ apply when a maximum-current constraint is binding.',
                    this.results.lines,
                    lineSpec,
                ),
            ];

            sections.forEach((el) => {
                if (el) body.appendChild(el);
            });

            const solverLog = this.results.solver_verbose_log;
            if (solverLog != null && String(solverLog).trim()) {
                const details = document.createElement('details');
                details.className = 'opf-solver-log';
                details.open = false;

                const summary = document.createElement('summary');
                summary.textContent = 'PyPower / PIPS verbose solver output';
                details.appendChild(summary);

                const note = document.createElement('p');
                note.style.cssText =
                    'margin: 0 0 0 0; padding: 8px 14px 0; font-size: 0.78rem; color: #64748b; line-height: 1.45;';
                note.textContent =
                    'Shown because Suppress warnings was disabled. Tables refer to PyPower internal arrays; treat large capacity figures as numerical slack bounds from the solver, not physical ratings.';
                details.appendChild(note);

                const pre = document.createElement('pre');
                pre.textContent = String(solverLog);
                details.appendChild(pre);

                body.appendChild(details);
            }

            shell.appendChild(body);

            const footer = document.createElement('div');
            footer.className = 'opf-results-footer';
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.textContent = 'Close';
            closeBtn.onclick = () => overlay.remove();
            footer.appendChild(closeBtn);
            shell.appendChild(footer);

            overlay.appendChild(shell);
            document.body.appendChild(overlay);

            import('../utils/dialogStyles.js').then(({ attachBackdropCloseHandler }) => {
                attachBackdropCloseHandler(overlay, shell, () => overlay.remove());
            });
        }
    }

    if (typeof globalThis !== 'undefined') {
        globalThis.OptimalPowerFlowResultsDialog = OptimalPowerFlowResultsDialog;
    } else if (typeof window !== 'undefined') {
        window.OptimalPowerFlowResultsDialog = OptimalPowerFlowResultsDialog;
    }
})();
