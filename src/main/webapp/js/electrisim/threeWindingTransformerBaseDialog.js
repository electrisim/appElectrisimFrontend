const rowDefsThreeWindingTransformerBase = [
    { givenname: "Three winding transformer", sn_hv_mva: 0.0, sn_mv_mva: 0.0, sn_lv_mva: 0.0, vn_hv_kv: 0.0, vn_mv_kv: 0.0, vn_lv_kv: 0.0, vk_hv_percent: 0.0, vk_mv_percent: 0.0, vk_lv_percent: 0.0, vkr_hv_percent: 0.0, vkr_mv_percent: 0.0, vkr_lv_percent: 0.0, pfe_kw: 0.0, i0_percent: 0.0, shift_mv_degree: 0.0, shift_lv_degree: 0.0, tap_step_percent: 0.0, tap_pos:0, tap_min: 0.0, tap_max: 0.0 },//, vk0_hv_percent:1.0,vk0_mv_percent:1.0,vk0_lv_percent:1.0,vkr0_hv_percent:1.0,vkr0_mv_percent:1.0,vkr0_lv_percent:1.0,vector_group:1.0 },
];

const columnDefsThreeWindingTransformerBase = [

    { field: "givenname", minWidth: 300 },
    {
        field: "sn_hv_mva",
        headerTooltip: "rated apparent power on high voltage side",   
        maxWidth: 110,
        valueParser: numberParser,
    },
    {
        field: "sn_mv_mva",
        headerTooltip: "rated apparent power on medium voltage side",
        maxWidth: 110,
        valueParser: numberParser,
    },
    {
        field: "sn_lv_mva",
        headerTooltip: "rated apparent power on low voltage side",
        maxWidth: 110,
        valueParser: numberParser,
    },
    {
        field: "vn_hv_kv",
        headerTooltip: "rated voltage on high voltage side",
        maxWidth: 100,
        valueParser: numberParser,
    },
    {
        field: "vn_mv_kv",
        headerTooltip: "rated voltage on medium voltage side",
        maxWidth: 100,
        valueParser: numberParser,
    },
    {
        field: "vn_lv_kv",
        headerTooltip: "rated voltage on low voltage side",
        maxWidth: 100,
        valueParser: numberParser,
    },
    {
        field: "vk_hv_percent",
        headerTooltip: "short circuit voltage from high to medium voltage",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "vk_mv_percent",
        headerTooltip: "short circuit voltage from medium to low voltage",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "vk_lv_percent",
        headerTooltip: "short circuit voltage from high to low voltage",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "vkr_hv_percent",
        headerTooltip: "real part of short circuit voltage from high to medium voltage",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "vkr_mv_percent",
        headerTooltip: "real part of short circuit voltage from medium to low voltage",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "vkr_lv_percent",
        headerTooltip: "real part of short circuit voltage from high to low voltage",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "pfe_kw",
        headerTooltip: "iron losses in kW",
        maxWidth: 100,
        valueParser: numberParser,
    },
    {
        field: "i0_percent",
        headerTooltip: "open loop losses",
        maxWidth: 110,
        valueParser: numberParser,
    },
    {
        field: "shift_mv_degree",
        headerTooltip: "angle shift to medium voltage side",
        maxWidth: 150,
        valueParser: numberParser,
    },
    {
        field: "shift_lv_degree",
        headerTooltip: "angle shift to low voltage side",
        maxWidth: 150,
        valueParser: numberParser,
    },
    {
        field: "tap_step_percent",
        headerTooltip: "Tap step in percent",
        maxWidth: 150,
        valueParser: numberParser,
    },
    {
        field: "tap_pos",
        headerTooltip: "current tap position of the transformer. Defaults to the medium position (tap_neutral)",
        maxWidth: 110,
    },
    {
        field: "tap_min",
        headerTooltip: "Minimum tap position",
        maxWidth: 110,
    },
    {
        field: "tap_max",
        headerTooltip: "Maximum tap position",
        maxWidth: 110,
        valueParser: numberParser,
    }
    /*
    { field: "vk0_hv_percent",
    valueParser: numberParser,
    },
    { field: "vk0_mv_percent",
    valueParser: numberParser,
    },
    { field: "vk0_lv_percent",
    valueParser: numberParser,
    },
    { field: "vkr0_hv_percent",
    valueParser: numberParser,
    },
    { field: "vkr0_mv_percent",
    valueParser: numberParser,
    },
    { field: "vkr0_lv_percent",
    valueParser: numberParser,
    },
    { field: "vector_group",
    valueParser: numberParser,
    }*/
];

var gridOptionsThreeWindingTransformerBase = {
  columnDefs: columnDefsThreeWindingTransformerBase,
  defaultColDef: {  
      minWidth: 100,
      editable: true,
  },
  rowData: rowDefsThreeWindingTransformerBase,
  singleClickEdit: true,
  stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
};     
 
  