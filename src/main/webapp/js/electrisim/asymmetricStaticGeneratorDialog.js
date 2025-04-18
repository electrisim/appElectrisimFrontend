const  rowDefsAsymmetricStaticGenerator = [
    { name: "Asymmetric Static Generator", p_a_mw:0.0,  p_b_mw: 0.0, p_c_mw: 0.0, q_a_mvar: 0.0, q_b_mvar: 0.0, q_c_mvar:0.0, sn_mva:0.0, scaling: 0.0, type: 'Wye'},
    
  ];  
  const columnDefsAsymmetricStaticGenerator = [  
    {
      field: "name",
    },
    {
      field: "p_a_mw",
      headerTooltip: "The active power of the static generator : Phase A",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "p_b_mw",
      headerTooltip: "The active power of the static generator : Phase B",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "p_c_mw",
      headerTooltip: "The active power of the static generator : Phase C",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "q_a_mvar",
      headerTooltip: "The reactive power of the sgen : Phase A",
      maxWidth: 120,
      
    },
    {
      field: "q_b_mvar",
      headerTooltip: "The reactive power of the sgen : Phase B",
      maxWidth: 120,
      
    },
    {
      field: "q_c_mvar",
      headerTooltip: "The reactive power of the sgen : Phase C",
      maxWidth: 100,
      
    },
    {
      field: "sn_mva",
      headerTooltip: "Nominal power of the sgen",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "scaling",
      headerTooltip: "An OPTIONAL scaling factor to be set customly. Multiplys with p_mw and q_mvar of all phases.",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "type",
      headerTooltip: "Three phase Connection type of the static generator: wye/delta",
      maxWidth: 100,
      valueParser: numberParser,
    }
  ];
  
  var gridOptionsAsymmetricStaticGenerator = {
    columnDefs: columnDefsAsymmetricStaticGenerator,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsAsymmetricStaticGenerator,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  