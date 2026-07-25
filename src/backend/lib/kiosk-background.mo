// Domain logic for kiosk background images and suggestion config
import KBTypes "../types/kiosk-background";
import Array "mo:core/Array";

module {
  public type BackgroundImage  = KBTypes.BackgroundImage;
  public type SuggestionConfig = KBTypes.SuggestionConfig;

  // ── State factory ───────────────────────────────────────────────────────

  /// Default suggestion config: enabled, max 2 add-ons, max 1 drink
  public func defaultSuggestionConfig() : SuggestionConfig {
    { suggestionsEnabled = true; maxAddOns = 2; maxDrinks = 1 };
  };

  /// Initial empty state
  public func emptyState() : KBTypes.KioskBackgroundState {
    {
      var backgroundImages = [];
      var suggestionConfig = defaultSuggestionConfig();
      var nextImageId      = 1;
    };
  };

  // ── Background images ───────────────────────────────────────────────────

  /// Add a new background image and return it
  public func addImage(
    state    : KBTypes.KioskBackgroundState,
    url      : Text,
    fileName : Text,
    now      : Int,
  ) : BackgroundImage {
    let img : KBTypes.BackgroundImage = {
      id         = state.nextImageId;
      url;
      fileName;
      uploadedAt = now;
      isDefault  = false;
    };
    state.backgroundImages := state.backgroundImages.concat([img]);
    state.nextImageId      := state.nextImageId + 1;
    img;
  };

  /// Delete a background image by id; returns true if found and removed
  public func deleteImage(
    state : KBTypes.KioskBackgroundState,
    id    : Nat,
  ) : Bool {
    let before = state.backgroundImages.size();
    state.backgroundImages := state.backgroundImages.filter(func(img) { img.id != id });
    state.backgroundImages.size() < before;
  };

  /// List all background images
  public func listImages(
    state : KBTypes.KioskBackgroundState,
  ) : [BackgroundImage] {
    state.backgroundImages;
  };

  // ── Suggestion config ───────────────────────────────────────────────────

  /// Return the current suggestion config
  public func getSuggestionConfig(
    state : KBTypes.KioskBackgroundState,
  ) : SuggestionConfig {
    state.suggestionConfig;
  };

  /// Replace the suggestion config
  public func setSuggestionConfig(
    state  : KBTypes.KioskBackgroundState,
    config : SuggestionConfig,
  ) : () {
    state.suggestionConfig := config;
  };
};
