// ── 3 required error types ────────────────────────────────────────────────────
export type WalletErrorType =
  | 'WALLET_NOT_FOUND'       // Extension chưa cài
  | 'USER_REJECTED'          // User bấm Cancel
  | 'INSUFFICIENT_BALANCE';  // Không đủ XLM

export interface WalletError {
  type: WalletErrorType;
  message: string;
}

// ── Transaction status tracking ───────────────────────────────────────────────
export type TxStatus = 'idle' | 'building' | 'signing' | 'submitting' | 'success' | 'error';

export interface TxState {
  status: TxStatus;
  hash: string | null;
  error: string | null;
}

// ── Tip Jar contract data ─────────────────────────────────────────────────────
export interface TipJarInfo {
  owner: string;
  totalTips: bigint;   // stroops
  tipCount: number;
}

// ── Wallet state ──────────────────────────────────────────────────────────────
export interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  walletName: string | null;
  balance: string | null;
  isLoading: boolean;
  error: WalletError | null;
}
