import LandingDashboard from "../screens/LandingDashboard";
import AppConnectivityNotice from "./AppConnectivityNotice";

export default function AuthExperience({
  onLogin,
  onRegister,
  onForgotPassword,
  busy,
  error,
  connectivityNotice = null,
}) {
  return (
    <>
      <AppConnectivityNotice notice={connectivityNotice} />
      <LandingDashboard
        onLogin={onLogin}
        onRegister={onRegister}
        onForgotPassword={onForgotPassword}
        busy={busy}
        error={error}
      />
    </>
  );
}
