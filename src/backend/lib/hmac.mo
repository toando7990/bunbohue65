import Array "mo:core/Array";
import Text "mo:core/Text";
import Nat8 "mo:core/Nat8";
import Prim "mo:prim";
import Char "mo:core/Char";
// hmac.mo — Pure Motoko implementation of SHA-512 and HMAC-SHA512
// Used to verify Tingee webhook signatures.
//
// SHA-512 spec: FIPS PUB 180-4
// HMAC spec:    RFC 2104
//
// Public API:
//   hmacSha512(key : Blob, message : Blob) : Blob  — returns 64-byte HMAC-SHA512 digest
//   toHex(blob : Blob) : Text                       — converts bytes to lowercase hex string

module {

  // ── SHA-256 constants ─────────────────────────────────────────────────────
  // First 32 bits of the fractional parts of the cube roots of the first 64 primes
  let K32 : [Nat32] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  // Initial hash values for SHA-256 (first 32 bits of sqrt of first 8 primes)
  let H0_256 : [Nat32] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  // ── Nat32 bit operations ──────────────────────────────────────────────────
  let mask32 : Nat32 = 0xffffffff;

  func rotR32(x : Nat32, n : Nat32) : Nat32 {
    ((x >> n) | (x << (32 - n))) & mask32;
  };

  func add32(a : Nat32, b : Nat32) : Nat32 {
    (a +% b) & mask32;
  };

  // SHA-256 sigma functions
  func s0_256(x : Nat32) : Nat32 {
    rotR32(x, 2) ^ rotR32(x, 13) ^ rotR32(x, 22);
  };

  func s1_256(x : Nat32) : Nat32 {
    rotR32(x, 6) ^ rotR32(x, 11) ^ rotR32(x, 25);
  };

  func g0_256(x : Nat32) : Nat32 {
    rotR32(x, 7) ^ rotR32(x, 18) ^ (x >> 3);
  };

  func g1_256(x : Nat32) : Nat32 {
    rotR32(x, 17) ^ rotR32(x, 19) ^ (x >> 10);
  };

  func ch32(x : Nat32, y : Nat32, z : Nat32) : Nat32 {
    (x & y) ^ ((x ^ mask32) & z);
  };

  func maj32(x : Nat32, y : Nat32, z : Nat32) : Nat32 {
    (x & y) ^ (x & z) ^ (y & z);
  };

  // ── SHA-256 Padding ───────────────────────────────────────────────────────
  // SHA-256 processes 512-bit (64-byte) blocks.
  func padMessage256(msg : [Nat8]) : [Nat8] {
    let msgLen = msg.size();
    let bitLen : Nat64 = Nat64.fromNat(msgLen) * 8;
    // Append 0x80, then zeros, then 8-byte length
    // Total padded length must be ≡ 56 (mod 64)
    let remainder = msgLen % 64;
    let zeroPad : Nat = if (remainder < 56) { (56 - remainder : Int).toNat() - 1 } else { (64 + 56 - remainder : Int).toNat() - 1 };
    let totalLen = msgLen + 1 + zeroPad + 8;
    let padded = Array.repeat<Nat8>(0, totalLen).toVarArray();
    var i = 0;
    while (i < msgLen) {
      padded[i] := msg[i];
      i += 1;
    };
    padded[msgLen] := 0x80;
    let base = msgLen + 1 + zeroPad;
    padded[base + 0] := Nat8.fromNat(((bitLen >> 56) & 0xff).toNat());
    padded[base + 1] := Nat8.fromNat(((bitLen >> 48) & 0xff).toNat());
    padded[base + 2] := Nat8.fromNat(((bitLen >> 40) & 0xff).toNat());
    padded[base + 3] := Nat8.fromNat(((bitLen >> 32) & 0xff).toNat());
    padded[base + 4] := Nat8.fromNat(((bitLen >> 24) & 0xff).toNat());
    padded[base + 5] := Nat8.fromNat(((bitLen >> 16) & 0xff).toNat());
    padded[base + 6] := Nat8.fromNat(((bitLen >> 8)  & 0xff).toNat());
    padded[base + 7] := Nat8.fromNat(((bitLen >> 0)  & 0xff).toNat());
    Prim.Array_tabulate(padded.size(), func i = padded[i]);
  };

  // ── Read 4 bytes as big-endian Nat32 ─────────────────────────────────────
  func readU32BE(data : [Nat8], offset : Nat) : Nat32 {
    data[offset + 0].toNat32() << 24 |
    data[offset + 1].toNat32() << 16 |
    data[offset + 2].toNat32() << 8  |
    data[offset + 3].toNat32();
  };

  // ── SHA-256 core compression ──────────────────────────────────────────────
  func sha256Compress(h : [var Nat32], block : [Nat8], blockOffset : Nat) {
    let w = Array.repeat<Nat32>(0, 64).toVarArray();
    var t = 0;
    while (t < 16) {
      w[t] := readU32BE(block, blockOffset + t * 4);
      t += 1;
    };
    while (t < 64) {
      w[t] := add32(add32(add32(g1_256(w[t - 2]), w[t - 7]), g0_256(w[t - 15])), w[t - 16]);
      t += 1;
    };

    var a = h[0];
    var b = h[1];
    var c = h[2];
    var d = h[3];
    var e = h[4];
    var f = h[5];
    var g = h[6];
    var hh = h[7];

    t := 0;
    while (t < 64) {
      let t1 = add32(add32(add32(add32(hh, s1_256(e)), ch32(e, f, g)), K32[t]), w[t]);
      let t2 = add32(s0_256(a), maj32(a, b, c));
      hh := g;
      g  := f;
      f  := e;
      e  := add32(d, t1);
      d  := c;
      c  := b;
      b  := a;
      a  := add32(t1, t2);
      t += 1;
    };

    h[0] := add32(h[0], a);
    h[1] := add32(h[1], b);
    h[2] := add32(h[2], c);
    h[3] := add32(h[3], d);
    h[4] := add32(h[4], e);
    h[5] := add32(h[5], f);
    h[6] := add32(h[6], g);
    h[7] := add32(h[7], hh);
  };

  // ── SHA-256 hash function ─────────────────────────────────────────────────
  func sha256Raw(msg : [Nat8]) : [Nat8] {
    let padded = padMessage256(msg);
    let h = H0_256.toVarArray();
    let numBlocks = padded.size() / 64;
    var blockIdx = 0;
    while (blockIdx < numBlocks) {
      sha256Compress(h, padded, blockIdx * 64);
      blockIdx += 1;
    };
    // Serialize the 8 × 32-bit hash words into 32 bytes
    let out = Array.repeat<Nat8>(0, 32).toVarArray();
    var i = 0;
    while (i < 8) {
      let word = h[i];
      out[i * 4 + 0] := Nat8.fromNat(((word >> 24) & 0xff).toNat());
      out[i * 4 + 1] := Nat8.fromNat(((word >> 16) & 0xff).toNat());
      out[i * 4 + 2] := Nat8.fromNat(((word >> 8)  & 0xff).toNat());
      out[i * 4 + 3] := Nat8.fromNat(((word >> 0)  & 0xff).toNat());
      i += 1;
    };
    Prim.Array_tabulate(out.size(), func i = out[i]);
  };

  // ── HMAC-SHA256 ───────────────────────────────────────────────────────────
  // Block size for SHA-256 is 64 bytes.
  // HMAC(K, m) = SHA256((K' XOR opad) || SHA256((K' XOR ipad) || m))
  let BLOCK_SIZE_256 = 64;

  public func hmacSha256(key : Blob, message : Blob) : Blob {
    let keyBytes = Blob.toArray(key);
    let msgBytes = Blob.toArray(message);

    // Normalise key to BLOCK_SIZE_256 bytes
    let normKey : [Nat8] = if (keyBytes.size() > BLOCK_SIZE_256) {
      sha256Raw(keyBytes); // hash down to 32 bytes, then zero-pad to 64
    } else {
      keyBytes;
    };
    let k = Array.repeat<Nat8>(0, BLOCK_SIZE_256).toVarArray();
    var i = 0;
    while (i < normKey.size()) {
      k[i] := normKey[i];
      i += 1;
    };

    // Compute ipad-key and opad-key
    let ikeypad = Array.repeat<Nat8>(0, BLOCK_SIZE_256).toVarArray();
    let okeypad = Array.repeat<Nat8>(0, BLOCK_SIZE_256).toVarArray();
    i := 0;
    while (i < BLOCK_SIZE_256) {
      ikeypad[i] := k[i] ^ IPAD;
      okeypad[i] := k[i] ^ OPAD;
      i += 1;
    };

    // inner = SHA256(ikeypad || message)
    let innerInput = Array.repeat<Nat8>(0, BLOCK_SIZE_256 + msgBytes.size()).toVarArray();
    i := 0;
    while (i < BLOCK_SIZE_256) {
      innerInput[i] := ikeypad[i];
      i += 1;
    };
    var j = 0;
    while (j < msgBytes.size()) {
      innerInput[BLOCK_SIZE_256 + j] := msgBytes[j];
      j += 1;
    };
    let innerHash = sha256Raw(Prim.Array_tabulate(innerInput.size(), func i = innerInput[i]));

    // outer = SHA256(okeypad || inner)
    let outerInput = Array.repeat<Nat8>(0, BLOCK_SIZE_256 + 32).toVarArray();
    i := 0;
    while (i < BLOCK_SIZE_256) {
      outerInput[i] := okeypad[i];
      i += 1;
    };
    j := 0;
    while (j < 32) {
      outerInput[BLOCK_SIZE_256 + j] := innerHash[j];
      j += 1;
    };
    let outerHash = sha256Raw(Prim.Array_tabulate(outerInput.size(), func i = outerInput[i]));

    Blob.fromArray(outerHash);
  };

  // ── SHA-512 constants ─────────────────────────────────────────────────────
  // First 64 bits of the fractional parts of the cube roots of the first 80 primes
  let K : [Nat64] = [
    0x428a2f98d728ae22, 0x7137449123ef65cd, 0xb5c0fbcfec4d3b2f, 0xe9b5dba58189dbbc,
    0x3956c25bf348b538, 0x59f111f1b605d019, 0x923f82a4af194f9b, 0xab1c5ed5da6d8118,
    0xd807aa98a3030242, 0x12835b0145706fbe, 0x243185be4ee4b28c, 0x550c7dc3d5ffb4e2,
    0x72be5d74f27b896f, 0x80deb1fe3b1696b1, 0x9bdc06a725c71235, 0xc19bf174cf692694,
    0xe49b69c19ef14ad2, 0xefbe4786384f25e3, 0x0fc19dc68b8cd5b5, 0x240ca1cc77ac9c65,
    0x2de92c6f592b0275, 0x4a7484aa6ea6e483, 0x5cb0a9dcbd41fbd4, 0x76f988da831153b5,
    0x983e5152ee66dfab, 0xa831c66d2db43210, 0xb00327c898fb213f, 0xbf597fc7beef0ee4,
    0xc6e00bf33da88fc2, 0xd5a79147930aa725, 0x06ca6351e003826f, 0x142929670a0e6e70,
    0x27b70a8546d22ffc, 0x2e1b21385c26c926, 0x4d2c6dfc5ac42aed, 0x53380d139d95b3df,
    0x650a73548baf63de, 0x766a0abb3c77b2a8, 0x81c2c92e47edaee6, 0x92722c851482353b,
    0xa2bfe8a14cf10364, 0xa81a664bbc423001, 0xc24b8b70d0f89791, 0xc76c51a30654be30,
    0xd192e819d6ef5218, 0xd69906245565a910, 0xf40e35855771202a, 0x106aa07032bbd1b8,
    0x19a4c116b8d2d0c8, 0x1e376c085141ab53, 0x2748774cdf8eeb99, 0x34b0bcb5e19b48a8,
    0x391c0cb3c5c95a63, 0x4ed8aa4ae3418acb, 0x5b9cca4f7763e373, 0x682e6ff3d6b2b8a3,
    0x748f82ee5defb2fc, 0x78a5636f43172f60, 0x84c87814a1f0ab72, 0x8cc702081a6439ec,
    0x90befffa23631e28, 0xa4506cebde82bde9, 0xbef9a3f7b2c67915, 0xc67178f2e372532b,
    0xca273eceea26619c, 0xd186b8c721c0c207, 0xeada7dd6cde0eb1e, 0xf57d4f7fee6ed178,
    0x06f067aa72176fba, 0x0a637dc5a2c898a6, 0x113f9804bef90dae, 0x1b710b35131c471b,
    0x28db77f523047d84, 0x32caab7b40c72493, 0x3c9ebe0a15c9bebc, 0x431d67c49c100d4c,
    0x4cc5d4becb3e42b6, 0x597f299cfc657e2a, 0x5fcb6fab3ad6faec, 0x6c44198c4a475817,
  ];

  // Initial hash values (first 64 bits of the fractional parts of the square roots of the first 8 primes)
  let H0 : [Nat64] = [
    0x6a09e667f3bcc908,
    0xbb67ae8584caa73b,
    0x3c6ef372fe94f82b,
    0xa54ff53a5f1d36f1,
    0x510e527fade682d1,
    0x9b05688c2b3e6c1f,
    0x1f83d9abfb41bd6b,
    0x5be0cd19137e2179,
  ];

  // ── Nat64 bit operations ──────────────────────────────────────────────────
  let mask64 : Nat64 = 0xffffffffffffffff;

  func rotR64(x : Nat64, n : Nat64) : Nat64 {
    ((x >> n) | (x << (64 - n))) & mask64;
  };

  func shr64(x : Nat64, n : Nat64) : Nat64 {
    x >> n;
  };

  func add64(a : Nat64, b : Nat64) : Nat64 {
    (a +% b) & mask64;
  };

  // SHA-512 sigma functions
  func sigma0(x : Nat64) : Nat64 {
    rotR64(x, 28) ^ rotR64(x, 34) ^ rotR64(x, 39);
  };

  func sigma1(x : Nat64) : Nat64 {
    rotR64(x, 14) ^ rotR64(x, 18) ^ rotR64(x, 41);
  };

  func gamma0(x : Nat64) : Nat64 {
    rotR64(x, 1) ^ rotR64(x, 8) ^ shr64(x, 7);
  };

  func gamma1(x : Nat64) : Nat64 {
    rotR64(x, 19) ^ rotR64(x, 61) ^ shr64(x, 6);
  };

  func ch(x : Nat64, y : Nat64, z : Nat64) : Nat64 {
    (x & y) ^ ((x ^ mask64) & z);
  };

  func maj(x : Nat64, y : Nat64, z : Nat64) : Nat64 {
    (x & y) ^ (x & z) ^ (y & z);
  };

  // ── Padding ───────────────────────────────────────────────────────────────
  // SHA-512 processes 1024-bit (128-byte) blocks.
  // Message length is appended as a 128-bit big-endian integer (we only support
  // messages up to 2^64 bytes — storing the low 64 bits of the bit-length suffices
  // for practical HMAC keys and webhook bodies).
  func padMessage(msg : [Nat8]) : [Nat8] {
    let msgLen = msg.size();
    let bitLen : Nat64 = Nat64.fromNat(msgLen) * 8;
    // Append 0x80, then zeros, then 16-byte length (we use 8 zero bytes + 8-byte bitLen)
    // Total padded length must be ≡ 112 (mod 128)
    let remainder = msgLen % 128;
    let zeroPad : Nat = if (remainder < 112) { (112 - remainder : Int).toNat() - 1 } else { (128 + 112 - remainder : Int).toNat() - 1 };
    let totalLen = msgLen + 1 + zeroPad + 16;
    let padded = Array.repeat<Nat8>(0, totalLen).toVarArray();
    var i = 0;
    while (i < msgLen) {
      padded[i] := msg[i];
      i += 1;
    };
    padded[msgLen] := 0x80;
    // Write 128-bit length: high 8 bytes = 0, low 8 bytes = bitLen (big-endian)
    let base = msgLen + 1 + zeroPad + 8; // skip 8 high zero bytes
    padded[base + 0] := Nat8.fromNat(((bitLen >> 56) & 0xff).toNat());
    padded[base + 1] := Nat8.fromNat(((bitLen >> 48) & 0xff).toNat());
    padded[base + 2] := Nat8.fromNat(((bitLen >> 40) & 0xff).toNat());
    padded[base + 3] := Nat8.fromNat(((bitLen >> 32) & 0xff).toNat());
    padded[base + 4] := Nat8.fromNat(((bitLen >> 24) & 0xff).toNat());
    padded[base + 5] := Nat8.fromNat(((bitLen >> 16) & 0xff).toNat());
    padded[base + 6] := Nat8.fromNat(((bitLen >> 8)  & 0xff).toNat());
    padded[base + 7] := Nat8.fromNat(((bitLen >> 0)  & 0xff).toNat());
    Prim.Array_tabulate(padded.size(), func i = padded[i]);
  };

  // ── Read 8 bytes as big-endian Nat64 ─────────────────────────────────────
  func readU64BE(data : [Nat8], offset : Nat) : Nat64 {
    data[offset + 0].toNat64() << 56 |
    data[offset + 1].toNat64() << 48 |
    data[offset + 2].toNat64() << 40 |
    data[offset + 3].toNat64() << 32 |
    data[offset + 4].toNat64() << 24 |
    data[offset + 5].toNat64() << 16 |
    data[offset + 6].toNat64() << 8  |
    data[offset + 7].toNat64();
  };

  // ── SHA-512 core compression ──────────────────────────────────────────────
  func sha512Compress(h : [var Nat64], block : [Nat8], blockOffset : Nat) {
    // Prepare the message schedule W[0..79]
    let w = Array.repeat<Nat64>(0, 80).toVarArray();
    var t = 0;
    while (t < 16) {
      w[t] := readU64BE(block, blockOffset + t * 8);
      t += 1;
    };
    while (t < 80) {
      w[t] := add64(add64(add64(gamma1(w[t - 2]), w[t - 7]), gamma0(w[t - 15])), w[t - 16]);
      t += 1;
    };

    var a = h[0];
    var b = h[1];
    var c = h[2];
    var d = h[3];
    var e = h[4];
    var f = h[5];
    var g = h[6];
    var hh = h[7];

    t := 0;
    while (t < 80) {
      let t1 = add64(add64(add64(add64(hh, sigma1(e)), ch(e, f, g)), K[t]), w[t]);
      let t2 = add64(sigma0(a), maj(a, b, c));
      hh := g;
      g  := f;
      f  := e;
      e  := add64(d, t1);
      d  := c;
      c  := b;
      b  := a;
      a  := add64(t1, t2);
      t += 1;
    };

    h[0] := add64(h[0], a);
    h[1] := add64(h[1], b);
    h[2] := add64(h[2], c);
    h[3] := add64(h[3], d);
    h[4] := add64(h[4], e);
    h[5] := add64(h[5], f);
    h[6] := add64(h[6], g);
    h[7] := add64(h[7], hh);
  };

  // ── SHA-512 hash function ─────────────────────────────────────────────────
  func sha512Raw(msg : [Nat8]) : [Nat8] {
    let padded = padMessage(msg);
    let h = H0.toVarArray();
    let numBlocks = padded.size() / 128;
    var blockIdx = 0;
    while (blockIdx < numBlocks) {
      sha512Compress(h, padded, blockIdx * 128);
      blockIdx += 1;
    };
    // Serialize the 8 × 64-bit hash words into 64 bytes
    let out = Array.repeat<Nat8>(0, 64).toVarArray();
    var i = 0;
    while (i < 8) {
      let word = h[i];
      out[i * 8 + 0] := Nat8.fromNat(((word >> 56) & 0xff).toNat());
      out[i * 8 + 1] := Nat8.fromNat(((word >> 48) & 0xff).toNat());
      out[i * 8 + 2] := Nat8.fromNat(((word >> 40) & 0xff).toNat());
      out[i * 8 + 3] := Nat8.fromNat(((word >> 32) & 0xff).toNat());
      out[i * 8 + 4] := Nat8.fromNat(((word >> 24) & 0xff).toNat());
      out[i * 8 + 5] := Nat8.fromNat(((word >> 16) & 0xff).toNat());
      out[i * 8 + 6] := Nat8.fromNat(((word >> 8)  & 0xff).toNat());
      out[i * 8 + 7] := Nat8.fromNat(((word >> 0)  & 0xff).toNat());
      i += 1;
    };
    Prim.Array_tabulate(out.size(), func i = out[i]);
  };

  // ── HMAC-SHA512 ───────────────────────────────────────────────────────────
  // Block size for SHA-512 is 128 bytes.
  // HMAC(K, m) = SHA512((K' XOR opad) || SHA512((K' XOR ipad) || m))
  // where K' is the key padded (or hashed) to 128 bytes.
  let BLOCK_SIZE = 128;
  let IPAD : Nat8 = 0x36;
  let OPAD : Nat8 = 0x5c;

  public func hmacSha512(key : Blob, message : Blob) : Blob {
    let keyBytes = Blob.toArray(key);
    let msgBytes = Blob.toArray(message);

    // Normalise key to BLOCK_SIZE bytes
    let normKey : [Nat8] = if (keyBytes.size() > BLOCK_SIZE) {
      sha512Raw(keyBytes); // hash down to 64 bytes, then zero-pad to 128
    } else {
      keyBytes;
    };
    let k = Array.repeat<Nat8>(0, BLOCK_SIZE).toVarArray();
    var i = 0;
    while (i < normKey.size()) {
      k[i] := normKey[i];
      i += 1;
    };

    // Compute ipad-key and opad-key
    let ikeypad = Array.repeat<Nat8>(0, BLOCK_SIZE).toVarArray();
    let okeypad = Array.repeat<Nat8>(0, BLOCK_SIZE).toVarArray();
    i := 0;
    while (i < BLOCK_SIZE) {
      ikeypad[i] := k[i] ^ IPAD;
      okeypad[i] := k[i] ^ OPAD;
      i += 1;
    };

    // inner = SHA512(ikeypad || message)
    let innerInput = Array.repeat<Nat8>(0, BLOCK_SIZE + msgBytes.size()).toVarArray();
    i := 0;
    while (i < BLOCK_SIZE) {
      innerInput[i] := ikeypad[i];
      i += 1;
    };
    var j = 0;
    while (j < msgBytes.size()) {
      innerInput[BLOCK_SIZE + j] := msgBytes[j];
      j += 1;
    };
    let innerHash = sha512Raw(Prim.Array_tabulate(innerInput.size(), func i = innerInput[i]));

    // outer = SHA512(okeypad || inner)
    let outerInput = Array.repeat<Nat8>(0, BLOCK_SIZE + 64).toVarArray();
    i := 0;
    while (i < BLOCK_SIZE) {
      outerInput[i] := okeypad[i];
      i += 1;
    };
    j := 0;
    while (j < 64) {
      outerInput[BLOCK_SIZE + j] := innerHash[j];
      j += 1;
    };
    let outerHash = sha512Raw(Prim.Array_tabulate(outerInput.size(), func i = outerInput[i]));

    Blob.fromArray(outerHash);
  };

  // ── Hex encoding ──────────────────────────────────────────────────────────
  public func toHex(blob : Blob) : Text {
    let HEX : [Nat8] = [0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37,
                        0x38, 0x39, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66];
    let bytes = Blob.toArray(blob);
    var result = "";
    for (b in bytes.values()) {
      let hi = ((b >> 4) & 0x0f).toNat();
      let lo = (b & 0x0f).toNat();
      result #= Text.fromChar(Char.fromNat32(HEX[hi].toNat32()));
      result #= Text.fromChar(Char.fromNat32(HEX[lo].toNat32()));
    };
    result;
  };
};
