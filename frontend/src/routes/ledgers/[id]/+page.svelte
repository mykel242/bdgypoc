<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { authStore } from '$lib/stores/auth';
	import { transactionStore } from '$lib/stores/transactionStore';
	import { ledgers as ledgersApi, type Ledger, type Transaction } from '$lib/api';

	let isExporting = false;

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

	// Drag and drop state
	let draggedIndex: number | null = null;
	let dragOverIndex: number | null = null;

	function selectCell(rowId: number, cell: string) {
		selectedRowId = rowId;
		selectedCell = cell;
	}

	function clearSelection() {
		selectedRowId = null;
		selectedCell = null;
	}

	function isEditing(rowId: number, cell: string): boolean {
		return selectedRowId === rowId && selectedCell === cell;
	}

	// Drag and drop handlers
	function handleDragStart(e: DragEvent, index: number) {
		if (ledger?.is_locked) return;
		draggedIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', index.toString());
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

	async function handleDrop(e: DragEvent, toIndex: number) {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === toIndex) {
			handleDragEnd();
			return;
		}

		try {
			await transactionStore.reorderTransactions(draggedIndex, toIndex);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to reorder transactions';
		}
		handleDragEnd();
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

			// Clear form
			newDate = new Date().toISOString().split('T')[0];
			newDescription = '';
			newAmount = '';
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
</script>

<style>
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

	/* Debit styling with parentheses outside flow using absolute positioning */
	.debit-wrapper {
		position: relative;
		display: inline-block;
		color: #dc2626; /* red-600 */
	}
	.debit-wrapper::before {
		content: '(';
		position: absolute;
		right: 100%;
		color: #dc2626;
	}
	.debit-wrapper::after {
		content: ')';
		position: absolute;
		left: 100%;
		color: #dc2626;
	}

</style>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4" on:click={clearSelection}>
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
			<div class="bg-white rounded-lg shadow-xl p-6 mb-6">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-4">
						<a href="{base}/ledgers" class="text-blue-600 hover:text-blue-700 font-medium">
							← Back
						</a>
						<div>
							<h1 class="text-3xl font-bold text-gray-900 flex items-center gap-2">
								{ledger.name}
								{#if ledger.is_locked}
									<span class="text-yellow-600" title="Locked">
										<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
										</svg>
									</span>
								{/if}
								{#if ledger.is_archived}
									<span class="text-gray-400" title="Archived">
										<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
											<path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
											<path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd" />
										</svg>
									</span>
								{/if}
							</h1>
							{#if ledger.is_locked}
								<p class="text-sm text-yellow-700 mt-1">This ledger is locked and cannot be edited</p>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-4">
						<button
							on:click={handleExport}
							disabled={isExporting}
							class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-wait flex items-center gap-2"
						>
							{#if isExporting}
								<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Exporting...
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
								</svg>
								Export
							{/if}
						</button>
						<div class="text-right">
							<p class="text-sm text-gray-600">Current Balance</p>
							<p class="text-3xl font-bold text-blue-600">${formatCurrency(finalBalance)}</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Transaction Table -->
			<div class="bg-white rounded-lg shadow-xl overflow-x-auto" on:click|stopPropagation>
				<table class="w-full">
					<thead class="bg-gray-50 border-b-2 border-gray-200">
						<tr>
							<th class="w-8 px-2 py-3"></th><!-- Drag handle column -->
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Date</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Amount</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Balance</th>
							<th class="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Paid</th>
							<th class="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Cleared</th>
							<th class="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
						</tr>
					</thead>
					<tbody>
						<!-- Starting Balance Row -->
						<tr
							class="border-b border-gray-200 font-semibold {selectedRowId === 0 ? 'bg-blue-50' : 'bg-blue-50'} {selectedRowId !== 0 ? 'hover:bg-blue-100' : ''}"
							on:click={() => { selectedRowId = 0; }}
						>
							<td class="px-2 py-3"></td><!-- Empty drag handle cell -->
							<!-- Date -->
							<td class="px-4 py-3 cursor-pointer" on:click|stopPropagation={() => { selectedRowId = 0; selectedCell = 'date'; }}>
								{#if selectedRowId === 0 && selectedCell === 'date' && !ledger.is_locked}
									<input
										type="date"
										value={startingBalanceDate}
										on:blur={(e) => { handleStartingDateChange(e.currentTarget.value); selectedCell = null; }}
										on:keydown={(e) => e.key === 'Escape' && (selectedCell = null)}
										class="w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								{:else}
									<span class="block px-2 py-1 text-sm {!ledger.is_locked ? 'hover:bg-blue-100 rounded' : ''}">
										{startingBalanceDate}
									</span>
								{/if}
							</td>
							<!-- Description (not editable) -->
							<td class="px-4 py-3 text-gray-700">Starting Balance</td>
							<!-- Amount -->
							<td class="px-4 py-3 text-right amount-cell cursor-pointer" on:click|stopPropagation={() => { selectedRowId = 0; selectedCell = 'amount'; }}>
								{#if selectedRowId === 0 && selectedCell === 'amount' && !ledger.is_locked}
									<input
										type="number"
										step="1"
										value={Math.round(startingBalance)}
										on:blur={(e) => { handleStartingBalanceChange(e.currentTarget.value); selectedCell = null; }}
										on:keydown={(e) => { if (e.key === 'Escape') selectedCell = null; if (e.key === 'Enter') { handleStartingBalanceChange(e.currentTarget.value); selectedCell = null; } }}
										class="w-24 px-2 py-1 border border-blue-500 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
									/>
								{:else}
									<span class="block px-2 py-1 text-right {!ledger.is_locked ? 'hover:bg-blue-100 rounded' : ''}">
										${Math.round(startingBalance)}
									</span>
								{/if}
							</td>
							<!-- Balance -->
							<td class="px-4 py-3 text-right balance-cell">${Math.round(startingBalance)}</td>
							<td class="px-4 py-3"></td>
							<td class="px-4 py-3"></td>
							<td class="px-4 py-3"></td>
						</tr>

						<!-- Transaction Rows -->
						{#each transactionsWithBalance as transaction, index (transaction.id)}
							{@const balance = formatBalance(transaction.runningBalance)}
							{@const amount = formatAmount(transaction.credit_amount, transaction.debit_amount)}
							{@const runningBal = typeof transaction.runningBalance === 'string' ? parseFloat(transaction.runningBalance) : transaction.runningBalance}
							{@const isNegativeBalance = runningBal < 0}
							<tr
								class="border-b border-gray-200 {selectedRowId === transaction.id ? 'bg-blue-50' : isNegativeBalance ? 'bg-red-50' : 'bg-white'} {selectedRowId !== transaction.id ? 'hover:bg-gray-100' : ''} {draggedIndex === index ? 'opacity-50' : ''} {dragOverIndex === index ? 'border-t-2 border-t-blue-500' : ''}"
								on:click={() => { selectedRowId = transaction.id; }}
								on:dragover={(e) => handleDragOver(e, index)}
								on:dragleave={handleDragLeave}
								on:drop={(e) => handleDrop(e, index)}
							>
								<!-- Drag Handle -->
								<td
									class="px-2 py-3 cursor-grab text-gray-400 hover:text-gray-600 {ledger?.is_locked ? 'cursor-not-allowed opacity-50' : ''}"
									draggable={!ledger?.is_locked}
									on:dragstart={(e) => handleDragStart(e, index)}
									on:dragend={handleDragEnd}
								>
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
										<circle cx="9" cy="5" r="1.5" />
										<circle cx="15" cy="5" r="1.5" />
										<circle cx="9" cy="12" r="1.5" />
										<circle cx="15" cy="12" r="1.5" />
										<circle cx="9" cy="19" r="1.5" />
										<circle cx="15" cy="19" r="1.5" />
									</svg>
								</td>
								<!-- Date -->
								<td class="px-4 py-3 cursor-pointer" on:click|stopPropagation={() => { selectedRowId = transaction.id; selectedCell = 'date'; }}>
									{#if selectedRowId === transaction.id && selectedCell === 'date' && !ledger.is_locked}
										<input
											type="date"
											value={transaction.date}
											on:blur={(e) => { handleUpdateTransaction(transaction, 'date', e.currentTarget.value); selectedCell = null; }}
											on:keydown={(e) => e.key === 'Escape' && (selectedCell = null)}
											class="w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									{:else}
										<span class="block px-2 py-1 text-sm {!ledger.is_locked ? 'hover:bg-gray-200 rounded' : ''}">
											{transaction.date}
										</span>
									{/if}
								</td>
								<!-- Description -->
								<td class="px-4 py-3 cursor-pointer" on:click|stopPropagation={() => { selectedRowId = transaction.id; selectedCell = 'description'; }}>
									{#if selectedRowId === transaction.id && selectedCell === 'description' && !ledger.is_locked}
										<input
											type="text"
											value={transaction.description}
											on:blur={(e) => { handleUpdateTransaction(transaction, 'description', e.currentTarget.value); selectedCell = null; }}
											on:keydown={(e) => { if (e.key === 'Escape') selectedCell = null; if (e.key === 'Enter') { handleUpdateTransaction(transaction, 'description', e.currentTarget.value); selectedCell = null; } }}
											class="w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									{:else}
										<span class="block px-2 py-1 text-sm {!ledger.is_locked ? 'hover:bg-gray-200 rounded' : ''}">
											{transaction.description}
										</span>
									{/if}
								</td>
								<!-- Amount (combined credit/debit) -->
								<td class="px-4 py-3 text-right amount-cell cursor-pointer" on:click|stopPropagation={() => { selectedRowId = transaction.id; selectedCell = 'amount'; }}>
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
											class="w-24 px-2 py-1 border border-blue-500 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
										/>
									{:else}
										<span class="block px-2 py-1 text-right {!ledger.is_locked ? 'hover:bg-gray-200 rounded' : ''}">
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
								<td class="px-4 py-3 text-right font-semibold balance-cell">
									{#if balance.isNegative}
										<span class="debit-wrapper">{balance.text}</span>
									{:else}
										{balance.text}
									{/if}
								</td>
								<!-- Paid checkbox -->
								<td class="px-4 py-3 text-center">
									<input
										type="checkbox"
										checked={transaction.is_paid}
										disabled={ledger.is_locked}
										on:change={() => handleTogglePaid(transaction.id)}
										on:click|stopPropagation
										class="w-5 h-5 cursor-pointer"
									/>
								</td>
								<!-- Cleared checkbox -->
								<td class="px-4 py-3 text-center">
									<input
										type="checkbox"
										checked={transaction.is_cleared}
										disabled={ledger.is_locked}
										on:change={() => handleToggleCleared(transaction.id)}
										on:click|stopPropagation
										class="w-5 h-5 cursor-pointer"
									/>
								</td>
								<!-- Actions (trash only on selected row) -->
								<td class="px-4 py-3 text-center">
									{#if selectedRowId === transaction.id && !ledger.is_locked}
										<button
											on:click|stopPropagation={() => handleDeleteTransaction(transaction.id)}
											class="text-red-600 hover:text-red-800"
											title="Delete"
										>
											<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
											</svg>
										</button>
									{/if}
								</td>
							</tr>
						{/each}

						<!-- Add New Transaction Row -->
						{#if !ledger.is_locked}
							<tr class="bg-green-50 border-b-2 border-green-200">
								<td class="px-2 py-3"></td><!-- Empty drag handle cell -->
								<td class="px-4 py-3">
									<input
										type="date"
										bind:value={newDate}
										class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
									/>
								</td>
								<td class="px-4 py-3">
									<input
										type="text"
										bind:value={newDescription}
										placeholder="New transaction..."
										on:keypress={(e) => e.key === 'Enter' && handleAddTransaction()}
										class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
									/>
								</td>
								<td class="px-4 py-3 text-right amount-cell">
									<input
										type="number"
										step="1"
										bind:value={newAmount}
										placeholder="+/- amount"
										on:keypress={(e) => e.key === 'Enter' && handleAddTransaction()}
										class="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right font-mono"
									/>
								</td>
								<td class="px-4 py-3"></td>
								<td class="px-4 py-3"></td>
								<td class="px-4 py-3"></td>
								<td class="px-4 py-3 text-center">
									<button
										on:click={handleAddTransaction}
										disabled={!newDescription.trim() || !newAmount}
										class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
									>
										Add
									</button>
								</td>
							</tr>
						{/if}

						<!-- Totals Row -->
						<tr class="bg-gray-100 border-t-2 border-gray-300 font-bold">
							<td class="px-2 py-3"></td><!-- Empty drag handle cell -->
							<td class="px-4 py-3" colspan="2">Totals</td>
							<td class="px-4 py-3 text-right amount-cell">
								{#if netAmount < 0}
									<span class="debit-wrapper">${Math.round(Math.abs(netAmount))}</span>
								{:else}
									${Math.round(netAmount)}
								{/if}
							</td>
							<td class="px-4 py-3 text-right balance-cell">
								{#if finalBalanceFormatted.isNegative}
									<span class="debit-wrapper">{finalBalanceFormatted.text}</span>
								{:else}
									{finalBalanceFormatted.text}
								{/if}
							</td>
							<td class="px-4 py-3"></td>
							<td class="px-4 py-3"></td>
							<td class="px-4 py-3"></td>
						</tr>
					</tbody>
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
