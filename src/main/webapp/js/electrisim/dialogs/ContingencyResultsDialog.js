// ContingencyResultsDialog.js — N-1 / contingency analysis results with expandable violation details.

export class ContingencyResultsDialog {
    constructor(results) {
        this.results = results || {};
        this.title = 'Contingency Analysis Results';
        this._filterMode = 'all'; // all | violations | failed
        this._searchQuery = '';
        this._expandedKeys = new Set();
    }

    show() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 10000;
            display: flex; align-items: center; justify-content: center; padding: 16px;
        `;
        overlay.className = 'contingency-results-overlay';

        const shell = document.createElement('div');
        shell.style.cssText = `
            background: #fff; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.28);
            max-width: 1200px; width: 100%; max-height: 92vh;
            display: flex; flex-direction: column; overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #212529;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 18px 24px; border-bottom: 1px solid #e9ecef;
            display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
        `;
        const titleEl = document.createElement('h2');
        titleEl.textContent = this.title;
        titleEl.style.cssText = 'margin: 0; font-size: 18px; font-weight: 700;';
        header.appendChild(titleEl);

        const headerClose = document.createElement('button');
        headerClose.textContent = '\u00d7';
        headerClose.title = 'Close';
        headerClose.style.cssText = `
            border: none; background: transparent; font-size: 24px; line-height: 1;
            cursor: pointer; color: #6c757d; padding: 0 4px;
        `;
        headerClose.onclick = () => overlay.remove();
        header.appendChild(headerClose);
        shell.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'flex: 1; overflow-y: auto; padding: 20px 24px;';
        shell.appendChild(body);

        if (this.results.error) {
            this._renderError(body);
        } else {
            this._renderSummary(body);
            this._casesSection = document.createElement('div');
            body.appendChild(this._casesSection);
            this._renderContingencyCases(this._casesSection);
            this._renderWorstCaseDetails(body);
        }

        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 14px 24px; border-top: 1px solid #e9ecef;
            display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0; background: #fafbfc;
        `;
        const downloadBtn = this._button('Download CSV', '#28a745');
        downloadBtn.onclick = () => this._downloadCSV();
        footer.appendChild(downloadBtn);
        const closeBtn = this._button('Close', '#007bff');
        closeBtn.onclick = () => overlay.remove();
        footer.appendChild(closeBtn);
        shell.appendChild(footer);

        overlay.appendChild(shell);
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    }

    _button(label, bg) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = `
            padding: 8px 16px; background: ${bg}; color: #fff; border: none;
            border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
        `;
        return btn;
    }

    _renderError(container) {
        const box = document.createElement('div');
        box.style.cssText = 'padding:16px; border:1px solid #f5c2c7; background:#f8d7da; color:#842029; border-radius:8px;';
        box.textContent = this.results.error;
        container.appendChild(box);
    }

    _renderSummary(container) {
        const summary = this.results.summary || {};
        const cases = this.results.contingency_results || [];
        const converged = cases.filter(c => c.converged !== false).length;
        const failed = cases.length - converged;
        const withViolations = cases.filter(c => (c.violations || []).length > 0 && c.converged !== false).length;
        const totalViolations = summary.total_violations ?? (summary.violations || []).length;

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:20px;';

        const cards = [
            { label: 'Cases analyzed', value: summary.contingencies_analyzed ?? cases.length, color: '#495057' },
            { label: 'Converged', value: converged, color: '#198754' },
            { label: 'Failed', value: failed, color: failed ? '#dc3545' : '#198754' },
            { label: 'With violations', value: withViolations, color: withViolations ? '#fd7e14' : '#198754' },
            { label: 'Total violations', value: totalViolations, color: totalViolations ? '#dc3545' : '#198754' }
        ];

        cards.forEach(({ label, value, color }) => {
            const card = document.createElement('div');
            card.style.cssText = `
                padding: 14px 16px; background: #f8f9fa; border: 1px solid #e9ecef;
                border-radius: 8px; text-align: center;
            `;
            card.innerHTML = `
                <div style="font-size:22px;font-weight:700;color:${color};line-height:1.2;">${this._safe(value)}</div>
                <div style="font-size:11px;color:#6c757d;margin-top:4px;text-transform:uppercase;letter-spacing:0.03em;">${label}</div>
            `;
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    _getFilteredCases() {
        let cases = [...(this.results.contingency_results || [])];
        cases.sort((a, b) => {
            const va = (a.violations || []).length;
            const vb = (b.violations || []).length;
            if (vb !== va) return vb - va;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        if (this._filterMode === 'violations') {
            cases = cases.filter(c => (c.violations || []).length > 0);
        } else if (this._filterMode === 'failed') {
            cases = cases.filter(c => c.converged === false);
        }

        const q = this._searchQuery.trim().toLowerCase();
        if (q) {
            cases = cases.filter(c =>
                String(c.name || '').toLowerCase().includes(q) ||
                String(c.description || '').toLowerCase().includes(q)
            );
        }
        return cases;
    }

    _renderContingencyCases(container) {
        container.innerHTML = '';

        const heading = document.createElement('h3');
        heading.textContent = 'Contingency cases';
        heading.style.cssText = 'margin: 0 0 12px 0; font-size: 15px; font-weight: 600;';
        container.appendChild(heading);

        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px;
        `;

        const search = document.createElement('input');
        search.type = 'search';
        search.placeholder = 'Search by case or outage…';
        search.value = this._searchQuery;
        search.style.cssText = `
            flex: 1; min-width: 180px; padding: 8px 12px; border: 1px solid #ced4da;
            border-radius: 6px; font-size: 13px;
        `;
        search.oninput = () => {
            this._searchQuery = search.value;
            this._renderContingencyCases(container);
        };
        toolbar.appendChild(search);

        const filters = [
            { id: 'all', label: 'All' },
            { id: 'violations', label: 'With violations' },
            { id: 'failed', label: 'Failed only' }
        ];
        filters.forEach(f => {
            const btn = document.createElement('button');
            btn.textContent = f.label;
            const active = this._filterMode === f.id;
            btn.style.cssText = `
                padding: 7px 14px; border-radius: 20px; font-size: 12px; cursor: pointer;
                border: 1px solid ${active ? '#007bff' : '#ced4da'};
                background: ${active ? '#e7f1ff' : '#fff'};
                color: ${active ? '#007bff' : '#495057'}; font-weight: ${active ? '600' : '400'};
            `;
            btn.onclick = () => {
                this._filterMode = f.id;
                this._renderContingencyCases(container);
            };
            toolbar.appendChild(btn);
        });

        const expandAll = document.createElement('button');
        expandAll.textContent = 'Expand all with violations';
        expandAll.style.cssText = `
            padding: 7px 12px; border: 1px solid #ced4da; border-radius: 6px;
            background: #fff; font-size: 12px; cursor: pointer; color: #495057;
        `;
        expandAll.onclick = () => {
            this._getFilteredCases().forEach(c => {
                if ((c.violations || []).length > 0) this._expandedKeys.add(c.name);
            });
            this._renderContingencyCases(container);
        };
        toolbar.appendChild(expandAll);

        container.appendChild(toolbar);

        const cases = this._getFilteredCases();
        if (!cases.length) {
            const empty = document.createElement('p');
            empty.style.cssText = 'color:#6c757d;font-style:italic;margin:12px 0;';
            empty.textContent = 'No cases match the current filter.';
            container.appendChild(empty);
            return;
        }

        const countNote = document.createElement('div');
        countNote.style.cssText = 'font-size:12px;color:#6c757d;margin-bottom:8px;';
        countNote.textContent = `Showing ${cases.length} case${cases.length === 1 ? '' : 's'} (sorted by violation count, highest first)`;
        container.appendChild(countNote);

        const list = document.createElement('div');
        list.style.cssText = 'border:1px solid #dee2e6;border-radius:8px;overflow:hidden;';

        cases.forEach((c, idx) => {
            list.appendChild(this._buildCaseRow(c, idx));
        });

        container.appendChild(list);
    }

    _buildCaseRow(c, idx) {
        const converged = c.converged !== false;
        const violations = c.violations || [];
        const violationCount = violations.length;
        const key = c.name || String(idx);
        const expanded = this._expandedKeys.has(key);

        const isConvergenceFailure = !converged && violations.some(v => v.type === 'convergence');
        let statusText = 'Converged';
        let statusColor = '#198754';
        let statusBg = '#d1e7dd';
        if (!converged) {
            statusText = isConvergenceFailure ? 'Non-convergent' : 'Failed';
            statusColor = '#dc3545';
            statusBg = '#f8d7da';
        }

        const wrap = document.createElement('div');
        wrap.style.cssText = `border-bottom:1px solid #eee;background:${violationCount > 0 && converged ? '#fffbf0' : '#fff'};`;

        const row = document.createElement('div');
        row.style.cssText = `
            display: grid; grid-template-columns: 32px 1fr auto auto auto;
            gap: 12px; align-items: center; padding: 10px 14px; cursor: ${violationCount || !converged ? 'pointer' : 'default'};
        `;

        const chevron = document.createElement('span');
        chevron.textContent = violationCount || !converged ? (expanded ? '\u25bc' : '\u25b6') : '';
        chevron.style.cssText = 'color:#6c757d;font-size:10px;width:16px;text-align:center;';
        row.appendChild(chevron);

        const main = document.createElement('div');
        main.innerHTML = `
            <div style="font-weight:600;font-size:13px;color:#212529;">${this._escape(this._friendlyName(c.name))}</div>
            <div style="font-size:12px;color:#6c757d;margin-top:2px;">${this._escape(c.description || '')}</div>
        `;
        row.appendChild(main);

        const badge = document.createElement('span');
        badge.textContent = violationCount;
        badge.title = 'Violations';
        badge.style.cssText = `
            min-width:28px;text-align:center;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:600;
            background:${violationCount === 0 ? '#d1e7dd' : violationCount >= 10 ? '#f8d7da' : '#fff3cd'};
            color:${violationCount === 0 ? '#0f5132' : violationCount >= 10 ? '#842029' : '#664d03'};
        `;
        row.appendChild(badge);

        const status = document.createElement('span');
        status.textContent = statusText;
        status.style.cssText = `
            font-size:11px;font-weight:600;padding:4px 10px;border-radius:12px;
            color:${statusColor};background:${statusBg};white-space:nowrap;
        `;
        row.appendChild(status);

        const summaryHint = document.createElement('span');
        summaryHint.style.cssText = 'font-size:11px;color:#6c757d;max-width:200px;text-align:right;';
        if (!converged) {
            summaryHint.textContent = c.error ? String(c.error).slice(0, 60) + (String(c.error).length > 60 ? '…' : '') : 'Did not converge';
        } else if (violationCount === 0) {
            summaryHint.textContent = 'OK';
            summaryHint.style.color = '#198754';
        } else {
            const groups = this._groupViolations(violations);
            summaryHint.textContent = Object.entries(groups).map(([t, arr]) => `${arr.length} ${t}`).join(', ');
        }
        row.appendChild(summaryHint);

        if (violationCount || !converged) {
            row.onclick = () => {
                if (expanded) this._expandedKeys.delete(key);
                else this._expandedKeys.add(key);
                if (this._casesSection) this._renderContingencyCases(this._casesSection);
            };
        }

        wrap.appendChild(row);

        if (expanded) {
            wrap.appendChild(this._buildViolationPanel(c, violations, converged));
        }

        return wrap;
    }

    _buildViolationPanel(c, violations, converged) {
        const panel = document.createElement('div');
        panel.style.cssText = 'padding:0 14px 14px 46px;background:#fafbfc;border-top:1px solid #f0f0f0;';

        if (!converged) {
            const err = document.createElement('div');
            err.style.cssText = 'padding:10px;background:#f8d7da;border-radius:6px;font-size:12px;color:#842029;';
            err.textContent = c.error || 'Power flow did not converge for this outage.';
            panel.appendChild(err);
            return panel;
        }

        if (!violations.length) {
            panel.innerHTML = '<div style="font-size:12px;color:#198754;padding:8px 0;">No limit violations detected.</div>';
            return panel;
        }

        const groups = this._groupViolations(violations);
        Object.entries(groups).forEach(([type, items]) => {
            const title = document.createElement('div');
            title.style.cssText = 'font-size:12px;font-weight:600;color:#495057;margin:12px 0 6px 0;text-transform:capitalize;';
            title.textContent = `${type} violations (${items.length})`;
            panel.appendChild(title);

            const table = document.createElement('table');
            table.style.cssText = 'width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px;';
            table.innerHTML = `
                <tr style="background:#f1f3f5;">
                    <th style="padding:6px 8px;text-align:left;border:1px solid #dee2e6;">Element</th>
                    <th style="padding:6px 8px;text-align:left;border:1px solid #dee2e6;">Description</th>
                    <th style="padding:6px 8px;text-align:center;border:1px solid #dee2e6;width:70px;">Severity</th>
                </tr>
            `;

            const maxRows = 25;
            items.slice(0, maxRows).forEach(v => {
                const tr = document.createElement('tr');
                const sev = v.severity || 'medium';
                const sevColor = sev === 'high' ? '#dc3545' : '#fd7e14';
                tr.innerHTML = `
                    <td style="padding:5px 8px;border:1px solid #dee2e6;">${this._escape(this._friendlyName(v.element))}</td>
                    <td style="padding:5px 8px;border:1px solid #dee2e6;">${this._escape(v.description || '')}</td>
                    <td style="padding:5px 8px;border:1px solid #dee2e6;text-align:center;color:${sevColor};font-weight:600;">${this._escape(sev)}</td>
                `;
                table.appendChild(tr);
            });
            panel.appendChild(table);

            if (items.length > maxRows) {
                const more = document.createElement('div');
                more.style.cssText = 'font-size:11px;color:#6c757d;font-style:italic;margin-bottom:8px;';
                more.textContent = `… and ${items.length - maxRows} more ${type} violations (see CSV export for full list)`;
                panel.appendChild(more);
            }
        });

        return panel;
    }

    _groupViolations(violations) {
        const groups = { voltage: [], thermal: [], other: [] };
        violations.forEach(v => {
            const t = (v.type || 'other').toLowerCase();
            if (t === 'voltage') groups.voltage.push(v);
            else if (t === 'thermal') groups.thermal.push(v);
            else groups.other.push(v);
        });
        if (!groups.other.length) delete groups.other;
        return groups;
    }

    _friendlyName(raw) {
        if (!raw) return '?';
        return String(raw)
            .replace(/^Line_/, 'Line ')
            .replace(/^Bus_/, 'Bus ')
            .replace(/^Trafo_/, 'Transformer ')
            .replace(/^Gen_/, 'Generator ')
            .replace(/_/g, ' ');
    }

    _getWorstCase() {
        const cases = this.results.contingency_results || [];
        if (!cases.length) return null;
        return cases.reduce((best, c) => {
            const count = (c.violations || []).length;
            const bestCount = (best.violations || []).length;
            if (count > bestCount) return c;
            if (count === bestCount && count > 0) {
                return String(c.name || '').localeCompare(String(best.name || '')) < 0 ? c : best;
            }
            return best;
        }, cases[0]);
    }

    _buildViolationLookup(violations) {
        const map = new Map();
        (violations || []).forEach(v => {
            const el = String(v.element || '');
            let kind = 'other';
            if (/^Bus_/i.test(el)) kind = 'bus';
            else if (/^Line_/i.test(el)) kind = 'line';
            else if (/^Trafo_/i.test(el)) kind = 'transformer';
            const rawName = el.replace(/^(Bus|Line|Trafo|Gen)_/i, '');
            map.set(this._violationKey(kind, rawName), v);
        });
        return map;
    }

    _violationKey(kind, name) {
        return `${kind}:${String(name || '').trim().toLowerCase()}`;
    }

    _renderWorstCaseDetails(container) {
        const buses = this.results.bus || [];
        const lines = this.results.line || [];
        const trafos = this.results.transformer || [];
        if (!buses.length && !lines.length && !trafos.length) return;

        const worstCase = this._getWorstCase();
        const worstViolations = (worstCase?.violations || []).filter(v => {
            const t = (v.type || '').toLowerCase();
            return t === 'voltage' || t === 'thermal';
        });
        const violationLookup = this._buildViolationLookup(worstViolations);

        const details = document.createElement('details');
        details.style.cssText = 'margin-top:20px;border:1px solid #dee2e6;border-radius:8px;padding:0;';
        details.open = false;

        const summary = document.createElement('summary');
        summary.style.cssText = `
            padding: 12px 16px; cursor: pointer; font-weight: 600; font-size: 14px;
            background: #f8f9fa; border-radius: 8px; user-select: none;
        `;
        const worstCount = worstViolations.length;
        summary.textContent = worstCount
            ? `Worst-case network snapshot (${worstCount} violation${worstCount === 1 ? '' : 's'})`
            : 'Worst-case network snapshot (highest violation count)';
        details.appendChild(summary);

        const inner = document.createElement('div');
        inner.style.cssText = 'padding: 12px 16px 16px;';

        if (worstCase) {
            inner.appendChild(this._buildWorstCaseBanner(worstCase, worstViolations));
        }

        inner.appendChild(this._buildWorstCaseHelp(worstViolations.length > 0));

        if (worstViolations.length) {
            inner.appendChild(this._buildWorstCaseLegend());
        }

        if (buses.length) {
            inner.appendChild(this._buildTable(
                'Buses',
                'Voltage magnitude and angle at each bus after the outage. P and Q are net injection (+ = generation, − = load).',
                ['Name', 'V [pu]', 'θ [deg]', 'P [MW]', 'Q [Mvar]'],
                ['Element', 'Voltage magnitude in per unit (1.0 = nominal)', 'Voltage angle', 'Active power', 'Reactive power'],
                buses.map(b => {
                    const hit = violationLookup.get(this._violationKey('bus', b.name));
                    return {
                        cells: [
                            this._friendlyName(b.name),
                            this._fmt(b.vm_pu),
                            this._fmt(b.va_degree),
                            this._fmt(b.p_mw),
                            this._fmt(b.q_mvar)
                        ],
                        highlight: hit ? 'voltage' : null,
                        title: hit?.description || ''
                    };
                })
            ));
        }
        if (lines.length) {
            inner.appendChild(this._buildTable(
                'Lines',
                'Loading compares current flow to the line thermal rating. Values above your maximum loading limit are violations.',
                ['Name', 'Loading [%]', 'P from [MW]', 'Q from [Mvar]'],
                ['Element', 'Percent of thermal rating', 'Active power at from bus', 'Reactive power at from bus'],
                lines.map(l => {
                    const hit = violationLookup.get(this._violationKey('line', l.name));
                    return {
                        cells: [
                            this._friendlyName(l.name),
                            this._fmt(l.loading_percent),
                            this._fmt(l.p_from_mw),
                            this._fmt(l.q_from_mvar)
                        ],
                        highlight: hit ? 'thermal' : null,
                        title: hit?.description || ''
                    };
                })
            ));
        }
        if (trafos.length) {
            inner.appendChild(this._buildTable(
                'Transformers',
                'Loading on the HV side relative to rated MVA. Values above your maximum loading limit are violations.',
                ['Name', 'Loading [%]', 'P HV [MW]', 'Q HV [Mvar]'],
                ['Element', 'Percent of rated MVA', 'Active power at HV bus', 'Reactive power at HV bus'],
                trafos.map(t => {
                    const hit = violationLookup.get(this._violationKey('transformer', t.name));
                    return {
                        cells: [
                            this._friendlyName(t.name),
                            this._fmt(t.loading_percent),
                            this._fmt(t.p_hv_mw),
                            this._fmt(t.q_hv_mvar)
                        ],
                        highlight: hit ? 'thermal' : null,
                        title: hit?.description || ''
                    };
                })
            ));
        }

        details.appendChild(inner);
        container.appendChild(details);
    }

    _buildWorstCaseBanner(worstCase, worstViolations) {
        const banner = document.createElement('div');
        banner.style.cssText = `
            padding: 12px 14px; margin-bottom: 12px; border-radius: 8px;
            background: ${worstViolations.length ? '#fff3cd' : '#d1e7dd'};
            border: 1px solid ${worstViolations.length ? '#ffecb5' : '#badbcc'};
        `;

        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 600; font-size: 13px; color: #212529; margin-bottom: 4px;';
        title.textContent = `Simulated outage: ${this._friendlyName(worstCase.name)}`;
        banner.appendChild(title);

        if (worstCase.description) {
            const desc = document.createElement('div');
            desc.style.cssText = 'font-size: 12px; color: #495057; margin-bottom: 6px;';
            desc.textContent = worstCase.description;
            banner.appendChild(desc);
        }

        const meta = document.createElement('div');
        meta.style.cssText = 'font-size: 12px; color: #495057;';
        const converged = worstCase.converged !== false;
        const groups = this._groupViolations(worstViolations);
        const parts = [];
        if (worstViolations.length) {
            parts.push(`${worstViolations.length} limit violation${worstViolations.length === 1 ? '' : 's'}`);
            const breakdown = Object.entries(groups).map(([t, arr]) => `${arr.length} ${t}`);
            if (breakdown.length) parts.push(breakdown.join(', '));
        } else {
            parts.push('No limit violations in this case');
        }
        parts.push(converged ? 'Load flow converged' : 'Load flow did not converge');
        meta.textContent = parts.join(' · ');
        banner.appendChild(meta);

        return banner;
    }

    _buildWorstCaseHelp(hasViolations) {
        const box = document.createElement('div');
        box.style.cssText = `
            font-size: 12px; color: #495057; line-height: 1.55;
            padding: 12px 14px; margin-bottom: 12px; border-radius: 8px;
            background: #f8f9fa; border: 1px solid #e9ecef;
        `;
        box.innerHTML = `
            <div style="font-weight:600;margin-bottom:6px;color:#343a40;">What am I looking at?</div>
            <p style="margin:0 0 8px 0;">
                Electrisim tested many single-element outages (N-1). This section shows the
                <strong>post-outage load-flow state</strong> for the case with the most limit violations —
                i.e. how voltages and flows looked on the remaining network after that one element was removed.
            </p>
            <p style="margin:0 0 8px 0;">
                The same numbers are applied to your diagram on the canvas (bus colours and line/transformer labels).
                Expand a case in the list above to see the same violation details for any other outage.
            </p>
            ${hasViolations ? `<p style="margin:0;color:#664d03;">
                Rows highlighted below are elements that exceeded your configured voltage or loading limits during this outage.
            </p>` : `<p style="margin:0;">
                No elements exceeded limits in this snapshot; tables show the full network state for reference.
            </p>`}
        `;
        return box;
    }

    _buildWorstCaseLegend() {
        const legend = document.createElement('div');
        legend.style.cssText = `
            display: flex; flex-wrap: wrap; gap: 12px 20px; font-size: 11px; color: #495057;
            margin-bottom: 12px; padding: 8px 10px; background: #fff; border: 1px solid #e9ecef; border-radius: 6px;
        `;
        legend.innerHTML = `
            <span><span style="display:inline-block;width:12px;height:12px;background:#f8d7da;border:1px solid #f1aeb5;border-radius:2px;vertical-align:middle;margin-right:4px;"></span> Voltage limit exceeded</span>
            <span><span style="display:inline-block;width:12px;height:12px;background:#fff3cd;border:1px solid #ffecb5;border-radius:2px;vertical-align:middle;margin-right:4px;"></span> Thermal loading limit exceeded</span>
        `;
        return legend;
    }

    _buildTable(caption, captionHelp, headers, headerTitles, rows) {
        const wrap = document.createElement('div');
        wrap.style.marginBottom = '14px';
        const cap = document.createElement('div');
        cap.style.cssText = 'font-weight:600;margin:8px 0 4px 0;color:#343a40;font-size:13px;';
        cap.textContent = caption;
        wrap.appendChild(cap);

        if (captionHelp) {
            const help = document.createElement('div');
            help.style.cssText = 'font-size:11px;color:#6c757d;margin:0 0 6px 0;line-height:1.45;';
            help.textContent = captionHelp;
            wrap.appendChild(help);
        }

        const scroll = document.createElement('div');
        scroll.style.cssText = 'max-height:220px;overflow:auto;border:1px solid #dee2e6;border-radius:6px;';

        const table = document.createElement('table');
        table.style.cssText = 'border-collapse:collapse;width:100%;font-size:12px;';
        const headRow = document.createElement('tr');
        headRow.style.background = '#f5f5f5';
        headRow.style.position = 'sticky';
        headRow.style.top = '0';
        headers.forEach((h, i) => {
            const th = document.createElement('th');
            th.style.cssText = 'border-bottom:1px solid #dee2e6;padding:8px;text-align:left;background:#f5f5f5;';
            th.textContent = h;
            if (headerTitles && headerTitles[i]) {
                th.title = headerTitles[i];
            }
            headRow.appendChild(th);
        });
        table.appendChild(headRow);

        rows.forEach(row => {
            const cols = row.cells || row;
            const highlight = row.highlight || null;
            const rowTitle = row.title || '';
            const tr = document.createElement('tr');
            if (highlight === 'voltage') {
                tr.style.background = '#f8d7da';
            } else if (highlight === 'thermal') {
                tr.style.background = '#fff3cd';
            }
            if (rowTitle) tr.title = rowTitle;

            cols.forEach((val, i) => {
                const td = document.createElement('td');
                td.style.cssText = `border-bottom:1px solid #f0f0f0;padding:6px 8px;${i > 0 ? 'text-align:right;' : ''}`;
                if (i > 0 && highlight === 'voltage' && headers[i] === 'V [pu]') {
                    td.style.fontWeight = '600';
                    td.style.color = '#842029';
                }
                if (i > 0 && highlight === 'thermal' && headers[i] === 'Loading [%]') {
                    td.style.fontWeight = '600';
                    td.style.color = '#664d03';
                }
                td.textContent = val ?? '—';
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });

        scroll.appendChild(table);
        wrap.appendChild(scroll);
        return wrap;
    }

    _downloadCSV() {
        const cases = this.results.contingency_results || [];
        const lines = ['Case,Outage,Status,Violations,Violation summary'];
        cases.forEach(c => {
            const converged = c.converged !== false;
            const violationCount = (c.violations || []).length;
            const isConv = !converged && (c.violations || []).some(v => v.type === 'convergence');
            const status = converged ? 'Converged' : (isConv ? 'Non-convergent' : 'Failed');
            let detail = 'OK';
            if (!converged) detail = c.error || 'Non-convergent';
            else if (violationCount) {
                const g = this._groupViolations(c.violations);
                detail = Object.entries(g).map(([t, arr]) =>
                    `${t}: ${arr.map(v => `${v.element} (${v.description})`).join(' | ')}`
                ).join(' ; ');
            }
            lines.push([
                this._csv(c.name),
                this._csv(c.description),
                status,
                violationCount,
                this._csv(detail)
            ].join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contingency_results.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    _csv(val) {
        const s = String(val ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }

    _escape(val) {
        return String(val ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _fmt(val) {
        if (val == null || val === '' || Number.isNaN(Number(val))) return '—';
        const n = Number(val);
        return Math.abs(n) >= 100 ? n.toFixed(1) : n.toFixed(3);
    }

    _safe(val) {
        return val == null ? '—' : val;
    }
}

if (typeof window !== 'undefined') {
    window.ContingencyResultsDialog = ContingencyResultsDialog;
}

export default ContingencyResultsDialog;
