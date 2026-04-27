import {
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Address,
  rpc,
  Horizon,
} from '@stellar/stellar-sdk';
import { TipJarInfo } from '../types';

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL            = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL        = 'https://horizon-testnet.stellar.org';

// ⚠️  Thay bằng contract ID sau khi deploy
export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID ?? 'PLACEHOLDER';

// Native XLM contract trên testnet
export const XLM_TOKEN = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

export const rpcServer     = new rpc.Server(RPC_URL);
export const horizonServer = new Horizon.Server(HORIZON_URL);

// ── Helpers ───────────────────────────────────────────────────────────────────
export const xlmToStroops  = (xlm: string) => BigInt(Math.round(parseFloat(xlm) * 10_000_000));
export const stroopsToXlm  = (s: bigint)   => (Number(s) / 10_000_000).toFixed(4);
export const shortenAddr   = (a: string)   => `${a.slice(0, 6)}…${a.slice(-4)}`;

// ── Read tip jar info (simulate — no auth needed) ─────────────────────────────
export async function fetchTipJarInfo(): Promise<TipJarInfo | null> {
  if (CONTRACT_ID === 'PLACEHOLDER') return null;
  try {
    const contract   = new Contract(CONTRACT_ID);
    const fakeSource = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
    const fakeAcct   = {
      accountId:             () => fakeSource,
      sequenceNumber:        () => '0',
      incrementSequenceNumber: () => {},
    } as never;

    const tx = new TransactionBuilder(fakeAcct, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_info'))
      .setTimeout(30)
      .build();

    const sim = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);

    const result = (sim as rpc.Api.SimulateTransactionSuccessResponse).result;
    if (!result) return null;

    const raw = scValToNative(result.retval) as Record<string, unknown>;
    return {
      owner:     raw.owner as string,
      totalTips: BigInt(String(raw.total_tips ?? '0')),
      tipCount:  Number(raw.tip_count ?? 0),
    };
  } catch (e) {
    console.error('[fetchTipJarInfo]', e);
    return null;
  }
}

// ── Build + assemble "tip" transaction XDR (signed later by wallet) ───────────
export async function buildTipXdr(
  tipperPublicKey: string,
  amountStroops: bigint,
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account  = await horizonServer.loadAccount(tipperPublicKey);

  const tx = new TransactionBuilder(account, {
    fee: '300',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'tip',
        new Address(tipperPublicKey).toScVal(),
        nativeToScVal(amountStroops, { type: 'i128' }),
      ),
    )
    .setTimeout(60)
    .build();

  // Simulate → assembleTransaction fills in auth + footprint
  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim))
    throw new Error((sim as rpc.Api.SimulateTransactionErrorResponse).error);

  return rpc
    .assembleTransaction(tx, sim as rpc.Api.SimulateTransactionSuccessResponse)
    .build()
    .toXDR();
}

// ── Submit signed XDR + poll until finalized ──────────────────────────────────
export async function submitAndConfirm(signedXdr: string): Promise<string> {
  const { TransactionBuilder } = await import('@stellar/stellar-sdk');
  const tx     = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const result = await rpcServer.sendTransaction(tx);

  if (result.status === 'ERROR')
    throw new Error(result.errorResult?.toString() ?? 'Submit failed');

  // Poll up to 30 s
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const s = await rpcServer.getTransaction(result.hash);
    if (s.status === rpc.Api.GetTransactionStatus.SUCCESS) return result.hash;
    if (s.status === rpc.Api.GetTransactionStatus.FAILED)
      throw new Error('Transaction failed on-chain');
  }
  throw new Error('Timeout waiting for confirmation');
}
