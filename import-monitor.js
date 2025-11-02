// Import Balance Monitor
// Monitors balance calculations during import process to catch temporary display issues

window.ImportMonitor = {
    isMonitoring: false,
    monitorInterval: null,
    snapshots: [],
    
    startMonitoring() {
        console.log('🔍 Starting import balance monitor...');
        console.log('This will track balance calculations every 500ms during import');
        
        this.isMonitoring = true;
        this.snapshots = [];
        
        this.monitorInterval = setInterval(() => {
            this.takeSnapshot();
        }, 500);
        
        console.log('Monitor started. Import a ledger now, then call ImportMonitor.stopMonitoring()');
    },
    
    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        
        this.isMonitoring = false;
        console.log('🛑 Monitoring stopped.');
        console.log('Total snapshots captured:', this.snapshots.length);
        
        this.analyzeSnapshots();
    },
    
    takeSnapshot() {
        if (!window.TransactionManager) return;
        
        const ledgers = window.TransactionManager.getLedgers() || [];
        const snapshot = {
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString(),
            ledgerCount: ledgers.length,
            ledgers: {}
        };
        
        // Capture balance data for each ledger
        ledgers.forEach(ledgerName => {
            try {
                const currentActive = window.TransactionManager.getActiveLedger();
                window.TransactionManager.setActiveLedger(ledgerName);
                
                const transactions = window.TransactionManager.getTransactions() || [];
                const startingBalance = window.TransactionManager.getStartingBalance() || 0;
                
                let totalCredits = 0, totalDebits = 0;
                transactions.forEach(t => {
                    totalCredits += t.credit || 0;
                    totalDebits += t.debit || 0;
                });
                
                const calculatedBalance = startingBalance + totalCredits - totalDebits;
                
                snapshot.ledgers[ledgerName] = {
                    startingBalance,
                    transactionCount: transactions.length,
                    totalCredits,
                    totalDebits,
                    calculatedBalance: Math.round(calculatedBalance * 100) / 100
                };
                
                // Restore active ledger
                if (currentActive) {
                    window.TransactionManager.setActiveLedger(currentActive);
                }
                
            } catch (error) {
                snapshot.ledgers[ledgerName] = { error: error.message };
            }
        });
        
        // Also capture what's displayed in the UI
        snapshot.uiBalances = {};
        const recentItems = document.querySelectorAll('.recent-ledger-item');
        recentItems.forEach(item => {
            const nameEl = item.querySelector('.recent-ledger-name');
            const balanceEl = item.querySelector('.recent-ledger-balance');
            
            if (nameEl && balanceEl) {
                const name = nameEl.textContent;
                const displayedBalance = balanceEl.textContent;
                snapshot.uiBalances[name] = displayedBalance;
            }
        });
        
        this.snapshots.push(snapshot);
    },
    
    analyzeSnapshots() {
        console.log('\n=== IMPORT MONITORING ANALYSIS ===');
        
        if (this.snapshots.length === 0) {
            console.log('No snapshots captured');
            return;
        }
        
        // Find newly added ledgers
        const firstSnapshot = this.snapshots[0];
        const lastSnapshot = this.snapshots[this.snapshots.length - 1];
        
        const initialLedgers = Object.keys(firstSnapshot.ledgers);
        const finalLedgers = Object.keys(lastSnapshot.ledgers);
        const newLedgers = finalLedgers.filter(name => !initialLedgers.includes(name));
        
        console.log('Initial ledgers:', initialLedgers);
        console.log('Final ledgers:', finalLedgers);
        console.log('New ledgers detected:', newLedgers);
        
        // Track balance changes for new ledgers
        newLedgers.forEach(ledgerName => {
            console.log(`\n--- Balance History for: ${ledgerName} ---`);
            
            const balanceHistory = [];
            const uiHistory = [];
            
            this.snapshots.forEach((snapshot, index) => {
                if (snapshot.ledgers[ledgerName]) {
                    const calc = snapshot.ledgers[ledgerName].calculatedBalance;
                    const ui = snapshot.uiBalances[ledgerName];
                    
                    if (calc !== undefined) {
                        balanceHistory.push({ time: snapshot.time, calculated: calc });
                    }
                    
                    if (ui !== undefined) {
                        uiHistory.push({ time: snapshot.time, displayed: ui });
                    }
                }
            });
            
            console.log('Calculated balance history:', balanceHistory);
            console.log('UI display history:', uiHistory);
            
            // Look for discrepancies
            const discrepancies = [];
            this.snapshots.forEach(snapshot => {
                const calc = snapshot.ledgers[ledgerName]?.calculatedBalance;
                const ui = snapshot.uiBalances[ledgerName];
                
                if (calc !== undefined && ui !== undefined) {
                    // Parse UI balance (remove + and $ symbols)
                    const uiNumber = parseFloat(ui.replace(/[+\-$,]/g, ''));
                    const uiSign = ui.includes('-') ? -1 : 1;
                    const actualUIBalance = uiNumber * uiSign;
                    
                    if (Math.abs(calc - actualUIBalance) > 0.01) {
                        discrepancies.push({
                            time: snapshot.time,
                            calculated: calc,
                            displayed: actualUIBalance,
                            difference: calc - actualUIBalance
                        });
                    }
                }
            });
            
            if (discrepancies.length > 0) {
                console.warn('⚠️  DISCREPANCIES FOUND:');
                discrepancies.forEach(d => {
                    console.log(`${d.time}: Calc=${d.calculated}, UI=${d.displayed}, Diff=${d.difference}`);
                });
            } else {
                console.log('✅ No discrepancies found');
            }
        });
    }
};

console.log('Import Monitor loaded. Use:');
console.log('  ImportMonitor.startMonitoring() - before importing');
console.log('  ImportMonitor.stopMonitoring() - after import completes');