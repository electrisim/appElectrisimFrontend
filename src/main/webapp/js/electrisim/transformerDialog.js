const rowDefsDataTransformerDialog = [
    { name: "160 MVA 380/110 kV", sn_mva: 160.0, vn_hv_kv: 380.0, vn_lv_kv: 110.0, vkr_percent: 0.25, vk_percent: 12.2, pfe_kw:60.0, i0_percent:0.06, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'},
    { name: "100 MVA 220/110 kV", sn_mva: 100.0, vn_hv_kv: 220.0, vn_lv_kv: 110.0, vkr_percent: 0.26, vk_percent: 12.0, pfe_kw:55.0, i0_percent:0.06, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'},   
    { name: "63 MVA 110/20 kV", sn_mva: 63.0, vn_hv_kv: 110.0, vn_lv_kv: 20.0, vkr_percent: 0.32, vk_percent: 18.0, pfe_kw:22.0, i0_percent:0.04, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'},
    { name: "40 MVA 110/20 kV", sn_mva: 40.0, vn_hv_kv: 110.0, vn_lv_kv: 20.0, vkr_percent: 0.34, vk_percent: 16.2, pfe_kw:18.0, i0_percent:0.05, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
    { name: "25 MVA 110/20 kV", sn_mva: 25.0, vn_hv_kv: 110.0, vn_lv_kv: 20.0, vkr_percent: 0.41, vk_percent: 12.0, pfe_kw:14.0, i0_percent:0.07, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'},
    { name: "63 MVA 110/10 kV", sn_mva: 63.0, vn_hv_kv: 110.0, vn_lv_kv: 10.0, vkr_percent: 0.32, vk_percent: 18.0, pfe_kw:22.0, i0_percent:0.04, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:9, tap_min:-9, tap_step_percent:1.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
    { name: "40 MVA 110/10 kV", sn_mva: 40.0, vn_hv_kv: 110.0, vn_lv_kv: 10.0, vkr_percent: 0.34, vk_percent: 16.2, pfe_kw:18.0, i0_percent:0.05, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'},
    { name: "25 MVA 110/10 kV", sn_mva: 25.0, vn_hv_kv: 110.0, vn_lv_kv: 10.0, vkr_percent: 0.41, vk_percent: 12.0, pfe_kw:14.0, i0_percent:0.07, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
    { name: "0.25 MVA 20/0.4 kV", sn_mva: 0.25, vn_hv_kv: 20.0, vn_lv_kv: 0.4, vkr_percent: 1.44, vk_percent: 6.0, pfe_kw:0.8, i0_percent:0.32, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'},
    { name: "0.4 MVA 20/0.4 kV", sn_mva: 0.4, vn_hv_kv: 20.0, vn_lv_kv: 0.4, vkr_percent: 1.425, vk_percent: 6.0, pfe_kw:1.35, i0_percent:0.3375, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
    { name: "0.63 MVA 20/0.4 kV", sn_mva: 0.63, vn_hv_kv: 20.0, vn_lv_kv: 0.4, vkr_percent: 1.206, vk_percent: 6.0, pfe_kw:1.65, i0_percent:0.2619, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'},
    { name: "0.25 MVA 10/0.4 kV", sn_mva: 0.25, vn_hv_kv: 10.0, vn_lv_kv: 0.4, vkr_percent: 1.2, vk_percent: 4.0, pfe_kw:0.6, i0_percent:0.24, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'}, 
    { name: "0.4 MVA 10/0.4 kV", sn_mva: 0.4, vn_hv_kv: 10.0, vn_lv_kv: 0.4, vkr_percent: 1.325, vk_percent: 4.0, pfe_kw:0.95, i0_percent:0.2375, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'},
    { name: "0.63 MVA 10/0.4 kV", sn_mva: 0.63, vn_hv_kv: 10.0, vn_lv_kv: 0.4, vkr_percent: 1.0794, vk_percent: 4.0, pfe_kw:1.18, i0_percent:0.1873, shift_degree: 0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:2, tap_min:-2, tap_step_percent:2.5, tap_step_degree:0, tap_phase_shifter:'False'},     
  ];     
  
  const columnDefsTransformerDialog = [
      {
        headerName: "Action",
        minWidth: 100,
        cellRenderer: actionCellRenderer,      
        editable: false,
        colId: "action"
      },
      { field: "name" },
      { field: "sn_mva",
        valueParser: numberParser,
      },
      { field: "vn_hv_kv",
      valueParser: numberParser,
      },
      { field: "vn_lv_kv",
      valueParser: numberParser,
      },
      { field: "vkr_percent",
      valueParser: numberParser,
      },
      { field: "pfe_kw",
      valueParser: numberParser,
      },
      { field: "i0_percent",
      valueParser: numberParser,
      },
      { field: "shift_degree",
      valueParser: numberParser,
      },
      { field: "vector_group" },
      { field: "vk0_percent",
      valueParser: numberParser,
      },
      { field: "vkr0_percent",
      valueParser: numberParser,
      },
      { field: "mag0_percent",
      valueParser: numberParser,
      },
      { field: "si0_hv_partial",
      valueParser: numberParser,
      },
      { field: "tap_max",
      valueParser: numberParser,
      },
      { field: "tap_min", //tutaj może być liczba ujemna dlatego nie używam numberParser     
      },
      { field: "tap_step_percent",
      valueParser: numberParser,
      },
      { field: "tap_step_degree",
      valueParser: numberParser,
      },
      { field: "tap_phase_shifter",
      
      }

  ];
  
  
  //edit, delete, update, cancel*********
  function onCellClicked(params) {
  
    // Handle click event for action cells
    if (params.column.colId === "action" && params.event.target.dataset.action) {
      let action = params.event.target.dataset.action;
  
      if (action === "edit") {
        params.api.startEditingCell({
          rowIndex: params.node.rowIndex,
          // gets the first columnKey
          colKey: params.columnApi.getDisplayedCenterColumns()[0].colId
        });
      }
  
      if (action === "delete") {
        console.log(params)
        console.log(params.rowIndex)
  
        let removeRowIndex = params.rowIndex;   
        rowDefsDataTransformerDialog.splice(removeRowIndex, 1); //usun jeden element z indexu
        
          
        params.api.applyTransaction({
          remove: [params.node.data]
        });
      }
  
      if (action === "update") {
        var rowNode = gridOptionsTransformerDialog.api.getRowNode(params.node.rowIndex);      
        rowNode.setData(params.node.data);  

        params.api.stopEditing(false);
      }
  
      if (action === "cancel") {
        params.api.stopEditing(true);
      }
      if (action === "add") {
        rowDefsDataTransformerDialog.push(params.node.data)

        params.api.applyTransaction({
          add: [{}],
        });
      }
    }
  }
  function onRowEditingStarted(params) {
    params.api.refreshCells({
      columns: ["action"],
      rowNodes: [params.node],
      force: true
    });
  }
  function onRowEditingStopped(params) { 
   console.log(params) 

    params.api.refreshCells({
      columns: ["action"],
      rowNodes: [params.node],
      force: true
    });
  }
  function actionCellRenderer(params) {
  //function actionCellRenderer(params) {
      let eGui = document.createElement("div");
    
      let editingCells = params.api.getEditingCells();
      // checks if the rowIndex matches in at least one of the editing cells
      let isCurrentRowEditing = editingCells.some((cell) => {
        return cell.rowIndex === params.node.rowIndex;
      });
    
      if (isCurrentRowEditing) {
        eGui.innerHTML = `
            <button  
              class="action-button update"
              data-action="update">
                   update  
            </button>
            <button  
              class="action-button cancel"
              data-action="cancel">
                   cancel
            </button>          
            `;
      } else {
        eGui.innerHTML = `
            <button 
              class="action-button edit"  
              data-action="edit">
                 edit 
              </button>
            <button 
              class="action-button delete"
              data-action="delete">
                 delete
            </button>
            <button  
              class="action-button update"
              data-action="add">
                   add
            </button>
            `;
      }
    
      return eGui;
  }
  //**************************************
  
  
  //***********sprawdzenia poprawnego formatowania wprowadzanych parametrów */
  
  function numberParser(params) {
    if(Number(params.newValue) >= 0) {
      return(Number(params.newValue))
    }else {
      alert("The value must be number (comma separated) or >= 0")
      return(Number(params.oldValue))
    }
  }
  /*********************************************** */
  
  /* wczytywanie pliku CSV */
  function setTransformerCsvData(keys, values) {
  
        
    var result = {}; 
    keys.forEach((key, index) => {
      if (key != "Action"  && index != 0 ){
          result[key.toLowerCase()] = values[index];
      }                    
     });
     console.log("result")
     console.log(result)
  
     rowDefsDataTransformerDialog.push(result)
  
  
    gridOptionsTransformerDialog.api.setRowData(rowDefsDataTransformerDialog);
    
    /*
    params.api.refreshCells({
      columns: ["action"],
      rowNodes: [params.node],
      force: true
    });*/
    
  }
  
  var gridOptionsTransformerDialog = {
    suppressClickEdit: true, //edit, delete, update, cancel
    editType: "fullRow",
    rowSelection: "single",
      
    rowData: rowDefsDataTransformerDialog,
    columnDefs: columnDefsTransformerDialog,
    defaultColDef: {
      editable: true    
    },
  
    //edit, delete, update, cancel*****************
    onCellClicked: onCellClicked,   
    onRowEditingStarted: onRowEditingStarted, 
    onRowEditingStopped: onRowEditingStopped,
    onSelectionChanged: () => {
      const selectedData = gridOptionsTransformerDialog.api.getSelectedRows();
      //console.log('Selection Changed', selectedData);
    },
    //*********************************************
    
  };
  