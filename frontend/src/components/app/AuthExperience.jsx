import LandingDashboard from "../screens/LandingDashboard";

export default function AuthExperience({ onLogin, onRegister, onForgotPassword, busy, error }) {
  return (
    <LandingDashboard
      onLogin={onLogin}
      onRegister={onRegister}
      onForgotPassword={onForgotPassword}
      busy={busy}
      error={error}
    />
  );
}
