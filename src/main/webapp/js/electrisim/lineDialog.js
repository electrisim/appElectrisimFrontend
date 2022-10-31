const rowDefsDataLineDialog = [
  { name: "type 1", r_ohm_per_km: 0.1, x_ohm_per_km: 0.4, c_nf_per_km: 0.7, g_us_per_km: 1.0, max_i_ka: 4.0, type:"cs"},
  { name: "type 2", r_ohm_per_km: 0.2, x_ohm_per_km: 0.5, c_nf_per_km: 0.8, g_us_per_km: 2.0, max_i_ka: 5.0, type:"cs" },
  { name: "type 3", r_ohm_per_km: 0.3, x_ohm_per_km: 0.6, c_nf_per_km: 0.9, g_us_per_km: 3.0, max_i_ka: 6.0, type:"cs" }
];     

const columnDefsLineDialog = [
    {
      headerName: "Action",
      minWidth: 100,
      cellRenderer: actionCellRenderer,      
      editable: false,
      colId: "action"
    },
    { field: "name" },
    { field: "r_ohm_per_km",
      valueParser: numberParser,
    },
    { field: "x_ohm_per_km",
    valueParser: numberParser,
    },
    { field: "c_nf_per_km",
    valueParser: numberParser,
    },
    { field: "g_us_per_km",
    valueParser: numberParser,
    },
    { field: "max_i_ka",
    valueParser: numberParser,
    },
    { field: "type" } 

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
      rowDefsDataLineDialog.splice(removeRowIndex, 1); //usun jeden element z indexu
      
      //rowDefsDataLineDialog.push(newRow)
      /*let newRowData = rowDefsDataLineDialog.filter(row => {
        return row !== removeRow;
      });*/
      //gridOptionsLineDialog.api.setRowData(newRowData);
      

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
 // let newRow = params.data;   
 // rowDefsDataLineDialog.push(newRow)
 // gridOptionsLineDialog.api.setRowData(rowDefsDataLineDialog);

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
function setLineCsvData(keys, values) {

  console.log("jestem w setCsvData")
  
  var result = {}; 
  keys.forEach((key, index) => {
    if (key != "Action"  && index != 0 ){
        result[key.toLowerCase()] = values[index];
    }                    
   });
   console.log("result")
   console.log(result)

   rowDefsDataLineDialog.push(result)

 // gridOptionsLineDialog.api.setRowData([...rowDefsDataLineDialog, params]);
    gridOptionsLineDialog.api.setRowData(rowDefsDataLineDialog);
  
  /*
  params.api.refreshCells({
    columns: ["action"],
    rowNodes: [params.node],
    force: true
  });*/
  
}

var gridOptionsLineDialog = {
  suppressClickEdit: true, //edit, delete, update, cancel
  editType: "fullRow",
  rowSelection: "single",
    
  rowData: rowDefsDataLineDialog,
  columnDefs: columnDefsLineDialog,
  defaultColDef: {
    editable: true    
  },

  //edit, delete, update, cancel*****************
  onCellClicked: onCellClicked,   
  onRowEditingStarted: onRowEditingStarted, 
  onRowEditingStopped: onRowEditingStopped,
  onSelectionChanged: () => {
    const selectedData = gridOptionsLineDialog.api.getSelectedRows();
    //console.log('Selection Changed', selectedData);
  },
  //*********************************************
  
};




