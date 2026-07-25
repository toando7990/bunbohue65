import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Types "../types/common";

mixin (developerProfiles : Map.Map<Principal, Types.DeveloperProfile>) {

  // Returns the profile of the calling principal (developer use only)
  public shared ({ caller }) func getDeveloperProfile() : async ?Types.DeveloperProfile {
    developerProfiles.get(caller);
  };

  // Returns a developer profile by that developer's principal ID.
  // This is a public endpoint so that any caller (e.g. a business owner
  // logging in) can look up the developer's stored businessOwnerPrincipalId
  // and determine their own role without needing developer-level access.
  public query func getPublicDeveloperProfile(developerPrincipalId : Principal) : async ?Types.DeveloperProfile {
    developerProfiles.get(developerPrincipalId);
  };

  public shared ({ caller }) func upsertDeveloperProfile(
    businessOwnerPrincipalId : Principal,
    email : Text,
  ) : async Types.DeveloperProfile {
    let profile : Types.DeveloperProfile = {
      developerPrincipalId = caller;
      businessOwnerPrincipalId = businessOwnerPrincipalId;
      email = email;
    };
    developerProfiles.add(caller, profile);
    profile;
  };
};
