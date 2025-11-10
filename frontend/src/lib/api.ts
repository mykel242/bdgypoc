/**
 * API Client for Budgie Backend
 * Handles all HTTP requests to the Express API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface User {
  id: number;
  uuid: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
}

export interface CheckAuthResponse {
  authenticated: boolean;
  userId?: number;
  userUuid?: string;
  userEmail?: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: Array<{
    msg: string;
    param: string;
    location?: string;
  }>;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: ErrorResponse["details"],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Base fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions: RequestInit = {
    credentials: "include", // Include cookies for session
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    const data = await response.json();

    if (!response.ok) {
      const errorData = data as ErrorResponse;
      throw new ApiError(
        errorData.message || errorData.error || "Request failed",
        response.status,
        errorData.details,
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network or parsing errors
    if (error instanceof TypeError) {
      throw new ApiError("Unable to connect to server", 0);
    }

    throw new ApiError("An unexpected error occurred", 0);
  }
}

/**
 * Authentication API
 */
export const auth = {
  /**
   * Register a new user
   */
  async register(
    email: string,
    first_name: string,
    last_name: string,
    password: string,
  ): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, first_name, last_name, password }),
    });
  },

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  /**
   * Logout user
   */
  async logout(): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/api/auth/logout", {
      method: "POST",
    });
  },

  /**
   * Check if user is authenticated
   */
  async check(): Promise<CheckAuthResponse> {
    return apiFetch<CheckAuthResponse>("/api/auth/check");
  },

  /**
   * Get current user info (requires authentication)
   */
  async me(): Promise<{ user: User }> {
    return apiFetch<{ user: User }>("/api/auth/me");
  },
};

/**
 * Export ApiError for error handling
 */
export { ApiError };
