import { useState, useEffect, useCallback } from 'react';
import { Heart, Wallet, AlertTriangle, RefreshCw, Send } from 'lucide-react';
import { TxState, TipJarInfo } from '../types';
import { TxStatusBar } from './TxStatusBar';
import { fetchTipJarInfo, stroopsToXlm, shortenAddr, CONTRACT_ID } from '../utils/contract';

interface TipJarProps {
  isConnected: boolean;
  balance: string | null;
  publicKey: string | null;
  txState: TxState;
  onSendTip: (xlmAmount: string) => Promise<void>;
  onResetTx: () => void;
  onConnect: () => void;
}

const PRESETS = ['1', '5', '10', '25', '50'];

export function TipJar({
  isConnected,
  balance,
  publicKey,
  txState,
  onSendTip,
  onResetTx,
  onConnect,
}: TipJarProps) {
  const [tipAmount, setTipAmount] = useState('5');
  const [info, setInfo] = useState<TipJarInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Fetch tip jar info on mount and after successful tip
  const loadInfo = useCallback(async () => {
    setLoadingInfo(true);
    const data = await fetchTipJarInfo();
    setInfo(data);
    setLoadingInfo(false);
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  // Reload stats after successful tip
  useEffect(() => {
    if (txState.status === 'success') {
      const timer = setTimeout(loadInfo, 2000);
      return () => clearTimeout(timer);
    }
  }, [txState.status, loadInfo]);

  const handleTip = () => {
    if (!tipAmount || parseFloat(tipAmount) <= 0) return;
    onSendTip(tipAmount);
  };

  const isPlaceholder = CONTRACT_ID === 'PLACEHOLDER';

  return (
    <div className="tipjar-section">
      {/* Header */}
      <div className="tipjar-header">
        <div className="tipjar-title">
          <Heart size={20} fill="currentColor" />
          <h2>Tip Jar</h2>
          <span className="tipjar-badge">Soroban</span>
        </div>
        {!isPlaceholder && (
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noreferrer"
            className="contract-link"
          >
            {shortenAddr(CONTRACT_ID)}
          </a>
        )}
      </div>

      {/* Placeholder warning when contract not deployed */}
      {isPlaceholder ? (
        <div className="tipjar-placeholder">
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Contract not deployed yet</strong>
            <p>
              Run <code>bash deploy_contract.sh</code> to deploy the Soroban contract,
              then set <code>VITE_CONTRACT_ID</code> in your <code>.env</code> file.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          {loadingInfo ? (
            <div className="stats-loading">
              <RefreshCw size={13} className="spin" /> Loading stats…
            </div>
          ) : info ? (
            <div className="tipjar-stats">
              <div className="stat-box">
                <span className="stat-label">Total Tips</span>
                <span className="stat-val">{stroopsToXlm(info.totalTips)} XLM</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Tip Count</span>
                <span className="stat-val">{info.tipCount}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Owner</span>
                <span className="stat-val mono">{shortenAddr(info.owner)}</span>
              </div>
            </div>
          ) : null}

          {/* TX Status Bar */}
          <TxStatusBar txState={txState} onReset={onResetTx} />

          {/* Tip Form */}
          {isConnected ? (
            txState.status === 'idle' || txState.status === 'error' || txState.status === 'success' ? (
              <div className="tip-form">
                <div className="preset-amounts">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      className={`preset-btn ${tipAmount === p ? 'preset-active' : ''}`}
                      onClick={() => setTipAmount(p)}
                    >
                      {p} XLM
                    </button>
                  ))}
                </div>

                <div className="field">
                  <label>Custom amount (XLM)</label>
                  <div className="input-suffix-wrap">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      min="0"
                      step="0.5"
                    />
                    <span className="input-suffix">XLM</span>
                  </div>
                </div>

                <button
                  className="btn-primary btn-block"
                  onClick={handleTip}
                  disabled={txState.status !== 'idle' && txState.status !== 'error' && txState.status !== 'success'}
                >
                  <Send size={16} />
                  Send {tipAmount || '0'} XLM Tip
                </button>
              </div>
            ) : null
          ) : (
            <div className="tipjar-connect-prompt">
              <p>Connect your wallet above to send a tip</p>
              <button className="btn-primary" onClick={onConnect}>
                <Wallet size={15} /> Connect Wallet
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
