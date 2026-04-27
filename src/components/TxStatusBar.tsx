import { RefreshCw, CheckCircle, XCircle, ExternalLink, X } from 'lucide-react';
import { TxState } from '../types';

interface TxStatusBarProps {
  txState: TxState;
  onReset: () => void;
}

const STEPS = ['building', 'signing', 'submitting'] as const;
const STEP_LABELS: Record<string, string> = {
  building: '1. Building transaction…',
  signing: '2. Waiting for wallet signature…',
  submitting: '3. Submitting to network…',
};

export function TxStatusBar({ txState, onReset }: TxStatusBarProps) {
  const { status, hash, error } = txState;

  if (status === 'idle') return null;

  const isPending = status === 'building' || status === 'signing' || status === 'submitting';

  return (
    <div
      className={`tx-bar ${
        isPending ? 'tx-pending' : status === 'success' ? 'tx-success' : 'tx-error'
      }`}
    >
      {/* Header */}
      <div className="tx-bar-header">
        {isPending && <RefreshCw size={14} className="spin" />}
        {status === 'success' && <CheckCircle size={14} style={{ color: 'var(--success)' }} />}
        {status === 'error' && <XCircle size={14} style={{ color: 'var(--error)' }} />}
        <span>
          {isPending
            ? 'Transaction in progress'
            : status === 'success'
            ? 'Transaction confirmed!'
            : 'Transaction failed'}
        </span>
        <button className="tx-reset-btn" onClick={onReset} title="Dismiss">
          <X size={14} />
        </button>
      </div>

      {/* Pending steps */}
      {isPending && (
        <div className="tx-steps">
          {STEPS.map((step) => {
            const idx = STEPS.indexOf(step);
            const currentIdx = STEPS.indexOf(status as typeof step);
            let cls = 'tx-step tx-step-waiting';
            if (idx < currentIdx) cls = 'tx-step tx-step-done';
            else if (idx === currentIdx) cls = 'tx-step tx-step-active';

            return (
              <div key={step} className={cls}>
                {idx < currentIdx ? (
                  <CheckCircle size={12} />
                ) : idx === currentIdx ? (
                  <RefreshCw size={12} className="spin" />
                ) : (
                  <span className="tx-dot" />
                )}
                {STEP_LABELS[step]}
              </div>
            );
          })}
        </div>
      )}

      {/* Success */}
      {status === 'success' && hash && (
        <div className="tx-result">
          <CheckCircle size={16} className="icon-success" />
          <div className="tx-result-body">
            <span>Your tip was sent successfully!</span>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
              className="tx-hash-link"
            >
              {hash.slice(0, 12)}…{hash.slice(-8)} <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="tx-result">
          <XCircle size={16} className="icon-error" />
          <div className="tx-result-body">
            <span>Something went wrong.</span>
            <span className="tx-err-msg">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
