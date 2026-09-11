import {
  database,
  HttpError,
  AccountContextError,
  requestLimit,
} from './server';
export type Account = {
  owner: string;
  account_id: string;
  epoch: number;
  revision: number;
  status: 'active' | 'closed';
  operation_id: string | null;
  created_at: string;
};
export async function readAccount(owner: string): Promise<Account> {
  const db = database();
  let account = await db
    .prepare('SELECT * FROM accounts WHERE owner=?')
    .bind(owner)
    .first<Account>();
  if (!account) {
    await db
      .prepare(
        'INSERT OR IGNORE INTO accounts(owner,account_id,created_at) VALUES(?,?,?)',
      )
      .bind(owner, crypto.randomUUID(), new Date().toISOString())
      .run();
    account = await db
      .prepare('SELECT * FROM accounts WHERE owner=?')
      .bind(owner)
      .first<Account>();
  }
  if (!account)
    throw new HttpError(
      503,
      'Your account is temporarily unavailable. Try again.',
    );
  return account;
}
export function assertAccountIdentity(request: Request, account: Account) {
  if (request.headers.get('x-stride-account') !== account.account_id)
    throw new AccountContextError();
}
export async function guardAccount(
  request: Request,
  owner: string,
  allowClosed = false,
) {
  const account = await readAccount(owner),
    epoch = request.headers.get('x-stride-epoch');
  assertAccountIdentity(request, account);
  if (
    epoch === null ||
    !/^\d+$/.test(epoch) ||
    !Number.isSafeInteger(Number(epoch)) ||
    Number(epoch) !== account.epoch
  )
    throw new AccountContextError();
  if (account.status !== 'active' && !allowClosed)
    throw new HttpError(
      409,
      'This Stride journal is closed. Restore a backup or explicitly open an empty journal in Account data.',
    );
  await requestLimit(owner, 'write');
  return account;
}
export async function activeAccount(owner: string, epoch: number) {
  const account = await readAccount(owner);
  if (account.status !== 'active' || account.epoch !== epoch)
    throw new HttpError(409, 'Your account changed. Reload before saving.');
  return account;
}
