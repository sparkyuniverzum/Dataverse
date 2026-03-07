# Planet/Civilization deterministic fixtures

Purpose:
1. provide stable two-planet scenarios for LF validation gates,
2. cover both compatible and incompatible cross-planet bond attempts.

Files:
1. `compatible_cross_planet_bond.json`
2. `incompatible_cross_planet_bond.json`

Usage guideline:
1. load fixture by `fixture_id`,
2. seed planets/civilizations in listed order,
3. execute listed `candidate_bond`,
4. assert expected `decision` and `reject_code` (if present).
