<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { ledgerStore } from '$lib/stores/ledgerStore';
	import type { Ledger } from '$lib/api';
	import { ApiError } from '$lib/api';

	export let ledger: Ledger | null = null;

	const dispatch = createEventDispatcher();
	const isEditing = ledger !== null;

	let name = ledger?.name || '';
	let starting_balance = ledger?.starting_balance?.toString() || '0.00';
	let starting_balance_date = ledger?.starting_balance_date || '';

	let isSubmitting = false;
	let errors: Record<string, string> = {};
	let serverError = '';

	function validateName(): string | null {
		if (!name.trim()) return 'Ledger name is required';
		if (name.length > 255) return 'Ledger name must be less than 255 characters';
		return null;
	}

	function validateStartingBalance(): string | null {
		const amount = parseFloat(starting_balance);
		if (isNaN(amount)) return 'Starting balance must be a valid number';
		return null;
	}

	function handleNameBlur() {
		const error = validateName();
		if (error) {
			errors.name = error;
		} else {
			delete errors.name;
		}
		errors = errors;
	}

	function handleStartingBalanceBlur() {
		const error = validateStartingBalance();
		if (error) {
			errors.starting_balance = error;
		} else {
			delete errors.starting_balance;
		}
		errors = errors;
	}

	async function handleSubmit() {
		// Clear previous errors
		errors = {};
		serverError = '';

		// Validate all fields
		const nameError = validateName();
		const balanceError = validateStartingBalance();

		if (nameError) errors.name = nameError;
		if (balanceError) errors.starting_balance = balanceError;

		if (Object.keys(errors).length > 0) {
			errors = errors;
			return;
		}

		// Submit to API
		isSubmitting = true;
		try {
			const data = {
				name: name.trim(),
				starting_balance: parseFloat(starting_balance),
				starting_balance_date: starting_balance_date || undefined,
			};

			if (isEditing && ledger) {
				await ledgerStore.updateLedger(ledger.id, data);
			} else {
				await ledgerStore.createLedger(data);
			}

			dispatch('close');
		} catch (error) {
			if (error instanceof ApiError) {
				if (error.details && error.details.length > 0) {
					error.details.forEach(detail => {
						errors[detail.param] = detail.msg;
					});
					errors = errors;
				} else {
					serverError = error.message;
				}
			} else {
				serverError = 'An unexpected error occurred. Please try again.';
			}
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancel() {
		dispatch('close');
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleCancel();
		}
	}
</script>

<div
	class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
	on:click={handleBackdropClick}
	role="button"
	tabindex="0"
>
	<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
		<!-- Header -->
		<div class="mb-6">
			<h2 class="text-2xl font-bold text-gray-900">
				{isEditing ? 'Edit Ledger' : 'Create New Ledger'}
			</h2>
		</div>

		<!-- Server Error -->
		{#if serverError}
			<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
				<p class="text-red-700 text-sm">{serverError}</p>
			</div>
		{/if}

		<!-- Form -->
		<form on:submit|preventDefault={handleSubmit} class="space-y-5">
			<!-- Name -->
			<div>
				<label for="name" class="block text-sm font-medium text-gray-700 mb-1">
					Ledger Name <span class="text-red-500">*</span>
				</label>
				<input
					id="name"
					type="text"
					bind:value={name}
					on:blur={handleNameBlur}
					disabled={isSubmitting}
					class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed {errors.name ? 'border-red-500' : 'border-gray-300'}"
					placeholder="e.g., Checking Account, Savings, Credit Card"
					autocomplete="off"
				/>
				{#if errors.name}
					<p class="mt-1 text-sm text-red-600">{errors.name}</p>
				{/if}
			</div>

			<!-- Starting Balance -->
			<div>
				<label for="starting_balance" class="block text-sm font-medium text-gray-700 mb-1">
					Starting Balance
				</label>
				<div class="relative">
					<span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
					<input
						id="starting_balance"
						type="text"
						bind:value={starting_balance}
						on:blur={handleStartingBalanceBlur}
						disabled={isSubmitting}
						class="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed {errors.starting_balance ? 'border-red-500' : 'border-gray-300'}"
						placeholder="0.00"
					/>
				</div>
				{#if errors.starting_balance}
					<p class="mt-1 text-sm text-red-600">{errors.starting_balance}</p>
				{/if}
			</div>

			<!-- Starting Balance Date -->
			<div>
				<label for="starting_balance_date" class="block text-sm font-medium text-gray-700 mb-1">
					Starting Balance Date
				</label>
				<input
					id="starting_balance_date"
					type="date"
					bind:value={starting_balance_date}
					disabled={isSubmitting}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
				/>
				<p class="mt-1 text-xs text-gray-500">Optional: When this balance was recorded</p>
			</div>

			<!-- Actions -->
			<div class="flex gap-3 pt-4">
				<button
					type="button"
					on:click={handleCancel}
					disabled={isSubmitting}
					class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={isSubmitting}
					class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
				>
					{#if isSubmitting}
						<span class="flex items-center justify-center">
							<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							{isEditing ? 'Saving...' : 'Creating...'}
						</span>
					{:else}
						{isEditing ? 'Save Changes' : 'Create Ledger'}
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
