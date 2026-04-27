import { useState, useCallback, useEffect } from 'react';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
import { WalletState, WalletError, WalletErrorType, TxState } from '../types';
import {
  horizonServer,
  NETWORK_PASSPHRASE,
  buildTipXdr,
  submitAndConfirm,
  xlmToStroops,
  CONTRACT_ID,
} from '../utils/contract';

function classifyError(err: unknown): WalletError {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  let type: WalletErrorType;
  let message: string;
  if (lower.includes('not installed') || lower.includes('not found') || lower.includes('not available')) {
    type = 'WALLET_NOT_FOUND';
    message = 'Wallet extension not installed. Please install Freighter or xBull, then refresh.';
  } else if (lower.includes('reject') || lower.includes('cancel') || lower.includes('denied') || lower.includes('closed')) {
    type = 'USER_REJECTED';
    message = 'You rejected the request in your wallet. Try again when ready.';
  } else if (lower.includes('balance') || lower.includes('insufficient') || lower.includes('underfunded')) {
    type = 'INSUFFICIENT_BALANCE';
    message = 'Insufficient XLM balance. Fund your wallet on testnet first.';
  } else {
    type = 'USER_REJECTED';
    message = msg;
  }
  return { type, message };
}

// Initialize kit once (static API in v2)
let _initialized = false;
function initKit() {
  if (_initialized) return;
  StellarWalletsKit.init({
    network: 'Test SDF Network ; September 2015',
    selectedWalletId: FREIGHTER_ID,
    modules: [new FreighterModule(), new xBullModule(), new LobstrModule()],
  });
  _initialized = true;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false, publicKey: null, walletName: null,
    balance: null, isLoading: false, error: null,
  });

  const [txState, setTxState] = useState<TxState>({
    status: 'idle', hash: null, error: null,
  });

  // Initialize kit on first render
  useEffect(() => { initKit(); }, []);

  const fetchBalance = useCallback(async (pk: string): Promise<string> => {
    try {
      const acct = await horizonServer.loadAccount(pk);
      const xlm = acct.balances.find((b: { asset_type: string }) => b.asset_type === 'native');
      return xlm ? parseFloat(xlm.balance).toFixed(4) : '0.0000';
    } catch { return '0.0000'; }
  }, []);

  const refreshBalance = useCallback(() => {
    if (wallet.publicKey) {
      fetchBalance(wallet.publicKey).then(balance =>
        setWallet(prev => ({ ...prev, balance }))
      );
    }
  }, [wallet.publicKey, fetchBalance]);

  // Auto-reconnect from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('swk_session');
    if (!saved) return;
    try {
      const { walletId, publicKey, walletName } = JSON.parse(saved);
      initKit();
      StellarWalletsKit.setWallet(walletId);
      fetchBalance(publicKey).then(balance => {
        setWallet({ isConnected: true, publicKey, walletName, balance, isLoading: false, error: null });
      }).catch(() => localStorage.removeItem('swk_session'));
    } catch { localStorage.removeItem('swk_session'); }
  }, [fetchBalance]);

  // Connect: opens auth modal (v2 API)
  const connect = useCallback(async () => {
    setWallet(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      initKit();
      // authModal returns { address } after user picks wallet & approves
      const { address } = await StellarWalletsKit.authModal();
      if (!address) throw new Error('No address returned from wallet');

      const balance = await fetchBalance(address);
      // Try to figure out wallet name from available wallets
      const wallets = await StellarWalletsKit.refreshSupportedWallets();
      const activeWallet = wallets.find(w => w.isAvailable);
      const walletName = activeWallet?.name ?? 'Wallet';

      setWallet({ isConnected: true, publicKey: address, walletName, balance, isLoading: false, error: null });
      localStorage.setItem('swk_session', JSON.stringify({
        walletId: activeWallet?.id ?? FREIGHTER_ID,
        publicKey: address,
        walletName,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // User closed modal
      if (msg.includes('closed')) {
        setWallet(prev => ({ ...prev, isLoading: false }));
      } else {
        setWallet(prev => ({ ...prev, isLoading: false, error: classifyError(err) }));
      }
    }
  }, [fetchBalance]);

  const disconnect = useCallback(() => {
    localStorage.removeItem('swk_session');
    StellarWalletsKit.disconnect().catch(() => {});
    setWallet({ isConnected: false, publicKey: null, walletName: null, balance: null, isLoading: false, error: null });
    setTxState({ status: 'idle', hash: null, error: null });
  }, []);

  // Send tip: build → sign → submit
  const sendTip = useCallback(async (xlmAmount: string) => {
    if (!wallet.publicKey) return;

    const available = parseFloat(wallet.balance ?? '0');
    const needed = parseFloat(xlmAmount);
    if (needed >= available - 0.5) {
      setTxState({ status: 'error', hash: null, error: 'INSUFFICIENT_BALANCE: Not enough XLM. Keep at least 0.5 XLM for fees.' });
      setWallet(prev => ({ ...prev, error: { type: 'INSUFFICIENT_BALANCE', message: 'Not enough XLM for this tip + fees.' } }));
      return;
    }

    setTxState({ status: 'building', hash: null, error: null });
    setWallet(prev => ({ ...prev, error: null }));

    try {
      const xdr = await buildTipXdr(wallet.publicKey, xlmToStroops(xlmAmount));

      setTxState(prev => ({ ...prev, status: 'signing' }));
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: wallet.publicKey,
      });

      setTxState(prev => ({ ...prev, status: 'submitting' }));
      const hash = await submitAndConfirm(signedTxXdr);

      setTxState({ status: 'success', hash, error: null });
      refreshBalance();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const rejected = msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('denied');
      setTxState({ status: 'error', hash: null, error: rejected ? 'USER_REJECTED: Transaction signing was rejected.' : msg });
      if (rejected) setWallet(prev => ({ ...prev, error: { type: 'USER_REJECTED', message: 'You rejected the transaction signing.' } }));
    }
  }, [wallet.publicKey, wallet.balance, refreshBalance]);

  const resetTx = useCallback(() => setTxState({ status: 'idle', hash: null, error: null }), []);

  return { wallet, txState, connect, disconnect, sendTip, resetTx, refreshBalance, isContractReady: CONTRACT_ID !== 'PLACEHOLDER' };
}