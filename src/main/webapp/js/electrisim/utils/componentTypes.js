// Define component types as constants
export const COMPONENT_TYPES = {
    EXTERNAL_GRID: 'External Grid',
    GENERATOR: 'Generator',
    STATIC_GENERATOR: 'Static Generator',
    ASYMMETRIC_STATIC_GENERATOR: 'Asymmetric Static Generator',
    BUS: 'Bus',
    DC_BUS: 'DC Bus',
    TRANSFORMER: 'Transformer',
    THREE_WINDING_TRANSFORMER: 'Three Winding Transformer',
    SHUNT_REACTOR: 'Shunt Reactor',
    CAPACITOR: 'Capacitor',
    LOAD: 'Load',
    LOAD_DC: 'Load DC',
    SOURCE_DC: 'Source DC',
    ASYMMETRIC_LOAD: 'Asymmetric Load',
    IMPEDANCE: 'Impedance',
    WARD: 'Ward',
    EXTENDED_WARD: 'Extended Ward',
    MOTOR: 'Motor',
    STORAGE: 'Storage',
    SVC: 'SVC',
    TCSC: 'TCSC',
    SSC: 'SSC',
    SWITCH: 'Switch',
    VSC: 'VSC',
    B2B_VSC: 'B2B VSC',
    DC_LINE: 'DC Line',
    LINE: 'Line'
};

// Make it available globally for legacy code
window.COMPONENT_TYPES = COMPONENT_TYPES; 