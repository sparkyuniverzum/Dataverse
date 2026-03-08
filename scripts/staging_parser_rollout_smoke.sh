#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/4] Frontend parser rollout tests"
npm --prefix frontend test -- --run \
  src/lib/parserExecutionMode.test.js \
  src/lib/parserExecutionTelemetry.test.js \
  src/lib/builderParserCommand.test.js

echo "[2/4] Validate staging parser-only defaults"
node --input-type=module <<'NODE'
import { resolveParserExecutionMode } from "./frontend/src/lib/parserExecutionMode.js";

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`[FAIL] ${label}`);
    console.error(`  expected: ${e}`);
    console.error(`  actual:   ${a}`);
    process.exit(1);
  }
}

const stagingDefault = resolveParserExecutionMode({ MODE: "staging" });
assertEqual(stagingDefault, { link: true, ingest: false, extinguish: false }, "staging defaults");

const stagingOverride = resolveParserExecutionMode({
  MODE: "staging",
  VITE_PARSER_ONLY_LINK: "false",
  VITE_PARSER_ONLY_INGEST: "true",
  VITE_PARSER_ONLY_EXTINGUISH: "true",
});
assertEqual(stagingOverride, { link: false, ingest: true, extinguish: true }, "staging env overrides");

console.log("[OK] parser execution mode checks passed");
NODE

echo "[3/4] Static guard for parser-only branches in workspace"
grep -q "if (parserExecutionMode.link)" frontend/src/components/universe/UniverseWorkspace.jsx
grep -q "if (parserExecutionMode.ingest)" frontend/src/components/universe/UniverseWorkspace.jsx
grep -q "if (parserExecutionMode.extinguish)" frontend/src/components/universe/UniverseWorkspace.jsx
echo "[OK] parser-only guards are wired in UniverseWorkspace"

echo "[4/4] Build frontend in staging mode"
npm --prefix frontend run build -- --mode staging

echo "[DONE] Staging parser rollout smoke passed"
