import { useState, FormEvent } from 'react';
import { useFreighter } from './hooks/useFreighter';
import { isValidStellarAddress, formatBalance, shortenAddress } from './utils/stellar';
import {
  Wallet,
  Send,
  RefreshCw,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  Zap,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import './App.css';

export default function App() {
  const { wallet, txState, connect, disconnect, sendPayment, resetTx, refreshBalance } =
    useFreighter();

  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [copied, setCopied] = useState(false);
  const [destError, setDestError] = useState('');
  const [amtError, setAmtError] = useState('');

  const validateAndSend = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!isValidStellarAddress(destination)) {
      setDestError('Invalid Stellar address (must start with G and be 56 chars)');
      valid = false;
    } else {
      setDestError('');
    }

    const amtNum = parseFloat(amount);
    if (!amount || isNaN(amtNum) || amtNum <= 0) {
      setAmtError('Enter a valid amount greater than 0');
      valid = false;
    } else if (wallet.balance && amtNum >= parseFloat(wallet.balance)) {
      setAmtError('Insufficient balance (keep some XLM for fees)');
      valid = false;
    } else {
      setAmtError('');
    }

    if (!valid) return;
    await sendPayment(destination, amount, memo || undefined);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setDestination('');
    setAmount('');
    setMemo('');
    setDestError('');
    setAmtError('');
    resetTx();
  };

  return (
    <div className="app">
      {/* Background grid */}
      <div className="bg-grid" />
      <div className="bg-glow" />

      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="logo">
            <div className="logo-icon">
              <Zap size={20} />
            </div>
            <span className="logo-text">StellarPay</span>
            <span className="badge">TESTNET</span>
          </div>

          {wallet.isConnected ? (
            <div className="wallet-info">
              <div className="wallet-address">
                <div className="status-dot" />
                <span>{shortenAddress(wallet.publicKey!)}</span>
                <button
                  className="icon-btn"
                  onClick={() => copyToClipboard(wallet.publicKey!)}
                  title="Copy address"
                >
                  <Copy size={14} />
                </button>
              </div>
              <button className="btn-disconnect" onClick={disconnect}>
                <LogOut size={14} />
                Disconnect
              </button>
            </div>
          ) : null}
        </header>

        {/* Main content */}
        <main className="main">
          {!wallet.isConnected ? (
            /* Connect Screen */
            <div className="connect-screen">
              <div className="connect-card">
                <div className="connect-icon">
                  <Wallet size={40} />
                </div>
                <h1>Connect Your Wallet</h1>
                <p>
                  Connect your Freighter wallet to send XLM on the Stellar testnet.
                  Make sure you're on <strong>Testnet</strong> in Freighter settings.
                </p>

                {wallet.error && wallet.error.includes('not installed') && (
                  <div className="alert alert-warning">
                    <AlertCircle size={16} />
                    <span>
                      Freighter not detected.{' '}
                      <a href="https://freighter.app" target="_blank" rel="noreferrer">
                        Install it here
                      </a>
                    </span>
                  </div>
                )}

                {wallet.error && (
                  <div className="alert alert-error">
                    <XCircle size={16} />
                    <span>{wallet.error}</span>
                  </div>
                )}

                <button
                  className="btn-primary btn-lg"
                  onClick={connect}
                  disabled={wallet.isLoading}
                >
                  {wallet.isLoading ? (
                    <>
                      <RefreshCw size={18} className="spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet size={18} />
                      Connect Freighter
                    </>
                  )}
                </button>

                <div className="help-links">
                  <a
                    href="https://freighter.app"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get Freighter <ExternalLink size={12} />
                  </a>
                  <a
                    href="https://laboratory.stellar.org/#account-creator?network=test"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Fund with Friendbot <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* Dashboard */
            <div className="dashboard">
              {/* Balance Card */}
              <div className="balance-card">
                <div className="balance-label">Available Balance</div>
                <div className="balance-amount">
                  <span className="balance-number">{formatBalance(wallet.balance)}</span>
                  <span className="balance-currency">XLM</span>
                </div>
                <div className="balance-actions">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => refreshBalance?.()}
                  >
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                  <a
                    href="https://laboratory.stellar.org/#account-creator?network=test"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost btn-sm"
                  >
                    <Zap size={14} />
                    Get Testnet XLM
                  </a>
                </div>
              </div>

              {/* Send Form or Result */}
              {txState.status === 'success' ? (
                <div className="result-card result-success">
                  <div className="result-icon">
                    <CheckCircle size={48} />
                  </div>
                  <h2>Transaction Sent!</h2>
                  <p>Your XLM has been successfully sent on the Stellar testnet.</p>

                  <div className="tx-hash-box">
                    <span className="tx-hash-label">Transaction Hash</span>
                    <div className="tx-hash-value">
                      <code>{txState.hash}</code>
                      <button
                        className="icon-btn"
                        onClick={() => copyToClipboard(txState.hash!)}
                        title="Copy hash"
                      >
                        {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="result-actions">
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${txState.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-outline"
                    >
                      <ExternalLink size={16} />
                      View on Explorer
                    </a>
                    <button className="btn-primary" onClick={resetForm}>
                      Send Another
                    </button>
                  </div>
                </div>
              ) : txState.status === 'error' ? (
                <div className="result-card result-error">
                  <div className="result-icon">
                    <XCircle size={48} />
                  </div>
                  <h2>Transaction Failed</h2>
                  <p className="error-message">{txState.error}</p>
                  <button className="btn-primary" onClick={resetTx}>
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="send-card">
                  <div className="send-header">
                    <Send size={20} />
                    <h2>Send XLM</h2>
                  </div>

                  <form onSubmit={validateAndSend} noValidate>
                    <div className="field">
                      <label>Recipient Address</label>
                      <input
                        type="text"
                        placeholder="G..."
                        value={destination}
                        onChange={(e) => {
                          setDestination(e.target.value);
                          setDestError('');
                        }}
                        className={destError ? 'input-error' : ''}
                        spellCheck={false}
                      />
                      {destError && <span className="field-error">{destError}</span>}
                    </div>

                    <div className="field">
                      <label>Amount (XLM)</label>
                      <div className="input-with-suffix">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => {
                            setAmount(e.target.value);
                            setAmtError('');
                          }}
                          min="0.0000001"
                          step="0.0000001"
                          className={amtError ? 'input-error' : ''}
                        />
                        <span className="input-suffix">XLM</span>
                      </div>
                      {amtError && <span className="field-error">{amtError}</span>}
                    </div>

                    <div className="field">
                      <label>
                        Memo <span className="optional">(optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Add a note..."
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        maxLength={28}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn-primary btn-block"
                      disabled={txState.isLoading}
                    >
                      {txState.isLoading ? (
                        <>
                          <RefreshCw size={18} className="spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          Send XLM
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="footer">
          <span>Built for Stellar Testnet · Rise In Challenge</span>
        </footer>
      </div>
    </div>
  );
}