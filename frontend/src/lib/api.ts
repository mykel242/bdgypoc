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
 * Ledger Interfaces
 */
export interface Ledger {
  id: number;
  user_id: number;
  name: string;
  starting_balance: number;
  starting_balance_date: string | null;
  is_locked: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  transaction_count?: number;
  current_balance?: number;
}

export interface LedgerListResponse {
  ledgers: Ledger[];
  count: number;
}

export interface LedgerResponse {
  message: string;
  ledger: Ledger;
}

export interface LedgerBalanceResponse {
  ledger_id: number;
  ledger_name: string;
  starting_balance: number;
  current_balance: number;
  cleared_balance: number;
  transaction_count: number;
}

/**
 * Ledger API
 */
export const ledgers = {
  /**
   * Get all ledgers for current user
   */
  async list(includeArchived: boolean = false): Promise<LedgerListResponse> {
    const response = await apiFetch<LedgerListResponse>("/api/ledgers");

    // Filter out archived ledgers if requested
    if (!includeArchived) {
      return {
        ledgers: response.ledgers.filter(l => !l.is_archived),
        count: response.ledgers.filter(l => !l.is_archived).length,
      };
    }

    return response;
  },

  /**
   * Get a specific ledger
   */
  async get(id: number): Promise<{ ledger: Ledger }> {
    return apiFetch<{ ledger: Ledger }>(`/api/ledgers/${id}`);
  },

  /**
   * Create a new ledger
   */
  async create(data: {
    name: string;
    starting_balance?: number;
    starting_balance_date?: string;
  }): Promise<LedgerResponse> {
    return apiFetch<LedgerResponse>("/api/ledgers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a ledger
   */
  async update(
    id: number,
    data: {
      name?: string;
      starting_balance?: number;
      starting_balance_date?: string;
      is_locked?: boolean;
      is_archived?: boolean;
    },
  ): Promise<LedgerResponse> {
    return apiFetch<LedgerResponse>(`/api/ledgers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a ledger
   */
  async delete(id: number): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/ledgers/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * Get balance for a ledger
   */
  async getBalance(id: number): Promise<LedgerBalanceResponse> {
    return apiFetch<LedgerBalanceResponse>(`/api/ledgers/${id}/balance`);
  },

  /**
   * Copy a ledger with all its transactions
   */
  async copy(id: number): Promise<LedgerResponse> {
    return apiFetch<LedgerResponse>(`/api/ledgers/${id}/copy`, {
      method: "POST",
    });
  },
};

/**
 * Transaction Interfaces
 */
export interface Transaction {
  id: number;
  ledger_id: number;
  date: string;
  description: string;
  credit_amount: number;
  debit_amount: number;
  is_paid: boolean;
  is_cleared: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  count: number;
}

export interface TransactionResponse {
  message: string;
  transaction: Transaction;
}

/**
 * Transaction API
 */
export const transactions = {
  /**
   * Get all transactions for a ledger
   */
  async list(ledgerId: number): Promise<TransactionListResponse> {
    return apiFetch<TransactionListResponse>(`/api/transactions?ledger_id=${ledgerId}`);
  },

  /**
   * Get a specific transaction
   */
  async get(id: number): Promise<{ transaction: Transaction }> {
    return apiFetch<{ transaction: Transaction }>(`/api/transactions/${id}`);
  },

  /**
   * Create a new transaction
   */
  async create(data: {
    ledger_id: number;
    date: string;
    description: string;
    credit_amount?: number;
    debit_amount?: number;
    is_paid?: boolean;
    is_cleared?: boolean;
    sort_order?: number;
  }): Promise<TransactionResponse> {
    return apiFetch<TransactionResponse>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a transaction
   */
  async update(
    id: number,
    data: {
      date?: string;
      description?: string;
      credit_amount?: number;
      debit_amount?: number;
      is_paid?: boolean;
      is_cleared?: boolean;
      sort_order?: number;
    },
  ): Promise<TransactionResponse> {
    return apiFetch<TransactionResponse>(`/api/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a transaction
   */
  async delete(id: number): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/transactions/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * Toggle paid status
   */
  async togglePaid(id: number): Promise<TransactionResponse> {
    return apiFetch<TransactionResponse>(`/api/transactions/${id}/toggle-paid`, {
      method: "POST",
    });
  },

  /**
   * Toggle cleared status
   */
  async toggleCleared(id: number): Promise<TransactionResponse> {
    return apiFetch<TransactionResponse>(`/api/transactions/${id}/toggle-cleared`, {
      method: "POST",
    });
  },
};

/**
 * Export ApiError for error handling
 */
export { ApiError };
