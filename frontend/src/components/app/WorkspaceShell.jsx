import { useConnectivityState } from "../../hooks/useConnectivityState";
import { useAuth } from "../../context/AuthContext.jsx";
import EmptyGalaxyBootstrapScreen from "./EmptyGalaxyBootstrapScreen.jsx";
import UniverseWorkspace from "../universe/UniverseWorkspace";

export default function WorkspaceShell() {
  const { createGalaxy, defaultGalaxy, galaxyBootstrapError, galaxyBootstrapState, logout } = useAuth();
  const connectivity = useConnectivityState();

  if (
    (!defaultGalaxy && galaxyBootstrapState === "loading_galaxies") ||
    galaxyBootstrapState === "empty_galaxy" ||
    galaxyBootstrapState === "workspace_error"
  ) {
    return (
      <EmptyGalaxyBootstrapScreen
        connectivity={connectivity}
        busy={galaxyBootstrapState === "loading_galaxies"}
        error={galaxyBootstrapError}
        onCreateGalaxy={createGalaxy}
      />
    );
  }

  return <UniverseWorkspace defaultGalaxy={defaultGalaxy} connectivity={connectivity} onLogout={logout} />;
}
