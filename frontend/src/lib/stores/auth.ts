/**
 * Authentication Store
 * Manages global authentication state using Svelte stores
 */

import { writable } from 'svelte/store';
import { auth as authApi, type User, ApiError } from '$lib/api';

interface AuthState {
	user: User | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	error: string | null;
}

const initialState: AuthState = {
	user: null,
	isAuthenticated: false,
	isLoading: true, // Start with loading true (will check auth on init)
	error: null
};

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);

	return {
		subscribe,

		/**
		 * Check if user is authenticated (call on app init)
		 */
		async checkAuth(): Promise<void> {
			try {
				update(state => ({ ...state, isLoading: true, error: null }));
				const response = await authApi.check();

				if (response.authenticated) {
					// Get full user info
					const { user } = await authApi.me();
					set({
						user,
						isAuthenticated: true,
						isLoading: false,
						error: null
					});
				} else {
					set({
						user: null,
						isAuthenticated: false,
						isLoading: false,
						error: null
					});
				}
			} catch (error) {
				// If check fails, assume not authenticated
				set({
					user: null,
					isAuthenticated: false,
					isLoading: false,
					error: null
				});
			}
		},

		/**
		 * Clear any error messages
		 */
		clearError(): void {
			update(state => ({ ...state, error: null }));
		},

		/**
		 * Clear authentication state (without API call)
		 */
		clearAuth(): void {
			set({
				user: null,
				isAuthenticated: false,
				isLoading: false,
				error: null
			});
		},

		/**
		 * Change user password
		 */
		async changePassword(currentPassword: string, newPassword: string): Promise<void> {
			try {
				update(state => ({ ...state, isLoading: true, error: null }));
				await authApi.changePassword(currentPassword, newPassword);
				update(state => ({ ...state, isLoading: false, error: null }));
			} catch (error) {
				const errorMessage = error instanceof ApiError
					? error.message
					: 'Failed to change password';

				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage
				}));

				throw error;
			}
		}
	};
}

export const authStore = createAuthStore();
