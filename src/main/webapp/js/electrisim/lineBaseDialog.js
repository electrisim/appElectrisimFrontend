const rowDefsDataLineBaseDialog = [
    { name: "Line", r_ohm_per_km: 0.0, x_ohm_per_km: 0.0, c_nf_per_km: 0.0, g_us_per_km: 0.0, max_i_ka: 0.0, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:0.0},
     ]; 
  
  const columnDefsLineBaseDialog = [
      
      { field: "name", minWidth: 300 },
      { field: "r_ohm_per_km",
        maxWidth: 140,
        valueParser: numberParser,
      },
      { field: "x_ohm_per_km",
        maxWidth: 140,
        valueParser: numberParser,
      },
      { field: "c_nf_per_km",
        maxWidth: 130,
        valueParser: numberParser,
      },
      { field: "g_us_per_km",
        maxWidth: 130,
        valueParser: numberParser,
      },
      { field: "max_i_ka",
        maxWidth: 100,
        valueParser: numberParser,
      },
      { field: "type",
        maxWidth: 100,
      },
      { field: "r0_ohm_per_km",
        maxWidth: 150,
        valueParser: numberParser,
      },
      { field: "x0_ohm_per_km",
        maxWidth: 150,
        valueParser: numberParser,
      },
      { field: "c0_nf_per_km",
        maxWidth: 130,
        valueParser: numberParser,
      },
      { field: "endtemp_degree",
        maxWidth: 150,
        valueParser: numberParser,
      }
  ];
  
  
  
  
  //***********sprawdzenia poprawnego formatowania wprowadzanych parametrów */
  
  function numberParser(params) {
    if(Number(params.newValue) >= 0) {
      return(Number(params.newValue))
    }else {
      alert("The value must be number (dot separated) or >= 0")
      return(Number(params.oldValue))
    }
  }
  /*********************************************** */
  
  
  
  var gridOptionsLineBaseDialog = { 
      
    columnDefs: columnDefsLineBaseDialog,
    defaultColDef: {
      editable: true    
    },  
    rowData: rowDefsDataLineBaseDialog,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość     
    };
   
    

  
  
  
  
  