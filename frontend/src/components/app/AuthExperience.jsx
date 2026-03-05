import LandingDashboard from "../screens/LandingDashboard";

export default function AuthExperience({ onLogin, onRegister, busy, error }) {
  return <LandingDashboard onLogin={onLogin} onRegister={onRegister} busy={busy} error={error} />;
}
