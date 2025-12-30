//-----CREATION OF RESULT PLACEHOLDERS for ALL ELEMENTS, INCLUDING BUS AND LINE-----


//Hook into edge insertion to create placeholder result boxes for components
//connected to buses (External Grid, Generator, Load, Motor, SSC, etc.)

// Preserve original implementation (only once)
var originalGraphAddEdge = mxGraph.prototype.addEdge;

// Helper to extract custom Electrisim shape
function getShapeElxxx(style) {
    if (!style) return null;
    var match = style.match(/shapeELXXX=([^;]+)/);
    return match ? match[1] : null;
}

// Helper to detect Bus style
function isBusStyle(style) {
    if (!style) return false;
    return style.includes('shapeELXXX=Bus') ||
        style.includes('shape=mxgraph.electrical.transmission.busbar');
}

// Create a result placeholder for Bus element when it is dropped onto the graph
// This placeholder will be updated with load flow results (vm_pu, va_degree, p_mw, q_mvar, etc.)
function createBusResultPlaceholder(graph, busCell) {
    if (!graph || !busCell) {
        console.warn('ELXXX: Cannot create Bus result placeholder - missing graph or busCell');
        return;
    }
    // Check if placeholder already exists
    var existingId = null;
    if (busCell.value && busCell.value.attributes) {
        var placeholderAttr = busCell.value.attributes.getNamedItem('placeholderId');
        if (placeholderAttr) {
            existingId = placeholderAttr.nodeValue;
        }
    }
    
    if (existingId) {
        console.log('ELXXX: Bus already has a result placeholder:', existingId);
        return;
    }

    var baseStyle = [
        'shape=rounded',
        'rounded=1',
        'arcSize=6',
        'fillColor=#F8F9FA',
        'strokeColor=#6C757D',
        'strokeWidth=1.5',
        'dashed=1',
        'dashPattern=5 5',
        'opacity=70',
        'whiteSpace=wrap',
        'html=1',
        'align=center',
        'verticalAlign=middle',
        'fontSize=6',
        'fontColor=#6C757D',
        'fontStyle=0',
        'connectedTo=' + busCell.id
    ].join(';');

    var placeholderStyle = 'shapeELXXX=ResultBus;' + baseStyle;

    var boxWidth = 60;
    var boxHeight = 50;

    graph.model.beginUpdate();
    try {
        // Create placeholder as a child of the Bus cell with relative positioning
        // Positioned at left edge (x=0) to align with the "Bus" label
        var placeholder = graph.insertVertex(
            busCell,           // parent is the Bus cell
            null,              // id (auto-generated)
            'Click Simulate to generate results.',
            0,                 // x position (relative, left-aligned with Bus label)
            1.0,               // y position (relative, below the bus - closer than before)
            boxWidth,
            boxHeight,
            placeholderStyle,
            true               // relative positioning
        );

        if (placeholder) {
            var geo = graph.model.getGeometry(placeholder);
            if (geo) {
                geo.relative = true;
                geo.x = 0;     // Left-aligned with Bus label
                geo.y = 1.0;   // Closer to the Bus line
                if (typeof mxPoint !== 'undefined') {
                    geo.offset = new mxPoint(0, 0);  // No horizontal offset, left-aligned
                }
                graph.model.setGeometry(placeholder, geo);
            }

            // Get the placeholder ID
            var placeholderId = placeholder.id;
            if (!placeholderId && placeholder.mxObjectId) {
                placeholderId = placeholder.mxObjectId.replace('#', '');
            }

            if (placeholderId) {
                // Add placeholderId to the style for traceability
                graph.model.setStyle(
                    placeholder,
                    placeholderStyle + ';placeholderId=' + placeholderId
                );

                // Store reference on the Bus cell so loadFlow.js can find it
                if (busCell.value && typeof busCell.value.setAttribute === 'function') {
                    busCell.value.setAttribute('placeholderId', placeholderId);
                    graph.model.setValue(busCell, busCell.value);
                } else {
                    busCell.placeholderId = placeholderId;
                }

                console.log('ELXXX: Created Bus result placeholder with ID:', placeholderId);
            }
        }
    } catch (err) {
        console.error('ELXXX: Error creating Bus result placeholder:', err);
    } finally {
        graph.model.endUpdate();
    }
}

// Make the function globally available for app.min.js
if (typeof window !== 'undefined') {
    window.createBusResultPlaceholder = createBusResultPlaceholder;
}

//=============================================================================
// CLONING SUPPORT - Update placeholders when cells are cloned/duplicated
// Supports: Bus, Line, and all component result placeholders
// Compatible with: loadFlow.js, loadflowOpenDss.js, shortCircuit.js
//=============================================================================

/**
 * Helper to detect if a child cell is a result placeholder.
 * Handles all styles used by different analysis types:
 * - ResultBus: Created by resultBoxes.js for initial Bus placeholders
 * - Result: Used by loadFlow.js, loadflowOpenDss.js, and shortCircuit.js
 * - ResultExternalGrid: Used for External Grid components
 */
function isResultPlaceholderStyle(style) {
    if (!style) return false;
    return style.includes('shapeELXXX=ResultBus') ||
           style.includes('shapeELXXX=Result') ||
           style.includes('shapeELXXX=ResultExternalGrid');
}

/**
 * Helper to detect if a cell is a Line element
 */
function isLineStyle(style) {
    if (!style) return false;
    return style.includes('shapeELXXX=Line');
}

/**
 * Updates the result placeholder for a cloned Bus cell.
 * When a Bus is cloned, its placeholder child is also cloned but with wrong IDs.
 * This function updates the cloned placeholder to properly reference the new bus.
 * 
 * Handles both ResultBus (initial placeholders) and Result (OpenDSS/ShortCircuit) styles.
 */
function updateClonedBusPlaceholder(graph, clonedBusCell) {
    if (!graph || !clonedBusCell) return;

    var busStyle = clonedBusCell.style || '';
    if (!isBusStyle(busStyle)) return;

    graph.model.beginUpdate();
    try {
        // Find all result placeholder children (ResultBus, Result, etc.)
        var childCount = graph.model.getChildCount(clonedBusCell);
        var placeholderChildren = [];
        
        for (var i = 0; i < childCount; i++) {
            var child = graph.model.getChildAt(clonedBusCell, i);
            var childStyle = child.style || '';
            if (isResultPlaceholderStyle(childStyle)) {
                placeholderChildren.push(child);
            }
        }

        if (placeholderChildren.length > 0) {
            // Update all placeholder children
            for (var j = 0; j < placeholderChildren.length; j++) {
                var placeholderChild = placeholderChildren[j];
                
                // Get the new placeholder ID
                var newPlaceholderId = placeholderChild.id;
                if (!newPlaceholderId && placeholderChild.mxObjectId) {
                    newPlaceholderId = placeholderChild.mxObjectId.replace('#', '');
                }

                // Update the placeholder style with new connectedTo and placeholderId
                var oldStyle = placeholderChild.style || '';
                var newStyle = oldStyle
                    .replace(/connectedTo=[^;]+/, 'connectedTo=' + clonedBusCell.id)
                    .replace(/placeholderId=[^;]+/, 'placeholderId=' + newPlaceholderId);
                
                // If connectedTo wasn't in the style, add it
                if (!newStyle.includes('connectedTo=')) {
                    newStyle += ';connectedTo=' + clonedBusCell.id;
                }
                // If placeholderId wasn't in the style, add it
                if (!newStyle.includes('placeholderId=')) {
                    newStyle += ';placeholderId=' + newPlaceholderId;
                }
                
                graph.model.setStyle(placeholderChild, newStyle);

                // Reset placeholder content to default message
                graph.model.setValue(placeholderChild, 'Click Simulate to generate results.');

                console.log('ELXXX: Updated cloned Bus result placeholder - Bus ID:', clonedBusCell.id, 'Placeholder ID:', newPlaceholderId, 'Style type:', oldStyle.includes('ResultBus') ? 'ResultBus' : 'Result');
            }
            
            // Update the Bus cell's placeholderId attribute to point to the first placeholder
            // (This is the primary one that loadFlow.js will use)
            var primaryPlaceholderId = placeholderChildren[0].id;
            if (!primaryPlaceholderId && placeholderChildren[0].mxObjectId) {
                primaryPlaceholderId = placeholderChildren[0].mxObjectId.replace('#', '');
            }
            
            if (clonedBusCell.value && typeof clonedBusCell.value.setAttribute === 'function') {
                clonedBusCell.value.setAttribute('placeholderId', primaryPlaceholderId);
                graph.model.setValue(clonedBusCell, clonedBusCell.value);
            } else {
                clonedBusCell.placeholderId = primaryPlaceholderId;
            }
        } else {
            // No placeholder child found - create a new one
            console.log('ELXXX: No placeholder found for cloned Bus, creating new one');
            // Clear any old placeholderId attribute first
            if (clonedBusCell.value && typeof clonedBusCell.value.setAttribute === 'function') {
                clonedBusCell.value.removeAttribute('placeholderId');
                graph.model.setValue(clonedBusCell, clonedBusCell.value);
            } else {
                delete clonedBusCell.placeholderId;
            }
            createBusResultPlaceholder(graph, clonedBusCell);
        }
    } catch (err) {
        console.error('ELXXX: Error updating cloned Bus placeholder:', err);
    } finally {
        graph.model.endUpdate();
    }
}

/**
 * Updates the result placeholder for a cloned Line cell.
 * When a Line is cloned, its placeholder child is also cloned but with wrong IDs.
 * This function updates the cloned placeholder to properly reference the new line.
 */
function updateClonedLinePlaceholder(graph, clonedLineCell) {
    if (!graph || !clonedLineCell) return;

    var lineStyle = clonedLineCell.style || '';
    if (!isLineStyle(lineStyle)) return;

    graph.model.beginUpdate();
    try {
        // Find all result placeholder children
        var childCount = graph.model.getChildCount(clonedLineCell);
        var placeholderChildren = [];
        
        for (var i = 0; i < childCount; i++) {
            var child = graph.model.getChildAt(clonedLineCell, i);
            var childStyle = child.style || '';
            if (isResultPlaceholderStyle(childStyle)) {
                placeholderChildren.push(child);
            }
        }

        if (placeholderChildren.length > 0) {
            // Update all placeholder children
            for (var j = 0; j < placeholderChildren.length; j++) {
                var placeholderChild = placeholderChildren[j];
                
                // Get the new placeholder ID
                var newPlaceholderId = placeholderChild.id;
                if (!newPlaceholderId && placeholderChild.mxObjectId) {
                    newPlaceholderId = placeholderChild.mxObjectId.replace('#', '');
                }

                // Update the placeholder style with new connectedTo and placeholderId
                var oldStyle = placeholderChild.style || '';
                var newStyle = oldStyle
                    .replace(/connectedTo=[^;]+/, 'connectedTo=' + clonedLineCell.id)
                    .replace(/placeholderId=[^;]+/, 'placeholderId=' + newPlaceholderId);
                
                // If connectedTo wasn't in the style, add it
                if (!newStyle.includes('connectedTo=')) {
                    newStyle += ';connectedTo=' + clonedLineCell.id;
                }
                // If placeholderId wasn't in the style, add it
                if (!newStyle.includes('placeholderId=')) {
                    newStyle += ';placeholderId=' + newPlaceholderId;
                }
                
                graph.model.setStyle(placeholderChild, newStyle);

                // Reset placeholder content to default message
                graph.model.setValue(placeholderChild, 'Click Simulate to generate results.');

                console.log('ELXXX: Updated cloned Line result placeholder - Line ID:', clonedLineCell.id, 'Placeholder ID:', newPlaceholderId);
            }
            
            // Update the Line cell's placeholderId attribute
            var primaryPlaceholderId = placeholderChildren[0].id;
            if (!primaryPlaceholderId && placeholderChildren[0].mxObjectId) {
                primaryPlaceholderId = placeholderChildren[0].mxObjectId.replace('#', '');
            }
            
            if (clonedLineCell.value && typeof clonedLineCell.value.setAttribute === 'function') {
                clonedLineCell.value.setAttribute('placeholderId', primaryPlaceholderId);
                graph.model.setValue(clonedLineCell, clonedLineCell.value);
            } else {
                clonedLineCell.placeholderId = primaryPlaceholderId;
            }
        } else {
            // No placeholder child found - clear any stale placeholderId
            console.log('ELXXX: No placeholder found for cloned Line, clearing stale ID');
            if (clonedLineCell.value && typeof clonedLineCell.value.setAttribute === 'function') {
                clonedLineCell.value.removeAttribute('placeholderId');
                graph.model.setValue(clonedLineCell, clonedLineCell.value);
            } else {
                delete clonedLineCell.placeholderId;
            }
        }
    } catch (err) {
        console.error('ELXXX: Error updating cloned Line placeholder:', err);
    } finally {
        graph.model.endUpdate();
    }
}

/**
 * Updates the result placeholder for a cloned component cell (connected via edge).
 * Handles ALL components connected to buses via edges, including:
 * - External Grid, Generator, Static Generator, Asymmetric Static Generator
 * - Load, Asymmetric Load, Motor, Storage
 * - Transformer, Three Winding Transformer
 * - Shunt Reactor, Capacitor
 * - Impedance, Ward, Extended Ward
 * - SVC, TCSC, SSC, DC Line
 * 
 * Note: Each edge of a component gets its own placeholder. Components with multiple edges
 * (e.g., Transformers with HV and LV edges) will have multiple placeholders updated.
 */
function updateClonedComponentPlaceholder(graph, clonedCell) {
    if (!graph || !clonedCell) return;

    var cellStyle = clonedCell.style || '';
    // Skip if it's a Bus or Line (handled separately) or has no Electrisim shape
    if (isBusStyle(cellStyle) || isLineStyle(cellStyle)) return;
    if (!cellStyle.includes('shapeELXXX=')) return;
    
    // Check if cell has edges (components are connected to buses via edges)
    if (!clonedCell.edges || clonedCell.edges.length === 0) return;

    graph.model.beginUpdate();
    try {
        var firstPlaceholderId = null;
        
        // Find result placeholders in the connected edges
        for (var e = 0; e < clonedCell.edges.length; e++) {
            var edge = clonedCell.edges[e];
            if (!edge) continue;
            
            var childCount = graph.model.getChildCount(edge);
            for (var i = 0; i < childCount; i++) {
                var child = graph.model.getChildAt(edge, i);
                if (!child) continue;
                // Use model API for consistency
                var childStyle = graph.model.getStyle(child) || '';
                
                // Check if this is a result placeholder
                if (isResultPlaceholderStyle(childStyle)) {
                    // Get the new placeholder ID
                    var newPlaceholderId = child.id;
                    if (!newPlaceholderId && child.mxObjectId) {
                        newPlaceholderId = child.mxObjectId.replace('#', '');
                    }

                    // Update the placeholder style with new connectedTo and placeholderId
                    var oldStyle = childStyle;
                    var newStyle = oldStyle
                        .replace(/connectedTo=[^;]+/, 'connectedTo=' + clonedCell.id)
                        .replace(/placeholderId=[^;]+/, 'placeholderId=' + newPlaceholderId);
                    
                    // If connectedTo wasn't in the style, add it
                    if (!newStyle.includes('connectedTo=')) {
                        newStyle += ';connectedTo=' + clonedCell.id;
                    }
                    // If placeholderId wasn't in the style, add it
                    if (!newStyle.includes('placeholderId=')) {
                        newStyle += ';placeholderId=' + newPlaceholderId;
                    }
                    
                    graph.model.setStyle(child, newStyle);

                    // Reset placeholder content to default message
                    graph.model.setValue(child, 'Click Simulate to generate results.');

                    // Store the first placeholder ID for the component cell (for backward compatibility)
                    // Note: Components can have multiple edges, each with its own placeholder
                    if (!firstPlaceholderId) {
                        firstPlaceholderId = newPlaceholderId;
                    }

                    console.log('ELXXX: Updated cloned component placeholder - Cell ID:', clonedCell.id, 'Edge:', edge.id, 'Placeholder ID:', newPlaceholderId);
                }
            }
        }
        
        // Update the component cell's placeholderId attribute with the first placeholder found
        // (for backward compatibility, though each edge has its own placeholder)
        if (firstPlaceholderId) {
            if (clonedCell.value && typeof clonedCell.value.setAttribute === 'function') {
                clonedCell.value.setAttribute('placeholderId', firstPlaceholderId);
                graph.model.setValue(clonedCell, clonedCell.value);
            } else {
                clonedCell.placeholderId = firstPlaceholderId;
            }
        } else {
            // No placeholder found on existing edges - clear any stale placeholderId
            // A new placeholder will be created when a new edge is drawn
            if (clonedCell.value && typeof clonedCell.value.setAttribute === 'function') {
                clonedCell.value.removeAttribute('placeholderId');
                graph.model.setValue(clonedCell, clonedCell.value);
            } else {
                delete clonedCell.placeholderId;
            }
        }
    } catch (err) {
        console.error('ELXXX: Error updating cloned component placeholder:', err);
    } finally {
        graph.model.endUpdate();
    }
}

/**
 * Process an array of cells and update placeholders for all element types.
 * Handles: Bus, Line, and all component cells with result placeholders.
 */
function processClonedCellsForPlaceholders(graph, cells) {
    if (!graph || !cells || cells.length === 0) return;

    for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        if (!cell) continue;
        
        var style = cell.style || '';
        
        if (isBusStyle(style)) {
            updateClonedBusPlaceholder(graph, cell);
        } else if (isLineStyle(style)) {
            updateClonedLinePlaceholder(graph, cell);
        } else if (style.includes('shapeELXXX=')) {
            // Other components (External Grid, Generator, Load, etc.)
            updateClonedComponentPlaceholder(graph, cell);
        }
    }
}

// Keep the old function name for backward compatibility
function processClonedCellsForBusPlaceholders(graph, cells) {
    processClonedCellsForPlaceholders(graph, cells);
}

// Make these functions globally available
if (typeof window !== 'undefined') {
    window.isResultPlaceholderStyle = isResultPlaceholderStyle;
    window.isLineStyle = isLineStyle;
    window.updateClonedBusPlaceholder = updateClonedBusPlaceholder;
    window.updateClonedLinePlaceholder = updateClonedLinePlaceholder;
    window.updateClonedComponentPlaceholder = updateClonedComponentPlaceholder;
    window.processClonedCellsForPlaceholders = processClonedCellsForPlaceholders;
    window.processClonedCellsForBusPlaceholders = processClonedCellsForBusPlaceholders; // backward compatibility
}

//=============================================================================
// OVERRIDE duplicateCells to handle placeholder updates for cloned cells
// Supports: Bus, Line, and all component result placeholders
//=============================================================================

// Store original duplicateCells (wait for Graph to be defined)
var _originalDuplicateCells = null;

function initDuplicateCellsOverride() {
    if (typeof Graph !== 'undefined' && Graph.prototype.duplicateCells && !_originalDuplicateCells) {
        _originalDuplicateCells = Graph.prototype.duplicateCells;
        
        Graph.prototype.duplicateCells = function(cells, append) {
            var result = _originalDuplicateCells.apply(this, arguments);
            
            // Process cloned cells for all placeholder types (Bus, Line, Components)
            if (result && result.length > 0) {
                try {
                    processClonedCellsForPlaceholders(this, result);
                } catch (err) {
                    console.error('ELXXX: Error processing cloned cells for placeholders:', err);
                }
            }
            
            return result;
        };
        
        console.log('ELXXX: duplicateCells override installed for placeholder support (Bus, Line, Components)');
    }
}

//=============================================================================
// OVERRIDE mxClipboard.paste to handle placeholder updates for pasted cells
// Supports: Bus, Line, and all component result placeholders
//=============================================================================

var _originalClipboardPaste = null;

function initClipboardPasteOverride() {
    if (typeof mxClipboard !== 'undefined' && mxClipboard.paste && !_originalClipboardPaste) {
        _originalClipboardPaste = mxClipboard.paste;
        
        mxClipboard.paste = function(graph) {
            var result = _originalClipboardPaste.apply(this, arguments);
            
            // Process pasted cells for all placeholder types (Bus, Line, Components)
            if (result && result.length > 0 && graph) {
                try {
                    processClonedCellsForPlaceholders(graph, result);
                } catch (err) {
                    console.error('ELXXX: Error processing pasted cells for placeholders:', err);
                }
            }
            
            return result;
        };
        
        console.log('ELXXX: mxClipboard.paste override installed for placeholder support (Bus, Line, Components)');
    }
}

// Initialize overrides when the page loads
if (typeof window !== 'undefined') {
    // Try to initialize immediately
    initDuplicateCellsOverride();
    initClipboardPasteOverride();
    
    // Also try after a delay (in case Graph/mxClipboard aren't defined yet)
    setTimeout(function() {
        initDuplicateCellsOverride();
        initClipboardPasteOverride();
    }, 1000);
    
    // Also try on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initDuplicateCellsOverride();
            initClipboardPasteOverride();
        });
    }
}

// Helper to create a professional placeholder box
function createResultPlaceholder(graph, parentEdge, componentCell, opts) {
    var externalId = componentCell.id;

    var baseStyle = [
        'shape=rounded',
        'rounded=1',
        'arcSize=6',
        'fillColor=#F8F9FA',
        'strokeColor=#6C757D',
        'strokeWidth=1.5',
        'dashed=1',
        'dashPattern=5 5',
        'opacity=70',
        'whiteSpace=wrap',
        'html=1',
        'align=center',
        'verticalAlign=middle',
        'fontSize=6',
        'fontColor=#6C757D',
        'fontStyle=0',
        'connectedTo=' + externalId
    ].join(';');

    // Allow overriding the logical Electrisim result shape (for External Grid)
    var logicalShape = opts && opts.logicalShape
        ? 'shapeELXXX=' + opts.logicalShape
        : 'shapeELXXX=Result';

    var placeholderStyle = logicalShape + ';' + baseStyle;

    var boxWidth = (opts && opts.width) || 60;
    var boxHeight = (opts && opts.height) || 40;
    var positionX = (opts && typeof opts.positionX === 'number') ? opts.positionX : -0.3;
    // For all positions, ensure consistent relative positioning
    var positionY = 0;
    // Offset to position box above the line - adjusted for better centering
    // positionX of 0.2 gives the middle of the line for Line/NotEditableLine elements
    var isLineMiddle = (positionX === 0.2 || positionX === 0.5);
    var offsetY = isLineMiddle ? -boxHeight / 2 - 10 : -boxHeight / 2 - 5;

    graph.model.beginUpdate();
    try {
        var placeholder = graph.insertVertex(
            parentEdge,
            null,
            'Click Simulate to generate results.',
            positionX,
            positionY,
            boxWidth,
            boxHeight,
            placeholderStyle,
            true
        );

        if (placeholder) {
            var geo = graph.model.getGeometry(placeholder);
            if (geo) {
                geo.relative = true;
                geo.x = positionX;
                geo.y = positionY;
                if (typeof mxPoint !== 'undefined') {
                    geo.offset = new mxPoint(-boxWidth / 2, offsetY);
                }
                graph.model.setGeometry(placeholder, geo);
            }

            // Get the placeholder ID - prefer the actual cell id, fallback to mxObjectId without '#' prefix
            var placeholderId = placeholder.id;
            if (!placeholderId && placeholder.mxObjectId) {
                // mxObjectId format is typically '#mxCell-123', we need to strip the '#' for getCell to work
                placeholderId = placeholder.mxObjectId.replace('#', '');
            }
            if (placeholderId) {
                // Make placeholder traceable
                graph.model.setStyle(
                    placeholder,
                    placeholderStyle + ';placeholderId=' + placeholderId
                );

                // Store reference on the component cell itself so results logic can find it
                if (componentCell) {
                    if (componentCell.value && typeof componentCell.value.setAttribute === 'function') {
                        componentCell.value.setAttribute('placeholderId', placeholderId);
                        graph.model.setValue(componentCell, componentCell.value);
                    } else {
                        componentCell.placeholderId = placeholderId;
                    }
                }
            }
        }
    } catch (err) {
        console.error('ELXXX: Error creating placeholder:', err);
    } finally {
        graph.model.endUpdate();
    }
}

mxGraph.prototype.addEdge = function (edge, parent, source, target, index) {
    // Prevent recursive re-entry when our own placeholder creation triggers internal addEdge calls
    if (this._elxxxInAddEdge) {
        return originalGraphAddEdge.apply(this, arguments);
    }

    this._elxxxInAddEdge = true;
    try {
        var result = originalGraphAddEdge.apply(this, arguments);

        try {
            if (!result || !source || !target) {
                return result;
            }

            var sourceStyle = source.style || '';
            var targetStyle = target.style || '';
            var edgeStyle = result.style || '';

            var sourceShape = getShapeElxxx(sourceStyle);
            var targetShape = getShapeElxxx(targetStyle);
            var edgeShape = getShapeElxxx(edgeStyle);

            // 1) Placeholders for ALL components connected to a Bus via edges
            // This includes: External Grid, Generator, Load, Motor, Transformer, Shunt Reactor,
            // Capacitor, Static Generator, Asymmetric Static Generator, Asymmetric Load,
            // Impedance, Ward, Extended Ward, Storage, SVC, TCSC, SSC, DC Line, etc.
            var sourceIsBus = isBusStyle(sourceStyle);
            var targetIsBus = isBusStyle(targetStyle);

            if ((sourceIsBus && !targetIsBus && targetShape) ||
                (targetIsBus && !sourceIsBus && sourceShape)) {

                var componentCell = sourceIsBus ? target : source;
                var componentShape = sourceIsBus ? targetShape : sourceShape;

                // For edge-based placeholders, check if a placeholder already exists on THIS specific edge
                // Each edge should have its own placeholder, even if the component has placeholders on other edges
                // This is critical for components with multiple edges (e.g., Transformers with HV and LV edges)
                var edgeHasPlaceholder = false;
                if (result) {
                    // Use model API for consistency with rest of codebase
                    var childCount = this.model.getChildCount(result);
                    for (var i = 0; i < childCount; i++) {
                        var child = this.model.getChildAt(result, i);
                        if (!child) continue;
                        var childStyle = this.model.getStyle(child) || '';
                        if (childStyle && (childStyle.includes('shapeELXXX=Result') || 
                            childStyle.includes('shapeELXXX=ResultExternalGrid'))) {
                            edgeHasPlaceholder = true;
                            break;
                        }
                    }
                }

                // Only create placeholder if this edge doesn't already have one
                // This ensures each edge gets its own placeholder when components are cloned
                if (!edgeHasPlaceholder) {
                    // Use a dedicated logical shape for External Grid result boxes
                    // All other components use 'Result' shape
                    var logicalShape = (componentShape === 'External Grid')
                        ? 'ResultExternalGrid'
                        : 'Result';

                    createResultPlaceholder(this, result, componentCell, {
                        logicalShape: logicalShape,
                        width: 60,
                        height: 40,
                        positionX: -0.3
                    });
                }
            }           

            
        } catch (err) {
            console.error('ELXXX: Error in addEdge placeholder logic:', err);
        }

        return result;
    } finally {
        this._elxxxInAddEdge = false;
    }
};

//=============================================================================
// Connection Handler - Line Creation Logic
//=============================================================================
// This code extends mxConnectionHandler to set up Line parameters when
// connecting two Bus objects together
//=============================================================================

//rysowanie linii łączącej obiekty
//e - mxGraphModel 
//g - mxCell - finalne połączenie z atrybutami source i target
mxConnectionHandler.prototype.connect = function (a, b, c, d) {

    //console.log('connect tutaj')
    if (null != b || this.isCreateTarget(c) || this.graph.allowDanglingEdges) {
        var e = this.graph.getModel(),
            f = !1,
            g = null;
        console.log(e)
        e.beginUpdate();
        try {
            if (null != a && null == b && !this.graph.isIgnoreTerminalEvent(c) && this.isCreateTarget(c) && (b = this.createTargetVertex(c, a), null != b)) {
                d = this.graph.getDropTarget([b], c, d);
                f = !0;
                if (null != d && this.graph.getModel().isEdge(d)) d = this.graph.getDefaultParent();
                else {
                    var k = this.graph.getView().getState(d);
                    if (null != k) {
                        var l = e.getGeometry(b);
                        l.x -= k.origin.x;
                        l.y -= k.origin.y
                    }
                }
                this.graph.addCell(b, d)
            }
            var m = this.graph.getDefaultParent();
            null != a && null != b && e.getParent(a) == e.getParent(b) && e.getParent(e.getParent(a)) != e.getRoot() && (m = e.getParent(a), null != a.geometry && a.geometry.relative && null != b.geometry && b.geometry.relative && (m = e.getParent(m)));
            var n = k = null;
            null != this.edgeState && (k = this.edgeState.cell.value, n = this.edgeState.cell.style);
            g = this.insertEdge(m, null, k, a, b, n);
            if (null != g) {
                this.graph.setConnectionConstraint(g, a, !0, this.sourceConstraint);
                this.graph.setConnectionConstraint(g, b, !1, this.constraintHandler.currentConstraint);
                null != this.edgeState && e.setGeometry(g, this.edgeState.cell.geometry);
                m = e.getParent(a);
                if (this.isInsertBefore(g, a, b, c, d)) {
                    for (l = a; null != l.parent && null != l.geometry && l.geometry.relative && l.parent != g.parent;) l = this.graph.model.getParent(l);
                    null != l && null != l.parent && l.parent == g.parent && e.add(m, g, l.parent.getIndex(l))
                }
                var p = e.getGeometry(g);
                null == p && (p = new mxGeometry, p.relative = !0, e.setGeometry(g, p));
                if (null != this.waypoints &&
                    0 < this.waypoints.length) {
                    var q = this.graph.view.scale,
                        r = this.graph.view.translate;
                    p.points = [];
                    for (a = 0; a < this.waypoints.length; a++) {
                        var t = this.waypoints[a];
                        p.points.push(new mxPoint(t.x / q - r.x, t.y / q - r.y))
                    }
                }
                if (null == b) {
                    var u = this.graph.view.translate,
                        q = this.graph.view.scale,
                        t = null != this.originalPoint ? new mxPoint(this.originalPoint.x / q - u.x, this.originalPoint.y / q - u.y) : new mxPoint(this.currentPoint.x / q - u.x, this.currentPoint.y / q - u.y);
                    t.x -= this.graph.panDx / this.graph.view.scale;
                    t.y -= this.graph.panDy / this.graph.view.scale;
                    p.setTerminalPoint(t, !1)
                }
                this.fireEvent(new mxEventObject(mxEvent.CONNECT, "cell", g, "terminal", b, "event", c, "target", d, "terminalInserted", f))
            }
        } catch (x) {
            mxLog.show(), mxLog.debug(x.message)
        } finally {
            e.endUpdate()
        }

        //ELXXX

        //g - mxCell - linia
        //e - mxGraph

        //ustaw label        
        e.setValue(g, '');

        var parametry = e.getValue(g);

        //jesli linia łączy dwa bus wtedy umożliwij wprowadzanie parametrów linii   
        //do wyszukiwania fraza ELXXX Line
        if (g.source?.style?.includes("Bus") && g.target?.style?.includes("Bus")) {

            //utworzenie parametrów linii
            var listaParametry = mxUtils.createXmlDocument().createElement("object");
            //listaParametry.setAttribute("label", parametry || "");
            listaParametry.setAttribute("from_bus", g.source.mxObjectId);
            listaParametry.setAttribute("to_bus", g.target.mxObjectId);

            //INPUT
            listaParametry.setAttribute("length_km", "0");

            listaParametry.setAttribute("parallel", "1");
            listaParametry.setAttribute("df", "1");

            //możliwość wyboru z biblioteki
            listaParametry.setAttribute("parameters", true);
            // listaParametry.setAttribute("standard_type", false);
            // listaParametry.setAttribute("line_type", true);
            listaParametry.setAttribute("name", "Line");            

            //Load_flow_parameters
            listaParametry.setAttribute("Load_flow_parameters", "");
            listaParametry.setAttribute("r_ohm_per_km", "0");
            listaParametry.setAttribute("x_ohm_per_km", "0");
            listaParametry.setAttribute("c_nf_per_km", "0");
            listaParametry.setAttribute("g_us_per_km", "0");
            listaParametry.setAttribute("max_i_ka", "0");
            listaParametry.setAttribute("type", "cs");

            //Short_circuit_parameters
            listaParametry.setAttribute("Short_circuit_parameters", "");
            listaParametry.setAttribute("r0_ohm_per_km", 0.0); //w specyfikacji PandaPower jako nan
            listaParametry.setAttribute("x0_ohm_per_km", "0"); //w specyfikacji PandaPower jako nan
            listaParametry.setAttribute("c0_nf_per_km", "0"); //w specyfikacji PandaPower jako nan
            listaParametry.setAttribute("endtemp_degree", "0");                   

           
            //listaParametry.setAttribute("max_loading_percent", "0"); //w specyfikacji PandaPower jako nan
            //listaParametry.setAttribute("endtemp_degree", "0"); //w specyfikacji PandaPower jako nan
            //listaParametry.setAttribute("in_service", "True"); //in_service nie działa

            e.setValue(g, listaParametry)

            g.setStyle(g.getStyle() + ";shapeELXXX=Line")

            // Create result placeholder for Line - as child of edge with relative positioning
            try {
                var lineExistingId = g.value &&
                    g.value.attributes &&
                    g.value.attributes.placeholderId &&
                    g.value.attributes.placeholderId.nodeValue;

                if (!lineExistingId) {
                    createResultPlaceholder(this.graph, g, g, {
                        logicalShape: 'Result',
                        width: 70,
                        height: 80,
                        positionX: 0.2 // middle of the line
                    });
                }
            } catch (err) {
                console.error('ELXXX: Error creating placeholder for Line:', err);
            }

        }else{
            g.setStyle(g.getStyle() + ";shapeELXXX=NotEditableLine")
        }

        this.select && this.selectCells(g, f ? b : null)
    }
};