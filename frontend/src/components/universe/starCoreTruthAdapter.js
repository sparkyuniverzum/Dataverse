import { normalizeGalaxyPublic } from "../../lib/workspaceScopeContract";
import { normalizeStarPhysicsHalo, normalizeStarPhysicsProfile, normalizeStarPolicy } from "./starContract";
import { resolveStarCoreProfileMeta, resolveStarPhysicalProfileMeta } from "./lawResolver";

export function adaptStarCoreTruth({
  galaxy,
  connectivity = null,
  policyPayload = null,
  physicsProfilePayload = null,
} = {}) {
  const normalizedGalaxy = normalizeGalaxyPublic(galaxy);
  if (!normalizedGalaxy) return null;

  const policy = normalizeStarPolicy(policyPayload);
  const physicsProfile = normalizeStarPhysicsProfile(physicsProfilePayload);
  const profileMeta = resolveStarCoreProfileMeta(policy.profile_key);
  const physicalProfileMeta = resolveStarPhysicalProfileMeta(physicsProfile.profile_key);
  const halo = normalizeStarPhysicsHalo(physicsProfile);

  return {
    galaxy: normalizedGalaxy,
    connectivity: {
      isOnline: connectivity?.isOnline !== false,
      isOffline: Boolean(connectivity?.isOffline),
    },
    policy,
    physicsProfile,
    profileMeta,
    physicalProfileMeta,
    halo,
  };
}
