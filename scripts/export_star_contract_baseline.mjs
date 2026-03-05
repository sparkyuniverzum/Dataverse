#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  STAR_CONTRACT_FIELD_CLASSIFICATION,
  STAR_DOMAIN_BE_FIELDS,
  STAR_DOMAIN_FE_USED_FIELDS,
  STAR_FIELD_CLASS,
  STAR_POLICY_BE_FIELDS,
  STAR_POLICY_FE_USED_FIELDS,
  STAR_PULSE_EVENT_BE_FIELDS,
  STAR_PULSE_FE_USED_FIELDS,
  STAR_RUNTIME_BE_FIELDS,
  STAR_RUNTIME_FE_USED_FIELDS,
  getStarContractClassificationReport,
  getStarContractUsageDiff,
} from "../frontend/src/components/universe/starContract.js";

const nowIso = new Date().toISOString();
const outputPath = resolve(process.cwd(), "docs", "star-contract-baseline-v1.json");

const payload = {
  version: "v1",
  frozen_at: nowIso,
  source_of_truth: {
    policy: {
      be_fields: STAR_POLICY_BE_FIELDS,
      fe_used_fields: STAR_POLICY_FE_USED_FIELDS,
    },
    runtime: {
      be_fields: STAR_RUNTIME_BE_FIELDS,
      fe_used_fields: STAR_RUNTIME_FE_USED_FIELDS,
    },
    domains: {
      be_fields: STAR_DOMAIN_BE_FIELDS,
      fe_used_fields: STAR_DOMAIN_FE_USED_FIELDS,
    },
    pulse_event: {
      be_fields: STAR_PULSE_EVENT_BE_FIELDS,
      fe_used_fields: STAR_PULSE_FE_USED_FIELDS,
    },
  },
  diff: getStarContractUsageDiff(),
  classification: {
    classes: STAR_FIELD_CLASS,
    by_section: STAR_CONTRACT_FIELD_CLASSIFICATION,
    report: getStarContractClassificationReport(),
  },
};

writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
console.log(outputPath);
