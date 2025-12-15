/**
 * Transaction Store
 * Manages transaction state and operations for a specific ledger
 */

import { writable, get } from 'svelte/store';
import { transactions as transactionsApi, type Transaction, ApiError } from '$lib/api';

interface TransactionState {
	transactions: Transaction[];
	isLoading: boolean;
	error: string | null;
	ledgerId: number | null;
}

function createTransactionStore() {
	const store = writable<TransactionState>({
		transactions: [],
		isLoading: false,
		error: null,
		ledgerId: null,
	});

	const { subscribe, set, update } = store;

	return {
		subscribe,

		/**
		 * Load all transactions for a ledger
		 */
		async loadTransactions(ledgerId: number): Promise<void> {
			update(state => ({ ...state, isLoading: true, error: null, ledgerId }));
			try {
				const response = await transactionsApi.list(ledgerId);
				// Sort by sort_order only (user controls order via drag and drop)
				const sorted = response.transactions.sort((a, b) => a.sort_order - b.sort_order);
				update(state => ({
					...state,
					transactions: sorted,
					isLoading: false,
				}));
			} catch (error) {
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to load transactions';
				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage,
				}));
				throw error;
			}
		},

		/**
		 * Create a new transaction
		 */
		async createTransaction(data: {
			ledger_id: number;
			date: string;
			description: string;
			credit_amount?: number;
			debit_amount?: number;
			is_paid?: boolean;
			is_cleared?: boolean;
		}): Promise<Transaction> {
			update(state => ({ ...state, isLoading: true, error: null }));
			try {
				// Calculate sort_order (highest + 1)
				const currentState = get(store);
				const currentTransactions = currentState.transactions;

				const highestSort = currentTransactions.length > 0
					? Math.max(...currentTransactions.map(t => t.sort_order))
					: -1;

				const response = await transactionsApi.create({
					...data,
					sort_order: highestSort + 1,
				});

				update(state => ({
					...state,
					transactions: [...state.transactions, response.transaction].sort((a, b) => a.sort_order - b.sort_order),
					isLoading: false,
				}));

				return response.transaction;
			} catch (error) {
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to create transaction';
				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage,
				}));
				throw error;
			}
		},

		/**
		 * Update a transaction
		 */
		async updateTransaction(
			id: number,
			data: {
				date?: string;
				description?: string;
				credit_amount?: number;
				debit_amount?: number;
				is_paid?: boolean;
				is_cleared?: boolean;
			}
		): Promise<Transaction> {
			try {
				const response = await transactionsApi.update(id, data);
				update(state => ({
					...state,
					transactions: state.transactions.map(t =>
						t.id === id ? response.transaction : t
					).sort((a, b) => a.sort_order - b.sort_order),
				}));
				return response.transaction;
			} catch (error) {
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to update transaction';
				update(state => ({
					...state,
					error: errorMessage,
				}));
				throw error;
			}
		},

		/**
		 * Delete a transaction
		 */
		async deleteTransaction(id: number): Promise<void> {
			try {
				await transactionsApi.delete(id);
				update(state => ({
					...state,
					transactions: state.transactions.filter(t => t.id !== id),
				}));
			} catch (error) {
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to delete transaction';
				update(state => ({
					...state,
					error: errorMessage,
				}));
				throw error;
			}
		},

		/**
		 * Reorder transactions (for drag and drop)
		 * Updates sort_order for all affected transactions
		 */
		async reorderTransactions(fromIndex: number, toIndex: number): Promise<void> {
			const currentState = get(store);
			const transactions = [...currentState.transactions];

			// Remove the item from its original position
			const [movedItem] = transactions.splice(fromIndex, 1);
			// Insert it at the new position
			transactions.splice(toIndex, 0, movedItem);

			// Update sort_order for all transactions
			const updatedTransactions = transactions.map((t, index) => ({
				...t,
				sort_order: index,
			}));

			// Optimistically update the UI
			update(state => ({
				...state,
				transactions: updatedTransactions,
			}));

			// Persist the changes to the backend
			try {
				// Update each transaction's sort_order
				await Promise.all(
					updatedTransactions.map((t, index) =>
						transactionsApi.update(t.id, { sort_order: index })
					)
				);
			} catch (error) {
				// Revert on error by reloading
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to reorder transactions';
				update(state => ({
					...state,
					error: errorMessage,
				}));
				// Reload to get correct order from server
				if (currentState.ledgerId) {
					await this.loadTransactions(currentState.ledgerId);
				}
				throw error;
			}
		},

		/**
		 * Toggle paid status
		 */
		async togglePaid(id: number): Promise<void> {
			try {
				const response = await transactionsApi.togglePaid(id);
				update(state => ({
					...state,
					transactions: state.transactions.map(t =>
						t.id === id ? response.transaction : t
					),
				}));
			} catch (error) {
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to toggle paid status';
				update(state => ({
					...state,
					error: errorMessage,
				}));
				throw error;
			}
		},

		/**
		 * Toggle cleared status
		 */
		async toggleCleared(id: number): Promise<void> {
			try {
				const response = await transactionsApi.toggleCleared(id);
				update(state => ({
					...state,
					transactions: state.transactions.map(t =>
						t.id === id ? response.transaction : t
					),
				}));
			} catch (error) {
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to toggle cleared status';
				update(state => ({
					...state,
					error: errorMessage,
				}));
				throw error;
			}
		},

		/**
		 * Clear error
		 */
		clearError(): void {
			update(state => ({ ...state, error: null }));
		},

		/**
		 * Clear all transactions (when navigating away)
		 */
		clear(): void {
			set({
				transactions: [],
				isLoading: false,
				error: null,
				ledgerId: null,
			});
		},
	};
}

export const transactionStore = createTransactionStore();
