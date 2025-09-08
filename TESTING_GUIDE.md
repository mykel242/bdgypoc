# Budgie Local Testing Guide

## Quick Start

1. **Start the local server:**
   ```bash
   ./test-local.sh
   ```
   Or manually:
   ```bash
   python3 -m http.server 8000
   ```

2. **Open in browser:**
   - Navigate to: http://localhost:8000
   - Open in multiple tabs to test multi-tab sync

## Testing Checklist

### ✅ Hamburger Menu
- [ ] Click hamburger button - menu should open with slide-down animation
- [ ] Click outside menu - should close automatically  
- [ ] Press Escape key - should close menu
- [ ] Click any menu item - should close menu after action
- [ ] Verify all buttons are present:
  - [ ] New
  - [ ] Open from Network
  - [ ] Save to Network
  - [ ] Import
  - [ ] Export
  - [ ] Rename
  - [ ] Print
  - [ ] Delete

### ✅ Existing Features (Regression Testing)
- [ ] Create a new ledger
- [ ] Add transactions
- [ ] Edit transactions
- [ ] Delete transactions
- [ ] Drag and drop to reorder transactions
- [ ] Import ledger (base64 file)
- [ ] Export ledger (base64 file)
- [ ] Rename ledger
- [ ] Delete ledger
- [ ] Print ledger
- [ ] Switch between ledgers

### ✅ Network Sync Features

#### Save to Network
1. [ ] Add some test transactions to a ledger
2. [ ] Click hamburger menu → "Save to Network"
3. [ ] Choose a location (Desktop or test folder)
4. [ ] Verify file saves with `.budgie` extension
5. [ ] Check notification appears: "Ledger saved to network"

#### Open from Network
1. [ ] Click hamburger menu → "Open from Network"
2. [ ] Select the `.budgie` file you saved
3. [ ] Verify ledger loads with all transactions
4. [ ] Check notification: "Ledger opened from network"

#### Auto-Sync Testing
1. [ ] Open a `.budgie` file from network
2. [ ] Make changes (add/edit transactions)
3. [ ] Wait 30 seconds or navigate away
4. [ ] Re-open the same file from another browser/tab
5. [ ] Verify changes are preserved

#### Conflict Detection
1. [ ] Open same `.budgie` file in two browser tabs
2. [ ] Make changes in first tab
3. [ ] Try to open in second tab within 30 seconds
4. [ ] Should see warning: "This file may be open on another computer"

### ✅ Browser Compatibility Testing

Test in multiple browsers:
- [ ] Chrome/Edge (Full File System API support)
- [ ] Safari (Limited support - fallback mode)
- [ ] Firefox (Limited support - fallback mode)

For browsers without File System API:
- [ ] "Save to Network" should download file
- [ ] "Open from Network" should use file picker dialog

### ✅ Mobile Responsiveness
1. [ ] Open Developer Tools (F12)
2. [ ] Toggle device toolbar (Ctrl+Shift+M)
3. [ ] Test on different screen sizes:
   - [ ] iPhone SE (375px)
   - [ ] iPhone 12 (390px)
   - [ ] iPad (768px)
   - [ ] Desktop (1024px+)

### ✅ Error Handling
- [ ] Try to open a corrupted `.budgie` file
- [ ] Try to open a non-JSON file
- [ ] Test with localStorage full
- [ ] Test with network drive disconnected during save

## Test Data Creation

### Sample Ledger Data
```javascript
// Open browser console and run:
localStorage.setItem('expense_tracker_TestLedger_transactions', JSON.stringify([
  {
    id: "test-1",
    date: "2024-01-15",
    description: "Grocery Store",
    debit: 125.50,
    credit: 0,
    balance: -125.50,
    status: "cleared",
    sequence: 0
  },
  {
    id: "test-2", 
    date: "2024-01-16",
    description: "Salary Deposit",
    debit: 0,
    credit: 2500.00,
    balance: 2374.50,
    status: "cleared",
    sequence: 1
  }
]));
```

## Debugging Tips

### Check Console for Errors
```javascript
// Open DevTools Console (F12)
// Look for any red errors during:
- Page load
- Menu interactions
- File operations
- Network sync
```

### Verify localStorage Data
```javascript
// Check all Budgie data:
Object.keys(localStorage)
  .filter(k => k.startsWith('expense_tracker'))
  .forEach(k => console.log(k, localStorage.getItem(k)));
```

### Test Network Sync Status
```javascript
// In console:
NetworkSync.getSyncStatus()
```

### Force Manual Sync
```javascript
// In console:
NetworkSync.autoSave()
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Menu won't open | Check console for JavaScript errors |
| Network sync not available | Ensure using HTTP server, not file:// |
| Can't save to network | Check browser supports File System API |
| Auto-sync not working | Verify file handle is active: `NetworkSync.currentHandle` |
| Styles look broken | Clear browser cache (Ctrl+Shift+R) |

## Performance Testing

1. **Large Dataset Test:**
   - Import a ledger with 1000+ transactions
   - Verify smooth scrolling
   - Check memory usage in DevTools

2. **Multi-Tab Test:**
   - Open app in 5+ tabs
   - Make changes in each
   - Verify localStorage sync works

## Security Testing

- [ ] Verify no sensitive data in console logs
- [ ] Check network requests (should be none)
- [ ] Verify localStorage data is properly escaped
- [ ] Test XSS prevention with transaction descriptions

## Final Checklist Before Deployment

- [ ] All tests pass in Chrome
- [ ] Fallback works in Safari/Firefox  
- [ ] No console errors
- [ ] Mobile layout works properly
- [ ] Network sync works as expected
- [ ] Existing features still functional
- [ ] Performance acceptable with large datasets

---

## Quick Test Commands

```bash
# Start server
./test-local.sh

# Open multiple browsers for testing
open http://localhost:8000  # macOS
xdg-open http://localhost:8000  # Linux

# Watch for file changes (optional)
fswatch -o . | xargs -n1 -I{} echo "Files changed, refresh browser"
```

## Notes
- Network sync requires a proper HTTP server (not file://)
- File System API only works in secure contexts (localhost is OK)
- Some features may behave differently when deployed to GitHub Pages