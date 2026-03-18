/**
 * Shared helper for Economic tab in element dialogs.
 * Renders a currency dropdown with a single cost input.
 * Values are stored per currency. Default currency from user locale.
 */

// ISO 4217 currency codes - worldwide list (common currencies first)
const WORLD_CURRENCIES = [
    { code: 'EUR', name: 'Euro (EUR)' },
    { code: 'USD', name: 'US Dollar (USD)' },
    { code: 'GBP', name: 'British Pound (GBP)' },
    { code: 'JPY', name: 'Japanese Yen (JPY)' },
    { code: 'CNY', name: 'Chinese Yuan (CNY)' },
    { code: 'CHF', name: 'Swiss Franc (CHF)' },
    { code: 'CAD', name: 'Canadian Dollar (CAD)' },
    { code: 'AUD', name: 'Australian Dollar (AUD)' },
    { code: 'INR', name: 'Indian Rupee (INR)' },
    { code: 'BRL', name: 'Brazilian Real (BRL)' },
    { code: 'MXN', name: 'Mexican Peso (MXN)' },
    { code: 'KRW', name: 'South Korean Won (KRW)' },
    { code: 'PLN', name: 'Polish Złoty (PLN)' },
    { code: 'SEK', name: 'Swedish Krona (SEK)' },
    { code: 'NOK', name: 'Norwegian Krone (NOK)' },
    { code: 'DKK', name: 'Danish Krone (DKK)' },
    { code: 'CZK', name: 'Czech Koruna (CZK)' },
    { code: 'HUF', name: 'Hungarian Forint (HUF)' },
    { code: 'RON', name: 'Romanian Leu (RON)' },
    { code: 'BGN', name: 'Bulgarian Lev (BGN)' },
    { code: 'TRY', name: 'Turkish Lira (TRY)' },
    { code: 'RUB', name: 'Russian Ruble (RUB)' },
    { code: 'ZAR', name: 'South African Rand (ZAR)' },
    { code: 'SGD', name: 'Singapore Dollar (SGD)' },
    { code: 'HKD', name: 'Hong Kong Dollar (HKD)' },
    { code: 'NZD', name: 'New Zealand Dollar (NZD)' },
    { code: 'THB', name: 'Thai Baht (THB)' },
    { code: 'IDR', name: 'Indonesian Rupiah (IDR)' },
    { code: 'MYR', name: 'Malaysian Ringgit (MYR)' },
    { code: 'PHP', name: 'Philippine Peso (PHP)' },
    { code: 'AED', name: 'UAE Dirham (AED)' },
    { code: 'SAR', name: 'Saudi Riyal (SAR)' },
    { code: 'ILS', name: 'Israeli Shekel (ILS)' },
    { code: 'EGP', name: 'Egyptian Pound (EGP)' },
    { code: 'NGN', name: 'Nigerian Naira (NGN)' },
    { code: 'ARS', name: 'Argentine Peso (ARS)' },
    { code: 'CLP', name: 'Chilean Peso (CLP)' },
    { code: 'COP', name: 'Colombian Peso (COP)' },
    { code: 'PEN', name: 'Peruvian Sol (PEN)' },
    { code: 'VND', name: 'Vietnamese Dong (VND)' },
    { code: 'TWD', name: 'Taiwan Dollar (TWD)' }
];

/** Map locale (language tag) to default currency code */
const LOCALE_TO_CURRENCY = {
    'en-US': 'USD', 'en': 'USD',
    'en-GB': 'GBP', 'en-AU': 'AUD', 'en-CA': 'CAD', 'en-IN': 'INR', 'en-NZ': 'NZD', 'en-ZA': 'ZAR', 'en-SG': 'SGD', 'en-HK': 'HKD',
    'de': 'EUR', 'de-DE': 'EUR', 'de-AT': 'EUR', 'de-CH': 'CHF',
    'fr': 'EUR', 'fr-FR': 'EUR', 'fr-CA': 'CAD', 'fr-CH': 'CHF', 'fr-BE': 'EUR',
    'es': 'EUR', 'es-ES': 'EUR', 'es-MX': 'MXN', 'es-AR': 'ARS', 'es-CO': 'COP', 'es-CL': 'CLP', 'es-PE': 'PEN',
    'it': 'EUR', 'it-IT': 'EUR', 'it-CH': 'CHF',
    'pt': 'EUR', 'pt-PT': 'EUR', 'pt-BR': 'BRL',
    'pl': 'PLN', 'pl-PL': 'PLN',
    'nl': 'EUR', 'nl-NL': 'EUR', 'nl-BE': 'EUR',
    'sv': 'SEK', 'sv-SE': 'SEK',
    'no': 'NOK', 'nb': 'NOK', 'nb-NO': 'NOK',
    'da': 'DKK', 'da-DK': 'DKK',
    'cs': 'CZK', 'cs-CZ': 'CZK',
    'hu': 'HUF', 'hu-HU': 'HUF',
    'ro': 'RON', 'ro-RO': 'RON',
    'bg': 'BGN', 'bg-BG': 'BGN',
    'tr': 'TRY', 'tr-TR': 'TRY',
    'ru': 'RUB', 'ru-RU': 'RUB',
    'zh': 'CNY', 'zh-CN': 'CNY', 'zh-TW': 'TWD', 'zh-HK': 'HKD',
    'ja': 'JPY', 'ja-JP': 'JPY',
    'ko': 'KRW', 'ko-KR': 'KRW',
    'th': 'THB', 'th-TH': 'THB',
    'id': 'IDR', 'id-ID': 'IDR',
    'ms': 'MYR', 'ms-MY': 'MYR',
    'fil': 'PHP', 'tl': 'PHP',
    'ar': 'SAR', 'ar-SA': 'SAR', 'ar-AE': 'AED', 'ar-EG': 'EGP',
    'he': 'ILS', 'he-IL': 'ILS',
    'hi': 'INR', 'hi-IN': 'INR',
    'vi': 'VND', 'vi-VN': 'VND'
};

/**
 * Get currency options for select/dropdown (e.g. Economic Analysis Display Currency)
 * @returns {Array<{value: string, label: string, default?: boolean}>}
 */
export function getCurrencyOptionsForSelect() {
    const defaultCc = getDefaultCurrencyFromLocale();
    return WORLD_CURRENCIES.map(c => ({
        value: c.code,
        label: c.name,
        default: c.code === defaultCc
    }));
}

/**
 * Get default currency from user's locale (navigator.language)
 * @returns {string} ISO 4217 currency code (e.g. 'EUR', 'USD', 'PLN')
 */
export function getDefaultCurrencyFromLocale() {
    try {
        const locale = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en';
        const normalized = locale.split('-')[0];
        return LOCALE_TO_CURRENCY[locale] || LOCALE_TO_CURRENCY[normalized] || 'EUR';
    } catch {
        return 'EUR';
    }
}

/**
 * Build cost_per_unit_by_currency from data
 * @param {Object} data - Element data
 * @returns {Object} { [currencyCode]: number }
 */
export function buildCostPerUnitByCurrency(data) {
    const obj = {};
    if (data.cost_per_unit_by_currency != null && data.cost_per_unit_by_currency !== '') {
        try {
            const parsed = typeof data.cost_per_unit_by_currency === 'string'
                ? JSON.parse(data.cost_per_unit_by_currency) : data.cost_per_unit_by_currency;
            if (parsed && typeof parsed === 'object') {
                Object.assign(obj, parsed);
            } else if (typeof parsed === 'number' && !isNaN(parsed)) {
                obj[getDefaultCurrencyFromLocale()] = parsed;
            }
        } catch (_) {
            const num = parseFloat(data.cost_per_unit_by_currency);
            if (!isNaN(num)) obj[getDefaultCurrencyFromLocale()] = num;
        }
    }
    return obj;
}

/**
 * Create Economic tab content with currency dropdown
 * @param {Object} costPerUnitByCurrency - { [currencyCode]: number } - built from data via buildCostPerUnitByCurrency
 * @param {Map} inputsMap - Dialog's inputs Map to register hidden inputs for getFormValues
 * @param {boolean} isActive - Whether this tab is currently visible
 * @returns {HTMLDivElement} Content container
 */
export function createEconomicTabContent(costPerUnitByCurrency, inputsMap, isActive = false) {
    const content = document.createElement('div');
    content.dataset.tab = 'economic';
    Object.assign(content.style, {
        display: isActive ? 'flex' : 'none',
        flexDirection: 'column',
        gap: '16px'
    });

    const defaultCurrency = getDefaultCurrencyFromLocale();
    let activeCurrency = defaultCurrency;
    if (!WORLD_CURRENCIES.find(c => c.code === activeCurrency)) {
        activeCurrency = 'EUR';
    }

    const costState = { ...costPerUnitByCurrency };

    const toggleRow = document.createElement('div');
    Object.assign(toggleRow.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '8px'
    });

    const label = document.createElement('label');
    Object.assign(label.style, {
        fontWeight: '600',
        fontSize: '14px',
        color: '#495057',
        lineHeight: '1.2'
    });
    label.textContent = 'Cost per unit for Economic Analysis CAPEX calculation';

    const description = document.createElement('div');
    Object.assign(description.style, {
        fontSize: '12px',
        color: '#6c757d',
        lineHeight: '1.4',
        fontStyle: 'italic',
        marginBottom: '8px'
    });
    description.textContent = 'Select currency and enter cost. Values are stored per currency.';

    const select = document.createElement('select');
    WORLD_CURRENCIES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = c.name;
        if (c.code === activeCurrency) opt.selected = true;
        select.appendChild(opt);
    });
    Object.assign(select.style, {
        width: '220px',
        padding: '10px 14px',
        border: '2px solid #ced4da',
        borderRadius: '6px',
        fontSize: '14px',
        fontFamily: 'inherit',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
        cursor: 'pointer',
        outline: 'none'
    });
    select.addEventListener('focus', () => {
        select.style.borderColor = '#007bff';
        select.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.15)';
    });
    select.addEventListener('blur', () => {
        select.style.borderColor = '#ced4da';
        select.style.boxShadow = 'none';
    });

    const costInput = document.createElement('input');
    costInput.type = 'number';
    costInput.step = '0.01';
    costInput.min = '0';
    const currentVal = costState[activeCurrency];
    costInput.value = (currentVal != null ? parseFloat(currentVal) : 0).toString();
    Object.assign(costInput.style, {
        width: '140px',
        padding: '10px 14px',
        border: '2px solid #ced4da',
        borderRadius: '6px',
        fontSize: '14px',
        fontFamily: 'inherit',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
        transition: 'all 0.2s ease',
        outline: 'none'
    });
    costInput.addEventListener('focus', () => {
        costInput.style.borderColor = '#007bff';
        costInput.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.15)';
    });
    costInput.addEventListener('blur', () => {
        costInput.style.borderColor = '#ced4da';
        costInput.style.boxShadow = 'none';
    });

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.id = 'cost_per_unit_by_currency';
    hiddenInput.name = 'cost_per_unit_by_currency';

    function updateHidden() {
        const num = parseFloat(costInput.value);
        const val = isNaN(num) ? 0 : num;
        costState[activeCurrency] = val;
        hiddenInput.value = JSON.stringify({ ...costState });
    }

    updateHidden();
    inputsMap.set('cost_per_unit_by_currency', hiddenInput);

    select.addEventListener('change', () => {
        const num = parseFloat(costInput.value);
        const val = isNaN(num) ? 0 : num;
        costState[activeCurrency] = val;
        activeCurrency = select.value;
        const nextVal = costState[activeCurrency];
        costInput.value = (nextVal != null ? parseFloat(nextVal) : 0).toString();
        updateHidden();
    });

    costInput.addEventListener('input', () => {
        updateHidden();
    });

    toggleRow.appendChild(label);
    toggleRow.appendChild(description);
    const inputRow = document.createElement('div');
    Object.assign(inputRow.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
    });
    inputRow.appendChild(select);
    inputRow.appendChild(costInput);
    const unitLabel = document.createElement('span');
    unitLabel.style.cssText = 'fontSize: 14px; color: #6c757d;';
    unitLabel.textContent = '/ unit';
    inputRow.appendChild(unitLabel);
    toggleRow.appendChild(inputRow);
    content.appendChild(toggleRow);
    content.appendChild(hiddenInput);

    return content;
}
