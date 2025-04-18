const  rowDefsSSC = [
    { givenname: "SSC(STATCOM)", r_ohm:0.0,  x_ohm: 0.0, set_vm_pu: 0.0, vm_internal_pu: 0.0, va_internal_degree: 0.0, controllable: 'True'  },
    
  ];  
  const columnDefsSSC = [  
    {
      field: "givenname",
    },
    {
      field: "r_ohm",
      headerTooltip: "resistance of the coupling transformer component of SSC(STATCOM)",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "x_ohm",
      headerTooltip: "reactance of the coupling transformer component of SSC(STATCOM)",
      maxWidth: 100,
      valueParser: numberParser,      
    },
    {
      field: "set_vm_pu",
      headerTooltip: "set-point for the bus voltage magnitude at the connection bus",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vm_internal_pu",
      headerTooltip: "The voltage magnitude of the voltage source converter VSC at the SSC(STATCOM)",
      maxWidth: 140,
      valueParser: numberParser,      
    },
    {
      field: "va_internal_degree",
      headerTooltip: "The voltage angle of the voltage source converter VSC at the SSC(STATCOM)",
      maxWidth: 160,
      valueParser: numberParser,      
    },
    {
      field: "controllable",
      headerTooltip: "whether the element is considered as actively controlling or as a fixed shunt impedance",
      maxWidth: 120,           
    }
  ];
  
  var gridOptionsSSC = {
    columnDefs: columnDefsSSC,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsSSC,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  