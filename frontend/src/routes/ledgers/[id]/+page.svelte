<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { authStore } from '$lib/stores/auth';
	import { transactionStore } from '$lib/stores/transactionStore';
	import { ledgerStore } from '$lib/stores/ledgerStore';
	import { ledgers as ledgersApi, type Ledger, type Transaction } from '$lib/api';

	let isExporting = false;
	let showMenu = false;
	let isEditingName = false;
	let editedName = '';

	let ledger: Ledger | null = null;
	let ledgerId: number;
	let startingBalance = 0;
	let startingBalanceDate = new Date().toISOString().split('T')[0];
	let isLedgerLoading = true;
	let error = '';

	// New transaction row data
	let newDate = new Date().toISOString().split('T')[0];
	let newDescription = '';
	let newAmount = ''; // positive = credit, negative = debit

	// Selection state for cell-level editing
	let selectedRowId: number | null = null;
	let selectedCell: string | null = null; // 'date', 'description', 'credit', 'debit', 'paid', 'cleared'

	// Row action menu state (desktop)
	let rowMenuId: number | null = null;

	function toggleRowMenu(id: number) {
		rowMenuId = rowMenuId === id ? null : id;
	}

	// Mobile row action menu state
	let mobileRowMenuId: number | null = null;

	function toggleMobileRowMenu(id: number) {
		mobileRowMenuId = mobileRowMenuId === id ? null : id;
	}

	// Mobile expanded rows state
	let expandedRowId: number | null = null;

	// Add transaction row state
	let isAddingTransaction = false;

	function toggleExpandRow(id: number) {
		expandedRowId = expandedRowId === id ? null : id;
	}

	// Native drag and drop state
	let draggedIndex: number | null = null;
	let dragOverIndex: number | null = null;

	function handleDragStart(e: DragEvent, index: number) {
		draggedIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	async function handleDrop(e: DragEvent, index: number) {
		e.preventDefault();
		if (draggedIndex !== null && draggedIndex !== index) {
			try {
				await transactionStore.reorderTransactions(draggedIndex, index);
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to reorder transactions';
			}
		}
		draggedIndex = null;
		dragOverIndex = null;
	}

	function selectCell(rowId: number, cell: string) {
		selectedRowId = rowId;
		selectedCell = cell;
	}

	function clearSelection() {
		selectedRowId = null;
		selectedCell = null;
		showMenu = false;
		rowMenuId = null;
		mobileRowMenuId = null;
		// Only close add row if empty
		if (!newDescription.trim() && !newAmount) {
			isAddingTransaction = false;
		}
	}

	function isEditing(rowId: number, cell: string): boolean {
		return selectedRowId === rowId && selectedCell === cell;
	}

	// Formatting helpers (defined before reactive statements that use them)
	function formatCurrency(amount: number | string): string {
		const num = typeof amount === 'string' ? parseFloat(amount) : amount;
		return Math.round(num || 0).toString();
	}

	function formatAmount(credit: number | string, debit: number | string): { text: string; isDebit: boolean } {
		const creditNum = typeof credit === 'string' ? parseFloat(credit) : credit;
		const debitNum = typeof debit === 'string' ? parseFloat(debit) : debit;

		if (debitNum && debitNum > 0) {
			return { text: Math.round(debitNum).toString(), isDebit: true };
		}
		if (creditNum && creditNum > 0) {
			return { text: Math.round(creditNum).toString(), isDebit: false };
		}
		return { text: '', isDebit: false };
	}

	function formatDebit(amount: number | string): string {
		const num = typeof amount === 'string' ? parseFloat(amount) : amount;
		if (!num || num <= 0) return '';
		return `(${Math.round(num)})`;
	}

	function formatBalance(amount: number | string): { text: string; isNegative: boolean } {
		const num = typeof amount === 'string' ? parseFloat(amount) : amount;
		const val = num || 0;
		if (val < 0) {
			return { text: `$${Math.round(Math.abs(val))}`, isNegative: true };
		}
		return { text: `$${Math.round(val)}`, isNegative: false };
	}

	function formatShortDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatDisplayDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Get transaction status: 'none' | 'paid' | 'cleared'
	function getTransactionStatus(transaction: Transaction): 'none' | 'paid' | 'cleared' {
		if (transaction.is_cleared) return 'cleared';
		if (transaction.is_paid) return 'paid';
		return 'none';
	}

	// Cycle through status: none -> paid -> cleared -> none
	async function handleCycleStatus(transaction: Transaction) {
		const status = getTransactionStatus(transaction);
		try {
			if (status === 'none') {
				// none -> paid
				await transactionStore.togglePaid(transaction.id);
			} else if (status === 'paid') {
				// paid -> cleared
				await transactionStore.toggleCleared(transaction.id);
			} else {
				// cleared -> none (unset both)
				await transactionStore.toggleCleared(transaction.id);
				await transactionStore.togglePaid(transaction.id);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update status';
		}
	}

	// Computed values
	$: totalCredit = $transactionStore.transactions.reduce((sum, t) => sum + (parseFloat(t.credit_amount.toString()) || 0), 0);
	$: totalDebit = $transactionStore.transactions.reduce((sum, t) => sum + (parseFloat(t.debit_amount.toString()) || 0), 0);
	$: netAmount = totalCredit - totalDebit;
	$: finalBalance = startingBalance + totalCredit - totalDebit;
	$: finalBalanceFormatted = formatBalance(finalBalance);

	// Calculate running balances
	$: transactionsWithBalance = $transactionStore.transactions.reduce((acc, t, index) => {
		const previousBalance = index === 0
			? startingBalance
			: acc[index - 1].runningBalance;
		const credit = parseFloat(t.credit_amount.toString()) || 0;
		const debit = parseFloat(t.debit_amount.toString()) || 0;
		acc.push({
			...t,
			runningBalance: previousBalance + credit - debit,
		});
		return acc;
	}, [] as Array<Transaction & { runningBalance: number }>);

	onMount(() => {
		// Check auth
		const unsubAuth = authStore.subscribe(state => {
			if (!state.isAuthenticated && !state.isLoading) {
				goto(`${base}/login?returnUrl=${base}/ledgers/${$page.params.id}`);
			}
		});

		// Parse ledger ID
		ledgerId = parseInt($page.params.id);
		if (isNaN(ledgerId)) {
			error = 'Invalid ledger ID';
			isLedgerLoading = false;
			return unsubAuth;
		}

		// Load ledger and transactions
		(async () => {
			try {
				const ledgerResponse = await ledgersApi.get(ledgerId);
				ledger = ledgerResponse.ledger;
				startingBalance = parseFloat(ledger.starting_balance.toString()) || 0;
				startingBalanceDate = ledger.starting_balance_date || new Date().toISOString().split('T')[0];

				await transactionStore.loadTransactions(ledgerId);
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to load ledger';
			} finally {
				isLedgerLoading = false;
			}
		})();

		return unsubAuth;
	});

	onDestroy(() => {
		transactionStore.clear();
	});

	async function handleStartingBalanceChange(value: string) {
		if (!ledger) return;
		const newBalance = parseFloat(value) || 0;
		startingBalance = newBalance;
		try {
			await ledgersApi.update(ledger.id, { starting_balance: newBalance });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update starting balance';
		}
	}

	async function handleStartingDateChange(value: string) {
		if (!ledger) return;
		startingBalanceDate = value;
		try {
			await ledgersApi.update(ledger.id, { starting_balance_date: value });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update starting balance date';
		}
	}

	async function handleAddTransaction() {
		if (!newDescription.trim() || !newAmount) return;

		const amountVal = Math.round(parseFloat(newAmount) || 0);
		try {
			await transactionStore.createTransaction({
				ledger_id: ledgerId,
				date: newDate,
				description: newDescription.trim(),
				credit_amount: amountVal >= 0 ? amountVal : 0,
				debit_amount: amountVal < 0 ? Math.abs(amountVal) : 0,
				is_paid: false,
				is_cleared: false,
			});

			// Clear form and close add row
			newDate = new Date().toISOString().split('T')[0];
			newDescription = '';
			newAmount = '';
			isAddingTransaction = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add transaction';
		}
	}

	async function handleUpdateTransaction(transaction: Transaction, field: string, value: any) {
		try {
			await transactionStore.updateTransaction(transaction.id, { [field]: value });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update transaction';
		}
	}

	async function handleDeleteTransaction(id: number) {
		if (!confirm('Delete this transaction?')) return;
		try {
			await transactionStore.deleteTransaction(id);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete transaction';
		}
	}

	async function handleTogglePaid(id: number) {
		try {
			await transactionStore.togglePaid(id);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to toggle paid status';
		}
	}

	async function handleToggleCleared(id: number) {
		try {
			// Find the transaction to check current state
			const transaction = $transactionStore.transactions.find(t => t.id === id);
			if (transaction && !transaction.is_cleared && !transaction.is_paid) {
				// If marking as cleared and not already paid, set paid first
				await transactionStore.togglePaid(id);
			}
			await transactionStore.toggleCleared(id);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to toggle cleared status';
		}
	}


	async function handleExport() {
		if (!ledger) return;
		isExporting = true;
		try {
			const response = await ledgersApi.export(ledger.id);

			// Create a blob and download it
			const blob = new Blob([response.data], { type: 'text/plain' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = response.filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to export ledger';
		} finally {
			isExporting = false;
		}
	}

	function handleEditName() {
		if (!ledger) return;
		editedName = ledger.name;
		isEditingName = true;
		showMenu = false;
	}

	async function handleSaveName() {
		if (!ledger || !editedName.trim()) return;
		try {
			await ledgersApi.update(ledger.id, { name: editedName.trim() });
			ledger = { ...ledger, name: editedName.trim() };
			isEditingName = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update ledger name';
		}
	}

	function handleCancelEditName() {
		isEditingName = false;
		editedName = '';
	}

	async function handleToggleLock() {
		if (!ledger) return;
		showMenu = false;
		try {
			await ledgerStore.toggleLock(ledger.id, ledger.is_locked);
			ledger = { ...ledger, is_locked: !ledger.is_locked };
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to toggle lock status';
		}
	}

	async function handleToggleArchive() {
		if (!ledger) return;
		showMenu = false;
		try {
			await ledgerStore.toggleArchive(ledger.id, ledger.is_archived);
			ledger = { ...ledger, is_archived: !ledger.is_archived };
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to toggle archive status';
		}
	}

	async function handleDeleteLedger() {
		if (!ledger) return;
		if (!confirm(`Are you sure you want to delete '${ledger.name}'? This action cannot be undone and will delete all associated transactions.`)) return;
		showMenu = false;
		try {
			await ledgerStore.deleteLedger(ledger.id);
			goto(`${base}/ledgers`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete ledger';
		}
	}

	function toggleMenu() {
		showMenu = !showMenu;
	}

	function closeMenu() {
		showMenu = false;
	}
</script>

<style>
	/* Hide spinner controls on number inputs */
	input[type="number"]::-webkit-outer-spin-button,
	input[type="number"]::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input[type="number"] {
		-moz-appearance: textfield;
	}

	/* Custom checkbox styling for better visibility */
	input[type="checkbox"] {
		appearance: none;
		-webkit-appearance: none;
		background-color: white;
		border: 2px solid #d1d5db;
		border-radius: 4px;
		display: inline-block;
		position: relative;
		cursor: pointer;
	}

	input[type="checkbox"]:checked {
		background-color: #2563eb;
		border-color: #2563eb;
	}

	input[type="checkbox"]:checked::after {
		content: '';
		position: absolute;
		left: 5px;
		top: 2px;
		width: 5px;
		height: 10px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	input[type="checkbox"]:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.5);
	}

	input[type="checkbox"]:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	/* Monospace font for numbers */
	.amount-cell, .balance-cell {
		font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}

	/* Debit styling with parentheses outside flow */
	.debit-wrapper {
		position: relative;
		display: inline-block;
		color: #dc2626; /* red-600 */
	}
	.debit-wrapper::before {
		content: '(';
		color: #dc2626;
		margin-right: -0.1em;
	}
	.debit-wrapper::after {
		content: ')';
		color: #dc2626;
		margin-left: -0.1em;
	}

</style>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4" on:click={clearSelection}>
	<div class="max-w-7xl mx-auto">
		{#if isLedgerLoading}
			<div class="flex justify-center items-center py-12">
				<svg class="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</div>
		{:else if error}
			<div class="bg-white rounded-lg shadow-xl p-6 mb-6">
				<div class="p-4 bg-red-50 border border-red-200 rounded-lg">
					<p class="text-red-700 text-sm">{error}</p>
				</div>
				<div class="mt-4">
					<a href="{base}/ledgers" class="text-blue-600 hover:text-blue-700 font-medium">
						← Back to Ledgers
					</a>
				</div>
			</div>
		{:else if ledger}
			<!-- Header -->
			<div class="bg-white rounded-lg shadow-xl p-3 sm:p-4 mb-4 sm:mb-6">
				<div class="flex items-center justify-between">
					<!-- Left: Close button -->
					<a
						href="{base}/ledgers"
						class="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						title="Close"
					>
						<svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</a>

					<!-- Center: Title with status icons -->
					<div class="flex-1 text-center min-w-0 px-2">
						{#if isEditingName}
							<div class="flex items-center justify-center gap-2">
								<input
									type="text"
									bind:value={editedName}
									on:blur={handleSaveName}
									on:keydown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelEditName(); }}
									class="text-base sm:text-xl font-bold text-gray-900 border border-blue-500 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs"
								/>
								<button on:click={handleSaveName} class="p-1 text-green-600 hover:text-green-700 flex-shrink-0">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
								</button>
								<button on:click={handleCancelEditName} class="p-1 text-gray-500 hover:text-gray-700 flex-shrink-0">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						{:else}
							<h1 class="text-base sm:text-xl font-bold text-gray-900 inline-flex items-center gap-1 sm:gap-2 truncate">
								<span class="truncate">{ledger.name}</span>
								{#if ledger.is_locked}
									<span class="text-yellow-600 flex-shrink-0" title="Locked">
										<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
										</svg>
									</span>
								{/if}
								{#if ledger.is_archived}
									<span class="text-gray-400 flex-shrink-0" title="Archived">
										<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
											<path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
											<path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd" />
										</svg>
									</span>
								{/if}
							</h1>
						{/if}
					</div>

					<!-- Right: Balance and Menu -->
					<div class="flex items-center gap-2 sm:gap-3">
						<div class="text-right">
							<p class="text-xs text-gray-500 hidden sm:block">Balance</p>
							<p class="text-base sm:text-xl font-bold text-blue-600">${formatCurrency(finalBalance)}</p>
						</div>

						<!-- Ellipsis Menu -->
						<div class="relative">
							<button
								on:click|stopPropagation={toggleMenu}
								class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
								title="More options"
							>
								<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
									<circle cx="12" cy="5" r="2" />
									<circle cx="12" cy="12" r="2" />
									<circle cx="12" cy="19" r="2" />
								</svg>
							</button>

							{#if showMenu}
								<div
									class="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
									on:click|stopPropagation
								>
									<button
										on:click={handleEditName}
										class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
										</svg>
										Rename
									</button>
									<button
										on:click={() => { handleExport(); showMenu = false; }}
										disabled={isExporting}
										class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
										</svg>
										{isExporting ? 'Exporting...' : 'Export'}
									</button>
									<hr class="my-1 border-gray-200" />
									<button
										on:click={handleToggleLock}
										class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
									>
										{#if ledger.is_locked}
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
											</svg>
											Unlock
										{:else}
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
											</svg>
											Lock
										{/if}
									</button>
									<button
										on:click={handleToggleArchive}
										class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
										</svg>
										{ledger.is_archived ? 'Unarchive' : 'Archive'}
									</button>
									<hr class="my-1 border-gray-200" />
									<button
										on:click={handleDeleteLedger}
										disabled={ledger.is_locked}
										class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
										Delete
									</button>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Mobile Transaction List -->
			<div class="sm:hidden bg-white rounded-lg shadow-xl overflow-auto max-h-[calc(100vh-10rem)]" on:click|stopPropagation>
				<!-- Starting Balance -->
				<div class="border-b border-gray-200 bg-gray-50 p-3">
					<div class="flex justify-between items-start">
						<div class="flex-1 min-w-0">
							<div class="text-gray-600">Starting Balance</div>
							<div class="text-xs text-gray-500">{formatShortDate(startingBalanceDate)}</div>
						</div>
						<div class="text-right font-mono font-medium">
							${Math.round(startingBalance)}
						</div>
					</div>
				</div>

				<!-- Transaction Rows -->
				<div>
					{#each transactionsWithBalance as transaction, index (transaction.id)}
						{@const balance = formatBalance(transaction.runningBalance)}
						{@const amount = formatAmount(transaction.credit_amount, transaction.debit_amount)}
						{@const runningBal = typeof transaction.runningBalance === 'string' ? parseFloat(transaction.runningBalance) : transaction.runningBalance}
						{@const isNegativeBalance = runningBal < 0}
						{@const isExpanded = expandedRowId === transaction.id}
						{@const status = getTransactionStatus(transaction)}
						<div
							class="border-b border-gray-200 {isNegativeBalance ? 'bg-red-50' : 'bg-white'}"
						>
							<div class="p-3" on:click={() => toggleExpandRow(transaction.id)}>
								<div class="flex justify-between items-start gap-2">
									<div class="flex-1 min-w-0">
										<div class="font-medium text-gray-900 truncate">{transaction.description}</div>
										<div class="text-xs text-gray-500">{formatShortDate(transaction.date)}</div>
									</div>
									<div class="flex items-center gap-2">
										<div class="text-right font-mono">
											{#if amount.text}
												{#if amount.isDebit}
													<span class="debit-wrapper">${amount.text}</span>
												{:else}
													${amount.text}
												{/if}
											{/if}
										</div>
										<button class="text-gray-400 p-1">
											<svg class="w-4 h-4 transition-transform {isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
											</svg>
										</button>
									</div>
								</div>
							</div>

							<!-- Expanded Details -->
							{#if isExpanded}
								<div class="px-3 pb-3 pt-1 border-t border-gray-100 bg-gray-50">
								<div class="flex justify-between items-center mb-3">
									<span class="text-xs text-gray-500">Balance:</span>
									<span class="font-mono font-medium {balance.isNegative ? 'text-red-600' : ''}">
										{#if balance.isNegative}
											<span class="debit-wrapper">{balance.text}</span>
										{:else}
											{balance.text}
										{/if}
									</span>
								</div>
								<div class="flex items-center justify-between">
									<!-- Status button (single cycling icon with label) -->
									<button
										on:click|stopPropagation={() => handleCycleStatus(transaction)}
										disabled={ledger.is_locked}
										class="flex items-center gap-2 px-3 py-1.5 rounded-lg {status === 'cleared' ? 'text-blue-600 bg-blue-50' : status === 'paid' ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100'} {!ledger.is_locked ? 'active:opacity-75' : ''} disabled:cursor-not-allowed"
									>
										{#if status === 'cleared'}
											<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
											</svg>
											<span class="text-sm font-medium">Cleared</span>
										{:else if status === 'paid'}
											<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
											</svg>
											<span class="text-sm font-medium">Paid</span>
										{:else}
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<circle cx="12" cy="12" r="9" stroke-width="2" />
											</svg>
											<span class="text-sm font-medium">Not paid</span>
										{/if}
									</button>
									<!-- Ellipsis menu -->
									{#if !ledger.is_locked}
										<div class="relative">
											<button
												on:click|stopPropagation={() => toggleMobileRowMenu(transaction.id)}
												class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
											>
												<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
													<circle cx="12" cy="5" r="2" />
													<circle cx="12" cy="12" r="2" />
													<circle cx="12" cy="19" r="2" />
												</svg>
											</button>
											{#if mobileRowMenuId === transaction.id}
												<div
													class="absolute right-0 bottom-full mb-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
													on:click|stopPropagation
												>
													<button
														on:click={() => { handleDeleteTransaction(transaction.id); mobileRowMenuId = null; }}
														class="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
													>
														<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
															<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
														</svg>
														Delete
													</button>
												</div>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						{/if}
						</div>
					{/each}
				</div>

				<!-- Add New Transaction (Mobile) -->
				{#if !ledger.is_locked}
					{#if isAddingTransaction}
						<div class="border-b-2 border-green-200 bg-green-50 p-3">
							<div class="flex gap-2 mb-2">
								<input
									type="text"
									bind:value={newDescription}
									placeholder="Description"
									class="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
								/>
								<input
									type="number"
									step="1"
									bind:value={newAmount}
									placeholder="+/-"
									class="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right font-mono"
								/>
							</div>
							<div class="flex gap-2 items-center">
								<input
									type="date"
									bind:value={newDate}
									class="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
								/>
								<button
									on:click={handleAddTransaction}
									disabled={!newDescription.trim() || !newAmount}
									class="px-4 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
								>
									Add
								</button>
							</div>
						</div>
					{:else}
						<div
							class="border-b border-gray-200 bg-white p-3 cursor-pointer active:bg-gray-50"
							on:click|stopPropagation={() => { isAddingTransaction = true; }}
						>
							<div class="flex items-center gap-2 text-gray-400 text-sm">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
								</svg>
								Add transaction...
							</div>
						</div>
					{/if}
				{/if}

				<!-- Balance (Mobile) - sticky at bottom -->
				<div class="bg-gray-100 p-3 font-bold sticky bottom-0 shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
					<div class="flex justify-between items-start">
						<span>Balance</span>
						<div class="flex items-center gap-2">
							<div class="text-right font-mono">
								{#if finalBalanceFormatted.isNegative}
									<span class="debit-wrapper">{finalBalanceFormatted.text}</span>
								{:else}
									{finalBalanceFormatted.text}
								{/if}
							</div>
							<!-- Spacer to align with chevron in rows above -->
							<div class="w-4 p-1"></div>
						</div>
					</div>
				</div>
			</div>

			<!-- Transaction Table (Desktop) -->
			<div class="hidden sm:block bg-white rounded-lg shadow-xl overflow-auto max-h-[calc(100vh-12rem)]" on:click|stopPropagation>
				<table class="w-full">
					<thead class="bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10">
						<tr>
							<th class="w-8 px-2 py-3"></th><!-- Drag handle column -->
							<th class="w-24 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
							<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
							<th class="w-10 px-2 py-3"></th><!-- Status column -->
							<th class="w-28 px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
							<th class="w-28 px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
							<th class="w-10 px-2 py-3"></th><!-- Row menu column -->
						</tr>
					</thead>
					<tbody>
						<!-- Starting Balance Row -->
						<tr
							class="border-b border-gray-200 bg-gray-50 {selectedRowId === 0 ? 'bg-blue-50' : ''} hover:bg-gray-100"
							on:click={() => { selectedRowId = 0; }}
						>
							<td class="px-2 py-3"></td><!-- Empty drag handle cell -->
							<!-- Date -->
							<td class="px-2 py-3 cursor-pointer" on:click|stopPropagation={() => { selectedRowId = 0; selectedCell = 'date'; }}>
								{#if selectedRowId === 0 && selectedCell === 'date' && !ledger.is_locked}
									<input
										type="date"
										value={startingBalanceDate}
										on:blur={(e) => { handleStartingDateChange(e.currentTarget.value); selectedCell = null; }}
										on:keydown={(e) => e.key === 'Escape' && (selectedCell = null)}
										class="w-full px-1 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								{:else}
									<span class="block px-1 py-1 text-sm text-gray-600 {!ledger.is_locked ? 'hover:bg-gray-200 rounded' : ''}">
										{formatDisplayDate(startingBalanceDate)}
									</span>
								{/if}
							</td>
							<!-- Description -->
							<td class="px-3 py-3 text-gray-600">Starting Balance</td>
							<!-- Status (empty for starting balance) -->
							<td class="px-2 py-3"></td>
							<!-- Amount -->
							<td class="px-3 py-3 text-right amount-cell cursor-pointer" on:click|stopPropagation={() => { selectedRowId = 0; selectedCell = 'amount'; }}>
								{#if selectedRowId === 0 && selectedCell === 'amount' && !ledger.is_locked}
									<input
										type="number"
										step="1"
										value={Math.round(startingBalance)}
										on:blur={(e) => { handleStartingBalanceChange(e.currentTarget.value); selectedCell = null; }}
										on:keydown={(e) => { if (e.key === 'Escape') selectedCell = null; if (e.key === 'Enter') { handleStartingBalanceChange(e.currentTarget.value); selectedCell = null; } }}
										class="w-20 px-2 py-1 border border-blue-500 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
									/>
								{:else}
									<span class="block px-1 py-1 text-right {!ledger.is_locked ? 'hover:bg-gray-200 rounded' : ''}">
										${Math.round(startingBalance)}
									</span>
								{/if}
							</td>
							<!-- Balance -->
							<td class="px-3 py-3 text-right balance-cell font-medium">${Math.round(startingBalance)}</td>
							<td class="px-2 py-3"></td><!-- Menu -->
						</tr>

						<!-- Transaction Rows -->
						{#each transactionsWithBalance as transaction, index (transaction.id)}
							{@const balance = formatBalance(transaction.runningBalance)}
							{@const amount = formatAmount(transaction.credit_amount, transaction.debit_amount)}
							{@const runningBal = typeof transaction.runningBalance === 'string' ? parseFloat(transaction.runningBalance) : transaction.runningBalance}
							{@const isNegativeBalance = runningBal < 0}
							{@const status = getTransactionStatus(transaction)}
							<tr
								class="border-b border-gray-200 {selectedRowId === transaction.id ? 'bg-blue-50' : isNegativeBalance ? 'bg-red-50' : 'bg-white'} {selectedRowId !== transaction.id ? 'hover:bg-gray-100' : ''} {draggedIndex === index ? 'opacity-50' : ''} {dragOverIndex === index ? 'border-t-2 border-t-blue-500' : ''}"
								on:click={() => { selectedRowId = transaction.id; }}
								on:dragover={(e) => handleDragOver(e, index)}
								on:dragleave={handleDragLeave}
								on:drop={(e) => handleDrop(e, index)}
							>
								<!-- Drag Handle -->
								<td
									class="px-2 py-3 cursor-grab text-gray-300 hover:text-gray-500 {ledger?.is_locked ? 'cursor-not-allowed opacity-50' : ''}"
									draggable={!ledger?.is_locked}
									on:dragstart={(e) => handleDragStart(e, index)}
									on:dragend={handleDragEnd}
								>
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
										<circle cx="9" cy="6" r="1.5" />
										<circle cx="15" cy="6" r="1.5" />
										<circle cx="9" cy="12" r="1.5" />
										<circle cx="15" cy="12" r="1.5" />
										<circle cx="9" cy="18" r="1.5" />
										<circle cx="15" cy="18" r="1.5" />
									</svg>
								</td>
								<!-- Date -->
								<td class="px-2 py-3 cursor-pointer" on:click|stopPropagation={() => { selectedRowId = transaction.id; selectedCell = 'date'; }}>
									{#if selectedRowId === transaction.id && selectedCell === 'date' && !ledger.is_locked}
										<input
											type="date"
											value={transaction.date}
											on:blur={(e) => { handleUpdateTransaction(transaction, 'date', e.currentTarget.value); selectedCell = null; }}
											on:keydown={(e) => e.key === 'Escape' && (selectedCell = null)}
											class="w-full px-1 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									{:else}
										<span class="block px-1 py-1 text-sm {!ledger.is_locked ? 'hover:bg-gray-200 rounded' : ''}">
											{formatDisplayDate(transaction.date)}
										</span>
									{/if}
								</td>
								<!-- Description -->
								<td class="px-3 py-3 cursor-pointer" on:click|stopPropagation={() => { selectedRowId = transaction.id; selectedCell = 'description'; }}>
									{#if selectedRowId === transaction.id && selectedCell === 'description' && !ledger.is_locked}
										<input
											type="text"
											value={transaction.description}
											on:blur={(e) => { handleUpdateTransaction(transaction, 'description', e.currentTarget.value); selectedCell = null; }}
											on:keydown={(e) => { if (e.key === 'Escape') selectedCell = null; if (e.key === 'Enter') { handleUpdateTransaction(transaction, 'description', e.currentTarget.value); selectedCell = null; } }}
											class="w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									{:else}
										<span class="block px-1 py-1 text-sm {!ledger.is_locked ? 'hover:bg-gray-200 rounded' : ''}">
											{transaction.description}
										</span>
									{/if}
								</td>
								<!-- Status (single cycling icon) -->
								<td class="px-2 py-3 text-center" on:click|stopPropagation>
									<button
										on:click={() => handleCycleStatus(transaction)}
										disabled={ledger.is_locked}
										class="p-1 rounded {!ledger.is_locked ? 'hover:bg-gray-200' : ''} disabled:cursor-not-allowed"
										title={status === 'cleared' ? 'Cleared' : status === 'paid' ? 'Paid' : 'Not paid'}
									>
										{#if status === 'cleared'}
											<!-- Checkmark badge - cleared -->
											<svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
											</svg>
										{:else if status === 'paid'}
											<!-- Money icon - paid -->
											<svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
											</svg>
										{:else}
											<!-- Empty circle - not paid -->
											<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<circle cx="12" cy="12" r="9" stroke-width="2" />
											</svg>
										{/if}
									</button>
								</td>
								<!-- Amount -->
								<td class="px-3 py-3 text-right amount-cell cursor-pointer" on:click|stopPropagation={() => { selectedRowId = transaction.id; selectedCell = 'amount'; }}>
									{#if selectedRowId === transaction.id && selectedCell === 'amount' && !ledger.is_locked}
										<input
											type="number"
											step="1"
											value={transaction.debit_amount > 0 ? -Math.round(parseFloat(transaction.debit_amount.toString())) : Math.round(parseFloat(transaction.credit_amount.toString())) || ''}
											on:blur={(e) => {
												const val = Math.round(parseFloat(e.currentTarget.value) || 0);
												if (val < 0) {
													handleUpdateTransaction(transaction, 'debit_amount', Math.abs(val));
													handleUpdateTransaction(transaction, 'credit_amount', 0);
												} else {
													handleUpdateTransaction(transaction, 'credit_amount', val);
													handleUpdateTransaction(transaction, 'debit_amount', 0);
												}
												selectedCell = null;
											}}
											on:keydown={(e) => {
												if (e.key === 'Escape') selectedCell = null;
												if (e.key === 'Enter') {
													const val = Math.round(parseFloat(e.currentTarget.value) || 0);
													if (val < 0) {
														handleUpdateTransaction(transaction, 'debit_amount', Math.abs(val));
														handleUpdateTransaction(transaction, 'credit_amount', 0);
													} else {
														handleUpdateTransaction(transaction, 'credit_amount', val);
														handleUpdateTransaction(transaction, 'debit_amount', 0);
													}
													selectedCell = null;
												}
											}}
											class="w-20 px-2 py-1 border border-blue-500 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
										/>
									{:else}
										<span class="block px-1 py-1 text-right {!ledger.is_locked ? 'hover:bg-gray-200 rounded' : ''}">
											{#if amount.text}
												{#if amount.isDebit}
													<span class="debit-wrapper">${amount.text}</span>
												{:else}
													${amount.text}
												{/if}
											{/if}
										</span>
									{/if}
								</td>
								<!-- Balance -->
								<td class="px-3 py-3 text-right font-medium balance-cell">
									{#if balance.isNegative}
										<span class="debit-wrapper">{balance.text}</span>
									{:else}
										{balance.text}
									{/if}
								</td>
								<!-- Row Menu -->
								<td class="px-2 py-3 text-center relative">
									{#if selectedRowId === transaction.id && !ledger.is_locked}
										<button
											on:click|stopPropagation={() => toggleRowMenu(transaction.id)}
											class="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
										>
											<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
												<circle cx="12" cy="5" r="2" />
												<circle cx="12" cy="12" r="2" />
												<circle cx="12" cy="19" r="2" />
											</svg>
										</button>
										{#if rowMenuId === transaction.id}
											<div
												class="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
												on:click|stopPropagation
											>
												<button
													on:click={() => { handleDeleteTransaction(transaction.id); rowMenuId = null; }}
													class="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
												>
													<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
														<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
													</svg>
													Delete
												</button>
											</div>
										{/if}
									{/if}
								</td>
							</tr>
						{/each}

						<!-- Add New Transaction Row -->
						{#if !ledger.is_locked}
							{#if isAddingTransaction}
								<tr class="bg-green-50 border-b-2 border-green-200">
									<td class="px-2 py-3"></td><!-- Empty drag handle cell -->
									<td class="px-2 py-3">
										<input
											type="date"
											bind:value={newDate}
											class="w-full px-1 py-1 border border-gray-300 rounded text-sm"
										/>
									</td>
									<td class="px-3 py-3">
										<input
											type="text"
											bind:value={newDescription}
											placeholder="Description..."
											on:keypress={(e) => e.key === 'Enter' && handleAddTransaction()}
											on:keydown={(e) => e.key === 'Escape' && (isAddingTransaction = false)}
											class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
										/>
									</td>
									<td class="px-2 py-3 text-center">
										<button
											on:click={handleAddTransaction}
											disabled={!newDescription.trim() || !newAmount}
											class="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
										>
											Add
										</button>
									</td>
									<td class="px-3 py-3 text-right amount-cell">
										<input
											type="number"
											step="1"
											bind:value={newAmount}
											placeholder="+/-"
											on:keypress={(e) => e.key === 'Enter' && handleAddTransaction()}
											on:keydown={(e) => e.key === 'Escape' && (isAddingTransaction = false)}
											class="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right font-mono"
										/>
									</td>
									<td class="px-3 py-3"></td><!-- Balance -->
									<td class="px-2 py-3"></td><!-- Menu -->
								</tr>
							{:else}
								<tr
									class="border-b border-gray-200 bg-white hover:bg-gray-50 cursor-pointer"
									on:click|stopPropagation={() => { isAddingTransaction = true; }}
								>
									<td class="px-2 py-3"></td>
									<td class="px-2 py-3 text-gray-400 text-sm" colspan="5">
										<div class="flex items-center gap-2">
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
											</svg>
											Add transaction...
										</div>
									</td>
									<td class="px-2 py-3"></td>
								</tr>
							{/if}
						{/if}

					</tbody>
					<tfoot class="sticky bottom-0 z-10">
						<tr class="bg-gray-100 border-t-2 border-gray-300 font-bold shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
							<td class="px-2 py-3"></td><!-- Empty drag handle cell -->
							<td class="px-2 py-3" colspan="2">Balance</td>
							<td class="px-2 py-3"></td><!-- Status -->
							<td class="px-3 py-3"></td><!-- Amount -->
							<td class="px-3 py-3 text-right balance-cell">
								{#if finalBalanceFormatted.isNegative}
									<span class="debit-wrapper">{finalBalanceFormatted.text}</span>
								{:else}
									{finalBalanceFormatted.text}
								{/if}
							</td>
							<td class="px-2 py-3"></td><!-- Menu -->
						</tr>
					</tfoot>
				</table>
			</div>

			<!-- Empty State -->
			{#if $transactionStore.transactions.length === 0}
				<div class="mt-6 text-center text-gray-600">
					<p class="text-lg mb-2">No transactions yet</p>
					<p class="text-sm">Add your first transaction using the form above</p>
				</div>
			{/if}
		{/if}
	</div>
</div>
