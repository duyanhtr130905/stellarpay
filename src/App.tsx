import { useState, FormEvent } from 'react';
// White-belt hook (Freighter only) — giữ nguyên
import { useFreighter } from './hooks/useFreighter';
// Yellow-belt hook (StellarWalletsKit — multi-wallet)
import { useWallet } from './hooks/useWallet';
import { TipJar } from './components/TipJar';
import { isValidStellarAddress, formatBalance, shortenAddress } from './utils/stellar';
import {
  Zap, Send, Wallet, LogOut, RefreshCw, Copy,
  CheckCircle, XCircle, ExternalLink, AlertCircle,
  Heart,
} from 'lucide-react';
import './App.css';

type Tab = 'send' | 'tipjar';

/* ── Error badge helper ─────────────────────────────────────────────────── */
const ERROR_STYLE: Record<string, string> = {
  WALLET_NOT_FOUND:      'alert-warn',
  USER_REJECTED:         'alert-error',
  INSUFFICIENT_BALANCE:  'alert-info',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('send');

  /* ── White-belt: Send XLM (Freighter) ───────────────────────────────── */
  const { wallet: fw, txState: fTx, connect: fConnect, disconnect: fDisconnect,
          sendPayment, resetTx: fReset, refreshBalance: fRefresh } = useFreighter();

  const [dest, setDest]   = useState('');
  const [amt, setAmt]     = useState('');
  const [memo, setMemo]   = useState('');
  const [destErr, setDE]  = useState('');
  const [amtErr, setAE]   = useState('');
  const [copied, setCopy] = useState(false);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    let ok = true;
    if (!isValidStellarAddress(dest)) { setDE('Invalid Stellar address (G… 56 chars)'); ok = false; } else setDE('');
    const n = parseFloat(amt);
    if (!amt || isNaN(n) || n <= 0) { setAE('Enter a valid amount'); ok = false; }
    else if (fw.balance && n >= parseFloat(fw.balance)) { setAE('Insufficient balance'); ok = false; }
    else setAE('');
    if (!ok) return;
    await sendPayment(dest, amt, memo || undefined);
  };

  const resetSend = () => { setDest(''); setAmt(''); setMemo(''); setDE(''); setAE(''); fReset(); };
  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopy(true); setTimeout(() => setCopy(false), 2000); };

  /* ── Yellow-belt: Tip Jar (StellarWalletsKit) ────────────────────────── */
  const { wallet: mw, txState: mTx, connect: mConnect, disconnect: mDisconnect,
          sendTip, resetTx: mReset, refreshBalance: mRefresh, isContractReady } = useWallet();

  /* ── Shared header wallet state depending on active tab ─────────────── */
  const activeWallet = tab === 'send' ? fw : mw;

  return (
    <div className="app">
      <div className="bg-grid" />
      <div className="bg-glow" />

      <div className="container">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="header">
          <div className="logo">
            <div className="logo-icon"><Zap size={18} /></div>
            <span className="logo-text">StellarPay</span>
            <span className="badge">TESTNET</span>
          </div>

          {/* Wallet info changes per tab */}
          {tab === 'send' ? (
            fw.isConnected ? (
              <div className="wallet-chip-group">
                <div className="wallet-chip">
                  <span className="status-dot" />
                  <span className="mono-sm">{shortenAddress(fw.publicKey!)}</span>
                  <button className="icon-btn" onClick={() => copy(fw.publicKey!)}>
                    <Copy size={12} />
                  </button>
                  <span className="chip-balance">{fw.balance ?? '—'} XLM</span>
                  <button className="icon-btn" onClick={() => fRefresh?.()}>
                    <RefreshCw size={12} />
                  </button>
                </div>
                <button className="btn-disconnect" onClick={fDisconnect}>
                  <LogOut size={13} /> Disconnect
                </button>
              </div>
            ) : null
          ) : (
            mw.isConnected ? (
              <div className="wallet-chip-group">
                <div className="wallet-chip">
                  <span className="status-dot" />
                  <span className="wallet-name-tag">{mw.walletName}</span>
                  <span className="mono-sm">{shortenAddress(mw.publicKey!)}</span>
                  <span className="chip-balance">{mw.balance ?? '—'} XLM</span>
                  <button className="icon-btn" onClick={() => mRefresh()}>
                    <RefreshCw size={12} />
                  </button>
                </div>
                <button className="btn-disconnect" onClick={mDisconnect}>
                  <LogOut size={13} /> Disconnect
                </button>
              </div>
            ) : null
          )}
        </header>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="tabs">
          <button
            className={`tab-btn ${tab === 'send' ? 'tab-active' : ''}`}
            onClick={() => setTab('send')}
          >
            <Send size={15} /> Send XLM
          </button>
          <button
            className={`tab-btn ${tab === 'tipjar' ? 'tab-active' : ''}`}
            onClick={() => setTab('tipjar')}
          >
            <Heart size={15} fill={tab === 'tipjar' ? 'currentColor' : 'none'} />
            Tip Jar
            <span className="tab-badge">Contract</span>
          </button>
        </div>

        {/* ── Error alerts (per-tab) ────────────────────────────────────── */}
        {tab === 'tipjar' && mw.error && (
          <div className={`alert ${ERROR_STYLE[mw.error.type] ?? 'alert-error'}`}>
            <AlertCircle size={14} />
            <div>
              <strong>{mw.error.type.replace(/_/g, ' ')}:</strong> {mw.error.message}
            </div>
          </div>
        )}

        <main className="main">
          {/* ════════════════════════════════════════════════════════════
              TAB 1: SEND XLM  (White Belt — Freighter only)
          ═══════════════════════════════════════════════════════════════ */}
          {tab === 'send' && (
            !fw.isConnected ? (
              <div className="connect-screen">
                <div className="connect-card">
                  <div className="connect-icon"><Wallet size={36} /></div>
                  <h1>Connect Freighter</h1>
                  <p>Connect your Freighter wallet to send XLM on Stellar testnet.</p>
                  {fw.error && (
                    <div className="alert alert-error">
                      <XCircle size={14} /> {fw.error}
                    </div>
                  )}
                  <button className="btn-primary btn-lg" onClick={fConnect} disabled={fw.isLoading}>
                    {fw.isLoading ? <><RefreshCw size={16} className="spin" /> Connecting…</> : <><Wallet size={16} /> Connect Freighter</>}
                  </button>
                  <div className="help-links">
                    <a href="https://freighter.app" target="_blank" rel="noreferrer">Get Freighter <ExternalLink size={11} /></a>
                    <a href="https://laboratory.stellar.org/#account-creator?network=test" target="_blank" rel="noreferrer">Fund with Friendbot <ExternalLink size={11} /></a>
                  </div>
                </div>
              </div>
            ) : fTx.status === 'success' ? (
              <div className="result-card result-success">
                <CheckCircle size={44} />
                <h2>Transaction Sent!</h2>
                <p>Your XLM was sent on Stellar testnet.</p>
                <div className="tx-hash-box">
                  <span>Transaction Hash</span>
                  <code>{fTx.hash}</code>
                  <button className="icon-btn" onClick={() => copy(fTx.hash!)}>
                    {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                  </button>
                </div>
                <div className="result-actions">
                  <a href={`https://stellar.expert/explorer/testnet/tx/${fTx.hash}`} target="_blank" rel="noreferrer" className="btn-outline">
                    <ExternalLink size={14} /> Explorer
                  </a>
                  <button className="btn-primary" onClick={resetSend}>Send Again</button>
                </div>
              </div>
            ) : fTx.status === 'error' ? (
              <div className="result-card result-error">
                <XCircle size={44} />
                <h2>Transaction Failed</h2>
                <p className="err-msg">{fTx.error}</p>
                <button className="btn-primary" onClick={fReset}>Try Again</button>
              </div>
            ) : (
              <div className="send-card">
                {/* Balance */}
                <div className="balance-card">
                  <span className="balance-label">Balance</span>
                  <div className="balance-row">
                    <span className="balance-num">{formatBalance(fw.balance)}</span>
                    <span className="balance-cur">XLM</span>
                  </div>
                </div>

                {/* Form */}
                <div className="send-header"><Send size={18} /><h2>Send XLM</h2></div>
                <form onSubmit={handleSend} noValidate>
                  <div className="field">
                    <label>Recipient Address</label>
                    <input type="text" placeholder="G…" value={dest}
                      onChange={e => { setDest(e.target.value); setDE(''); }}
                      className={destErr ? 'input-error' : ''} spellCheck={false} />
                    {destErr && <span className="field-error">{destErr}</span>}
                  </div>
                  <div className="field">
                    <label>Amount (XLM)</label>
                    <div className="input-suffix-wrap">
                      <input type="number" placeholder="0.00" value={amt}
                        onChange={e => { setAmt(e.target.value); setAE(''); }}
                        min="0" step="0.0000001"
                        className={amtErr ? 'input-error' : ''} />
                      <span className="input-suffix">XLM</span>
                    </div>
                    {amtErr && <span className="field-error">{amtErr}</span>}
                  </div>
                  <div className="field">
                    <label>Memo <span className="optional">(optional)</span></label>
                    <input type="text" placeholder="Note…" value={memo}
                      onChange={e => setMemo(e.target.value)} maxLength={28} />
                  </div>
                  <button type="submit" className="btn-primary btn-block" disabled={fTx.isLoading}>
                    {fTx.isLoading
                      ? <><RefreshCw size={16} className="spin" /> Sending…</>
                      : <><Send size={16} /> Send XLM</>}
                  </button>
                </form>
              </div>
            )
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 2: TIP JAR  (Yellow Belt — StellarWalletsKit + Soroban)
          ═══════════════════════════════════════════════════════════════ */}
          {tab === 'tipjar' && (
            <div className="tipjar-wrapper">
              {/* Multi-wallet connect panel (shown when not connected) */}
              {!mw.isConnected && (
                <div className="connect-card connect-card-sm">
                  <div className="connect-icon"><Wallet size={28} /></div>
                  <h2>Connect Wallet</h2>
                  <p>Supports <strong>Freighter</strong>, <strong>xBull</strong>, and <strong>Lobstr</strong></p>
                  <button className="btn-primary" onClick={mConnect} disabled={mw.isLoading}>
                    {mw.isLoading
                      ? <><RefreshCw size={15} className="spin" /> Connecting…</>
                      : <><Wallet size={15} /> Choose Wallet</>}
                  </button>
                </div>
              )}

              <TipJar
                isConnected={mw.isConnected}
                balance={mw.balance}
                publicKey={mw.publicKey}
                txState={mTx}
                onSendTip={sendTip}
                onResetTx={mReset}
                onConnect={mConnect}
              />
            </div>
          )}
        </main>

        <footer className="footer">
          StellarPay · White Belt + Yellow Belt · Rise In Challenge · Testnet
        </footer>
      </div>
    </div>
  );
}