const  rowDefsExternalGrid = [
    { name: "External Grid", vm_pu:0.0,  va_degree: 0.0, s_sc_max_mva: 0.0, s_sc_min_mva: 0.0, rx_max: 0.0, rx_min:0.0, r0x0_max:0.0, x0x_max: 0.0},
    
  ];  
  const columnDefsExternalGrid = [  
  
    {
      field: "name",
    },
    {
      field: "vm_pu",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "va_degree",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "s_sc_max_mva",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "s_sc_min_mva",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "rx_max",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "rx_min",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "r0x0_max",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "x0x_max",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    }
  ];
  
  var gridOptionsExternalGrid = {
    columnDefs: columnDefsExternalGrid,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsExternalGrid,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  