
function loadFlowOpenDss(a, b, c) {

    //a - App
    //b - Graph
    //c - Editor

    let apka = a
    let grafka = b

    b.isEnabled() && !b.isCellLocked(b.getDefaultParent()) && a.showLoadFlowDialogOpenDSS("", "Calculate", function (a, c) {

        apka.spinner.spin(document.body, "Waiting for results...")


        //a - parametry obliczeń rozpływowych                
        //b = graph

        //jeśli parametry zostały wpisane policz rozpływ

        if (0 < a.length) {

            //liczba obiektów               
            const cellsArray = b.getModel().getDescendants()


            let busbarNo = 0
            let externalGridNo = 0
            let generatorNo = 0


            let loadNo = 0

            let transformerNo = 0
            let threeWindingTransformerNo = 0

            let shuntReactorNo = 0
            let capacitorNo = 0

            let motorNo = 0

            let lineNo = 0

            let storageNo = 0

            //Arrays
            let simulationParametersArray = [];

            let busbarArray = [];

            let externalGridArray = [];
            let generatorArray = [];


            let loadArray = [];


            let transformerArray = [];
            let threeWindingTransformerArray = [];

            let shuntReactorArray = [];
            let capacitorArray = [];

            let motorArray = [];

            let lineArray = [];


            let storageArray = [];

            let dataToBackendArray = [];


            //***************SCZYTYWANIE PARAMETRÓW ROZPŁYWU****************
            let loadFlowParameters = new Object();
            loadFlowParameters.typ = "PowerFlowOpenDss Parameters" //używam PowerFlow zamiast LoadFlow, bo w pythonie występuje błąd
            loadFlowParameters.frequency = a[0]
            loadFlowParameters.algorithm = a[1]

            //for(let i = 0; i < a.length; i++) {

            simulationParametersArray.push(loadFlowParameters)


            //*************** SCZYTYWANIE MODELU DO BACKEND ****************
            //trzeba rozpoznawać po style - styleELXXX = np. Transformer
            const regex = /^\d/g;

            for (let cell of cellsArray) {

                //usun wyniki poprzednich obliczen
                if (typeof (cell.getStyle()) != undefined && cell.getStyle() != null && cell.getStyle().includes("Result")) {

                    let celka = b.getModel().getCell(cell.id)
                    b.getModel().remove(celka)
                }

                if (typeof (cell.getStyle()) != undefined && cell.getStyle() != null) {


                    let key_value = cell.getStyle().split(";").map(pair => pair.split("="));
                    const result = Object.fromEntries(key_value);
                    console.log(result.shapeELXXX)


                    //currently the Open-DSS can work with Busbars, Lines, Loads, Transformers, Capacitors, Generators, Storages            
                    // Define the array of values to check against
                    let excludedValues = ["Result", undefined, "External Grid", "Bus", "Line", "Load", "Transformer", "Capacitor", "Generator", "Storage"];
                    // Check if the property value is not in the array of excluded values

                    
                    if (!excludedValues.includes(result.shapeELXXX)) {
                        alert("currently the Open-DSS can work with External Grid, Busbars, Lines, Loads, Transformers, Capacitors, Generators, Storages. All other elements will be excluded from calculation")
                    }
                    //wybierz obiekty typu Ext_grid
                    if (result.shapeELXXX == "External Grid") {

                        //zrób plik json i wyślij do backend
                        let externalGrid = new Object();
                        externalGrid.typ = "External Grid" + externalGridNo

                        externalGrid.name = cell.mxObjectId.replace('#', '_')
                        externalGrid.id = cell.id


                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if (cell.edges[0].target.mxObjectId != cell.mxObjectId) {
                            externalGrid.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar

                        } else {
                            externalGrid.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar

                        }

                        //Load_flow_parameters 
                        externalGrid.vm_pu = cell.value.attributes[2].nodeValue
                        externalGrid.va_degree = cell.value.attributes[3].nodeValue
                        //externalGrid.in_service = cell.value.attributes[3].nodeValue

                        //Short_circuit_parameters 
                        externalGrid.s_sc_max_mva = cell.value.attributes[5].nodeValue
                        externalGrid.s_sc_min_mva = cell.value.attributes[6].nodeValue
                        externalGrid.rx_max = cell.value.attributes[7].nodeValue
                        externalGrid.rx_min = cell.value.attributes[8].nodeValue
                        externalGrid.r0x0_max = cell.value.attributes[9].nodeValue
                        externalGrid.x0x_max = cell.value.attributes[10].nodeValue

                        externalGridNo++

                        //let externalGridToBackend = JSON.stringify(externalGrid) //{"name":"External Grid 0","vm_pu":"0", "bus":"mxCell#34"}      
                        externalGridArray.push(externalGrid);
                    }

                    //wybierz obiekty typu Generator
                    if (result.shapeELXXX == "Generator")//cell.getStyle().match(/^Generator$/))//includes("Generator")) //(str1.match(/^abc$/))
                    {
                        //zrób plik json i wyślij do backend
                        let generator = new Object();
                        generator.typ = "Generator"

                        generator.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        generator.id = cell.id


                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if (cell.edges[0].target.mxObjectId != cell.mxObjectId) {
                            generator.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar

                        } else {
                            generator.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        }

                        //Load_flow_parameters 
                        generator.p_mw = cell.value.attributes[2].nodeValue
                        generator.vm_pu = cell.value.attributes[3].nodeValue
                        generator.sn_mva = cell.value.attributes[4].nodeValue
                        generator.scaling = cell.value.attributes[5].nodeValue

                        //Short_circuit_parameters 
                        generator.vn_kv = cell.value.attributes[7].nodeValue
                        generator.xdss_pu = cell.value.attributes[8].nodeValue
                        generator.rdss_ohm = cell.value.attributes[9].nodeValue
                        generator.cos_phi = cell.value.attributes[10].nodeValue
                        generator.pg_percent = cell.value.attributes[11].nodeValue
                        generator.power_station_trafo = cell.value.attributes[12].nodeValue

                        generatorNo++

                        generatorArray.push(generator);
                    }

                    //wybierz obiekty typu Bus 
                    if (result.shapeELXXX == "Bus") {

                        //zrób plik json i wyślij do backend
                        let busbar = new Object();
                        busbar.typ = "Bus" + busbarNo

                        busbar.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        busbar.id = cell.id

                        //Load_flow_parameters
                        busbar.vn_kv = cell.value.attributes[2].nodeValue
                        //busbar.type = cell.value.attributes[3].nodeValue
                        //busbar.in_service = cell.value.attributes[3].nodeValue
                        busbarNo++

                        busbarArray.push(busbar);
                    }


                    //wybierz obiekty typu Transformer
                    if (result.shapeELXXX == "Transformer") {

                        //zrób plik json i wyślij do backend
                        let transformer = new Object();
                        transformer.typ = "Transformer" + transformerNo

                        transformer.name = cell.mxObjectId.replace('#', '_')//cell.id.replaceAll('-', '___')
                        transformer.id = cell.id

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if (cell.edges[0].target.mxObjectId != cell.mxObjectId) {
                            transformer.hv_bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        } else {
                            transformer.hv_bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if (cell.edges[1].target.mxObjectId != cell.mxObjectId) {
                            transformer.lv_bus = cell.edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        } else {
                            transformer.lv_bus = cell.edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters    
                        transformer.sn_mva = cell.value.attributes[4].nodeValue
                        transformer.vn_hv_kv = cell.value.attributes[5].nodeValue
                        transformer.vn_lv_kv = cell.value.attributes[6].nodeValue

                        //transformer.in_service = cell.value.attributes[15].nodeValue

                        //Short_circuit_parameters
                        transformer.vkr_percent = cell.value.attributes[8].nodeValue
                        transformer.vk_percent = cell.value.attributes[9].nodeValue
                        transformer.pfe_kw = cell.value.attributes[10].nodeValue
                        transformer.i0_percent = cell.value.attributes[11].nodeValue
                        transformer.vector_group = cell.value.attributes[12].nodeValue
                        transformer.vk0_percent = cell.value.attributes[13].nodeValue
                        transformer.vkr0_percent = cell.value.attributes[14].nodeValue
                        transformer.mag0_percent = cell.value.attributes[15].nodeValue
                        transformer.si0_hv_partial = cell.value.attributes[16].nodeValue
                        //transformer.in_service = cell.value.attributes[15].nodeValue

                        //Optional_parameters
                        transformer.parallel = cell.value.attributes[18].nodeValue
                        transformer.shift_degree = cell.value.attributes[19].nodeValue
                        transformer.tap_side = cell.value.attributes[20].nodeValue
                        transformer.tap_pos = cell.value.attributes[21].nodeValue
                        transformer.tap_neutral = cell.value.attributes[22].nodeValue
                        transformer.tap_max = cell.value.attributes[23].nodeValue
                        transformer.tap_min = cell.value.attributes[24].nodeValue
                        transformer.tap_step_percent = cell.value.attributes[25].nodeValue
                        transformer.tap_step_degree = cell.value.attributes[26].nodeValue
                        transformer.tap_phase_shifter = cell.value.attributes[27].nodeValue

                        /*
                        transformer.max_loading_percent = cell.value.attributes[26].nodeValue
                        transformer.df = cell.value.attributes[27].nodeValue
                        transformer.oltc = cell.value.attributes[28].nodeValue
                        transformer.xn_ohm = cell.value.attributes[29].nodeValue */

                        transformerNo++

                        //let transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        transformerArray.push(transformer);
                    }

                    //zamień w transformerArray kolejności busbar (hv, lv)
                    //porównaj dwa napięcia i dzięki temu określ który jest HV i LV dla danego transformatora
                    //let twoWindingBusbarArray = [];

                    /*for (let xx = 0; xx < transformerArray.length; i++) {

                        bus1 = busbarArray.find(element => element.name == transformerArray[i].hv_bus);
                        bus2 = busbarArray.find(element => element.name == transformerArray[i].lv_bus);
                        twoWindingBusbarArray.push(bus1)
                        twoWindingBusbarArray.push(bus2)


                        let busbarWithHighestVoltage = twoWindingBusbarArray.reduce(
                            (prev, current) => {

                                return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                            }
                        );
                        let busbarWithLowestVoltage = twoWindingBusbarArray.reduce(
                            (prev, current) => {
                                return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                            }
                        );

                        transformerArray[i].hv_bus = busbarWithHighestVoltage.name
                        transformerArray[i].lv_bus = busbarWithLowestVoltage.name
                    } */

                    //wybierz obiekty typu Three Winding Transformer
                    if (result.shapeELXXX == "Three Winding Transformer") {
                        //zrób plik json i wyślij do backend
                        let threeWindingTransformer = new Object();
                        threeWindingTransformer.typ = "Three Winding Transformer" + threeWindingTransformerNo

                        threeWindingTransformer.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        threeWindingTransformer.id = cell.id

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if (cell.edges[2].target.mxObjectId != cell.mxObjectId) {
                            threeWindingTransformer.hv_bus = cell.edges[2].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }
                        else {
                            threeWindingTransformer.hv_bus = cell.edges[2].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }

                        if (cell.edges[1].target.mxObjectId != cell.mxObjectId) {
                            threeWindingTransformer.mv_bus = cell.edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        } else {
                            threeWindingTransformer.mv_bus = cell.edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        }

                        if (cell.edges[0].target.mxObjectId != cell.mxObjectId) {
                            threeWindingTransformer.lv_bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        } else {
                            threeWindingTransformer.lv_bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        threeWindingTransformer.sn_hv_mva = cell.value.attributes[4].nodeValue
                        threeWindingTransformer.sn_mv_mva = cell.value.attributes[5].nodeValue
                        threeWindingTransformer.sn_lv_mva = cell.value.attributes[6].nodeValue
                        threeWindingTransformer.vn_hv_kv = cell.value.attributes[7].nodeValue
                        threeWindingTransformer.vn_mv_kv = cell.value.attributes[8].nodeValue
                        threeWindingTransformer.vn_lv_kv = cell.value.attributes[9].nodeValue
                        threeWindingTransformer.vk_hv_percent = cell.value.attributes[10].nodeValue
                        threeWindingTransformer.vk_mv_percent = cell.value.attributes[11].nodeValue
                        threeWindingTransformer.vk_lv_percent = cell.value.attributes[12].nodeValue

                        //Short_circuit_parameters [13]
                        threeWindingTransformer.vkr_hv_percent = cell.value.attributes[14].nodeValue
                        threeWindingTransformer.vkr_mv_percent = cell.value.attributes[15].nodeValue
                        threeWindingTransformer.vkr_lv_percent = cell.value.attributes[16].nodeValue
                        threeWindingTransformer.pfe_kw = cell.value.attributes[17].nodeValue
                        threeWindingTransformer.i0_percent = cell.value.attributes[18].nodeValue
                        threeWindingTransformer.vk0_hv_percent = cell.value.attributes[19].nodeValue
                        threeWindingTransformer.vk0_mv_percent = cell.value.attributes[20].nodeValue
                        threeWindingTransformer.vk0_lv_percent = cell.value.attributes[21].nodeValue
                        threeWindingTransformer.vkr0_hv_percent = cell.value.attributes[22].nodeValue
                        threeWindingTransformer.vkr0_mv_percent = cell.value.attributes[23].nodeValue
                        threeWindingTransformer.vkr0_lv_percent = cell.value.attributes[24].nodeValue
                        threeWindingTransformer.vector_group = cell.value.attributes[25].nodeValue

                        //Optional_parameters [26]
                        threeWindingTransformer.shift_mv_degree = cell.value.attributes[27].nodeValue
                        threeWindingTransformer.shift_lv_degree = cell.value.attributes[28].nodeValue
                        threeWindingTransformer.tap_step_percent = cell.value.attributes[29].nodeValue
                        threeWindingTransformer.tap_side = cell.value.attributes[30].nodeValue
                        threeWindingTransformer.tap_neutral = cell.value.attributes[31].nodeValue
                        threeWindingTransformer.tap_min = cell.value.attributes[32].nodeValue
                        threeWindingTransformer.tap_max = cell.value.attributes[33].nodeValue
                        threeWindingTransformer.tap_pos = cell.value.attributes[34].nodeValue
                        threeWindingTransformer.tap_at_star_point = cell.value.attributes[35].nodeValue
                        threeWindingTransformerNo++

                        //let transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        threeWindingTransformerArray.push(threeWindingTransformer);
                    }

                    if (result.shapeELXXX == "Shunt Reactor") {

                        //zrób plik json i wyślij do backend
                        let shuntReactor = new Object();
                        shuntReactor.typ = "Shunt Reactor" + shuntReactorNo
                        shuntReactor.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')                                
                        shuntReactor.id = cell.id


                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if (cell.edges[0].target.mxObjectId != cell.mxObjectId) {
                            shuntReactor.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        } else {
                            shuntReactor.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        shuntReactor.p_mw = cell.value.attributes[2].nodeValue
                        shuntReactor.q_mvar = cell.value.attributes[3].nodeValue
                        shuntReactor.vn_kv = cell.value.attributes[4].nodeValue

                        //Optional_parameters                        
                        shuntReactor.step = cell.value.attributes[6].nodeValue
                        shuntReactor.max_step = cell.value.attributes[7].nodeValue

                        shuntReactorNo++

                        //let transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        shuntReactorArray.push(shuntReactor);
                    }

                    if (result.shapeELXXX == "Capacitor") {

                        //zrób plik json i wyślij do backend
                        let capacitor = new Object();
                        capacitor.typ = "Capacitor" + capacitorNo
                        capacitor.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')                                                 
                        capacitor.id = cell.id

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if (cell.edges[0].target.mxObjectId != cell.mxObjectId) {
                            capacitor.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        } else {
                            capacitor.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        capacitor.q_mvar = cell.value.attributes[2].nodeValue
                        capacitor.loss_factor = cell.value.attributes[3].nodeValue
                        capacitor.vn_kv = cell.value.attributes[4].nodeValue
                        //Optional_parameters

                        capacitor.step = cell.value.attributes[6].nodeValue
                        capacitor.max_step = cell.value.attributes[7].nodeValue

                        capacitorNo++

                        //let transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        capacitorArray.push(capacitor);
                    }


                    //wybierz obiekty typu Load
                    if (result.shapeELXXX == "Load") {

                        //zrób plik json i wyślij do backend
                        let load = new Object();
                        load.typ = "Load" + loadNo
                        load.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        load.id = cell.id

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if (cell.edges[0].target.mxObjectId != cell.mxObjectId) {
                            load.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }
                        else {
                            load.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        load.p_mw = cell.value.attributes[2].nodeValue
                        load.q_mvar = cell.value.attributes[3].nodeValue
                        load.const_z_percent = cell.value.attributes[4].nodeValue
                        load.const_i_percent = cell.value.attributes[5].nodeValue
                        load.sn_mva = cell.value.attributes[6].nodeValue
                        load.scaling = cell.value.attributes[7].nodeValue
                        load.type = cell.value.attributes[8].nodeValue

                        loadNo++

                        loadArray.push(load);
                    }


                    if (result.shapeELXXX == "Motor") {
                        //zrób plik json i wyślij do backend
                        let motor = new Object();
                        motor.typ = "Motor" + motorNo
                        motor.name = cell.mxObjectId.replace('#', '_')
                        motor.id = cell.id

                        if (cell.edges[0].target.mxObjectId != cell.mxObjectId) {
                            motor.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        } else {
                            motor.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '                            
                        }

                        //Load_flow_parameters
                        motor.pn_mech_mw = cell.value.attributes[2].nodeValue
                        motor.cos_phi = cell.value.attributes[3].nodeValue
                        motor.efficiency_percent = cell.value.attributes[4].nodeValue
                        motor.loading_percent = cell.value.attributes[5].nodeValue
                        motor.scaling = cell.value.attributes[6].nodeValue

                        //Short_circuit_parameters
                        motor.cos_phi_n = cell.value.attributes[8].nodeValue
                        motor.efficiency_n_percent = cell.value.attributes[9].nodeValue
                        motor.Irc_pu = cell.value.attributes[10].nodeValue
                        motor.rx = cell.value.attributes[11].nodeValue
                        motor.vn_kv = cell.value.attributes[12].nodeValue

                        //Optional_parameters
                        motor.efficiency_percent = cell.value.attributes[14].nodeValue
                        motor.loading_percent = cell.value.attributes[15].nodeValue
                        motor.scaling = cell.value.attributes[16].nodeValue

                        motorNo++

                        motorArray.push(motor);
                    }

                    if (result.shapeELXXX == "Storage") {
                        //zrób plik json i wyślij do backend
                        let storage = new Object();
                        storage.typ = "Storage" + storageNo
                        storage.name = cell.mxObjectId.replace('#', '_')
                        storage.id = cell.id

                        if (cell.edges[0].target.mxObjectId != cell.mxObjectId) {
                            storage.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        } else {
                            storage.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        storage.p_mw = cell.value.attributes[2].nodeValue
                        storage.max_e_mwh = cell.value.attributes[3].nodeValue

                        //Optional_parameters
                        storage.q_mvar = cell.value.attributes[4].nodeValue
                        storage.sn_mva = cell.value.attributes[5].nodeValue
                        storage.soc_percent = cell.value.attributes[6].nodeValue
                        storage.min_e_mwh = cell.value.attributes[7].nodeValue
                        storage.scaling = cell.value.attributes[8].nodeValue
                        storage.type = cell.value.attributes[9].nodeValue

                        storageNo++

                        storageArray.push(storage);
                    }


                    //wybierz obiekty typu Line
                    if (result.shapeELXXX == "Line") {

                        //zrób plik json i wyślij do backend
                        let line = new Object();
                        line.typ = "Line" + lineNo

                        line.name = cell.mxObjectId.replace('#', '_')//id.replaceAll('-', '___')
                        line.id = cell.id

                        line.busFrom = cell.source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.source.mxObjectId.replace('#', '')                        
                        line.busTo = cell.target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.target.mxObjectId.replace('#', '')

                        line.length_km = cell.value.attributes[2].nodeValue
                        line.parallel = cell.value.attributes[3].nodeValue
                        line.df = cell.value.attributes[4].nodeValue

                        //Load_flow_parameters
                        line.r_ohm_per_km = cell.value.attributes[8].nodeValue
                        line.x_ohm_per_km = cell.value.attributes[9].nodeValue
                        line.c_nf_per_km = cell.value.attributes[10].nodeValue
                        line.g_us_per_km = cell.value.attributes[11].nodeValue
                        line.max_i_ka = cell.value.attributes[12].nodeValue
                        line.type = cell.value.attributes[13].nodeValue

                        //line.in_service = cell.value.attributes[13].nodeValue

                        //Short_circuit_parameters
                        line.r0_ohm_per_km = cell.value.attributes[15].nodeValue ////w specyfikacji PandaPower jako nan
                        line.x0_ohm_per_km = cell.value.attributes[16].nodeValue //w specyfikacji PandaPower jako nan
                        line.c0_nf_per_km = cell.value.attributes[17].nodeValue //w specyfikacji PandaPower jako nan
                        line.endtemp_degree = cell.value.attributes[18].nodeValue //w specyfikacji PandaPower jako nan

                        lineNo++

                        lineArray.push(line);
                    }

                }
            }


            //OKREŚLENIE HV BUSBAR
            for (let i = 0; i < transformerArray.length; i++) {
                let twoWindingBusbarArray = [];


                bus1 = busbarArray.find(element => element.name == transformerArray[i].hv_bus);
                bus2 = busbarArray.find(element => element.name == transformerArray[i].lv_bus);


                twoWindingBusbarArray.push(bus1)
                twoWindingBusbarArray.push(bus2)


                let busbarWithHighestVoltage = twoWindingBusbarArray.reduce(
                    (prev, current) => {

                        return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                    }
                );
                let busbarWithLowestVoltage = twoWindingBusbarArray.reduce(
                    (prev, current) => {
                        return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                    }
                );

                transformerArray[i].hv_bus = busbarWithHighestVoltage.name
                transformerArray[i].lv_bus = busbarWithLowestVoltage.name
            }

            //zamień w threeWindingTransformerArray kolejności busbar (hv, mv, lv)
            //porównaj trzy napięcia i dzięki temu określ który jest HV, MV i LV


            for (let i = 0; i < threeWindingTransformerArray.length; i++) {
                let threeWindingBusbarArray = [];


                bus1 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].hv_bus);
                bus2 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].mv_bus);
                bus3 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].lv_bus);
                threeWindingBusbarArray.push(bus1)
                threeWindingBusbarArray.push(bus2)
                threeWindingBusbarArray.push(bus3)               

                let busbarWithHighestVoltage = threeWindingBusbarArray.reduce(
                    (prev, current) => {

                        return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                    }
                );
                let busbarWithLowestVoltage = threeWindingBusbarArray.reduce(
                    (prev, current) => {
                        return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                    }
                );

                let busbarWithMiddleVoltage = threeWindingBusbarArray.find(element => element.name != busbarWithHighestVoltage.name && element.name != busbarWithLowestVoltage.name);

                threeWindingTransformerArray[i].hv_bus = busbarWithHighestVoltage.name
                threeWindingTransformerArray[i].mv_bus = busbarWithMiddleVoltage.name
                threeWindingTransformerArray[i].lv_bus = busbarWithLowestVoltage.name
            }

            array = [
                ...dataToBackendArray,
                ...simulationParametersArray,
                ...externalGridArray,
                ...generatorArray,
                ...busbarArray,
                ...transformerArray,
                ...threeWindingTransformerArray,
                ...shuntReactorArray,
                ...capacitorArray,
                ...loadArray,
                ...motorArray,
                ...storageArray,
                ...lineArray
            ];


            let obj = Object.assign({}, array);
            console.log(JSON.stringify(obj))


            let printArray = function (arr) {
                if (typeof (arr) == "object") {
                    for (let i = 0; i < arr.length; i++) {
                        printArray(arr[i]);
                    }
                }
                else document.write(arr);
            }

           

            //*************** KONIEC - SCZYTYWANIE MODELU DO BACKEND ****************

            //wysyłanie do backend i otrzymywanie wyników
            let dataReceived = "";

            // this.createVertexTemplateEntry("line;strokeWidth=2;html=1;shapeELXXX=Bus;", 160, 10, "", "Bus"),



            //bootstrap button with spinner 
            // this.ui.spinner.stop();
            fetch("https://03dht3kc-5000.euw.devtunnels.ms/", {  //http://54.159.5.204:5000///http://127.0.0.1:5000/ //  https://electrisim-0fe342b90b0c.herokuapp.com/
                mode: "cors",
                method: "post",

                headers: {
                    "Content-Type": "application/json",
                    //"Access-Control-Allow-Origin":"*",  //BYŁO NIEPRAWIDŁOWO, TEN PARAMETR TRZEBA NA SERWERZE UMIESZCZAĆ                                                 

                },
                body: JSON.stringify(obj)
            })

                .then(response => {
                    apka.spinner.stop();


                    if (response.status === 200) {
                        return response.json()
                    } else {
                        return Promise.reject("server")
                    }
                })
                .then(dataJson => {

                    //Obsługiwanie błędów
                    if (dataJson[0] != undefined) {
                        if (dataJson[0] == "line") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (let i = 1; i < dataJson.length; i++) {

                                alert("Line" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0] == "bus") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (let i = 1; i < dataJson.length; i++) {

                                alert("Bus" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0] == "ext_grid") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (let i = 1; i < dataJson.length; i++) {

                                alert("External Grid" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0][0] == "trafo3w") {

                            alert("Three-winding transformer: nominal voltage does not match")
                            //rozpływ się nie udał, output z diagnostic_function
                            //for (let i = 1; i < dataJson.length; i++) {
                            //    console.log(dataJson[i])
                            //    alert("Three Winding Transformer"+dataJson[i][0]+" " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            //}
                        }
                        if (dataJson[0] == "overload") {
                            alert("One of the element is overloaded. The load flow did not converge. Change the input parameters or contact electrisim@electrisim.com for further support. ")

                        }
                    }


                    //*************** WYŚWIETLANIE WYNIKÓW NA DIAGRAMIE ****************

                    let style = new Object();
                    style[mxConstants.STYLE_FONTSIZE] = '6';
                    //style[mxConstants.STYLE_SHAPE] = 'box';
                    //style[mxConstants.STYLE_STROKECOLOR] = '#000000';
                    //style[mxConstants.STYLE_FONTCOLOR] = '#000000';

                    b.getStylesheet().putCellStyle('labelstyle', style);


                    let lineStyle = new Object();
                    lineStyle[mxConstants.STYLE_FONTSIZE] = '6';
                    lineStyle[mxConstants.STYLE_STROKE_OPACITY] = '0';
                    //lineStyle[mxConstants.STYLE_OVERFLOW] = 'hidden';

                    b.getStylesheet().putCellStyle('lineStyle', lineStyle);


                    //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Busbar
                    //let csvContent = "data:text/csv;charset=utf-8,Busbar Name,v_m, va_degree, p_mw, q_mvar, pf, q_p\n";

                    for (let i = 0; i < dataJson.busbars.length; i++) {
                        resultId = dataJson.busbars[i].id

                        dataJson.busbars[i].name = dataJson.busbars[i].name.replace('_', '#')

                        //for the csv file
                        //let row = Object.values(dataJson.busbars[i]).join(",")
                        //csvContent += row + "\r\n";

                        //create label
                        let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId                             

                        let resultString = 'Bus' +
                            "\n U[pu]: " + dataJson.busbars[i].vm_pu.toFixed(3) +
                            "\n U[degree]: " + dataJson.busbars[i].va_degree.toFixed(3)

                        /*
                        "\n P[MW]: " + dataJson.busbars[i].p_mw.toFixed(3) +
                        "\n Q[MVar]: " + dataJson.busbars[i].q_mvar.toFixed(3) +
                        "\n PF: " + dataJson.busbars[i].pf.toFixed(3) +
                        "\n Q/P: "+ dataJson.busbars[i].q_p.toFixed(3)*/

                        let labelka = b.insertVertex(resultCell, null, resultString, 0, 2.7, 0, 0, 'shapeELXXX=Result', true)
                        b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                        b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])


                        //zmiana kolorów przy przekroczeniu obciążenia linii
                        if (dataJson.busbars[i].vm_pu.toFixed(2) >= 1.1 || dataJson.busbars[i].vm_pu.toFixed(2) <= 0.9) {

                            let style = grafka.getModel().getStyle(resultCell);
                            let newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, 'red');
                            let cs = new Array();
                            cs[0] = resultCell;
                            grafka.setCellStyle(newStyle, cs);

                        }
                        if ((dataJson.busbars[i].vm_pu.toFixed(2) > 1.05 && dataJson.busbars[i].vm_pu.toFixed(2) <= 1.1) || (dataJson.busbars[i].vm_pu.toFixed(2) > 0.9 && dataJson.busbars[i].vm_pu.toFixed(2) <= 0.95)) {

                            let style = grafka.getModel().getStyle(resultCell);
                            let newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, 'orange');
                            let cs = new Array();
                            cs[0] = resultCell;
                            grafka.setCellStyle(newStyle, cs);
                        }
                        if ((dataJson.busbars[i].vm_pu.toFixed(2) > 1 && dataJson.busbars[i].vm_pu.toFixed(2) <= 1.05) || (dataJson.busbars[i].vm_pu.toFixed(2) > 0.95 && dataJson.busbars[i].vm_pu.toFixed(2) <= 1)) {


                            let style = grafka.getModel().getStyle(resultCell);
                            let newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, 'green');
                            let cs = new Array();
                            cs[0] = resultCell;
                            grafka.setCellStyle(newStyle, cs);
                        }

                        /*
                        let x = 0.2
                        let y = 1
                        let ydelta = 0.8         
                        
                        b.insertVertex(resultCell, null, 'U[pu]: ' + dataJson.busbars[i].vm_pu.toFixed(3), x, y+ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'U[degree]: ' + dataJson.busbars[i].va_degree.toFixed(3), x, y+2*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'P[MW]: ' + dataJson.busbars[i].p_mw.toFixed(3), x, y+3*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'Q[MVar]: ' + dataJson.busbars[i].q_mvar.toFixed(3), x, y+4*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'PF: ' + dataJson.busbars[i].pf.toFixed(3), x, y+5*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  */

                    }

                    if (dataJson.lines != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Line
                        //csvContent += "Line Name, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, i_from_ka, i_to_ka, loading_percent \n";
                        //for (let i = 0; i < dataJson.lines.length; i++) {
                        for (let cell of dataJson.lines) {

                            resultId = cell.id

                            cell.name = cell.name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(cell).join(",")
                            //csvContent += row + "\r\n";

                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId


                            let linia = b.getModel().getCell(resultId)


                            //było tu wcześniej
                            //linia.value.attributes[6].nodeValue +
                            let resultString = "\n P_from[MW]: " + cell.p_from_mw.toFixed(3) +
                                "\n Q_from[MVar]: " + cell.q_from_mvar.toFixed(3) +
                                "\n i_from[kA]: " + cell.i_from_ka.toFixed(3) +
                                /*"\n"+
                                "\n Loading[%]: " + cell.loading_percent.toFixed(1) +
                                "\n"+*/
                                "\n P_to[MW]: " + cell.p_to_mw.toFixed(3) +
                                "\n Q_to[MVar]: " + cell.q_to_mvar.toFixed(3) +
                                "\n i_to[kA]: " + cell.i_to_ka.toFixed(3)


                            let labelka = b.insertEdge(resultCell, null, resultString, linia.source, linia.target, 'shapeELXXX=Result')

                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_STROKE_OPACITY, '0', [labelka])
                            b.setCellStyles(mxConstants.STYLE_STROKECOLOR, 'white', [labelka])
                            b.setCellStyles(mxConstants.STYLE_STROKEWIDTH, '0', [labelka])
                            b.setCellStyles(mxConstants.STYLE_OVERFLOW, 'hidden', [labelka])
                            b.orderCells(true, [labelka]); //edge wyświetla się 'pod' linią                 


                            /*
                            b.insertVertex(resultCell, null, 'P[MW]: ' + cell.p_from_mw.toFixed(3), -0.8, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                            b.insertVertex(resultCell, null, 'Q[MVar]: ' + cell.q_from_mvar.toFixed(3), -0.7, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                            b.insertVertex(resultCell, null, 'i[kA]: ' + cell.i_from_ka.toFixed(3), -0.6, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');    
                            */

                            /*
                            if (dataJson.parameter[i] == 'i_ka') {
                                let label12 = b.insertVertex(resultCell, null, 'I[kA]: ' + dataJson.value[i].toFixed(3), -0.4, 43, 0, 0, 'labelstyle', true);
                            }
                            
                            if (dataJson.parameter[i] == 'pl_mw') {
                                let label12 = b.insertVertex(resultCell, null, 'Pl[MW]: ' + dataJson.value[i].toFixed(3), -0.2, 43, 0, 0, 'labelstyle', true);
                            }
                            if (dataJson.parameter[i] == 'ql_mvar') {
                                let label12 = b.insertVertex(resultCell, null, 'Ql[MVar]: ' + dataJson.value[i].toFixed(3), -0.1, 43, 0, 0, 'labelstyle', true);
                            } */

                            /*
                            let label12 = b.insertVertex(resultCell, null, 'Loading[%]: ' + cell.loading_percent.toFixed(1), -0.3, 43, 0, 0, 'labelstyle', true);
                            label12.setStyle('shapeELXXX=Result')
                            label12.setAttribute('idELXXX', 'lineLoadingId')
                            */

                            //zmiana kolorów przy przekroczeniu obciążenia linii
                            /*
                            if(cell.loading_percent.toFixed(1) > 100){
                    
                                
                    
                                let style=grafka.getModel().getStyle(linia);
                                let newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                                let cs= new Array();
                                cs[0]=linia;
                                grafka.setCellStyle(newStyle,cs);                              
                                
                            }
                            if(cell.loading_percent.toFixed(1) > 80 && cell.loading_percent.toFixed(1) <= 100){
                    
                                                 
                                let style=grafka.getModel().getStyle(linia);
                                let newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'orange');
                                let cs= new Array();
                                cs[0]=linia;
                                grafka.setCellStyle(newStyle,cs); 
                            }
                            if(cell.loading_percent.toFixed(1) > 0 && cell.loading_percent.toFixed(1) <= 80){
                    
                                                 
                                let style=grafka.getModel().getStyle(linia);
                                let newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'green');
                                let cs= new Array();
                                cs[0]=linia;
                                grafka.setCellStyle(newStyle,cs); 
                            }
                            */

                            /*
                             b.insertVertex(resultCell, null, 'Line', 0.6, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                             b.insertVertex(resultCell, null, 'P[MW]: ' + cell.p_to_mw.toFixed(3), 0.7, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                          
                             b.insertVertex(resultCell, null, 'Q[MVar]: ' + cell.q_to_mvar.toFixed(3), 0.8, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                          
                             b.insertVertex(resultCell, null, 'i[kA]: ' + cell.i_to_ka.toFixed(3), 0.9, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                             */

                        }
                    }

                    if (dataJson.externalgrids != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy ExternalGrids
                        //csvContent += "data:text/csv;charset=utf-8,ExternalGrid Name, p_mw, q_mvar, pf, q_p\n";

                        //for (let i = 0; i < dataJson.externalgrids.length; i++) {
                        for (let cell of dataJson.externalgrids) {
                            resultId = cell.id  //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId
                            dataJson.lines[i].name = cell.name.replace('_', '#')


                            //for the csv file
                            //let row = Object.values(cell).join(",")
                            // csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'External Grid' +
                                "\n P[MW]: " + cell.p_mw.toFixed(3) +
                                "\n Q[MVar]: " + cell.q_mvar.toFixed(3) +
                                "\n PF: " + cell.pf.toFixed(3) +
                                "\n Q/P: " + cell.q_p.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])
                        }
                    }

                    if (dataJson.generators != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Generator
                        //csvContent += "data:text/csv;charset=utf-8,Generator Name, p_mw, q_mvar, va_degree, vm_pu \n";


                        for (let cell of dataJson.generators) {
                            resultId = cell.id

                            cell.name = cell.name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(cell).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'Generator' +
                                "\n P[MW]: " + cell.p_mw.toFixed(3) +
                                "\n Q[MVar]: " + cell.q_mvar.toFixed(3) +
                                "\n U[degree]: " + cell.va_degree.toFixed(3) +
                                "\n Um[pu]: " + cell.vm_pu.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])
                        }
                    }


                    if (dataJson.staticgenerators != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Static Generator
                        //csvContent += "data:text/csv;charset=utf-8, Static Generator Name, p_mw, q_mvar \n";
                        for (let cell of dataJson.staticgenerators) {

                            resultId = cell.id

                            cell.name = cell.name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(cell).join(",")
                            //csvContent += row + "\r\n";

                            //create label

                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'Static Generator' +
                                "\n P[MW]: " + cell.p_mw.toFixed(3) +
                                "\n Q[MVar]: " + cell.q_mvar.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, 0.5, 1.7, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])
                        }
                    }


                    if (dataJson.asymmetricstaticgenerators != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Asymmetric Static Generator
                        //csvContent += "data:text/csv;charset=utf-8, Asymmetric Static Generator Name, p_a_mw, q_a_mvar, p_b_mw, q_b_mvar, p_c_mw, q_c_mvar \n";

                        //for (let i = 0; i < dataJson.asymmetricstaticgenerators.length; i++) {
                        for (let cell of dataJson.asymmetricstaticgenerators) {


                            resultId = cell.id

                            cell.name = cell.name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(cell).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'Asymmetric Static Generator' +
                                "\n P_A[MW]: " + cell.p_a_mw.toFixed(3) +
                                "\n Q_A[MVar]: " + cell.q_a_mvar.toFixed(3) +
                                "\n P_B[MW]: " + cell.p_b_mw.toFixed(3) +
                                "\n Q_B[MVar]: " + cell.q_b_mvar.toFixed(3) +
                                "\n P_C[MW]: " + cell.p_c_mw.toFixed(3) +
                                "\n Q_C[MVar]: " + cell.q_c_mvar.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, 0.5, 1.7, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])
                        }
                    }

                    if (dataJson.transformers != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Transformer
                        //csvContent += "data:text/csv;charset=utf-8, Transformer Name, p_hv_mw, q_hv_mvar, p_lv_mw, q_lv_mvar, pl_mw, ql_mvar, i_hv_ka, i_lv_ka, vm_hv_pu, vm_lv_pu, va_hv_degree, va_lv_degree, loading_percent \n";


                        for (let cell of dataJson.transformers) {
                            resultId = cell.id

                            cell.name = cell.name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(cell).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = resultCell.value.attributes[2].nodeValue +
                                '\n i_HV[kA]: ' + cell.i_hv_ka.toFixed(3) +
                                '\n i_LV[kA]: ' + cell.i_lv_ka.toFixed(3)
                            //'\n loading[%]: ' + cell.loading_percent.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -1.2, 0.6, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])

                            /*
                             //zmiana kolorów przy przekroczeniu obciążenia linii
                             if(cell.loading_percent.toFixed(1) > 100){                                                   
                    
                                let style=grafka.getModel().getStyle(resultCell);
                                let newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                                let cs= new Array();
                                cs[0]=resultCell;
                                grafka.setCellStyle(newStyle,cs);                              
                                
                            }
                            if(cell.loading_percent.toFixed(1) > 80 && cell.loading_percent.toFixed(1) <= 100){
                    
                                                 
                                let style=grafka.getModel().getStyle(resultCell);
                                let newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'orange');
                                let cs= new Array();
                                cs[0]=resultCell;
                                grafka.setCellStyle(newStyle,cs); 
                            }
                            if(cell.loading_percent.toFixed(1) > 0 && cell.loading_percent.toFixed(1) <= 80){
                    
                                                 
                                let style=grafka.getModel().getStyle(resultCell);
                                let newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'green');
                                let cs= new Array();
                                cs[0]=resultCell;
                                grafka.setCellStyle(newStyle,cs); 
                            }*/




                            /*
                            let x = -1.2
                            let y = 0.6
                            let ydelta = 0.15

                            b.insertVertex(resultCell, null, resultString, x, y, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');*/

                            //   b.insertVertex(resultCell, null, 'P_HV[MW]: ' + cell.p_hv_mw.toFixed(3), x, y+ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            //   b.insertVertex(resultCell, null, 'Q_HV[MVar]: ' + cell.q_hv_mvar.toFixed(3), x, y+2*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            //   b.insertVertex(resultCell, null, 'P_LV[MW]: ' + cell.p_lv_mw.toFixed(3), x, y+3*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            //  b.insertVertex(resultCell, null, 'Q_LV[MVar]: ' + cell.q_lv_mvar.toFixed(3), x, y+4*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');    
                            //   b.insertVertex(resultCell, null, 'Pl[MW]: ' + cell.pl_mw.toFixed(3), x, y+5*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            //   b.insertVertex(resultCell, null, 'Ql[MVar]: ' + cell.ql_mvar.toFixed(3), x, y+6*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                           
                            //  b.insertVertex(resultCell, null, 'i_HV[kA]: ' + cell.i_hv_ka.toFixed(3), x, y+ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');          
                            //  b.insertVertex(resultCell, null, 'i_LV[kA]: ' + cell.i_lv_ka.toFixed(3), x, y+2*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');        
                            //  b.insertVertex(resultCell, null, 'Um_HV[pu]: ' + cell.vm_hv_pu.toFixed(3), x, y+9*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            //  b.insertVertex(resultCell, null, 'Um_LV[pu]: ' + cell.vm_lv_pu.toFixed(3), x, y+10*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                     
                            //  b.insertVertex(resultCell, null, 'Ua_HV[degree]: ' + cell.va_hv_degree.toFixed(3), x, y+11*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            //  b.insertVertex(resultCell, null, 'Ua_LV[degree]: ' + cell.va_lv_degree.toFixed(3), x, y+12*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            //  b.insertVertex(resultCell, null, 'loading[%]: ' + cell.loading_percent.toFixed(3), x, y+3*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                  
                        }
                    }

                    if (dataJson.transformers3W != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Transformer3W
                        //csvContent += "data:text/csv;charset=utf-8, Transformer3W Name, p_hv_mw, q_hv_mvar, p_mv_mw, q_mv_mvar, p_lv_mw, q_lv_mvar, pl_mw, ql_mvar, i_hv_ka, i_mv_ka, i_lv_ka, vm_hv_pu, vm_mv_pu, vm_lv_pu, va_hv_degree, va_mv_degree, va_lv_degree, loading_percent  \n";


                        for (let cell of dataJson.transformers3W) {

                            resultId = cell.id

                            cell.name = cell.name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(cell).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = '3WTransformer' +
                                '\n i_HV[kA]: ' + cell.i_hv_ka.toFixed(3) +
                                '\n i_MV[kA]: ' + cell.i_mv_ka.toFixed(3) +
                                '\n i_LV[kA]: ' + cell.i_lv_ka.toFixed(3) +
                                '\n loading[%]: ' + cell.loading_percent.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -1.4, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])

                            /*
                            let x = -1.4
                            let y = -1
                            let ydelta = 0.2
                            b.insertVertex(resultCell, null, 'Transformer3W', x, y, 0, 0, 'labelstyle', true);                        
                            b.insertVertex(resultCell, null, 'P_HV[MW]: ' + cell.p_hv_mw.toFixed(3), x, y+ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            b.insertVertex(resultCell, null, 'Q_HV[MVar]: ' + cell.q_hv_mvar.toFixed(3), x, y+2*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'P_MV[MW]: ' + cell.p_mv_mw.toFixed(3), x, y+3*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'Q_MV[MVar]: ' + cell.q_mv_mvar.toFixed(3), x, y+4*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'P_LV[MW]: ' + cell.p_lv_mw.toFixed(3), x, y+5*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                         
                            b.insertVertex(resultCell, null, 'Q_LV[MVar]: ' + cell.q_lv_mvar.toFixed(3), x, y+6*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                       
                            b.insertVertex(resultCell, null, 'Pl[MW]: ' + cell.pl_mw.toFixed(3), x, y+7*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                    
                            b.insertVertex(resultCell, null, 'Ql[MVar]: ' + cell.ql_mvar.toFixed(3), x, y+8*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'i_HV[kA]: ' + cell.i_hv_ka.toFixed(3), x, y+9*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'i_MV[kA]: ' + cell.i_mv_ka.toFixed(3), x, y+10*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'i_LV[kA]: ' + cell.i_lv_ka.toFixed(3), x, y+11*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Um_HV[pu]: ' + cell.vm_hv_pu.toFixed(3), x, y+12*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                           
                            b.insertVertex(resultCell, null, 'Um_MV[pu]: ' + cell.vm_mv_pu.toFixed(3), x, y+13*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Um_LV[pu]: ' + cell.vm_lv_pu.toFixed(3), x, y+14*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Ua_HV[degree]: ' + cell.va_hv_degree.toFixed(3), x, y+15*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                        
                            b.insertVertex(resultCell, null, 'Ua_MV[degree]: ' + cell.va_mv_degree.toFixed(3), x, y+16*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'Ua_LV[degree]: ' + cell.va_lv_degree.toFixed(3), x, y+17*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'loading[%]: ' + cell.loading_percent.toFixed(3), x, y+18*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            */
                        }
                    }

                    if (dataJson.shunts != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Shunts
                        //csvContent += "data:text/csv;charset=utf-8,Shunt Reactor Name, p_mw, q_mvar, vm_pu\n";

                        for (let i = 0; i < dataJson.shunts.length; i++) {
                            resultId = dataJson.shunts[i].id

                            dataJson.shunts[i].name = dataJson.shunts[i].name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(dataJson.shunts[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId


                            let resultString = 'Shunt reactor' +
                                '\n P[MW]: ' + dataJson.shunts[i].p_mw.toFixed(3) +
                                '\n Q[MVar]: ' + dataJson.shunts[i].q_mvar.toFixed(3) +
                                '\n Um[pu]: ' + dataJson.shunts[i].vm_pu.toFixed(3)


                            let labelka = b.insertVertex(resultCell, null, resultString, -1, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])

                        }
                    }

                    if (dataJson.capacitors != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Capacitors
                        //csvContent += "data:text/csv;charset=utf-8,Capacitor Name, p_mw, q_mvar, vm_pu\n";

                        for (let i = 0; i < dataJson.capacitors.length; i++) {


                            resultId = dataJson.capacitors[i].id

                            dataJson.capacitors[i].name = dataJson.capacitors[i].name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(dataJson.capacitors[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'Capacitor' +
                                '\n P[MW]: ' + dataJson.capacitors[i].p_mw.toFixed(3) +
                                '\n Q[MVar]: ' + dataJson.capacitors[i].q_mvar.toFixed(3)// +
                            //'\n Um[pu]: ' + dataJson.capacitors[i].vm_pu.toFixed(3) 

                            let labelka = b.insertVertex(resultCell, null, resultString, -1, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])

                        }
                    }


                    if (dataJson.loads != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Loads
                        //csvContent += "data:text/csv;charset=utf-8,Load Name, p_mw, q_mvar\n";

                        for (let i = 0; i < dataJson.loads.length; i++) {
                            resultId = dataJson.loads[i].id
                            dataJson.loads[i].name = dataJson.loads[i].name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(dataJson.loads[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'Load' +
                                '\n P[MW]: ' + dataJson.loads[i].p_mw.toFixed(3) +
                                '\n Q[MVar]: ' + dataJson.loads[i].q_mvar.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])


                        }
                    }

                    if (dataJson.asymmetricloads != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy AsymmetricLoads
                        //csvContent += "data:text/csv;charset=utf-8,Asymmetric Load Name, p_a_mw, q_a_mvar, p_b_mw, q_b_mvar, p_c_mw, q_c_mvar \n";

                        for (let i = 0; i < dataJson.asymmetricloads.length; i++) {
                            resultId = dataJson.asymmetricloads[i].id
                            dataJson.asymmetricloads[i].name = dataJson.asymmetricloads[i].name.replace('_', '#')

                            //sprawdz na jakich pozycjach był znak '-'
                            //podmien w tyc pozycjach znaki
                            resultId = resultId.replaceAll('___', '-')

                            dataJson.asymmetricloads[i].name = resultId

                            //for the csv file
                            //let row = Object.values(dataJson.asymmetricloads[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'Asymmetric Load' +
                                '\n P_a[MW]: ' + dataJson.asymmetricloads[i].p_a_mw.toFixed(3) +
                                '\n Q_a[MVar]: ' + dataJson.asymmetricloads[i].q_a_mvar.toFixed(3) +
                                '\n P_b[MW]: ' + dataJson.asymmetricloads[i].p_b_mw.toFixed(3) +
                                '\n Q_b[MVar]: ' + dataJson.asymmetricloads[i].q_b_mvar.toFixed(3) +
                                '\n P_c[MW]: ' + dataJson.asymmetricloads[i].p_c_mw.toFixed(3) +
                                '\n Q_c[MVar]: ' + dataJson.asymmetricloads[i].q_c_mvar.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])

                        }
                    }

                    if (dataJson.impedances != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Impedances
                        //csvContent += "data:text/csv;charset=utf-8,Impedance Name, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, pl_mw, ql_mvar, i_from_ka, i_to_ka \n";

                        for (let i = 0; i < dataJson.impedances.length; i++) {
                            resultId = dataJson.impedances[i].id
                            dataJson.impedances[i].name = dataJson.impedances[i].name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(dataJson.impedances[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'Impedance' +
                                '\n P_from[MW]: ' + dataJson.impedances[i].p_from_mw.toFixed(3) +
                                '\n Q_from[MVar]: ' + dataJson.impedances[i].q_from_mvar.toFixed(3) +
                                '\n P_to[MW]: ' + dataJson.impedances[i].p_to_mw.toFixed(3) +
                                '\n Q_to[MVar]: ' + dataJson.impedances[i].q_to_mvar.toFixed(3) +
                                '\n Pl[MW]: ' + dataJson.impedances[i].pl_mw.toFixed(3) +
                                '\n Ql[MVar]: ' + dataJson.impedances[i].ql_mvar.toFixed(3) +
                                '\n i_from[kA]: ' + dataJson.impedances[i].i_from_ka.toFixed(3) +
                                '\n i_to[kA]: ' + dataJson.impedances[i].i_to_ka.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])
                        }
                    }

                    if (dataJson.wards != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Wards
                        //csvContent += "data:text/csv;charset=utf-8,Ward Name, p_mw, q_mvar, vm_pu \n";

                        for (let i = 0; i < dataJson.wards.length; i++) {
                            resultId = dataJson.wards[i].id
                            dataJson.wards[i].name = dataJson.wards[i].name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(dataJson.wards[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'Ward' +
                                '\n P[MW]: ' + dataJson.wards[i].p_mw.toFixed(3) +
                                '\n Q[MVar]: ' + dataJson.wards[i].q_mvar.toFixed(3) +
                                '\n Um[pu]: ' + dataJson.wards[i].vm_pu.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])
                        }
                    }

                    if (dataJson.extendedwards != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Extended Wards
                        //csvContent += "data:text/csv;charset=utf-8,Extended Ward Name, p_mw, q_mvar, vm_pu \n";

                        for (let i = 0; i < dataJson.extendedwards.length; i++) {
                            resultId = dataJson.extendedwards[i].id
                            dataJson.extendedwards[i].name = dataJson.extendedwards[i].name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(dataJson.extendedwards[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'Extended Ward' +
                                '\n P[MW]: ' + dataJson.extendedwards[i].p_mw.toFixed(3) +
                                '\n Q[MVar]: ' + dataJson.extendedwards[i].q_mvar.toFixed(3) +
                                '\n Um[pu]: ' + dataJson.extendedwards[i].vm_pu.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])

                        }
                    }


                    if (dataJson.motors != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Motors
                        //csvContent += "data:text/csv;charset=utf-8,Motor Name, p_mw, q_mvar \n";

                        for (let i = 0; i < dataJson.motors.length; i++) {
                            resultId = dataJson.motors[i].id
                            dataJson.motors[i].name = dataJson.motors[i].name.replace('_', '#')

                            //sprawdz na jakich pozycjach był znak '-'
                            //podmien w tyc pozycjach znaki
                            resultId = resultId.replaceAll('___', '-')

                            dataJson.motors[i].name = resultId

                            //for the csv file
                            //let row = Object.values(dataJson.motors[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'Extended Ward' +
                                '\n P[MW]: ' + dataJson.motors[i].p_mw.toFixed(3) +
                                '\n Q[MVar]: ' + dataJson.motors[i].q_mvar.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])

                        }
                    }

                    if (dataJson.storages != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Storages
                        //csvContent += "data:text/csv;charset=utf-8,Storage Name, p_mw, q_mvar \n";

                        for (let i = 0; i < dataJson.storages.length; i++) {
                            resultId = dataJson.storages[i].id
                            dataJson.storages[i].name = dataJson.storages[i].name.replace('_', '#')

                            //sprawdz na jakich pozycjach był znak '-'
                            //podmien w tyc pozycjach znaki
                            resultId = resultId.replaceAll('___', '-')

                            dataJson.storages[i].name = resultId

                            //for the csv file
                            //let row = Object.values(dataJson.storages[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'Storage' +
                                '\n P[MW]: ' + dataJson.storages[i].p_mw.toFixed(3) +
                                '\n Q[MVar]: ' + dataJson.storages[i].q_mvar.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])
                        }
                    }


                    if (dataJson.SVC != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        //csvContent += "data:text/csv;charset=utf-8,SVC Name, thyristor_firing_angle_degree, x_ohm, q_mvar, vm_pu, va_degree \n";

                        for (let i = 0; i < dataJson.SVC.length; i++) {
                            resultId = dataJson.SVC[i].id
                            dataJson.SVC[i].name = dataJson.SVC[i].name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(dataJson.SVC[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'SVC' +
                                '\n Firing angle[degree]: ' + dataJson.SVC[i].thyristor_firing_angle_degree.toFixed(3) +
                                '\n x[Ohm]: ' + dataJson.SVC[i].x_ohm.toFixed(3) +
                                '\n q[MVar]: ' + dataJson.SVC[i].q_mvar.toFixed(3) +
                                '\n vm[pu]: ' + dataJson.SVC[i].vm_pu.toFixed(3) +
                                '\n va[degree]: ' + dataJson.SVC[i].va_degree.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])


                        }
                    }

                    if (dataJson.TCSC != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        //csvContent += "data:text/csv;charset=utf-8,TCSC Name, thyristor_firing_angle_degree, x_ohm, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, p_l_mw, q_l_mvar, vm_from_pu, va_from_degree, vm_to_pu, va_to_degree  \n";

                        for (let i = 0; i < dataJson.TCSC.length; i++) {
                            resultId = dataJson.TCSC[i].id
                            dataJson.TCSC[i].name = dataJson.TCSC[i].name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(dataJson.TCSC[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'TCSC' +
                                '\n Firing angle[degree]: ' + dataJson.TCSC[i].thyristor_firing_angle_degree.toFixed(3) +
                                '\n x[Ohm ]: ' + dataJson.TCSC[i].x_ohm.toFixed(3) +
                                '\n p_from[MW]: ' + dataJson.TCSC[i].p_from_mw.toFixed(3) +
                                '\n q_from[MVar]: ' + dataJson.TCSC[i].q_from_mvar.toFixed(3) +
                                '\n p_to[MW]: ' + dataJson.TCSC[i].p_to_mw.toFixed(3) +
                                '\n q_to[MVar]: ' + dataJson.TCSC[i].q_to_mvar.toFixed(3) +
                                '\n p_l[MW]: ' + dataJson.TCSC[i].p_l_mw.toFixed(3) +
                                '\n q_l[MVar]: ' + dataJson.TCSC[i].q_l_mvar.toFixed(3) +
                                '\n vm_from[pu]: ' + dataJson.TCSC[i].vm_from_pu.toFixed(3) +
                                '\n va_from[degree]: ' + dataJson.TCSC[i].va_from_degree.toFixed(3) +
                                '\n vm_to[pu]: ' + dataJson.TCSC[i].vm_to_pu.toFixed(3) +
                                '\n va_to[degree]: ' + dataJson.TCSC[i].va_to_degree.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])


                        }
                    }

                    if (dataJson.SSC != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        //csvContent += "data:text/csv;charset=utf-8,SSC Name, thyristor_firing_angle_degree, q_mvar, vm_internal_pu, va_internal_degree, vm_pu, va_degree  \n";

                        for (let i = 0; i < dataJson.SSC.length; i++) {
                            resultId = dataJson.SSC[i].id
                            dataJson.SSC[i].name = dataJson.SSC[i].name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(dataJson.SSC[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'SSC' +
                                '\n q_mvar: ' + dataJson.SSC[i].q_mvar.toFixed(3) +
                                '\n vm_internal_pu: ' + dataJson.SSC[i].vm_internal_pu.toFixed(3) +
                                '\n va_internal_degree: ' + dataJson.SSC[i].va_internal_degree.toFixed(3) +
                                '\n vm_pu: ' + dataJson.SSC[i].vm_pu.toFixed(3) +
                                '\n va_degree: ' + dataJson.SSC[i].va_degree.toFixed(3)                               


                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])
                        }
                    }



                    if (dataJson.dclines != undefined) {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        //csvContent += "data:text/csv;charset=utf-8,DCline Name, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, pl_mw, vm_from_pu, va_from_degree, vm_to_pu, va_to_degree \n";

                        for (let i = 0; i < dataJson.dclines.length; i++) {
                            resultId = dataJson.dclinesSSC[i].id
                            dataJson.dclines[i].name = dataJson.dclines[i].name.replace('_', '#')

                            //for the csv file
                            //let row = Object.values(dataJson.dclines[i]).join(",")
                            //csvContent += row + "\r\n";

                            //create label
                            let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            let resultString = 'DC line' +
                                '\n P_from[MW]: ' + dataJson.dclines[i].p_from_mw.toFixed(3) +
                                '\n Q_from[MVar]: ' + dataJson.dclines[i].q_from_mvar.toFixed(3) +
                                '\n P_to[MW]: ' + dataJson.dclines[i].p_to_mw.toFixed(3) +
                                '\n Q_to[MVar]: ' + dataJson.dclines[i].q_to_mvar.toFixed(3) +
                                '\n Pl[MW]: ' + dataJson.dclines[i].pl_mw.toFixed(3)

                            let labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])

                            /*
                            b.insertVertex(resultCell, null, 'U_from[pu]: ' + dataJson.dclines[i].vm_from_pu.toFixed(3), -0.15, 2.2, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            b.insertVertex(resultCell, null, 'Ua_from[degree]: ' + dataJson.dclines[i].va_from_degree.toFixed(3), -0.15, 2.4, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Um_to[pu]: ' + dataJson.dclines[i].vm_to_pu.toFixed(3), -0.15, 2.6, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');      
                            b.insertVertex(resultCell, null, 'Ua_to[degree]: ' + dataJson.dclines[i].va_to_degree.toFixed(3), -0.15, 2.8, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            */
                        }
                    }


                    //download to CSV
                    //let encodedUri = encodeURI(csvContent);
                    //let link = document.createElement("a");
                    //link.setAttribute("href", encodedUri);
                    //link.setAttribute("download", "Results.csv");
                    //document.body.appendChild(link); // Required for FF
                    //link.click();

                })
                .catch(err => {
                    if (err === "server") return
                    alert(err)
                })

        }
    })

}