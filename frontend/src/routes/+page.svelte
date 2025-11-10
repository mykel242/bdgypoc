<script lang="ts">
	import { authStore } from '$lib/stores/auth';

	async function handleLogout() {
		await authStore.logout();
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
	<div class="max-w-2xl w-full">
		<div class="bg-white rounded-lg shadow-xl p-8">
			<!-- Header -->
			<div class="text-center mb-8">
				<h1 class="text-4xl font-bold text-gray-900 mb-2">
					Welcome to Budgie
				</h1>
				{#if $authStore.isAuthenticated && $authStore.user}
					<p class="text-xl text-gray-600">
						Hello, <span class="font-semibold text-blue-600">{$authStore.user.first_name}</span>!
					</p>
				{:else}
					<p class="text-xl text-gray-600">
						Your Personal Finance Ledger
					</p>
				{/if}
			</div>

			<!-- Authentication Actions -->
			{#if $authStore.isAuthenticated}
				<div class="mb-6 flex justify-center gap-3">
					<a
						href="/ledgers"
						class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					>
						My Ledgers
					</a>
					<button
						on:click={handleLogout}
						class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
					>
						Log Out
					</button>
				</div>
			{:else if !$authStore.isLoading}
				<div class="mb-6 flex justify-center gap-3">
					<a
						href="/login"
						class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					>
						Log In
					</a>
					<a
						href="/register"
						class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
					>
						Sign Up
					</a>
				</div>
			{/if}

			<div class="space-y-6">
				<div class="bg-blue-50 border-l-4 border-blue-500 p-4">
					<h2 class="text-lg font-semibold text-blue-900 mb-2">
						🚀 Development Mode
					</h2>
					<p class="text-blue-700">
						The web service is running! This is the SvelteKit frontend.
					</p>
				</div>

				<div class="grid md:grid-cols-2 gap-4">
					<div class="p-4 bg-gray-50 rounded-lg">
						<h3 class="font-semibold text-gray-900 mb-2">Frontend</h3>
						<p class="text-sm text-gray-600">SvelteKit + TypeScript + Tailwind CSS v4</p>
						<p class="text-xs text-green-600 mt-1">✓ Running on port 5173</p>
					</div>

					<div class="p-4 bg-gray-50 rounded-lg">
						<h3 class="font-semibold text-gray-900 mb-2">Backend API</h3>
						<p class="text-sm text-gray-600">Express + PostgreSQL + Sequelize</p>
						<p class="text-xs text-green-600 mt-1">✓ Running on port 3001</p>
					</div>
				</div>

				<div class="border-t pt-6">
					<h3 class="font-semibold text-gray-900 mb-3">Quick Links:</h3>
					<ul class="space-y-2">
						<li>
							<a
								href="http://localhost:3001/health"
								target="_blank"
								class="text-blue-600 hover:text-blue-800 hover:underline"
							>
								→ API Health Check
							</a>
						</li>
						<li>
							<a
								href="http://localhost:3001/api"
								target="_blank"
								class="text-blue-600 hover:text-blue-800 hover:underline"
							>
								→ API Documentation
							</a>
						</li>
						<li>
							<a
								href="https://svelte.dev/docs/kit"
								target="_blank"
								class="text-blue-600 hover:text-blue-800 hover:underline"
							>
								→ SvelteKit Docs
							</a>
						</li>
					</ul>
				</div>

				<div class="text-center text-sm text-gray-500 pt-4 border-t">
					Next: Build authentication, ledgers, and transaction management
				</div>
			</div>
		</div>
	</div>
</div>
