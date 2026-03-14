import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./index.css";
import R3FLabEntry from "./lab/r3f/R3FLabEntry.jsx";
import { shouldOpenR3FLab } from "./lab/r3f/labActivation.js";

const shouldBootR3FLab = shouldOpenR3FLab({
  isDev: import.meta.env.DEV,
  search: typeof window === "undefined" ? "" : window.location.search,
  storage: typeof window === "undefined" ? null : window.localStorage,
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {shouldBootR3FLab ? (
      <R3FLabEntry />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </React.StrictMode>
);
