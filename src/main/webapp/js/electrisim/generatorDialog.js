const  rowDefsGenerator = [
    { name: "Generator", p_mw:0.0,  vm_pu: 0.0, sn_mva: 0.0, scaling: 0.0, vn_kv: 0.0, xdss_pu:0.0, rdss_ohm:0.0, cos_phi: 0.0, pg_percent: 0.0, power_station_trafo: 0.0},
    
  ];  
  const columnDefsGenerator = [  
    {
      field: "name",
    },
    {
      field: "p_mw",
      headerTooltip: "The active power of the generator (positive for generation!)",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "vm_pu",
      headerTooltip: "The voltage set point of the generator",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "sn_mva",
      headerTooltip: "Nominal power of the generator",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "scaling",
      headerTooltip: "scaling factor which for the active power of the generator",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vn_kv",
      headerTooltip: "Rated voltage of the generator for short-circuit calculation",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "xdss_pu",
      headerTooltip: "Subtransient generator reactance for short-circuit calculation",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "rdss_ohm",
      headerTooltip: "Subtransient generator resistance for short-circuit calculation",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "cos_phi",
      headerTooltip: "Rated cosine phi of the generator for short-circuit calculation",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "pg_percent",
      headerTooltip: "Rated pg (voltage control range) of the generator for short-circuit calculation",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "power_station_trafo",
      headerTooltip: "Index of the power station transformer for short-circuit calculation",
      maxWidth: 100,
      valueParser: numberParser,
    }
  ];
  
  var gridOptionsGenerator = {
    columnDefs: columnDefsGenerator,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsGenerator,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  