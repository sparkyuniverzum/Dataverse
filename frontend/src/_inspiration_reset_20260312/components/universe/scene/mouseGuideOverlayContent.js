const hoverTips = {
  table: (label) => `Objekt ${label}: levy klik otevre detail, pravy klik otevre akce.`,
  moon: (label) => `Objekt ${label}: levy klik detail, pravy klik akce, pretazenim vytvoris vazbu.`,
};

export const content = {
  cs: {
    level2: {
      title: "L2 objekty: Souhvezdi / Planety",
      lines: [
        "Levy klik na planetu: otevres tabulku a jeji mesice.",
        "Pravy klik na planetu: akce (vstoupit/zpet).",
        "Male body kolem planety jsou mesice (nahled).",
        "Tazenim pozadi otacis kamerou, koleckem zoomujes.",
      ],
      hoverTip: hoverTips,
      idleTip: "Najed mysi na planetu a hned uvidis, co muzes udelat.",
      compactHint: "LMB planeta: otevres tabulku. RMB: akce.",
    },
    level3: {
      title: "L3 objekty: Mesice",
      lines: [
        "Levy klik na mesic: otevres detail radku tabulky.",
        "Pravy klik na mesic: akce (upravit/zhasnout).",
        "Nova vazba: pretahni mesic na mesic (prave tlacitko).",
        "Vazbu vyberes klikem na svetelnou krivku nebo jeji popisek.",
      ],
      hoverTip: hoverTips,
      idleTip: "Propojeni mezi mesici vytvoris pretazenim.",
      compactHint: "LMB mesic: detail radku. RMB: akce.",
    },
    buttons: {
      minimize: "Min",
      expand: "?",
    },
  },
  // 'en' translations can be added here
};

// A real i18n solution would use a context provider to get the current language.
export function useMouseGuideContent(lang = "cs") {
  return content[lang] || content.cs;
}
