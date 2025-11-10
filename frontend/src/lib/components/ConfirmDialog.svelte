<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let title: string = 'Confirm Action';
	export let message: string = 'Are you sure you want to proceed?';
	export let confirmText: string = 'Confirm';
	export let cancelText: string = 'Cancel';
	export let confirmClass: string = 'bg-blue-600 hover:bg-blue-700';

	const dispatch = createEventDispatcher();

	function handleConfirm() {
		dispatch('confirm');
	}

	function handleCancel() {
		dispatch('cancel');
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
		<div class="mb-4">
			<h2 class="text-xl font-bold text-gray-900">{title}</h2>
		</div>

		<!-- Message -->
		<div class="mb-6">
			<p class="text-gray-700">{message}</p>
		</div>

		<!-- Actions -->
		<div class="flex gap-3">
			<button
				type="button"
				on:click={handleCancel}
				class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
			>
				{cancelText}
			</button>
			<button
				type="button"
				on:click={handleConfirm}
				class="flex-1 text-white py-2 px-4 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors {confirmClass}"
			>
				{confirmText}
			</button>
		</div>
	</div>
</div>
