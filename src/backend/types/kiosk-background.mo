// Kiosk background images and suggestion config types
module {
  /// A background image for the kiosk slideshow
  public type BackgroundImage = {
    id         : Nat;
    url        : Text;
    fileName   : Text;
    uploadedAt : Int;
    isDefault  : Bool;
  };

  /// Global suggestion carousel configuration
  public type SuggestionConfig = {
    suggestionsEnabled : Bool;
    maxAddOns          : Nat;
    maxDrinks          : Nat;
  };

  /// Mutable state wrapper for background + suggestion config
  public type KioskBackgroundState = {
    var backgroundImages  : [BackgroundImage];
    var suggestionConfig  : SuggestionConfig;
    var nextImageId       : Nat;
  };
};
