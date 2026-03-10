const FATAL_WORKSPACE_PATTERNS = [
  /cannot access ['"`].+['"`] before initialization/i,
  /an error occurred in the <universeworkspace> component/i,
  /uncaught (referenceerror|typeerror|syntaxerror)/i,
];

export function isFatalWorkspaceRuntimeText(message) {
  const text = String(message || "").trim();
  if (!text) return false;
  return FATAL_WORKSPACE_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildWorkspaceEntryCrashMessage({
  pageErrorMessage = "",
  consoleMessage = "",
  fallback = "Workspace crashed before becoming ready.",
} = {}) {
  const pageError = String(pageErrorMessage || "").trim();
  const consoleError = String(consoleMessage || "").trim();
  if (pageError) return `Workspace crashed before becoming ready: ${pageError}`;
  if (consoleError) return `Workspace crashed before becoming ready: ${consoleError}`;
  return fallback;
}
