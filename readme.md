# Budgie: Personal Finance Ledger Application

Budgie is a client-side web application for personal finance tracking that allows users to manage multiple ledgers, record financial transactions, and track balances. The application uses a table-based UI to represent financial transactions in a traditional ledger format.

## Application Overview

### Core Features
- Multiple ledger management (create, rename, delete, import/export)
- Transaction tracking with credit and debit entries
- Starting balance management
- Balance calculation and real-time updates
- Transaction sorting/reordering via drag-and-drop
- Paid and cleared status tracking for transactions
- Print functionality for ledger reports

### Architecture and Organization

The application follows a modular architecture with distinct responsibilities split across different JavaScript files. It uses browser localStorage for data persistence and modern JavaScript features for UI interactions.

## Code Organization

### Core Modules

1. **Transaction Manager** (`transaction-manager.js`)
   - Core data management service
   - Handles localStorage operations for all application data
   - Manages multiple ledger operations (CRUD)
   - Transaction operations (add, update, delete, reorder)
   - Import/export functionality

2. **Ledger Controller** (`ledger-controller.js`)
   - Main controller for transaction table operations
   - Event handling for user interactions
   - Balance calculation and display
   - Input validation and formatting
   - Visual cues for transaction status

3. **Ledger Renderer** (`ledger-renderer.js`)
   - Creates and updates DOM elements for the ledger table
   - Renders transaction rows
   - Refreshes the ledger display when data changes

4. **Ledger Selection** (`ledger-selection.js`)
   - Handles row selection UI
   - Implements drag-and-drop functionality for reordering
   - Visual feedback during drag operations

5. **Ledger Manager** (`ledger-management.js`)
   - UI management for ledger operations
   - Ledger selector dropdown control
   - Import/export functionality
   - Print functionality

### UI Components

1. **Main HTML Structure** (`index.html`)
   - Defines the main application layout
   - Contains the table structure for the ledger
   - Includes header with ledger selection and action buttons

2. **Styling** (Multiple CSS files)
   - `styles.css`: Base styling for the transaction table
   - `enhanced-styles.css`: Advanced styling for transaction rows and status indicators
   - `ledger-management-styles.css`: Styles for ledger management UI components

### Initialization Flow

The application follows this initialization sequence:
1. DOM content loads, triggering script.js
2. LedgerManager initializes first (handles ledger selection)
3. LedgerController initializes (manages transaction display and interaction)
4. LedgerSelection initializes (handles row selection functionality)

### Data Storage Model

The app uses localStorage with structured key patterns to store:
- List of all available ledgers
- Active ledger reference
- Transactions for each ledger
- Starting balance for each ledger
- Starting balance date for each ledger

### Interactions and Event Flow

The application relies heavily on event listeners to respond to user actions. Key events include:
- Input changes in transaction fields
- Checkbox toggles for paid/cleared status
- Selection of transactions
- Drag-and-drop for reordering
- Button clicks for ledger operations

### User Interface Design

The UI is centered around a table-based ledger view with:
- Header with ledger selection and management buttons
- Starting balance row (editable)
- Transaction rows with date, description, credit/debit, and status
- Input validation and visual feedback
- Running balance calculation
- Totals row showing summary values

This modular organization allows the application to maintain clear separation of concerns while providing a seamless user experience for managing personal finances across multiple ledgers.
