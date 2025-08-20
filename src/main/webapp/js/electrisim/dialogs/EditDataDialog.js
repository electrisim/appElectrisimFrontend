// EditDataDialog.js - Dialog for editing cell data with AG-Grid support
import { DIALOG_STYLES } from '../utils/dialogStyles.js';
import { ExternalGridDialog } from '../externalGridDialog.js';
import { AsymmetricLoadDialog } from '../asymmetricLoadDialog.js';
import { AsymmetricStaticGeneratorDialog } from '../asymmetricStaticGeneratorDialog.js';
import { CapacitorDialog } from '../capacitorDialog.js';
import { DCLineDialog } from '../dcLineDialog.js';
import { ExtendedWardDialog } from '../extendedWardDialog.js';
import { GeneratorDialog } from '../generatorDialog.js';
import { ImpedanceDialog } from '../impedanceDialog.js';
import { LoadDialog } from '../loadDialog.js';
import { MotorDialog } from '../motorDialog.js';
import { ShuntReactorDialog } from '../shuntReactorDialog.js';
import { SSCDialog } from '../SSCDialog.js';
import { StaticGeneratorDialog } from '../staticGeneratorDialog.js';
import { StorageDialog } from '../storageDialog.js';
import { SVCDialog } from '../SVCDialog.js';
import { TCSCDialog } from '../TCSCDialog.js';
import { WardDialog } from '../wardDialog.js';
import { BusDialog } from '../busDialog.js';
import { TransformerDialog } from '../transformerBaseDialog.js';
import { ThreeWindingTransformerDialog } from '../threeWindingTransformerBaseDialog.js';
import { LineDialog } from '../lineBaseDialog.js';

export class EditDataDialog {
    constructor(ui, cell) {
        try {
            if (!ui || !cell) {
                throw new Error('EditDataDialog requires both UI and cell parameters');
            }

            // Check if there's already a dialog for this cell to prevent duplicates
            if (cell._editDataDialogInstance) {
                console.log('EditDataDialog already exists for this cell, returning existing instance');
                return cell._editDataDialogInstance;
            }
            
            // Check if there's already a dialog showing globally
            if (window._globalDialogShowing) {
                console.log('Global dialog already showing, ignoring this instance');
                // Create a minimal container to prevent crashes
                this.container = document.createElement('div');
                this.container.style.display = 'none';
                this.shouldShowDialog = false;
                return;
            }

            this.ui = ui;
            this.cell = cell;
            this.shouldShowDialog = true; // Flag to control whether dialog should be shown
            
            // Store this instance on the cell to prevent duplicates
            cell._editDataDialogInstance = this;
            
            // Parse the cell style to get element type
            const style = cell.getStyle() || '';
            const styleProps = this.parseStyle(style);
            this.elementType = styleProps.shapeELXXX;
            
            console.log('EditDataDialog - Element type:', this.elementType);
            
            // Create a minimal container first (this ensures container is always set)
            this.container = document.createElement('div');
            
            // Check for special cases first
            if (this.elementType === "NotEditableLine") {
                this.handleNotEditableLine();
                return;
            }
            
            if (this.elementType === "Result") {
                this.handleResultElement();
                return;
            }
            
            // Handle External Grid with new tabbed dialog
            if (this.elementType === "External Grid") {
                this.handleExternalGrid();
                return;
            }
            
            // Handle Asymmetric Load with new tabbed dialog
            if (this.elementType === "Asymmetric Load") {
                this.handleAsymmetricLoad();
                return;
            }
            
            // Handle Asymmetric Static Generator with new tabbed dialog
            if (this.elementType === "Asymmetric Static Generator") {
                this.handleAsymmetricStaticGenerator();
                return;
            }
            
            // Handle Capacitor with new tabbed dialog
            if (this.elementType === "Capacitor") {
                this.handleCapacitor();
                return;
            }
            
            // Handle DC Line with new tabbed dialog
            if (this.elementType === "DC Line") {
                this.handleDCLine();
                return;
            }
            
            // Handle Extended Ward with new tabbed dialog
            if (this.elementType === "Extended Ward") {
                this.handleExtendedWard();
                return;
            }
            
            // Handle Generator with new tabbed dialog
            if (this.elementType === "Generator") {
                this.handleGenerator();
                return;
            }
            
            // Handle Impedance with new tabbed dialog
            if (this.elementType === "Impedance") {
                this.handleImpedance();
                return;
            }
            
            // Handle Load with new tabbed dialog
            if (this.elementType === "Load") {
                this.handleLoad();
                return;
            }
            
            // Handle Motor with new tabbed dialog
            if (this.elementType === "Motor") {
                this.handleMotor();
                return;
            }
            
            // Handle Shunt Reactor with new tabbed dialog
            if (this.elementType === "Shunt Reactor") {
                this.handleShuntReactor();
                return;
            }
            
            // Handle SSC (STATCOM) with new tabbed dialog
            if (this.elementType === "SSC(STATCOM)") {
                this.handleSSC();
                return;
            }
            
            // Handle Static Generator with new tabbed dialog
            if (this.elementType === "Static Generator") {
                this.handleStaticGenerator();
                return;
            }
            
            // Handle Storage with new tabbed dialog
            if (this.elementType === "Storage") {
                this.handleStorage();
                return;
            }
            
            // Handle SVC with new tabbed dialog
            if (this.elementType === "SVC") {
                this.handleSVC();
                return;
            }
            
            // Handle TCSC with new tabbed dialog
            if (this.elementType === "TCSC") {
                this.handleTCSC();
                return;
            }
            
            // Handle Ward with new tabbed dialog
            if (this.elementType === "Ward") {
                this.handleWard();
                return;
            }
            
            // Handle Bus with new tabbed dialog
            if (this.elementType === "Bus") {
                this.handleBus();
                return;
            }
            
            // Handle Transformer with new tabbed dialog
            if (this.elementType === "Transformer") {
                this.handleTransformer();
                return;
            }
            
            // Handle Three Winding Transformer with new tabbed dialog
            if (this.elementType === "Three Winding Transformer") {
                this.handleThreeWindingTransformer();
                return;
            }
            
            // Handle Line with new tabbed dialog
            if (this.elementType === "Line") {
                this.handleLine();
                return;
            }
            
            // Create the main container for normal elements
            this.container = this.createContainer();
            
        } catch (error) {
            console.error('Error initializing EditDataDialog:', error);
            // Create a minimal container to prevent crashes
            this.container = document.createElement('div');
            this.container.textContent = 'Error loading dialog: ' + error.message;
        }
    }
    
    parseStyle(style) {
        const result = {};
        if (style) {
            const pairs = style.split(';');
            pairs.forEach(pair => {
                const [key, value] = pair.split('=');
                if (key && value) {
                    result[key.trim()] = value.trim();
                }
            });
        }
        return result;
    }
    
    handleNotEditableLine() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a message dialog showing to prevent duplicates
        if (window._notEditableMessageShowing || document.querySelector('.not-editable-message-dialog')) {
            return; // Don't show another dialog if one is already visible
        }
        // Set global guards immediately to avoid race conditions from double invocation
        window._notEditableMessageShowing = true;
        window._globalDialogShowing = true;
        
        // Use the styled message dialog
        this.showStyledMessageDialog(
            'Cannot Edit Element',
            'This element cannot be edited. To model a line or cable, place it between two buses.',
            '#FF9800', // Orange color for warning
            '⚠️' // Warning icon
        );
    }
    
    handleResultElement() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a message dialog showing to prevent duplicates
        if (window._resultMessageShowing || document.querySelector('.not-editable-message-dialog')) {
            return;
        }
        // Set global guards immediately to avoid race conditions
        window._resultMessageShowing = true;
        window._globalDialogShowing = true;

        // Use the styled message dialog
        this.showStyledMessageDialog(
            'Information',
            'This element is a result label. It cannot be edited',
            '#2196F3', // Blue color for info
            '📊' // Icon
        );
    }
    
    handleExternalGrid() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('External Grid dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new External Grid Dialog
            const externalGridDialog = new ExternalGridDialog(this.ui);
            
            // Set cleanup callback to ensure proper cleanup regardless of how dialog is closed
            this.setDialogCleanup(externalGridDialog);
            
            // Populate the dialog with current cell data
            this.populateExternalGridDialog(externalGridDialog);
            
            // Show the dialog
            externalGridDialog.show((values) => {
                console.log('External Grid dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyExternalGridValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing External Grid dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening External Grid dialog: ' + error.message);
        }
    }
    
    handleAsymmetricLoad() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Asymmetric Load dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Asymmetric Load Dialog
            const asymmetricLoadDialog = new AsymmetricLoadDialog(this.ui);
            
            // Set cleanup callback to ensure proper cleanup regardless of how dialog is closed
            this.setDialogCleanup(asymmetricLoadDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            asymmetricLoadDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            asymmetricLoadDialog.show((values) => {
                console.log('Asymmetric Load dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyAsymmetricLoadValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing Asymmetric Load dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Asymmetric Load dialog: ' + error.message);
        }
    }
    
    // Handle Asymmetric Static Generator
    handleAsymmetricStaticGenerator() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Asymmetric Static Generator dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Asymmetric Static Generator Dialog
            const asymmetricStaticGeneratorDialog = new AsymmetricStaticGeneratorDialog(this.ui);
            this.setDialogCleanup(asymmetricStaticGeneratorDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            asymmetricStaticGeneratorDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            asymmetricStaticGeneratorDialog.show((values) => {
                console.log('Asymmetric Static Generator dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyAsymmetricStaticGeneratorValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing Asymmetric Static Generator dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Asymmetric Static Generator dialog: ' + error.message);
        }
    }
    
    // Handle Capacitor
    handleCapacitor() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Capacitor dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Capacitor Dialog
            const capacitorDialog = new CapacitorDialog(this.ui);
            this.setDialogCleanup(capacitorDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            capacitorDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            capacitorDialog.show((values) => {
                console.log('Capacitor dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyCapacitorValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing Capacitor dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Capacitor dialog: ' + error.message);
        }
    }
    
    // Handle DC Line
    handleDCLine() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('DC Line dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new DC Line Dialog
            const dcLineDialog = new DCLineDialog(this.ui);
            this.setDialogCleanup(dcLineDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            dcLineDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            dcLineDialog.show((values) => {
                console.log('DC Line dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyDCLineValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing DC Line dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening DC Line dialog: ' + error.message);
        }
    }
    
    // Handle Extended Ward
    handleExtendedWard() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Extended Ward dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Extended Ward Dialog
            const extendedWardDialog = new ExtendedWardDialog(this.ui);
            this.setDialogCleanup(extendedWardDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            extendedWardDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            extendedWardDialog.show((values) => {
                console.log('Extended Ward dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyExtendedWardValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing Extended Ward dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Extended Ward dialog: ' + error.message);
        }
    }
    
    // Handle Generator
    handleGenerator() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Generator dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Generator Dialog
            const generatorDialog = new GeneratorDialog(this.ui);
            
            // Set cleanup callback to ensure proper cleanup regardless of how dialog is closed
            this.setDialogCleanup(generatorDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            generatorDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            generatorDialog.show((values) => {
                console.log('Generator dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyGeneratorValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing Generator dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Generator dialog: ' + error.message);
        }
    }
    
    // Handle Impedance
    handleImpedance() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Impedance dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Impedance Dialog
            const impedanceDialog = new ImpedanceDialog(this.ui);
            this.setDialogCleanup(impedanceDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            impedanceDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            impedanceDialog.show((values) => {
                console.log('Impedance dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyImpedanceValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing Impedance dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Impedance dialog: ' + error.message);
        }
    }
    
    // Handle Load
    handleLoad() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Load dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Load Dialog
            const loadDialog = new LoadDialog(this.ui);
            this.setDialogCleanup(loadDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            loadDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            loadDialog.show((values) => {
                console.log('Load dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyLoadValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing Load dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Load dialog: ' + error.message);
        }
    }
    
    // Handle Motor
    handleMotor() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Motor dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Motor Dialog
            const motorDialog = new MotorDialog(this.ui);
            this.setDialogCleanup(motorDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            motorDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            motorDialog.show((values) => {
                console.log('Motor dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyMotorValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing Motor dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Motor dialog: ' + error.message);
        }
    }
    
    // Handle Shunt Reactor
    handleShuntReactor() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Shunt Reactor dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Shunt Reactor Dialog
            const shuntReactorDialog = new ShuntReactorDialog(this.ui);
            this.setDialogCleanup(shuntReactorDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            shuntReactorDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            shuntReactorDialog.show((values) => {
                console.log('Shunt Reactor dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyShuntReactorValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
            // Populate the dialog with current cell data AFTER it's shown
            setTimeout(() => {
                shuntReactorDialog.populateDialog(this.cell.value);
            }, 100);
            
        } catch (error) {
            console.error('Error showing Shunt Reactor dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Shunt Reactor dialog: ' + error.message);
        }
    }
    
    // Handle SSC (STATCOM)
    handleSSC() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('SSC dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new SSC Dialog
            const sscDialog = new SSCDialog(this.ui);
            this.setDialogCleanup(sscDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            sscDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            sscDialog.show((values) => {
                console.log('SSC dialog values received:', values);
                
                // Apply the values back to the cell
                this.applySSCValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
            // Populate the dialog with current cell data AFTER it's shown
            setTimeout(() => {
                sscDialog.populateDialog(this.cell.value);
            }, 100);
            
        } catch (error) {
            console.error('Error showing SSC dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening SSC dialog: ' + error.message);
        }
    }
    
    // Handle Static Generator
    handleStaticGenerator() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Static Generator dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Static Generator Dialog
            const staticGeneratorDialog = new StaticGeneratorDialog(this.ui);
            this.setDialogCleanup(staticGeneratorDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            staticGeneratorDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            staticGeneratorDialog.show((values) => {
                console.log('Static Generator dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyStaticGeneratorValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
            // Populate the dialog with current cell data AFTER it's shown
            setTimeout(() => {
                staticGeneratorDialog.populateDialog(this.cell.value);
            }, 100);
            
        } catch (error) {
            console.error('Error showing Static Generator dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Static Generator dialog: ' + error.message);
        }
    }
    
    // Handle Storage
    handleStorage() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Storage dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Storage Dialog
            const storageDialog = new StorageDialog(this.ui);
            this.setDialogCleanup(storageDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            storageDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            storageDialog.show((values) => {
                console.log('Storage dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyStorageValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
            // Populate the dialog with current cell data AFTER it's shown
            setTimeout(() => {
                storageDialog.populateDialog(this.cell.value);
            }, 100);
            
        } catch (error) {
            console.error('Error showing Storage dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Storage dialog: ' + error.message);
        }
    }
    
    // Handle SVC
    handleSVC() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('SVC dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new SVC Dialog
            const svcDialog = new SVCDialog(this.ui);
            this.setDialogCleanup(svcDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            svcDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            svcDialog.show((values) => {
                console.log('SVC dialog values received:', values);
                
                // Apply the values back to the cell
                this.applySVCValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
            // Populate the dialog with current cell data AFTER it's shown
            setTimeout(() => {
                svcDialog.populateDialog(this.cell.value);
            }, 100);
            
        } catch (error) {
            console.error('Error showing SVC dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening SVC dialog: ' + error.message);
        }
    }
    
    // Handle TCSC
    handleTCSC() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('TCSC dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new TCSC Dialog
            const tcscDialog = new TCSCDialog(this.ui);
            this.setDialogCleanup(tcscDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            tcscDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            tcscDialog.show((values) => {
                console.log('TCSC dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyTCSCValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
            // Populate the dialog with current cell data AFTER it's shown
            setTimeout(() => {
                tcscDialog.populateDialog(this.cell.value);
            }, 100);
            
        } catch (error) {
            console.error('Error showing TCSC dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening TCSC dialog: ' + error.message);
        }
    }
    
    // Handle Ward
    handleWard() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Ward dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Ward Dialog
            const wardDialog = new WardDialog(this.ui);
            this.setDialogCleanup(wardDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            wardDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            wardDialog.show((values) => {
                console.log('Ward dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyWardValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
            // Populate the dialog with current cell data AFTER it's shown
            setTimeout(() => {
                wardDialog.populateDialog(this.cell.value);
            }, 100);
            
        } catch (error) {
            console.error('Error showing Ward dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Ward dialog: ' + error.message);
        }
    }
    
    // Handle Bus
    handleBus() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Bus dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Bus Dialog
            const busDialog = new BusDialog(this.ui);
            this.setDialogCleanup(busDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            busDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            busDialog.show((values) => {
                console.log('Bus dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyBusValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
            // Populate the dialog with current cell data AFTER it's shown
            setTimeout(() => {
                busDialog.populateDialog(this.cell.value);
            }, 100);
            
        } catch (error) {
            console.error('Error showing Bus dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Bus dialog: ' + error.message);
        }
    }
    
    // Handle Transformer
    handleTransformer() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Transformer dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Transformer Dialog
            const transformerDialog = new TransformerDialog(this.ui);
            this.setDialogCleanup(transformerDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            transformerDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            transformerDialog.show((values) => {
                console.log('Transformer dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyTransformerValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing Transformer dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Transformer dialog: ' + error.message);
        }
    }
    
    // Handle Three Winding Transformer
    handleThreeWindingTransformer() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Three Winding Transformer dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Three Winding Transformer Dialog
            const threeWindingTransformerDialog = new ThreeWindingTransformerDialog(this.ui);
            this.setDialogCleanup(threeWindingTransformerDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            threeWindingTransformerDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            threeWindingTransformerDialog.show((values) => {
                console.log('Three Winding Transformer dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyThreeWindingTransformerValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing Three Winding Transformer dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Three Winding Transformer dialog: ' + error.message);
        }
    }
    
    // Handle Line
    handleLine() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Check if there's already a dialog showing to prevent duplicates
        if (window._globalDialogShowing || document.querySelector('.modal-overlay')) {
            console.log('Line dialog: Another dialog is already showing, ignoring request');
            return;
        }
        
        // Set global guards to prevent duplicate dialogs
        window._globalDialogShowing = true;
        
        // Set cell dialog flag
        if (this.cell) {
            this.cell._dialogShowing = true;
        }
        
        try {
            // Create the new Line Dialog
            const lineDialog = new LineDialog(this.ui);
            this.setDialogCleanup(lineDialog);
            
            // Populate the dialog with current cell data BEFORE showing it
            lineDialog.populateDialog(this.cell.value);
            
            // Show the dialog
            lineDialog.show((values) => {
                console.log('Line dialog values received:', values);
                
                // Apply the values back to the cell
                this.applyLineValues(values);
                
                // Clean up
                this.cleanup();
                
                // Clear global dialog flag (this is also done in dialog.destroy() but adding here for safety)
                if (window._globalDialogShowing) {
                    delete window._globalDialogShowing;
                }
                
                // Clear cell dialog flag
                if (this.cell && this.cell._dialogShowing) {
                    delete this.cell._dialogShowing;
                }
            });
            
        } catch (error) {
            console.error('Error showing Line dialog:', error);
            
            // Clean up on error
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
            
            // Show error message
            alert('Error opening Line dialog: ' + error.message);
        }
    }
    
    populateAsymmetricLoadDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values
                const powerParam = dialog.powerParameters.find(p => p.id === attributeName);
                if (powerParam) {
                    if (powerParam.type === 'checkbox') {
                        powerParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        powerParam.value = attributeValue.toString();
                    }
                }
                
                const reactiveParam = dialog.reactivePowerParameters.find(p => p.id === attributeName);
                if (reactiveParam) {
                    reactiveParam.value = attributeValue.toString();
                }
                
                const configParam = dialog.configParameters.find(p => p.id === attributeName);
                if (configParam) {
                    if (configParam.type === 'checkbox') {
                        configParam.value = attributeValue === 'true' || attributeValue === true;
                    } else if (configParam.type === 'select') {
                        configParam.value = attributeValue;
                    } else {
                        configParam.value = attributeValue.toString();
                    }
                }
            }
        }
    }
    
    applyAsymmetricLoadValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Asymmetric Load values applied to cell');
    }
    
    populateExternalGridDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values
                const loadFlowParam = dialog.loadFlowParameters.find(p => p.id === attributeName);
                if (loadFlowParam) {
                    loadFlowParam.value = attributeValue;
                }
                
                const shortCircuitParam = dialog.shortCircuitParameters.find(p => p.id === attributeName);
                if (shortCircuitParam) {
                    shortCircuitParam.value = attributeValue.toString();
                }
                
                const opfParam = dialog.opfParameters.find(p => p.id === attributeName);
                if (opfParam) {
                    if (opfParam.type === 'checkbox') {
                        opfParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        opfParam.value = attributeValue.toString();
                    }
                }
            }
        }
    }
    
    applyExternalGridValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('External Grid values applied to cell');
    }
    
    // Populate methods for modern dialogs
    populateAsymmetricStaticGeneratorDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                // This is a generic implementation - adjust based on actual dialog structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateCapacitorDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateDCLineDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateExtendedWardDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateGeneratorDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateImpedanceDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateLoadDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateMotorDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateShuntReactorDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateSSCDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateStaticGeneratorDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateStorageDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateSVCDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateTCSCDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateWardDialog(dialog) {
        // Get current values from the cell and populate the method
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateBusDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateTransformerDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    populateThreeWindingTransformerDialog(dialog) {
        // Get current values from the cell and populate the dialog
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else {
                        input.value = attributeValue;
                    }
                }
            }
        }
    }
    
    // Apply methods for modern dialogs
    applyAsymmetricStaticGeneratorValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Asymmetric Static Generator values applied to cell');
    }
    
    applyCapacitorValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Capacitor values applied to cell');
    }
    
    applyDCLineValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('DC Line values applied to cell');
    }
    
    applyExtendedWardValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Extended Ward values applied to cell');
    }
    
    applyGeneratorValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Generator values applied to cell');
    }
    
    applyImpedanceValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Impedance values applied to cell');
    }
    
    applyLoadValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Load values applied to cell');
    }
    
    applyMotorValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Motor values applied to cell');
    }
    
    applyShuntReactorValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Shunt Reactor values applied to cell');
    }
    
    applySSCValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('SSC values applied to cell');
    }
    
    applyStaticGeneratorValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Static Generator values applied to cell');
    }
    
    applyStorageValues(values) {
        // Apply the values from the cell back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Storage values applied to cell');
    }
    
    applySVCValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('SVC values applied to cell');
    }
    
    applyTCSCValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('TCSC values applied to cell');
    }
    
    applyWardValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            // Create the value object if it doesn't exist
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        // Update cell attributes with the new values
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Ward values applied to cell');
    }
    
    applyBusValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Bus values applied to cell');
    }
    
    applyTransformerValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Transformer values applied to cell');
    }
    
    applyThreeWindingTransformerValues(values) {
        // Apply the values from the dialog back to the cell
        if (!this.cell.value) {
            this.cell.value = mxUtils.createXmlDocument().createElement('object');
        }
        
        for (const [attributeName, attributeValue] of Object.entries(values)) {
            this.cell.value.setAttribute(attributeName, attributeValue);
        }
        
        console.log('Three Winding Transformer values applied to cell');
    }
    
    createContainer() {
        // Check if we should show the main dialog (modern dialogs set this to false)
        if (this.shouldShowDialog === false) {
            // Create a minimal hidden container to prevent errors
            const div = document.createElement('div');
            div.style.display = 'none';
            div.style.visibility = 'hidden';
            div.style.position = 'absolute';
            div.style.left = '-9999px';
            return div;
        }
        
        // Create main container with proper sizing like the original
        const div = document.createElement('div');
        // Mark as electrisim dialog to bypass duplicate guard in showDialog
        try { div.classList.add('electrisim-dialog'); } catch(e) {}
        div.style.height = '100%';
        div.style.width = '100%';
        div.style.padding = '0px';  // Remove any padding
        div.style.margin = '0px';   // Remove any margin
        div.style.overflow = 'hidden'; // Prevent any overflow space
        div.style.display = 'flex';    // Use flexbox for precise control
        div.style.flexDirection = 'column'; // Vertical layout
        div.setAttribute('class', 'ag-theme-alpine');
        
        // Create the grid container with ultra-compact sizing
        const gridDiv = document.createElement('div');
        gridDiv.style.height = '75px';  // Reverted back to 75px
        gridDiv.style.width = '100%';
        gridDiv.style.maxHeight = '75px';  // Enforce maximum height
        gridDiv.style.minHeight = '75px';  // Enforce minimum height
        gridDiv.style.overflow = 'hidden'; // Prevent any overflow
        gridDiv.style.flex = '0 0 75px';   // Flex: don't grow, don't shrink, fixed 75px
        gridDiv.style.position = 'relative';
        gridDiv.setAttribute('class', 'ag-theme-alpine');
        
        // Get grid configuration based on element type
        const { gridOptions, rowDefs } = this.getGridConfiguration();
        
        // Early return if no grid configuration (modern dialogs)
        if (!gridOptions || !rowDefs) {
            return div;
        }
        
        if (gridOptions && rowDefs) {
            // Initialize AG-Grid
            try {
                // Ensure grid has proper configuration for headers
                if (gridOptions.columnDefs) {
                    gridOptions.columnDefs.forEach(col => {
                        // Calculate better width based on actual header text length to prevent truncation
                        const headerText = col.headerName || col.field || 'Column';
                        const headerLength = headerText.length;
                        
                        // Extremely generous width calculation to guarantee no truncation with full-width dialog
                        const minWidthBasedOnHeader = Math.max(160, headerLength * 15 + 80);
                        
                        if (!col.minWidth) col.minWidth = minWidthBasedOnHeader;
                        if (!col.width) col.width = Math.max(180, minWidthBasedOnHeader);
                        
                        // Ensure text wrapping and overflow handling
                        if (!col.cellStyle) {
                            col.cellStyle = {
                                'white-space': 'normal',
                                'word-wrap': 'break-word',
                                'text-overflow': 'ellipsis'
                            };
                        }
                    });
                }
                
                // Ensure headers are enabled with compact height
                gridOptions.headerHeight = 30;  // Reverted back to 30px
                gridOptions.rowHeight = 26;     // Reverted back to 26px
                gridOptions.suppressHorizontalScroll = false;
                gridOptions.suppressVerticalScroll = true;  // Prevent vertical scrolling in compact mode
                gridOptions.suppressScrollOnNewData = true;
                gridOptions.suppressAnimationFrame = true;
                
                // Pre-calculate container width for optimal column sizing
                const containerWidth = Math.max(1200, window.innerWidth - 60); // Estimate container width
                
                // Pre-calculate optimal column widths to prevent visual jumping
                const calculateOptimalColumnWidths = (columnDefs, containerWidth, elementType) => {
                    if (!columnDefs || columnDefs.length === 0) return columnDefs;
                    
                    const numColumns = columnDefs.length;
                    const availableWidth = containerWidth - 50; // Account for margins and scrollbar
                    
                    // Calculate base target width
                    const baseTargetWidth = Math.floor(availableWidth / numColumns);
                    
                    // Use reasonable minimum widths
                    let minWidth = 140; // Good default for most columns
                    if (numColumns > 6) minWidth = 130;
                    if (numColumns > 8) minWidth = 120;
                    if (numColumns > 10) minWidth = 110;
                    if (numColumns > 12) minWidth = 100;
                    if (numColumns > 15) minWidth = 90;
                    if (numColumns > 18) minWidth = 80;
                    
                    const finalWidth = Math.max(minWidth, baseTargetWidth);
                    
                    // Apply calculated width to all columns with element-specific handling
                    return columnDefs.map(col => {
                        let columnWidth = finalWidth;
                        
                     
                        
                        // Special handling for index columns (all elements)
                        if (col.field === 'index' || col.headerName === 'Index') {
                            columnWidth = Math.min(70, finalWidth); // Index columns can be narrow
                        }
                        
                        // Special handling for ID columns (all elements)
                        if (col.field === 'id' || col.headerName === 'ID' || 
                            col.field === 'ID' || col.headerName === 'id') {
                            columnWidth = Math.min(80, finalWidth); // ID columns can be narrow
                        }
                        
                        return {
                            ...col,
                            width: columnWidth,
                            suppressSizeToFit: false
                        };
                    });
                };

                // Apply optimal column widths before grid creation
                if (gridOptions.columnDefs) {
                    gridOptions.columnDefs = calculateOptimalColumnWidths(gridOptions.columnDefs, containerWidth, this.elementType);
                }
                
                gridOptions.animateRows = false;
                gridOptions.enableRangeSelection = true;
                gridOptions.enableFillHandle = true;
                gridOptions.enableRangeHandle = true;
                gridOptions.undoRedoCellEditing = true;
                gridOptions.undoRedoCellEditingLimit = 20;
                gridOptions.rowHeight = 24;
                gridOptions.headerHeight = 28;
                gridOptions.suppressAnimationFrame = true;
                
                // Use onGridReady for final adjustments instead of setTimeout
                const originalOnGridReady = gridOptions.onGridReady;
                gridOptions.onGridReady = (params) => {
                    // Call original onGridReady if it exists
                    if (originalOnGridReady) {
                        originalOnGridReady(params);
                    }
                    
                    // Fine-tune column sizing after grid is ready (no visible jump)
                    try {
                        if (params && params.columnApi && params.api && gridDiv) {
                            const actualContainerWidth = gridDiv.clientWidth - 30;
                            const columns = params.columnApi.getAllColumns();
                            
                            if (columns && columns.length > 0) {
                                const totalUsedWidth = columns.length * (gridOptions.columnDefs[0]?.width || 150);
                                
                                // Only adjust if there's significant space left or overflow
                                if (Math.abs(totalUsedWidth - actualContainerWidth) > 50) {
                                    params.api.sizeColumnsToFit();
                                }
                            }
                        }
                    } catch (error) {
                        console.warn('Error in final column adjustment:', error);
                    }
                };
                
                // Check if AG Grid is available
                if (!window.agGrid) {
                    throw new Error('AG Grid library not loaded. Please ensure ag-grid-community.min.js is loaded before this module.');
                }
                
                // Check if gridOptions is valid
                if (!gridOptions || !gridOptions.columnDefs) {
                    throw new Error('Grid configuration is invalid or missing. Please check the grid options.');
                }
                
                const grid = new window.agGrid.Grid(gridDiv, gridOptions);
                
                // Populate grid with cell data
                this.populateGridData(gridOptions, rowDefs);
                
                div.appendChild(gridDiv);
            } catch (error) {
                console.error('Error creating AG-Grid:', error);
                div.textContent = 'Error creating grid: ' + error.message;
            }
        } else {
            div.textContent = `Choose some component in the model first. Unsupported element type: ${this.elementType}`;
        }
        
        // Add buttons at the bottom with ultra-compact layout
        const buttonContainer = this.createButtonContainer(gridOptions || {});
        buttonContainer.style.position = 'relative';
        buttonContainer.style.bottom = '0px';
        buttonContainer.style.marginTop = '2px';  // Minimal margin
        buttonContainer.style.marginBottom = '0px';
        buttonContainer.style.paddingTop = '0px';
        buttonContainer.style.paddingBottom = '0px';
        buttonContainer.style.height = '28px';    // Reverted back to 28px
        buttonContainer.style.flex = '0 0 28px';  // Fixed 28px height
        div.appendChild(buttonContainer);
        
        return div;
    }
    
    getGridConfiguration() {
        // Check if we should show the main dialog (modern dialogs set this to false)
        if (this.shouldShowDialog === false) {
            return { gridOptions: null, rowDefs: null };
        }
        
        // Get grid configuration based on element type
        const configs = {
            'External Grid': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/ext_grid.html'
            }),
            'Generator': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/gen.html'
            }),
            'Static Generator': () => ({ 
                gridOptions: window.gridOptionsStaticGenerator, 
                rowDefs: window.rowDefsStaticGenerator,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/sgen.html'
            }),
            'Asymmetric Static Generator': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/asymmetric_sgen.html'
            }),
            'Bus': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/bus.html'
            }),
            'Shunt Reactor': () => ({ 
                gridOptions: window.gridOptionsShuntReactor, 
                rowDefs: window.rowDefsShuntReactor,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/shunt.html'
            }),
            'Capacitor': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/shunt.html'
            }),
            'Load': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/load.html'
            }),
            'Asymmetric Load': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/asymmetric_load.html'
            }),
            'Impedance': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/impedance.html'
            }),
            'Ward': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/ward.html'
            }),
            'Extended Ward': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/xward.html'
            }),
            'Motor': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/motor.html'
            }),
            'Storage': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/storage.html'
            }),
            'DC Line': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/dcline.html'
            }),
            'Transformer': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/trafo.html',
                hasLibrary: true
            }),
            'Three Winding Transformer': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/trafo3w.html',
                hasLibrary: true
            }),
            'Line': () => ({ 
                gridOptions: window.gridOptionsLineBaseDialog, 
                rowDefs: window.rowDefsDataLineBaseDialog,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/line.html',
                hasLibrary: true
            }),
            'SVC': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/svc.html',
                hasLibrary: true
            }),
            'TCSC': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/tcsc.html',
                hasLibrary: true
            }),
            'SSC': () => ({ 
                gridOptions: null, // Modern dialog handles this
                rowDefs: null,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/ssc.html',
                hasLibrary: true
            })
        };
        
        const config = configs[this.elementType];
        if (config) {
            const result = config();
            this.helpUrl = result.helpUrl;
            this.hasLibrary = result.hasLibrary;
            return result;
        }
        
        return { gridOptions: null, rowDefs: null };
    }
    
    populateGridData(gridOptions, rowDefs) {
        if (!gridOptions || !gridOptions.api || !rowDefs || !rowDefs[0]) {
            console.warn('Grid options, API, or row definitions not available');
            return;
        }
        
        const rowNode = gridOptions.api.getRowNode('0');
        if (!rowNode) {
            console.warn('Row node not found');
            return;
        }
        
        // Iterate over the attributes of the cell and populate the grid
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                if (rowDefs[0].hasOwnProperty(attributeName)) {
                    try {
                        this.safeSetDataValue(rowNode, attributeName, attributeValue, gridOptions);
                    } catch (error) {
                        console.warn(`Error setting data value for ${attributeName}:`, error);
                    }
                }
            }
        }
    }
    
    safeSetDataValue(rowNode, attributeName, attributeValue, gridOptions) {
        if (!rowNode || !attributeName) {
            console.warn('rowNode or attributeName is null/undefined');
            return false;
        }
        
        try {
            // Check if the column exists in the grid
            const columnApi = gridOptions.columnApi || (gridOptions.api && gridOptions.api.getColumnApi());
            if (columnApi && columnApi.getColumn && !columnApi.getColumn(attributeName)) {
                console.warn(`Column '${attributeName}' not found in grid definition`);
                return false;
            }
            
            rowNode.setDataValue(attributeName, attributeValue);
            return true;
        } catch (error) {
            console.warn(`Error setting data value for ${attributeName}:`, error);
            return false;
        }
    }
    
    createButtonContainer(gridOptions) {
        // Ensure gridOptions is defined
        if (!gridOptions) {
            gridOptions = {};
        }
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '4px';  // Reverted back to 4px
        buttonContainer.style.marginBottom = '0px';  // No bottom margin
        buttonContainer.style.paddingTop = '0px';   // No padding
        buttonContainer.style.paddingBottom = '0px'; // No bottom padding
        buttonContainer.style.textAlign = 'center';
        buttonContainer.style.whiteSpace = 'nowrap';
        buttonContainer.style.height = '28px'; // Reverted back to 28px
        buttonContainer.style.display = 'flex';
        buttonContainer.style.alignItems = 'center';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.gap = '6px';  // Reverted back to 6px
        buttonContainer.style.overflow = 'hidden'; // Prevent any overflow
        
        // Cancel button
        const cancelBtn = this.createButton('Cancel', () => {
            this.cleanup();
            this.ui.hideDialog();
        });
        buttonContainer.appendChild(cancelBtn);
        
        // Library button (for certain element types)
        if (this.hasLibrary) {
            const libraryBtn = this.createButton('Library', () => {
                this.ui.hideDialog();
                this.showLibraryDialog();
            });
            libraryBtn.style.background = 'orange';
            libraryBtn.style.verticalAlign = 'middle';
            buttonContainer.appendChild(libraryBtn);
        }
        
        // Help button
        if (this.helpUrl) {
            const helpBtn = this.createButton('Help', () => {
                this.ui.openLink(this.helpUrl);
            });
            helpBtn.style.verticalAlign = 'middle';
            buttonContainer.appendChild(helpBtn);
        }
        
        // Apply button
        const applyBtn = this.createButton('Apply', () => {
            this.applyChanges(gridOptions);
            this.cleanup();
            this.ui.hideDialog();
        });
        applyBtn.className = 'geBtn gePrimaryBtn';
        applyBtn.style.verticalAlign = 'middle';
        buttonContainer.appendChild(applyBtn);
        
        return buttonContainer;
    }
    
    createButton(text, onClick) {
        const button = mxUtils.button(text, onClick);
        button.className = 'geBtn';
        button.style.margin = '0 4px';  // Reverted back to 4px
        button.style.height = '26px';  // Reverted back to 26px
        button.style.minWidth = '70px';  // Reverted back to 70px
        button.style.fontSize = '12px';  // Reverted back to 12px
        return button;
    }
    
    showLibraryDialog() {
        // Delegate to specific library dialogs based on element type
        if (this.elementType === 'Transformer') {
            this.ui.showTransformerDialog('', 'Apply', this.cell);
        } else if (this.elementType === 'Three Winding Transformer') {
            this.ui.showThreeWindingTransformerDialog('', 'Apply', this.cell);
        } else if (this.elementType === 'Line') {
            this.ui.showLineDialog('', 'Apply', this.cell);
        }
    }
    
    applyChanges(gridOptions) {
        try {
            if (!gridOptions || !gridOptions.api) {
                console.warn('Grid options or API not available for applying changes');
                return;
            }
            
            const rowNode = gridOptions.api.getRowNode('0');
            if (!rowNode || !rowNode.data) {
                console.warn('Row node or data not available for applying changes');
                return;
            }
            
            // Iterate over the attributes of rownode and copy to cell
            for (const attributeName in rowNode.data) {
                if (rowNode.data.hasOwnProperty(attributeName)) {
                    const attributeValue = rowNode.data[attributeName];
                    // Set the attribute value in the cell
                    this.cell.value.setAttribute(attributeName, attributeValue);
                }
            }
            
            console.log('Changes applied successfully');
        } catch (error) {
            console.error('Error applying changes:', error);
        }
    }
    
    init() {
        // The container is already set up in the constructor
        // This method is kept for compatibility
    }
    
    // Helper method to set cleanup callback on modern dialogs
    setDialogCleanup(dialog) {
        dialog.cleanupCallback = () => {
            this.cleanup();
            if (window._globalDialogShowing) {
                delete window._globalDialogShowing;
            }
            if (this.cell && this.cell._dialogShowing) {
                delete this.cell._dialogShowing;
            }
        };
    }

    cleanup() {
        // Clean up instance references
        if (this.cell && this.cell._editDataDialogInstance) {
            delete this.cell._editDataDialogInstance;
        }
        if (window._globalDialogShowing) {
            delete window._globalDialogShowing;
        }
    }

    showStyledMessageDialog(title, message, accentColor, icon) {
        // Check if there's already a message dialog showing
        if (document.querySelector('.not-editable-message-dialog')) {
            console.log('Message dialog already showing, ignoring duplicate');
            return;
        }
        
        // Create overlay for modal effect
        const overlay = document.createElement('div');
        overlay.className = 'not-editable-message-dialog';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Create the main dialog container
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 480px;
            width: 90%;
            overflow: hidden;
            animation: slideIn 0.3s ease-out;
        `;

        // Create header with icon and title
        const header = document.createElement('div');
        header.style.cssText = `
            background: ${accentColor};
            color: white;
            padding: 20px 24px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 18px;
            font-weight: 600;
        `;

        const iconSpan = document.createElement('span');
        iconSpan.textContent = icon;
        iconSpan.style.fontSize = '24px';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = title;

        header.appendChild(iconSpan);
        header.appendChild(titleSpan);

        // Create content area
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 24px;
            font-size: 15px;
            line-height: 1.5;
            color: #333;
        `;
        content.textContent = message;

        // Create button area
        const buttonArea = document.createElement('div');
        buttonArea.style.cssText = `
            padding: 16px 24px 24px;
            text-align: right;
        `;

        // Create OK button
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.style.cssText = `
            background: ${accentColor};
            color: white;
            border: none;
            border-radius: 6px;
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 80px;
        `;

        // Add hover effect
        okButton.onmouseenter = () => {
            okButton.style.transform = 'translateY(-1px)';
            okButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        };
        okButton.onmouseleave = () => {
            okButton.style.transform = 'translateY(0)';
            okButton.style.boxShadow = 'none';
        };

        // Close dialog on button click
        okButton.onclick = () => {
            overlay.style.animation = 'fadeOut 0.2s ease-in';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                // Remove the class to allow future dialogs
                overlay.className = '';
                // Clean up the instance reference
                if (this.cell && this.cell._editDataDialogInstance) {
                    delete this.cell._editDataDialogInstance;
                }
                // Clear global guards
                if (window._notEditableMessageShowing) delete window._notEditableMessageShowing;
                if (window._resultMessageShowing) delete window._resultMessageShowing;
                if (window._globalDialogShowing) delete window._globalDialogShowing;
            }, 200);
        };

        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                okButton.click();
            }
        };

        // Close on ESC key
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                okButton.click();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        // Also close on overlay click with proper cleanup
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                okButton.click();
            }
        };
        
        // Store cleanup function for external access
        this.cleanup = () => {
            if (this.cell && this.cell._editDataDialogInstance) {
                delete this.cell._editDataDialogInstance;
            }
        };
    }
    
    populateLineDialog(dialog) {
        // First, populate all inputs with their default values
        if (dialog.inputs) {
            dialog.inputs.forEach((input, key) => {
                // Get the default value from the dialog's data
                let defaultValue = '';
                if (dialog.data && dialog.data[key] !== undefined) {
                    defaultValue = dialog.data[key];
                }
                
                // Set the default value
                if (input.type === 'checkbox') {
                    input.checked = Boolean(defaultValue);
                } else if (input.tagName === 'SELECT') {
                    input.value = defaultValue;
                } else {
                    input.value = defaultValue.toString();
                }
            });
        }
        
        // Then, override with any existing cell attributes
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else if (input.tagName === 'SELECT') {
                        input.value = attributeValue;
                    } else {
                        input.value = attributeValue.toString();
                    }
                }
            }
        }
        
        console.log('Populated Line dialog with cell data');
    }
    
    applyLineValues(values) {
        console.log('=== applyLineValues called ===');
        console.log('Values to apply:', values);
        
        // Apply the values back to the cell
        if (this.cell.value) {
            console.log('Cell value exists, proceeding with attribute update');
            
            // Store the original cell value for comparison
            const originalCellValue = this.cell.value.cloneNode(true);
            console.log('Original cell value before modification:', originalCellValue);
            
            // Clear existing attributes by removing them individually
            if (this.cell.value.attributes) {
                console.log(`Clearing ${this.cell.value.attributes.length} existing attributes`);
                
                // Get a copy of attribute names to avoid modifying while iterating
                const attributeNames = [];
                for (let i = 0; i < this.cell.value.attributes.length; i++) {
                    attributeNames.push(this.cell.value.attributes[i].name);
                }
                
                // Remove each attribute
                attributeNames.forEach(name => {
                    console.log(`  Removing attribute: ${name}`);
                    this.cell.value.removeAttribute(name);
                });
            }
            
            // Add new attributes from values
            console.log('Adding new attributes:');
            Object.keys(values).forEach(key => {
                const value = values[key];
                console.log(`  Setting ${key} = ${value} (${typeof value})`);
                this.cell.value.setAttribute(key, value);
            });
            
            // Verify attributes were set
            console.log('Verification - final cell attributes:');
            if (this.cell.value.attributes) {
                for (let i = 0; i < this.cell.value.attributes.length; i++) {
                    const attr = this.cell.value.attributes[i];
                    console.log(`  ${attr.name}: ${attr.value}`);
                }
            }
            
            // Update the cell display in the graph model
            if (this.graph) {
                // Use beginUpdate/endUpdate to ensure atomic operation
                this.graph.model.beginUpdate();
                try {
                    this.graph.model.setValue(this.cell, this.cell.value);
                    console.log('Updated cell display via graph.model.setValue');
                    
                    // Force a refresh of the cell
                    this.graph.refresh(this.cell);
                    console.log('Forced cell refresh');
                    
                    // Verify the cell value is still correct after update
                    const updatedCellValue = this.graph.model.getValue(this.cell);
                    console.log('Cell value after graph update:', updatedCellValue);
                    
                    if (updatedCellValue && updatedCellValue.attributes) {
                        console.log('Verification - cell attributes after graph update:');
                        for (let i = 0; i < updatedCellValue.attributes.length; i++) {
                            const attr = updatedCellValue.attributes[i];
                            console.log(`  ${attr.name}: ${attr.value}`);
                        }
                    }
                    
                    // Add a temporary listener to detect if the cell value changes after our update
                    const cellChangeListener = (sender, evt) => {
                        const changes = evt.getProperty('edit').changes;
                        for (let i = 0; i < changes.length; i++) {
                            const change = changes[i];
                            if (change.cell === this.cell && change.value !== this.cell.value) {
                                console.log('🚨 WARNING: Cell value was changed by another process!');
                                console.log('  Original value we set:', this.cell.value);
                                console.log('  New value after change:', change.value);
                                console.log('  Change type:', change.constructor.name);
                            }
                        }
                    };
                    
                    // Add the listener temporarily
                    this.graph.model.addListener(mxEvent.CHANGE, cellChangeListener);
                    
                    // Remove the listener after a short delay
                    setTimeout(() => {
                        this.graph.model.removeListener(mxEvent.CHANGE, cellChangeListener);
                        console.log('Removed temporary cell change listener');
                    }, 1000);
                    
                } finally {
                    this.graph.model.endUpdate();
                    console.log('Graph model update completed');
                }
            } else {
                console.log('WARNING: No graph available for cell display update');
            }
            
            console.log('=== applyLineValues completed ===');
        } else {
            console.log('ERROR: Cell value is null/undefined');
        }
    }
    
    populateTransformerDialog(dialog) {
        // First, populate all inputs with their default values
        if (dialog.inputs) {
            dialog.inputs.forEach((input, key) => {
                // Get the default value from the dialog's data
                let defaultValue = '';
                if (dialog.data && dialog.data[key] !== undefined) {
                    defaultValue = dialog.data[key];
                }
                
                // Set the default value
                if (input.type === 'checkbox') {
                    input.checked = Boolean(defaultValue);
                } else if (input.tagName === 'SELECT') {
                    input.value = defaultValue;
                } else {
                    input.value = defaultValue.toString();
                }
            });
        }
        
        // Then, override with any existing cell attributes
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else if (input.tagName === 'SELECT') {
                        input.value = attributeValue;
                    } else {
                        input.value = attributeValue.toString();
                    }
                }
            }
        }
        
        console.log('Populated Transformer dialog with cell data');
    }
    
    applyTransformerValues(values) {
        // Apply the values back to the cell
        if (this.cell.value) {
            // Clear existing attributes by removing them individually
            if (this.cell.value.attributes) {
                // Get a copy of attribute names to avoid modifying while iterating
                const attributeNames = [];
                for (let i = 0; i < this.cell.value.attributes.length; i++) {
                    attributeNames.push(this.cell.value.attributes[i].name);
                }
                
                // Remove each attribute
                attributeNames.forEach(name => {
                    this.cell.value.removeAttribute(name);
                });
            }
            
            // Add new attributes from values
            Object.keys(values).forEach(key => {
                const value = values[key];
                this.cell.value.setAttribute(key, value);
            });
            
            // Update the cell display
            if (this.graph) {
                this.graph.model.setValue(this.cell, this.cell.value);
            }
            
            console.log('Applied Transformer values to cell:', values);
        }
    }
    
    populateThreeWindingTransformerDialog(dialog) {
        // First, populate all inputs with their default values
        if (dialog.inputs) {
            dialog.inputs.forEach((input, key) => {
                // Get the default value from the dialog's data
                let defaultValue = '';
                if (dialog.data && dialog.data[key] !== undefined) {
                    defaultValue = dialog.data[key];
                }
                
                // Set the default value
                if (input.type === 'checkbox') {
                    input.checked = Boolean(defaultValue);
                } else if (input.tagName === 'SELECT') {
                    input.value = defaultValue;
                } else {
                    input.value = defaultValue.toString();
                }
            });
        }
        
        // Then, override with any existing cell attributes
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values based on parameter structure
                if (dialog.inputs && dialog.inputs.has(attributeName)) {
                    const input = dialog.inputs.get(attributeName);
                    
                    if (input.type === 'checkbox') {
                        input.checked = attributeValue === 'true' || attributeValue === true;
                    } else if (input.tagName === 'SELECT') {
                        input.value = attributeValue;
                    } else {
                        input.value = attributeValue.toString();
                    }
                }
            }
        }
        
        console.log('Populated Three Winding Transformer dialog with cell data');
    }
    
    applyThreeWindingTransformerValues(values) {
        // Apply the values back to the cell
        if (this.cell.value) {
            // Clear existing attributes by removing them individually
            if (this.cell.value.attributes) {
                // Get a copy of attribute names to avoid modifying while iterating
                const attributeNames = [];
                for (let i = 0; i < this.cell.value.attributes.length; i++) {
                    attributeNames.push(this.cell.value.attributes[i].name);
                }
                
                // Remove each attribute
                attributeNames.forEach(name => {
                    this.cell.value.removeAttribute(name);
                });
            }
            
            // Add new attributes from values
            Object.keys(values).forEach(key => {
                const value = values[key];
                this.cell.value.setAttribute(key, value);
            });
            
            // Update the cell display
            if (this.graph) {
                this.graph.model.setValue(this.cell, this.cell.value);
            }
            
            console.log('Applied Three Winding Transformer values to cell:', values);
        }

        // Assemble the dialog
        buttonArea.appendChild(okButton);
        dialog.appendChild(header);
        dialog.appendChild(content);
        dialog.appendChild(buttonArea);
        overlay.appendChild(dialog);

        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        // Add to document
        document.body.appendChild(overlay);

        // Focus the OK button for keyboard accessibility
        setTimeout(() => okButton.focus(), 100);
    }
}

// Set default help link
EditDataDialog.placeholderHelpLink = 'https://pandapower.readthedocs.io/en/latest/elements.html';

// Make EditDataDialog available globally for legacy compatibility
if (typeof window !== 'undefined') {
    window.EditDataDialog = EditDataDialog;
}