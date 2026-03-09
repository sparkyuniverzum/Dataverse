export function resolveWorkflowNextActionLabel(workflowState = {}) {
  const planetReady = Boolean(workflowState?.planetReady);
  const rowReady = Boolean(workflowState?.rowReady);
  const mineralReady = Boolean(workflowState?.mineralReady);

  if (!planetReady) return "Vyber planetu";
  if (!rowReady) return "Vybrat prvni civilizaci";
  if (!mineralReady) return "Predvyplnit klic nerostu";
  return "Pripravit ulozeni nerostu";
}
