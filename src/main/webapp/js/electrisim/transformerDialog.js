const rowDefsDataTransformerDialog = [
    { name: "type 1", sn_mva: 0.1, vn_hv_kv: 0.4, vn_lv_kv: 0.7, vkr_percent: 1.0, vk_percent: 4.0, pfe_kw:1.0, i0_percent:1.0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:1.0, tap_min:1.0, tap_step_percent:1.0, tap_step_degree:1.0, tap_phase_shiftert:1.0},
    { name: "type 2", sn_mva: 0.1, vn_hv_kv: 0.4, vn_lv_kv: 0.7, vkr_percent: 1.0, vk_percent: 4.0, pfe_kw:1.0, i0_percent:1.0, vector_group:"Dyn", vk0_percent:1.0, vkr0_percent:1.0, mag0_percent:1.0, si0_hv_partial:1.0, tap_max:1.0, tap_min:1.0, tap_step_percent:1.0, tap_step_degree:1.0, tap_phase_shiftert:1.0},   
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
      { field: "tap_min",
      valueParser: numberParser,
      },
      { field: "tap_step_percent",
      valueParser: numberParser,
      },
      { field: "tap_step_degree",
      valueParser: numberParser,
      },
      { field: "tap_phase_shiftert",
      valueParser: numberParser,
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
        rowDefsDataTransformer.splice(removeRowIndex, 1); //usun jeden element z indexu
        
          
        params.api.applyTransaction({
          remove: [params.node.data]
        });
      }
  
      if (action === "update") {
        params.api.stopEditing(false);
      }
  
      if (action === "cancel") {
        params.api.stopEditing(true);
      }
      if (action === "add") {
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
  