from __future__ import annotations

from typing import Any

PARSER_V2_INTENTS: tuple[str, ...] = (
    "UPSERT_NODE",
    "ASSIGN_ATTRIBUTE",
    "CREATE_LINK",
    "FLOW",
    "EXTINGUISH_NODE",
    "SELECT_NODES",
    "SET_FORMULA",
    "ADD_GUARDIAN",
    "BULK",
)

BRIDGE_ACTIONS: tuple[str, ...] = (
    "INGEST",
    "UPDATE_CIVILIZATION",
    "LINK",
    "DELETE",
    "EXTINGUISH",
    "SELECT",
    "SET_FORMULA",
    "ADD_GUARDIAN",
)

LEGACY_PATTERNS: tuple[str, ...] = (
    "zhasni|smaz|delete: <target>",
    "hlidej: <target>.<field> <op> <threshold> -> <action>",
    "spocitej: <target>.<field> = SUM|AVG|MIN|MAX|COUNT(<source_attr>)",
    "ukaz|najdi|show|find: <target> @ <condition?>",
    "spoj: A, B nebo relacni vyrazy s +, :, ->",
)

RESERVED_TERMS: tuple[str, ...] = (
    "civilizace",
    "mesic",
    "planet",
    "hvezda",
    "vazba",
    "galaxie",
    "scope",
    "main",
    "branch",
)


def build_parser_lexicon_payload() -> dict[str, Any]:
    return {
        "language": "cs-CZ",
        "lexicon_version": "1.0",
        "parser_v2_intents": list(PARSER_V2_INTENTS),
        "bridge_actions": list(BRIDGE_ACTIONS),
        "legacy_patterns": list(LEGACY_PATTERNS),
        "reserved_terms": list(RESERVED_TERMS),
        "notes": [
            "Kriticke mutace vyzaduji preview pred execute.",
            "Fallback parseru v1 se ridi DATAVERSE_PARSER_V2_FALLBACK_POLICY.",
            "Moon je capability, civilization je row runtime entita.",
        ],
        "commands": [
            {
                "key": "vytvor_civilizaci",
                "syntax": "vytvor civilizaci <nazev>",
                "description": "Vytvori nebo synchronizuje civilization row.",
                "intent_kind": "UPSERT_NODE",
                "atomic_actions": ["INGEST"],
                "aliases": ["create civilization", "ingest"],
                "examples": ["vytvor civilizaci Alpha Base"],
            },
            {
                "key": "nastav_hodnotu",
                "syntax": "nastav <cil>.<pole> na <hodnota>",
                "description": "Nastavi hodnotu pole na cilove civilizaci.",
                "intent_kind": "ASSIGN_ATTRIBUTE",
                "atomic_actions": ["UPDATE_CIVILIZATION", "INGEST"],
                "aliases": ["set", "assign"],
                "examples": ["nastav AlphaBase.status na active"],
            },
            {
                "key": "propoj",
                "syntax": "propoj <zdroj> s <cil> jako <typ>",
                "description": "Vytvori vazbu mezi civilizacemi.",
                "intent_kind": "CREATE_LINK",
                "atomic_actions": ["LINK"],
                "aliases": ["link", "spoj"],
                "examples": ["propoj Alpha s Beta jako RELATION"],
            },
            {
                "key": "tok",
                "syntax": "tok <zdroj> -> <cil>",
                "description": "Vytvori flow vazbu.",
                "intent_kind": "FLOW",
                "atomic_actions": ["LINK"],
                "aliases": ["flow"],
                "examples": ["tok Alpha -> Beta"],
            },
            {
                "key": "zhasni",
                "syntax": "zhasni <cil>",
                "description": "Soft-delete lifecycle akce nad civilizaci.",
                "intent_kind": "EXTINGUISH_NODE",
                "atomic_actions": ["DELETE", "EXTINGUISH"],
                "aliases": ["smaz", "delete", "extinguish"],
                "examples": ["zhasni Alpha"],
            },
            {
                "key": "vyber",
                "syntax": "vyber <cil> kde <podminka>",
                "description": "Vybere civilizace podle podminky.",
                "intent_kind": "SELECT_NODES",
                "atomic_actions": ["SELECT"],
                "aliases": ["ukaz", "najdi", "show", "find"],
                "examples": ["vyber projekty kde stav = active"],
            },
            {
                "key": "vzorec",
                "syntax": "vzorec <cil>.<pole> = SUM(<zdroj>)",
                "description": "Nastavi formularni vypocet.",
                "intent_kind": "SET_FORMULA",
                "atomic_actions": ["SET_FORMULA"],
                "aliases": ["spocitej", "formula"],
                "examples": ["vzorec Alpha.celkem = SUM(cena)"],
            },
            {
                "key": "strazce",
                "syntax": "strazce <cil>.<pole> >= <prahovka> -> <akce>",
                "description": "Nastavi guardian pravidlo.",
                "intent_kind": "ADD_GUARDIAN",
                "atomic_actions": ["ADD_GUARDIAN"],
                "aliases": ["hlidej", "guardian"],
                "examples": ["strazce Alpha.celkem > 1000 -> pulse"],
            },
            {
                "key": "davka",
                "syntax": "davka { <prikaz_1>; <prikaz_2>; ... }",
                "description": "Spusti davkovy plan prikazu.",
                "intent_kind": "BULK",
                "atomic_actions": ["INGEST", "UPDATE_CIVILIZATION", "LINK", "DELETE", "SELECT"],
                "aliases": ["bulk"],
                "examples": ["davka { vytvor civilizaci A; vytvor civilizaci B; propoj A s B jako RELATION }"],
            },
        ],
    }
