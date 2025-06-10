import { numberParser, actionCellRenderer } from './utils/gridUtils.js';

export const rowDefsThreeWindingTransformerBase = [
    { name: "Three Winding Transformer", sn_hv_mva:0.0, sn_mv_mva:0.0, sn_lv_mva:0.0, vn_hv_kv:0.0, vn_mv_kv:0.0, vn_lv_kv:0.0, vk_hv_percent:0.0, vk_mv_percent:0.0, vk_lv_percent:0.0, vkr_hv_percent:0.0, vkr_mv_percent:0.0, vkr_lv_percent:0.0, pfe_kw:0.0, i0_percent:0.0, shift_mv_degree:0.0, shift_lv_degree:0.0, tap_side:"hv", tap_neutral:0.0, tap_min:-10.0, tap_max:10.0, tap_step_percent:1.0, tap_pos:0.0, tap_phase_shifter:false},
    
  ];  
export const columnDefsThreeWindingTransformerBase = [  
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
  
export const gridOptionsThreeWindingTransformerBase = {
    columnDefs: columnDefsThreeWindingTransformerBase,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsThreeWindingTransformerBase,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     

// Make them globally available
globalThis.rowDefsThreeWindingTransformerBase = rowDefsThreeWindingTransformerBase;
globalThis.columnDefsThreeWindingTransformerBase = columnDefsThreeWindingTransformerBase;
globalThis.gridOptionsThreeWindingTransformerBase = gridOptionsThreeWindingTransformerBase;
  
  