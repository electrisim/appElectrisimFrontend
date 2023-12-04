const rowDefsThreeWindingTransformerBase = [
    { name: "Three winding transformer", sn_hv_mva: 0.0, sn_mv_mva: 0.0, sn_lv_mva: 0.0, vn_hv_kv: 0.0, vn_mv_kv: 0.0, vn_lv_kv: 0.0, vk_hv_percent: 0.0, vk_mv_percent: 0.0, vk_lv_percent: 0.0, vkr_hv_percent: 0.0, vkr_mv_percent: 0.0, vkr_lv_percent: 0.0, pfe_kw: 0.0, i0_percent: 0.0, shift_mv_degree: 0.0, shift_lv_degree: 0.0, tap_step_percent: 0.0, tap_min: 0.0, tap_max: 0.0 },//, vk0_hv_percent:1.0,vk0_mv_percent:1.0,vk0_lv_percent:1.0,vkr0_hv_percent:1.0,vkr0_mv_percent:1.0,vkr0_lv_percent:1.0,vector_group:1.0 },
];

const columnDefsThreeWindingTransformerBase = [

    { field: "name", minWidth: 300 },
    {
        field: "sn_hv_mva",
        maxWidth: 110,
        valueParser: numberParser,
    },
    {
        field: "sn_mv_mva",
        maxWidth: 110,
        valueParser: numberParser,
    },
    {
        field: "sn_lv_mva",
        maxWidth: 110,
        valueParser: numberParser,
    },
    {
        field: "vn_hv_kv",
        maxWidth: 100,
        valueParser: numberParser,
    },
    {
        field: "vn_mv_kv",
        maxWidth: 100,
        valueParser: numberParser,
    },
    {
        field: "vn_lv_kv",
        maxWidth: 100,
        valueParser: numberParser,
    },
    {
        field: "vk_hv_percent",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "vk_mv_percent",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "vk_lv_percent",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "vkr_hv_percent",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "vkr_mv_percent",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "vkr_lv_percent",
        maxWidth: 140,
        valueParser: numberParser,
    },
    {
        field: "pfe_kw",
        maxWidth: 100,
        valueParser: numberParser,
    },
    {
        field: "i0_percent",
        maxWidth: 110,
        valueParser: numberParser,
    },
    {
        field: "shift_mv_degree",
        maxWidth: 150,
        valueParser: numberParser,
    },
    {
        field: "shift_lv_degree",
        maxWidth: 150,
        valueParser: numberParser,
    },
    {
        field: "tap_step_percent",
        maxWidth: 150,
        valueParser: numberParser,
    },
    {
        field: "tap_min",
        maxWidth: 110,
    },
    {
        field: "tap_max",
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
        editable: true
    },
    rowData: rowDefsThreeWindingTransformerBase,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 


};
