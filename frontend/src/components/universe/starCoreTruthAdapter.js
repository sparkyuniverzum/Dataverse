import { normalizeGalaxyPublic } from "../../lib/workspaceScopeContract";
import { normalizeStarPhysicsHalo, normalizeStarPhysicsProfile, normalizeStarPolicy } from "./starContract";
import { resolveStarCoreProfileMeta, resolveStarPhysicalProfileMeta } from "./lawResolver";

function normalizeRuntimePayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const eventsCount = Number(source.events_count);
  const writesPerMinute = Number(source.writes_per_minute);
  return {
    as_of_event_seq: Number.isFinite(Number(source.as_of_event_seq)) ? Number(source.as_of_event_seq) : null,
    events_count: Number.isFinite(eventsCount) ? eventsCount : 0,
    writes_per_minute: Number.isFinite(writesPerMinute) ? writesPerMinute : 0,
  };
}

function normalizePulsePayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const events = Array.isArray(source.events) ? source.events : [];
  return {
    last_event_seq: Number.isFinite(Number(source.last_event_seq)) ? Number(source.last_event_seq) : null,
    sampled_count: Number.isFinite(Number(source.sampled_count)) ? Number(source.sampled_count) : events.length,
    event_types: Array.isArray(source.event_types) ? source.event_types : [],
    events,
  };
}

function normalizeDomainMetricsPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const domains = Array.isArray(source.domains) ? source.domains : [];
  return {
    total_events_count: Number.isFinite(Number(source.total_events_count)) ? Number(source.total_events_count) : 0,
    updated_at: source.updated_at ?? null,
    domains,
  };
}

export function adaptStarCoreTruth({
  galaxy,
  connectivity = null,
  policyPayload = null,
  physicsProfilePayload = null,
  runtimePayload = null,
  pulsePayload = null,
  domainMetricsPayload = null,
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
    runtime: normalizeRuntimePayload(runtimePayload),
    pulse: normalizePulsePayload(pulsePayload),
    domainMetrics: normalizeDomainMetricsPayload(domainMetricsPayload),
  };
}
