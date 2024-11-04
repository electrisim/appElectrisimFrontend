const rowDefsDataLineBaseDialog = [
    { name: "Line", length_km: 0.0, r_ohm_per_km: 0.0, x_ohm_per_km: 0.0, c_nf_per_km: 0.0, g_us_per_km: 0.0, max_i_ka: 0.0, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:0.0},
     ]; 
  
  const columnDefsLineBaseDialog = [
      
      { field: "name", minWidth: 300 },
      { field: "length_km",
        headerTooltip: "The line length in km",
        maxWidth: 140,
        valueParser: numberParser,
      },
      { field: "r_ohm_per_km",
        headerTooltip: "line resistance in ohm per km",
        maxWidth: 140,
        valueParser: numberParser,
      },
      { field: "x_ohm_per_km",
        headerTooltip: "line reactance in ohm per km",
        maxWidth: 140,
        valueParser: numberParser,
      },
      { field: "c_nf_per_km",
        headerTooltip: "line capacitance (line-to-earth) in nano Farad per km",
        maxWidth: 130,
        valueParser: numberParser,
      },
      { field: "g_us_per_km",
        headerTooltip: "dielectric conductance in micro Siemens per km",
        maxWidth: 130,
        valueParser: numberParser,
      },
      { field: "max_i_ka",
        headerTooltip: "maximum thermal current in kilo Ampere",
        maxWidth: 100,
        valueParser: numberParser,
      },
      { field: "type",
        headerTooltip: "type of line (“ol” for overhead line or “cs” for cable system)",
        maxWidth: 100,
      },
      { field: "r0_ohm_per_km",
        headerTooltip: "zero sequence line resistance in ohm per km",
        maxWidth: 150,
        valueParser: numberParser,
      },
      { field: "x0_ohm_per_km",
        headerTooltip: "zero sequence line reactance in ohm per km",
        maxWidth: 150,
        valueParser: numberParser,
      },
      { field: "c0_nf_per_km",
        headerTooltip: "zero sequence line capacitance in nano Farad per km",
        maxWidth: 130,
        valueParser: numberParser,
      },
      { field: "endtemp_degree",
        headerTooltip: "Short-Circuit end temperature of the line",
        maxWidth: 150,
        valueParser: numberParser,
      }
  ];
  
   
  
  //***********sprawdzenia poprawnego formatowania wprowadzanych parametrów */
  
  function numberParser(params) {

    if(Number(params.newValue) >= 0) {
      return(Number(params.newValue))
    }else {
      
      alert("The value "+ params +" must be number (dot separated) and >= 0")
      return(Number(params.oldValue))
    }
  }
  /*********************************************** */
  
    //***********sprawdzenia poprawnego formatowania wprowadzanych parametrów */
  
  function negativeNumberParser(params) {
   
      if(Number(params.newValue) <= 0) {
        return(Number(params.newValue))
      }else {
        alert("The value "+ params +" must be number (dot separated) and <= 0")
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
   
    

  
  
  
  
  