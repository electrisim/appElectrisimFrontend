// Helper function to get attributes as object
export const getAttributesAsObject = (cell, attributeMap) => {
    const result = {};
    console.log('cell in getAttributes', cell);

    // Make sure cell has all the required properties
    if (!cell || !cell.value || !cell.value.attributes) {
        console.warn('Cell is missing required properties');
        return result;
    }

    // Get all available attributes
    const attributes = cell.value.attributes;

    // Process each requested attribute by name instead of index
    for (const [key, config] of Object.entries(attributeMap)) {
        const isOptional = typeof config === 'object' && config.optional;
        const attributeName = typeof config === 'object' ? config.name : config;

        console.log(`Looking for attribute ${key} with name ${attributeName}, optional: ${isOptional}`);

        // Find the attribute by name in the attributes collection
        let found = false;
        for (let i = 0; i < attributes.length; i++) {
            if (attributes[i].nodeName === attributeName) {
                result[key] = attributes[i].nodeValue;
                found = true;
                break;
            }
        }

        if (!found && !isOptional) {
            console.warn(`Missing required attribute ${key} with name ${attributeName}`);
            result[key] = null;
        } else if (!found && isOptional) {
            // For optional parameters, include them with default values if not found
            if (key === 'parallel') {
                console.log(`⚠ ${key} not found, using default value: 1`);
                result[key] = '1';  // Default parallel lines/transformers
            } else if (key === 'df') {
                console.log(`⚠ ${key} not found, using default value: 1.0`);
                result[key] = '1.0';  // Default derating factor
            } else if (key === 'vector_group') {
                console.log(`⚠ ${key} not found, using default value: Dyn11`);
                result[key] = 'Dyn11';  // Default vector group
            } else if (key === 'vk0_percent') {
                console.log(`⚠ ${key} not found, using default value: 0.0`);
                result[key] = '0.0';  // Will be set to vk_percent in backend if needed
            } else if (key === 'vkr0_percent') {
                console.log(`⚠ ${key} not found, using default value: 0.0`);
                result[key] = '0.0';  // Will be set to vkr_percent in backend if needed
            } else if (key === 'mag0_percent') {
                console.log(`⚠ ${key} not found, using default value: 0.0`);
                result[key] = '0.0';  // Default zero sequence magnetizing current
            } else if (key === 'si0_hv_partial') {
                console.log(`⚠ ${key} not found, using default value: 0.0`);
                result[key] = '0.0';  // Default zero sequence partial current
            }
            // Note: Other optional parameters can be left undefined as they truly are optional
        }
    }

    return result;
};

// Make it available globally for legacy code
window.getAttributesAsObject = getAttributesAsObject; 