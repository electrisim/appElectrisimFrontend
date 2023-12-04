const  rowDefsStorage = [
    { name: "Storage", p_mw:0.0,  max_e_mwh: 0.0, q_mvar: 0.0, sn_mva: 0.0, soc_percent: 0.0, min_e_mwh:0.0, scaling:0.0, type: 0.0},
    
  ];  
  const columnDefsStorage = [  
    {
      field: "name",
    },
    {
      field: "p_mw",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "max_e_mwh",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "q_mvar",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "sn_mva",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "soc_percent",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "min_e_mwh",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "scaling",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "type",
      headerTooltip: "",
      maxWidth: 120,
      
    }
  ];
  
  var gridOptionsStorage = {
    columnDefs: columnDefsStorage,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsStorage,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  