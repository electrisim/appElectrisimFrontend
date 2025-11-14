# Tab Switching Fix - Testing & Verification Plan

## Quick Verification (5 minutes)

### Test 1: Basic Tab Switching
1. **Open the application** in your browser
2. **Open DevTools Console** (F12)
3. **Switch to another tab** (or minimize browser)
4. **Wait 5-10 seconds**
5. **Look for console message**: `⏸️ Page hidden - pausing operations`
6. **Switch back to application tab**
7. **Look for console message**: `▶️ Page visible - resuming operations (was hidden for X.Xs)`
8. **Verify**: Application responds immediately, no freezing ✅

### Test 2: Performance Dashboard
1. **Open Performance Dashboard** (Press Ctrl+Shift+P)
2. **Watch the FPS counter** (should be 55-60)
3. **Switch to another tab** for 10 seconds
4. **Switch back**
5. **Verify**: 
   - Dashboard updates immediately ✅
   - FPS counter resumes smoothly ✅
   - No lag or freeze ✅

### Test 3: Extended Hidden Period
1. **Open the application**
2. **Switch to another tab** or minimize browser
3. **Wait 2-3 minutes**
4. **Return to application tab**
5. **Verify**: 
   - Application responds instantly ✅
   - No accumulated lag ✅
   - Console shows correct hidden duration ✅

## Comprehensive Testing (15 minutes)

### Test 4: Rapid Tab Switching
1. **Open the application**
2. **Rapidly switch tabs** back and forth 10 times
3. **Verify**:
   - No errors in console ✅
   - Application remains responsive ✅
   - No memory leaks (check DevTools Memory tab) ✅

### Test 5: Multiple Dialogs
1. **Open several dialogs** (Load Flow, Short Circuit, etc.)
2. **Switch to another tab**
3. **Wait 30 seconds**
4. **Return to application**
5. **Verify**:
   - All dialogs still functional ✅
   - No freezing ✅
   - Data preserved ✅

### Test 6: Long Session with Tab Switching
1. **Use application normally for 10 minutes**
2. **Switch tabs 5-10 times** during this period
3. **Check console for pause/resume messages**
4. **Check Performance Dashboard** (Ctrl+Shift+P)
5. **Verify**:
   - Memory usage stable (< 200 MB) ✅
   - FPS remains high (> 50) ✅
   - No accumulated event listeners ✅

### Test 7: Background Tab CPU Usage
1. **Open Task Manager** (Windows) or **Activity Monitor** (Mac)
2. **Find your browser process**
3. **Note CPU usage with application visible** (should be low)
4. **Switch to another tab**
5. **Wait 30 seconds**
6. **Check CPU usage again**
7. **Verify**: CPU usage drops to near zero when hidden ✅

## Browser Compatibility Testing

Test on multiple browsers:

### Chrome/Edge
- ✅ Basic tab switching
- ✅ Console messages appear
- ✅ No freezing

### Firefox
- ✅ Basic tab switching
- ✅ Console messages appear
- ✅ No freezing

### Safari (Mac/iOS)
- ✅ Basic tab switching
- ✅ Console messages appear
- ✅ No freezing

## Performance Metrics Verification

### Before Fix (Expected):
- Hidden tab CPU: 5-15%
- Return to tab: 2-5 second freeze
- Memory growth: ~50-100 MB/30 min hidden

### After Fix (Expected):
- Hidden tab CPU: <1%
- Return to tab: Instant response
- Memory growth: <5 MB/30 min hidden

## Console Commands for Testing

Open browser console and run these commands:

### Check Visibility Manager Status
```javascript
// Get current visibility state
window.pageVisibilityManager.isVisible()

// Get statistics
window.pageVisibilityManager.getStatistics()
// Should show: pauseCount, resumeCount, totalHiddenTime, etc.
```

### Check Performance Dashboard Status
```javascript
// Open dashboard programmatically
window.performanceDashboard.show()

// Check if monitoring is active
window.performanceDashboard.isVisible
```

### Monitor Pause/Resume Events
```javascript
// Listen for pause events
window.addEventListener('pagepaused', (e) => {
    console.log('🔴 PAUSED at', new Date(e.detail.timestamp));
});

// Listen for resume events
window.addEventListener('pageresumed', (e) => {
    console.log('🟢 RESUMED after', e.detail.hiddenDuration, 'ms');
});
```

## Expected Console Output

### Normal Operation:
```
✅ Page Visibility Manager initialized
✅ Performance dashboard loaded. Press Ctrl+Shift+P to toggle.
✅ Performance monitoring started (visibility-aware)
```

### When Switching Tabs:
```
⏸️  Page hidden - pausing operations
▶️  Page visible - resuming operations (was hidden for 5.2s)
```

## Troubleshooting Common Issues

### Issue: No console messages when switching tabs

**Possible Causes:**
1. Scripts not loaded correctly
2. JavaScript error preventing initialization
3. Browser doesn't support Page Visibility API (very old browser)

**Solution:**
1. Check browser console for JavaScript errors
2. Verify all scripts loaded: Check Network tab in DevTools
3. Try in Chrome/Edge (best support)
4. Clear cache and reload (Ctrl+Shift+R)

### Issue: Still experiencing some lag

**Possible Causes:**
1. Other operations running that don't use visibility manager
2. Browser extensions interfering
3. System resources low

**Solution:**
1. Test in incognito mode (disables extensions)
2. Close other tabs/applications
3. Check DevTools Performance tab for long tasks
4. Search code for raw `setInterval` or `requestAnimationFrame` calls

### Issue: Operations not resuming

**Possible Causes:**
1. JavaScript error in resume callback
2. Page visibility state inconsistent

**Solution:**
1. Check console for errors
2. Run: `window.pageVisibilityManager.getStatistics()`
3. Manually resume: `window.pageVisibilityManager.resume()`
4. Reload page

## Performance Dashboard Verification

With dashboard open (Ctrl+Shift+P):

### When Tab is Visible:
- **FPS**: 55-60 (green)
- **Memory**: < 85% (green/yellow)
- **Event Listeners**: Stable count
- **Active Timers**: Low count (< 10)

### When Tab is Hidden:
- **Dashboard stops updating** (should not update while hidden)
- **FPS tracking pauses** (no new measurements)

### After Returning to Tab:
- **Dashboard resumes immediately** (within 1 second)
- **All values update** correctly
- **No lag or freeze**

## Automated Testing (Optional)

For developers wanting to automate testing:

```javascript
// Test script to run in console
async function testTabSwitching() {
    console.log('Starting automated test...');
    
    // Get initial stats
    const initialStats = window.pageVisibilityManager.getStatistics();
    console.log('Initial stats:', initialStats);
    
    // Simulate visibility changes
    console.log('Manual test required: Switch tabs and return');
    
    // Wait for user action
    await new Promise(resolve => {
        const checkInterval = setInterval(() => {
            const currentStats = window.pageVisibilityManager.getStatistics();
            if (currentStats.pauseCount > initialStats.pauseCount) {
                console.log('✅ Pause detected!');
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
    });
    
    // Check final stats
    const finalStats = window.pageVisibilityManager.getStatistics();
    console.log('Final stats:', finalStats);
    
    // Verify
    if (finalStats.pauseCount > initialStats.pauseCount) {
        console.log('✅ TEST PASSED: Visibility manager working correctly');
    } else {
        console.log('❌ TEST FAILED: No pause detected');
    }
}

// Run test
testTabSwitching();
```

## Success Criteria

The fix is successful if ALL of the following are true:

- ✅ Console shows pause/resume messages when switching tabs
- ✅ No freezing or lag when returning to tab
- ✅ CPU usage drops to <1% when tab is hidden
- ✅ Memory usage stable (< 200 MB after 30 min)
- ✅ Performance dashboard works smoothly
- ✅ Application responds instantly when tab becomes visible
- ✅ No JavaScript errors in console
- ✅ Works in Chrome, Firefox, and Safari

## Regression Testing

Verify that existing features still work:

- ✅ Performance Dashboard opens (Ctrl+Shift+P)
- ✅ Load Flow simulation works
- ✅ Short Circuit analysis works
- ✅ All dialogs open and close properly
- ✅ Subscriptions and authentication work
- ✅ File save/load works

## Reporting Issues

If you encounter any issues:

1. **Open browser console** (F12)
2. **Take screenshot** of any errors
3. **Run this command** in console:
   ```javascript
   console.log(window.pageVisibilityManager.getStatistics());
   ```
4. **Note your browser** version and OS
5. **Describe exact steps** to reproduce

## Summary

This fix should **completely eliminate** the tab switching freeze issue. The application will now:

- ✅ Automatically pause when hidden
- ✅ Resume instantly when visible
- ✅ Use minimal resources in background
- ✅ Provide better user experience

If all tests pass, the fix is ready for production! 🎉

---

**Created:** November 12, 2025  
**Version:** 1.0  
**Status:** Ready for Testing ✅


