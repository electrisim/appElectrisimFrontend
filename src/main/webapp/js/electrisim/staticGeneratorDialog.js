const  rowDefsStaticGenerator = [
    { name: "Static Generator", p_mw:0.0,  q_mvar: 0.0, sn_mva: 0.0, scaling: 0.0, type: 'Wye', k:0.0, rx:0.0, generator_type: 'async', lrc_pu: 0.0, max_ik_ka: 0.0, kappa: 0.0, current_source: true},
    
  ];  
  const columnDefsStaticGenerator = [  
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
      maxWidth: 120,
   
    },
    {
      field: "k",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "rx",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "generator_type",
      headerTooltip: "",
      maxWidth: 120,
    
    },
    {
      field: "lrc_pu",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "max_ik_ka",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "kappa",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "current_source",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    }
  ];
  
  var gridOptionsStaticGenerator = {
    columnDefs: columnDefsStaticGenerator,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsStaticGenerator,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  