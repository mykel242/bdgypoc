// Balance Debug Helper
// Add this to console to debug balance calculation discrepancies

window.debugBalanceCalculation = function(ledgerName) {
    if (!window.TransactionManager) {
        console.log('TransactionManager not available');
        return;
    }
    
    console.log('=== BALANCE DEBUG FOR:', ledgerName || 'Current Active Ledger', '===');
    
    // Get the active ledger or set it
    const currentActive = window.TransactionManager.getActiveLedger();
    if (ledgerName && currentActive !== ledgerName) {
        window.TransactionManager.setActiveLedger(ledgerName);
    }
    
    // Get data from TransactionManager
    const transactions = window.TransactionManager.getTransactions() || [];
    const startingBalance = window.TransactionManager.getStartingBalance() || 0;
    
    console.log('Starting Balance:', startingBalance);
    console.log('Transaction Count:', transactions.length);
    
    // Calculate using both methods
    console.log('\n--- METHOD 1: Registry Method (totalCredits - totalDebits) ---');
    let totalCredits = 0;
    let totalDebits = 0;
    
    transactions.forEach((txn, index) => {
        const credit = txn.credit || 0;
        const debit = txn.debit || 0;
        totalCredits += credit;
        totalDebits += debit;
        
        if (index < 5) { // Show first 5 transactions for debugging
            console.log(`Transaction ${index + 1}:`, {
                date: txn.date,
                description: txn.description,
                credit: credit,
                debit: debit
            });
        }
    });
    
    const method1Balance = startingBalance + totalCredits - totalDebits;
    console.log('Total Credits:', totalCredits);
    console.log('Total Debits:', totalDebits);
    console.log('Method 1 Final Balance:', method1Balance);
    
    console.log('\n--- METHOD 2: Running Balance (like ledger view) ---');
    let runningBalance = startingBalance;
    
    transactions.forEach((txn, index) => {
        const credit = txn.credit || 0;
        const debit = txn.debit || 0;
        runningBalance += credit - debit;
        
        if (index < 5) { // Show first 5 for debugging
            console.log(`After Transaction ${index + 1}:`, runningBalance.toFixed(2));
        }
    });
    
    console.log('Method 2 Final Balance:', runningBalance);
    
    console.log('\n--- COMPARISON ---');
    console.log('Method 1 (Registry):', method1Balance.toFixed(2));
    console.log('Method 2 (Running):', runningBalance.toFixed(2));
    console.log('Difference:', (method1Balance - runningBalance).toFixed(2));
    
    if (Math.abs(method1Balance - runningBalance) > 0.01) {
        console.warn('⚠️  DISCREPANCY DETECTED!');
        
        // Check for common issues
        let nullCredits = 0;
        let nullDebits = 0;
        let stringValues = 0;
        
        transactions.forEach(txn => {
            if (txn.credit === null || txn.credit === undefined) nullCredits++;
            if (txn.debit === null || txn.debit === undefined) nullDebits++;
            if (typeof txn.credit === 'string' || typeof txn.debit === 'string') stringValues++;
        });
        
        console.log('Potential Issues:');
        console.log('- Null credits:', nullCredits);
        console.log('- Null debits:', nullDebits);
        console.log('- String values:', stringValues);
    } else {
        console.log('✅ Calculations match!');
    }
    
    // Check what's actually displayed in the DOM
    console.log('\n--- DOM INSPECTION ---');
    const recentLedgerItems = document.querySelectorAll('.recent-ledger-item');
    recentLedgerItems.forEach(item => {
        const titleEl = item.querySelector('.recent-ledger-name');
        const balanceEl = item.querySelector('.recent-ledger-balance');
        
        if (titleEl && titleEl.textContent === (ledgerName || currentActive)) {
            console.log('DOM shows:', balanceEl ? balanceEl.textContent : 'No balance element');
        }
    });
    
    // Restore original active ledger
    if (ledgerName && currentActive && currentActive !== ledgerName) {
        window.TransactionManager.setActiveLedger(currentActive);
    }
    
    console.log('=== DEBUG COMPLETE ===');
};

console.log('Balance debug helper loaded. Use: debugBalanceCalculation("March 2025")');
// Quick balance check for imported ledger
window.checkImportedLedgerBalance = function() {
    if (!window.TransactionManager) return;
    
    const ledgers = window.TransactionManager.getLedgers() || [];
    console.log('Available ledgers:', ledgers);
    
    ledgers.forEach(ledgerName => {
        const currentActive = window.TransactionManager.getActiveLedger();
        window.TransactionManager.setActiveLedger(ledgerName);
        
        const transactions = window.TransactionManager.getTransactions() || [];
        const startingBalance = window.TransactionManager.getStartingBalance() || 0;
        
        let totalCredits = 0, totalDebits = 0;
        transactions.forEach(t => {
            totalCredits += t.debit || 0;  // NOTE: Check if this is backwards!
            totalDebits += t.credit || 0;   // NOTE: Check if this is backwards!
        });
        
        console.log(ledgerName + ':');
        console.log('  Starting:', startingBalance);
        console.log('  Credits:', totalCredits);
        console.log('  Debits:', totalDebits);
        console.log('  Balance should be:', startingBalance + totalCredits - totalDebits);
        
        if (currentActive) window.TransactionManager.setActiveLedger(currentActive);
    });
};
console.log('Use: checkImportedLedgerBalance()');
