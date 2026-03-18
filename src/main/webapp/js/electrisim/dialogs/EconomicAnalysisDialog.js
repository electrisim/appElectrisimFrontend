import { Dialog } from '../Dialog.js';
import { getEconomicProfileRelevance } from '../utils/networkDataPreparation.js';
import { getCurrencyOptionsForSelect } from '../utils/economicTabHelper.js';

export class EconomicAnalysisDialog extends Dialog {
    constructor(editorUi) {
        super('Economic Analysis Parameters', 'Calculate');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.useModalFallback = true; // Avoid duplicate Cancel/Calculate buttons from DrawIO wrapper
        this.graph = this.ui?.editor?.graph;
        this.parameters = this._buildParameters(true, true);
    }

    _buildParameters(hasLoads, hasGenerators) {
        const currencyOpts = getCurrencyOptionsForSelect();
        const params = [
            {
                id: 'frequency',
                label: 'Frequency',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ]
            },
            {
                id: 'currency',
                label: 'Display Currency',
                type: 'select',
                options: currencyOpts
            },
            {
                id: 'energy_loss_section',
                label: 'Electrical energy losses calculation',
                type: 'section',
                subtitle: 'Time series with load and generation profiles. Load and generation profile options appear when the model contains Load or Generator elements.'
            },
            {
                id: 'time_steps',
                label: 'Time steps (hours)',
                type: 'number',
                value: '8760'
            },
            {
                id: 'lifetime_years',
                label: 'Lifetime (years)',
                type: 'number',
                value: '30'
            }
        ];
        if (!hasLoads && !hasGenerators) {
            params.push({
                id: 'profile_info',
                label: 'Profile options',
                type: 'section',
                subtitle: 'Add Load or Generator elements to the model to enable load and generation profile options for time-series energy loss calculation.'
            });
        }
        if (hasLoads) {
            params.push({
                id: 'load_profile',
                label: 'Load profile',
                type: 'select',
                options: [
                    { value: 'constant', label: 'Constant', default: true },
                    { value: 'daily', label: 'Residential (yearly, seasonal)' },
                    { value: 'industrial', label: 'Industrial (yearly, seasonal)' }
                ]
            });
        }
        if (hasGenerators) {
            params.push({
                id: 'generation_profile',
                label: 'Generation profile',
                type: 'select',
                options: [
                    { value: 'constant', label: 'Constant', default: true },
                    { value: 'solar', label: 'Solar (yearly, seasonal)' },
                    { value: 'onshore_wind', label: 'Onshore wind (yearly, seasonal)' },
                    { value: 'offshore_wind', label: 'Offshore wind (yearly, seasonal)' }
                ]
            });
        }
        params.push({
            id: 'energy_price_per_mwh',
            label: 'Energy price per MWh (optional, for loss cost; uses Display Currency)',
            type: 'number',
            value: '100'
        });
        return params;
    }

    getDescription() {
        return '<strong>Economic Analysis</strong><br>Calculate total CAPEX (capital expenditure) from element costs and power losses from load flow. Use time series with generation profiles (solar, onshore/offshore wind) for electrical energy loss estimates. Set cost per unit in the Economic tab of each element dialog.';
    }

    show(callback) {
        this.callback = callback;
        const g = this.graph || this.ui?.editor?.graph;
        const { hasLoads, hasGenerators } = getEconomicProfileRelevance(g || {});
        this.parameters = this._buildParameters(hasLoads, hasGenerators);
        super.show(callback);
    }
}

globalThis.EconomicAnalysisDialog = EconomicAnalysisDialog;
