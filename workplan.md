# Budgie File-System Storage Refactoring Workplan

## Overview
Refactor Budgie to use file-system as primary storage with changelog-based undo/redo system. This removes redundant browser storage and implements a clean file-first architecture.

## Branch: `refactor/file-system-storage`

---

## Phase 1: Core Infrastructure

### 1.1 File Format & Naming
- [ ] Define .budgie file format with immutable fileId
- [ ] Implement unique ID generation (UUID-based)
- [ ] Create file naming convention: `{fileId}.budgie` and `{fileId}.budgie.changelog`
- [ ] Add file format validation and versioning

### 1.2 New FileManager Component
- [ ] Create `file-manager.js` to replace TransactionManager
- [ ] Implement core file operations:
  - [ ] `createLedger(title, filePath)`
  - [ ] `openLedger(filePath)`
  - [ ] `saveLedger(fileId, data)`
  - [ ] `loadLedgerData(filePath)`
- [ ] Add File System Access API integration
- [ ] Implement fallback for browsers without File System API

### 1.3 Registry System with Caching
- [ ] Create `registry-manager.js` for ledger registry
- [ ] Implement lightweight registry cache in localStorage
- [ ] Add registry operations:
  - [ ] `addLedger(fileId, title, filePath, summary)`
  - [ ] `removeLedger(fileId)`
  - [ ] `updateSummary(fileId, summary)`
  - [ ] `loadCache()` and `saveCache()`
- [ ] Background registry refresh functionality

### 1.4 Changelog System
- [ ] Create `changelog-manager.js`
- [ ] Define command structure with types:
  - [ ] `transaction_add`, `transaction_edit`, `transaction_delete`
  - [ ] `transaction_reorder`, `starting_balance_change`
  - [ ] `bulk_edit`, `import_transactions`
- [ ] Implement core changelog operations:
  - [ ] `recordCommand(type, data, undoData)`
  - [ ] `undo()` and `redo()`
  - [ ] `canUndo()` and `canRedo()`
  - [ ] `loadChangelog(fileId)` and `saveChangelog(fileId)`
- [ ] Add command history tracking (infinite retention)

---

## Phase 2: State Management Simplification

### 2.1 AppStateManager Refactoring
- [ ] Simplify AppStateManager to handle only state transitions
- [ ] Remove complex metadata synchronization logic
- [ ] Update state management:
  - [ ] `showWelcomeScreen()`
  - [ ] `showDocumentView(ledgerData)`
  - [ ] `openLedger(registryEntry)`
  - [ ] `closeLedger()`
- [ ] Remove auto-open ledger behavior (always start with welcome screen)

### 2.2 New Ledger Creation Flow
- [ ] Update welcome screen "New Ledger" button
- [ ] Implement streamlined creation flow:
  - [ ] Simple dialog with title input only
  - [ ] Immediate transition to document view
  - [ ] Auto-prompt for save location
  - [ ] Handle save cancellation gracefully
- [ ] Remove browser-only ledger support

### 2.3 Header Integration for Undo/Redo
- [ ] Create `header-manager.js` component
- [ ] Add dirty state tracking and display
- [ ] Implement undo/redo buttons in header:
  - [ ] Show change count: "June 2025 Budget • 3 changes"
  - [ ] Context-aware undo/redo buttons
  - [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+S)
- [ ] Add save status indicators

---

## Phase 3: UI Updates

### 3.1 Welcome Screen Updates
- [ ] Update recent ledgers to use registry cache
- [ ] Remove "Browse All" button
- [ ] Simplify welcome screen actions to work with FileManager
- [ ] Update ledger cards to show file-based metadata

### 3.2 Document View Updates
- [ ] Update ledger controller to work with FileManager
- [ ] Integrate changelog recording for all user actions
- [ ] Add dirty state indicators throughout UI
- [ ] Update hamburger menu for file-based operations

### 3.3 File Operations UI
- [ ] Update "Save to Network" to work with current file
- [ ] Update "Export" to work with current file data
- [ ] Keep base64 import/export but mark as legacy
- [ ] Add save location picker for new ledgers

---

## Phase 4: Legacy Migration & Cleanup

### 4.1 Data Migration (Optional - keep for compatibility)
- [ ] Create one-time migration utility for existing localStorage data
- [ ] Prompt users to migrate legacy ledgers to .budgie files
- [ ] Provide migration wizard UI
- [ ] Clean up migrated localStorage data

### 4.2 Code Cleanup
- [ ] Remove redundant storage logic from existing components
- [ ] Remove complex metadata calculation code
- [ ] Clean up transaction-manager.js or repurpose for compatibility
- [ ] Remove auto-save timers and related logic
- [ ] Update component exports and dependencies

---

## Phase 5: Advanced Features

### 5.1 Changelog Viewer
- [ ] Create changelog history UI panel
- [ ] Add command search and filtering
- [ ] Show detailed command information
- [ ] Add timeline view for changes

### 5.2 Conflict Detection (Future Multi-Device)
- [ ] Implement timestamp-based conflict detection
- [ ] Add manual conflict resolution UI
- [ ] Prepare infrastructure for vector clock merging
- [ ] Add device identification for commands

### 5.3 Performance Optimization
- [ ] Implement lazy loading for large changelog files
- [ ] Add command pagination for UI display
- [ ] Optimize registry cache refresh
- [ ] Add background file system operations

---

## Phase 6: Testing & Validation

### 6.1 Core Functionality Testing
- [ ] Test new ledger creation flow
- [ ] Test file save/load operations
- [ ] Test undo/redo functionality across all command types
- [ ] Test registry cache performance

### 6.2 File System Integration Testing
- [ ] Test File System Access API across browsers
- [ ] Test fallback behavior for unsupported browsers
- [ ] Test network drive compatibility
- [ ] Test file corruption recovery

### 6.3 Edge Cases & Error Handling
- [ ] Test save location cancellation
- [ ] Test file permission errors
- [ ] Test network connectivity issues
- [ ] Test large changelog file performance
- [ ] Test browser storage migration

---

## Technical Specifications

### File Formats

#### .budgie File Structure:
```json
{
  "fileId": "f7a8b9c0d1e2f3g4",
  "version": "2.0.0",
  "metadata": {
    "title": "June 2025 Budget",
    "created": "2025-09-08T10:00:00Z",
    "lastModified": "2025-09-08T14:30:00Z",
    "lastSavedBy": "user_device_id"
  },
  "data": {
    "startingBalance": 2930.00,
    "startingDate": "2025-06-01",
    "transactions": [...]
  }
}
```

#### .budgie.changelog File Structure:
```json
{
  "fileId": "f7a8b9c0d1e2f3g4",
  "version": "2.0.0",
  "deviceId": "user_device_abc123",
  "commands": [
    {
      "id": "cmd_1725801234567_001",
      "sequence": 1,
      "timestamp": "2025-09-08T14:30:45.123Z",
      "type": "transaction_add",
      "description": "Added grocery expense",
      "data": { "transaction": {...} },
      "undoData": null
    }
  ]
}
```

#### Registry Cache Structure:
```json
{
  "lastUpdated": "2025-09-08T14:30:00Z",
  "ledgers": [
    {
      "fileId": "f7a8b9c0d1e2f3g4",
      "title": "June 2025 Budget",
      "filePath": "/network/drive/f7a8b9c0d1e2f3g4.budgie",
      "lastAccessed": "2025-09-08T14:30:00Z",
      "summary": {
        "transactionCount": 32,
        "currentBalance": 17772.00,
        "dateRange": ["2025-06-01", "2025-06-30"]
      },
      "status": "synced"
    }
  ]
}
```

---

## Success Criteria

### Functionality
- ✅ All existing features work with file-based storage
- ✅ Undo/redo works for all user actions
- ✅ File operations work on network drives
- ✅ Welcome screen loads quickly from cache
- ✅ No data loss during migration

### Performance  
- ✅ App startup < 2 seconds
- ✅ Welcome screen loads < 500ms
- ✅ File save/load operations < 1 second
- ✅ Undo/redo response < 100ms
- ✅ Registry cache refresh < 5 seconds

### Code Quality
- ✅ ~60% reduction in storage-related code
- ✅ Clear separation between file operations and UI
- ✅ No redundant data synchronization logic
- ✅ Comprehensive error handling
- ✅ Maintainable component architecture

---

## Completion Checklist

- [ ] All Phase 1 tasks completed
- [ ] All Phase 2 tasks completed  
- [ ] All Phase 3 tasks completed
- [ ] All Phase 4 tasks completed
- [ ] All Phase 5 tasks completed
- [ ] All Phase 6 tasks completed
- [ ] Success criteria met
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Ready for merge to main branch

---

## Notes
- Keep base64 import/export functionality for compatibility
- Maintain infinite changelog retention (no purging)
- File naming: `{fileId}.budgie` and `{fileId}.budgie.changelog`
- Always prompt for save location immediately after ledger creation
- Remove "Browse All" functionality as unnecessary complexity