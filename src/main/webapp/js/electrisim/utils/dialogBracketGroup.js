/**
 * Visual grouping for related form fields (matches Load Flow "Include controller" styling).
 * @param {string} [title] - Optional section heading inside the box
 * @returns {HTMLDivElement}
 */
export function createDialogBracketGroup(title) {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-dialog-bracket-group', 'true');
    Object.assign(wrap.style, {
        boxSizing: 'border-box',
        border: '1px solid #dee2e6',
        borderLeft: '4px solid #007bff',
        borderRadius: '6px',
        padding: '12px 14px 14px',
        marginBottom: '4px',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    });
    if (title) {
        const h = document.createElement('div');
        Object.assign(h.style, {
            margin: '0',
            paddingBottom: '2px',
            fontWeight: '600',
            fontSize: '13px',
            color: '#343a40',
            borderBottom: '1px solid #e9ecef'
        });
        h.textContent = title;
        wrap.appendChild(h);
    }
    return wrap;
}
