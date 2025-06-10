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
        }
    }

    return result;
};

// Make it available globally for legacy code
window.getAttributesAsObject = getAttributesAsObject; 