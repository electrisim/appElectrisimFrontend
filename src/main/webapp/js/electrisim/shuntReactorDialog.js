const  rowDefsShuntReactor = [
    { name: "Generator", p_mw:0.0,  q_mvar: 0.0, vn_kv: 0.0, step: 0.0, max_step: 0.0},
    
  ];  
  const columnDefsShuntReactor = [  
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
      field: "q_mvar",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "vn_kv",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "step",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "max_step",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    }
  ];
  
  var gridOptionsShuntReactor = {
    columnDefs: columnDefsShuntReactor,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsShuntReactor,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  