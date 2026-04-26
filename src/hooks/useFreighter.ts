import { useState, useCallback, useEffect } from 'react';
import {
  isConnected as freighterIsConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api';
import { WalletState, TransactionState } from '../types/stellar';
import {
  fetchBalance,
  buildPaymentTransaction,
  horizonServer,
} from '../utils/stellar';
import { TransactionBuilder } from '@stellar/stellar-sdk';

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

export function useFreighter() {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    publicKey: null,
    balance: null,
    isLoading: false,
    error: null,
  });

  const [txState, setTxState] = useState<TransactionState>({
    isLoading: false,
    hash: null,
    status: 'idle',
    error: null,
  });

  const refreshBalance = useCallback(async (publicKey: string) => {
    try {
      const balance = await fetchBalance(publicKey);
      setWallet((prev) => ({ ...prev, balance }));
    } catch {
      setWallet((prev) => ({ ...prev, balance: 'Error' }));
    }
  }, []);

  // Auto-reconnect if previously allowed
  useEffect(() => {
    const autoConnect = async () => {
      try {
        const connResult = await freighterIsConnected();
        if (!connResult.isConnected) return;

        const allowedResult = await isAllowed();
        if (!allowedResult.isAllowed) return;

        const addrResult = await getAddress();
        if (addrResult.error || !addrResult.address) return;

        const balance = await fetchBalance(addrResult.address);
        setWallet({
          isConnected: true,
          publicKey: addrResult.address,
          balance,
          isLoading: false,
          error: null,
        });
      } catch {
        // Silently fail on auto-connect
      }
    };
    const timer = setTimeout(autoConnect, 600);
    return () => clearTimeout(timer);
  }, []);

  const connect = useCallback(async () => {
    setWallet((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      // Step 1: Check Freighter is installed
      const connResult = await freighterIsConnected();
      if (!connResult.isConnected) {
        throw new Error('Freighter wallet is not installed. Please install it from freighter.app');
      }

      // Step 2: setAllowed() — authorizes localhost with Freighter
      // This is required before sign operations work
      const allowResult = await setAllowed();
      if (allowResult.error) {
        throw new Error(allowResult.error);
      }

      // Step 3: requestAccess() — prompts user to select account & confirm
      const accessResult = await requestAccess();
      if (accessResult.error) {
        throw new Error(accessResult.error);
      }

      // requestAccess returns the address directly
      const publicKey = accessResult.address;
      if (!publicKey) {
        throw new Error('Could not get public key. Did you approve the connection in Freighter?');
      }

      const balance = await fetchBalance(publicKey);
      setWallet({
        isConnected: true,
        publicKey,
        balance,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setWallet((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({
      isConnected: false,
      publicKey: null,
      balance: null,
      isLoading: false,
      error: null,
    });
    setTxState({ isLoading: false, hash: null, status: 'idle', error: null });
  }, []);

  const sendPayment = useCallback(
    async (destination: string, amount: string, memo?: string) => {
      if (!wallet.publicKey) return;

      setTxState({ isLoading: true, hash: null, status: 'pending', error: null });

      try {
        // Build the XDR transaction
        const xdr = await buildPaymentTransaction(
          wallet.publicKey,
          destination,
          amount,
          memo
        );

        // Sign with Freighter — address ensures correct account is used
        const signResult = await signTransaction(xdr, {
          networkPassphrase: NETWORK_PASSPHRASE,
          address: wallet.publicKey,
        });

        if (signResult.error) {
          throw new Error(signResult.error);
        }

        // Submit signed transaction to Horizon
        const tx = TransactionBuilder.fromXDR(signResult.signedTxXdr, NETWORK_PASSPHRASE);
        const result = await horizonServer.submitTransaction(tx);

        setTxState({
          isLoading: false,
          hash: result.hash,
          status: 'success',
          error: null,
        });

        await refreshBalance(wallet.publicKey);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        setTxState({
          isLoading: false,
          hash: null,
          status: 'error',
          error: message,
        });
      }
    },
    [wallet.publicKey, refreshBalance]
  );

  const resetTx = useCallback(() => {
    setTxState({ isLoading: false, hash: null, status: 'idle', error: null });
  }, []);

  return {
    wallet,
    txState,
    connect,
    disconnect,
    sendPayment,
    resetTx,
    refreshBalance: () => wallet.publicKey && refreshBalance(wallet.publicKey),
  };
}