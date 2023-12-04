const  rowDefsAsymmetricLoad = [
    { name: "Asymmetric Load", p_a_mw:0.0,  p_b_mw: 0.0, p_c_mw: 0.0, q_a_mvar: 0.0, q_b_mvar: 0.0, q_c_mvar:0.0, sn_mva:0.0, scaling: 0.0, type: 'Wye'},
    
  ];  
  const columnDefsAsymmetricLoad = [  
    {
      field: "name",
    },
    {
      field: "p_a_mw",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "p_b_mw",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "p_c_mw",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "q_a_mvar",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "q_b_mvar",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "q_c_mvar",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "sn_mva",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "scaling",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "type",
      headerTooltip: "",
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
  
  
  
  