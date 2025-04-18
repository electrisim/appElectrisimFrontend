const  rowDefsAsymmetricLoad = [
    { givenname: "Asymmetric Load", p_a_mw:0.0,  p_b_mw: 0.0, p_c_mw: 0.0, q_a_mvar: 0.0, q_b_mvar: 0.0, q_c_mvar:0.0, sn_mva:0.0, scaling: 0.0, type: 'Wye'},
    
  ];  
  const columnDefsAsymmetricLoad = [  
    {
      field: "givenname",
    },
    {
      field: "p_a_mw",
      headerTooltip: "The active power for Phase A load",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "p_b_mw",
      headerTooltip: "The active power for Phase B load",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "p_c_mw",
      headerTooltip: "The active power for Phase C load",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "q_a_mvar",
      headerTooltip: "The reactive power for Phase A load",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "q_b_mvar",
      headerTooltip: "The reactive power for Phase B load",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "q_c_mvar",
      headerTooltip: "The reactive power for Phase C load",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "sn_mva",
      headerTooltip: "Nominal power of the load",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "scaling",
      headerTooltip: "An OPTIONAL scaling factor to be set customly Multiplys with p_mw and q_mvar of all phases.",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "type",
      headerTooltip: "type variable to classify three ph load: delta/wye",
      maxWidth: 100,      
    }
  ];
  
  var gridOptionsAsymmetricLoad = {
    columnDefs: columnDefsAsymmetricLoad,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsAsymmetricLoad,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  