import { numberParser, actionCellRenderer } from './utils/gridUtils.js';

export const rowDefsThreeWindingTransformerLibrary = [
  { name: "63/25/38 MVA 110/20/10 kV", sn_hv_mva: 63, sn_mv_mva: 25, sn_lv_mva: 38, vn_hv_kv: 110, vn_mv_kv: 20, vn_lv_kv:10, vk_hv_percent:10.4, vk_mv_percent:10.4, vk_lv_percent:10.4, vkr_hv_percent:0.28, vkr_mv_percent:0.32, vkr_lv_percent:0.35, pfe_kw:35, i0_percent:0.89, shift_mv_degree:0, shift_lv_degree:0, tap_step_percent:1.2, tap_pos:0, tap_min:-10, tap_max:10},//, vk0_hv_percent:1.0,vk0_mv_percent:1.0,vk0_lv_percent:1.0,vkr0_hv_percent:1.0,vkr0_mv_percent:1.0,vkr0_lv_percent:1.0,vector_group:1.0 },
  { name: "63/25/38 MVA 110/10/10 kV", sn_hv_mva: 63, sn_mv_mva: 25, sn_lv_mva: 38, vn_hv_kv: 110, vn_mv_kv: 10, vn_lv_kv:10, vk_hv_percent:10.4, vk_mv_percent:10.4, vk_lv_percent:10.4, vkr_hv_percent:0.28, vkr_mv_percent:0.32, vkr_lv_percent:0.35, pfe_kw:35, i0_percent:0.89, shift_mv_degree:0, shift_lv_degree:0, tap_step_percent:1.2, tap_pos:0, tap_min:-10, tap_max:10},//, vk0_hv_percent:1.0,vk0_mv_percent:1.0,vk0_lv_percent:1.0,vkr0_hv_percent:1.0,vkr0_mv_percent:1.0,vkr0_lv_percent:1.0,vector_group:1.0 },
  { name: "350/350/10 MVA 400/275/15 kV", sn_hv_mva: 350, sn_mv_mva: 350, sn_lv_mva: 10, vn_hv_kv: 400, vn_mv_kv: 275, vn_lv_kv:15, vk_hv_percent:11, vk_mv_percent:11, vk_lv_percent:10.4, vkr_hv_percent:0, vkr_mv_percent:0, vkr_lv_percent:0, pfe_kw:140, i0_percent:0, shift_mv_degree:0, shift_lv_degree:0, tap_step_percent:1.5, tap_pos:0, tap_min:-10, tap_max:10},//, vk0_hv_percent:1.0,vk0_mv_percent:1.0,vk0_lv_percent:1.0,vkr0_hv_percent:1.0,vkr0_mv_percent:1.0,vkr0_lv_percent:1.0,vector_group:1.0 },
    
];  
export const columnDefsThreeWindingTransformerLibrary = [  
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
      field: "sn_hv_mva",
      headerTooltip: "rated apparent power in MVA of high voltage side",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "sn_mv_mva",
      headerTooltip: "rated apparent power in MVA of medium voltage side",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "sn_lv_mva",
      headerTooltip: "rated apparent power in MVA of low voltage side",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "vn_hv_kv",
      headerTooltip: "rated voltage in kV of high voltage side",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vn_mv_kv",
      headerTooltip: "rated voltage in kV of medium voltage side",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vn_lv_kv",
      headerTooltip: "rated voltage in kV of low voltage side",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vk_hv_percent",
      headerTooltip: "short circuit voltage in percent of high voltage side",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vk_mv_percent",
      headerTooltip: "short circuit voltage in percent of medium voltage side",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vk_lv_percent",
      headerTooltip: "short circuit voltage in percent of low voltage side",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vkr_hv_percent",
      headerTooltip: "real part of short circuit voltage in percent of high voltage side",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vkr_mv_percent",
      headerTooltip: "real part of short circuit voltage in percent of medium voltage side",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vkr_lv_percent",
      headerTooltip: "real part of short circuit voltage in percent of low voltage side",
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
      field: "shift_mv_degree",
      headerTooltip: "angle shift to medium voltage side",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "shift_lv_degree",
      headerTooltip: "angle shift to low voltage side",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "tap_side",
      headerTooltip: "where the tap changer is located (hv, mv, lv)",
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
function setThreeWindingTransformerCsvData(keys, values) {
  // Handle CSV data
}

export const gridOptionsThreeWindingTransformerLibrary = {
  suppressClickEdit: true, //edit, delete, update, cancel
  editType: "fullRow",
  rowSelection: "single",
  rowData: rowDefsThreeWindingTransformerLibrary,
  columnDefs: columnDefsThreeWindingTransformerLibrary,
  defaultColDef: {
    editable: true    
  },
  onCellClicked: onCellClicked,   
  onRowEditingStarted: onRowEditingStarted, 
  onRowEditingStopped: onRowEditingStopped,
  onSelectionChanged: () => {
    const selectedData = gridOptionsThreeWindingTransformerLibrary.api.getSelectedRows();
  },
};

// Make them globally available
globalThis.rowDefsThreeWindingTransformerLibrary = rowDefsThreeWindingTransformerLibrary;
globalThis.columnDefsThreeWindingTransformerLibrary = columnDefsThreeWindingTransformerLibrary;
globalThis.gridOptionsThreeWindingTransformerLibrary = gridOptionsThreeWindingTransformerLibrary;
globalThis.onCellClicked = onCellClicked;
globalThis.onRowEditingStarted = onRowEditingStarted;
globalThis.onRowEditingStopped = onRowEditingStopped;
globalThis.setThreeWindingTransformerCsvData = setThreeWindingTransformerCsvData;
  