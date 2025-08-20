// Script to bundle all Electrisim scripts into one file
const fs = require('fs');
const path = require('path');

const electrisimScripts = [
    'js/electrisim/utils/cellUtils.js',
    'js/electrisim/dialogs/dialogInitializer.js',
    'js/electrisim/dialogs/EditDataDialog.js',
    'js/electrisim/dialogs/LoadFlowDialog.js',
    'js/electrisim/dialogs/ShortCircuitDialog.js',
    'js/electrisim/lineBaseDialog.js',
    'js/electrisim/LibraryDialogManager.js',
    'js/electrisim/lineLibraryDialog.js',
    'js/electrisim/externalGridDialog.js',
    'js/electrisim/generatorDialog.js',
    'js/electrisim/staticGeneratorDialog.js',
    'js/electrisim/asymmetricStaticGeneratorDialog.js',
    'js/electrisim/busDialog.js',
    'js/electrisim/transformerBaseDialog.js',
    'js/electrisim/transformerLibraryDialog.js',
    'js/electrisim/threeWindingTransformerBaseDialog.js',
    'js/electrisim/threeWindingTransformerLibraryDialog.js',
    'js/electrisim/shuntReactorDialog.js',
    'js/electrisim/capacitorDialog.js',
    'js/electrisim/loadDialog.js',
    'js/electrisim/asymmetricLoadDialog.js',
    'js/electrisim/shortCircuit.js',
    'js/electrisim/impedanceDialog.js',
    'js/electrisim/wardDialog.js',
    'js/electrisim/extendedWardDialog.js',
    'js/electrisim/motorDialog.js',
    'js/electrisim/storageDialog.js',
    'js/electrisim/SSCDialog.js',
    'js/electrisim/SVCDialog.js',
    'js/electrisim/TCSCDialog.js',
    'js/electrisim/dcLineDialog.js',
    'js/electrisim/configureAttributes.js',
    'js/electrisim/supportingFunctions.js',
    'js/electrisim/loadFlow.js'
];

let bundleContent = '// Electrisim Bundle - Generated automatically\n';
bundleContent += '// This file contains all Electrisim scripts bundled together for better performance\n\n';

electrisimScripts.forEach(scriptPath => {
    try {
        const fullPath = path.join(__dirname, scriptPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        bundleContent += `\n// === ${scriptPath} ===\n`;
        bundleContent += content;
        bundleContent += '\n';
        console.log(`✅ Added ${scriptPath}`);
    } catch (error) {
        console.error(`❌ Failed to read ${scriptPath}:`, error.message);
    }
});

// Write bundle file
const bundlePath = path.join(__dirname, 'js/electrisim/electrisim-bundle.js');
fs.writeFileSync(bundlePath, bundleContent);
console.log(`\n🎉 Bundle created: ${bundlePath}`);
console.log(`📦 Bundle size: ${(bundleContent.length / 1024).toFixed(2)} KB`); 