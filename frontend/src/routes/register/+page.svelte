<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { ApiError } from '$lib/api';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let email = '';
	let first_name = '';
	let last_name = '';
	let password = '';
	let confirmPassword = '';
	let showPassword = false;
	let showConfirmPassword = false;

	let isSubmitting = false;
	let errors: Record<string, string> = {};
	let serverError = '';
	let successMessage = '';

	// Redirect if already authenticated
	onMount(() => {
		const unsubscribe = authStore.subscribe(state => {
			if (state.isAuthenticated && !state.isLoading) {
				goto('/');
			}
		});
		return unsubscribe;
	});

	// Client-side validation
	function validateEmail(): string | null {
		if (!email) return 'Email is required';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return 'Must be a valid email address';
		}
		return null;
	}

	function validateFirstName(): string | null {
		if (!first_name) return 'First name is required';
		if (first_name.length > 100) return 'First name must be less than 100 characters';
		return null;
	}

	function validateLastName(): string | null {
		if (!last_name) return 'Last name is required';
		if (last_name.length > 100) return 'Last name must be less than 100 characters';
		return null;
	}

	function validatePassword(): string | null {
		if (!password) return 'Password is required';
		if (password.length < 8) return 'Password must be at least 8 characters';
		if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
		if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
		if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
		return null;
	}

	function validateConfirmPassword(): string | null {
		if (!confirmPassword) return 'Please confirm your password';
		if (confirmPassword !== password) return 'Passwords do not match';
		return null;
	}

	// Real-time validation
	function handleEmailBlur() {
		const error = validateEmail();
		if (error) {
			errors.email = error;
		} else {
			delete errors.email;
		}
		errors = errors;
	}

	function handleFirstNameBlur() {
		const error = validateFirstName();
		if (error) {
			errors.first_name = error;
		} else {
			delete errors.first_name;
		}
		errors = errors;
	}

	function handleLastNameBlur() {
		const error = validateLastName();
		if (error) {
			errors.last_name = error;
		} else {
			delete errors.last_name;
		}
		errors = errors;
	}

	function handlePasswordBlur() {
		const error = validatePassword();
		if (error) {
			errors.password = error;
		} else {
			delete errors.password;
		}
		// Also revalidate confirm password if it's already filled
		if (confirmPassword) {
			handleConfirmPasswordBlur();
		}
		errors = errors;
	}

	function handleConfirmPasswordBlur() {
		const error = validateConfirmPassword();
		if (error) {
			errors.confirmPassword = error;
		} else {
			delete errors.confirmPassword;
		}
		errors = errors;
	}

	async function handleSubmit() {
		// Clear previous errors and messages
		errors = {};
		serverError = '';
		successMessage = '';

		// Validate all fields
		const emailError = validateEmail();
		const firstNameError = validateFirstName();
		const lastNameError = validateLastName();
		const passwordError = validatePassword();
		const confirmPasswordError = validateConfirmPassword();

		if (emailError) errors.email = emailError;
		if (firstNameError) errors.first_name = firstNameError;
		if (lastNameError) errors.last_name = lastNameError;
		if (passwordError) errors.password = passwordError;
		if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;

		if (Object.keys(errors).length > 0) {
			errors = errors;
			return;
		}

		// Submit to API
		isSubmitting = true;
		try {
			await authStore.register(email, first_name, last_name, password);
			// Show success message instead of redirecting
			successMessage = 'Account created successfully! Please log in with your credentials.';
			// Clear form
			email = '';
			first_name = '';
			last_name = '';
			password = '';
			confirmPassword = '';
		} catch (error) {
			console.log('Registration error caught:', error);
			if (error instanceof ApiError) {
				console.log('ApiError details:', error.details);
				console.log('ApiError message:', error.message);
				// Handle field-specific errors from backend
				if (error.details && error.details.length > 0) {
					error.details.forEach(detail => {
						errors[detail.param] = detail.msg;
					});
					errors = errors;
				} else {
					// Generic error message
					serverError = error.message;
				}
			} else {
				console.log('Unknown error type:', error);
				serverError = 'An unexpected error occurred. Please try again.';
			}
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
	<div class="max-w-md w-full">
		<div class="bg-white rounded-lg shadow-xl p-8">
			<!-- Header -->
			<div class="text-center mb-8">
				<h1 class="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
				<p class="text-gray-600">Get started with Budgie</p>
			</div>

			<!-- Success Message -->
			{#if successMessage}
				<div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
					<p class="text-green-700 text-sm">{successMessage}</p>
					<a href="/budgie-v2/login" class="text-green-600 hover:text-green-800 font-medium text-sm mt-2 inline-block">
						Go to Login →
					</a>
				</div>
			{/if}

			<!-- Server Error -->
			{#if serverError}
				<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
					<p class="text-red-700 text-sm">{serverError}</p>
				</div>
			{/if}

			<!-- Form -->
			<form on:submit|preventDefault={handleSubmit} class="space-y-5">
				<!-- Email -->
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
						Email
					</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						on:blur={handleEmailBlur}
						disabled={isSubmitting}
						class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed {errors.email ? 'border-red-500' : 'border-gray-300'}"
						placeholder="john@example.com"
						autocomplete="email"
					/>
					{#if errors.email}
						<p class="mt-1 text-sm text-red-600">{errors.email}</p>
					{/if}
				</div>

				<!-- First Name -->
				<div>
					<label for="first_name" class="block text-sm font-medium text-gray-700 mb-1">
						First Name
					</label>
					<input
						id="first_name"
						type="text"
						bind:value={first_name}
						on:blur={handleFirstNameBlur}
						disabled={isSubmitting}
						class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed {errors.first_name ? 'border-red-500' : 'border-gray-300'}"
						placeholder="John"
						autocomplete="given-name"
					/>
					{#if errors.first_name}
						<p class="mt-1 text-sm text-red-600">{errors.first_name}</p>
					{/if}
				</div>

				<!-- Last Name -->
				<div>
					<label for="last_name" class="block text-sm font-medium text-gray-700 mb-1">
						Last Name
					</label>
					<input
						id="last_name"
						type="text"
						bind:value={last_name}
						on:blur={handleLastNameBlur}
						disabled={isSubmitting}
						class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed {errors.last_name ? 'border-red-500' : 'border-gray-300'}"
						placeholder="Doe"
						autocomplete="family-name"
					/>
					{#if errors.last_name}
						<p class="mt-1 text-sm text-red-600">{errors.last_name}</p>
					{/if}
				</div>

				<!-- Password -->
				<div>
					<label for="password" class="block text-sm font-medium text-gray-700 mb-1">
						Password
					</label>
					<div class="relative">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							on:blur={handlePasswordBlur}
							disabled={isSubmitting}
							class="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed {errors.password ? 'border-red-500' : 'border-gray-300'}"
							placeholder="••••••••"
							autocomplete="new-password"
						/>
						<button
							type="button"
							on:click={() => showPassword = !showPassword}
							disabled={isSubmitting}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
								</svg>
							{:else}
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							{/if}
						</button>
					</div>
					{#if errors.password}
						<p class="mt-1 text-sm text-red-600">{errors.password}</p>
					{/if}
				</div>

				<!-- Confirm Password -->
				<div>
					<label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
						Confirm Password
					</label>
					<div class="relative">
						<input
							id="confirmPassword"
							type={showConfirmPassword ? 'text' : 'password'}
							bind:value={confirmPassword}
							on:blur={handleConfirmPasswordBlur}
							disabled={isSubmitting}
							class="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed {errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}"
							placeholder="••••••••"
							autocomplete="new-password"
						/>
						<button
							type="button"
							on:click={() => showConfirmPassword = !showConfirmPassword}
							disabled={isSubmitting}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed"
							aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
						>
							{#if showConfirmPassword}
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
								</svg>
							{:else}
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							{/if}
						</button>
					</div>
					{#if errors.confirmPassword}
						<p class="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
					{/if}
				</div>

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={isSubmitting}
					class="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
				>
					{#if isSubmitting}
						<span class="flex items-center justify-center">
							<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Creating account...
						</span>
					{:else}
						Create Account
					{/if}
				</button>
			</form>

			<!-- Login Link -->
			<div class="mt-6 text-center">
				<p class="text-sm text-gray-600">
					Already have an account?
					<a href="/login" class="text-blue-600 hover:text-blue-700 font-medium">
						Log in
					</a>
				</p>
			</div>
		</div>
	</div>
</div>
