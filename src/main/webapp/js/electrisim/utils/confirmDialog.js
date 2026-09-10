/**
 * Styled confirmation dialog — replaces native window.confirm for Electrisim UX.
 */
import { STUDY_MODAL_OVERLAY_STYLE } from './dialogStyles.js';

const VARIANTS = {
    warning: {
        accent: '#f59e0b',
        accentSoft: '#fffbeb',
        accentBorder: '#fcd34d',
        icon: '⚠',
        confirmBg: '#d97706',
        confirmHover: '#b45309'
    },
    danger: {
        accent: '#dc2626',
        accentSoft: '#fef2f2',
        accentBorder: '#fca5a5',
        icon: '✕',
        confirmBg: '#dc2626',
        confirmHover: '#b91c1c'
    },
    info: {
        accent: '#2563eb',
        accentSoft: '#eff6ff',
        accentBorder: '#93c5fd',
        icon: 'ℹ',
        confirmBg: '#2563eb',
        confirmHover: '#1d4ed8'
    }
};

/**
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.message]
 * @param {string} [options.footerHint]
 * @param {'warning'|'danger'|'info'} [options.variant]
 * @param {Array<string|{text:string}>} [options.items]
 * @param {string} [options.confirmLabel]
 * @param {string} [options.cancelLabel]
 * @returns {Promise<boolean>} true if confirmed
 */
export function showConfirmDialog(options = {}) {
    const {
        title = 'Confirm',
        message = '',
        footerHint = '',
        variant = 'warning',
        items = [],
        confirmLabel = 'Continue',
        cancelLabel = 'Cancel'
    } = options;

    const theme = VARIANTS[variant] || VARIANTS.warning;

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            ...STUDY_MODAL_OVERLAY_STYLE,
            // Above simulation progress overlay (2000000001) when both could appear
            zIndex: '2000000010'
        });

        const panel = document.createElement('div');
        Object.assign(panel.style, {
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 20px 48px rgba(15, 23, 42, 0.18)',
            width: 'min(520px, 94vw)',
            maxWidth: '94vw',
            overflow: 'hidden',
            fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif',
            animation: 'electrisimConfirmIn 0.18s ease-out'
        });

        if (!document.getElementById('electrisim-confirm-keyframes')) {
            const style = document.createElement('style');
            style.id = 'electrisim-confirm-keyframes';
            style.textContent = `
                @keyframes electrisimConfirmIn {
                    from { opacity: 0; transform: translateY(8px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            padding: '20px 22px 16px',
            borderBottom: '1px solid #f1f5f9',
            background: `linear-gradient(135deg, ${theme.accentSoft} 0%, #ffffff 70%)`
        });

        const iconWrap = document.createElement('div');
        Object.assign(iconWrap.style, {
            flexShrink: '0',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: theme.accentSoft,
            border: `1px solid ${theme.accentBorder}`,
            color: theme.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: '700',
            lineHeight: '1'
        });
        iconWrap.textContent = theme.icon;

        const titleEl = document.createElement('h2');
        Object.assign(titleEl.style, {
            margin: '0',
            paddingTop: '6px',
            fontSize: '18px',
            fontWeight: '700',
            color: '#0f172a',
            lineHeight: '1.3'
        });
        titleEl.textContent = title;

        header.appendChild(iconWrap);
        header.appendChild(titleEl);

        const body = document.createElement('div');
        Object.assign(body.style, {
            padding: '18px 22px 8px',
            color: '#334155',
            fontSize: '14px',
            lineHeight: '1.55'
        });

        if (message) {
            const msg = document.createElement('p');
            Object.assign(msg.style, { margin: '0 0 14px' });
            msg.textContent = message;
            body.appendChild(msg);
        }

        if (items.length) {
            const listWrap = document.createElement('div');
            Object.assign(listWrap.style, {
                backgroundColor: theme.accentSoft,
                border: `1px solid ${theme.accentBorder}`,
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '12px',
                maxHeight: '220px',
                overflowY: 'auto'
            });
            const ul = document.createElement('ul');
            Object.assign(ul.style, {
                margin: '0',
                padding: '0 0 0 18px',
                listStyle: 'disc'
            });
            items.forEach((item) => {
                const li = document.createElement('li');
                Object.assign(li.style, {
                    marginBottom: '8px',
                    fontSize: '13px',
                    lineHeight: '1.45',
                    color: '#1e293b'
                });
                li.textContent = typeof item === 'string' ? item : item.text;
                ul.appendChild(li);
            });
            listWrap.appendChild(ul);
            body.appendChild(listWrap);
        }

        if (footerHint) {
            const hint = document.createElement('p');
            Object.assign(hint.style, {
                margin: '0 0 4px',
                fontSize: '13px',
                color: '#64748b',
                fontStyle: 'italic'
            });
            hint.textContent = footerHint;
            body.appendChild(hint);
        }

        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '16px 22px 20px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#fafafa'
        });

        const btnBase = {
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: '600',
            borderRadius: '8px',
            cursor: 'pointer',
            border: 'none',
            lineHeight: '1.2',
            transition: 'background-color 0.15s ease, box-shadow 0.15s ease'
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        Object.assign(cancelBtn.style, {
            ...btnBase,
            backgroundColor: '#ffffff',
            color: '#475569',
            border: '1px solid #cbd5e1'
        });
        cancelBtn.textContent = cancelLabel;

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        Object.assign(confirmBtn.style, {
            ...btnBase,
            backgroundColor: theme.confirmBg,
            color: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
        });
        confirmBtn.textContent = confirmLabel;

        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.backgroundColor = theme.confirmHover;
        });
        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.backgroundColor = theme.confirmBg;
        });
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.backgroundColor = '#f8fafc';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.backgroundColor = '#ffffff';
        });

        let settled = false;
        const close = (confirmed) => {
            if (settled) return;
            settled = true;
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            resolve(confirmed);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close(false);
            } else if (e.key === 'Enter' && document.activeElement === confirmBtn) {
                e.preventDefault();
                close(true);
            }
        };

        cancelBtn.onclick = () => close(false);
        confirmBtn.onclick = () => close(true);
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) close(false);
        });

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);
        panel.appendChild(header);
        panel.appendChild(body);
        panel.appendChild(footer);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        document.addEventListener('keydown', onKey);
        cancelBtn.focus();
    });
}
