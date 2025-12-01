# Performance Optimization Guide

## Overview

This guide describes the performance optimizations implemented to address:
1. **Excessive querySelector calls** (14,542 ms in original trace)
2. **Long blocking tasks** (5,602 ms long task from performance-optimizer.js)

## Performance Improvements

### ✅ Implemented Optimizations

#### 1. DOM Query Caching (`domCache.js`)
Eliminates repeated querySelector calls by caching results.

**Before:**
```javascript
// Called 100 times, each takes 145ms = 14,500ms total
const element = document.querySelector('.my-selector');
```

**After:**
```javascript
import { domCache } from './utils/domCache.js';

// First call: 145ms (cache miss)
// Subsequent 99 calls: <1ms each (cache hits) = ~100ms total
const element = domCache.querySelector('.my-selector');
```

**Usage:**
```javascript
// Basic query with caching
const element = domCache.querySelector('#myId');
const element2 = domCache.getElementById('myId'); // Even faster

// Query with context
const child = domCache.querySelector('.child', parentElement);

// Check cache statistics
domCache.logStats();
// Output: 📊 DOM Cache Performance: { 'Cache Hits': 95, 'Hit Rate': '95.00%', ... }

// Clear cache when needed
domCache.clear();
```

#### 2. Batch DOM Operations (`batchDOM.js`)
Groups DOM operations to minimize reflows and improve rendering performance.

**Before:**
```javascript
// Causes multiple reflows
elements.forEach(el => {
    el.style.color = 'red';
    el.style.fontSize = '14px';
});
```

**After:**
```javascript
import { batchDOM } from './utils/batchDOM.js';

// Batched - single reflow
await batchDOM.batchStyleUpdates(
    elements.map(el => ({
        element: el,
        styles: { color: 'red', fontSize: '14px' }
    }))
);
```

**Usage:**
```javascript
// Batch style updates
await batchDOM.batchStyleUpdates([
    { element: el1, styles: { color: 'red' } },
    { element: el2, styles: { color: 'blue' } }
]);

// Batch insert elements
await batchDOM.batchInsert(container, [el1, el2, el3]);

// Batch remove elements
await batchDOM.batchRemove([el1, el2, el3]);

// Separate reads from writes for optimal performance
await batchDOM.read(() => {
    return element.getBoundingClientRect();
});

await batchDOM.write(() => {
    element.style.width = '100px';
});
```

#### 3. Long Task Breaking (`supportingFunctions.js`)
Breaks long synchronous operations into smaller chunks using `requestIdleCallback`.

**Before:**
```javascript
// 5,602ms blocking task
components.forEach(component => {
    insertComponent(component); // Blocks UI
});
```

**After:**
```javascript
// Processes in batches of 3, yielding between batches
// UI remains responsive throughout
await processComponentBatches(componentTasks, 3);
```

**Key improvements:**
- Batch size reduced from 5 to 3 for shorter task duration
- Uses `requestIdleCallback` with 50ms timeout
- Shows progress for large operations (>50 components)
- Prevents UI blocking and improves responsiveness

#### 4. Performance Monitoring (`performanceTracker.js`)
Tracks and reports performance metrics to identify bottlenecks.

**Usage:**
```javascript
import { performanceTracker } from './utils/performanceTracker.js';

// Measure synchronous function
const result = performanceTracker.measure('myOperation', () => {
    // Your code here
    return doSomething();
});

// Measure async function
const result = await performanceTracker.measureAsync('myAsyncOp', async () => {
    return await fetchData();
});

// Get performance report
window.logPerformanceReport();
// Output:
// 📊 ========== PERFORMANCE REPORT ==========
// 📊 DOM Query Performance:
//    - querySelector calls: 150
//    - querySelector total time: 1,234.56ms
//    - querySelector avg time: 8.23ms
// 📊 Long Tasks:
//    - Total long tasks: 2
//    - Total long task time: 345.67ms
//    - Top 5 longest tasks:
//      1. componentInsertion: 234.56ms
//      2. graphRendering: 111.11ms

// Reset metrics
window.resetPerformanceMetrics();
```

#### 5. Optimized Dialog Helper (`dialogHelper.js`)
Provides utilities for creating performant dialogs with cached queries.

**Usage:**
```javascript
import { dialogHelper } from './utils/dialogHelper.js';

// Create optimized form
const form = dialogHelper.createOptimizedForm(parameters, inputsMap);

// Get form values efficiently
const values = dialogHelper.getFormValuesOptimized(parameters, inputsMap);

// Create modal with batched DOM operations
const modal = await dialogHelper.createOptimizedModal({
    title: 'My Dialog',
    width: '600px',
    content: contentElement
});

// Close modal
await dialogHelper.closeDialog(modal.id);

// Use cached queries
const element = dialogHelper.getCached('#myElement');
const elementById = dialogHelper.getCachedById('myElement');
```

## Migration Guide for Dialogs

### Before (Slow):
```javascript
class MyDialog {
    getFormValues() {
        const values = {};
        
        // Repeated DOM queries - SLOW
        values.field1 = document.querySelector('#field1').value;
        values.field2 = document.querySelector('#field2').value;
        values.checkbox1 = document.getElementById('checkbox1').checked;
        // ... 20 more fields = 20+ DOM queries
        
        return values;
    }
}
```

### After (Fast):
```javascript
import { dialogHelper } from './utils/dialogHelper.js';

class MyDialog {
    constructor() {
        this.inputs = new Map(); // Cache inputs during creation
    }
    
    createForm() {
        // Inputs are cached in this.inputs Map during creation
        return dialogHelper.createOptimizedForm(this.parameters, this.inputs);
    }
    
    getFormValues() {
        // Uses cached Map - NO DOM queries needed!
        return dialogHelper.getFormValuesOptimized(this.parameters, this.inputs);
    }
}
```

## Performance Metrics

### Before Optimization:
- **querySelector total time:** 14,542 ms
- **Long task duration:** 5,602 ms
- **UI blocking:** Severe
- **User experience:** Sluggish

### After Optimization (Expected):
- **querySelector total time:** ~200-500 ms (95%+ cache hit rate)
- **Long task duration:** <50 ms per chunk
- **UI blocking:** Minimal
- **User experience:** Responsive

## Testing Performance

### 1. Basic Test
```javascript
// In browser console:

// Enable performance tracking
window.performanceTracker.enable();

// Perform actions (e.g., open dialogs, run simulations)
// ...

// View report
window.logPerformanceReport();

// Check DOM cache stats
window.domCache.logStats();
```

### 2. Chrome DevTools Performance Tab
1. Open DevTools → Performance tab
2. Click Record
3. Perform actions (open dialogs, insert components)
4. Stop recording
5. Look for:
   - Reduced querySelector time (should be 10x+ faster)
   - Shorter long tasks (<50ms each instead of 5000ms)
   - Better FPS during operations

### 3. Automated Testing
```javascript
// Test script
async function testPerformance() {
    const start = performance.now();
    
    // Clear cache to start fresh
    window.domCache.clear();
    
    // Perform 100 querySelector calls
    for (let i = 0; i < 100; i++) {
        window.domCache.querySelector('#testElement');
    }
    
    const duration = performance.now() - start;
    const stats = window.domCache.getStats();
    
    console.log(`Duration: ${duration.toFixed(2)}ms`);
    console.log(`Cache hit rate: ${stats.hitRate}`);
    console.log(`Expected: <50ms with >98% hit rate`);
}

testPerformance();
```

## Best Practices

### 1. Always Use DOM Cache for Repeated Queries
```javascript
// ❌ BAD
for (let i = 0; i < 100; i++) {
    const el = document.querySelector('.my-element');
    el.textContent = i;
}

// ✅ GOOD
const el = domCache.querySelector('.my-element');
for (let i = 0; i < 100; i++) {
    el.textContent = i;
}
```

### 2. Batch DOM Operations
```javascript
// ❌ BAD - Multiple reflows
elements.forEach(el => {
    el.style.width = '100px';  // Reflow
    el.style.height = '100px'; // Reflow
});

// ✅ GOOD - Single reflow
await batchDOM.batchStyleUpdates(
    elements.map(el => ({
        element: el,
        styles: { width: '100px', height: '100px' }
    }))
);
```

### 3. Break Up Long Tasks
```javascript
// ❌ BAD - 5000ms blocking task
data.forEach(item => processItem(item));

// ✅ GOOD - Responsive processing
await processComponentBatches(
    data.map(item => () => processItem(item)),
    3  // batch size
);
```

### 4. Measure Performance-Critical Operations
```javascript
// Wrap critical operations
const result = await performanceTracker.measureAsync('dataLoad', async () => {
    return await loadLargeDataset();
});

// Check if it's slow
if (result.duration > 100) {
    console.warn('Data load is slow, consider optimization');
}
```

## Troubleshooting

### Issue: Cache hit rate is low
**Solution:** 
- Check if elements are being recreated frequently
- Use `domCache.clearStaleEntries()` to remove invalid cache entries
- Verify selectors are consistent

### Issue: Still seeing long tasks
**Solution:**
- Reduce batch size in `processComponentBatches` (try 2 or 1)
- Check for synchronous operations outside the batch processor
- Use `performanceTracker.logReport()` to identify the culprit

### Issue: Memory usage increased
**Solution:**
- Call `domCache.clear()` after major UI changes
- The cache auto-clears stale entries on DOM mutations
- Check `domCache.getStats().cacheSize` - if >1000, clear manually

## Files Modified

1. **New files:**
   - `/js/electrisim/utils/domCache.js` - DOM query caching
   - `/js/electrisim/utils/batchDOM.js` - Batched DOM operations
   - `/js/electrisim/utils/performanceTracker.js` - Performance monitoring
   - `/js/electrisim/utils/dialogHelper.js` - Optimized dialog utilities

2. **Modified files:**
   - `/src/main/webapp/index.html` - Load performance utilities early
   - `/js/electrisim/supportingFunctions.js` - Optimized batch processing

## Next Steps

1. **Test the optimizations:**
   ```bash
   # Open the app in Chrome
   # Open DevTools → Performance tab
   # Record while performing heavy operations
   # Verify improvements
   ```

2. **Migrate dialogs:**
   - Update `EditDataDialog.js` to use `dialogHelper`
   - Update `LoadFlowDialog.js` to use cached queries
   - Update other dialogs progressively

3. **Monitor production:**
   - Keep `performanceTracker` enabled in dev
   - Periodically check metrics
   - Adjust batch sizes based on user feedback

## Support

For issues or questions:
1. Check browser console for performance warnings
2. Run `window.logPerformanceReport()` to see metrics
3. Check cache stats with `window.domCache.logStats()`
4. Review long tasks in Chrome DevTools

## Performance Optimization Checklist

- [x] Implement DOM query caching
- [x] Create batch DOM operations utility
- [x] Break long tasks into chunks
- [x] Add performance monitoring
- [x] Create optimized dialog helper
- [ ] Update all dialogs to use new utilities
- [ ] Test with large datasets
- [ ] Measure improvement metrics
- [ ] Deploy to production

