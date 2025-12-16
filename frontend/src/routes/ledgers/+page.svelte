<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { authStore } from '$lib/stores/auth';
	import { ledgerStore } from '$lib/stores/ledgerStore';
	import { ledgers as ledgersApi, type Ledger } from '$lib/api';
	import LedgerModal from '$lib/components/LedgerModal.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

	let showLedgerModal = false;
	let showDeleteDialog = false;
	let showImportModal = false;
	let editingLedger: Ledger | null = null;
	let deletingLedger: Ledger | null = null;
	let actionError = '';

	// Import state
	let importFile: File | null = null;
	let importShiftMonth = false;
	let isImporting = false;
	let importError = '';
	let fileInput: HTMLInputElement;

	// Auth check
	onMount(() => {
		const unsubscribe = authStore.subscribe(state => {
			if (!state.isAuthenticated && !state.isLoading) {
				goto(`${base}/login?returnUrl=${base}/ledgers`);
			}
		});

		// Load ledgers
		ledgerStore.loadLedgers($ledgerStore.showArchived);

		return unsubscribe;
	});

	function handleCreateNew() {
		editingLedger = null;
		actionError = '';
		showLedgerModal = true;
	}

	function handleEdit(ledger: Ledger) {
		editingLedger = ledger;
		actionError = '';
		showLedgerModal = true;
	}

	function handleDelete(ledger: Ledger) {
		deletingLedger = ledger;
		actionError = '';
		showDeleteDialog = true;
	}

	async function handleCopy(ledger: Ledger) {
		try {
			actionError = '';
			await ledgerStore.copyLedger(ledger.id);
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Failed to copy ledger';
		}
	}

	async function handleToggleLock(ledger: Ledger) {
		try {
			actionError = '';
			await ledgerStore.toggleLock(ledger.id, ledger.is_locked);
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Failed to toggle lock';
		}
	}

	async function handleToggleArchive(ledger: Ledger) {
		try {
			actionError = '';
			await ledgerStore.toggleArchive(ledger.id, ledger.is_archived);
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Failed to toggle archive';
		}
	}

	async function handleToggleShowArchived() {
		await ledgerStore.toggleShowArchived();
	}

	async function confirmDelete() {
		if (!deletingLedger) return;

		try {
			actionError = '';
			await ledgerStore.deleteLedger(deletingLedger.id);
			showDeleteDialog = false;
			deletingLedger = null;
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Failed to delete ledger';
		}
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
		}).format(amount);
	}

	function handleImportClick() {
		importFile = null;
		importShiftMonth = false;
		importError = '';
		showImportModal = true;
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			importFile = target.files[0];
			importError = '';
		}
	}

	async function handleImport() {
		if (!importFile) {
			importError = 'Please select a file to import';
			return;
		}

		isImporting = true;
		importError = '';

		try {
			const fileContent = await importFile.text();
			await ledgersApi.import(fileContent, importShiftMonth);
			await ledgerStore.loadLedgers($ledgerStore.showArchived);
			showImportModal = false;
			importFile = null;
			importShiftMonth = false;
		} catch (error) {
			importError = error instanceof Error ? error.message : 'Failed to import ledger';
		} finally {
			isImporting = false;
		}
	}

	function closeImportModal() {
		showImportModal = false;
		importFile = null;
		importShiftMonth = false;
		importError = '';
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
	<div class="max-w-6xl mx-auto">
		<!-- Header -->
		<div class="bg-white rounded-lg shadow-xl p-4 sm:p-6 mb-4 sm:mb-6">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
				<div>
					<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">My Ledgers</h1>
					{#if $authStore.user}
						<p class="text-sm sm:text-base text-gray-600 mt-1">
							Manage your financial ledgers, {$authStore.user.first_name}
						</p>
					{/if}
				</div>
				<div class="flex flex-wrap gap-2 sm:gap-3">
					<button
						on:click={handleToggleShowArchived}
						class="px-3 sm:px-4 py-2 text-xs sm:text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
					>
						{$ledgerStore.showArchived ? 'Hide Archived' : 'Show Archived'}
					</button>
					<button
						on:click={handleImportClick}
						class="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center gap-1 sm:gap-2 text-sm"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
						</svg>
						Import
					</button>
					<button
						on:click={handleCreateNew}
						class="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
					>
						+ New Ledger
					</button>
				</div>
			</div>

			<!-- Action Error -->
			{#if actionError}
				<div class="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
					<p class="text-red-700 text-sm">{actionError}</p>
				</div>
			{/if}

			<!-- Store Error -->
			{#if $ledgerStore.error}
				<div class="p-4 bg-red-50 border border-red-200 rounded-lg">
					<p class="text-red-700 text-sm">{$ledgerStore.error}</p>
				</div>
			{/if}
		</div>

		<!-- Loading State -->
		{#if $ledgerStore.isLoading}
			<div class="flex justify-center items-center py-12">
				<svg class="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</div>
		{:else if $ledgerStore.ledgers.length === 0}
			<!-- Empty State -->
			<div class="bg-white rounded-lg shadow-xl p-12 text-center">
				<div class="text-gray-400 mb-4">
					<svg class="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
				</div>
				<h3 class="text-xl font-semibold text-gray-900 mb-2">No Ledgers Yet</h3>
				<p class="text-gray-600 mb-6">
					{$ledgerStore.showArchived
						? 'You don\'t have any archived ledgers'
						: 'Get started by creating your first ledger'}
				</p>
				{#if !$ledgerStore.showArchived}
					<button
						on:click={handleCreateNew}
						class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
					>
						Create Your First Ledger
					</button>
				{/if}
			</div>
		{:else}
			<!-- Ledger Grid -->
			<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
				{#each $ledgerStore.ledgers as ledger (ledger.id)}
					<div class="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
						<!-- Ledger Header (Clickable) -->
						<a href="{base}/ledgers/{ledger.id}" class="block p-4 sm:p-6 border-b border-gray-200 hover:bg-gray-50 transition-colors">
							<div class="flex items-start justify-between mb-2">
								<h3 class="text-lg sm:text-xl font-bold text-gray-900 flex-1 mr-2">
									{ledger.name}
								</h3>
								<div class="flex gap-1">
									{#if ledger.is_locked}
										<span class="text-yellow-600" title="Locked">
											<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
											</svg>
										</span>
									{/if}
									{#if ledger.is_archived}
										<span class="text-gray-400" title="Archived">
											<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
												<path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
												<path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd" />
											</svg>
										</span>
									{/if}
								</div>
							</div>
							<p class="text-xl sm:text-2xl font-bold text-blue-600">
								{formatCurrency(ledger.current_balance ?? ledger.starting_balance)}
							</p>
							<p class="text-xs sm:text-sm text-gray-500 mt-1">
								{ledger.transaction_count || 0} transaction{ledger.transaction_count === 1 ? '' : 's'}
							</p>
						</a>

						<!-- Actions -->
						<div class="p-3 sm:p-4 bg-gray-50 flex flex-wrap gap-2">
							<button
								on:click={() => handleEdit(ledger)}
								disabled={ledger.is_locked && !$ledgerStore.isLoading}
								class="flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Edit
							</button>
							<button
								on:click={() => handleCopy(ledger)}
								class="flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
							>
								Copy
							</button>
							<button
								on:click={() => handleToggleLock(ledger)}
								class="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
								title={ledger.is_locked ? 'Unlock' : 'Lock'}
							>
								{#if ledger.is_locked}
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
									</svg>
								{:else}
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
									</svg>
								{/if}
							</button>
							<button
								on:click={() => handleToggleArchive(ledger)}
								class="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
								title={ledger.is_archived ? 'Unarchive' : 'Archive'}
							>
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
									<path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
									<path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd" />
								</svg>
							</button>
							<button
								on:click={() => handleDelete(ledger)}
								disabled={ledger.is_locked}
								class="px-3 py-2 text-sm bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								title="Delete"
							>
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Back to Home -->
		<div class="mt-6 text-center">
			<a href="{base}/" class="text-blue-600 hover:text-blue-700 font-medium">
				← Back to Home
			</a>
		</div>
	</div>
</div>

<!-- Modals -->
{#if showLedgerModal}
	<LedgerModal
		ledger={editingLedger}
		on:close={() => {
			showLedgerModal = false;
			editingLedger = null;
		}}
	/>
{/if}

{#if showDeleteDialog && deletingLedger}
	<ConfirmDialog
		title="Delete Ledger"
		message="Are you sure you want to delete '{deletingLedger.name}'? This action cannot be undone and will delete all associated transactions."
		confirmText="Delete"
		confirmClass="bg-red-600 hover:bg-red-700"
		on:confirm={confirmDelete}
		on:cancel={() => {
			showDeleteDialog = false;
			deletingLedger = null;
		}}
	/>
{/if}

{#if showImportModal}
	<!-- Import Modal -->
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
			<div class="p-6">
				<h2 class="text-2xl font-bold text-gray-900 mb-4">Import Ledger</h2>

				{#if importError}
					<div class="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
						<p class="text-red-700 text-sm">{importError}</p>
					</div>
				{/if}

				<div class="mb-6">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Select export file
					</label>
					<input
						type="file"
						accept=".txt,.json"
						bind:this={fileInput}
						on:change={handleFileSelect}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
					{#if importFile}
						<p class="mt-2 text-sm text-gray-600">Selected: {importFile.name}</p>
					{/if}
				</div>

				<div class="mb-6">
					<label class="flex items-start gap-3 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={importShiftMonth}
							class="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
						/>
						<div>
							<span class="text-sm font-medium text-gray-900">Import for new month</span>
							<p class="text-xs text-gray-500 mt-1">
								Shift all dates to the current month, reset paid/cleared status, and name the ledger after the current month.
							</p>
						</div>
					</label>
				</div>

				<div class="flex gap-3">
					<button
						on:click={closeImportModal}
						disabled={isImporting}
						class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						on:click={handleImport}
						disabled={!importFile || isImporting}
						class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
					>
						{#if isImporting}
							<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Importing...
						{:else}
							Import
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
