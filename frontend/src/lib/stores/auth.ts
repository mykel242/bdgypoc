/**
 * Authentication Store
 * Manages global authentication state using Svelte stores
 */

import { writable } from 'svelte/store';
import { auth as authApi, type User, ApiError } from '$lib/api';
import { goto } from '$app/navigation';
import { base } from '$app/paths';

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
		 * Register a new user
		 */
		async register(email: string, first_name: string, last_name: string, password: string): Promise<void> {
			try {
				update(state => ({ ...state, isLoading: true, error: null }));
				const response = await authApi.register(email, first_name, last_name, password);

				set({
					user: response.user,
					isAuthenticated: true,
					isLoading: false,
					error: null
				});

				// Redirect to ledgers after successful registration
				goto(`${base}/ledgers`);
			} catch (error) {
				const errorMessage = error instanceof ApiError
					? error.message
					: 'Failed to register';

				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage
				}));

				throw error; // Re-throw so component can handle it
			}
		},

		/**
		 * Login user
		 */
		async login(email: string, password: string, returnUrl?: string): Promise<void> {
			try {
				update(state => ({ ...state, isLoading: true, error: null }));
				const response = await authApi.login(email, password);

				set({
					user: response.user,
					isAuthenticated: true,
					isLoading: false,
					error: null
				});

				// Redirect to return URL or ledgers
				goto(returnUrl || `${base}/ledgers`);
			} catch (error) {
				const errorMessage = error instanceof ApiError
					? error.message
					: 'Failed to login';

				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage
				}));

				throw error; // Re-throw so component can handle it
			}
		},

		/**
		 * Logout user
		 */
		async logout(): Promise<void> {
			try {
				update(state => ({ ...state, isLoading: true, error: null }));
				await authApi.logout();

				set({
					user: null,
					isAuthenticated: false,
					isLoading: false,
					error: null
				});

				// Redirect to login
				goto(`${base}/login`);
			} catch (error) {
				// Even if logout fails on server, clear local state
				set({
					user: null,
					isAuthenticated: false,
					isLoading: false,
					error: null
				});

				goto(`${base}/login`);
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
		}
	};
}

export const authStore = createAuthStore();
