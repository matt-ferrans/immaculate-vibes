// Immaculate Vibes setup-wizard core.
//
// The wizard onboards the external services an app needs (Railway, GitHub,
// CodeRabbit, Sentry, email, secrets) and "locks in" the variables a human
// or a downstream agent needs to finish wiring things up.
//
// SAFETY-FIRST DESIGN: this module performs NO outward mutation. It builds a
// *plan* and a *handoff manifest* from declarative provider definitions
// (providers.mjs). Actually creating cloud resources / writing remote vars is
// a separate, explicitly-approved step that isn't implemented here — the
// default and only behavior right now is plan-only. That's deliberate so the
// wizard is safe to run unattended (and by agents) without touching anything.
//
// Secret hygiene: the plan/handoff record only variable *metadata* (name,
// destination, how to obtain it) — never values. Generated-secret specs are
// described, not generated, at plan time.

import { PROVIDERS } from "./providers.mjs";

/**
 * Build the setup plan: for the requested services, gather every variable
 * (with routing), the automatable steps, and the manual steps.
 *
 * @param {object} opts
 * @param {string[]} [opts.services] - provider ids to include (default: all).
 * @returns {{ services: Array, vars: Array, manualSteps: Array, summary: object }}
 */
export function buildPlan({ services } = {}) {
  const wanted = services && services.length > 0 ? services : Object.keys(PROVIDERS);
  const planServices = [];
  const vars = [];
  const manualSteps = [];

  for (const id of wanted) {
    const provider = PROVIDERS[id];
    if (!provider) {
      planServices.push({ id, error: "unknown provider" });
      continue;
    }
    const pVars = provider.vars ?? [];
    const pManual = provider.manualSteps ?? [];
    planServices.push({
      id,
      summary: provider.summary,
      varCount: pVars.length,
      autoCount: (provider.autoSteps ?? []).length,
      manualCount: pManual.length,
    });
    for (const v of pVars) {
      vars.push({ ...v, provider: id });
    }
    for (const step of pManual) {
      manualSteps.push({ provider: id, step });
    }
  }

  const summary = {
    services: planServices.length,
    vars: vars.length,
    secrets: vars.filter((v) => v.secret).length,
    manualSteps: manualSteps.length,
  };

  return { services: planServices, vars, manualSteps, summary };
}

/**
 * Where does each variable need to land? Inverts the plan into a
 * destination-keyed view — the "lock in the variables" routing table that an
 * agent or human uses to know what to set where.
 *
 * @param {Array} vars - the plan's vars.
 * @returns {Record<string, Array<{name, provider, secret, source}>>}
 */
export function routeVars(vars) {
  const byDest = {};
  for (const v of vars) {
    for (const dest of v.destinations ?? []) {
      (byDest[dest] ??= []).push({
        name: v.name,
        provider: v.provider,
        secret: !!v.secret,
        source: v.source,
      });
    }
  }
  return byDest;
}

/**
 * The machine-readable handoff manifest written to .iv/handoff.json — the
 * contract a downstream agent reads to finish setup. Contains metadata only,
 * never secret values.
 */
export function buildHandoff(plan) {
  return {
    generatedAt: new Date().toISOString(),
    mode: "plan-only",
    summary: plan.summary,
    services: plan.services,
    routing: routeVars(plan.vars),
    variables: plan.vars.map((v) => ({
      name: v.name,
      provider: v.provider,
      required: !!v.required,
      secret: !!v.secret,
      source: v.source,
      destinations: v.destinations,
      howTo: v.howTo ?? null,
    })),
    manualSteps: plan.manualSteps,
  };
}

export default { buildPlan, routeVars, buildHandoff };
