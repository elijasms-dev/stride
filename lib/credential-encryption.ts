export type CredentialSecrets = {
  STRIDE_ENCRYPTION_KEY?: string;
  STRIDE_ENCRYPTION_KEYS?: string;
  STRIDE_ENCRYPTION_KEY_ID?: string;
};
export class CredentialConfigurationError extends Error {
  constructor() {
    super('Credential encryption is not configured correctly.');
  }
}
const PREFIX = 'stride:v1:';
function configuration(env: CredentialSecrets) {
  const keys: Record<string, string> = Object.create(null);
  if (env.STRIDE_ENCRYPTION_KEY) keys.legacy = env.STRIDE_ENCRYPTION_KEY;
  if (env.STRIDE_ENCRYPTION_KEYS) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(env.STRIDE_ENCRYPTION_KEYS);
    } catch {
      throw new CredentialConfigurationError();
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      Object.keys(parsed).length > 8
    )
      throw new CredentialConfigurationError();
    for (const [id, secret] of Object.entries(parsed)) {
      if (
        !/^[A-Za-z0-9_-]{1,40}$/.test(id) ||
        id === 'legacy' ||
        typeof secret !== 'string' ||
        secret.length < 32
      )
        throw new CredentialConfigurationError();
      keys[id] = secret;
    }
    if (!env.STRIDE_ENCRYPTION_KEY_ID) throw new CredentialConfigurationError();
  }
  const active = env.STRIDE_ENCRYPTION_KEY_ID || 'legacy';
  if (!Object.hasOwn(keys, active)) throw new CredentialConfigurationError();
  return { keys, active };
}
async function cipherKey(secret: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
function encode(bytes: Uint8Array) {
  return btoa(
    Array.from(bytes, (value) => String.fromCharCode(value)).join(''),
  );
}
export async function encryptCredential(value: string, env: CredentialSecrets) {
  const { keys, active } = configuration(env);
  const header = `${PREFIX}${active}:`;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(header) },
      await cipherKey(keys[active]),
      new TextEncoder().encode(value),
    ),
  );
  const bytes = new Uint8Array(iv.length + ciphertext.length);
  bytes.set(iv);
  bytes.set(ciphertext, iv.length);
  return header + encode(bytes);
}
export async function decryptCredential(value: string, env: CredentialSecrets) {
  const { keys } = configuration(env);
  let encoded = value,
    id = 'legacy',
    header: string | undefined;
  if (value.startsWith('stride:')) {
    const match = /^stride:v1:([A-Za-z0-9_-]{1,40}):([A-Za-z0-9+/=]+)$/.exec(
      value,
    );
    if (!match) throw new Error('Unsupported credential envelope.');
    id = match[1];
    encoded = match[2];
    header = `${PREFIX}${id}:`;
  }
  if (!Object.hasOwn(keys, id)) throw new CredentialConfigurationError();
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  if (bytes.length < 29) throw new Error('Invalid credential envelope.');
  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: bytes.slice(0, 12),
      ...(header ? { additionalData: new TextEncoder().encode(header) } : {}),
    },
    await cipherKey(keys[id]),
    bytes.slice(12),
  );
  return new TextDecoder().decode(plain);
}
export function credentialNeedsRotation(value: string, env: CredentialSecrets) {
  return !value.startsWith(`${PREFIX}${configuration(env).active}:`);
}
