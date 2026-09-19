import { DIALOG_STYLES, attachBackdropCloseHandler } from './utils/dialogStyles.js';

const CONTACT_EMAIL = 'electrisim@electrisim.com';

function closeOverlay(overlay) {
    if (overlay && document.body.contains(overlay)) {
        document.body.removeChild(overlay);
    }
}

export function showSimulateOtherFeatureModal() {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, DIALOG_STYLES.overlay);

    const panel = document.createElement('div');
    Object.assign(panel.style, {
        ...DIALOG_STYLES.container,
        maxWidth: '520px',
        width: '92%',
        padding: '24px',
        boxSizing: 'border-box'
    });

    const title = document.createElement('h2');
    Object.assign(title.style, {
        ...DIALOG_STYLES.header,
        fontSize: '20px',
        margin: '0 0 12px 0',
        textAlign: 'left'
    });
    title.textContent = 'Other simulation or feature';

    const message = document.createElement('p');
    Object.assign(message.style, {
        ...DIALOG_STYLES.info,
        margin: '0 0 16px 0',
        lineHeight: '1.55'
    });
    message.textContent =
        'If you need another type of simulation or a feature that is not listed in Simulate yet, ' +
        'please email us — we can prioritize adding it to Electrisim.';

    const emailLink = document.createElement('a');
    emailLink.href = `mailto:${CONTACT_EMAIL}`;
    emailLink.textContent = CONTACT_EMAIL;
    Object.assign(emailLink.style, {
        display: 'inline-block',
        fontSize: '16px',
        fontWeight: '600',
        color: '#007bff',
        textDecoration: 'none',
        marginBottom: '20px'
    });
    emailLink.addEventListener('mouseenter', () => {
        emailLink.style.textDecoration = 'underline';
    });
    emailLink.addEventListener('mouseleave', () => {
        emailLink.style.textDecoration = 'none';
    });

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    Object.assign(closeButton.style, {
        padding: '8px 20px',
        backgroundColor: '#007bff',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        fontSize: '14px',
        cursor: 'pointer',
        float: 'right'
    });
    closeButton.addEventListener('click', () => closeOverlay(overlay));

    panel.appendChild(title);
    panel.appendChild(message);
    panel.appendChild(emailLink);
    panel.appendChild(closeButton);
    overlay.appendChild(panel);

    attachBackdropCloseHandler(overlay, panel, () => closeOverlay(overlay));
    document.body.appendChild(overlay);
}

export function simulateOtherFeatureRequest() {
    showSimulateOtherFeatureModal();
}

if (typeof window !== 'undefined') {
    window.simulateOtherFeatureRequest = simulateOtherFeatureRequest;
    window.showSimulateOtherFeatureModal = showSimulateOtherFeatureModal;
}

export default simulateOtherFeatureRequest;
