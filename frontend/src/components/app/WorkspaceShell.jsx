import { useConnectivityState } from "../../hooks/useConnectivityState";
import { useAuth } from "../../context/AuthContext.jsx";
import UniverseWorkspace from "../universe/UniverseWorkspace";

export default function WorkspaceShell() {
  const { defaultGalaxy } = useAuth();
  const connectivity = useConnectivityState();

  return <UniverseWorkspace defaultGalaxy={defaultGalaxy} connectivity={connectivity} />;
}
