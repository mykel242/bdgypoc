<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { authStore } from '$lib/stores/auth';
	import { admin, type Backup } from '$lib/api';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

	let backups: Backup[] = [];
	let isLoading = true;
	let isCreating = false;
	let error = '';
	let success = '';

	let showDeleteDialog = false;
	let deletingBackup: Backup | null = null;

	// Auth check - redirect if not admin
	onMount(() => {
		const unsubscribe = authStore.subscribe(state => {
			if (!state.isLoading) {
				if (!state.isAuthenticated) {
					goto(`${base}/login?returnUrl=${base}/admin/backups`);
				} else if (!state.user?.is_admin) {
					goto(`${base}/ledgers`);
				} else {
					loadBackups();
				}
			}
		});

		return unsubscribe;
	});

	async function loadBackups() {
		isLoading = true;
		error = '';

		try {
			const response = await admin.listBackups();
			backups = response.backups;
		} catch (err) {
			if (err instanceof Error) {
				error = err.message;
			} else {
				error = 'Failed to load backups';
			}
		} finally {
			isLoading = false;
		}
	}

	async function handleCreateBackup() {
		isCreating = true;
		error = '';
		success = '';

		try {
			await admin.createBackup();
			success = 'Backup created successfully';
			await loadBackups();
		} catch (err) {
			if (err instanceof Error) {
				error = err.message;
			} else {
				error = 'Failed to create backup';
			}
		} finally {
			isCreating = false;
		}
	}

	function handleDownload(backup: Backup) {
		const url = admin.getBackupDownloadUrl(backup.filename);
		window.open(url, '_blank');
	}

	function handleDeleteClick(backup: Backup) {
		deletingBackup = backup;
		showDeleteDialog = true;
	}

	async function confirmDelete() {
		if (!deletingBackup) return;

		try {
			await admin.deleteBackup(deletingBackup.filename);
			success = 'Backup deleted successfully';
			showDeleteDialog = false;
			deletingBackup = null;
			await loadBackups();
		} catch (err) {
			if (err instanceof Error) {
				error = err.message;
			} else {
				error = 'Failed to delete backup';
			}
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
	<div class="max-w-4xl mx-auto">
		<!-- Header -->
		<div class="bg-white rounded-lg shadow-xl p-4 sm:p-6 mb-4 sm:mb-6">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Database Backups</h1>
					<p class="text-sm sm:text-base text-gray-600 mt-1">
						Manage database backups (Admin only)
					</p>
				</div>
				<button
					on:click={handleCreateBackup}
					disabled={isCreating}
					class="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
				>
					{#if isCreating}
						<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Creating...
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Create Backup
					{/if}
				</button>
			</div>

			{#if error}
				<div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
					<p class="text-red-700 text-sm">{error}</p>
				</div>
			{/if}

			{#if success}
				<div class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
					<p class="text-green-700 text-sm">{success}</p>
				</div>
			{/if}
		</div>

		<!-- Backups List -->
		{#if isLoading}
			<div class="flex justify-center items-center py-12">
				<svg class="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</div>
		{:else if backups.length === 0}
			<div class="bg-white rounded-lg shadow-xl p-12 text-center">
				<div class="text-gray-400 mb-4">
					<svg class="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
					</svg>
				</div>
				<h3 class="text-xl font-semibold text-gray-900 mb-2">No Backups Yet</h3>
				<p class="text-gray-600 mb-6">
					Create your first backup to protect your data.
				</p>
				<button
					on:click={handleCreateBackup}
					disabled={isCreating}
					class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400"
				>
					Create Your First Backup
				</button>
			</div>
		{:else}
			<div class="bg-white rounded-lg shadow-xl overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Filename
								</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Size
								</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Created
								</th>
								<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
									Actions
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each backups as backup}
								<tr class="hover:bg-gray-50">
									<td class="px-4 py-3 text-sm text-gray-900 font-mono">
										{backup.filename}
									</td>
									<td class="px-4 py-3 text-sm text-gray-600">
										{formatFileSize(backup.size)}
									</td>
									<td class="px-4 py-3 text-sm text-gray-600">
										{formatDate(backup.created_at)}
									</td>
									<td class="px-4 py-3 text-right">
										<div class="flex justify-end gap-2">
											<button
												on:click={() => handleDownload(backup)}
												class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
												title="Download"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
												</svg>
											</button>
											<button
												on:click={() => handleDeleteClick(backup)}
												class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
												title="Delete"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Navigation -->
		<div class="mt-6 text-center space-y-2">
			<a href="{base}/settings" class="text-blue-600 hover:text-blue-700 font-medium block">
				Back to Settings
			</a>
			<a href="{base}/ledgers" class="text-gray-600 hover:text-gray-700 font-medium block">
				Back to Ledgers
			</a>
		</div>
	</div>
</div>

{#if showDeleteDialog && deletingBackup}
	<ConfirmDialog
		title="Delete Backup"
		message="Are you sure you want to delete '{deletingBackup.filename}'? This action cannot be undone."
		confirmText="Delete"
		confirmClass="bg-red-600 hover:bg-red-700"
		on:confirm={confirmDelete}
		on:cancel={() => {
			showDeleteDialog = false;
			deletingBackup = null;
		}}
	/>
{/if}
