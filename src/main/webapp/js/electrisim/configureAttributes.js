// Export all configure functions and make them globally available

/** Default scaling for load/gen/sgen etc.: use "1" when value is "0", null, undefined, or empty */
function defaultScaling(value) {
    if (value == null || value === "" || value === "0") return "1";
    return String(value);
}

export function configureExternalGridAttributes(grafka, vertex, options = {}) {
    
    // Create XML document
    var g = mxUtils.createXmlDocument().createElement("object");
    
    g.setAttribute("name", "External Grid");
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("vm_pu", options.vm_pu || "1");
    g.setAttribute("va_degree", options.va_degree || "0");
    //g.setAttribute("in_service", true);

    //Short-circuit 
    g.setAttribute("Short_circuit_parameters", "");
    g.setAttribute("s_sc_max_mva", "1000000.0");    
    g.setAttribute("s_sc_min_mva", "0");
    g.setAttribute("rx_max", "0");
    g.setAttribute("rx_min", "0");
    g.setAttribute("r0x0_max", "0");
    g.setAttribute("x0x_max", "0");

    // Harmonic analysis parameters (OpenDSS Vsource)
    g.setAttribute("Harmonic_parameters", "");
    g.setAttribute("spectrum", options.spectrum || "defaultvsource");

    // Set the new value for the vertex
    grafka.getModel().setValue(vertex, g);
    
    
    //podpisz external grid
    grafka.insertVertex(vertex, null, 'External Grid', 0.5, -0.25, 0, 0, null, true);
            
}

export function configureGeneratorAttributes(grafka, vertex, options = {}) {

    // Create XML document
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Generator");                
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("p_mw", options.p_mw || "0");
    g.setAttribute("vm_pu", options.vm_pu || "1");
    g.setAttribute("sn_mva", options.sn_mva || "0");
    g.setAttribute("scaling", defaultScaling(options.scaling));
    g.setAttribute("slack", (options.slack === true || options.slack === 'true') ? "true" : "false");
    // g.setAttribute("in_service", true);                

    //short-circuit
    g.setAttribute("Short_circuit_parameters", "");
    g.setAttribute("vn_kv", options.vn_kv || "0");
    g.setAttribute("xdss_pu", options.xdss_pu || "0");
    g.setAttribute("rdss_ohm", options.rdss_ohm || "0");
    g.setAttribute("cos_phi", options.cos_phi || "0");
    g.setAttribute("pg_percent", options.pg_percent || "0");
    g.setAttribute("power_station_trafo", options.power_station_trafo || "0");
    

    //Optimal Power Flow
    /*
    g.setAttribute("controllable", true);
    g.setAttribute("max_p_mw", "0");
    g.setAttribute("min_p_mw", "0");
    g.setAttribute("max_q_mvar", "0");
    g.setAttribute("min_q_mvar", "0");
    g.setAttribute("min_vm_pu", "0");
    g.setAttribute("max_vm_pu", "0");*/

    //distributed power flow
    //g.setAttribute("slack_weight", "0"); 

    // Harmonic analysis parameters (OpenDSS)
    // Reference: https://opendss.epri.com/Properties9.html
    g.setAttribute("Harmonic_parameters", "");
    g.setAttribute("spectrum", options.spectrum || "defaultgen");
    g.setAttribute("Xdpp", options.Xdpp || "0.20");
    g.setAttribute("XRdp", options.XRdp || "20");

    grafka.getModel().setValue(vertex, g)

    grafka.insertVertex(vertex, null, 'Generator', 0.5, 1.1, 0, 0, null, true);
}

export function configureStaticGeneratorAttributes(grafka, vertex, options = {}) {


    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Static Generator");
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("p_mw", options.p_mw || "0");
    g.setAttribute("q_mvar", options.q_mvar ||  "0");
    g.setAttribute("sn_mva", options.sn_mva ||  "0");
    g.setAttribute("scaling", defaultScaling(options.scaling));
    g.setAttribute("type",  options.type || "Wye");
    //g.setAttribute("in_service", true);

    //short-circuit
    g.setAttribute("Short_circuit_parameters", "");
    g.setAttribute("k", options.k ||  "0");
    g.setAttribute("rx", options.rx ||  "0");
    g.setAttribute("generator_type", options.generator_type ||  "async");
    g.setAttribute("lrc_pu", options.lrc_pu ||  "0.0");
    g.setAttribute("max_ik_ka", options.max_ik_ka ||  "0.0");
    g.setAttribute("kappa", options.kappa ||  "0.0");
    g.setAttribute("current_source", options.current_source || true);

    //OPF
    /*
    g.setAttribute("max_p_mw", "0");
    g.setAttribute("min_p_mw", "0");
    g.setAttribute("max_q_mvar", "0");
    g.setAttribute("min_q_mvar", "0");
    g.setAttribute("controllable", true);
    g.setAttribute("q_mvar", "0");*/

    // Harmonic analysis parameters (OpenDSS)
    // Reference: https://opendss.epri.com/Properties9.html
    g.setAttribute("Harmonic_parameters", "");
    g.setAttribute("spectrum", options.spectrum || "defaultgen");
    g.setAttribute("Xdpp", options.Xdpp || "0.20");
    g.setAttribute("XRdp", options.XRdp || "20");

    grafka.getModel().setValue(vertex, g)

    //podpisz 
    grafka.insertVertex(vertex, null, 'Static Generator', 0.5, 1.1, 0, 0, null, true);
    
}

export function configureAsymmetricStaticGeneratorAttributes(grafka, vertex, options = {}) {
    
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Asymmetric Static Generator");
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("p_a_mw", options.p_a_mw || "0");
    g.setAttribute("p_b_mw", options.p_b_mw || "0");
    g.setAttribute("p_c_mw", options.p_c_mw || "0");
    g.setAttribute("q_a_mvar", options.q_a_mvar || "0");
    g.setAttribute("q_b_mvar", options.q_b_mvar || "0");
    g.setAttribute("q_c_mvar", options.q_c_mvar || "0");
    g.setAttribute("sn_mva", options.sn_mva || "0");
    g.setAttribute("scaling", defaultScaling(options.scaling));
    g.setAttribute("type", options.type || "Wye");
    // g.setAttribute("in_service", true); //in_service nie działa

    grafka.getModel().setValue(vertex, g)

    //podpisz 
    grafka.insertVertex(vertex, null, 'Asymmetric Static Generator', 0.5, 1.1, 0, 0, null, true);

}

export function configureBusAttributes(grafka, vertex, options = {}) {
    // Create XML document
    var g = mxUtils.createXmlDocument().createElement("object");

    // Set label (use existing parametry or empty string)
    
    g.setAttribute("name", options.name ||"Bus"); 
 
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("vn_kv", options.vn_kv || "0");
     
    //g.setAttribute("type", "b");
    //g.setAttribute("in_service", true); //in_service nie działa

    //Optimal Power Flow
    /*
    g.setAttribute("max_vm_pu", "0");
    g.setAttribute("min_vm_pu", "0");  */

    // Set the new value for the vertex
    grafka.getModel().setValue(vertex, g);
    //set label 
    grafka.insertVertex(vertex, null, options.name || "Bus" , 0, -0.5, 0, 0, null, true);   
}

export function configureTransformerAttributes(grafka, vertex, options = {}) {

    var g = mxUtils.createXmlDocument().createElement("object");

    g.setAttribute("name", "Transformer");

    g.setAttribute("parameters", true);  //na potrzeby wyboru elementu z biblioteki
    g.setAttribute("name", options.name ||"-");
    g.setAttribute("Load_flow_parameters", "")
    g.setAttribute("sn_mva", options.sn_mva || "0");
    g.setAttribute("vn_hv_kv", options.vn_hv_kv || "0");
    g.setAttribute("vn_lv_kv", options.vn_lv_kv || "0");

    g.setAttribute("Short_circuit_parameters", "");
    g.setAttribute("vkr_percent", options.vkr_percent || "0");
    g.setAttribute("vk_percent", options.vk_percent || "0");
    g.setAttribute("pfe_kw", options.pfe_kw || "0");
    g.setAttribute("i0_percent", options.i0_percent || "0");
    g.setAttribute("vector_group", options.vector_group || "Dyn");
    g.setAttribute("vk0_percent", options.vk0_percent || "0");
    g.setAttribute("vkr0_percent", options.vkr0_percent || "0");
    g.setAttribute("mag0_percent", options.mag0_percent || "0");
    g.setAttribute("si0_hv_partial", options.si0_hv_partial || "0");

    //Optional
    //g.setAttribute("in_service", true); //in_service nie działa
    g.setAttribute("Optional_parameters", "");
    g.setAttribute("parallel", options.parallel || "1");
    g.setAttribute("shift_degree", options.shift_degree || "0");
    g.setAttribute("tap_side", options.tap_side || "hv");
    g.setAttribute("tap_pos", options.tap_pos || "0");
    g.setAttribute("tap_neutral", options.tap_neutral || "0");
    g.setAttribute("tap_max", options.tap_max || "0");
    g.setAttribute("tap_min", options.tap_min ||"0");
    g.setAttribute("tap_step_percent", options.tap_step_percent || "0");
    g.setAttribute("tap_step_degree", options.tap_step_degree ||"0");
    g.setAttribute("tap_phase_shifter", false);
    g.setAttribute("tap_changer_type", options.tap_changer_type || "Ratio"); // pandapower 3.0+: "Ratio", "Symmetrical", or "Ideal"

    // Harmonic analysis parameters (OpenDSS Transformer)
    g.setAttribute("Harmonic_parameters", "");
    g.setAttribute("XRConst", options.XRConst || "No");

    grafka.getModel().setValue(vertex, g)

    // grafka.insertVertex(umieszczonaCell, null, 'Transformer', -0.25, 0, 0, 0, null, true);
}

export function configureThreeWindingTransformerAttributes(grafka, vertex, options = {}) {
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Three winding transformer");

    g.setAttribute("parameters", true);  //na potrzeby wyboru elementu z biblioteki

    g.setAttribute("name", "-"); 

    //INPUT
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("sn_hv_mva", "0");
    g.setAttribute("sn_mv_mva", "0");
    g.setAttribute("sn_lv_mva", "0");

    g.setAttribute("vn_hv_kv", "0");
    g.setAttribute("vn_mv_kv", "0");
    g.setAttribute("vn_lv_kv", "0");

    g.setAttribute("vk_hv_percent", "0");
    g.setAttribute("vk_mv_percent", "0");
    g.setAttribute("vk_lv_percent", "0");


    g.setAttribute("Short_circuit_parameters", "");
    g.setAttribute("vkr_hv_percent", "0");
    g.setAttribute("vkr_mv_percent", "0");
    g.setAttribute("vkr_lv_percent", "0");

    g.setAttribute("pfe_kw", "0");
    g.setAttribute("i0_percent", "0");

    g.setAttribute("vk0_hv_percent", "0");
    g.setAttribute("vk0_mv_percent", "0");
    g.setAttribute("vk0_lv_percent", "0");
    g.setAttribute("vkr0_hv_percent", "0");
    g.setAttribute("vkr0_mv_percent", "0");
    g.setAttribute("vkr0_lv_percent", "0");
    g.setAttribute("vector_group", "0");  //vector_group (list of String) - Vector group of the transformer3w


    //OPTIONAL
    g.setAttribute("Optional_parameters", "");
    g.setAttribute("shift_mv_degree", "0");
    g.setAttribute("shift_lv_degree", "0");
    g.setAttribute("tap_step_percent", "0");
    g.setAttribute("tap_side", "hv");
    g.setAttribute("tap_neutral", "0");
    g.setAttribute("tap_min", "0");
    g.setAttribute("tap_max", "0");
    g.setAttribute("tap_pos", "0");
    g.setAttribute("tap_at_star_point", true);
    g.setAttribute("tap_changer_type", "Ratio"); // pandapower 3.0+: "Ratio", "Symmetrical", or "Ideal"
    // g.setAttribute("in_service", true); //in_service nie działa

    //Optimal power flow
    /*
    g.setAttribute("max_loading_percent", "0");
    g.setAttribute("tap_pos", "0");*/

    grafka.getModel().setValue(vertex, g)
    //this.currentGraph.insertVertex(umieszczonaCell, null, 'Three Winding Transformer', -0.25, 0, 0, 0, null, true);             


}

export function configureShuntReactorAttributes(grafka, vertex, options = {}) {
  
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Shunt Reactor");

    //INPUT
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("p_mw", options.p_mw || "0");
    g.setAttribute("q_mvar", options.q_mvar ||  "0");
    g.setAttribute("vn_kv", options.vn_kv || "0");

    //OPTIONAL
    g.setAttribute("Optional_parameters", "");
    
    g.setAttribute("step", options.step || "1");
    g.setAttribute("max_step", options.max_step || "1");
    // g.setAttribute("in_service", "True"); //in_service nie działa

    grafka.getModel().setValue(vertex, g)

    // grafka.insertVertex(umieszczonaCell, null, 'Shunt Reactor', -0.25, 0, 0, 0, null, true);
}

export function configureCapacitorAttributes(grafka, vertex, options = {}) {            

    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Capacitor");

    //INPUT     
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("q_mvar", options.q_mvar || "0");
    g.setAttribute("loss_factor", options.loss_factor || "0");
    g.setAttribute("vn_kv", options.vn_kv || "0");

    //OPTIONAL
    g.setAttribute("Optional_parameters", options.vm_pu || "");
    g.setAttribute("step", options.step || "1");
    g.setAttribute("max_step", options.max_step || "1");
    // g.setAttribute("in_service", "True"); //in_service nie działa

    grafka.getModel().setValue(vertex, g)

    //this.currentGraph.insertVertex(umieszczonaCell, null, 'Capacitor', -0.25, 0, 0, 0, null, true);
}

export function configureLoadAttributes(grafka, vertex, options = {}) {

    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Load");

    //OPTIONAL
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("p_mw", options.p_mw ||"0");
    g.setAttribute("q_mvar", options.q_mvar ||"0");
    g.setAttribute("const_z_percent", options.const_z_percent ||"0");
    g.setAttribute("const_i_percent", options.const_i_percent ||"0");
    g.setAttribute("sn_mva", options.sn_mva ||"0");
    g.setAttribute("scaling", defaultScaling(options.scaling));
    g.setAttribute("type", options.type || "Wye");
    //g.setAttribute("in_service", "True"); //in_service nie działa

    // Harmonic analysis parameters (OpenDSS)
    // Reference: https://opendss.epri.com/HarmonicsLoadModeling.html
    g.setAttribute("Harmonic_parameters", "");
    g.setAttribute("spectrum", options.spectrum || "defaultload");
    g.setAttribute("spectrum_csv", options.spectrum_csv || "");
    g.setAttribute("pctSeriesRL", options.pctSeriesRL ?? "100");
    g.setAttribute("conn", (options.conn || "wye").toLowerCase());
    g.setAttribute("puXharm", options.puXharm || "0.0");
    g.setAttribute("XRharm", options.XRharm || "6.0");

    grafka.getModel().setValue(vertex, g)
    
    grafka.insertVertex(vertex, null, 'Load', 0.5, 1.5, 0, 0, null, true);
}

export function configureAsymmetricLoadAttributes(grafka, vertex, options = {}) {
    var parametry = grafka.getModel().getValue(vertex);

    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Asymmetric Load");

    //OPTIONAL
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("p_a_mw", options.p_a_mw || "0");
    g.setAttribute("p_b_mw", options.p_b_mw || "0");
    g.setAttribute("p_c_mw", options.p_c_mw || "0");

    g.setAttribute("q_a_mvar", options.q_a_mvar || "0");
    g.setAttribute("q_b_mvar", options.q_b_mvar || "0");
    g.setAttribute("q_c_mvar", options.q_c_mvar || "0");

    g.setAttribute("sn_mva", options.sn_mva || "0");
    g.setAttribute("scaling", defaultScaling(options.scaling));
    g.setAttribute("type", options.type || "Wye");
    // g.setAttribute("in_service", "True"); //in_service nie działa

    grafka.getModel().setValue(vertex, g)

    grafka.insertVertex(vertex, null, 'A.Load', 0.5, 1.5, 0, 0, null, true);
}

export function configureImpedanceAttributes(grafka, vertex, options = {}) {

    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", options.name || "Impedance");

    //INPUT
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("r_pu", options.r_pu ?? options.rft_pu ?? "0");
    g.setAttribute("x_pu", options.x_pu ?? options.xft_pu ?? "0");
    g.setAttribute("sn_mva", options.sn_mva || "0");

    grafka.getModel().setValue(vertex, g)

    grafka.insertVertex(vertex, null, 'Impedance', 0.5, 1.5, 0, 0, null, true);
}

export function configureWardAttributes(grafka, vertex, options = {}) {
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Ward");

    //INPUT
    g.setAttribute("Load_flow_parameters", "");  
    g.setAttribute("ps_mw", options.ps_mw || "0");
    g.setAttribute("qs_mvar", options.qs_mvar || "0");
    g.setAttribute("pz_mw", options.pz_mw ||"0");
    g.setAttribute("qz_mvar", options.qz_mvar || "0");

    grafka.getModel().setValue(vertex, g)

    grafka.insertVertex(vertex, null, 'Ward', 0.5, 1.5, 0, 0, null, true);
}

export function configureExtendedWardAttributes(grafka, vertex, options = {}) {
    
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Extended Ward");

    //INPUT
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("ps_mw", options.ps_mw || "0");
    g.setAttribute("qs_mvar", options.qs_mvar || "0");
    g.setAttribute("pz_mw", options.pz_mw || "0");
    g.setAttribute("qz_mvar", options.qz_mvar || "0");

    g.setAttribute("r_ohm", options.r_ohm || "0");
    g.setAttribute("x_ohm", options.x_ohm || "0");
    g.setAttribute("vm_pu", options.vm_pu || "0");

    //distributed slack power flow
    //g.setAttribute("slack_weight", "0");

    grafka.getModel().setValue(vertex, g)

    grafka.insertVertex(vertex, null, 'ExtendedWard', 0.5, 1.5, 0, 0, null, true);
}

export function configureMotorAttributes(grafka, vertex, options = {}) {
   
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Motor");

    //g.setAttribute("parameters", true);  //na potrzeby wyboru elementu z biblioteki

    //INPUT
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("pn_mech_mw", options.pn_mech_mw || "0");
    g.setAttribute("cos_phi", options.cos_phi ||"0");

    //Short-circuit
    g.setAttribute("Short_circuit_parameters", "");
    g.setAttribute("cos_phi_n", options.cos_phi_n || "0");
    g.setAttribute("efficiency_n_percent", options.efficiency_n_percent || "0");
    g.setAttribute("lrc_pu", options.lrc_pu || "0");
    g.setAttribute("rx", options.rx ||"0");
    g.setAttribute("vn_kv", options.vn_kv || "0");

    //OPTIONAL
    g.setAttribute("Optional_parameters", "");
    g.setAttribute("efficiency_percent", options.efficiency_percent ||"0");
    g.setAttribute("loading_percent", options.loading_percent || "0");
    g.setAttribute("scaling", defaultScaling(options.scaling));
    // g.setAttribute("in_service", "True");  //in_service nie działa                

    grafka.getModel().setValue(vertex, g)

    grafka.insertVertex(vertex, null, 'M', 0.5, 0.4, 0, 0, 'fontSize=35;', true);
}

export function configureStorageAttributes(grafka, vertex, options = {}) {

    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Storage");

    //INPUT
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("p_mw", options.p_mw || "0");
    g.setAttribute("max_e_mwh", "0");

    //OPTIONAL
    g.setAttribute("Optional_parameters", "");
    g.setAttribute("q_mvar", options.q_mvar || "0");
    g.setAttribute("sn_mva", options.sn_mva || "0");
    g.setAttribute("soc_percent", options.soc_percent ||  "0");
    g.setAttribute("min_e_mwh", options.min_e_mwh || "0");
    g.setAttribute("scaling", defaultScaling(options.scaling));
    g.setAttribute("type", options.type ||"0");
    // g.setAttribute("in_service", "True");

    // Harmonic analysis parameters (OpenDSS)
    // Reference: https://opendss.epri.com/Storage.html
    g.setAttribute("Harmonic_parameters", "");
    g.setAttribute("spectrum", options.spectrum || "default");

    // OpenDSS-specific parameters (https://opendss.epri.com/Properties5.html)
    g.setAttribute("OpenDSS_parameters", "");
    g.setAttribute("pct_charge", String(options.pct_charge ?? 100));
    g.setAttribute("pct_discharge", String(options.pct_discharge ?? 100));
    g.setAttribute("pct_eff_charge", String(options.pct_eff_charge ?? 90));
    g.setAttribute("pct_eff_discharge", String(options.pct_eff_discharge ?? 90));
    g.setAttribute("state", options.state || "IDLING");
    g.setAttribute("disp_mode", options.disp_mode || "DEFAULT");

    //Optimal Power Flow
    /*
    g.setAttribute("max_p_mw", "0");
    g.setAttribute("min_p_mw", "0");
    g.setAttribute("max_q_mvar", "0");
    g.setAttribute("min_q_mvar", "0");

    g.setAttribute("controllable", "True");*/

    grafka.getModel().setValue(vertex, g)

    grafka.insertVertex(vertex, null, 'Storage', 0.5, 1.5, 0, 0, null, true);
}

export function configureSVCAttributes(grafka, vertex, options = {}) {

    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "SVC");

    //INPUT                
    g.setAttribute("x_l_ohm", options.x_l_ohm || "0");
    g.setAttribute("x_cvar_ohm", options.x_cvar_ohm || "0");
    g.setAttribute("set_vm_pu", options.set_vm_pu || "0");
    g.setAttribute("thyristor_firing_angle_degree",  options.thyristor_firing_angle_degree ||"0");

    //OPTIONAL                
    g.setAttribute("controllable", options.controllable || "True");
    g.setAttribute("min_angle_degree", options.min_angle_degree || "90");
    g.setAttribute("max_angle_degree", options.max_angle_degree || "180");

    grafka.getModel().setValue(vertex, g)

    grafka.insertVertex(vertex, null, 'SVC', 0.5, 1.5, 0, 0, null, true);
}

export function configureTCSCAttributes(grafka, vertex, options = {}) {

    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "TCSC");

    //INPUT                
    g.setAttribute("x_l_ohm", options.x_l_ohm ||"0");
    g.setAttribute("x_cvar_ohm", options.x_cvar_ohm || "0");
    g.setAttribute("set_p_to_mw", options.set_p_to_mw || "0");
    g.setAttribute("thyristor_firing_angle_degree", options.thyristor_firing_angle_degree || "0");

    //OPTIONAL                
    g.setAttribute("controllable", options.controllable || "True");
    g.setAttribute("min_angle_degree", options.min_angle_degree || "90");
    g.setAttribute("max_angle_degree", options.max_angle_degree || "180");

    grafka.getModel().setValue(vertex, g)

    grafka.insertVertex(vertex, null, 'TCSC', 0.5, 1.5, 0, 0, null, true);
}

export function configureSSCAttributes(grafka, vertex, options = {}) {
    var parametry = grafka.getModel().getValue(vertex);

    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "SSC");

    //INPUT                
    g.setAttribute("r_ohm", options.r_ohm || "0");
    g.setAttribute("x_ohm", options.x_ohm || "0");
    g.setAttribute("set_vm_pu", options.set_vm_pu || "0");
    g.setAttribute("vm_internal_pu", options.vm_internal_pu || "0");
    g.setAttribute("va_internal_degree", options.va_internal_degree || "0");

    //OPTIONAL                
    g.setAttribute("controllable", options.controllable || "True");

    grafka.getModel().setValue(vertex, g)

    grafka.insertVertex(vertex, null, 'SSC', 0.5, 1.5, 0, 0, null, true);
}

export function configureDCLineAttributes(grafka, vertex, options = {}) {
    var parametry = grafka.getModel().getValue(vertex);

    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "DC Line");
    //INPUT
    g.setAttribute("Load_flow_parameters", "");  
    g.setAttribute("p_mw", options.p_mw || "0");
    g.setAttribute("loss_percent", options.loss_percent || "0");
    g.setAttribute("loss_mw", options.loss_mw || "0");
    g.setAttribute("vm_from_pu", options.vm_from_pu || "0");
    g.setAttribute("vm_to_pu", options.vm_to_pu || "0");

    //OPTIONAL
    //g.setAttribute("in_service", "True"); //in_service nie działa                               

    //Optimal Power Flow
    /*
    g.setAttribute("max_p_mw", "0");
    g.setAttribute("min_q_from_mvar", "0");
    g.setAttribute("min_q_to_mvar", "0");
    g.setAttribute("max_q_from_mvar", "0");
    g.setAttribute("max_q_to_mvar", "0");

    g.setAttribute("controllable", "True");*/

    grafka.getModel().setValue(vertex, g) 

    grafka.insertVertex(vertex, null, 'DC Line', 0.5, 0.5, 0, 0, null, true);
}


export function configureLineAttributes(grafka, vertex, options = {}) {
    var parametry = grafka.getModel().getValue(vertex);

    var g = mxUtils.createXmlDocument().createElement("object");


    g.setAttribute("from_bus", options.from_bus || "");
    g.setAttribute("to_bus", options.to_bus || "");
    g.setAttribute("length_km", options.length_km || "0");
    g.setAttribute("parallel", options.parallel || "0");
    g.setAttribute("df", options.df || "1");
    //możliwość wyboru z biblioteki
    g.setAttribute("parameters", true);
    g.setAttribute("name", options.name || "Line");

    //INPUT
    g.setAttribute("Load_flow_parameters", "");  
    g.setAttribute("r_ohm_per_km", options.r_ohm_per_km || "0");
    g.setAttribute("x_ohm_per_km", options.x_ohm_per_km || "0");
    g.setAttribute("c_nf_per_km", options.c_nf_per_km || "0");
    g.setAttribute("g_us_per_km", options.g_us_per_km || "0");
    g.setAttribute("max_i_ka", options.max_i_ka || "0");
    g.setAttribute("type", options.type || "cs");

    //Short circuit parameters
    g.setAttribute("r0_ohm_per_km", options.r0_ohm_per_km || "0.1");
    g.setAttribute("x0_ohm_per_km", options.x0_ohm_per_km || "0.1");
    g.setAttribute("c0_nf_per_km", options.c0_nf_per_km || "0.1");
    g.setAttribute("endtemp_degree", "0");  


    grafka.getModel().setValue(vertex, g) 
}

export function configureDcBusAttributes(grafka, vertex, options = {}) {
    var g = mxUtils.createXmlDocument().createElement("object");
    
    g.setAttribute("name", options.name || "DC Bus");
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("vn_kv", options.vn_kv || "0");
    
    grafka.getModel().setValue(vertex, g);
    grafka.insertVertex(vertex, null, options.name || "DC Bus", 0, -0.5, 0, 0, null, true);
}

export function configureLoadDcAttributes(grafka, vertex, options = {}) {
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Load DC");
    
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("p_mw", options.p_mw || "0");
    
    grafka.getModel().setValue(vertex, g);
    grafka.insertVertex(vertex, null, 'Load DC', 0.5, 1.5, 0, 0, null, true);
}

export function configureSourceDcAttributes(grafka, vertex, options = {}) {
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Source DC");
    
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("vm_pu", options.vm_pu || "1.0");
    
    grafka.getModel().setValue(vertex, g);
    grafka.insertVertex(vertex, null, 'Source DC', 0.5, -0.25, 0, 0, null, true);
}

export function configureSwitchAttributes(grafka, vertex, options = {}) {
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", "Switch");
    
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("et", options.et || "b"); // element type: 'b' for bus, 'l' for line
    g.setAttribute("type", options.type || "LS"); // switch type: 'LS' load switch, 'CB' circuit breaker, 'LBS' load break switch
    g.setAttribute("closed", options.closed !== undefined ? options.closed : true);
    g.setAttribute("z_ohm", options.z_ohm || "0.0");
    
    grafka.getModel().setValue(vertex, g);
}

export function configureVscAttributes(grafka, vertex, options = {}) {
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", options.name || "VSC");
    
    // VSC connects AC bus to DC bus - connections detected from diagram edges
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("r_ohm", options.r_ohm || "0.01");         // Coupling transformer resistance
    g.setAttribute("x_ohm", options.x_ohm || "0.1");          // Coupling transformer reactance
    g.setAttribute("r_dc_ohm", options.r_dc_ohm || "0.01");   // Internal DC resistance
    g.setAttribute("control_mode_ac", options.control_mode_ac || "vm_pu");  // 'vm_pu' or 'q_mvar'
    g.setAttribute("control_value_ac", options.control_value_ac || "1.0");  // AC control setpoint
    g.setAttribute("control_mode_dc", options.control_mode_dc || "p_mw");   // 'vm_pu' or 'p_mw'
    g.setAttribute("control_value_dc", options.control_value_dc || "0.0");  // DC control setpoint
    g.setAttribute("in_service", options.in_service !== undefined ? options.in_service : true);
    
    grafka.getModel().setValue(vertex, g);
    grafka.insertVertex(vertex, null, options.name || 'VSC', 0.5, 1.5, 0, 0, null, true);
}

export function configureB2bVscAttributes(grafka, vertex, options = {}) {
    var g = mxUtils.createXmlDocument().createElement("object");
    g.setAttribute("name", options.name || "B2B VSC");
    
    // B2B VSC connects AC bus to DC bus - connections detected from diagram edges
    g.setAttribute("Load_flow_parameters", "");
    g.setAttribute("r_ohm", options.r_ohm || "0.01");         // Coupling transformer resistance
    g.setAttribute("x_ohm", options.x_ohm || "0.1");          // Coupling transformer reactance
    g.setAttribute("r_dc_ohm", options.r_dc_ohm || "0.01");   // Internal DC resistance
    g.setAttribute("control_mode_ac", options.control_mode_ac || "vm_pu");  // 'vm_pu' or 'q_mvar'
    g.setAttribute("control_value_ac", options.control_value_ac || "1.0");  // AC control setpoint
    g.setAttribute("control_mode_dc", options.control_mode_dc || "p_mw");   // 'vm_pu' or 'p_mw'
    g.setAttribute("control_value_dc", options.control_value_dc || "0.0");  // DC control setpoint
    g.setAttribute("in_service", options.in_service !== undefined ? options.in_service : true);
    
    grafka.getModel().setValue(vertex, g);
    grafka.insertVertex(vertex, null, options.name || 'B2B VSC', 0.5, 1.5, 0, 0, null, true);
}

// Make all configure functions globally available for app.min.js
if (typeof window !== 'undefined') {
    window.configureExternalGridAttributes = configureExternalGridAttributes;
    window.configureGeneratorAttributes = configureGeneratorAttributes;
    window.configureStaticGeneratorAttributes = configureStaticGeneratorAttributes;
    window.configureAsymmetricStaticGeneratorAttributes = configureAsymmetricStaticGeneratorAttributes;
    window.configureBusAttributes = configureBusAttributes;
    window.configureTransformerAttributes = configureTransformerAttributes;
    window.configureThreeWindingTransformerAttributes = configureThreeWindingTransformerAttributes;
    window.configureShuntReactorAttributes = configureShuntReactorAttributes;
    window.configureCapacitorAttributes = configureCapacitorAttributes;
    window.configureLoadAttributes = configureLoadAttributes;
    window.configureAsymmetricLoadAttributes = configureAsymmetricLoadAttributes;
    window.configureImpedanceAttributes = configureImpedanceAttributes;
    window.configureWardAttributes = configureWardAttributes;
    window.configureExtendedWardAttributes = configureExtendedWardAttributes;
    window.configureMotorAttributes = configureMotorAttributes;
    window.configureStorageAttributes = configureStorageAttributes;
    window.configureSVCAttributes = configureSVCAttributes;
    window.configureTCSCAttributes = configureTCSCAttributes;
    window.configureSSCAttributes = configureSSCAttributes;
    window.configureDCLineAttributes = configureDCLineAttributes;
    window.configureLineAttributes = configureLineAttributes;
    window.configureDcBusAttributes = configureDcBusAttributes;
    window.configureLoadDcAttributes = configureLoadDcAttributes;
    window.configureSourceDcAttributes = configureSourceDcAttributes;
    window.configureSwitchAttributes = configureSwitchAttributes;
    window.configureVscAttributes = configureVscAttributes;
    window.configureB2bVscAttributes = configureB2bVscAttributes;
}



