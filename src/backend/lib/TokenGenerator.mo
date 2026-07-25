// TokenGenerator.mo — Shared token and activation-code generation utilities
import Int "mo:core/Int";
import Text "mo:core/Text";

module TokenGenerator {

  /// Convert a Nat to a lowercase hex string.
  public func natToHex(n : Nat) : Text {
    let hexChars = ["0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f"];
    if (n == 0) return "0";
    var result = "";
    var remaining = n;
    while (remaining > 0) {
      result := hexChars[remaining % 16] # result;
      remaining := remaining / 16;
    };
    result;
  };

  /// Generate a 64-char hex device token from Time-based seeds.
  /// seed1: an Int (e.g. Time.now()), seed2: a Nat (e.g. counter).
  public func generateHexToken(seed1 : Int, seed2 : Nat) : Text {
    let t = Int.abs(seed1);
    let c = seed2;
    let raw = natToHex(t) # natToHex(c * 1_000_003)
            # natToHex(t / 1_000 + c * 997)
            # natToHex(c * 1_000_033 + t / 1_000_000)
            # natToHex(t * 7 + c * 13)
            # natToHex(c * 999_983 + t / 10_000);
    let padded = raw # "0000000000000000000000000000000000000000000000000000000000000000";
    Text.fromIter(padded.toIter() |> _.take(64));
  };

  /// Generate a 6-char uppercase alphanumeric activation code.
  /// Uses charset "ABCDEFGHJKMNPQRSTUVWXYZ23456789" (omits I, O, 1, L to avoid confusion).
  public func generateActivationCode(seed : Int) : Text {
    let chars = ["A","B","C","D","E","F","G","H","J","K","M","N","P","Q","R",
                 "S","T","U","V","W","X","Y","Z","2","3","4","5","6","7","8","9"];
    let n = chars.size(); // 31
    var s = Int.abs(seed);
    var code = "";
    var i = 0;
    while (i < 6) {
      s := s * 6_364_136_223_846_793_005 + 1_442_695_040_888_963_407;
      code := code # chars[s % n];
      i += 1;
    };
    code;
  };
};
