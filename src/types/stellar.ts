export interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  balance: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface TransactionState {
  isLoading: boolean;
  hash: string | null;
  status: 'idle' | 'pending' | 'success' | 'error';
  error: string | null;
}
