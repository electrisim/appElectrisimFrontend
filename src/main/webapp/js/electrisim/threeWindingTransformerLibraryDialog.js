import { numberParser } from './utils/gridUtils.js';

export const rowDefsThreeWindingTransformerLibrary = [
  { name: "63/25/38 MVA 110/20/10 kV", sn_hv_mva: 63, sn_mv_mva: 25, sn_lv_mva: 38, vn_hv_kv: 110, vn_mv_kv: 20, vn_lv_kv:10, vk_hv_percent:10.4, vk_mv_percent:10.4, vk_lv_percent:10.4, vkr_hv_percent:0.28, vkr_mv_percent:0.32, vkr_lv_percent:0.35, pfe_kw:35, i0_percent:0.89, shift_mv_degree:0, shift_lv_degree:0, tap_step_percent:1.2, tap_pos:0, tap_min:-10, tap_max:10},
  { name: "63/25/38 MVA 110/10/10 kV", sn_hv_mva: 63, sn_mv_mva: 25, sn_lv_mva: 38, vn_hv_kv: 110, vn_mv_kv: 10, vn_lv_kv:10, vk_hv_percent:10.4, vk_mv_percent:10.4, vk_lv_percent:10.4, vkr_hv_percent:0.28, vkr_mv_percent:0.32, vkr_lv_percent:0.35, pfe_kw:35, i0_percent:0.89, shift_mv_degree:0, shift_lv_degree:0, tap_step_percent:1.2, tap_pos:0, tap_min:-10, tap_max:10},
  { name: "350/350/10 MVA 400/275/15 kV", sn_hv_mva: 350, sn_mv_mva: 350, sn_lv_mva: 10, vn_hv_kv: 400, vn_mv_kv: 275, vn_lv_kv:15, vk_hv_percent:11, vk_mv_percent:11, vk_lv_percent:10.4, vkr_hv_percent:0, vkr_mv_percent:0, vkr_lv_percent:0, pfe_kw:140, i0_percent:0, shift_mv_degree:0, shift_lv_degree:0, tap_step_percent:1.5, tap_pos:0, tap_min:-10, tap_max:10},
    
];

export const columnDefsThreeWindingTransformerLibrary = [  
    { field: "name", headerName: "Transformer Name", minWidth: 300, flex: 2 },
    { field: "sn_hv_mva", headerName: "S_HV (MVA)", headerTooltip: "rated apparent power in MVA of high voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "sn_mv_mva", headerName: "S_MV (MVA)", headerTooltip: "rated apparent power in MVA of medium voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "sn_lv_mva", headerName: "S_LV (MVA)", headerTooltip: "rated apparent power in MVA of low voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "vn_hv_kv", headerName: "V_HV (kV)", headerTooltip: "rated voltage in kV of high voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "vn_mv_kv", headerName: "V_MV (kV)", headerTooltip: "rated voltage in kV of medium voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "vn_lv_kv", headerName: "V_LV (kV)", headerTooltip: "rated voltage in kV of low voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "vk_hv_percent", headerName: "v_k HV (%)", headerTooltip: "short circuit voltage in percent of high voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "vk_mv_percent", headerName: "v_k MV (%)", headerTooltip: "short circuit voltage in percent of medium voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "vk_lv_percent", headerName: "v_k LV (%)", headerTooltip: "short circuit voltage in percent of low voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "vkr_hv_percent", headerName: "v_kr HV (%)", headerTooltip: "real part of short circuit voltage in percent of high voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "vkr_mv_percent", headerName: "v_kr MV (%)", headerTooltip: "real part of short circuit voltage in percent of medium voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "vkr_lv_percent", headerName: "v_kr LV (%)", headerTooltip: "real part of short circuit voltage in percent of low voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "pfe_kw", headerName: "P_fe (kW)", headerTooltip: "iron losses in kW", maxWidth: 120, valueParser: numberParser },
    { field: "i0_percent", headerName: "i_0 (%)", headerTooltip: "open loop losses in percent", maxWidth: 120, valueParser: numberParser },
    { field: "shift_mv_degree", headerName: "Shift MV (°)", headerTooltip: "angle shift to medium voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "shift_lv_degree", headerName: "Shift LV (°)", headerTooltip: "angle shift to low voltage side", maxWidth: 120, valueParser: numberParser },
    { field: "tap_min", headerName: "Tap Min", headerTooltip: "minimum tap position", maxWidth: 100, valueParser: numberParser },
    { field: "tap_max", headerName: "Tap Max", headerTooltip: "maximum tap position", maxWidth: 100, valueParser: numberParser },
    { field: "tap_step_percent", headerName: "Tap Step (%)", headerTooltip: "tap step size in percent", maxWidth: 120, valueParser: numberParser },
    { field: "tap_pos", headerName: "Tap Pos", headerTooltip: "current tap position of the transformer. Defaults to tap_neutral if not set", maxWidth: 100, valueParser: numberParser }
];

// Grid options with improved styling and functionality
export const gridOptionsThreeWindingTransformerLibrary = {
    suppressClickEdit: false,
    editType: "fullRow",
    rowSelection: "single",
    columnDefs: columnDefsThreeWindingTransformerLibrary,
    defaultColDef: {
        editable: true,
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 80
    },
    rowData: rowDefsThreeWindingTransformerLibrary,
    singleClickEdit: false,
    stopEditingWhenGridLosesFocus: true,
    rowHeight: 35,
    headerHeight: 45,
    animateRows: true,
    enableCellChangeFlash: true,
    
    // Row styling
    getRowStyle: (params) => {
        if (params.node.isSelected()) {
            return { backgroundColor: '#e3f2fd', fontWeight: 'bold' };
        }
        return null;
    },
    
    onSelectionChanged: function() {
        const selectedRows = this.api.getSelectedRows();
        // Update button states based on selection
        const editBtn = document.getElementById('three-winding-edit-btn');
        const deleteBtn = document.getElementById('three-winding-delete-btn');
        
        if (editBtn && deleteBtn) {
            const hasSelection = selectedRows.length > 0;
            editBtn.disabled = !hasSelection;
            deleteBtn.disabled = !hasSelection;
            editBtn.style.opacity = hasSelection ? '1' : '0.5';
            deleteBtn.style.opacity = hasSelection ? '1' : '0.5';
        }
    },
    
    onFirstDataRendered: function(params) {
        params.api.sizeColumnsToFit();
    }
};

// Make them globally available
globalThis.rowDefsThreeWindingTransformerLibrary = rowDefsThreeWindingTransformerLibrary;
globalThis.columnDefsThreeWindingTransformerLibrary = columnDefsThreeWindingTransformerLibrary;
globalThis.gridOptionsThreeWindingTransformerLibrary = gridOptionsThreeWindingTransformerLibrary;
