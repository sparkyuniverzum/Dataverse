import { useEffect, useState } from "react";

import { STAR_CORE_PROFILES } from "./lawResolver";

const ANIMATION_MS = 260;

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 84,
  background:
    "radial-gradient(circle at 50% 36%, rgba(35, 114, 156, 0.26) 0%, rgba(11, 22, 40, 0.88) 45%, rgba(2, 6, 14, 0.96) 100%)",
  backdropFilter: "blur(8px)",
  display: "grid",
  placeItems: "center",
  padding: "24px 16px",
  transition: `opacity ${ANIMATION_MS}ms ease, transform ${ANIMATION_MS}ms ease`,
};

const shellStyle = {
  width: "min(1180px, 100%)",
  maxHeight: "calc(100vh - 48px)",
  overflow: "auto",
  borderRadius: 18,
  border: "1px solid rgba(120, 208, 244, 0.34)",
  background: "linear-gradient(170deg, rgba(8, 18, 34, 0.92), rgba(4, 9, 18, 0.9))",
  boxShadow: "0 0 36px rgba(22, 116, 164, 0.34)",
  color: "#def7ff",
  padding: 18,
  display: "grid",
  gap: 12,
  transition: `opacity ${ANIMATION_MS}ms ease, transform ${ANIMATION_MS}ms ease`,
};

const cardStyle = {
  border: "1px solid rgba(102, 192, 227, 0.24)",
  borderRadius: 12,
  background: "rgba(6, 14, 28, 0.8)",
  padding: 12,
  display: "grid",
  gap: 6,
};

const ctaButtonStyle = {
  border: "1px solid rgba(114, 219, 252, 0.48)",
  background: "linear-gradient(120deg, #36bde8, #7ee4ff)",
  color: "#07263b",
  borderRadius: 11,
  padding: "11px 14px",
  fontWeight: 800,
  letterSpacing: "var(--dv-tr-tight)",
  cursor: "pointer",
};

const ghostButtonStyle = {
  border: "1px solid rgba(122, 191, 221, 0.28)",
  borderRadius: 9,
  background: "rgba(7, 16, 31, 0.92)",
  color: "#d6f4ff",
  padding: "8px 10px",
  cursor: "pointer",
};

function boolLabel(value) {
  return value ? "ON" : "OFF";
}

function formatLockTime(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString("cs-CZ");
}

export default function StarHeartDashboard({
  open,
  phase,
  starCoreProfile,
  starPolicy,
  starRuntime,
  starDomains,
  selectedProfileKey,
  applyBusy = false,
  applyError = "",
  onSelectProfile,
  onApplyProfileLock,
  onClose,
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), ANIMATION_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  if (!mounted) return null;

  const lockStatus = String(starPolicy?.lock_status || "draft").toLowerCase();
  const isLocked = lockStatus === "locked";
  const profileLabel = String(starCoreProfile?.profile?.label || "Origin Core");
  const lawPreset = String(starCoreProfile?.recommendedLawPreset || "balanced");
  const writesPerMinute = Number.isFinite(Number(starRuntime?.writes_per_minute))
    ? Number(starRuntime.writes_per_minute).toFixed(2)
    : "0.00";
  const eventsCount = Number.isFinite(Number(starRuntime?.events_count)) ? Number(starRuntime.events_count) : 0;
  const activeProfileKey = String(selectedProfileKey || starCoreProfile?.profile?.key || "ORIGIN").toUpperCase();
  const profileCards = Object.values(STAR_CORE_PROFILES);
  const topDomains = (Array.isArray(starDomains) ? starDomains : []).slice(0, 5);
  const statusLabel = isLocked ? "Uzamceno" : phase === "apply_profile" ? "Aplikuji profil..." : "Pripraveno";
  const laws = [
    {
      key: "no_hard_delete",
      title: "Zakaz tvrdeho mazani",
      value: boolLabel(starPolicy?.no_hard_delete !== false),
      impact: "Data se fyzicky nelikviduji. Historie zustava konzistentni pro dashboardy a timeline.",
    },
    {
      key: "deletion_mode",
      title: "Rezim mazani",
      value: String(starPolicy?.deletion_mode || "soft_delete"),
      impact: "Mazani probiha jako update priznakem, ne delete operaci.",
    },
    {
      key: "occ_enforced",
      title: "OCC ochrana soubehu",
      value: boolLabel(starPolicy?.occ_enforced !== false),
      impact: "Paralelni zapisy neprepisuji data naslepo. Kolize jsou odhaleny a rizene obnoveny.",
    },
    {
      key: "idempotency_supported",
      title: "Idempotence prikazu",
      value: boolLabel(starPolicy?.idempotency_supported !== false),
      impact: "Opakovany request se neprovede vicekrat. Brani to duplikacim pri retry.",
    },
    {
      key: "branch_scope_supported",
      title: "Branch scope",
      value: boolLabel(starPolicy?.branch_scope_supported !== false),
      impact: "Zakony plati konzistentne i pro vetve a jejich promoci.",
    },
  ];

  return (
    <div
      style={{
        ...overlayStyle,
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(1.015)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <section
        style={{
          ...shellStyle,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0px)" : "translateY(10px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wider)", opacity: 0.78 }}>
              HEART OF STAR
            </div>
            <div style={{ fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800 }}>Ridici dashboard fyzikalnich zakonu galaxie</div>
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.8 }}>
              Profil <strong>{profileLabel}</strong> | preset <strong>{lawPreset}</strong> | lock <strong>{lockStatus}</strong>
            </div>
          </div>
          <button type="button" onClick={onClose} style={ghostButtonStyle}>
            Zpet do vesmiru
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
          <article style={cardStyle}>
            <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.78 }}>AKTIVITA</div>
            <div style={{ fontSize: "var(--dv-fs-sm)" }}>
              Write/min: <strong>{writesPerMinute}</strong>
            </div>
            <div style={{ fontSize: "var(--dv-fs-sm)" }}>
              Eventy v okne: <strong>{eventsCount}</strong>
            </div>
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.76 }}>
              Tohle urcuje, jak moc hvezda pulzuje a jak agresivne se projevuji vizualni efekty.
            </div>
          </article>

          <article style={cardStyle}>
            <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.78 }}>USTAVA</div>
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.86 }}>
              Status: <strong>{statusLabel}</strong> | Policy verze{" "}
              <strong>{Number.isFinite(Number(starPolicy?.policy_version)) ? Number(starPolicy.policy_version) : 1}</strong>
            </div>
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.76 }}>
              Locked at: <strong>{formatLockTime(starPolicy?.locked_at)}</strong>
            </div>
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.76 }}>
              Topologie: <strong>{String(starCoreProfile?.topologyMode || "single_star_per_galaxy")}</strong> | Rezim:{" "}
              <strong>{String(starCoreProfile?.profileMode || "auto")}</strong>
            </div>
          </article>
        </div>

        <article style={cardStyle}>
          <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.78 }}>PROFILY HVEZDY</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
            {profileCards.map((profile) => {
              const selected = activeProfileKey === profile.key;
              return (
                <button
                  key={profile.key}
                  type="button"
                  disabled={isLocked || applyBusy}
                  onClick={() => onSelectProfile(profile.key)}
                  style={{
                    border: selected ? "1px solid rgba(124, 231, 255, 0.72)" : "1px solid rgba(112, 199, 234, 0.22)",
                    background: selected
                      ? `linear-gradient(145deg, ${profile.primaryColor}22, ${profile.secondaryColor}14)`
                      : "rgba(7, 16, 31, 0.84)",
                    borderRadius: 10,
                    padding: "8px 9px",
                    color: "#dcf8ff",
                    textAlign: "left",
                    cursor: isLocked ? "not-allowed" : "pointer",
                    opacity: isLocked && !selected ? 0.66 : 1,
                  }}
                >
                  <div style={{ fontSize: "var(--dv-fs-xs)", fontWeight: 700 }}>{profile.label}</div>
                  <div style={{ fontSize: "var(--dv-fs-2xs)", opacity: 0.78 }}>{profile.description}</div>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <button
              type="button"
              onClick={onApplyProfileLock}
              disabled={isLocked || applyBusy}
              style={{
                ...ctaButtonStyle,
                opacity: isLocked ? 0.55 : 1,
                cursor: isLocked ? "not-allowed" : "pointer",
              }}
            >
              {isLocked ? "Jadro uzamceno" : applyBusy ? "Aplikuji..." : "Aplikovat profil a uzamknout"}
            </button>
            <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.78 }}>
              {isLocked
                ? "Core zakony jsou uzamceny. Dalsi zmena pouze rizenou migraci."
                : "Po locku se core zakony nemeni a timeline zustava stabilni."}
            </div>
          </div>
          {applyError ? <div style={{ fontSize: "var(--dv-fs-xs)", color: "#ffb5c8" }}>{applyError}</div> : null}
        </article>

        <article style={cardStyle}>
          <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.78 }}>ZAKONY A DOPAD</div>
          <div style={{ display: "grid", gap: 8 }}>
            {laws.map((law) => (
              <div
                key={law.key}
                style={{
                  border: "1px solid rgba(106, 183, 214, 0.18)",
                  borderRadius: 9,
                  padding: "8px 9px",
                  background: "rgba(5, 12, 24, 0.72)",
                }}
              >
                <div style={{ fontSize: "var(--dv-fs-xs)" }}>
                  <strong>{law.title}</strong> | <span style={{ opacity: 0.88 }}>{law.value}</span>
                </div>
                <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.74 }}>{law.impact}</div>
              </div>
            ))}
          </div>
        </article>

        <article style={cardStyle}>
          <div style={{ fontSize: "var(--dv-fs-2xs)", letterSpacing: "var(--dv-tr-wide)", opacity: 0.78 }}>DOMENOVA ODEZVA</div>
          <div style={{ display: "grid", gap: 5 }}>
            {topDomains.length ? (
              topDomains.map((domain) => (
                <div key={String(domain?.domain_name || "")} style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.84 }}>
                  {String(domain?.domain_name || "Uncategorized")} | activity{" "}
                  <strong>{Number.isFinite(Number(domain?.activity_intensity)) ? Number(domain.activity_intensity).toFixed(2) : "0.00"}</strong>{" "}
                  | status <strong>{String(domain?.status || "GREEN")}</strong>
                </div>
              ))
            ) : (
              <div style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.68 }}>Zatim nejsou dostupna domenova data.</div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
