<script lang="ts">
	import { base } from '$app/paths';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { transactionStore } from '$lib/stores/transactionStore';
	import { ledgers as ledgersApi, type Ledger, type Transaction } from '$lib/api';

	let ledger: Ledger | null = null;
	let ledgerId: number;
	let startingBalance = 0;
	let startingBalanceDate = new Date().toISOString().split('T')[0];
	let isLedgerLoading = true;
	let error = '';

	// New transaction row data
	let newDate = new Date().toISOString().split('T')[0];
	let newDescription = '';
	let newCredit = '';
	let newDebit = '';

	// Computed values
	$: totalCredit = $transactionStore.transactions.reduce((sum, t) => sum + (parseFloat(t.credit_amount.toString()) || 0), 0);
	$: totalDebit = $transactionStore.transactions.reduce((sum, t) => sum + (parseFloat(t.debit_amount.toString()) || 0), 0);
	$: finalBalance = startingBalance + totalCredit - totalDebit;

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
		if (!newDescription.trim() || (!newCredit && !newDebit)) return;

		try {
			await transactionStore.createTransaction({
				ledger_id: ledgerId,
				date: newDate,
				description: newDescription.trim(),
				credit_amount: parseFloat(newCredit) || 0,
				debit_amount: parseFloat(newDebit) || 0,
				is_paid: false,
				is_cleared: false,
			});

			// Clear form
			newDate = new Date().toISOString().split('T')[0];
			newDescription = '';
			newCredit = '';
			newDebit = '';
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

	function handleCreditInput(e: Event, transaction: Transaction) {
		const target = e.target as HTMLInputElement;
		const value = target.value;
		if (value) {
			// Clear debit when credit is entered
			handleUpdateTransaction(transaction, 'debit_amount', 0);
		}
	}

	function handleDebitInput(e: Event, transaction: Transaction) {
		const target = e.target as HTMLInputElement;
		const value = target.value;
		if (value) {
			// Clear credit when debit is entered
			handleUpdateTransaction(transaction, 'credit_amount', 0);
		}
	}

	function formatCurrency(amount: number): string {
		return amount.toFixed(2);
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
					<div class="text-right">
						<p class="text-sm text-gray-600">Current Balance</p>
						<p class="text-3xl font-bold text-blue-600">${formatCurrency(finalBalance)}</p>
					</div>
				</div>
			</div>

			<!-- Transaction Table -->
			<div class="bg-white rounded-lg shadow-xl overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50 border-b-2 border-gray-200">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Date</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Credit (+)</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Debit (-)</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Balance</th>
							<th class="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Paid</th>
							<th class="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Cleared</th>
							<th class="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
						</tr>
					</thead>
					<tbody>
						<!-- Starting Balance Row -->
						<tr class="bg-blue-50 border-b border-gray-200 font-semibold">
							<td class="px-4 py-3">
								<input
									type="date"
									value={startingBalanceDate}
									disabled={ledger.is_locked}
									on:change={(e) => handleStartingDateChange(e.currentTarget.value)}
									class="w-full px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
								/>
							</td>
							<td class="px-4 py-3 text-gray-700">Starting Balance</td>
							<td class="px-4 py-3"></td>
							<td class="px-4 py-3"></td>
							<td class="px-4 py-3 text-right">
								<input
									type="number"
									step="0.01"
									value={startingBalance}
									disabled={ledger.is_locked}
									on:blur={(e) => handleStartingBalanceChange(e.currentTarget.value)}
									class="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right disabled:bg-gray-100 disabled:cursor-not-allowed"
								/>
							</td>
							<td class="px-4 py-3"></td>
							<td class="px-4 py-3"></td>
							<td class="px-4 py-3"></td>
						</tr>

						<!-- Transaction Rows -->
						{#each transactionsWithBalance as transaction (transaction.id)}
							<tr class="border-b border-gray-200 hover:bg-gray-50">
								<td class="px-4 py-3">
									<input
										type="date"
										value={transaction.date}
										disabled={ledger.is_locked}
										on:blur={(e) => handleUpdateTransaction(transaction, 'date', e.currentTarget.value)}
										class="w-full px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
									/>
								</td>
								<td class="px-4 py-3">
									<input
										type="text"
										value={transaction.description}
										disabled={ledger.is_locked}
										on:blur={(e) => handleUpdateTransaction(transaction, 'description', e.currentTarget.value)}
										class="w-full px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
									/>
								</td>
								<td class="px-4 py-3 text-right">
									<input
										type="number"
										step="0.01"
										min="0"
										value={transaction.credit_amount > 0 ? transaction.credit_amount : ''}
										disabled={ledger.is_locked}
										on:input={(e) => handleCreditInput(e, transaction)}
										on:blur={(e) => handleUpdateTransaction(transaction, 'credit_amount', parseFloat(e.currentTarget.value) || 0)}
										class="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right disabled:bg-gray-100 disabled:cursor-not-allowed"
									/>
								</td>
								<td class="px-4 py-3 text-right">
									<input
										type="number"
										step="0.01"
										min="0"
										value={transaction.debit_amount > 0 ? transaction.debit_amount : ''}
										disabled={ledger.is_locked}
										on:input={(e) => handleDebitInput(e, transaction)}
										on:blur={(e) => handleUpdateTransaction(transaction, 'debit_amount', parseFloat(e.currentTarget.value) || 0)}
										class="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right disabled:bg-gray-100 disabled:cursor-not-allowed"
									/>
								</td>
								<td class="px-4 py-3 text-right font-semibold">
									${formatCurrency(transaction.runningBalance)}
								</td>
								<td class="px-4 py-3 text-center">
									<input
										type="checkbox"
										checked={transaction.is_paid}
										disabled={ledger.is_locked}
										on:change={() => handleTogglePaid(transaction.id)}
										class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
									/>
								</td>
								<td class="px-4 py-3 text-center">
									<input
										type="checkbox"
										checked={transaction.is_cleared}
										disabled={ledger.is_locked}
										on:change={() => handleToggleCleared(transaction.id)}
										class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
									/>
								</td>
								<td class="px-4 py-3 text-center">
									<button
										on:click={() => handleDeleteTransaction(transaction.id)}
										disabled={ledger.is_locked}
										class="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
										title="Delete"
									>
										<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
										</svg>
									</button>
								</td>
							</tr>
						{/each}

						<!-- Add New Transaction Row -->
						{#if !ledger.is_locked}
							<tr class="bg-green-50 border-b-2 border-green-200">
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
								<td class="px-4 py-3 text-right">
									<input
										type="number"
										step="0.01"
										min="0"
										bind:value={newCredit}
										on:input={() => { if (newCredit) newDebit = ''; }}
										on:keypress={(e) => e.key === 'Enter' && handleAddTransaction()}
										class="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
									/>
								</td>
								<td class="px-4 py-3 text-right">
									<input
										type="number"
										step="0.01"
										min="0"
										bind:value={newDebit}
										on:input={() => { if (newDebit) newCredit = ''; }}
										on:keypress={(e) => e.key === 'Enter' && handleAddTransaction()}
										class="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
									/>
								</td>
								<td class="px-4 py-3"></td>
								<td class="px-4 py-3"></td>
								<td class="px-4 py-3"></td>
								<td class="px-4 py-3 text-center">
									<button
										on:click={handleAddTransaction}
										disabled={!newDescription.trim() || (!newCredit && !newDebit)}
										class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
									>
										Add
									</button>
								</td>
							</tr>
						{/if}

						<!-- Totals Row -->
						<tr class="bg-gray-100 border-t-2 border-gray-300 font-bold">
							<td class="px-4 py-3" colspan="2">Totals</td>
							<td class="px-4 py-3 text-right">${formatCurrency(totalCredit)}</td>
							<td class="px-4 py-3 text-right">${formatCurrency(totalDebit)}</td>
							<td class="px-4 py-3 text-right">${formatCurrency(finalBalance)}</td>
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
