/**
 * Ledger Store
 * Manages ledger state and operations
 */

import { writable } from 'svelte/store';
import { ledgers as ledgersApi, type Ledger, ApiError } from '$lib/api';

interface LedgerState {
	ledgers: Ledger[];
	isLoading: boolean;
	error: string | null;
	showArchived: boolean;
}

function createLedgerStore() {
	const { subscribe, set, update } = writable<LedgerState>({
		ledgers: [],
		isLoading: false,
		error: null,
		showArchived: false,
	});

	return {
		subscribe,

		/**
		 * Load all ledgers
		 */
		async loadLedgers(includeArchived: boolean = false): Promise<void> {
			update(state => ({ ...state, isLoading: true, error: null }));
			try {
				const response = await ledgersApi.list(includeArchived);
				update(state => ({
					...state,
					ledgers: response.ledgers,
					isLoading: false,
					showArchived: includeArchived,
				}));
			} catch (error) {
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to load ledgers';
				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage,
				}));
				throw error;
			}
		},

		/**
		 * Create a new ledger
		 */
		async createLedger(data: {
			name: string;
			starting_balance?: number;
			starting_balance_date?: string;
		}): Promise<Ledger> {
			update(state => ({ ...state, isLoading: true, error: null }));
			try {
				const response = await ledgersApi.create(data);
				update(state => ({
					...state,
					ledgers: [...state.ledgers, response.ledger],
					isLoading: false,
				}));
				return response.ledger;
			} catch (error) {
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to create ledger';
				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage,
				}));
				throw error;
			}
		},

		/**
		 * Update a ledger
		 */
		async updateLedger(
			id: number,
			data: {
				name?: string;
				starting_balance?: number;
				starting_balance_date?: string;
				is_locked?: boolean;
				is_archived?: boolean;
			}
		): Promise<Ledger> {
			update(state => ({ ...state, isLoading: true, error: null }));
			try {
				const response = await ledgersApi.update(id, data);
				update(state => ({
					...state,
					ledgers: state.ledgers.map(l => (l.id === id ? response.ledger : l)),
					isLoading: false,
				}));
				return response.ledger;
			} catch (error) {
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to update ledger';
				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage,
				}));
				throw error;
			}
		},

		/**
		 * Delete a ledger
		 */
		async deleteLedger(id: number): Promise<void> {
			update(state => ({ ...state, isLoading: true, error: null }));
			try {
				await ledgersApi.delete(id);
				update(state => ({
					...state,
					ledgers: state.ledgers.filter(l => l.id !== id),
					isLoading: false,
				}));
			} catch (error) {
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to delete ledger';
				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage,
				}));
				throw error;
			}
		},

		/**
		 * Copy a ledger
		 */
		async copyLedger(id: number): Promise<Ledger> {
			update(state => ({ ...state, isLoading: true, error: null }));
			try {
				const response = await ledgersApi.copy(id);
				update(state => ({
					...state,
					ledgers: [...state.ledgers, response.ledger],
					isLoading: false,
				}));
				return response.ledger;
			} catch (error) {
				const errorMessage = error instanceof ApiError ? error.message : 'Failed to copy ledger';
				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage,
				}));
				throw error;
			}
		},

		/**
		 * Toggle lock status of a ledger
		 */
		async toggleLock(id: number, currentLockStatus: boolean): Promise<void> {
			await this.updateLedger(id, { is_locked: !currentLockStatus });
		},

		/**
		 * Toggle archive status of a ledger
		 */
		async toggleArchive(id: number, currentArchiveStatus: boolean): Promise<void> {
			await this.updateLedger(id, { is_archived: !currentArchiveStatus });
		},

		/**
		 * Toggle showing archived ledgers
		 */
		async toggleShowArchived(): Promise<void> {
			let newShowArchivedValue: boolean;
			update(state => {
				newShowArchivedValue = !state.showArchived;
				return { ...state, showArchived: newShowArchivedValue };
			});
			// Reload ledgers with new showArchived setting
			await this.loadLedgers(newShowArchivedValue);
		},

		/**
		 * Clear error
		 */
		clearError(): void {
			update(state => ({ ...state, error: null }));
		},
	};
}

export const ledgerStore = createLedgerStore();
