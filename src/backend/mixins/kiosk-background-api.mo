// Public API mixin for kiosk background images and suggestion config
import Time      "mo:core/Time";
import KBTypes   "../types/kiosk-background";
import KBLib     "../lib/kiosk-background";

mixin (
  kbState             : KBTypes.KioskBackgroundState,
  getBusinessOwner    : () -> Principal,
) {

  // ── Internal helpers ────────────────────────────────────────────────────

  func isKbBusinessOwner(caller : Principal) : Bool {
    caller == getBusinessOwner();
  };

  // ── Background images — public queries ──────────────────────────────────

  /// List all stored background images
  public query func listBackgroundImages() : async [KBTypes.BackgroundImage] {
    KBLib.listImages(kbState);
  };

  // ── Background images — mutations ───────────────────────────────────────

  /// Upload a background image URL (object-storage URL passed from frontend);
  /// only the business owner may call this.
  public shared ({ caller }) func uploadBackgroundImage(
    url      : Text,
    fileName : Text,
  ) : async { #ok : KBTypes.BackgroundImage; #err : Text } {
    if (not isKbBusinessOwner(caller)) {
      return #err "Unauthorized";
    };
    let img = KBLib.addImage(kbState, url, fileName, Time.now());
    #ok img;
  };

  /// Delete a background image by id;
  /// only the business owner may call this.
  public shared ({ caller }) func deleteBackgroundImage(
    id : Nat,
  ) : async { #ok : (); #err : Text } {
    if (not isKbBusinessOwner(caller)) {
      return #err "Unauthorized";
    };
    if (KBLib.deleteImage(kbState, id)) {
      #ok ();
    } else {
      #err "Image not found";
    };
  };

  // ── Suggestion config ───────────────────────────────────────────────────

  /// Return the global suggestion carousel configuration
  public query func getSuggestionConfig() : async KBTypes.SuggestionConfig {
    KBLib.getSuggestionConfig(kbState);
  };

  /// Update the global suggestion carousel configuration;
  /// only the business owner may call this.
  public shared ({ caller }) func setSuggestionConfig(
    config : KBTypes.SuggestionConfig,
  ) : async { #ok : (); #err : Text } {
    if (not isKbBusinessOwner(caller)) {
      return #err "Unauthorized";
    };
    KBLib.setSuggestionConfig(kbState, config);
    #ok ();
  };
};
