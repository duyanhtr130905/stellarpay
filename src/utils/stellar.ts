import {
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Memo,
} from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

export const horizonServer = new Horizon.Server(HORIZON_URL);

export async function fetchBalance(publicKey: string): Promise<string> {
  const account = await horizonServer.loadAccount(publicKey);
  const xlmBalance = account.balances.find(
    (b) => b.asset_type === 'native'
  );
  return xlmBalance ? parseFloat(xlmBalance.balance).toFixed(4) : '0.0000';
}

export async function buildPaymentTransaction(
  sourcePublicKey: string,
  destination: string,
  amount: string,
  memo?: string
): Promise<string> {
  // Validate destination account exists
  try {
    await horizonServer.loadAccount(destination);
  } catch {
    throw new Error('Destination account does not exist on testnet. Please check the address.');
  }

  const sourceAccount = await horizonServer.loadAccount(sourcePublicKey);

  const builder = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: Asset.native(),
        amount,
      })
    )
    .setTimeout(30);

  if (memo) {
    builder.addMemo(Memo.text(memo));
  }

  const transaction = builder.build();
  return transaction.toXDR();
}

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address);
}

export function formatBalance(balance: string | null): string {
  if (!balance) return '—';
  return parseFloat(balance).toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}
