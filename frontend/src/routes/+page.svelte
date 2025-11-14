<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { base } from '$app/paths';

	let { user, isAuthenticated, isLoading } = $derived($authStore);

	async function handleLogout() {
		await authStore.logout();
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
	<div class="max-w-2xl w-full">
		<div class="bg-white rounded-lg shadow-xl p-8">
			<div class="text-center mb-8">
				<h1 class="text-4xl font-bold text-gray-900 mb-2">
					Welcome to Budgie
				</h1>
				<p class="text-xl text-gray-600">
					Your Personal Finance Ledger
				</p>
			</div>

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
								rel="noopener noreferrer"
								class="text-blue-600 hover:text-blue-800 hover:underline"
							>
								→ API Health Check
							</a>
						</li>
						<li>
							<a
								href="http://localhost:3001/api"
								target="_blank"
								rel="noopener noreferrer"
								class="text-blue-600 hover:text-blue-800 hover:underline"
							>
								→ API Documentation
							</a>
						</li>
						<li>
							<a
								href="https://svelte.dev/docs/kit"
								target="_blank"
								rel="noopener noreferrer"
								class="text-blue-600 hover:text-blue-800 hover:underline"
							>
								→ SvelteKit Docs
							</a>
						</li>
					</ul>
					<p class="text-xs text-gray-500 mt-4">
						Frontend is at /budgie-v2/ (matches production base path)
					</p>
				</div>

				{#if isLoading}
					<div class="flex justify-center pt-4 border-t">
						<p class="text-gray-500">Loading...</p>
					</div>
				{:else if isAuthenticated && user}
					<div class="pt-4 border-t">
						<div class="text-center mb-4">
							<p class="text-gray-700">
								Welcome back, <span class="font-semibold">{user.first_name} {user.last_name}</span>!
							</p>
							<p class="text-sm text-gray-500">{user.email}</p>
						</div>
						<div class="flex gap-4 justify-center">
							<a
								href="{base}/ledgers"
								class="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
							>
								Go to Ledgers
							</a>
							<button
								on:click={handleLogout}
								class="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
							>
								Logout
							</button>
						</div>
					</div>
				{:else}
					<div class="flex gap-4 justify-center pt-4 border-t">
						<a
							href="{base}/login"
							class="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
						>
							Login
						</a>
						<a
							href="{base}/register"
							class="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
						>
							Register
						</a>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
