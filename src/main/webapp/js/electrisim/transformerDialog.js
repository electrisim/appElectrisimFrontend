import { numberParser, actionCellRenderer } from './utils/gridUtils.js';

export const rowDefsTransformerLibrary = [
  { name: "160 MVA 380/110 kV", sn_mva: 160.0, vn_hv_kv: 380.0, vn_lv_kv: 110.0, vkr_percent: 0.25, vk_percent: 12.2, pfe_kw:60.0, i0_percent:0.06, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'},
  { name: "140 MVA 275/45 kV", sn_mva: 140.0, vn_hv_kv: 275.0, vn_lv_kv: 45.0, vkr_percent: 0.26, vk_percent: 12.0, pfe_kw:55.0, i0_percent:0.06, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
  { name: "100 MVA 220/110 kV", sn_mva: 100.0, vn_hv_kv: 220.0, vn_lv_kv: 110.0, vkr_percent: 0.26, vk_percent: 12.0, pfe_kw:55.0, i0_percent:0.06, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'},   
  { name: "63 MVA 110/20 kV", sn_mva: 63.0, vn_hv_kv: 110.0, vn_lv_kv: 20.0, vkr_percent: 0.32, vk_percent: 18.0, pfe_kw:22.0, i0_percent:0.04, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'},
  { name: "40 MVA 110/20 kV", sn_mva: 40.0, vn_hv_kv: 110.0, vn_lv_kv: 20.0, vkr_percent: 0.35, vk_percent: 17.2, pfe_kw:19.0, i0_percent:0.05, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0,  tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
  { name: "40 MVA 110/30 kV", sn_mva: 40.0, vn_hv_kv: 110.0, vn_lv_kv: 30.0, vkr_percent: 0.34, vk_percent: 16.2, pfe_kw:18.0, i0_percent:0.05, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
  { name: "25 MVA 110/20 kV", sn_mva: 25.0, vn_hv_kv: 110.0, vn_lv_kv: 20.0, vkr_percent: 0.41, vk_percent: 12.0, pfe_kw:14.0, i0_percent:0.07, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'},
  { name: "63 MVA 110/10 kV", sn_mva: 63.0, vn_hv_kv: 110.0, vn_lv_kv: 10.0, vkr_percent: 0.32, vk_percent: 18.0, pfe_kw:22.0, i0_percent:0.04, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
  { name: "40 MVA 110/10 kV", sn_mva: 40.0, vn_hv_kv: 110.0, vn_lv_kv: 10.0, vkr_percent: 0.34, vk_percent: 16.2, pfe_kw:18.0, i0_percent:0.05, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'},
  { name: "25 MVA 110/10 kV", sn_mva: 25.0, vn_hv_kv: 110.0, vn_lv_kv: 10.0, vkr_percent: 0.41, vk_percent: 12.0, pfe_kw:14.0, i0_percent:0.07, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
  { name: "3.75 MVA 30/0.65 kV", sn_mva: 3.75, vn_hv_kv: 30.0, vn_lv_kv: 0.65, vkr_percent: 0.8, vk_percent: 9.0, pfe_kw:5.8, i0_percent:0.5, shift_degree: 0, vector_group:"Dyn", vk0_percent:8.2, vkr0_percent:0.7, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'},
  { name: "0.25 MVA 20/0.4 kV", sn_mva: 0.25, vn_hv_kv: 20.0, vn_lv_kv: 0.4, vkr_percent: 1.44, vk_percent: 6.0, pfe_kw:0.8, i0_percent:0.32, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'},
  { name: "0.4 MVA 20/0.4 kV", sn_mva: 0.4, vn_hv_kv: 20.0, vn_lv_kv: 0.4, vkr_percent: 1.425, vk_percent: 6.0, pfe_kw:1.35, i0_percent:0.3375, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
  { name: "0.63 MVA 20/0.4 kV", sn_mva: 0.63, vn_hv_kv: 20.0, vn_lv_kv: 0.4, vkr_percent: 1.206, vk_percent: 6.0, pfe_kw:1.65, i0_percent:0.2619, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'},
  { name: "0.25 MVA 10/0.4 kV", sn_mva: 0.25, vn_hv_kv: 10.0, vn_lv_kv: 0.4, vkr_percent: 1.2, vk_percent: 4.0, pfe_kw:0.6, i0_percent:0.24, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
  { name: "0.4 MVA 10/0.4 kV", sn_mva: 0.4, vn_hv_kv: 10.0, vn_lv_kv: 0.4, vkr_percent: 1.325, vk_percent: 4.0, pfe_kw:0.95, i0_percent:0.2375, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'},
  { name: "0.63 MVA 10/0.4 kV", sn_mva: 0.63, vn_hv_kv: 10.0, vn_lv_kv: 0.4, vkr_percent: 1.0794, vk_percent: 4.0, pfe_kw:1.18, i0_percent:0.1873, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_pos:0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'},     
    
  ];  
export const columnDefsTransformerLibrary = [  
    {
      headerName: "Action",
      minWidth: 100,
      cellRenderer: actionCellRenderer,      
      editable: false,
      colId: "action",
    },
    {
      field: "name",
    },
    {
      field: "sn_mva",
      headerTooltip: "rated apparent power in MVA",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "vn_hv_kv",
      headerTooltip: "rated voltage on high voltage side in kV",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "vn_lv_kv",
      headerTooltip: "rated voltage on low voltage side in kV",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "vk_percent",
      headerTooltip: "short circuit voltage in percent",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vkr_percent",
      headerTooltip: "real part of short circuit voltage in percent",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "pfe_kw",
      headerTooltip: "iron losses in kW",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "i0_percent",
      headerTooltip: "open loop losses in percent",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "shift_degree",
      headerTooltip: "angle shift in degrees",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "tap_side",
      headerTooltip: "where the tap changer is located (hv, lv)",
      maxWidth: 120,
    },
    {
      field: "tap_neutral",
      headerTooltip: "tap position where no voltage shift is present",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "tap_min",
      headerTooltip: "minimum tap position",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "tap_max",
      headerTooltip: "maximum tap position",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "tap_step_percent",
      headerTooltip: "tap step size in percent",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "tap_pos",
      headerTooltip: "current tap position of the transformer. Defaults to tap_neutral if not set",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "tap_phase_shifter",
      headerTooltip: "whether the transformer is an ideal phase shifter",
      maxWidth: 120,
    }
  ];

//edit, delete, update, cancel*********
function onCellClicked(params) {
  // Handle cell clicks
  if (params.column.colId === "action") {
    // Handle action column clicks
  }
}

function onRowEditingStarted(params) {
  // Handle row editing started
}

function onRowEditingStopped(params) { 
  // Handle row editing stopped
}

/* wczytywanie pliku CSV */
function setTransformerCsvData(keys, values) {
  // Handle CSV data
}

export const gridOptionsTransformerLibrary = {
  suppressClickEdit: true, //edit, delete, update, cancel
  editType: "fullRow",
  rowSelection: "single",
    
  rowData: rowDefsTransformerLibrary,
  columnDefs: columnDefsTransformerLibrary,
  defaultColDef: {
    editable: true    
  },

  //edit, delete, update, cancel*****************
  onCellClicked: onCellClicked,   
  onRowEditingStarted: onRowEditingStarted, 
  onRowEditingStopped: onRowEditingStopped,
  onSelectionChanged: () => {
    const selectedData = gridOptionsTransformerLibrary.api.getSelectedRows();
  },
  //*********************************************
  
};

// Make them globally available
globalThis.rowDefsTransformerLibrary = rowDefsTransformerLibrary;
globalThis.columnDefsTransformerLibrary = columnDefsTransformerLibrary;
globalThis.gridOptionsTransformerLibrary = gridOptionsTransformerLibrary;
globalThis.onCellClicked = onCellClicked;
globalThis.onRowEditingStarted = onRowEditingStarted;
globalThis.onRowEditingStopped = onRowEditingStopped;
globalThis.setTransformerCsvData = setTransformerCsvData;

// Add aliases for legacy code compatibility
globalThis.gridOptionsTrafo = gridOptionsTransformerLibrary;
globalThis.rowDefsTestowanie = rowDefsTransformerLibrary;
  