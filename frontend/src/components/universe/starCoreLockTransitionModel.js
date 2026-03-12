export function resolveStarCoreLockTransitionModel({ interiorModel = null, selectedConstitution = null } = {}) {
  const phase = String(interiorModel?.phase || "closed").trim();

  if (phase === "policy_lock_transition") {
    return {
      title: "Uzamykání politik probíhá",
      hint: "Governance prstenec se fyzicky uzavírá kolem jádra.",
      actionLabel: "Uzamykám Srdce hvězdy",
      disabled: true,
    };
  }

  if (phase === "first_orbit_ready") {
    return {
      title: "První oběžná dráha je připravená",
      hint: "Uzamčení proběhlo. Můžeš se vrátit do prostoru galaxie.",
      actionLabel: "Vrátit se do prostoru",
      disabled: false,
    };
  }

  if (phase === "policy_lock_ready") {
    return {
      title: "Ústava je připravena k uzamčení",
      hint: selectedConstitution
        ? `${selectedConstitution.title}: ${selectedConstitution.effectHint}`
        : "Vyber ústavu prostoru a potvrď governance lock.",
      actionLabel: "Potvrdit ústavu a uzamknout politiky",
      disabled: !selectedConstitution,
    };
  }

  return {
    title: "Vyber ústavu prostoru",
    hint: "Každý režim mění puls, tón a chování budoucí galaxie.",
    actionLabel: "",
    disabled: true,
  };
}
