# Contract Gate Plan v2

Date: 2026-03-05  
Owner: Core BE/FE

## 1. Goal

Close remaining contract gaps for MVP sign-off with repeatable BE/FE test gates.

## 2. BE gates

1. Contract doc closure:
- `PYTHONPATH=. pytest -q tests/test_contract_docs_closure.py`
- `PYTHONPATH=. pytest -q tests/test_domain_payload_contract_shapes.py`

2. Existing contract baselines:
- `PYTHONPATH=. pytest -q tests/test_star_contract_baseline.py`
- `PYTHONPATH=. pytest -q tests/test_galaxy_workspace_contract_baseline.py`
- `PYTHONPATH=. pytest -q tests/test_moon_contract_baseline.py`
- `PYTHONPATH=. pytest -q tests/test_moon_contract_freeze_gate.py`
- `PYTHONPATH=. pytest -q tests/test_civilization_contract_baseline.py`
- `PYTHONPATH=. pytest -q tests/test_mineral_contract_baseline.py`
- `PYTHONPATH=. pytest -q tests/test_semantic_constitution_contract.py`
- `PYTHONPATH=. pytest -q tests/test_parser2_spec_contract.py tests/test_parser_service.py -k "contract"`
- `PYTHONPATH=. pytest -q tests/test_schemas_table_contract.py`

3. Integration closure (minimum):
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "star_core_endpoint_by_endpoint_closure_v2 or moon_first_class_crud_endpoints or civilization_contract_gate_create_mutate_extinguish_and_converge or mineral_contract_gate_typing_validation_and_facts_projection or release_gate_star_lock_first_planet_grid_convergence or semantic_constitution_endpoint_by_endpoint_closure_v1"`

## 3. FE gates

1. Star contract and physics render gates:
- `cd frontend && npm test -- --run src/components/universe/starContract.test.js src/components/universe/scene/physicsSystem.test.js`

2. Semantic constitution FE freeze gate:
- `cd frontend && npm test -- --run src/lib/semanticConstitutionContract.test.js src/lib/builderParserCommand.test.js src/lib/dataverseApi.test.js`

3. Workspace and scope data-shape gates:
- `cd frontend && npm test -- --run src/lib/dataverseApi.test.js src/lib/workspaceScopeContract.test.js src/components/universe/workspaceFormatters.test.js src/components/universe/workspaceContract.test.js`

4. Moon first-class contract freeze gate:
- `cd frontend && npm test -- --run src/lib/moonContract.test.js src/lib/dataverseApi.test.js`

## 4. Unified smoke gate

1. Run BE gates from section 2.
2. Run FE gates from section 3.
3. Build staging:
- `cd frontend && npm run build -- --mode staging`
4. CI entrypoint:
- `make contract-gate`

If all pass, contract layer is considered release-ready for current MVP scope.
