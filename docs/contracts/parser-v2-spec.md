# DataVerse Parser 2.0 Specification (Axiom Engine)

Status: frozen (phase 1/3)  
Date: 2026-03-02

Tento dokument definuje syntaxi a diagnostiku Parseru 2.0. Je závazný pro lexer, AST parser a contract testy.

## 1. Processing phases
- Phase A: Lexical analysis -> `Token[]`.
- Phase B: Syntax analysis -> AST.
- Phase C (next phase): semantic planning/resolution (out of scope for this document).

## 2. Token vocabulary
- `ATOM`: ne-quoted symbol nebo část jména (včetně interního `-`, např. `ParserContract-123`).
- `STRING`: quoted literal (`"..."` nebo `'...'`).
- `COLON` (`:`)
- `PLUS` (`+`)
- `ARROW` (`->`)
- `ASSIGN` (`:=` nebo `=`)
- `MINUS` (`-`)
- `DOT` (`.`)
- `COMMA` (`,`) 
- `LPAREN` (`(`)
- `RPAREN` (`)`)
- `EOF`

## 3. Grammar (EBNF)
```ebnf
statement       = relation_expr, [ assign_tail | flow_tail ] ;
assign_tail     = ASSIGN, relation_expr ;
flow_tail       = ARROW, relation_expr ;

relation_expr   = type_expr, { PLUS, type_expr } ;
type_expr       = unary_expr, { COLON, unary_expr } ;
unary_expr      = [ MINUS ], primary_expr ;

primary_expr    = group_or_expr | entity_or_ref ;

entity_or_ref   = entity_name, [ DOT, field_name ] ;
entity_name     = name_part, { name_part } ;
field_name      = name_part ;
name_part       = ATOM | STRING ;

group_or_expr   = LPAREN, relation_expr, [ COMMA, relation_expr, { COMMA, relation_expr } ], RPAREN ;
```

## 4. Operator semantics (syntax level)
- `:` builds `TYPE_LINK`.
- `+` builds `RELATION_LINK`.
- `-` as unary prefix builds `EXTINGUISH`.
- `entity.field := value` builds `ASSIGN`.
- `expr -> expr` builds `FLOW`.
- Parentheses without comma = grouping.
- Parentheses with comma = `GROUP` (bulk operand container).

## 5. Precedence and associativity
- Highest: unary `-`
- Then: `:`
- Then: `+`
- Lowest statement tails: `=`/`:=`, `->`
- `:` and `+` are left-associative.

## 6. Diagnostic codes
- `LEX_UNTERMINATED_STRING`
- `LEX_INVALID_CONTROL_CHAR`
- `PARSE_EMPTY_INPUT`
- `PARSE_EXPECTED_OPERAND`
- `PARSE_EXPECTED_RPAREN`
- `PARSE_INVALID_REFERENCE`
- `PARSE_INVALID_ASSIGN_TARGET`
- `PARSE_EXPECTED_IDENTIFIER`
- `PARSE_TRAILING_TOKENS`

## 7. Canonical AST forms (contract cases)
1. `Erik` -> `ENTITY("Erik")`
2. `"Projekt Alfa"` -> `ENTITY("Projekt Alfa")`
3. `Erik : Zaměstnanec` -> `TYPE(ENTITY("Erik"), ENTITY("Zaměstnanec"))`
4. `Erik + Projekt Alfa` -> `REL(ENTITY("Erik"), ENTITY("Projekt Alfa"))`
5. `Erik + Projekt Alfa : Zaměstnanec` -> `REL(ENTITY("Erik"), TYPE(ENTITY("Projekt Alfa"), ENTITY("Zaměstnanec")))`
6. `A : B : C` -> `TYPE(TYPE(ENTITY("A"), ENTITY("B")), ENTITY("C"))`
7. `A + B + C` -> `REL(REL(ENTITY("A"), ENTITY("B")), ENTITY("C"))`
8. `- Erik` -> `EXT(ENTITY("Erik"))`
9. `- (Erik + Projekt)` -> `EXT(REL(ENTITY("Erik"), ENTITY("Projekt")))`
10. `Erik.salary := 50000` -> `ASSIGN(REF("Erik"."salary"), LIT("50000"))`
11. `Erik.salary = "50k"` -> `ASSIGN(REF("Erik"."salary"), LIT("50k"))`
12. `Erik -> alert_red` -> `FLOW(ENTITY("Erik"), ENTITY("alert_red"))`
13. `(Erik)` -> `ENTITY("Erik")`
14. `(Erik, Jana, Petr)` -> `GROUP([ENTITY("Erik"), ENTITY("Jana"), ENTITY("Petr")])`
15. `(Erik, Jana) : Zaměstnanec` -> `TYPE(GROUP([ENTITY("Erik"), ENTITY("Jana")]), ENTITY("Zaměstnanec"))`
16. `(A, B) + (C, D)` -> `REL(GROUP([ENTITY("A"), ENTITY("B")]), GROUP([ENTITY("C"), ENTITY("D")]))`
17. `("Projekt Alfa", "Projekt Beta") : Projekt` -> `TYPE(GROUP([ENTITY("Projekt Alfa"), ENTITY("Projekt Beta")]), ENTITY("Projekt"))`
18. `Erik.role := Zaměstnanec` -> `ASSIGN(REF("Erik"."role"), LIT("Zaměstnanec"))`
19. `Erik + (Projekt : Aktivní)` -> `REL(ENTITY("Erik"), TYPE(ENTITY("Projekt"), ENTITY("Aktivní")))`
20. `((A))` -> `ENTITY("A")`
21. `` (empty) -> `PARSE_EMPTY_INPUT`
22. `(` -> `PARSE_EXPECTED_OPERAND` or `PARSE_EXPECTED_RPAREN`
23. `Erik.` -> `PARSE_INVALID_REFERENCE`
24. `Erik := 10` -> `PARSE_INVALID_ASSIGN_TARGET`
25. `Erik +` -> `PARSE_EXPECTED_OPERAND`
26. `Erik ))` -> `PARSE_TRAILING_TOKENS`
27. `'x` -> `LEX_UNTERMINATED_STRING`
28. `A\x01B` -> `LEX_INVALID_CONTROL_CHAR`
29. `63b9d570-5ef6-47eb-8bf4-70bcdb6db95b + Projekt` -> `planner emits mixed selectors (ID + NAME) for bridge validation`
30. `Node-ABC + Team-1` -> `REL(ENTITY("Node-ABC"), ENTITY("Team-1"))`
31. `Firma (obor: IT) + Produkt (cena: 500)` -> `legacy metadata syntax is compiled into upsert metadata + relation link`

## 8. Compatibility notes
- V1 parser zůstává beze změny a je produkční.
- Parser 2.0 má bridge vrstvu (`IntentEnvelope -> AtomicTask`) pro napojení na V1 executor.
- UUID entity literál (RFC4122 tvar) je v planneru interpretován jako `NodeSelectorType.ID`.
- UUID a jména s interní pomlčkou (`Node-ABC`) mohou být bez uvozovek; `-` zůstává operátor jen jako samostatný token (např. `- Erik`).
- Planner používá branch-aware snapshot resolver (`NAME -> ID`) a preferuje existující uzly před upsertem.
- Resolver vrací deterministické chyby při nejednoznačnosti jména (`PLAN_RESOLVE_AMBIGUOUS_NAME`) a v lookup-only kontextu při nenalezení (`PLAN_RESOLVE_NOT_FOUND`).
- Endpoint `/parser/execute` podporuje `parser_version`:
- `v2` (default) = Parser2 (lexer+AST+planner+bridge) přes stejný executor.
- `v1` = legacy parser.
- Legacy verb commands (`show/find/ukaz/najdi/delete/zhasni/smaz/hlidej/spocitej/spoj`) se v `v2` kompilují nativně do intentů s V1-kompatibilní semantikou.
- Legacy metadata syntax `Entity (k: v, x=y)` se v `v2` kompiluje nativně do `UpsertNodeIntent.metadata`.
- Pokud klient `parser_version` neposílá a `v2` parse selže, endpoint může použít kompatibilní fallback na `v1`.
- Fallback rollout je řízen env flagem `DATAVERSE_PARSER_V2_FALLBACK_TO_V1` (`false` default, `true` = dočasný fallback na `v1`).
- Sémantika hard-delete zůstává zakázaná; `-` reprezentuje pouze záměr na soft-delete.
