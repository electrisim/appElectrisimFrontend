# Implementation Guide for Missing Pandapower Elements

This guide explains how to implement the missing pandapower elements in your application.

## Missing Elements Implemented

1. **DC Bus** - DC network bus/node
2. **Load DC** - DC load
3. **Source DC** - DC source (similar to External Grid but for DC)
4. **Switch** - Switch element
5. **Measurement** - Measurement element
6. **VSC** - Voltage Source Converter
7. **B2B VSC** - Back2Back Voltage Source Converter
8. **Line DC** - DC line (different from DC Line)

## Changes Required in app.min.js

Since `app.min.js` is a minified file, you should work with its unminified version (`app.js`) if available. If not, use a JavaScript beautifier to format it.

### Location: Lines 58436-58451

In the section where elements are defined for the "electricalSources" palette, add the following entries:

```javascript
// Add after the existing entries (around line 58451):

this.createVertexTemplateEntry(c + "busbar;shapeELXXX=DC Bus", 70, 58, "", "DC Bus", null, null,
    this.getTagsForStencil("mxgraph.electrical.abstract", "busbar", "electrical ").join(" ")),

this.createVertexTemplateEntry(t + "dc_load;shapeELXXX=Load DC", 45, 45, "", "Load DC", null, null,
    this.getTagsForStencil("mxgraph.electrical.signal_sources", "dc_load", "electrical signal source ").join(" ")),

this.createVertexTemplateEntry(c + "voltage_regulator;shapeELXXX=Source DC", 70, 58, "", "Source DC", null, null,
    this.getTagsForStencil("mxgraph.electrical.abstract", "voltage_regulator", "electrical ").join(" ")),

this.createVertexTemplateEntry(t + "switch;shapeELXXX=Switch", 45, 45, "", "Switch", null, null,
    this.getTagsForStencil("mxgraph.electrical.abstract", "switch", "electrical ").join(" ")),

this.createVertexTemplateEntry(t + "measurement;shapeELXXX=Measurement", 45, 45, "", "Measurement", null, null,
    this.getTagsForStencil("mxgraph.electrical.abstract", "measurement", "electrical ").join(" ")),

this.createVertexTemplateEntry(v + "vsc;shapeELXXX=VSC", 45, 45, "", "VSC", null, null,
    this.getTagsForStencil("mxgraph.electrical.rot_mech", "vsc", "electrical ").join(" ")),

this.createVertexTemplateEntry(v + "b2b_vsc;shapeELXXX=B2B VSC", 45, 45, "", "B2B VSC", null, null,
    this.getTagsForStencil("mxgraph.electrical.rot_mech", "b2b_vsc", "electrical ").join(" ")),

this.createVertexTemplateEntry(t + "line_dc;shapeELXXX=Line DC", 45, 45, "", "Line DC", null, null,
    this.getTagsForStencil("mxgraph.electrical.abstract", "line_dc", "electrical ").join(" ")),
```

### Notes:
- Replace `c`, `t`, `v` with the appropriate shape path variables used in your app.min.js
- Adjust the shape names (`busbar`, `dc_load`, etc.) to match your actual shape library
- The `shapeELXXX=` attribute is critical - it must match exactly (e.g., `shapeELXXX=DC Bus`, `shapeELXXX=Load DC`, etc.)

## Files Already Updated

1. ✅ **configureAttributes.js** - Added configure functions for all new elements
2. ✅ **Dialog files created**:
   - `dcBusDialog.js`
   - `loadDcDialog.js`
   - `sourceDcDialog.js`
   - (Switch, Measurement, VSC, B2B VSC dialogs need to be created following the same pattern)

## Files That Need Updates

The following files need to be updated to handle the new elements:

1. **resultBoxes.js** - Add placeholder creation for new elements
2. **loadFlow.js** - Add processing logic for new elements in power flow calculations
3. **loadflowOpenDss.js** - Add OpenDSS support for new elements
4. **shortCircuit.js** - Add short circuit analysis support for new elements

## Dialog Files Still Needed

You need to create dialog files for:
- `switchDialog.js`
- `measurementDialog.js`
- `vscDialog.js`
- `b2bVscDialog.js`
- `lineDcDialog.js`

These should follow the same pattern as `dcBusDialog.js`, `loadDcDialog.js`, and `sourceDcDialog.js`.

## Next Steps

1. Update `app.min.js` (or `app.js`) with the palette entries
2. Create remaining dialog files
3. Update `resultBoxes.js` to handle new elements
4. Update `loadFlow.js` to process new elements
5. Update `loadflowOpenDss.js` for new elements
6. Update `shortCircuit.js` for new elements
7. Test each element thoroughly

