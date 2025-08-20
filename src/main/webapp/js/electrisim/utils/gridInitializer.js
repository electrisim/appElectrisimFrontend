// gridInitializer.js - Initializes all grid options and makes them globally available

// Import all grid options
import { gridOptionsAsymmetricLoad } from '../asymmetricLoadDialog.js';
import { gridOptionsAsymmetricStaticGenerator } from '../asymmetricStaticGeneratorDialog.js';
import { gridOptionsBus } from '../busDialog.js';
import { gridOptionsCapacitor } from '../capacitorDialog.js';
import { gridOptionsDCLine } from '../dcLineDialog.js';
import { gridOptionsExtendedWard } from '../extendedWardDialog.js';
import { gridOptionsGenerator } from '../generatorDialog.js';
import { gridOptionsImpedance } from '../impedanceDialog.js';
import { gridOptionsLineBaseDialog } from '../lineBaseDialog.js';
import { gridOptionsLineLibrary } from '../lineLibraryDialog.js';
import { gridOptionsLoad } from '../loadDialog.js';
import { gridOptionsMotor } from '../motorDialog.js';
import { gridOptionsShuntReactor } from '../shuntReactorDialog.js';
import { gridOptionsSSC } from '../SSCDialog.js';
import { gridOptionsStaticGenerator } from '../staticGeneratorDialog.js';
import { gridOptionsStorage } from '../storageDialog.js';
import { gridOptionsSVC } from '../SVCDialog.js';
import { gridOptionsTCSC } from '../TCSCDialog.js';
import { gridOptionsThreeWindingTransformerBase } from '../threeWindingTransformerBaseDialog.js';
import { gridOptionsThreeWindingTransformerLibrary } from '../threeWindingTransformerLibraryDialog.js';
import { gridOptionsTransformerBase } from '../transformerBaseDialog.js';
import { gridOptionsTransformerLibrary } from '../transformerLibraryDialog.js';
import { gridOptionsWard } from '../wardDialog.js';

// Function to initialize all grid options
export function initializeGridOptions() {
    // Make all grid options globally available
    window.gridOptionsAsymmetricLoad = gridOptionsAsymmetricLoad;
    window.gridOptionsAsymmetricStaticGenerator = gridOptionsAsymmetricStaticGenerator;
    window.gridOptionsBus = gridOptionsBus;
    window.gridOptionsCapacitor = gridOptionsCapacitor;
    window.gridOptionsDCLine = gridOptionsDCLine;
    window.gridOptionsExtendedWard = gridOptionsExtendedWard;
    window.gridOptionsGenerator = gridOptionsGenerator;
    window.gridOptionsImpedance = gridOptionsImpedance;
    window.gridOptionsLineBaseDialog = gridOptionsLineBaseDialog;
    window.gridOptionsLineDialog = gridOptionsLineLibrary;
    window.gridOptionsLoad = gridOptionsLoad;
    window.gridOptionsMotor = gridOptionsMotor;
    window.gridOptionsShuntReactor = gridOptionsShuntReactor;
    window.gridOptionsSSC = gridOptionsSSC;
    window.gridOptionsStaticGenerator = gridOptionsStaticGenerator;
    window.gridOptionsStorage = gridOptionsStorage;
    window.gridOptionsSVC = gridOptionsSVC;
    window.gridOptionsTCSC = gridOptionsTCSC;
    window.gridOptionsThreeWindingTransformerBase = gridOptionsThreeWindingTransformerBase;
    window.gridOptionsThreeWindingTransformerLibrary = gridOptionsThreeWindingTransformerLibrary;
    window.gridOptionsTransformerBase = gridOptionsTransformerBase;
    window.gridOptionsTransformerLibrary = gridOptionsTransformerLibrary;
    window.gridOptionsWard = gridOptionsWard;
}

// Initialize grid options when the module loads
initializeGridOptions(); 