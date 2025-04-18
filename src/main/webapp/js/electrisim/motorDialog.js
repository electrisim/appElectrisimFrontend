const rowDefsMotor = [
  { name: "Motor", pn_mech_mw: 0.0, cos_phi: 0.0, cos_phi_n: 0.0, efficiency_n_percent: 0.0, lrc_pu: 0.0, rx: 0.0, vn_kv: 0.0, efficiency_percent: 0.0, loading_percent: 0.0, scaling: 0.0 },

];
const columnDefsMotor = [
  {
    field: "name",
  },
  {
    field: "pn_mech_mw",
    headerTooltip: "Mechanical rated power of the motor",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "cos_phi",
    headerTooltip: "cosine phi at current operating point",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "cos_phi_n",
    headerTooltip: "cosine phi at rated power of the motor for short-circuit calculation",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "efficiency_n_percent",
    headerTooltip: "Efficiency in percent at rated power for short-circuit calculation",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "lrc_pu",
    headerTooltip: "locked rotor current in relation to the rated motor current",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "rx",
    headerTooltip: "R/X ratio of the motor for short-circuit calculation",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "vn_kv",
    headerTooltip: "Rated voltage of the motor for short-circuit calculation",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "efficiency_percent",
    headerTooltip: "Efficiency in percent at current operating point",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "loading_percent",
    headerTooltip: "The mechanical loading in percentage of the rated mechanical power",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "scaling",
    headerTooltip: "scaling factor which for the active power of the motor",
    maxWidth: 120,
    valueParser: numberParser,
  }
 
];

var gridOptionsMotor = {
  columnDefs: columnDefsMotor,
  defaultColDef: {
    minWidth: 100,
    editable: true,
  },
  rowData: rowDefsMotor,
  singleClickEdit: true,
  stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
};



