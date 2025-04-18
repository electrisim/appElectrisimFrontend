const  rowDefsTestowanie = [
  { givenname: "Transformer", sn_mva:0.0,  vn_hv_kv: 0.0, vn_lv_kv: 0.0, vkr_percent: 0.0, vk_percent: 0.0, pfe_kw:0.0, i0_percent:0.0, shift_degree: 0.0, vector_group:"Dyn", vk0_percent:0.0, vkr0_percent:0.0, mag0_percent:0.0, si0_hv_partial:0.0, tap_pos:0, tap_max:0.0, tap_min:0.0, tap_step_percent:0.0, tap_step_degree:0, tap_phase_shifter:'False'},
  
];  
const columnDefsTestowanie = [  

  {
    field: "givenname",
  },
  {
    field: "sn_mva",
    headerTooltip: "Rated apparent power in MVA",
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
    field: "vkr_percent",
    headerTooltip: "real part of relative short-circuit voltage in %",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "vk_percent",
    headerTooltip: "relative short-circuit voltage in %",
    maxWidth: 120,
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
    headerTooltip: "open loop losses in percent of rated current in %",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "shift_degree",
    headerTooltip: "Angle shift over the transformer",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "vector_group",
    headerTooltip: "Vector group of the transformer; HV side is Uppercase letters and LV side is lower case",
    maxWidth: 120
  },

  {
    field: "vk0_percent",
    headerTooltip: "zero sequence relative short-circuit voltage in %",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "vkr0_percent",
    headerTooltip: "real part of zero sequence relative short-circuit voltage in %",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "mag0_percent",
    headerTooltip: "zero sequence magnetizing impedance in %",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "si0_hv_partial",
    headerTooltip: "distribution of zero sequence leakage impedances for HV side",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "tap_pos",
    headerTooltip: "current tap position of the transformer",
    maxWidth: 100,    
  }, 
  {
    field: "tap_max",
    headerTooltip: "maximal allowed tap position",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "tap_min",
    headerTooltip: "minimal allowed tap position",
    maxWidth: 100 //tutaj może być liczba ujemna dlatego nie używam numberParser     
  },
  {
    field: "tap_step_percent",
    headerTooltip: "tap step size for voltage magnitude in %",
    maxWidth: 140,
    valueParser: numberParser,
  },
  {
    field: "tap_step_degree",
    headerTooltip: "tap step size for voltage angle in degree",
    maxWidth: 130,
    valueParser: numberParser,
  },
  {
    field: "tap_phase_shifter",
    headerTooltip: "whether the transformer is an ideal phase shifter",
    maxWidth: 140
  }
];

var gridOptionsTrafo = {
  columnDefs: columnDefsTestowanie,
  defaultColDef: {  
      minWidth: 100,
      editable: true,
  },
  rowData: rowDefsTestowanie,
  singleClickEdit: true,
  stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
};     



