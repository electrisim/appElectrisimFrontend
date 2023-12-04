const rowDefsMotor = [
  { name: "Motor", pn_mech_mw: 0.0, cos_phi: 0.0, cos_phi_n: 0.0, efficiency_n_percent: 0.0, lrc_pu: 0.0, rx: 0.0, vn_kv: 0.0, efficiency_percent: 0.0, loading_percent: 0.0, scaling: 0.0 },

];
const columnDefsMotor = [
  {
    field: "name",
  },
  {
    field: "pn_mech_mw",
    headerTooltip: "",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "cos_phi",
    headerTooltip: "",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "cos_phi_n",
    headerTooltip: "",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "efficiency_n_percent",
    headerTooltip: "",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "lrc_pu",
    headerTooltip: "",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "rx",
    headerTooltip: "",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "vn_kv",
    headerTooltip: "",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "efficiency_percent",
    headerTooltip: "",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "loading_percent",
    headerTooltip: "",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "scaling",
    headerTooltip: "",
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



