import { makeSecureWebhooks, SecureWebhooks } from "./base";

// Borrowed and modified from https://github.com/lukeed/worktop/commit/200999a5fccea4cfd559a14d1aff6e191715f354
function timingSafeEqual(one: string, two: string): boolean {
  let different = false;

  const a = stringToUint8Array(one);
  const b = stringToUint8Array(two);

  if (a.byteLength !== b.byteLength) different = true;
  let len = a.length;
  while (len-- > 0) {
    // must check all items until complete
    if (a[len] !== b[len]) different = true;
  }
  return !different;
}

// Borrowed from https://github.com/LinusU/array-buffer-to-hex/blob/master/index.js
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);
  let result = '';

  for (let i = 0; i < view.length; i++) {
    let value = view[i].toString(16)
    result += (value.length === 1 ? '0' + value : value)
  }

  return result;
}

// Borrowed from https://stackoverflow.com/a/67082926
function arrayBufferToString(buffer: ArrayBuffer) {
  return String.fromCharCode.apply(null, Array.from(new Uint8Array(buffer)));
}

// Borrowed and modified from https://stackoverflow.com/a/67082926
function stringToArrayBuffer(str: string): ArrayBuffer {
  const buffer = new ArrayBuffer(str.length);
  stringToUint8Array(str, buffer);
  return buffer;
}

function stringToUint8Array(str: string, buffer = new ArrayBuffer(str.length)): Uint8Array {
  const bufferInterface = new Uint8Array(buffer);
  Array.from(str).forEach((char, index: number) => bufferInterface[index] = char.charCodeAt(0));
  return bufferInterface;
}


export const symmetric = makeSecureWebhooks(
  secret => async input => {
    const key = await crypto.subtle.importKey(
      'raw',
      stringToArrayBuffer(secret),
      {name: 'HMAC', hash: 'SHA-256'},
      false,
      ['sign']
    );
    const computedSignature = await crypto.subtle.sign('HMAC', key, stringToArrayBuffer(input));

    return arrayBufferToHex(computedSignature);
  },
  secret => async (input, digest) => {
    const key = await crypto.subtle.importKey(
      'raw',
      stringToArrayBuffer(secret),
      {name: 'HMAC', hash: 'SHA-256'},
      false,
      ['sign']
    );
    const computedSignature = await crypto.subtle.sign('HMAC', key, stringToArrayBuffer(input));
    const signature = arrayBufferToHex(computedSignature);

    return timingSafeEqual(signature, digest);
  }
);

export const asymmetric = makeSecureWebhooks(
  priv => async input => {
    const decodedKey = atob(priv
      .replace("-----BEGIN PRIVATE KEY-----", '')
      .replace("-----END PRIVATE KEY-----", '')
      .replace(/\n/g, ''));

    // IMPORTANT: Test keys had to be converted to PKCS#8 because subtle crypto does not support PKCS#1
    const key = await crypto.subtle.importKey(
      'pkcs8',
      stringToUint8Array(decodedKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const computedSignature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, stringToArrayBuffer(input));
    return btoa(arrayBufferToString(computedSignature));
  },
  pub => async (input, digest) => {
    const decodedKey = atob(pub
      .replace("-----BEGIN PUBLIC KEY-----", '')
      .replace("-----END PUBLIC KEY-----", '')
      .replace(/\n/g, ''));

    const key = await crypto.subtle.importKey(
      'spki',
      stringToUint8Array(decodedKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      stringToArrayBuffer(atob(digest)),
      stringToArrayBuffer(input)
    );
  }
);

export const combined: SecureWebhooks = {
  sign: (input, secretOrPrivateKey, timestamp) =>
    secretOrPrivateKey.includes('PRIVATE KEY')
      ? asymmetric.sign(input, secretOrPrivateKey, timestamp)
      : symmetric.sign(input, secretOrPrivateKey, timestamp),
  verify: (input, secretOrPublicKey, signature, opts) =>
    secretOrPublicKey.includes('PUBLIC KEY')
      ? asymmetric.verify(input, secretOrPublicKey, signature, opts)
      : symmetric.verify(input, secretOrPublicKey, signature, opts),
};

export const sign = symmetric.sign;
export const verify = symmetric.verify;