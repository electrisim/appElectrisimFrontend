
function loadFlow(a, b, c) {

    //a - App
    //b - Graph
    //c - Editor

    var apka = a

    b.isEnabled() && !b.isCellLocked(b.getDefaultParent()) && a.showLoadFlowDialog("", "Calculate", function (a, c) {

        apka.spinner.spin(document.body, "Waiting for results...")


        //a - parametry obliczeń rozpływowych                
        //b = graph

        //jeśli parametry zostały wpisane policz rozpływ

        if (0 < a.length) {

            //liczba obiektów    
            let cellsArray = []
            cellsArray = b.getModel().getDescendants()


            var busbarNo = 0
            var externalGridNo = 0
            var generatorNo = 0
            var staticGeneratorNo = 0
            var asymmetricStaticGeneratorNo = 0


            var loadNo = 0
            var asymmetricLoadNo = 0
            var impedanceNo = 0
            var wardNo = 0
            var extendedWardNo = 0

            var transformerNo = 0
            var threeWindingTransformerNo = 0

            var shuntReactorNo = 0
            var capacitorNo = 0

            var motorNo = 0

            var lineNo = 0
            var dcLineNo = 0

            var storageNo = 0

            //Arrays
            var simulationParametersArray = [];

            var busbarArray = [];

            var externalGridArray = [];
            var generatorArray = [];
            var staticGeneratorArray = [];
            var asymmetricStaticGeneratorArray = [];

            var loadArray = [];
            var asymmetricLoadArray = [];
            var impedanceArray = [];
            var wardArray = [];
            var extendedWardArray = [];

            var transformerArray = [];
            var threeWindingTransformerArray = [];

            var shuntReactorArray = [];
            var capacitorArray = [];

            var motorArray = [];

            var lineArray = [];
            var dcLineArray = [];

            var storageArray = [];

            var dataToBackendArray = [];


            //***************SCZYTYWANIE PARAMETRÓW ROZPŁYWU****************
            var loadFlowParameters = new Object();
            loadFlowParameters.typ = "PowerFlow Parameters" //używam PowerFlow zamiast LoadFlow, bo w pythonie występuje błąd
            loadFlowParameters.algorithm = a[0]
            loadFlowParameters.calculate_voltage_angles = a[1]
            loadFlowParameters.initialization = a[2]
            //for(var i = 0; i < a.length; i++) {

            simulationParametersArray.push(loadFlowParameters)


            //*************** SCZYTYWANIE MODELU DO BACKEND ****************
            //trzeba rozpoznawać po style - styleELXXX = np. Transformer
            for (var i = 0; i < cellsArray.length; i++) {

                //usun wyniki poprzednich obliczen
                if (typeof (cellsArray[i].getStyle()) != undefined && cellsArray[i].getStyle() != null && cellsArray[i].getStyle().includes("Result")) {

                    var celka = b.getModel().getCell(cellsArray[i].id)
                    b.getModel().remove(celka)
                }

                if (typeof (cellsArray[i].getStyle()) != undefined && cellsArray[i].getStyle() != null) {

                    var key_value = cellsArray[i].getStyle().split(";").map(pair => pair.split("="));
                    const result = Object.fromEntries(key_value);
                    console.log(result.shapeELXXX)

                    //wybierz obiekty typu Ext_grid
                    if (result.shapeELXXX == "External Grid") {

                        //zrób plik json i wyślij do backend
                        var externalGrid = new Object();
                        externalGrid.typ = "External Grid" + externalGridNo
                        externalGrid.name = "External Grid" + externalGridNo
                        externalGrid.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        externalGrid.bus = externalGrid.bus.replace(/^\d/, 'NUMBER')


                        console.log("External Grid attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters 
                        externalGrid.vm_pu = cellsArray[i].value.attributes[2].nodeValue
                        externalGrid.va_degree = cellsArray[i].value.attributes[3].nodeValue
                        //externalGrid.in_service = cellsArray[i].value.attributes[3].nodeValue

                        //Short_circuit_parameters 
                        externalGrid.s_sc_max_mva = cellsArray[i].value.attributes[5].nodeValue
                        externalGrid.s_sc_min_mva = cellsArray[i].value.attributes[6].nodeValue
                        externalGrid.rx_max = cellsArray[i].value.attributes[7].nodeValue
                        externalGrid.rx_min = cellsArray[i].value.attributes[8].nodeValue
                        externalGrid.r0x0_max = cellsArray[i].value.attributes[9].nodeValue
                        externalGrid.x0x_max = cellsArray[i].value.attributes[10].nodeValue

                        externalGridNo++

                        //var externalGridToBackend = JSON.stringify(externalGrid) //{"name":"External Grid 0","vm_pu":"0", "bus":"mxCell#34"}      
                        externalGridArray.push(externalGrid);
                    }



                    //wybierz obiekty typu Generator
                    if (result.shapeELXXX == "Generator")//cellsArray[i].getStyle().match(/^Generator$/))//includes("Generator")) //(str1.match(/^abc$/))
                    {

                        //zrób plik json i wyślij do backend
                        var generator = new Object();
                        generator.typ = "Generator"
                        generator.name = "Generator" + generatorNo
                        generator.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        generator.bus = generator.bus.replace(/^\d/, 'NUMBER')

                        console.log("Generator attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters 
                        generator.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        generator.vm_pu = cellsArray[i].value.attributes[3].nodeValue
                        generator.sn_mva = cellsArray[i].value.attributes[4].nodeValue
                        generator.scaling = cellsArray[i].value.attributes[5].nodeValue

                        //Short_circuit_parameters 
                        generator.vn_kv = cellsArray[i].value.attributes[7].nodeValue
                        generator.xdss_pu = cellsArray[i].value.attributes[8].nodeValue
                        generator.rdss_ohm = cellsArray[i].value.attributes[9].nodeValue
                        generator.cos_phi = cellsArray[i].value.attributes[10].nodeValue
                        generator.pg_percent = cellsArray[i].value.attributes[11].nodeValue
                        generator.power_station_trafo = cellsArray[i].value.attributes[12].nodeValue

                        generatorNo++

                        generatorArray.push(generator);
                    }

                    //wybierz obiekty typu Static Generator
                    if (result.shapeELXXX == "Static Generator") {


                        //zrób plik json i wyślij do backend
                        var staticGenerator = new Object();
                        staticGenerator.typ = "Static Generator"
                        staticGenerator.name = "Static Generator" + staticGeneratorNo
                        staticGenerator.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        staticGenerator.bus = staticGenerator.bus.replace(/^\d/, 'NUMBER')

                        console.log("Static Generator attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters
                        staticGenerator.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        staticGenerator.q_mvar = cellsArray[i].value.attributes[3].nodeValue
                        staticGenerator.sn_mva = cellsArray[i].value.attributes[4].nodeValue
                        staticGenerator.scaling = cellsArray[i].value.attributes[5].nodeValue
                        staticGenerator.type = cellsArray[i].value.attributes[6].nodeValue

                        //Short_circuit_parameters
                        staticGenerator.k = cellsArray[i].value.attributes[8].nodeValue
                        staticGenerator.rx = cellsArray[i].value.attributes[9].nodeValue
                        staticGenerator.generator_type = cellsArray[i].value.attributes[10].nodeValue
                        staticGenerator.lrc_pu = cellsArray[i].value.attributes[11].nodeValue
                        staticGenerator.max_ik_ka = cellsArray[i].value.attributes[12].nodeValue
                        staticGenerator.kappa = cellsArray[i].value.attributes[13].nodeValue
                        staticGenerator.current_source = cellsArray[i].value.attributes[14].nodeValue

                        staticGeneratorNo++

                        staticGeneratorArray.push(staticGenerator);
                    }
                    //wybierz obiekty typu Asymmetric Static Generator
                    if (result.shapeELXXX == "Asymmetric Static Generator") {

                        //zrób plik json i wyślij do backend
                        var asymmetricStaticGenerator = new Object();
                        asymmetricStaticGenerator.typ = "Asymmetric Static Generator" + generatorNo
                        asymmetricStaticGenerator.name = "Asymmetric Static Generator" + generatorNo
                        asymmetricStaticGenerator.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        asymmetricStaticGenerator.bus = asymmetricStaticGenerator.bus.replace(/^\d/, 'NUMBER')

                        console.log("Asymmetric Static Generator attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters
                        asymmetricStaticGenerator.p_a_mw = cellsArray[i].value.attributes[2].nodeValue
                        asymmetricStaticGenerator.p_b_mw = cellsArray[i].value.attributes[3].nodeValue
                        asymmetricStaticGenerator.p_c_mw = cellsArray[i].value.attributes[4].nodeValue

                        asymmetricStaticGenerator.q_a_mvar = cellsArray[i].value.attributes[5].nodeValue
                        asymmetricStaticGenerator.q_b_mvar = cellsArray[i].value.attributes[6].nodeValue
                        asymmetricStaticGenerator.q_c_mvar = cellsArray[i].value.attributes[7].nodeValue

                        asymmetricStaticGenerator.sn_mva = cellsArray[i].value.attributes[8].nodeValue
                        asymmetricStaticGenerator.scaling = cellsArray[i].value.attributes[9].nodeValue
                        asymmetricStaticGenerator.type = cellsArray[i].value.attributes[10].nodeValue

                        asymmetricStaticGeneratorNo++

                        asymmetricStaticGeneratorArray.push(asymmetricStaticGenerator);
                    }


                    //wybierz obiekty typu Bus 
                    if (result.shapeELXXX == "Bus") {

                        //zrób plik json i wyślij do backend
                        var busbar = new Object();
                        busbar.typ = "Bus" + busbarNo

                        busbar.name = cellsArray[i].id.replaceAll('-', '___') //mxObjectId.replace('#', '_')//cellsArray[i].id.replaceAll('-', '_') //zamień wszystkie - na _ żeby można byłoby w pythonie obrabiać  //cellsArray[i].mxObjectId.replace('#', '')

                        //w busbar.number zapisz wartość pierwszej cyfry która znalazła się w mxObjectId. 
                        const regex = /^\d/g;
                        if (busbar.name.match(regex)) {
                            busbar.number = busbar.name.match(regex)[0];
                        } else {
                            busbar.number = 0
                        }

                        busbar.name = busbar.name.replace(/^\d/, 'NUMBER') //jeśli na pierwszej pozycji występuje cyfra to zamień ją na tekst Number                               

                        console.log("Busbar attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters
                        busbar.vn_kv = cellsArray[i].value.attributes[2].nodeValue
                        busbar.type = cellsArray[i].value.attributes[3].nodeValue
                        //busbar.in_service = cellsArray[i].value.attributes[3].nodeValue
                        busbarNo++

                        busbarArray.push(busbar);
                    }

                    //wybierz obiekty typu Transformer
                    if (result.shapeELXXX == "Transformer") {

                        //zrób plik json i wyślij do backend
                        var transformer = new Object();
                        transformer.typ = "Transformer" + transformerNo
                        transformer.name = "Transformer" + transformerNo

                        transformer.hv_bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        transformer.hv_bus = transformer.hv_bus.replace(/ ^\d/, 'NUMBER')
                        transformer.lv_bus = cellsArray[i].edges[1].target.id.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        transformer.lv_bus = transformer.lv_bus.replace(/^\d/, 'NUMBER')

                        console.log("Transformer")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters    
                        transformer.sn_mva = cellsArray[i].value.attributes[4].nodeValue
                        transformer.vn_hv_kv = cellsArray[i].value.attributes[5].nodeValue
                        transformer.vn_lv_kv = cellsArray[i].value.attributes[6].nodeValue

                        //transformer.in_service = cellsArray[i].value.attributes[15].nodeValue

                        //Short_circuit_parameters
                        transformer.vkr_percent = cellsArray[i].value.attributes[8].nodeValue
                        transformer.vk_percent = cellsArray[i].value.attributes[9].nodeValue
                        transformer.pfe_kw = cellsArray[i].value.attributes[10].nodeValue
                        transformer.i0_percent = cellsArray[i].value.attributes[11].nodeValue
                        transformer.vector_group = cellsArray[i].value.attributes[12].nodeValue
                        transformer.vk0_percent = cellsArray[i].value.attributes[13].nodeValue
                        transformer.vkr0_percent = cellsArray[i].value.attributes[14].nodeValue
                        transformer.mag0_percent = cellsArray[i].value.attributes[15].nodeValue
                        transformer.si0_hv_partial = cellsArray[i].value.attributes[16].nodeValue
                        //transformer.in_service = cellsArray[i].value.attributes[15].nodeValue

                        //Optional_parameters
                        transformer.parallel = cellsArray[i].value.attributes[18].nodeValue
                        transformer.shift_degree = cellsArray[i].value.attributes[19].nodeValue
                        transformer.tap_side = cellsArray[i].value.attributes[20].nodeValue
                        transformer.tap_pos = cellsArray[i].value.attributes[21].nodeValue
                        transformer.tap_neutral = cellsArray[i].value.attributes[22].nodeValue
                        transformer.tap_max = cellsArray[i].value.attributes[23].nodeValue
                        transformer.tap_min = cellsArray[i].value.attributes[24].nodeValue
                        transformer.tap_step_percent = cellsArray[i].value.attributes[25].nodeValue
                        transformer.tap_step_degree = cellsArray[i].value.attributes[26].nodeValue
                        transformer.tap_phase_shifter = cellsArray[i].value.attributes[27].nodeValue
                        /*
                        transformer.max_loading_percent = cellsArray[i].value.attributes[26].nodeValue
                        transformer.df = cellsArray[i].value.attributes[27].nodeValue
                        transformer.oltc = cellsArray[i].value.attributes[28].nodeValue
                        transformer.xn_ohm = cellsArray[i].value.attributes[29].nodeValue */

                        transformerNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        transformerArray.push(transformer);
                    }

                    //wybierz obiekty typu Three Winding Transformer
                    if (result.shapeELXXX == "Three Winding Transformer") {

                        //zrób plik json i wyślij do backend
                        var threeWindingTransformer = new Object();
                        threeWindingTransformer.typ = "Three Winding Transformer" + threeWindingTransformerNo
                        threeWindingTransformer.name = "Three Winding Transformer" + threeWindingTransformerNo

                        threeWindingTransformer.hv_bus = cellsArray[i].edges[2].target.id.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        threeWindingTransformer.hv_bus = threeWindingTransformer.hv_bus.replace(/^\d/, 'NUMBER')
                        threeWindingTransformer.mv_bus = cellsArray[i].edges[1].target.id.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        threeWindingTransformer.mv_bus = threeWindingTransformer.mv_bus.replace(/^\d/, 'NUMBER')
                        threeWindingTransformer.lv_bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        threeWindingTransformer.lv_bus = threeWindingTransformer.lv_bus.replace(/^\d/, 'NUMBER')

                        console.log("Three Winding Transformer attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters
                        threeWindingTransformer.sn_hv_mva = cellsArray[i].value.attributes[4].nodeValue
                        threeWindingTransformer.sn_mv_mva = cellsArray[i].value.attributes[5].nodeValue
                        threeWindingTransformer.sn_lv_mva = cellsArray[i].value.attributes[6].nodeValue
                        threeWindingTransformer.vn_hv_kv = cellsArray[i].value.attributes[7].nodeValue
                        threeWindingTransformer.vn_mv_kv = cellsArray[i].value.attributes[8].nodeValue
                        threeWindingTransformer.vn_lv_kv = cellsArray[i].value.attributes[9].nodeValue
                        threeWindingTransformer.vk_hv_percent = cellsArray[i].value.attributes[10].nodeValue
                        threeWindingTransformer.vk_mv_percent = cellsArray[i].value.attributes[11].nodeValue
                        threeWindingTransformer.vk_lv_percent = cellsArray[i].value.attributes[12].nodeValue

                        //Short_circuit_parameters [13]
                        threeWindingTransformer.vkr_hv_percent = cellsArray[i].value.attributes[14].nodeValue
                        threeWindingTransformer.vkr_mv_percent = cellsArray[i].value.attributes[15].nodeValue
                        threeWindingTransformer.vkr_lv_percent = cellsArray[i].value.attributes[16].nodeValue
                        threeWindingTransformer.pfe_kw = cellsArray[i].value.attributes[17].nodeValue
                        threeWindingTransformer.i0_percent = cellsArray[i].value.attributes[18].nodeValue
                        threeWindingTransformer.vk0_hv_percent = cellsArray[i].value.attributes[19].nodeValue
                        threeWindingTransformer.vk0_mv_percent = cellsArray[i].value.attributes[20].nodeValue
                        threeWindingTransformer.vk0_lv_percent = cellsArray[i].value.attributes[21].nodeValue
                        threeWindingTransformer.vkr0_hv_percent = cellsArray[i].value.attributes[22].nodeValue
                        threeWindingTransformer.vkr0_mv_percent = cellsArray[i].value.attributes[23].nodeValue
                        threeWindingTransformer.vkr0_lv_percent = cellsArray[i].value.attributes[24].nodeValue
                        threeWindingTransformer.vector_group = cellsArray[i].value.attributes[25].nodeValue

                        //Optional_parameters [26]
                        threeWindingTransformer.shift_mv_degree = cellsArray[i].value.attributes[27].nodeValue
                        threeWindingTransformer.shift_lv_degree = cellsArray[i].value.attributes[28].nodeValue
                        threeWindingTransformer.tap_step_percent = cellsArray[i].value.attributes[29].nodeValue
                        threeWindingTransformer.tap_side = cellsArray[i].value.attributes[30].nodeValue
                        threeWindingTransformer.tap_neutral = cellsArray[i].value.attributes[31].nodeValue
                        threeWindingTransformer.tap_min = cellsArray[i].value.attributes[32].nodeValue
                        threeWindingTransformer.tap_max = cellsArray[i].value.attributes[33].nodeValue
                        threeWindingTransformer.tap_pos = cellsArray[i].value.attributes[34].nodeValue
                        threeWindingTransformer.tap_at_star_point = cellsArray[i].value.attributes[35].nodeValue
                        threeWindingTransformerNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        threeWindingTransformerArray.push(threeWindingTransformer);
                    }

                    if (result.shapeELXXX == "Shunt Reactor") {

                        //zrób plik json i wyślij do backend
                        var shuntReactor = new Object();
                        shuntReactor.typ = "Shunt Reactor" + shuntReactorNo

                        shuntReactor.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        shuntReactor.bus = shuntReactor.bus.replace(/^\d/, 'NUMBER')

                        console.log("Shunt reactor attributes")
                        console.log(cellsArray[i].value.attributes)


                        //Load_flow_parameters
                        shuntReactor.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        shuntReactor.q_mvar = cellsArray[i].value.attributes[3].nodeValue

                        //Optional_parameters
                        shuntReactor.vn_kv = cellsArray[i].value.attributes[4].nodeValue
                        shuntReactor.step = cellsArray[i].value.attributes[5].nodeValue
                        shuntReactor.max_step = cellsArray[i].value.attributes[6].nodeValue

                        shuntReactorNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        shuntReactorArray.push(shuntReactor);
                    }

                    if (result.shapeELXXX == "Capacitor") {

                        //zrób plik json i wyślij do backend
                        var capacitor = new Object();
                        capacitor.typ = "Capacitor" + capacitorNo


                        capacitor.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        capacitor.bus = capacitor.bus.replace(/^\d/, 'NUMBER')

                        console.log("Capacitor attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters
                        capacitor.q_mvar = cellsArray[i].value.attributes[2].nodeValue
                        capacitor.loss_factor = cellsArray[i].value.attributes[3].nodeValue
                        //Optional_parameters
                        capacitor.vn_kv = cellsArray[i].value.attributes[5].nodeValue
                        capacitor.step = cellsArray[i].value.attributes[6].nodeValue
                        capacitor.max_step = cellsArray[i].value.attributes[7].nodeValue

                        capacitorNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        capacitorArray.push(capacitor);
                    }


                    //wybierz obiekty typu Load
                    if (result.shapeELXXX == "Load") {
                        //zrób plik json i wyślij do backend
                        var load = new Object();
                        load.typ = "Load" + loadNo

                        load.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        load.bus = load.bus.replace(/^\d/, 'NUMBER')

                        console.log("Load attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters
                        load.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        load.q_mvar = cellsArray[i].value.attributes[3].nodeValue
                        load.const_z_percent = cellsArray[i].value.attributes[4].nodeValue
                        load.const_i_percent = cellsArray[i].value.attributes[5].nodeValue
                        load.sn_mva = cellsArray[i].value.attributes[6].nodeValue
                        load.scaling = cellsArray[i].value.attributes[7].nodeValue
                        load.type = cellsArray[i].value.attributes[8].nodeValue

                        loadNo++

                        loadArray.push(load);
                    }


                    if (result.shapeELXXX == "Asymmetric Load") {
                        //zrób plik json i wyślij do backend
                        var asymmetricLoad = new Object();
                        asymmetricLoad.typ = "Asymmetric Load" + asymmetricLoadNo

                        asymmetricLoad.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        asymmetricLoad.bus = asymmetricLoad.bus.replace(/^\d/, 'NUMBER')

                        console.log("Asymmetric Load attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters
                        asymmetricLoad.p_a_mw = cellsArray[i].value.attributes[2].nodeValue
                        asymmetricLoad.p_b_mw = cellsArray[i].value.attributes[3].nodeValue
                        asymmetricLoad.p_c_mw = cellsArray[i].value.attributes[4].nodeValue
                        asymmetricLoad.q_a_mvar = cellsArray[i].value.attributes[5].nodeValue
                        asymmetricLoad.q_b_mvar = cellsArray[i].value.attributes[6].nodeValue
                        asymmetricLoad.q_c_mvar = cellsArray[i].value.attributes[7].nodeValue
                        asymmetricLoad.sn_mva = cellsArray[i].value.attributes[8].nodeValue
                        asymmetricLoad.scaling = cellsArray[i].value.attributes[9].nodeValue
                        asymmetricLoad.type = cellsArray[i].value.attributes[10].nodeValue

                        asymmetricLoadNo++

                        asymmetricLoadArray.push(asymmetricLoad);
                    }


                    if (result.shapeELXXX == "Impedance") {
                        //zrób plik json i wyślij do backend
                        var impedance = new Object();
                        impedance.typ = "Impedance" + impedanceNo


                        console.log("Impedance attributes")
                        console.log(cellsArray[i].value.attributes)

                        try {
                            impedance.busFrom = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].source.mxObjectId.replace('#', '')
                            impedance.busFrom = impedance.busFrom.replace(/^\d/, 'NUMBER')
                            impedance.busTo = cellsArray[i].edges[1].target.id.replaceAll('-', '___')//cellsArray[i].target.mxObjectId.replace('#', '')
                            impedance.busTo = impedance.busTo.replace(/^\d/, 'NUMBER')

                            //Load_flow_parameters
                            impedance.rft_pu = cellsArray[i].value.attributes[2].nodeValue
                            impedance.xft_pu = cellsArray[i].value.attributes[3].nodeValue
                            impedance.sn_mva = cellsArray[i].value.attributes[4].nodeValue

                            impedanceNo++

                            impedanceArray.push(impedance);
                        } catch { //impedancja musi mieć dwa połączenia
                            alert("Connect an impedance's 'in' and 'out' to other element in the model. The impedance has not been taken into account in the simulation.")
                        }

                    }

                    if (result.shapeELXXX == "Ward") {
                        //zrób plik json i wyślij do backend
                        var ward = new Object();
                        ward.typ = "Ward" + wardNo

                        ward.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        ward.bus = ward.bus.replace(/^\d/, 'NUMBER')

                        console.log("Ward attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters
                        ward.ps_mw = cellsArray[i].value.attributes[2].nodeValue
                        ward.qs_mvar = cellsArray[i].value.attributes[3].nodeValue
                        ward.pz_mw = cellsArray[i].value.attributes[4].nodeValue
                        ward.qz_mvar = cellsArray[i].value.attributes[5].nodeValue

                        wardNo++

                        wardArray.push(ward);
                    }

                    if (result.shapeELXXX == "Extended Ward") {
                        //zrób plik json i wyślij do backend
                        var extendedWard = new Object();
                        extendedWard.typ = "Extended Ward" + extendedWardNo

                        extendedWard.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        extendedWard.bus = extendedWard.bus.replace(/^\d/, 'NUMBER')

                        console.log("Extended Ward attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters
                        extendedWard.ps_mw = cellsArray[i].value.attributes[2].nodeValue
                        extendedWard.qs_mvar = cellsArray[i].value.attributes[3].nodeValue
                        extendedWard.pz_mw = cellsArray[i].value.attributes[4].nodeValue
                        extendedWard.qz_mvar = cellsArray[i].value.attributes[5].nodeValue
                        extendedWard.r_ohm = cellsArray[i].value.attributes[6].nodeValue
                        extendedWard.x_ohm = cellsArray[i].value.attributes[7].nodeValue
                        extendedWard.vm_pu = cellsArray[i].value.attributes[8].nodeValue

                        extendedWardNo++

                        extendedWardArray.push(extendedWard);
                    }

                    if (result.shapeELXXX == "Motor") {
                        //zrób plik json i wyślij do backend
                        var motor = new Object();
                        motor.typ = "Motor" + motorNo

                        motor.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        motor.bus = motor.bus.replace(/^\d/, 'NUMBER')

                        console.log("Motor attributes")
                        console.log(cellsArray[i].value.attributes)


                        //Load_flow_parameters
                        motor.pn_mech_mw = cellsArray[i].value.attributes[2].nodeValue
                        motor.cos_phi = cellsArray[i].value.attributes[3].nodeValue
                        motor.efficiency_percent = cellsArray[i].value.attributes[4].nodeValue
                        motor.loading_percent = cellsArray[i].value.attributes[5].nodeValue
                        motor.scaling = cellsArray[i].value.attributes[6].nodeValue

                        //Short_circuit_parameters
                        motor.cos_phi_n = cellsArray[i].value.attributes[8].nodeValue
                        motor.efficiency_n_percent = cellsArray[i].value.attributes[9].nodeValue
                        motor.Irc_pu = cellsArray[i].value.attributes[10].nodeValue
                        motor.rx = cellsArray[i].value.attributes[11].nodeValue
                        motor.vn_kv = cellsArray[i].value.attributes[12].nodeValue

                        //Optional_parameters
                        motor.efficiency_percent = cellsArray[i].value.attributes[14].nodeValue
                        motor.loading_percent = cellsArray[i].value.attributes[15].nodeValue
                        motor.scaling = cellsArray[i].value.attributes[16].nodeValue

                        motorNo++

                        motorArray.push(motor);
                    }

                    if (result.shapeELXXX == "Storage") {
                        //zrób plik json i wyślij do backend
                        var storage = new Object();
                        storage.typ = "Storage" + storageNo

                        storage.bus = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        storage.bus = storage.bus.replace(/^\d/, 'NUMBER')

                        console.log("Storage attributes")
                        console.log(cellsArray[i].value.attributes)


                        //Load_flow_parameters
                        storage.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        storage.max_e_mwh = cellsArray[i].value.attributes[3].nodeValue

                        //Optional_parameters
                        storage.q_mvar = cellsArray[i].value.attributes[4].nodeValue
                        storage.sn_mva = cellsArray[i].value.attributes[5].nodeValue
                        storage.soc_percent = cellsArray[i].value.attributes[6].nodeValue
                        storage.min_e_mwh = cellsArray[i].value.attributes[7].nodeValue
                        storage.scaling = cellsArray[i].value.attributes[8].nodeValue
                        storage.type = cellsArray[i].value.attributes[9].nodeValue

                        storageNo++

                        storageArray.push(storage);
                    }

                    if (result.shapeELXXX == "DC Line") {
                        //zrób plik json i wyślij do backend
                        var dcLine = new Object();
                        dcLine.typ = "DC Line" + dcLineNo

                        dcLine.busFrom = cellsArray[i].edges[0].target.id.replaceAll('-', '___')//cellsArray[i].source.mxObjectId.replace('#', '')
                        dcLine.busFrom = dcLine.busFrom.replace(/^\d/, 'NUMBER')
                        dcLine.busTo = cellsArray[i].edges[1].target.id.replaceAll('-', '___')//cellsArray[i].target.mxObjectId.replace('#', '')
                        dcLine.busTo = dcLine.busTo.replace(/^\d/, 'NUMBER')

                        console.log("DC line attributes")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters
                        dcLine.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        dcLine.loss_percent = cellsArray[i].value.attributes[3].nodeValue
                        dcLine.loss_mw = cellsArray[i].value.attributes[4].nodeValue
                        dcLine.vm_from_pu = cellsArray[i].value.attributes[5].nodeValue
                        dcLine.vm_to_pu = cellsArray[i].value.attributes[6].nodeValue

                        dcLineNo++

                        dcLineArray.push(dcLine);
                    }


                    //wybierz obiekty typu Line
                    if (result.shapeELXXX == "Line") {
                        //zrób plik json i wyślij do backend
                        var line = new Object();
                        line.typ = "Line" + lineNo
                        line.name = cellsArray[i].id.replaceAll('-', '___')//mxObjectId.replace('#', '_')     
                        //line.id = cellsArray[i].id.replace('-','_')

                        //wybierz z busbarArray typ o nazwie cellsArray[i].source.id
                        //result = busbarArray.find( ({ name }) => name === "EmPby_tfOVPkMeLiDtfa-4" );                        

                        line.busFrom = cellsArray[i].source.id.replaceAll('-', '___')//cellsArray[i].source.mxObjectId.replace('#', '')
                        line.busFrom = line.busFrom.replace(/^\d/, 'NUMBER')
                        line.busTo = cellsArray[i].target.id.replaceAll('-', '___')//cellsArray[i].target.mxObjectId.replace('#', '')
                        line.busTo = line.busTo.replace(/^\d/, 'NUMBER')

                        console.log("Line attributes")
                        console.log(cellsArray[i].value.attributes)


                        line.length_km = cellsArray[i].value.attributes[2].nodeValue
                        line.parallel = cellsArray[i].value.attributes[3].nodeValue
                        line.df = cellsArray[i].value.attributes[4].nodeValue

                        //Load_flow_parameters
                        line.r_ohm_per_km = cellsArray[i].value.attributes[8].nodeValue
                        line.x_ohm_per_km = cellsArray[i].value.attributes[9].nodeValue
                        line.c_nf_per_km = cellsArray[i].value.attributes[10].nodeValue
                        line.g_us_per_km = cellsArray[i].value.attributes[11].nodeValue
                        line.max_i_ka = cellsArray[i].value.attributes[12].nodeValue
                        line.type = cellsArray[i].value.attributes[13].nodeValue

                        //line.in_service = cellsArray[i].value.attributes[13].nodeValue

                        //Short_circuit_parameters
                        line.r0_ohm_per_km = cellsArray[i].value.attributes[15].nodeValue ////w specyfikacji PandaPower jako nan
                        line.x0_ohm_per_km = cellsArray[i].value.attributes[16].nodeValue //w specyfikacji PandaPower jako nan
                        line.c0_nf_per_km = cellsArray[i].value.attributes[17].nodeValue //w specyfikacji PandaPower jako nan
                        line.endtemp_degree = cellsArray[i].value.attributes[18].nodeValue //w specyfikacji PandaPower jako nan



                        lineNo++

                        lineArray.push(line);
                    }

                }
            }




            //zamień w transformerArray kolejności busbar (hv, lv)
            //porównaj dwa napięcia i dzięki temu określ który jest HV i LV
            var twoWindingBusbarArray = [];

            for (var i = 0; i < transformerArray.length; i++) {

                bus1 = busbarArray.find(element => element.name == transformerArray[i].hv_bus);
                bus2 = busbarArray.find(element => element.name == transformerArray[i].lv_bus);
                twoWindingBusbarArray.push(bus1)
                twoWindingBusbarArray.push(bus2)


                var busbarWithHighestVoltage = twoWindingBusbarArray.reduce(
                    (prev, current) => {

                        return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                    }
                );
                var busbarWithLowestVoltage = twoWindingBusbarArray.reduce(
                    (prev, current) => {
                        return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                    }
                );

                transformerArray[i].hv_bus = busbarWithHighestVoltage.name
                transformerArray[i].lv_bus = busbarWithLowestVoltage.name
            }

            //zamień w threeWindingTransformerArray kolejności busbar (hv, mv, lv)
            //porównaj trzy napięcia i dzięki temu określ który jest HV, MV i LV
            var threeWindingBusbarArray = [];

            for (var i = 0; i < threeWindingTransformerArray.length; i++) {

                bus1 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].hv_bus);
                bus2 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].mv_bus);
                bus3 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].lv_bus);
                threeWindingBusbarArray.push(bus1)
                threeWindingBusbarArray.push(bus2)
                threeWindingBusbarArray.push(bus3)
                console.log(threeWindingBusbarArray)

                var busbarWithHighestVoltage = threeWindingBusbarArray.reduce(
                    (prev, current) => {

                        return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                    }
                );
                var busbarWithLowestVoltage = threeWindingBusbarArray.reduce(
                    (prev, current) => {
                        return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                    }
                );

                var busbarWithMiddleVoltage = threeWindingBusbarArray.find(element => element.name != busbarWithHighestVoltage.name && element.name != busbarWithLowestVoltage.name);

                threeWindingTransformerArray[i].hv_bus = busbarWithHighestVoltage.name
                threeWindingTransformerArray[i].mv_bus = busbarWithMiddleVoltage.name
                threeWindingTransformerArray[i].lv_bus = busbarWithLowestVoltage.name
            }

            array = dataToBackendArray.concat(simulationParametersArray)
            array = array.concat(externalGridArray)
            array = array.concat(generatorArray)
            array = array.concat(staticGeneratorArray)
            array = array.concat(asymmetricStaticGeneratorArray)
            array = array.concat(busbarArray)

            array = array.concat(transformerArray)
            array = array.concat(threeWindingTransformerArray)
            array = array.concat(shuntReactorArray)
            array = array.concat(capacitorArray)

            array = array.concat(loadArray)
            array = array.concat(asymmetricLoadArray)
            array = array.concat(impedanceArray)
            array = array.concat(wardArray)
            array = array.concat(extendedWardArray)
            array = array.concat(motorArray)
            array = array.concat(storageArray)
            array = array.concat(dcLineArray)
            array = array.concat(lineArray)

            var obj = Object.assign({}, array);
            console.log(JSON.stringify(obj))


            var printArray = function (arr) {
                if (typeof (arr) == "object") {
                    for (var i = 0; i < arr.length; i++) {
                        printArray(arr[i]);
                    }
                }
                else document.write(arr);
            }

            /*function zamiana(match, offset, string) {
                console.log('zamiana')
                return '-';//return (offset > 0 ? '-' : '') + match.toLowerCase();
            } */

            //*************** KONIEC - SCZYTYWANIE MODELU DO BACKEND ****************

            //wysyłanie do backend i otrzymywanie wyników
            let dataReceived = "";

            // this.createVertexTemplateEntry("line;strokeWidth=2;html=1;shapeELXXX=Bus;", 160, 10, "", "Bus"),


            //bootstrap button with spinner
            // this.ui.spinner.stop();
            fetch("http://127.0.0.1:5005/json-example", { //https://electrisimbackendpython.onrender.com/json-example      
                mode: "cors",
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                    // "Access-Control-Allow-Origin":"*",                                  
                },
                body: JSON.stringify(obj)
            })

                //.then(response => console.log(response))


                .then(response => {
                    apka.spinner.stop();

                    if (response.status === 200) {
                        console.log("Przyszło 200")
                        console.log(response)
                        return response.json()
                    } else {
                        console.log("Nie przyszło 200")
                        console.log("Status: " + response.status)
                        return Promise.reject("server")
                    }
                })
                .then(dataJson => {
                    console.log("dataJson:")
                    console.log(dataJson)



                    if (dataJson[0] != undefined) {
                        if (dataJson[0] == "line") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (var i = 1; i < dataJson.length; i++) {
                                console.log(dataJson[i])
                                alert("Line" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0] == "bus") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (var i = 1; i < dataJson.length; i++) {
                                console.log(dataJson[i])
                                alert("Bus" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0] == "ext_grid") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (var i = 1; i < dataJson.length; i++) {
                                console.log(dataJson[i])
                                alert("External Grid" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0][0] == "trafo3w") {

                            alert("Three-winding transformer: nominal voltage does not match")
                            //rozpływ się nie udał, output z diagnostic_function
                            //for (var i = 1; i < dataJson.length; i++) {
                            //    console.log(dataJson[i])
                            //    alert("Three Winding Transformer"+dataJson[i][0]+" " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            //}
                        }
                        if (dataJson[0] == "overload") {
                            alert("One of the element is overloaded. The load flow did not converge.")

                        }
                    }


                    //*************** WYŚWIETLANIE WYNIKÓW NA DIAGRAMIE ****************
                    var csvArray = []
                    var oneBusbarArray = []

                    /*dataJson.lines.forEach(function(arrayTen) {
                        let row = dataJson.lines.join(",");
                        csvContent += row + "\r\n";
                    });*/

                    //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Line
                    let csvContent = "data:text/csv;charset=utf-8,Busbar Name,v_m, va_degree\n";

                    for (var i = 0; i < dataJson.busbars.length; i++) {



                        resultId = dataJson.busbars[i].name

                        resultId = resultId.replace('NUMBER', dataJson.busbars[i].name)

                        //sprawdz na jakich pozycjach był znak '-'
                        //podmien w tyc pozycjach znaki
                        resultId = resultId.replaceAll('___', '-')

                        dataJson.busbars[i].name = resultId

                        //for the csv file
                        let row = Object.values(dataJson.busbars[i]).join(",")
                        csvContent += row + "\r\n";

                        //create label
                        var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                        var label12 = b.insertVertex(resultCell, null, 'U[pu]: ' + dataJson.busbars[i].vm_pu.toFixed(3), 0.2, 1.4, 0, 0, null, true);
                        label12.setStyle('shapeELXXX=Result')

                        var label12 = b.insertVertex(resultCell, null, 'U[degree]: ' + dataJson.busbars[i].va_degree.toFixed(3), 0.2, 2.7, 0, 0, null, true);
                        label12.setStyle('shapeELXXX=Result')
                        /*
                        if (dataJson.parameter[i] == 'pf') {
                            var label12 = b.insertVertex(resultCell, null, 'PF: ' + dataJson.value[i].toFixed(3), 0.2, 4, 0, 0, null, true);
                        }
                        
                        if (dataJson.parameter[i] == 'p_mw') {
                            var label12 = b.insertVertex(resultCell, null, 'P[MW]: ' + dataJson.value[i].toFixed(3), 1, 4, 0, 0, null, true);
                        }
                        if (dataJson.parameter[i] == 'q_mvar') {
                            var label12 = b.insertVertex(resultCell, null, 'Q[MVar]: ' + dataJson.value[i].toFixed(3), 1, 5.3, 0, 0, null, true);
                        }*/

                    }

                    //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Line
                    csvContent += "Line Name, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, i_from_ka, i_to_ka, loading_percent \n";
                    for (var i = 0; i < dataJson.lines.length; i++) {

                        resultId = dataJson.lines[i].name

                        resultId = resultId.replace('NUMBER', dataJson.lines[i].name)

                        //sprawdz na jakich pozycjach był znak '-'
                        //podmien w tyc pozycjach znaki
                        resultId = resultId.replaceAll('___', '-')

                        dataJson.lines[i].name = resultId

                        //for the csv file
                        let row = Object.values(dataJson.lines[i]).join(",")
                        csvContent += row + "\r\n";

                        var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId


                        var label12 = b.insertVertex(resultCell, null, 'P[MW]: ' + dataJson.lines[i].p_from_mw.toFixed(3), -0.9, 43, 0, 0, null, true);
                        label12.setStyle('shapeELXXX=Result')

                        var label12 = b.insertVertex(resultCell, null, 'Q[MVar]: ' + dataJson.lines[i].q_from_mvar.toFixed(3), -0.8, 43, 0, 0, null, true);
                        label12.setStyle('shapeELXXX=Result')

                        var label12 = b.insertVertex(resultCell, null, 'i[kA]: ' + dataJson.lines[i].i_from_ka.toFixed(3), -0.7, 43, 0, 0, null, true);
                        label12.setStyle('shapeELXXX=Result')

                        /*
                        if (dataJson.parameter[i] == 'i_ka') {
                            var label12 = b.insertVertex(resultCell, null, 'I[kA]: ' + dataJson.value[i].toFixed(3), -0.4, 43, 0, 0, null, true);
                        }
                        
                        if (dataJson.parameter[i] == 'pl_mw') {
                            var label12 = b.insertVertex(resultCell, null, 'Pl[MW]: ' + dataJson.value[i].toFixed(3), -0.2, 43, 0, 0, null, true);
                        }
                        if (dataJson.parameter[i] == 'ql_mvar') {
                            var label12 = b.insertVertex(resultCell, null, 'Ql[MVar]: ' + dataJson.value[i].toFixed(3), -0.1, 43, 0, 0, null, true);
                        } */

                        var label12 = b.insertVertex(resultCell, null, 'Loading[%]: ' + dataJson.lines[i].loading_percent.toFixed(1), -0.3, 43, 0, 0, null, true);
                        label12.setStyle('shapeELXXX=Result')
                        label12.setAttribute('idELXXX', 'lineLoadingId')

                        //zmiana kolorów 

                        if(dataJson.lines[i].loading_percent.toFixed(1) > 90){
                            label12.setStyle('color:red')

                            
                            
                            
                            console.log('resultCell')
                            console.log(resultCell)

                            console.log(document.getElementById('lineLoadingId'))
                            
                            
                        }

                        var label12 = b.insertVertex(resultCell, null, 'P[MW]: ' + dataJson.lines[i].p_to_mw.toFixed(3), 0.7, 43, 0, 0, null, true);
                        label12.setStyle('shapeELXXX=Result')
                        var label12 = b.insertVertex(resultCell, null, 'Q[MVar]: ' + dataJson.lines[i].q_to_mvar.toFixed(3), 0.8, 43, 0, 0, null, true);
                        label12.setStyle('shapeELXXX=Result')
                        var label12 = b.insertVertex(resultCell, null, 'i[kA]: ' + dataJson.lines[i].i_to_ka.toFixed(3), 0.9, 43, 0, 0, null, true);
                        label12.setStyle('shapeELXXX=Result')
                    }
                    //download to CSV
                    var encodedUri = encodeURI(csvContent);
                    var link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "Results.csv");
                    document.body.appendChild(link); // Required for FF
                    link.click();

                })
                .catch(err => {
                    if (err === "server") return
                    console.log(err)
                })

        }
    })

}