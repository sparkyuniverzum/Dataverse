import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Stars } from "@react-three/drei";
import * as THREE from "three";

function createRng(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGalaxyData() {
  const rng = createRng(24031991);
  const nodes = [];
  const links = [];
  const particlePositions = [];

  for (let i = 0; i < 22; i += 1) {
    const orbit = 2.3 + i * 0.26 + rng() * 0.4;
    const theta = (i / 22) * Math.PI * 2 + rng() * 0.5;
    const vertical = (rng() - 0.5) * 1.4;
    nodes.push({
      id: `n-${i}`,
      position: [Math.cos(theta) * orbit, vertical, Math.sin(theta) * orbit],
      radius: 0.07 + rng() * 0.11,
      color: i % 3 === 0 ? "#8ce9ff" : i % 3 === 1 ? "#8db6ff" : "#b6fff0",
      pulse: 0.6 + rng() * 1.8,
      phase: rng() * Math.PI * 2,
    });
  }

  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i];
    const b = nodes[(i + 1) % nodes.length];
    links.push([a.position, b.position]);
    if (i % 4 === 0) {
      const c = nodes[(i + 7) % nodes.length];
      links.push([a.position, c.position]);
    }
  }

  for (let i = 0; i < 650; i += 1) {
    const theta = rng() * Math.PI * 2;
    const r = 1.2 + Math.pow(rng(), 0.9) * 5.8;
    const y = (rng() - 0.5) * 2.6;
    particlePositions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
  }

  return {
    nodes,
    links,
    particlePositions: new Float32Array(particlePositions),
  };
}

function GalaxyHeroScene({ pointer }) {
  const groupRef = useRef(null);
  const data = useMemo(buildGalaxyData, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.y += delta * 0.12;
    groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, pointer.y * 0.24, 3.8, delta);
    groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, -pointer.x * 0.18, 3.8, delta);

    for (const child of groupRef.current.children) {
      if (child.userData?.isNode) {
        const amp = child.userData.pulse;
        const phase = child.userData.phase;
        const scale = 1 + Math.sin(t * amp + phase) * 0.08;
        child.scale.set(scale, scale, scale);
      }
    }
  });

  return (
    <>
      <color attach="background" args={["#02050c"]} />
      <fog attach="fog" args={["#02050c", 6, 24]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={2.4} color="#7adfff" />
      <directionalLight position={[4, 3, 2]} intensity={1.0} color="#c0ebff" />
      <directionalLight position={[-4, -2, -2]} intensity={0.4} color="#87a9ff" />
      <Stars radius={70} depth={30} count={1800} factor={4} saturation={0} fade speed={0.2} />

      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[0.6, 30, 30]} />
          <meshStandardMaterial
            color="#e8f8ff"
            emissive="#6edfff"
            emissiveIntensity={1.05}
            roughness={0.18}
            metalness={0.26}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.95, 28, 28]} />
          <meshBasicMaterial color="#69d8ff" transparent opacity={0.2} depthWrite={false} />
        </mesh>

        {data.links.map((points, idx) => (
          <Line key={`ln-${idx}`} points={points} color="#58cbff" lineWidth={0.8} transparent opacity={0.34} />
        ))}

        {data.nodes.map((node) => (
          <mesh
            key={node.id}
            position={node.position}
            userData={{ isNode: true, pulse: node.pulse, phase: node.phase }}
          >
            <sphereGeometry args={[node.radius, 18, 18]} />
            <meshStandardMaterial
              color={node.color}
              emissive={node.color}
              emissiveIntensity={0.9}
              roughness={0.24}
              metalness={0.12}
            />
          </mesh>
        ))}

        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[data.particlePositions, 3]}
              count={data.particlePositions.length / 3}
            />
          </bufferGeometry>
          <pointsMaterial size={0.024} color="#95defb" transparent opacity={0.48} depthWrite={false} />
        </points>
      </group>
    </>
  );
}

function FeatureCard({ title, text }) {
  return (
    <div
      style={{
        border: "1px solid rgba(126, 221, 255, 0.24)",
        borderRadius: 12,
        background: "linear-gradient(180deg, rgba(7,17,32,0.66), rgba(4,10,20,0.5))",
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-wide)", color: "#98dbff" }}>{title}</div>
      <div style={{ marginTop: 5, fontSize: "var(--dv-fs-sm)", lineHeight: "var(--dv-lh-relaxed)", opacity: 0.92 }}>
        {text}
      </div>
    </div>
  );
}

export default function LandingDashboard({ onLogin, onRegister, onForgotPassword, busy, error }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [successMessage, setSuccessMessage] = useState("");

  const title = "Vladnete svym datum. Zazehnete svou Galaxii.";

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setSuccessMessage("");
    try {
      if (mode === "login") {
        await onLogin(email.trim(), password);
      } else if (mode === "register") {
        const result = await onRegister(email.trim(), password);
        if (result?.message) {
          setSuccessMessage(result.message);
          setEmail("");
          setPassword("");
        }
      } else if (mode === "forgot-password") {
        const result = await onForgotPassword(email.trim());
        if (result?.message) {
          setSuccessMessage(result.message);
          setEmail("");
        }
      }
    } catch (err) {
      // The parent component is responsible for setting and displaying the error.
    }
  };

  return (
    <main
      style={{
        width: "100vw",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 14% 18%, rgba(44,123,177,0.28), transparent 38%), radial-gradient(circle at 78% 8%, rgba(74,188,224,0.18), transparent 42%), linear-gradient(180deg, #040913 0%, #02050c 100%)",
        color: "#e8f8ff",
        display: "grid",
        placeItems: "center",
        padding: 18,
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          width: "min(1320px, 96vw)",
          minHeight: "min(860px, 94vh)",
          display: "grid",
          gridTemplateColumns: "minmax(360px, 1.35fr) minmax(320px, 0.95fr)",
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid rgba(99, 202, 241, 0.26)",
          boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
          background: "rgba(3, 8, 16, 0.66)",
          backdropFilter: "blur(10px)",
        }}
      >
        <article
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
            setPointer({ x, y });
          }}
          onMouseLeave={() => setPointer({ x: 0, y: 0 })}
          style={{
            position: "relative",
            minHeight: 520,
            borderRight: "1px solid rgba(94, 183, 222, 0.22)",
            overflow: "hidden",
          }}
        >
          <Canvas
            camera={{ position: [0, 1.1, 8.5], fov: 48, near: 0.1, far: 120 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.12 }}
            style={{ position: "absolute", inset: 0 }}
          >
            <GalaxyHeroScene pointer={pointer} />
          </Canvas>

          <div
            style={{
              position: "relative",
              zIndex: 3,
              height: "100%",
              display: "grid",
              alignContent: "space-between",
              gap: 16,
              padding: "24px 24px 22px",
              background:
                "linear-gradient(180deg, rgba(2,8,18,0.48) 0%, rgba(2,8,18,0.06) 38%, rgba(2,8,18,0.68) 100%)",
            }}
          >
            <div>
              <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-code)", opacity: 0.74 }}>
                DATAVERSE / COSMIC DATA ENGINE
              </div>
              <h1 style={{ margin: "12px 0 0", maxWidth: 620, fontSize: "clamp(28px, 3.2vw, 50px)", lineHeight: 1.05 }}>
                {title}
              </h1>
              <p
                style={{
                  marginTop: 12,
                  maxWidth: 620,
                  fontSize: "var(--dv-fs-2xl)",
                  lineHeight: "var(--dv-lh-relaxed)",
                  opacity: 0.9,
                }}
              >
                Data nejsou radky. Jsou to zive ekosystemy planet, mesicu a gravitacnich mostu.
              </p>
            </div>

            <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
              <FeatureCard
                title="VIZUALNI ARCHITEKTURA"
                text="Pozorujte, jak vase informace tvori planety a gravitacni mosty namisto neprehlednych listu."
              />
              <FeatureCard
                title="NEZNICITELNA HISTORIE"
                text="Bez hard delete. Zaznamy se pouze menni nebo mekkce zhasinaji, historicke statistiky zustavaji konzistentni."
              />
              <FeatureCard
                title="DOKONALY RAD"
                text="Od centralni Hvezdy po nejmensi datovy atom. Vse ma sve misto, pravidla i drahu."
              />
            </div>
          </div>
        </article>

        <form
          onSubmit={handleFormSubmit}
          style={{
            display: "grid",
            alignContent: "center",
            gap: 12,
            padding: "22px min(5vw, 34px)",
            background: "linear-gradient(170deg, rgba(6,14,27,0.86), rgba(4,9,18,0.88))",
          }}
        >
          {successMessage ? (
            <>
              <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-code)", color: "#8fd9fb" }}>
                AUTH MODULE
              </div>
              <div style={{ fontSize: "clamp(20px, 2vw, 30px)", fontWeight: 800, lineHeight: 1.1 }}>
                Potvrzeni odeslano
              </div>
              <div style={{ fontSize: "var(--dv-fs-md)", opacity: 0.84, lineHeight: "var(--dv-lh-relaxed)" }}>
                {successMessage}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSuccessMessage("");
                  setMode("login");
                }}
                style={{ ...ctaStyle(false), marginTop: 12 }}
              >
                Zpět na přihlášení
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: "var(--dv-fs-xs)", letterSpacing: "var(--dv-tr-code)", color: "#8fd9fb" }}>
                AUTH MODULE
              </div>
              <div style={{ fontSize: "clamp(20px, 2vw, 30px)", fontWeight: 800, lineHeight: 1.1 }}>
                {mode === "forgot-password" ? "Obnova přístupu" : "Pripojte se k Jadru"}
              </div>
              <div style={{ fontSize: "var(--dv-fs-md)", opacity: 0.84 }}>
                {mode === "forgot-password"
                  ? "Zadejte svůj e-mail, pošleme vám odkaz pro nastavení nového hesla."
                  : "Prihlaseni otevre cisty vesmir, herni plochu a sidebar. Nic navic."}
              </div>

              {mode !== "forgot-password" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    data-testid="auth-mode-login"
                    style={{
                      borderRadius: 10,
                      border: "1px solid rgba(118, 216, 250, 0.42)",
                      background: mode === "login" ? "rgba(48,124,168,0.88)" : "rgba(8,18,32,0.84)",
                      color: "#e4f8ff",
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Vstoupit do Galaxie
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    data-testid="auth-mode-register"
                    style={{
                      borderRadius: 10,
                      border: "1px solid rgba(118, 216, 250, 0.42)",
                      background: mode === "register" ? "rgba(48,124,168,0.88)" : "rgba(8,18,32,0.84)",
                      color: "#e4f8ff",
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Stvorit Workspace
                  </button>
                </div>
              ) : null}

              <label style={{ display: "grid", gap: 6, marginTop: mode !== "forgot-password" ? 2 : 12 }}>
                <span style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.8, letterSpacing: "var(--dv-tr-wide)" }}>
                  E-MAIL PILOTA
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="jmeno@firma.com"
                  data-testid="auth-email-input"
                  style={inputStyle}
                />
              </label>

              {mode !== "forgot-password" ? (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: "var(--dv-fs-xs)", opacity: 0.8, letterSpacing: "var(--dv-tr-wide)" }}>
                    PRISTUPOVY KLIC
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required={mode !== "forgot-password"}
                    placeholder="********"
                    data-testid="auth-password-input"
                    style={inputStyle}
                  />
                </label>
              ) : null}

              {error ? <div style={{ fontSize: "var(--dv-fs-sm)", color: "#ffabc3" }}>{error}</div> : null}

              <button type="submit" disabled={busy} data-testid="auth-submit-button" style={ctaStyle(busy)}>
                {busy
                  ? "Navazuji spojeni..."
                  : mode === "login"
                    ? "Vstoupit do Galaxie"
                    : mode === "register"
                      ? "Iniciovat Hvezdu"
                      : "Odeslat instrukce"}
              </button>

              {mode === "login" ? (
                <div style={{ marginTop: 8, fontSize: "var(--dv-fs-xs)", textAlign: "right" }}>
                  <button type="button" onClick={() => setMode("forgot-password")} style={linkStyle}>
                    Zapomněli jste heslo?
                  </button>
                </div>
              ) : null}

              {mode === "forgot-password" ? (
                <div style={{ marginTop: 8, fontSize: "var(--dv-fs-xs)", textAlign: "right" }}>
                  <button type="button" onClick={() => setMode("login")} style={linkStyle}>
                    Zpět na přihlášení
                  </button>
                </div>
              ) : null}

              {mode !== "forgot-password" ? (
                <div
                  style={{ marginTop: 4, fontSize: "var(--dv-fs-xs)", opacity: 0.72, lineHeight: "var(--dv-lh-relaxed)" }}
                >
                  Pokracovanim potvrzujete, ze chcete aktivovat datovy prostor s event sourcing historii a soft-delete
                  pravidly.
                </div>
              ) : null}
            </>
          )}
        </form>
      </section>

      <style>
        {`@media (max-width: 980px) {
          main section {
            grid-template-columns: 1fr !important;
            min-height: 0 !important;
          }
        }`}
      </style>
    </main>
  );
}

const linkStyle = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#98dbff",
  cursor: "pointer",
  textDecoration: "underline",
  fontSize: "var(--dv-fs-xs)",
  fontFamily: "inherit",
};

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(118, 213, 248, 0.32)",
  background: "linear-gradient(140deg, rgba(8,20,36,0.88), rgba(5,12,22,0.86))",
  color: "#e2f8ff",
  padding: "10px 12px",
  fontSize: "var(--dv-fs-sm)",
  outline: "none",
  boxSizing: "border-box",
};

function ctaStyle(busy) {
  return {
    marginTop: 4,
    borderRadius: 12,
    border: "1px solid rgba(114, 220, 255, 0.52)",
    background: busy ? "rgba(40,58,74,0.82)" : "linear-gradient(120deg, #24b8e5, #67e5ff)",
    color: busy ? "#b8cddb" : "#032434",
    padding: "10px 12px",
    fontWeight: 800,
    cursor: busy ? "not-allowed" : "pointer",
  };
}
