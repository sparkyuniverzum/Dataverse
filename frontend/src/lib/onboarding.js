export const MODEL_PATH_LABEL = "Galaxie (workspace) / Souhvezdi (oblasti) / Planety (tabulky) / Mesice (radky) / Nerosty (bunky)";

export const LANDING_GUIDE = [
  "Prihlas nebo registruj ucet.",
  "V levelu Galaxie vytvor nebo vyber workspace.",
  "Souhvezdi je logicka oblast (napr. Sklad, Expedice, QA).",
  "Planeta je tabulka a Mesic je jeji radek.",
  "Mesice propoj vazbou a uprav nerosty (bunky/metadata).",
  "Mazani je jen soft delete: Zhasnout.",
];

export const GALAXY_GUIDE = [
  "Klik na galaxii = vyber, dvojklik = vstup.",
  "Nova galaxie znamena novy workspace.",
  "Po vstupu zaloz Souhvezdi + Planetu + Mesic.",
  "Formule, guardian a vazby nastav v Akcnim centru.",
];

export const GALAXY_CREATION_PRESETS = [
  {
    key: "blank",
    label: "Prazdna galaxie",
    description: "Jen cisty workspace bez dat. Vse zalozis rucne.",
  },
  {
    key: "business",
    label: "Business starter",
    description: "Predvyplni CRM + Obchod + Finance a 2 vazby pro rychly start.",
  },
  {
    key: "operations",
    label: "Operations starter",
    description: "Predvyplni Sklad + Objednavky + Expedice a tok mezi nimi.",
  },
];

export const GALAXY_PURPOSE_OPTIONS = [
  {
    key: "general",
    label: "Obecny",
    description: "Univerzalni workspace bez oboroveho zamereni.",
  },
  {
    key: "finance",
    label: "Finance",
    description: "Vychozi struktura pro cashflow, faktury a financni KPI.",
  },
  {
    key: "crm",
    label: "CRM",
    description: "Vychozi struktura pro kontakty, leady a pipeline.",
  },
  {
    key: "logistics",
    label: "Logistika",
    description: "Vychozi struktura pro sklad, objednavky a expedici.",
  },
];

export const GALAXY_REGION_OPTIONS = [
  { key: "global", label: "Global" },
  { key: "eu", label: "Evropa (EU)" },
  { key: "us", label: "USA" },
  { key: "cz", label: "Cesko" },
];

export const GALAXY_TIMEZONE_OPTIONS = [
  { key: "UTC", label: "UTC" },
  { key: "Europe/Prague", label: "Europe/Prague" },
  { key: "America/New_York", label: "America/New_York" },
  { key: "America/Los_Angeles", label: "America/Los_Angeles" },
];

export const WORKSPACE_GUIDE = [
  "Nove Souhvezdi + Planeta + Mesic: formular Rychle zalozeni.",
  "CSV Import: v Akcnim centru vyber soubor, zvol preview nebo commit a spust import.",
  "L2 Souhvezdi v 3D: levy klik = vstup do Planety, pravy klik = kontext menu.",
  "L3 Mesice v 3D: levy klik = fokus, pravy klik = menu, pravy drag Mesic -> Mesic = nova vazba (alternativa Shift + levy drag).",
  "Kamera: drag prazdneho pozadi = orbit, kolecko = zoom.",
  "Editace nerostu/bunek: Tabulkovy Prurez nebo Detail Mesice.",
  "Formula, Guardian, Soft Delete: sekce Akce nad existujicim Mesicem.",
  "Najit objekt: Fokus na Mesic nebo prikaz Ukaz : ...",
];
