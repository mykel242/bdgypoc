<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { authStore } from '$lib/stores/auth';
	import { auth as authApi } from '$lib/api';

	let currentPassword = '';
	let newPassword = '';
	let confirmPassword = '';
	let isSubmitting = false;
	let error = '';
	let success = '';

	// Password validation state
	let passwordErrors: string[] = [];

	// Auth check
	onMount(() => {
		const unsubscribe = authStore.subscribe(state => {
			if (!state.isAuthenticated && !state.isLoading) {
				goto(`${base}/login?returnUrl=${base}/settings`);
			}
		});

		return unsubscribe;
	});

	function validatePassword(password: string): string[] {
		const errors: string[] = [];
		if (password.length < 8) {
			errors.push('At least 8 characters');
		}
		if (!/[A-Z]/.test(password)) {
			errors.push('At least one uppercase letter');
		}
		if (!/[a-z]/.test(password)) {
			errors.push('At least one lowercase letter');
		}
		if (!/[0-9]/.test(password)) {
			errors.push('At least one number');
		}
		return errors;
	}

	function handleNewPasswordChange() {
		passwordErrors = validatePassword(newPassword);
		error = '';
		success = '';
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		error = '';
		success = '';

		// Validate passwords match
		if (newPassword !== confirmPassword) {
			error = 'New passwords do not match';
			return;
		}

		// Validate new password meets requirements
		const validationErrors = validatePassword(newPassword);
		if (validationErrors.length > 0) {
			error = 'New password does not meet requirements';
			return;
		}

		isSubmitting = true;

		try {
			await authApi.changePassword(currentPassword, newPassword);
			success = 'Password changed successfully';
			// Clear form
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			passwordErrors = [];
		} catch (err) {
			if (err instanceof Error) {
				error = err.message;
			} else {
				error = 'Failed to change password';
			}
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
	<div class="max-w-lg mx-auto">
		<!-- Header -->
		<div class="bg-white rounded-lg shadow-xl p-4 sm:p-6 mb-4 sm:mb-6">
			<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Settings</h1>
			{#if $authStore.user}
				<p class="text-sm sm:text-base text-gray-600">
					{$authStore.user.first_name} {$authStore.user.last_name} ({$authStore.user.email})
				</p>
			{/if}
		</div>

		<!-- Change Password Form -->
		<div class="bg-white rounded-lg shadow-xl p-4 sm:p-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Change Password</h2>

			{#if error}
				<div class="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
					<p class="text-red-700 text-sm">{error}</p>
				</div>
			{/if}

			{#if success}
				<div class="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
					<p class="text-green-700 text-sm">{success}</p>
				</div>
			{/if}

			<form on:submit={handleSubmit} class="space-y-4">
				<div>
					<label for="current-password" class="block text-sm font-medium text-gray-700 mb-1">
						Current Password
					</label>
					<input
						id="current-password"
						type="password"
						bind:value={currentPassword}
						required
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						disabled={isSubmitting}
					/>
				</div>

				<div>
					<label for="new-password" class="block text-sm font-medium text-gray-700 mb-1">
						New Password
					</label>
					<input
						id="new-password"
						type="password"
						bind:value={newPassword}
						on:input={handleNewPasswordChange}
						required
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						disabled={isSubmitting}
					/>
					{#if newPassword && passwordErrors.length > 0}
						<ul class="mt-2 text-sm text-red-600">
							{#each passwordErrors as err}
								<li class="flex items-center gap-1">
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
									</svg>
									{err}
								</li>
							{/each}
						</ul>
					{:else if newPassword && passwordErrors.length === 0}
						<p class="mt-2 text-sm text-green-600 flex items-center gap-1">
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
							</svg>
							Password meets requirements
						</p>
					{/if}
				</div>

				<div>
					<label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-1">
						Confirm New Password
					</label>
					<input
						id="confirm-password"
						type="password"
						bind:value={confirmPassword}
						required
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						disabled={isSubmitting}
					/>
					{#if confirmPassword && newPassword !== confirmPassword}
						<p class="mt-2 text-sm text-red-600 flex items-center gap-1">
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
							</svg>
							Passwords do not match
						</p>
					{:else if confirmPassword && newPassword === confirmPassword}
						<p class="mt-2 text-sm text-green-600 flex items-center gap-1">
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
							</svg>
							Passwords match
						</p>
					{/if}
				</div>

				<button
					type="submit"
					disabled={isSubmitting || passwordErrors.length > 0 || newPassword !== confirmPassword || !currentPassword || !newPassword}
					class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
				>
					{#if isSubmitting}
						<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Changing Password...
					{:else}
						Change Password
					{/if}
				</button>
			</form>
		</div>

		<!-- Admin Section -->
		{#if $authStore.user?.is_admin}
			<div class="bg-white rounded-lg shadow-xl p-4 sm:p-6 mt-4">
				<h2 class="text-xl font-semibold text-gray-900 mb-4">Admin</h2>
				<a
					href="{base}/admin/backups"
					class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
				>
					<div class="flex items-center gap-3">
						<svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
						</svg>
						<div>
							<p class="font-medium text-gray-900">Database Backups</p>
							<p class="text-sm text-gray-500">Create and manage database backups</p>
						</div>
					</div>
					<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</a>
			</div>
		{/if}

		<!-- Navigation -->
		<div class="mt-6 text-center space-y-2">
			<a href="{base}/ledgers" class="text-blue-600 hover:text-blue-700 font-medium block">
				Back to Ledgers
			</a>
		</div>
	</div>
</div>
