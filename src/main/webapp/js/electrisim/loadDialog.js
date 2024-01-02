const  rowDefsLoad = [
    { name: "Load", p_mw:0.0,  q_mvar: 0.0, const_z_percent: 0.0, const_i_percent: 0.0, sn_mva: 0.0, scaling:0.0, type:'Wye'},
    
  ];  
  const columnDefsLoad = [  
    {
      field: "name",
    },
    {
      field: "p_mw",
      headerTooltip: "The active power of the load",
      maxWidth: 100,
      valueParser: numberParser,  
    },
    {
      field: "q_mvar",
      headerTooltip: "The reactive power of the load",
      maxWidth: 100,
      
    },
    {
      field: "const_z_percent",
      headerTooltip: "percentage of p_mw and q_mvar that will be associated to constant impedance load at rated voltage",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "const_i_percent",
      headerTooltip: "percentage of p_mw and q_mvar that will be associated to constant current load at rated voltage",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "sn_mva",
      headerTooltip: "Nominal power of the load",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "scaling",
      headerTooltip: "An OPTIONAL scaling factor to be set customly. Multiplys with p_mw and q_mvar.",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "type",
      headerTooltip: "type variable to classify the load: wye/delta",
      maxWidth: 100,     
    }
  ];
  
  var gridOptionsLoad = {
    columnDefs: columnDefsLoad,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsLoad,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  