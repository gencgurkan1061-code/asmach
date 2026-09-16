/* ASMach technical requirement interpretation. General-tolerance tables remain in the host. */
(function (global) {
  "use strict";

  const TYPES = Object.freeze(["Uzunluk", "Çap", "Yarıçap", "Açı", "Diş", "Geçme", "Pah", "Tolerans", "Yüzey", "GD&T", "Datum", "Not", "Malzeme", "Proses", "Görsel", "Diğer"]);
  const STATUSES = Object.freeze([
    { value: "needs_review", label: "İnceleme bekliyor" },
    { value: "approved", label: "Onaylandı" },
    { value: "rejected", label: "Reddedildi" },
    { value: "measured", label: "Ölçüldü" },
    { value: "pass", label: "Uygun" },
    { value: "fail", label: "Uygun değil" },
  ].map(Object.freeze));
  const TYPE_ALIASES = Object.freeze({
    dimension: "Uzunluk", "Ölçü": "Uzunluk", diameter: "Çap", radius: "Yarıçap", angle: "Açı", thread: "Diş",
    fit: "Geçme", chamfer: "Pah", tolerance: "Tolerans", surface: "Yüzey", gdandt: "GD&T", gdt: "GD&T",
    datum: "Datum", note: "Not", material: "Malzeme", process: "Proses", visual: "Görsel", other: "Diğer",
  });
  const NUMBER = "(?:\\d+(?:\\.\\d*)?|\\.\\d+)";
  // NACHI digital catalog: appe_table2.html (shaft), appe_table3.html (hole).
  // Read 2026-09-09. Each row is [exclusive lower mm, inclusive upper mm, lower µm, upper µm].
  // Only published cells are included; no interpolation, extrapolation or case conversion.
  const ISO_FIT_TABLES = {
    "d6": [[3,6,-38,-30],[6,10,-49,-40],[10,18,-61,-50],[18,30,-78,-65],[30,50,-96,-80],[50,80,-119,-100],[80,120,-142,-120],[120,180,-170,-145],[180,250,-199,-170],[250,315,-222,-190],[315,400,-246,-210],[400,500,-270,-230],[500,630,-304,-260],[630,800,-340,-290],[800,1000,-376,-320],[1000,1250,-416,-350],[1250,1600,-468,-390]],
    "e6": [[3,6,-28,-20],[6,10,-34,-25],[10,18,-43,-32],[18,30,-53,-40],[30,50,-66,-50],[50,80,-79,-60],[80,120,-94,-72],[120,180,-110,-85],[180,250,-129,-100],[250,315,-142,-110],[315,400,-161,-125],[400,500,-175,-135],[500,630,-189,-145],[630,800,-210,-160],[800,1000,-226,-170],[1000,1250,-261,-195],[1250,1600,-298,-220]],
    "e13": [[3,6,-200,-20],[6,10,-245,-25],[10,18,-302,-32],[18,30,-370,-40],[30,50,-440,-50],[50,80,-520,-60],[80,120,-612,-72],[120,180,-715,-85],[180,250,-820,-100],[250,315,-920,-110],[315,400,-1015,-125],[400,500,-1105,-135]],
    "f5": [[3,6,-15,-10],[6,10,-19,-13],[10,18,-24,-16],[18,30,-29,-20],[30,50,-36,-25],[50,80,-43,-30],[80,120,-51,-36],[120,180,-61,-43],[180,250,-70,-50],[250,315,-79,-56],[315,400,-87,-62],[400,500,-95,-68]],
    "f6": [[3,6,-18,-10],[6,10,-22,-13],[10,18,-27,-16],[18,30,-33,-20],[30,50,-41,-25],[50,80,-49,-30],[80,120,-58,-36],[120,180,-68,-43],[180,250,-79,-50],[250,315,-88,-56],[315,400,-98,-62],[400,500,-108,-68],[500,630,-120,-76],[630,800,-130,-80],[800,1000,-142,-86],[1000,1250,-164,-98],[1250,1600,-188,-110]],
    "g5": [[3,6,-9,-4],[6,10,-11,-5],[10,18,-14,-6],[18,30,-16,-7],[30,50,-20,-9],[50,80,-23,-10],[80,120,-27,-12],[120,180,-32,-14],[180,250,-35,-15],[250,315,-40,-17],[315,400,-43,-18],[400,500,-47,-20]],
    "g6": [[3,6,-12,-4],[6,10,-14,-5],[10,18,-17,-6],[18,30,-20,-7],[30,50,-25,-9],[50,80,-29,-10],[80,120,-34,-12],[120,180,-39,-14],[180,250,-44,-15],[250,315,-49,-17],[315,400,-54,-18],[400,500,-60,-20],[500,630,-66,-22],[630,800,-74,-24],[800,1000,-82,-26],[1000,1250,-94,-28],[1250,1600,-108,-30]],
    "h4": [[3,10,-4,0],[10,18,-5,0],[18,30,-6,0],[30,50,-7,0],[50,80,-8,0],[80,120,-10,0],[120,180,-12,0],[180,250,-14,0],[250,315,-16,0],[315,400,-18,0],[400,500,-20,0]],
    "h5": [[3,6,-5,0],[6,10,-6,0],[10,18,-8,0],[18,30,-9,0],[30,50,-11,0],[50,80,-13,0],[80,120,-15,0],[120,180,-18,0],[180,250,-20,0],[250,315,-23,0],[315,400,-25,0],[400,500,-27,0]],
    "h6": [[3,6,-8,0],[6,10,-9,0],[10,18,-11,0],[18,30,-13,0],[30,50,-16,0],[50,80,-19,0],[80,120,-22,0],[120,180,-25,0],[180,250,-29,0],[250,315,-32,0],[315,400,-36,0],[400,500,-40,0],[500,630,-44,0],[630,800,-50,0],[800,1000,-56,0],[1000,1250,-66,0],[1250,1600,-78,0]],
    "h7": [[3,6,-12,0],[6,10,-15,0],[10,18,-18,0],[18,30,-21,0],[30,50,-25,0],[50,80,-30,0],[80,120,-35,0],[120,180,-40,0],[180,250,-46,0],[250,315,-52,0],[315,400,-57,0],[400,500,-63,0],[500,630,-70,0],[630,800,-80,0],[800,1000,-90,0],[1000,1250,-105,0],[1250,1600,-125,0]],
    "h8": [[3,6,-18,0],[6,10,-22,0],[10,18,-27,0],[18,30,-33,0],[30,50,-39,0],[50,80,-46,0],[80,120,-54,0],[120,180,-63,0],[180,250,-72,0],[250,315,-81,0],[315,400,-89,0],[400,500,-97,0],[500,630,-110,0],[630,800,-125,0],[800,1000,-140,0],[1000,1250,-165,0],[1250,1600,-195,0]],
    "h9": [[3,6,-30,0],[6,10,-36,0],[10,18,-43,0],[18,30,-52,0],[30,50,-62,0],[50,80,-74,0],[80,120,-87,0],[120,180,-100,0],[180,250,-115,0],[250,315,-130,0],[315,400,-140,0],[400,500,-155,0],[500,630,-175,0],[630,800,-200,0],[800,1000,-230,0],[1000,1250,-260,0],[1250,1600,-310,0]],
    "h10": [[3,6,-48,0],[6,10,-58,0],[10,18,-70,0],[18,30,-84,0],[30,50,-100,0],[50,80,-120,0],[80,120,-140,0],[120,180,-160,0],[180,250,-185,0],[250,315,-210,0],[315,400,-230,0],[400,500,-250,0],[500,630,-280,0],[630,800,-320,0],[800,1000,-360,0],[1000,1250,-420,0],[1250,1600,-500,0]],
    "h11": [[3,6,-75,0],[6,10,-90,0],[10,18,-110,0],[18,30,-130,0],[30,50,-160,0],[50,80,-190,0],[80,120,-220,0],[120,180,-250,0],[180,250,-290,0],[250,315,-320,0],[315,400,-360,0],[400,500,-400,0],[500,630,-440,0],[630,800,-500,0],[800,1000,-560,0],[1000,1250,-660,0],[1250,1600,-780,0]],
    "h13": [[3,6,-180,0],[6,10,-220,0],[10,18,-270,0],[18,30,-330,0],[30,50,-390,0],[50,80,-460,0],[80,120,-540,0],[120,180,-630,0],[180,250,-720,0],[250,315,-810,0],[315,400,-890,0],[400,500,-970,0]],
    "js4": [[3,10,-2,2],[10,18,-2.5,2.5],[18,30,-3,3],[30,50,-3.5,3.5],[50,80,-4,4],[80,120,-5,5],[120,180,-6,6],[180,250,-7,7],[250,315,-8,8],[315,400,-9,9],[400,500,-10,10]],
    "js5": [[3,6,-2.5,2.5],[6,10,-3,3],[10,18,-4,4],[18,30,-4.5,4.5],[30,50,-5.5,5.5],[50,80,-6.5,6.5],[80,120,-7.5,7.5],[120,180,-9,9],[180,250,-10,10],[250,315,-11.5,11.5],[315,400,-12.5,12.5],[400,500,-13.5,13.5]],
    "js6": [[3,6,-4,4],[6,10,-4.5,4.5],[10,18,-5.5,5.5],[18,30,-6.8,6.8],[30,50,-8,8],[50,80,-9.5,9.5],[80,120,-11,11],[120,180,-12.5,12.5],[180,250,-14.5,14.5],[250,315,-16,16],[315,400,-18,18],[400,500,-20,20],[500,630,-22,22],[630,800,-25,25],[800,1000,-28,28],[1000,1250,-33,33],[1250,1600,-39,39]],
    "k5": [[3,6,1,6],[6,10,1,7],[10,18,1,9],[18,30,2,11],[30,50,2,13],[50,80,2,15],[80,120,3,18],[120,180,3,21],[180,250,4,24],[250,315,4,27],[315,400,4,29],[400,500,5,32]],
    "k6": [[3,6,1,9],[6,10,1,10],[10,18,1,12],[18,30,2,15],[30,50,2,18],[50,80,2,21],[80,120,3,25],[120,180,3,28],[180,250,4,33],[250,315,4,36],[315,400,4,40],[400,500,5,45],[500,630,0,44],[630,800,0,50],[800,1000,0,56],[1000,1250,0,66],[1250,1600,0,78]],
    "m5": [[3,6,4,9],[6,10,6,12],[10,18,7,15],[18,30,8,17],[30,50,9,20],[50,80,11,24],[80,120,13,28],[120,180,15,33],[180,250,17,37],[250,315,20,43],[315,400,21,46],[400,500,23,50]],
    "F6": [[3,6,10,18],[6,10,13,22],[10,18,16,27],[18,30,20,33],[30,50,25,41],[50,80,30,49],[80,120,36,58],[120,180,43,68],[180,250,50,79],[250,315,56,88],[315,400,62,98],[400,500,68,108],[500,630,76,120],[630,800,80,130],[800,1000,86,142],[1000,1250,98,164],[1250,1600,110,188],[1600,2000,120,212]],
    "F7": [[3,6,10,22],[6,10,13,28],[10,18,16,34],[18,30,20,41],[30,50,25,50],[50,80,30,60],[80,120,36,71],[120,180,43,83],[180,250,50,96],[250,315,56,108],[315,400,62,119],[400,500,68,131],[500,630,76,146],[630,800,80,160],[800,1000,86,176],[1000,1250,98,203],[1250,1600,110,235],[1600,2000,120,270]],
    "F8": [[3,6,10,28],[6,10,13,35],[10,18,16,43],[18,30,20,53],[30,50,25,64],[50,80,30,76],[80,120,36,90],[120,180,43,106],[180,250,50,122],[250,315,56,137],[315,400,62,151],[400,500,68,165],[500,630,76,186],[630,800,80,205],[800,1000,86,226],[1000,1250,98,263],[1250,1600,110,305],[1600,2000,120,350]],
    "G6": [[3,6,4,12],[6,10,5,14],[10,18,6,17],[18,30,7,20],[30,50,9,25],[50,80,10,29],[80,120,12,34],[120,180,14,39],[180,250,15,44],[250,315,17,49],[315,400,18,54],[400,500,20,60],[500,630,22,66],[630,800,24,74],[800,1000,26,82],[1000,1250,28,94],[1250,1600,30,108],[1600,2000,32,124]],
    "G7": [[3,6,4,16],[6,10,5,20],[10,18,6,24],[18,30,7,28],[30,50,9,34],[50,80,10,40],[80,120,12,47],[120,180,14,54],[180,250,15,61],[250,315,17,69],[315,400,18,75],[400,500,20,83],[500,630,22,92],[630,800,24,104],[800,1000,26,116],[1000,1250,28,133],[1250,1600,30,155],[1600,2000,32,182]],
    "H6": [[3,6,0,8],[6,10,0,9],[10,18,0,11],[18,30,0,13],[30,50,0,16],[50,80,0,19],[80,120,0,22],[120,180,0,25],[180,250,0,29],[250,315,0,32],[315,400,0,36],[400,500,0,40],[500,630,0,44],[630,800,0,50],[800,1000,0,56],[1000,1250,0,66],[1250,1600,0,78],[1600,2000,0,92]],
    "H7": [[3,6,0,12],[6,10,0,15],[10,18,0,18],[18,30,0,21],[30,50,0,25],[50,80,0,30],[80,120,0,35],[120,180,0,40],[180,250,0,46],[250,315,0,52],[315,400,0,57],[400,500,0,63],[500,630,0,70],[630,800,0,80],[800,1000,0,90],[1000,1250,0,105],[1250,1600,0,125],[1600,2000,0,150]],
    "H8": [[3,6,0,18],[6,10,0,22],[10,18,0,27],[18,30,0,33],[30,50,0,39],[50,80,0,46],[80,120,0,54],[120,180,0,63],[180,250,0,72],[250,315,0,81],[315,400,0,89],[400,500,0,97],[500,630,0,110],[630,800,0,125],[800,1000,0,140],[1000,1250,0,165],[1250,1600,0,195],[1600,2000,0,230]],
    "H9": [[3,6,0,30],[6,10,0,36],[10,18,0,43],[18,30,0,52],[30,50,0,62],[50,80,0,74],[80,120,0,87],[120,180,0,100],[180,250,0,115],[250,315,0,130],[315,400,0,140],[400,500,0,155],[500,630,0,175],[630,800,0,200],[800,1000,0,230],[1000,1250,0,260],[1250,1600,0,310],[1600,2000,0,370]],
    "H10": [[3,6,0,48],[6,10,0,58],[10,18,0,70],[18,30,0,84],[30,50,0,100],[50,80,0,120],[80,120,0,140],[120,180,0,160],[180,250,0,185],[250,315,0,210],[315,400,0,230],[400,500,0,250],[500,630,0,280],[630,800,0,320],[800,1000,0,360],[1000,1250,0,420],[1250,1600,0,500],[1600,2000,0,600]],
    "H11": [[3,6,0,75],[6,10,0,90],[10,18,0,110],[18,30,0,130],[30,50,0,160],[50,80,0,190],[80,120,0,220],[120,180,0,250],[180,250,0,290],[250,315,0,320],[315,400,0,360],[400,500,0,400],[500,630,0,440],[630,800,0,500],[800,1000,0,560],[1000,1250,0,660],[1250,1600,0,780],[1600,2000,0,920]],
    "H13": [[3,6,0,180],[6,10,0,220],[10,18,0,270],[18,30,0,330],[30,50,0,390],[50,80,0,460],[80,120,0,540],[120,180,0,630],[180,250,0,720],[250,315,0,810],[315,400,0,890],[400,500,0,970]],
    "JS6": [[3,6,-4,4],[6,10,-4.5,4.5],[10,18,-5.5,5.5],[18,30,-6.5,6.5],[30,50,-8,8],[50,80,-9.5,9.5],[80,120,-11,11],[120,180,-12.5,12.5],[180,250,-14.5,14.5],[250,315,-16,16],[315,400,-18,18],[400,500,-20,20],[500,630,-22,22],[630,800,-25,25],[800,1000,-28,28],[1000,1250,-33,33],[1250,1600,-39,39],[1600,2000,-46,46]],
    "JS7": [[3,6,-6,6],[6,10,-7.5,7.5],[10,18,-9,9],[18,30,-10.5,10.5],[30,50,-12.5,12.5],[50,80,-15,15],[80,120,-17.5,17.5],[120,180,-20,20],[180,250,-23,23],[250,315,-26,26],[315,400,-28.5,28.5],[400,500,-31.5,31.5],[500,630,-35,35],[630,800,-40,40],[800,1000,-45,45],[1000,1250,-52.5,52.5],[1250,1600,-62.5,62.5],[1600,2000,-75,75]],
  };
  const NUMERIC_FIELDS = ["nominalValue", "lowerTolerance", "upperTolerance", "lowerLimit", "upperLimit"];
  const GD_RULES = [
    ["position", "⌖", /⌖|\b(?:TRUE POSITION|POSITION|POS|KONUM|POZISYON)\b/i, "Konum"],
    ["flatness", "⏥", /⏥|\b(?:FLATNESS|DUZLEMSELLIK|DUZLUK)\b/i, "Düzlemsellik"],
    ["straightness", "⏤", /⏤|―|\b(?:STRAIGHTNESS|DOGRUSALLIK)\b/i, "Doğrusallık"],
    ["perpendicularity", "⟂", /⟂|⊥|\b(?:PERPENDICULAR(?:ITY)?|PERP|DIKLIK)\b/i, "Diklik"],
    ["parallelism", "∥", /∥|⫽|\b(?:PARALLEL(?:ISM)?|PARALELLIK)\b/i, "Paralellik"],
    ["circularity", "○", /○|\b(?:CIRCULARITY|ROUNDNESS|YUVARLAKLIK|DAIRESELLIK)\b/i, "Dairesellik / Yuvarlaklık"],
    ["cylindricity", "⌭", /⌭|\b(?:CYLINDRICITY|SILINDIRIKLIK)\b/i, "Silindiriklik"],
    ["profile_surface", "⌓", /⌓|\b(?:SURFACE PROFILE|PROFILE OF (?:A )?SURFACE|YUZEY PROFILI)\b/i, "Yüzey profili"],
    ["profile", "⌒", /⌒|\b(?:LINE PROFILE|PROFILE OF (?:A )?LINE|CIZGI PROFILI|HAT PROFILI|PROFILE|PROFIL)\b/i, "Çizgi profili"],
    ["total_runout", "⌰", /⌰|\b(?:TOTAL RUN[ -]?OUT|TOPLAM SALGI)\b/i, "Toplam salgı"],
    ["runout", "↗", /↗|\b(?:CIRCULAR RUN[ -]?OUT|DAIRESEL SALGI|RUN[ -]?OUT|SALGI)\b/i, "Dairesel salgı"],
    ["symmetry", "⌯", /⌯|\b(?:SYMMETRY|SIMETRI(?:KLIK)?)\b/i, "Simetriklik"],
    ["concentricity", "◎", /◎|\b(?:CONCENTRIC(?:ITY)?|COAXIALITY|ES\s*MERKEZLILIK|ES\s*EKSENLILIK)\b/i, "Eş merkezlilik / Eş eksenlilik"],
    ["angularity", "∠", /∠|\b(?:ANGULARITY|ACISALLIK)\b/i, "Açısallık"],
  ];
  // One catalog drives recognition and all manual selectors. Keep IDs stable in projects.
  const GDT_TYPES = Object.freeze(GD_RULES.map(([value, symbol, , name]) => Object.freeze({ value, symbol, name, label: `${symbol} ${name}` })));
  function detectGdt(text) {
    // Folding preserves string offsets so the tolerance following the match stays intact.
    const folded = String(text || "").replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g").replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c");
    const unknown=folded.match(/^GD\s*&\s*T\s*(?=\|)/i);
    if(unknown)return {value:'unknown',symbol:'?',name:'Belirsiz GD&T',index:unknown.index,length:unknown[0].length};
    for (const [value, symbol, pattern, name] of GD_RULES) {
      const match = folded.match(pattern);
      if (match) return { value, symbol, name, index: match.index, length: match[0].length };
    }
    return null;
  }

  function gdtOptions(current = "") {
    const items = [{ value: "", label: "Belirsiz — tür seçin" }, ...GDT_TYPES];
    if (current && !GDT_TYPES.some(item => item.value === current)) items.push({ value: current, label: current === "unknown" ? "Belirsiz — sembol okunamadı" : `Mevcut: ${current}` });
    return items;
  }

  function withGdtSubtype(record, subtype) {
    if (record.type !== "GD&T") return record;
    const prior = record.gdtFrame || frameFromText(record.requirement || record.ocrText || "") || {};
    if (subtype === undefined) subtype = record.gdtSubtype || prior.subtype || "unknown";
    const entry = GDT_TYPES.find(item => item.value === subtype);
    const frame = { ...prior, subtype: subtype || "unknown", symbol: entry?.symbol || "?" };
    frame.tolerance = record.upperTolerance != null ? (number(record.upperTolerance) != null ? decimal(number(record.upperTolerance)) : '') : String(prior.tolerance || "");
    frame.modifiers = [...(prior.modifiers || [])];
    frame.datums = record.datumRefs != null ? datumTokens(record.datumRefs).map(token => ({ reference: token.replace(/[ⓂⓁⓈⓅⒻ]/g, ""), modifiers: [...token].filter(c => MODIFIERS.includes(c)) })) : (prior.datums || []);
    frame.datums = frame.datums.slice(0,3);
    frame.cells = [frame.symbol];
    if (frame.tolerance !== "" || frame.datums.length) frame.cells.push(frame.tolerance !== "" ? `${frame.diameter ? "Ø" : ""}${frame.tolerance}${frame.modifiers.join("")}${distributionText(frame)}` : '?');
    frame.cells.push(...frame.datums.map(datum => `${datum.reference}${(datum.modifiers || []).join("")}`));
    const parseWarnings = (record.parseWarnings || []).filter(warning => !entry || !warning.startsWith('GD&T adayı: geometrik sembol okunamadı.'));
    return { ...record, gdtSubtype: subtype || "unknown", specialDesignator: frame.symbol, gdtFrame: frame, datumRefs:frame.datums.map(d=>d.reference+(d.modifiers||[]).join('')).join(' | '), parseWarnings };
  }
  const MODIFIERS = "ⓂⓁⓈⓅⒻⓉ";
  function distributionText(frame){const d=frame.distribution;return (d&&['Ⓤ','UZ'].includes(d.symbol)?` ${d.symbol} ${d.value}`:'')+(frame.zoneRelation?' '+frame.zoneRelation:'')+(frame.projectedHeight?' Ⓟ '+frame.projectedHeight:'');}
  const FIT_POSITION = '(?:CD|EF|FG|JS|ZA|ZB|ZC|[A-HJKMNPR-VXYZ]|cd|ef|fg|js|za|zb|zc|[a-hjkmnpr-vxyz])';
  const FIT_PATTERN = new RegExp(`^(Ø|DIA(?:METER)?|ÇAP)?\\s*(\\d+(?:[ \\t]+\\d+)*(?:\\s*[.,]\\s*\\d+(?:[ \\t]+\\d+)*)?)\\s*(${FIT_POSITION})\\s*(\\d(?:[ \\t]*\\d)?)(?:\\s*/\\s*(${FIT_POSITION})\\s*(\\d(?:[ \\t]*\\d)?))?(?=$|\\s|[()+±−-])\\s*(.*)$`);

  function fitNotation(text) {
    const match = String(text || '').match(FIT_PATTERN);
    if (!match) return null;
    // Join isolated CAD glyphs (5 0), not two complete dimensions (20 30).
    const parts = match[2].replace(/\s*[.,]\s*/, '.').split('.');
    if (parts.some(part => { const tokens = part.trim().split(/\s+/); return tokens.length > 1 && tokens.some(token => token.length > 1); })) return null;
    const nominal = match[2].replace(/\s+/g, '').replace(',', '.');
    const primary = match[3] + match[4].replace(/\s+/g, '');
    const secondary = match[5] ? match[5] + match[6].replace(/\s+/g, '') : '';
    const code = primary + (secondary ? '/' + secondary : '');
    const tail = match[7].trim();
    return { nominal, primary, secondary, code, tail, diameter: Boolean(match[1]), text: `${match[1] ? 'Ø' : ''}${nominal} ${code}${tail ? ' ' + tail : ''}` };
  }

  function isoFitLookup(nominal, code) {
    const value = number(nominal);
    const rows = ISO_FIT_TABLES[String(code || '').trim()];
    const row = value !== null && rows?.find(([low, high]) => value > low && value <= high);
    if (!row) return null;
    const deviation = microns => (microns > 0 ? '+' : '') + decimal(microns / 1000);
    return { lower: deviation(row[2]), upper: deviation(row[3]), minExclusive: row[0], maxInclusive: row[1], source: 'NACHI ISO tolerans tablosu' };
  }

  function normalizeType(type) {
    return TYPE_ALIASES[type] || (TYPES.includes(type) ? type : "Diğer");
  }

  const MEASUREMENT_INTENTS = Object.freeze(["Uzunluk", "Çap", "Yarıçap", "Açı", "Pah", "Diş", "Geçme", "Limit ölçü", "Yüzey"]);
  function normalizeMeasurementIntent(value) {
    const text=String(value||'').trim();
    if(!text)return '';
    if(text==='Limit ölçü'||text==='limit')return 'Limit ölçü';
    const normalized=normalizeType(text);
    return MEASUREMENT_INTENTS.includes(normalized)?normalized:'';
  }
  function measurementIntentEvidence(rawText, expectedType, record={}) {
    const expected=normalizeMeasurementIntent(expectedType),text=normalize(rawText),nominal=number(record.nominalValue)!==null;
    if(!expected)return {expected:'',valid:true,strong:false};
    const patterns={
      'Çap':/[ØΦ⌀∅]|\b(?:DIA|DIAMETER|ÇAP)\b/i,
      'Yarıçap':/(?:^|\s)(?:SR|R)\s*\d/i,
      'Açı':/[°º˚′″]|\b(?:DEG|DERECE)\b/i,
      'Pah':/(?:\bC\s*\d|\bPAH\b|\d\s*[x×]\s*\d\s*°)/i,
      'Diş':/(?:^|\s)(?:M\s*\d|TR\s*\d|NPTF?|NPTR|NPSC|NPSM|NPSL|UNC|UNF|UNEF|UNJ|UNS|BSPP|BSPT|RC\s*\d|RP\s*\d|G\s*\d)/i,
      'Geçme':/\d(?:\.\d+)?\s*(?:[A-HJ-NPR-Z]|[a-hj-npr-z])\s*\d(?:\s*\/\s*(?:[A-HJ-NPR-Z]|[a-hj-npr-z])\s*\d)?\b/,
      'Limit ölçü':/\b(?:MIN|MAX)\b|(?:^|\s)[<>≤≥]\s*\d/i,
      'Yüzey':/(?:\b(?:Ra|Rz|Rq|Rt|Rp|Rv|Rmax|Rzjis|Rsk|Rku|RSm|Sa|Sq|Sz|Sp|Sv|RMS|CLA)\s*\d|[⌯▽])/i,
    };
    const strong=expected==='Uzunluk'?nominal:Boolean(patterns[expected]?.test(text)||(expected==='Geçme'&&record.fitClass)||(expected==='Limit ölçü'&&record.limitDimension));
    const conflicting=expected==='Çap'&&/(?:^|\s)R\s*\d/i.test(text)||expected==='Yarıçap'&&/[ØΦ⌀∅]/.test(text)||expected==='Uzunluk'&&/(?:^|\s)(?:M|R)\s*\d|[ØΦ⌀∅]|[°º˚]/i.test(text);
    const simple=['Uzunluk','Çap','Yarıçap','Açı'].includes(expected);
    return {expected,valid:!conflicting&&(simple?nominal:strong),strong};
  }
  function measurementIntentScore(rawText, expectedType, record) {
    const evidence=measurementIntentEvidence(rawText,expectedType,record||parse(rawText));
    if(!evidence.expected)return 0;
    const actual=record?.type||parse(rawText).type;
    if(evidence.expected==='Limit ölçü')return evidence.valid?55:-35;
    return (actual===evidence.expected?48:0)+(evidence.strong?28:0)-(evidence.valid?0:42);
  }
  function applyMeasurementIntent(record, rawText, expectedType) {
    const evidence=measurementIntentEvidence(rawText,expectedType,record),expected=evidence.expected;
    if(!expected)return {...record,measurementIntent:'',measurementIntentValid:true};
    const next={...record,measurementIntent:expected,measurementIntentValid:evidence.valid};
    if(expected!=='Limit ölçü')next.type=expected;
    if(expected==='Açı')next.unit='°';
    if(['Uzunluk','Çap','Yarıçap','Açı','Pah'].includes(expected)){next.threadPitch='';next.threadClass='';next.threadStandard='';next.fitClass='';}
    if(expected!=='GD&T'){next.gdtSubtype='';next.gdtFrame=null;next.datumRefs='';}
    if(!evidence.valid){
      const warning=`Seçilen “${expected}” ölçü türü OCR metniyle doğrulanamadı. Kaynak görüntüyü kontrol edin veya ölçü türünü Otomatik yapın.`;
      next.parseWarnings=[...new Set([...(next.parseWarnings||[]),warning])];
      next.ocrNeedsReview=true;next.ocrReviewReason=warning;
    }
    return next;
  }

  function normalizeStatus(status) {
    const aliases = { TASLAK: "needs_review", KONTROL: "needs_review", ONAYLI: "approved", REDDEDILDI: "rejected", OLCULDU: "measured", UYGUN: "pass", UYGUN_DEGIL: "fail" };
    return aliases[status] || (STATUSES.some((item) => item.value === status) ? status : "needs_review");
  }

  function number(value) {
    if (value == null || typeof value === "boolean" || String(value).trim() === "") return null;
    const text = String(value).trim().replace(/,/g, ".").replace(/[−–]/g, "-");
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function decimal(value) {
    return Number.isFinite(value) ? String(Number(value.toFixed(8))) : "";
  }

  // Limit arithmetic and display must never send scientific notation to the
  // strict decimal field parser, nor round a printed endpoint to eight places.
  function limitDecimal(value) {
    const raw=String(value??'').trim().replace(',','.');
    if(!raw||!Number.isFinite(Number(raw)))return raw;
    const match=raw.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
    if(!match)return raw;
    const digits=(match[2]||'')+(match[3]||''),point=(match[2]||'').length+Number(match[4]||0);
    let whole=point<=0?'0':point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point);
    let fraction=point<=0?'0'.repeat(-point)+digits:point>=digits.length?'':digits.slice(point);
    whole=whole.replace(/^0+(?=\d)/,'')||'0';fraction=fraction.replace(/0+$/,'');
    return (match[1]==='-'&&(whole!=='0'||fraction)?'-':'')+whole+(fraction?'.'+fraction:'');
  }

  // MIN/MAX endpoints are the source of truth. The displayed nominal is only
  // a calculated centre, not a value claimed to have been printed on the drawing.
  function normalizeLimitDimension(record) {
    const type=normalizeType(record.type);
    const isLimit=record.limitDimension!==false&&(record.limitDimension===true||record.nominalSource==='limit_midpoint'||/Metinde alt\s*\/\s*üst limit|orta noktadan/i.test(record.toleranceStandard||''));
    if(!isLimit||!['Uzunluk','Çap','Yarıçap','Açı','Pah','Tolerans'].includes(type))return record;
    const result={...record,limitDimension:true},low=number(record.lowerLimit),high=number(record.upperLimit);
    const derived=record.nominalSource==='limit_midpoint';
    if(low===null||high===null||low>high){
      // Never keep a stale centre after a bound was removed or became invalid.
      return derived?{...result,nominalValue:'',lowerTolerance:'',upperTolerance:'',nominalSource:''}:result;
    }
    if(!derived&&(record.nominalSource==='manual'||number(record.nominalValue)!==null||(record.manualFields||[]).some(key=>['nominalValue','lowerTolerance','upperTolerance'].includes(key))))return result;
    const endpoints=[record.lowerLimit,record.upperLimit].map(limitDecimal),precision=Math.max(...endpoints.map(value=>(value.split('.')[1]||'').length));
    if(precision>12)return {...result,...(derived?{nominalValue:'',lowerTolerance:'',upperTolerance:'',nominalSource:''}:{}),parseWarnings:[...new Set([...(record.parseWarnings||[]),'Limit hassasiyeti 12 ondalık basamağı aşıyor; nominal elle doğrulanmalı.'])]};
    // Scale decimal strings into integers: exact half-steps need at most one
    // extra decimal place (12-place endpoints -> 13-place midpoint).
    const scaled=value=>{const negative=value.startsWith('-'),[whole,fraction='']=value.replace(/^[+-]/,'').split('.');return BigInt(whole+fraction.padEnd(precision,'0'))*(negative?-1n:1n);};
    const [lowInt,highInt]=endpoints.map(scaled),midpoint=(lowInt+highInt)*5n;
    const format=value=>{const sign=value<0n?'-':'',digits=(value<0n?-value:value).toString().padStart(precision+2,'0');return limitDecimal(sign+digits.slice(0,-precision-1)+'.'+digits.slice(-precision-1));};
    const nominalValue=format(midpoint),lowerTolerance=format(lowInt*10n-midpoint),upperTolerance=format(highInt*10n-midpoint);
    return {...result,nominalValue,lowerTolerance,upperTolerance,nominalSource:'limit_midpoint',toleranceExplicit:true,decimalPlaces:Math.min(13,Math.max(Number.isInteger(record.decimalPlaces)?record.decimalPlaces:0,...[nominalValue,lowerTolerance,upperTolerance].map(value=>(value.split('.')[1]||'').length)))};
  }

  function limitPairFromText(text) {
    const value=`[+-]?${NUMBER}`,quantity='(?:([1-9]\\d*)\\s*[x×]\\s*)?';
    const suffix='(?:\\s*[x×]\\s*('+NUMBER+')\\s*°)?\\s*(MM|IN|°)?';
    const pair=text.match(new RegExp(`^${quantity}(Ø|R)?\\s*(${value})\\s*(°)?\\s*(MAX|MIN)\\s*[,;/]?\\s*(Ø|R)?\\s*(${value})\\s*(°)?\\s*(MAX|MIN)${suffix}$`,'i'));
    const before=pair?null:text.match(new RegExp(`^${quantity}(Ø|R)?\\s*(MAX|MIN)\\s*:?\\s*(${value})\\s*(°)?\\s*[,;/]?\\s*(MAX|MIN)\\s*:?\\s*(Ø|R)?\\s*(${value})\\s*(°)?${suffix}$`,'i'));
    const m=pair||before;if(!m)return null;
    const first=pair?m[3]:m[4],second=pair?m[7]:m[8],firstLabel=pair?m[5]:m[3],secondLabel=pair?m[9]:m[6];
    if(firstLabel.toUpperCase()===secondLabel.toUpperCase())return null;
    const prefix=m[2]||'',otherPrefix=pair?m[6]:m[7],angle=!!(pair?m[4]||m[8]:m[5]||m[9])||m[11]==='°';
    const conflict=(otherPrefix&&prefix.toUpperCase()!==otherPrefix.toUpperCase())||(angle&&(prefix||m[10]));
    return {first,second,quantity:Number(m[1]||1),prefix,angle,chamferAngle:m[10]||'',unit:angle?'°':m[11]?.toLowerCase()||'mm',upper:limitDecimal(firstLabel.toUpperCase()==='MAX'?first:second),lower:limitDecimal(firstLabel.toUpperCase()==='MIN'?first:second),conflict};
  }

  // Text has no geometry: only repair fragmented digits inside an identifiable
  // measurement slot. Bare "1 1" and complete values "20 30" stay separate.
  function joinMeasurementSpacing(text) {
    if (/^(?:NOT(?:E|LAR)?\b|MATERIAL\b|MALZEME\b|PROCESS\b|PROSES\b)/i.test(text.trim())) return text;
    const boundary='(?=$|[ \\t]*(?:[±+()°′″|ⓂⓁⓈ/;=<>]|-(?=\\d)|MAX\\b|MIN\\b|mm\\b|cm\\b|µm\\b|µin\\b|nm\\b|in\\b|[x×]|[HhGg]\\s*\\d))';
    return text.split('\n').map(line=>{
      // A decimal anchor permits singleton fractional glyphs, never another
      // complete number. Preserve the unsigned zero in "27.3 0 -0.05".
      line=line.replace(new RegExp('([+-]?(?:\\d*\\.\\d+))((?:[ \\t]+\\d)+)'+boundary,'gi'),(whole,head,tail,offset,source)=>{
        const following=source.slice(offset+whole.length).trimStart();
        if (!/^[+-]/.test(head)&&tail.trim()==='0'&&/^[+-]/.test(following)) return whole;
        const pitchSlot=/^M[\d \t.]+[x×]\s*$/i.test(source.slice(0,offset));
        if (!/^[+-]/.test(head)&&tail.trim().length===1&&!pitchSlot&&!/^(?:MAX\b|MIN\b|[ⓂⓁⓈ|])/i.test(following)) return whole;
        return head+tail.replace(/[ \t]/g,'');
      });
      // Compact all-singleton integer runs only when a symbol or an explicit
      // following tolerance/angle/limit marker identifies their purpose.
      line=line.replace(new RegExp('(^|[|(/;±+]|(?:S?Ø|SR|R|M|C|Ra|Rz|Rq|Rt)\\s*|\\b(?:MAX|MIN)\\s+)([ \\t]*\\d(?:[ \\t]+\\d)+)'+boundary,'gi'),(whole,prefix,digits)=>{
        if (!prefix.trim()&&!/^[ \t]*\d(?:[ \t]+\d)+[ \t]*(?:[±+(°]|MAX\b|MIN\b)/i.test(line)) return whole;
        return prefix+digits.replace(/[ \t]/g,'');
      });
      return line;
    }).join('\n');
  }

  function normalize(rawText) {
    let text = String(rawText ?? "")
      .replace(/\r\n?/g, "\n").replace(/[−–—]/g, "-")
      .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ').replace(/[\u200b\ufeff]/g,'')
      // Do not apply blanket NFKC: it would destroy circled GD&T modifiers.
      .replace(/[０-９＋－．，]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));
    if (/^(?:NOT(?:E|LAR)?\b|MATERIAL\b|MALZEME\b|PROCESS\b|PROSES\b)/i.test(text.trim())) return text.replace(/\s+/g,' ').trim();
    text=text.replace(/(?<![\d.,])(?:\d[ \t]+)+\d(?=[ \t]*[.,])/g, value => value.replace(/[ \t]/g, ""))
      .replace(/[∅⌀ΦφФøфϕ]/g, "Ø").replace(/[⊥]/g, "⟂").replace(/[⦿⊕⊙]/g, "⌖")
      .replace(/(?:\/\s*\/)/g, "∥").replace(/\+\s*\/\s*-/g, "±")
      .replace(/(\d)\s*[,.]\s*(?=\d)/g, "$1.").replace(/,(?=\d)/g, ".")
      .replace(/(^|[^\d.])[.,][ \t]+(?=\d)/g,'$1.')
      .replace(/([±+-])\s+(?=\d|\.)/g, "$1")
      .replace(/[±+-]\d*\.\d+(?:[ \t]+\d)+(?=\s*(?:$|[+\-/;)]))/g, value => value.replace(/[ \t]/g, ""))
      .replace(/\(\s*M\s*\)/gi, "Ⓜ").replace(/\(\s*L\s*\)/gi, "Ⓛ").replace(/\(\s*S\s*\)/gi, "Ⓢ")
      .replace(/\bM\s+(?=\d)/g, "M").replace(/([ØR])\s+(?=\d)/g, "$1");
    text=joinMeasurementSpacing(text);
    // With explicit deviation signs the middle/last text line may be the nominal.
    // Unlabelled positive values are deliberately not reordered as deviations.
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    if(lines.length===2&&lines.some(line=>/^[+-]/.test(line))&&lines.every(line=>new RegExp(`^(?:[+-]${NUMBER}|0(?:\\.0+)?)$`).test(line)))text=lines.join(' / ');
    if (lines.length === 3) {
      const signedLines = lines.filter(line => new RegExp(`^[+-]${NUMBER}$`).test(line));
      const unsigned = lines.filter((line) => new RegExp(`^(?:Ø|R)?${NUMBER}(?:\\s*°)?$`).test(line) && (signedLines.length === 2 || !/^0(?:\.0+)?$/.test(line)));
      const deviations = signedLines.length === 2 ? signedLines : lines.filter((line) => new RegExp(`^(?:[+-]${NUMBER}|0(?:\\.0+)?)$`).test(line));
      if (unsigned.length === 1 && deviations.length === 2) text = `${unsigned[0]} ${deviations.join(" / ")}`;
    }
    text = text.replace(/\s+/g, " ").replace(/\s*\|\s*/g, "|").trim();
    return fitNotation(text)?.text || text;
  }

  function frameFromText(rawText) {
    const frame=readFrameFromText(rawText);if(!frame)return frame;
    if(frame.datums?.length>3){frame.excessDatums=true;frame.datums=frame.datums.slice(0,3);frame.cells=frame.cells.slice(0,5);}
    return frame;
  }
  function readFrameFromText(rawText) {
    const rows=String(rawText||'').split(/\r?\n/).map(s=>s.trim()).filter(s=>detectGdt(s));
    if(rows.length>1){const segments=rows.map(s=>frameFromText(s));return {...segments[0],segments,segmentRelation:'unconfirmed'};}
    const text = normalize(rawText);
    const found = detectGdt(text);
    if (!found) return null;
    const tail = text.slice(found.index + found.length).replace(/^\s*[|:\[]?\s*/, "");
    if(tail.includes('|')){
      const parts=tail.split('|').map(s=>s.trim()),zone=parts.shift();
      const match=zone.match(new RegExp(`^(Ø)?\\s*(?:±\\s*)?(${NUMBER})\\s*([${MODIFIERS}]*)(?:\\s*(Ⓤ|UZ)\\s*([+-]?${NUMBER}))?$`));
      const frame={symbol:found.symbol,subtype:found.value,tolerance:match?decimal(Number(match[2])):'',diameter:Boolean(match?.[1]),modifiers:match?[...match[3]]:[],datums:[],cells:[found.symbol]};
      if(match?.[4])frame.distribution={symbol:match[4],value:match[5]};
      frame.cells.push(match?`${frame.diameter?'Ø':''}${frame.tolerance}${frame.modifiers.join('')}${distributionText(frame)}`:'?');
      for(const token of parts){
        if(/^(CZ|SZ)$/i.test(token)){frame.zoneRelation=token.toUpperCase();frame.cells[1]+=' '+frame.zoneRelation;continue;}
        const projected=token.match(/^[ⓅP]\s*(\d+(?:\.\d+)?)$/);if(projected){frame.projectedHeight=projected[1];frame.cells[1]+=' Ⓟ '+projected[1];continue;}
        const datum=token.match(new RegExp(`^([A-Z](?:-[A-Z])?)([${MODIFIERS}]*)$`));
        frame.datums.push({reference:datum?datum[1]:'',modifiers:datum?[...datum[2]]:[]});
        frame.cells.push(datum?token:'');
      }
      return frame;
    }
    const toleranceMatch = tail.match(new RegExp(`^(Ø)?\\s*(?:±\\s*)?(${NUMBER})`));
    const frame = { symbol: found.symbol, subtype: found.value, tolerance: "", diameter: false, modifiers: [], datums: [], cells: [found.symbol] };
    if (!toleranceMatch) return frame;
    frame.tolerance = decimal(Number(toleranceMatch[2]));
    frame.diameter = Boolean(toleranceMatch[1]);
    let remaining = tail.slice(toleranceMatch[0].length).trim();
    const zoneModifiers = remaining.match(new RegExp(`^[${MODIFIERS}]+`));
    if (zoneModifiers) {
      frame.modifiers = [...zoneModifiers[0]];
      remaining = remaining.slice(zoneModifiers[0].length);
    }
    const distribution=remaining.trim().match(new RegExp(`^(Ⓤ|UZ)\\s*([+-]?${NUMBER})`));if(distribution){frame.distribution={symbol:distribution[1],value:distribution[2]};remaining=remaining.trim().slice(distribution[0].length);}
    frame.cells.push(`${frame.diameter ? "Ø" : ""}${frame.tolerance}${frame.modifiers.join("")}${distributionText(frame)}`);
    // A-B is one common datum, whereas A|B establishes separate precedence.
    const datumText = remaining.replace(/\bMM\b/gi, "").replace(/[\[\]]/g, "").trim();
    const datumPattern = new RegExp(`([A-Z](?:-[A-Z])?)([${MODIFIERS}]*)`, "g");
    for (const token of datumText.split(/[|\s]+/).filter(Boolean)) {
      if (!new RegExp(`^(?:[A-Z](?:-[A-Z])?[${MODIFIERS}]*)+$`).test(token)) continue;
      for (const match of token.matchAll(datumPattern)) {
        frame.datums.push({ reference: match[1], modifiers: [...match[2]] });
        frame.cells.push(`${match[1]}${match[2]}`);
      }
    }
    return frame;
  }

  function gdtCells(value) {
    if (value && typeof value === "object") {
      if (value.gdtFrame) return gdtCells(value.gdtFrame);
      if (Array.isArray(value.cells)) return value.cells.map(String);
      return gdtCells(value.requirementText || value.requirement || value.text || "");
    }
    return frameFromText(value)?.cells || [];
  }

  function clearNumeric(result) {
    for (const key of NUMERIC_FIELDS) result[key] = "";
    result.toleranceStandard = "";
    result.toleranceExplicit = false;
  }

  function canonicalDeviations(text) {
    const nominal = `((?:Ø|R)?${NUMBER}(?:\\s*°)?)`;
    const suffix = "(?:\\s*(MM|IN(?:CH)?|°))?";
    const signed = `[+-]${NUMBER}`;
    // Both signed deviations can touch; an unsigned zero must have an explicit separator.
    const pair = text.match(new RegExp(`^${nominal}\\s*\\(?\\s*(${signed})\\s*(?:[/;]\\s*)?(${signed})\\s*\\)?${suffix}$`, "i")) ||
      text.match(new RegExp(`^${nominal}\\s*\\(?\\s*(${signed})\\s*(?:[/;]\\s*|\\s+)(0(?:\\.0+)?)\\s*\\)?${suffix}$`, "i")) ||
      text.match(new RegExp(`^${nominal}(?:\\s+|\\s*\\(\\s*)(0(?:\\.0+)?)\\s*(?:[/;]\\s*|\\s+|(?=[+-]))(${signed})\\s*\\)?${suffix}$`, "i"));
    return pair ? `${pair[1]} (${pair[2]}/${pair[3]})${pair[4] ? ` ${pair[4]}` : ""}` : text;
  }

  // Keep profile parameters separate: Rz is not interchangeable with Ra, nor µin with µm.
  function parseSurface(raw) {
    let text=String(raw||'').replace(/,/g,'.').replace(/[−–]/g,'-').replace(/μ/g,'µ').replace(/\+\s*\/\s*-/g,'±').trim();
    const symbol=text.match(/^(?:√|✓|SURFACE\[(basic|required|prohibited)\])\s*/i);
    if(symbol)text=text.slice(symbol[0].length);
    const standard=(text.match(/\b(?:ISO\s*(?:1302|21920(?:-[123])?|4287|4288|25178)|ASME\s*(?:B46\.1|Y14\.36)|JIS\s*B\s*0601)\b/i)||[])[0]||'';
    text=text.replace(/\b(?:ISO\s*(?:1302|21920(?:-[123])?|4287|4288|25178)|ASME\s*(?:B46\.1|Y14\.36)|JIS\s*B\s*0601)\b/gi,'').replace(/^\s*[:;]\s*/,'').trim();
    const match=text.match(/^(?:(U|L)\s+)?(R\s*(?:max|zjis|z|a|q|t|p|v|sk|ku|sm)|S[aqzpv]|RMS|CLA)(?=\s|[\d.:=<>≤≥]|max\b|min\b|$)\s*(max|min)?\s*[:=]?\s*/i);
    if(!match&&!symbol)return null;
    // A symbol with no parameter is a review candidate, not an assumed Ra measurement.
    const parameter=match?match[2].replace(/\s/g,''):'';
    const names={rmax:'Rmax',rzjis:'RzJIS',rms:'RMS',cla:'CLA'};
    const label=names[parameter.toLowerCase()]||(parameter?parameter[0].toUpperCase()+parameter.slice(1).toLowerCase():'');
    let tail=match?text.slice(match[0].length):text;
    const warnings=[];
    const result={type:'Yüzey',specialDesignator:label,nominalValue:'',lowerTolerance:'',upperTolerance:'',lowerLimit:'',upperLimit:'',unit:'',evaluationMethod:'VALUE',toleranceExplicit:true,toleranceStandard:standard,parseWarnings:warnings,surfaceTexture:{parameter:label,standard,materialRemoval:symbol?.[1]|| (symbol?'unspecified':''),source:String(raw)}};
    const units=tail.match(/µin\b|uin\b|microinch(?:es)?\b|µm\b|um\b|nm\b|mm\b/i);
    result.unit=units?(/µin|uin|microinch/i.test(units[0])?'µin':/^(?:µm|um)$/i.test(units[0])?'µm':units[0].toLowerCase()):'';
    tail=tail.replace(/µin\b|uin\b|microinch(?:es)?\b|µm\b|um\b|nm\b|mm\b/gi,'').trim();
    if(!result.unit&&label&&!/^(Rsk|Rku|RMS|CLA)$/i.test(label)&&!/^ASME/i.test(standard))result.unit='µm';
    if(!units)warnings.push(result.unit?'Birim yazılı değil; µm kabulünü çizim standardından doğrulayın.':'Yüzey ölçüsünün birimini çizimden seçin.');
    if(!label)warnings.push('Yüzey sembolü algılandı; Ra/Rz parametresini, birimini ve sembol türünü doğrulayın.');
    if(symbol)warnings.push('Yüzey işareti: '+({basic:'temel sembol',required:'talaş kaldırma gerekli',prohibited:'talaş kaldırma yasak'}[symbol[1]]||'sembol türü belirsiz')+'; kaynak görüntüsüyle doğrulayın.');
    if(/RzJIS/i.test(label)||/JIS/i.test(standard))warnings.push('JIS sürümünü doğrulayın; Rz tanımları sürümler arasında aynı kabul edilmez.');
    const num='(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
    const pair=tail.match(new RegExp('^('+num+')\\s+(U|L)\\s+'+label+'\\s*('+num+')$','i'));
    if(pair&&/^[UL]$/i.test(match?.[1]||'')&&match[1].toUpperCase()!==pair[2].toUpperCase()){
      result[match[1].toUpperCase()==='U'?'upperLimit':'lowerLimit']=decimal(+pair[1]);result[pair[2].toUpperCase()==='U'?'upperLimit':'lowerLimit']=decimal(+pair[3]);
      if(+result.lowerLimit>+result.upperLimit){result.lowerLimit=result.upperLimit='';warnings.push('Alt sınır üst sınırdan büyük; değerler otomatik uygulanmadı.');}return result;
    }
    let m=tail.match(new RegExp('^('+num+')\\s*±\\s*('+num+')$'));
    if(m){const n=+m[1],t=+m[2];result.nominalValue=decimal(n);result.lowerTolerance=decimal(-t);result.upperTolerance=decimal(t);result.lowerLimit=decimal(n-t);result.upperLimit=decimal(n+t);}
    else if((m=tail.match(new RegExp('^('+num+')\\s*\\(?\\s*([+-]'+num+')\\s*/\\s*([+-]'+num+')\\s*\\)?$')))){const n=+m[1],lo=Math.min(+m[2],+m[3]),hi=Math.max(+m[2],+m[3]);result.nominalValue=decimal(n);result.lowerTolerance=decimal(lo);result.upperTolerance=decimal(hi);result.lowerLimit=decimal(n+lo);result.upperLimit=decimal(n+hi);}
    else if((m=tail.match(new RegExp('^('+num+')\\s*(?:\\.\\.|-|TO)\\s*('+num+')$','i')))){result.lowerLimit=decimal(+m[1]);result.upperLimit=decimal(+m[2]);}
    else if((m=tail.match(new RegExp('^(<=|>=|≤|≥|<|>|MAX|MIN)?\\s*('+num+')\\s*(MAX|MIN)?$','i')))){
      result.nominalValue=decimal(+m[2]);const mode=(m[1]||m[3]||match?.[3]||match?.[1]||'').toUpperCase();
      if(/^(?:MIN|L|>=|≥|>)$/.test(mode)){result.lowerLimit=result.nominalValue;result.lowerInclusive=mode!=='>';}
      else if(mode){result.lowerLimit='0';result.upperLimit=result.nominalValue;result.upperInclusive=mode!=='<';}
      else warnings.push('Yüzey pürüzlülüğü değerinin kabul sınırını doğrulayın.');
    } else warnings.push('Çoklu veya eksik yüzey gösterimi: parametreleri, filtre/örnekleme bilgilerini ve sınırları ayrı ayrı doğrulayın.');
    if(result.lowerLimit!==''&&result.upperLimit!==''&&+result.lowerLimit>+result.upperLimit){result.lowerLimit=result.upperLimit='';warnings.push('Alt sınır üst sınırdan büyük; değerler otomatik uygulanmadı.');}
    if(!label){result.nominalValue=result.lowerTolerance=result.upperTolerance=result.lowerLimit=result.upperLimit='';result.unit='';}
    return result;
  }
  // Field states are evidence labels, not invented OCR confidence percentages.
  function applyDrawingTolerance(record, rawText, profile = {}) {
    if (!/^ASME Y14\.5-/.test(profile.standard || '') || record.toleranceExplicit || record.toleranceAmbiguous || record.fitClass || record.threadClass || record.gdtFrame || record.callout?.basic || record.callout?.reference || record.callout?.depth || record.callout?.secondaryDiameter || record.callout?.countersinkAngle) return record;
    if (!['Uzunluk','Ölçü','Çap','Yarıçap','Açı'].includes(record.type) || number(record.nominalValue)===null) return record;
    if (['lowerTolerance','upperTolerance','lowerLimit','upperLimit'].some(k=>number(record[k])!==null)) return record;
    const angle=record.type==='Açı';
    if (!angle && record.unit!==profile.unit) return record;
    const text=normalize(rawText),match=text.match(/^(?:Ø|R)?\s*(\d+(?:\.\d+)?|\.\d+)\s*(?:mm|in|°)?$/i);
    if (!match) return record;
    const key=angle?'angle':String((match[1].split('.')[1]||'').length),value=profile.precisionRules?.[key];
    if (value==null || String(value).trim()==='' || !Number.isFinite(Number(value)) || Number(value)<0) return record;
    const tolerance=Number(value),nominal=number(record.nominalValue);
    return {...record,lowerTolerance:decimal(-tolerance),upperTolerance:decimal(tolerance),lowerLimit:decimal(nominal-tolerance),upperLimit:decimal(nominal+tolerance),toleranceStandard:`${profile.standard} · çizim tablosu (${angle?'açı':'ondalık '+key})`};
  }

  function measurementEvidence(record, rawText, context = {}) {
    if (record.type === 'GD&T' || record.gdtFrame) return record;
    const manual = new Set(record.manualFields || []), fields = {};
    for (const key of ['nominalValue','lowerTolerance','upperTolerance','lowerLimit','upperLimit','unit','threadPitch','threadClass','threadStandard','fitClass','specialDesignator']) {
      const value = record[key];
      let source = manual.has(key) ? 'manual' : 'parsed';
      if (key === 'unit' && !/\b(?:mm|in|inch|cm|nm)\b|[µμ]|°|["″]/i.test(rawText || '') && !['Diş','Geçme','Açı'].includes(record.type)) source='drawing_default';
      if (record.nominalSource === 'limit_midpoint' && ['nominalValue','lowerTolerance','upperTolerance'].includes(key)) source='calculated_from_limits';
      if (!record.toleranceExplicit && record.toleranceStandard && ['lowerTolerance','upperTolerance','lowerLimit','upperLimit'].includes(key)) source='general_tolerance';
      if (manual.has(key)) source='manual';
      fields[key]={value:value??'',source,status:value==null||value===''?'missing':record.toleranceAmbiguous&&key!=='unit'?'review':'available'};
    }
    return {...record,measurementEvidence:{version:1,rawText:String(rawText??''),standard:String(context.standard||record.toleranceStandard||''),fields}};
  }

  function parse(rawText, standard = "", legacyParse) {
    const limitPair=limitPairFromText(normalize(rawText));
    if(limitPair){
      const {upper,lower}=limitPair;
      const result=normalizeLimitDimension({...parseCore('','',legacyParse),type:limitPair.chamferAngle?'Pah':limitPair.angle?'Açı':limitPair.prefix==='Ø'?'Çap':limitPair.prefix.toUpperCase()==='R'?'Yarıçap':'Uzunluk',quantity:limitPair.quantity,unit:limitPair.unit,nominalValue:'',lowerTolerance:'',upperTolerance:'',lowerLimit:limitPair.conflict?'':lower,upperLimit:limitPair.conflict?'':upper,limitDimension:true,toleranceExplicit:true,toleranceStandard:'Metinde alt / üst limit',evaluationMethod:'VALUE',parseWarnings:limitPair.conflict?['Limit ölçülerinin tür / birim işaretleri çelişiyor. Çizimi doğrulayın.']:Number(lower)>Number(upper)?['Alt limit üst limitten büyük. Çizimi doğrulayın.']:[],chamferAngle:limitPair.chamferAngle,decimalPlaces:Math.min(12,Math.max(...[limitPair.first,limitPair.second].map(v=>(v.split('.')[1]||'').length)))});
      result.requirement=generateRequirement(result)||'';result.requirementMode='auto';
      return result;
    }
    // Rp is also a surface parameter. A fractional pipe designation carries
    // explicit thread evidence; do not consume it as an unreadable Rp roughness.
    const fractionalRp=/^\s*(?:\d+\s*[x×]\s*)?Rp\s*(?:\d+\s+)?\d+\s*\/\s*\d+/i.test(String(rawText));
    if(fractionalRp){const thread=parseThreadCallout(rawText);if(thread)return thread;}
    const surfaceResult=parseSurface(normalize(rawText));
    if(surfaceResult){surfaceResult.surfaceTexture.source=String(rawText);return Object.assign(parse('', '', legacyParse),surfaceResult);}
    const angular=parseAngularCallout(normalize(rawText));
    const result=parseCore(angular?.canonical||rawText,standard,legacyParse);
    if(angular){
      result.type='Açı';result.unit='°';result.angleFormat=angular.dms?'dms':'decimal';
      if(angular.error){clearNumeric(result);result.parseWarnings=[...(result.parseWarnings||[]),angular.error];}
      else {result.nominalValue=String(angular.nominal);result.lowerTolerance=angular.lower==null?'':String(angular.lower);result.upperTolerance=angular.upper==null?'':String(angular.upper);result.toleranceExplicit=angular.lower!=null||angular.upper!=null;result.lowerLimit=angular.lower==null?'':String(angular.nominal+angular.lower);result.upperLimit=angular.upper==null?'':String(angular.nominal+angular.upper);if(result.toleranceExplicit)result.toleranceStandard='Metinde açısal tolerans';}
    }
    // Legacy numeric parsing can accept the prefix of "0.l" as zero. Never
    // let a malformed OCR tolerance become a valid, exact 0/0 requirement.
    if(fieldProfile(result.type).numeric&&!['Diş','GD&T'].includes(result.type)){
      const strict=new RegExp('^'+NUMBER+'(?:mm|cm|µm|μm|µin|nm|in|m|°|′|″)?$','i');
      const tokens=[...normalize(rawText).matchAll(/[±+-]\s*((?:\d|\.)[^\s/|()+±-]*)/g)].map(m=>m[1]);
      if(tokens.some(token=>!strict.test(token)&&!(result.type==='Açı'&&parseAngle(token)!==null))){
        result.toleranceAmbiguous=true;result.toleranceExplicit=false;
        result.lowerTolerance=result.upperTolerance=result.lowerLimit=result.upperLimit=result.toleranceStandard='';
        result.parseWarnings=[...(result.parseWarnings||[]),'Tolerans sayısında belirsiz karakter var. Harfler rakama, eksik ondalıklar sıfıra dönüştürülmedi; kaynak görüntüsünü kontrol edin.'];
      }
    }
    if(fieldProfile(result.type).numeric){
      const fractions=[...normalize(rawText).matchAll(/\d*\.(\d+)/g)].map(m=>m[1].length);
      if(fractions.length)result.decimalPlaces=Math.min(6,Math.max(...fractions));
      else if(/\d/.test(String(rawText)))result.decimalPlaces=0;
    }
    return result;
  }
  const THREAD_FRACTION_RE='(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?)';
  const NPT_TPI=Object.freeze({'0.0625':'27','0.125':'27','0.25':'18','0.375':'18','0.5':'14','0.75':'14','1':'11.5','1.25':'11.5','1.5':'11.5','2':'11.5','2.5':'8','3':'8','3.5':'8','4':'8','5':'8','6':'8'});
  const BSP_TPI=Object.freeze({'0.0625':'28','0.125':'28','0.25':'19','0.375':'19','0.5':'14','0.75':'14','1':'11','1.25':'11','1.5':'11','2':'11','2.5':'11','3':'11','4':'11','5':'11','6':'11'});
  function threadSize(value){
    const source=String(value||'').trim().replace(',','.');
    const fraction=source.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
    if(fraction&&Number(fraction[3])>0)return Number(fraction[1]||0)+Number(fraction[2])/Number(fraction[3]);
    const number=Number(source);return Number.isFinite(number)&&number>0?number:null;
  }
  function threadRecord({size,unit='mm',pitch='',threadClass='',form='',standard='',quantity=1,warnings=[],hand=''}){
    return {type:'Diş',nominalValue:decimal(size),unit,threadPitch:pitch,threadClass,threadStandard:standard,lowerTolerance:'',upperTolerance:'',lowerLimit:'',upperLimit:'',fitClass:'',gdtSubtype:'',datumRefs:'',gdtFrame:null,quantity:Number(quantity||1),evaluationMethod:'OK_NOT_OK',toleranceExplicit:false,toleranceStandard:standard,parseWarnings:warnings,callout:{threadForm:form,threadHand:hand}};
  }
  function plainRadius(rawText){
    // A bare R plus an integer/decimal is a radius, not evidence of ISO 7-1.
    // Keep slashes and suffixes: R1/8, Rc/Rp and LH/RH reach the thread parser.
    const match=normalize(rawText).match(new RegExp(`^(?:(\\d+)\\s*[x×]\\s*)?R\\s*(${NUMBER})(?:\\s*(mm|in|inch|["″]))?$`,'i'));
    return match?{nominal:decimal(Number(match[2])),quantity:Number(match[1]||1),unit:match[3]?/^mm$/i.test(match[3])?'mm':'in':''}:null;
  }
  function repairAutoRadius(record,parseRequirement){
    if(normalizeType(record.type)!=='Diş'||record.autoParse===false||typeof parseRequirement!=='function')return record;
    // Only repair the old automatic R / ISO 7-1 fingerprint. Deliberate edits,
    // approved/measured results and real thread specifications stay untouched.
    const manual=new Set(Array.isArray(record.manualFields)?record.manualFields:[]),protectedKeys=['type','unit','nominalValue','lowerTolerance','upperTolerance','lowerLimit','upperLimit','threadPitch','threadClass','threadStandard','toleranceStandard','evaluationMethod','callout'];
    if(protectedKeys.some(key=>manual.has(key))||record.nominalSource==='manual'||normalizeStatus(record.status)!=='needs_review'||['approved','corrected','rejected'].includes(record.candidateReviewStatus)||String(record.result??'').trim()||(record.resultStatus&&record.resultStatus!=='pending'))return record;
    if(!/^ISO\s*7-1$/i.test(record.threadStandard||record.toleranceStandard||'')||(record.callout?.threadForm&&record.callout.threadForm!=='R')||record.callout?.threadHand||record.threadPitch||record.threadClass||record.fitClass||record.toleranceExplicit)return record;
    if(['lowerTolerance','upperTolerance','lowerLimit','upperLimit'].some(key=>String(record[key]??'').trim()))return record;
    const radius=plainRadius(record.ocrText);
    if(!radius||number(record.nominalValue)!==Number(radius.nominal))return record;
    if(record.originalOcrText&&plainRadius(record.originalOcrText)?.nominal!==radius.nominal)return record;
    const parsed=parseRequirement(record.ocrText);
    if(parsed?.type!=='Yarıçap')return record;
    return syncRequirement({...record,...parsed,quantity:record.quantity??parsed.quantity,threadPitch:'',threadClass:'',threadStandard:'',originalOcrText:record.originalOcrText||record.ocrText,ocrNeedsReview:true,ocrReviewReason:'Önceki otomatik R / boru dişi sınıflandırması yarıçap olarak düzeltildi. Kaynak görüntüsünü kontrol edin.'});
  }
  function parseThreadCallout(rawText){
    let text=String(rawText??'').replace(/[−–—]/g,'-').replace(/[“”″"]/g,'').replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ').trim();
    let inferredSlash=false;
    // Frequent OCR loss: "NPT 1/16" is read as "NPT16".
    text=text.replace(/^(NPTF|NPTR|NPSC|NPSM|NPSL|NPT)\s*16$/i,(all,series)=>{inferredSlash=true;return `${series} 1/16`;});
    const metric=text.match(/^(?:(\d+)\s*[x×]\s*)?M\s*(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?(?:\s*-?\s*([3-9]\d?[A-Za-z](?:[3-9]\d?[A-Za-z])?))?(?:\s*(LH|RH))?$/i);
    if(metric){const size=threadSize(metric[2]),pitch=threadSize(metric[3]);if(size!==null&&(!metric[3]||pitch!==null))return threadRecord({size,unit:'mm',pitch:metric[3]?decimal(pitch):'',threadClass:metric[4]||'',form:'M',standard:metric[4]?'ISO 261 / ISO 965-1':'ISO 261',quantity:metric[1],hand:(metric[5]||'').toUpperCase()});}
    const trapezoid=text.match(/^(?:(\d+)\s*[x×]\s*)?TR\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*\(\s*P\s*(\d+(?:[.,]\d+)?)\s*\))?(?:\s*-?\s*([0-9]+[A-Za-z]))?(?:\s*(LH|RH))?$/i);
    if(trapezoid){const size=threadSize(trapezoid[2]),lead=threadSize(trapezoid[3]),pitch=threadSize(trapezoid[4]);if(size!==null&&lead!==null&&(!trapezoid[4]||pitch!==null))return threadRecord({size,unit:'mm',pitch:trapezoid[4]?`${decimal(lead)} (P${decimal(pitch)})`:decimal(lead),threadClass:trapezoid[5]||'',form:'Tr',standard:trapezoid[5]?'ISO 2902 / ISO 2903':'ISO 2902',quantity:trapezoid[1],hand:(trapezoid[6]||'').toUpperCase()});}
    const unified=text.match(new RegExp(`^(?:(\\d+)\\s*[x×]\\s*)?(#\\s*\\d+|${THREAD_FRACTION_RE})\\s*-\\s*(\\d+(?:[.,]\\d+)?)\\s*(UNC|UNF|UNEF|UNR|UNJ|UNS|UN)(?:\\s*-?\\s*([123][AB]))?(?:\\s*(LH|RH))?$`,'i'));
    if(unified){let size;if(/^#/.test(unified[2])){const gauge=Number(unified[2].replace(/\D/g,''));size=.06+.013*gauge;}else size=threadSize(unified[2]);const tpi=Number(unified[3].replace(',','.'));if(size!==null&&Number.isFinite(tpi)&&tpi>0)return threadRecord({size,unit:'in',pitch:`${decimal(tpi)} TPI`,threadClass:(unified[5]||'').toUpperCase(),form:unified[4].toUpperCase(),standard:'ASME B1.1',quantity:unified[1],hand:(unified[6]||'').toUpperCase()});}
    const pipeSeries='NPTF|NPTR|NPSC|NPSM|NPSL|NPT';
    const pipeFirst=text.match(new RegExp(`^(?:(\\d+)\\s*[x×]\\s*)?(${pipeSeries})\\s*(${THREAD_FRACTION_RE})(?:\\s*-\\s*(\\d+(?:[.,]\\d+)?))?(?:\\s*(LH|RH))?$`,'i'));
    const pipeLast=text.match(new RegExp(`^(?:(\\d+)\\s*[x×]\\s*)?(${THREAD_FRACTION_RE})(?:\\s*-\\s*(\\d+(?:[.,]\\d+)?))?\\s*(${pipeSeries})(?:\\s*(LH|RH))?$`,'i'));
    if(pipeFirst||pipeLast){const m=pipeFirst||pipeLast,series=(pipeFirst?m[2]:m[4]).toUpperCase(),size=threadSize(pipeFirst?m[3]:m[2]),writtenTpi=pipeFirst?m[4]:m[3],hand=(m[5]||'').toUpperCase(),writtenTpiNumber=writtenTpi?Number(writtenTpi.replace(',','.')):null;if(size!==null&&(!writtenTpi||Number.isFinite(writtenTpiNumber)&&writtenTpiNumber>0)){const pitch=writtenTpi?decimal(writtenTpiNumber):NPT_TPI[decimal(size)]||'',warnings=['Boru dişi nominal boyutudur; gerçek dış çap değildir. Diş ölçü ve mastar uygunluğunu çizimden doğrulayın.'];if(inferredSlash)warnings.push('OCR, NPT16 metnini NPT 1/16 olarak yorumladı; kaynak görüntüsünü doğrulayın.');if(!pitch)warnings.push('Bu boru dişi boyutu için TPI otomatik tamamlanmadı.');return threadRecord({size,unit:'in',pitch:pitch?`${pitch} TPI`:'',threadClass:series,form:series,standard:series==='NPTF'?'ASME B1.20.3':'ASME B1.20.1',quantity:m[1],warnings,hand});}}
    const isoPipe=text.match(new RegExp(`^(?:(\\d+)\\s*[x×]\\s*)?(G|RC|RP|R)\\s*(${THREAD_FRACTION_RE})(?:\\s*-?\\s*([AB]))?(?:\\s*(LH|RH))?$`,'i'));
    // R12.5 / R5 are ordinary radius dimensions. Only a fractional pipe size
    // or explicit thread class/hand disambiguates the single-letter R series.
    // G, Rc and Rp are already explicit thread-family markers.
    const explicitPipe=isoPipe&&(isoPipe[2].toUpperCase()!=='R'||isoPipe[3].includes('/')||isoPipe[4]||isoPipe[5]);
    if(explicitPipe){const form=isoPipe[2].toUpperCase()==='RC'?'Rc':isoPipe[2].toUpperCase()==='RP'?'Rp':isoPipe[2].toUpperCase(),size=threadSize(isoPipe[3]);if(size!==null){const pitch=BSP_TPI[decimal(size)]||'';return threadRecord({size,unit:'in',pitch:pitch?`${pitch} TPI`:'',threadClass:isoPipe[4]?.toUpperCase()||'',form,standard:form==='G'?'ISO 228-1':'ISO 7-1',quantity:isoPipe[1],warnings:['Boru dişi nominal boyutudur; gerçek dış çap değildir. Uygunluğu ilgili mastarla doğrulayın.',...(!pitch?['Bu boru dişi boyutu için TPI otomatik tamamlanmadı.']:[])],hand:(isoPipe[5]||'').toUpperCase()});}}
    const bsp=text.match(new RegExp(`^(?:(\\d+)\\s*[x×]\\s*)?(${THREAD_FRACTION_RE})\\s*-\\s*(\\d+(?:[.,]\\d+)?)\\s*(BSPP|BSPT)(?:\\s*(LH|RH))?$`,'i'));
    if(bsp){const size=threadSize(bsp[2]),form=bsp[4].toUpperCase(),tpi=Number(bsp[3].replace(',','.'));if(size!==null&&Number.isFinite(tpi)&&tpi>0)return threadRecord({size,unit:'in',pitch:`${decimal(tpi)} TPI`,threadClass:form,form,standard:form==='BSPP'?'ISO 228-1':'ISO 7-1',quantity:bsp[1],warnings:['Boru dişi nominal boyutudur; gerçek dış çap değildir. Uygunluğu ilgili mastarla doğrulayın.'],hand:(bsp[5]||'').toUpperCase()});}
    return null;
  }
  function parseCore(rawText, standard = "", legacyParse) {
    const radius=plainRadius(rawText),thread=radius?null:parseThreadCallout(rawText);
    if(thread)return thread;
    let text = normalize(rawText);
    // Parse pipe callouts before generic fractions, deviations and GD&T heuristics.
    // A pipe size is a nominal designation, never its measured outside diameter.
    const pipeText = String(rawText ?? '').replace(/[−–—]/g, '-').replace(/["“”″]/g, '').replace(/\s*\/\s*/g, '/').replace(/\bN\s*P\s*(T\s*F|T\s*R|S\s*C|S\s*M|S\s*L|T)\b/gi, x => x.replace(/\s/g, '')).trim();
    const pipe = pipeText.match(/^(?:(\d+)\s*[x×]\s*)?(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(NPTF|NPTR|NPSC|NPSM|NPSL|NPT)\s*$/i);
    if (pipe) {
      const fraction = pipe[2].match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
      const size = fraction ? Number(fraction[1] || 0) + Number(fraction[2]) / Number(fraction[3]) : Number(pipe[2]);
      if (Number.isFinite(size) && size > 0 && Number(pipe[3]) > 0 && (!pipe[1] || Number(pipe[1]) > 0)) {
        const series = pipe[4].toUpperCase();
        return {type:'Diş', nominalValue:decimal(size), unit:'in', threadPitch:`${pipe[3]} TPI`, threadClass:series, threadStandard:series==='NPTF'?'ASME B1.20.3':'ASME B1.20.1',
          lowerTolerance:'',upperTolerance:'',lowerLimit:'',upperLimit:'',fitClass:'',gdtSubtype:'',datumRefs:'',gdtFrame:null,
          quantity:Number(pipe[1] || 1),evaluationMethod:'OK_NOT_OK',toleranceExplicit:false,
          toleranceStandard:series==='NPTF'?'ASME B1.20.3':'ASME B1.20.1',
          parseWarnings:['Boru dişi nominal boyutudur; gerçek dış çap değildir. Diş ölçü ve mastar uygunluğunu çizimden doğrulayın.']};
      }
    }
    const parseWarnings = [];
    let quantity = 1;
    const count = text.match(/^([1-9]\d*)\s*(?:[x×]\s*(?=(?:Ø|R|M|C)\s*\d)|(?:YERDE|ADET|DELİK|DELIK|HOLES?|PLACES?)\s*[:=-]?\s*)/i);
    if (count) {
      quantity = Number(count[1]);
      text = text.slice(count[0].length);
    }
    // Compound hole callouts carry independent diameters/depths, not tolerance pairs.
    const hole=text.match(/^(⌴|⌵|SF|CBORE|CSK)?\s*Ø\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(DEEP|DEPTH|°)(?:\s*\/\s*Ø\s*(\d+(?:\.\d+)?)\s*(THRU|THROUGH))?$/i);
    if(hole){
      const result=parse('Ø'+hole[2],'',legacyParse),angle=hole[4]==='°';
      result.quantity=quantity;
      result.callout={...result.callout,depth:angle?'':hole[3],countersinkAngle:angle?hole[3]:'',secondaryDiameter:hole[5]||'',secondaryThrough:!!hole[6],through:false,holeForm:angle?'countersink':/^(?:⌴|CBORE)$/i.test(hole[1]||'')?'counterbore':/^SF$/i.test(hole[1]||'')?'spotface':''};
      result.lowerTolerance=result.upperTolerance=result.lowerLimit=result.upperLimit=result.toleranceStandard='';
      result.toleranceExplicit=false;
      result.parseWarnings=[...(result.parseWarnings||[]),'Özel delik ölçüsü: çap, derinlik/açı ve ikinci çap toleranslarını çizimden doğrulayın.'];
      return result;
    }
    const material = /^(?:MALZEME|MATERIAL|MATL|EN\s+AW[-\s]|AL[ÜU]M[İI]NYUM|ALUMINIUM|ALUMINUM|PASLANMAZ|STAINLESS|STEEL|[ÇC]EL[İI]K)\b/i.test(text);
    const process = /^(?:PROSES|PROCESS|ISIL\s+[İI]ŞLEM|HEAT\s+TREAT|ANODI[ZS]|ANOD[İI]Z|KAPLAMA|COATING|PLATING|SERTLEŞT[İI]R|HARDEN|GER[İI]L[İI]M\s+G[İI]DER)/i.test(text);
    const datum = text.match(/^(?:DATUM|REFERANS)\s*[:=-]?\s*([A-Z](?:-[A-Z])?)\s*$/i) || text.match(/^\[([A-Z])\]$/);
    const note = /^(?:NOT(?:E|LAR)?\s*[:\d]|DEBURR|REMOVE\s+(?:ALL\s+)?BURRS|BREAK\s+(?:ALL\s+)?(?:SHARP\s+)?EDGES|KESK[İI]N\s+KENAR|[ÇC]APAK|AKS[İI]\s+BEL[İI]RT[İI]LMED[İI]|UNLESS\s+OTHERWISE|ALL\s+DIMENSIONS)/i.test(text);
    const chamfer = text.match(new RegExp(`^(?:PAH\\s*:?\\s*)?(${NUMBER})(?:\\s*±\\s*(${NUMBER}))?\\s*[x×]\\s*(${NUMBER})\\s*(?:°|DEG|DERECE)(?:\\s*±\\s*(${NUMBER})\\s*(?:°|DEG|DERECE)?)?`, "i"));
    const cChamfer = text.match(new RegExp(`^(?:C|PAH\\s*:?\\s*)(${NUMBER})\\b`, "i"));
    let frame = frameFromText(/[\r\n]/.test(String(rawText))&&!count?rawText:text);
    if(frame?.subtype==='unknown')parseWarnings.push('GD&T adayı: geometrik sembol okunamadı. Snapshot üzerinden türü seçin.');
    // OCR can miss a graphical control symbol while retaining the tolerance and datum cells.
    const missingSymbol = !frame && text.match(new RegExp(`^(Ø)?(?:±\\s*)?(${NUMBER})([${MODIFIERS}]*)\\s*(?:\\|\\s*|\\s+)([A-Z](?:-[A-Z])?[${MODIFIERS}]*(?:[|\\s]+[A-Z](?:-[A-Z])?[${MODIFIERS}]*){0,5})$`));
    if (missingSymbol) {
      const datums=missingSymbol[4].split(/[|\s]+/).map(token=>({reference:token.replace(/[ⓂⓁⓈⓅⒻ]/g,''),modifiers:[...token].filter(c=>MODIFIERS.includes(c))}));
      frame={symbol:"?",subtype:"unknown",tolerance:missingSymbol[2],diameter:Boolean(missingSymbol[1]),modifiers:[...missingSymbol[3]],datums,cells:["?",`${missingSymbol[1]||''}${missingSymbol[2]}${missingSymbol[3]}`,...datums.map(d=>d.reference+d.modifiers.join(''))]};
      parseWarnings.push("GD&T adayı: geometrik sembol okunamadı. Snapshot'tan doğrulayın; alt tür tahmin edilmedi.");
    }
    const nonDimensional = material || process || datum || note;
    const fit = !nonDimensional && !frame && !chamfer && !cChamfer && !/\b(?:DEEP|DEPTH|THRU|PCD)\b/i.test(text) ? fitNotation(text) : null;
    const legacyText = canonicalDeviations(text).replace(new RegExp(`(${NUMBER})\\s*°(?=\\s*(?:±|[+(-]))`), "$1");
    let legacy = {};
    if (typeof legacyParse === "function") {
      legacy = legacyParse(legacyText, nonDimensional || chamfer || cChamfer || frame ? "" : standard) || {};
    }
    const result = Object.assign({
      type: "Uzunluk", nominalValue: "", lowerTolerance: "", upperTolerance: "", lowerLimit: "", upperLimit: "",
      unit: "mm", evaluationMethod: "VALUE", toleranceStandard: "", toleranceExplicit: false,
      fitClass: "", threadPitch: "", threadClass: "", threadStandard: "", gdtSubtype: "",
    }, legacy, { datumRefs: "", specialDesignator: "", gdtFrame: null, quantity, parseWarnings });
    result.type = normalizeType(result.type);
    if(radius){
      // Remain authoritative even when an older host parser labels R16 as a pipe.
      if(result.type==='Diş'){result.lowerTolerance=result.upperTolerance=result.lowerLimit=result.upperLimit=result.toleranceStandard='';result.toleranceExplicit=false;}
      Object.assign(result,{type:'Yarıçap',nominalValue:radius.nominal,quantity:radius.quantity,unit:radius.unit||'mm',evaluationMethod:'VALUE',threadPitch:'',threadClass:'',threadStandard:''});
    }
    result.callout={basic:/^(?:\[\s*[\d.]|BASIC\b)/i.test(text),reference:/^(?:\(\s*[\d.]|REF\b)/i.test(text),spherical:/^(?:SØ|SR)\s*\d/i.test(text),through:/\bTHRU\b/i.test(text),depth:(text.match(/(?:x|×)\s*(\d+(?:\.\d+)?)\s*(?:DEEP|DEPTH)\b/i)||[])[1]||'',pitchCircleDiameter:(text.match(/Ø\s*(\d+(?:\.\d+)?)\s*PCD\b/i)||[])[1]||'',equallySpaced:/\bEQ\s*SP\b/i.test(text),holeForm:/⌴/.test(text)?'counterbore':/⌵/.test(text)?'countersink':/^SF\b/i.test(text)?'spotface':''};

    if (!text) {
      clearNumeric(result);
      result.type = "Diğer";
      parseWarnings.push("Gereklilik metni henüz girilmedi.");
      return result;
    }

    if (nonDimensional) {
      clearNumeric(result);
      result.type = material ? "Malzeme" : process ? "Proses" : datum ? "Datum" : "Not";
      result.unit = "";
      result.evaluationMethod = "OK_NOT_OK";
      if (datum) result.datumRefs = datum[1].toUpperCase();
      return result;
    }

    if (frame) {
      if(frame.excessDatums||frame.datums.length>3){parseWarnings.push('Fazladan datum algılandı; yalnız ilk üç referans kullanıldı. Kaynağı doğrulayın.');frame.datums=frame.datums.slice(0,3);frame.cells=frame.cells.slice(0,5);}
      if(frame.segments)parseWarnings.push('Birden fazla GD&T segmenti var; bileşik / bağımsız ilişkisini doğrulayın.');
      clearNumeric(result);
      result.type = "GD&T";
      result.gdtSubtype = frame.subtype;
      result.gdtFrame = frame;
      result.datumRefs = frame.datums.map((entry) => `${entry.reference}${entry.modifiers.join("")}`).join(" | ");
      result.specialDesignator = frame.symbol;
      result.unit = /\bIN(?:CH)?\b/i.test(text) ? "in" : "mm";
      result.evaluationMethod = "VALUE";
      if (text.includes("±")) parseWarnings.push("GD&T bölgesindeki ± gösterimini snapshot'tan doğrulayın; geometrik tolerans ± boyut sapması olarak değerlendirilmez.");
      if(frame.datums.some(datum=>!datum.reference))parseWarnings.push('GD&T datum hücresi okunamadı. Boş kalan datum sırasını snapshot ile doğrulayın.');
      if (frame.tolerance !== "") {
        // A geometric tolerance is the total zone width/diameter, never a ± deviation.
        result.lowerTolerance = "0";
        result.upperTolerance = frame.tolerance;
        result.lowerLimit = "0";
        result.upperLimit = frame.tolerance;
        result.toleranceExplicit = true;
        result.toleranceStandard = "GD&T toplam tolerans bölgesi";
      } else {
        parseWarnings.push("GD&T çerçevesinde tolerans değeri okunamadı.");
      }
      if (frame.modifiers.includes("Ⓜ") || frame.modifiers.includes("Ⓛ")) parseWarnings.push("Malzeme şartına bağlı ek tolerans otomatik hesaplanmaz; belirtilen temel bölge değerlendirilir.");
      if (frame.datums.length > 3) parseWarnings.push("Üçten fazla datum algılandı; çerçeveyi doğrulayın.");
      return result;
    }

    if (chamfer || cChamfer) {
      clearNumeric(result);
      result.type = "Pah";
      result.nominalValue = decimal(Number((chamfer || cChamfer)[1]));
      result.chamferAngle = chamfer ? decimal(Number(chamfer[3])) : "";
      result.chamferAngleTolerance = chamfer?.[4] ? decimal(Number(chamfer[4])) : "";
      result.unit = "mm";
      result.evaluationMethod = "OK_NOT_OK";
      if (chamfer?.[2]) {
        result.lowerTolerance = decimal(-Number(chamfer[2]));
        result.upperTolerance = decimal(Number(chamfer[2]));
        result.lowerLimit = decimal(Number(result.nominalValue) - Number(chamfer[2]));
        result.upperLimit = decimal(Number(result.nominalValue) + Number(chamfer[2]));
        result.toleranceExplicit = true;
        result.toleranceStandard = "Pah uzunluğunun belirtilen toleransı";
      }
      if (result.chamferAngleTolerance) parseWarnings.push("Pahın açı toleransı ayrıca kaydedildi; uzunluk ve açı birlikte kontrol edilmelidir.");
      if (standard) parseWarnings.push("Pah uzunluğu ve açısının toleransını teknik resme göre ayrı doğrulayın.");
      return result;
    }

    if (fit) {
      clearNumeric(result);
      result.type = fit.diameter ? 'Çap' : 'Geçme';
      result.nominalValue = decimal(Number(fit.nominal));
      result.fitClass = fit.code;
      result.toleranceExplicit = true; // A fit code excludes general tolerances, even if unsupported.
      result.unit = /\bIN(?:CH)?\b|"/i.test(fit.tail) ? 'in' : 'mm';
      result.evaluationMethod = 'VALUE';
      result.toleranceStandard = `ISO 286 ${fit.code}`;
      const tail = fit.tail.replace(/\b(?:mm|in|inch)\b|"/gi, '').trim();
      const tabulated = result.unit === 'mm' && !fit.secondary ? isoFitLookup(fit.nominal, fit.primary) : null;
      if (tail && typeof legacyParse === 'function' && /^[([+±−-]/.test(tail)) {
        const explicit = legacyParse(`${fit.diameter ? 'Ø' : ''}${fit.nominal} ${tail}`, '');
        if (explicit?.toleranceExplicit && number(explicit.lowerTolerance) !== null && number(explicit.upperTolerance) !== null) {
          result.lowerTolerance = explicit.lowerTolerance;
          result.upperTolerance = explicit.upperTolerance;
          result.toleranceStandard = `Metinde açık tolerans (${fit.code} kodundan öncelikli)`;
          if (tabulated && (number(tabulated.lower) !== number(result.lowerTolerance) || number(tabulated.upper) !== number(result.upperTolerance))) parseWarnings.push('Geçme kodu ile yazılı tolerans farklı; açık sayısal değerler kullanıldı. Çizimi doğrulayın.');
        }
      }
      if (result.lowerTolerance === '' && result.upperTolerance === '') {
        if (fit.secondary) parseWarnings.push('Delik/mil geçme çifti algılandı; H7/g6 gibi çiftler tek tolerans aralığına çevrilmez. İlgili parçanın sınıfını seçin.');
        else if (tail) parseWarnings.push('Geçme kodundan sonra ek veya belirsiz değer var. Seçim bölgesini ve toleransı doğrulayın.');
        else if (tabulated) {
          result.lowerTolerance = tabulated.lower;
          result.upperTolerance = tabulated.upper;
          result.toleranceStandard += ` · NACHI tablosu (${tabulated.minExclusive} < ölçü ≤ ${tabulated.maxInclusive} mm)`;
        } else parseWarnings.push(`Bu sınıf/ölçü için doğrulanmış mm tablosu yok (${fit.code}, ${fit.nominal} ${result.unit}). Genel tolerans uygulanmadı; değerleri elle doğrulayın.`);
      }
      if (number(result.lowerTolerance) !== null && number(result.upperTolerance) !== null) {
        result.lowerLimit = decimal(Number(fit.nominal) + number(result.lowerTolerance));
        result.upperLimit = decimal(Number(fit.nominal) + number(result.upperTolerance));
      }
      return result;
    }

    if (result.type === "Diş") {
      // The '-' preceding 6H or 2B is a thread class separator, not a deviation.
      result.lowerTolerance = result.upperTolerance = result.lowerLimit = result.upperLimit = "";
      result.toleranceStandard = "";
      result.toleranceExplicit = false;
      result.evaluationMethod = "OK_NOT_OK";
      if (/[+-]\s*\d/.test(text.replace(/-\s*(?:[0-9]+[HhGg]|[123][AB])\b/g, ""))) parseWarnings.push("Diş gösterimindeki ek sayısal toleransı doğrulayın.");
      const fractional = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+)\s*-\s*\d+\s*(?:UNC|UNF|UNEF)/i);
      if (fractional) {
        const match = fractional[1].match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
        if (Number(match[3]) > 0) result.nominalValue = decimal(Number(match[1] || 0) + Number(match[2]) / Number(match[3]));
      }
    }

    if (result.type === "Geçme") {
      clearNumeric(result);
      result.toleranceExplicit = true;
      parseWarnings.push('Geçme ölçüsü tam ayrıştırılamadı; birden fazla ölçü veya eksik kod olabilir. Nominali ve sınıfı doğrulayın.');
      return result;
    }

    const degree = text.match(new RegExp(`^(${NUMBER})\\s*(?:°|DEG|DERECE)(?:\\s*(${NUMBER})\\s*['′])?(?:\\s*(${NUMBER})\\s*["″])?`, "i"));
    if (degree && result.type !== "Diş") {
      result.type = "Açı";
      result.unit = "°";
      result.nominalValue = decimal(Number(degree[1]) + Number(degree[2] || 0) / 60 + Number(degree[3] || 0) / 3600);
      const angularTolerance = text.slice(degree[0].length).match(new RegExp(`^\\s*±\\s*(${NUMBER})\\s*(['′"″°]?)(?:\\s*(${NUMBER})\\s*['′])?(?:\\s*(${NUMBER})\\s*["″])?`));
      if (angularTolerance) {
        const value = Number(angularTolerance[1]) / (/['′]/.test(angularTolerance[2]) ? 60 : /["″]/.test(angularTolerance[2]) ? 3600 : 1)+Number(angularTolerance[3]||0)/60+Number(angularTolerance[4]||0)/3600;
        result.lowerTolerance = decimal(-value);
        result.upperTolerance = decimal(value);
        result.toleranceExplicit = true;
        result.toleranceStandard = "Metinde açısal tolerans";
        result.lowerLimit = decimal(Number(result.nominalValue) - value);
        result.upperLimit = decimal(Number(result.nominalValue) + value);
      } else if (degree[2] || degree[3]) {
        result.lowerTolerance = result.upperTolerance = result.lowerLimit = result.upperLimit = "";
      }
      if (standard && !result.toleranceExplicit) parseWarnings.push("Açı için genel tolerans seçimi ilgili kenar uzunluğunu gerektirir; elle doğrulayın.");
    }


    // Single limit notation must not acquire a fictitious opposite bound.
    const singleLimit = !["Diş", "Geçme", "Yüzey"].includes(result.type) && (
      text.match(new RegExp(`^(?:Ø\\s*)?(${NUMBER})\\s*(MAX|MIN)\\b`, "i")) ||
      (() => { const match = text.match(new RegExp(`^(MAX|MIN|<=|>=|≤|≥|<|>)\\s*:?\\s*(?:Ø\\s*)?(${NUMBER})`, "i")); return match && [match[0], match[2], match[1]]; })()
    );
    if (singleLimit && !/\bMAX\b[\s\S]*\bMIN\b|\bMIN\b[\s\S]*\bMAX\b/i.test(text)) {
      clearNumeric(result);
      const upper = /MAX|[<≤]/i.test(singleLimit[2]);
      result[upper ? "upperLimit" : "lowerLimit"] = decimal(Number(singleLimit[1]));
      result.upperInclusive = singleLimit[2] !== "<";
      result.lowerInclusive = singleLimit[2] !== ">";
      result.toleranceExplicit = true;
      result.toleranceStandard = upper ? "Tek üst sınır" : "Tek alt sınır";
    }

    // Extra unsigned numbers are not a nominal-only dimension: missing OCR signs
    // must not silently fall back to a general ± tolerance.
    if (!result.toleranceExplicit && ['Uzunluk','Ölçü','Çap','Yarıçap'].includes(result.type) && new RegExp(`^(?:Ø|R)?${NUMBER}\\s+(?:[0-9.]+[\\s/;()]*)+(?:MM|IN)?$`,'i').test(text)) {
      result.toleranceAmbiguous=true;
      result.lowerTolerance=result.upperTolerance=result.lowerLimit=result.upperLimit=result.toleranceStandard='';
      parseWarnings.push('Tolerans işareti belirsiz. Örnek: Ø27.3 (0/-0.05). Alt ve üst toleransı işaretleriyle doğrulayın.');
    }
    // Complete adjacent numbers cannot become a single nominal just because a
    // later signed tolerance exists. Canonical zero deviations are exempt.
    const unmarkedPair=!/[\r\n]/.test(String(rawText))&&new RegExp(`^(?:Ø|R)?${NUMBER}\\s+${NUMBER}(?:\\s*(?:mm|in))?$`,'i').test(text);
    if (['Uzunluk','Çap','Yarıçap'].includes(result.type) && (unmarkedPair||new RegExp(`^(?:Ø|R)?${NUMBER}\\s+${NUMBER}(?:\\s+${NUMBER})*\\s*(?=[±(+])`).test(canonicalDeviations(text)))) {
      result.toleranceAmbiguous=true;
      result.nominalValue=result.lowerTolerance=result.upperTolerance=result.lowerLimit=result.upperLimit=result.toleranceStandard='';
      result.toleranceExplicit=false;
      parseWarnings.push('Ayrı rakamlar / ölçüler belirsiz. Nominal alanını daha dar seçerek tekrar okuyun; değerler otomatik birleştirilmedi.');
    }
    if (result.type === "Uzunluk" && /^±/.test(text)) result.type = "Tolerans";
    if (result.toleranceStandard?.includes("orta noktadan")) parseWarnings.push("Limit ölçüsünün nominali orta nokta olarak önerildi; asıl nominali doğrulayın.");
    if (/^\d+\s*[x×]\s*\d/i.test(text) && !chamfer) parseWarnings.push("Birden fazla ölçü/tekrar sayısı içeriyor; karakteristikleri ayrı doğrulayın.");
    if (result.type === "Uzunluk" && !result.toleranceExplicit && /\b(?:TOLERANCE|TOLERANS|TOL)\b/i.test(text)) result.type = "Tolerans";
    return result;
  }

  function fieldProfile(type) {
    const normalized = normalizeType(type);
    const numeric = ["Uzunluk", "Çap", "Yarıçap", "Açı", "Diş", "Geçme", "Pah", "Tolerans", "Yüzey", "GD&T"].includes(normalized);
    const datum = ["GD&T", "Datum"].includes(normalized);
    return {
      numeric, nominal: numeric && normalized !== "GD&T", tolerance: numeric && !["Diş", "Pah"].includes(normalized),
      limits: numeric && !["Diş", "Pah"].includes(normalized), datum, special: !["Not", "Görsel", "Diğer"].includes(normalized),
      unit: numeric, requirementLabel: normalized === "GD&T" ? "GD&T / çerçeve" : normalized === "Datum" ? "Datum tanımı" : "Gereklilik / ölçü metni",
    };
  }

  // A type change is an explicit edit, not another OCR pass. Carry across only
  // fields whose meaning survives the change; never reinterpret a GD&T zone as
  // a nominal size or retain a pipe-thread family on an ordinary dimension.
  function transitionType(record, nextType) {
    const previous = normalizeType(record.type), type = normalizeType(nextType);
    if (previous === type) return { ...record, type };
    const result = { ...record, type, callout: { ...(record.callout || {}) } };
    const sizeTypes = ['Uzunluk', 'Çap', 'Yarıçap', 'Geçme', 'Pah', 'Tolerans'];
    const keepSizeLimits = sizeTypes.includes(previous) && sizeTypes.includes(type);
    if (!fieldProfile(type).numeric || !fieldProfile(previous).numeric || previous === 'GD&T' || type === 'GD&T') result.nominalValue = '';
    if (!keepSizeLimits) {
      for (const key of ['lowerTolerance', 'upperTolerance', 'lowerLimit', 'upperLimit']) result[key] = '';
      result.limitDimension = false;
      result.nominalSource = result.nominalValue ? 'manual' : '';
      result.toleranceExplicit = false;
      result.toleranceAmbiguous = false;
      result.toleranceStandard = '';
    }
    result.gdtSubtype = '';
    result.gdtFrame = null;
    result.cells = [];
    result.datumRefs = '';
    result.threadPitch = '';
    result.threadClass = '';
    result.threadStandard = '';
    result.fitClass = ['Çap', 'Geçme', 'Uzunluk'].includes(previous) && ['Çap', 'Geçme', 'Uzunluk'].includes(type) ? result.fitClass || '' : '';
    if (record.fitClass && !result.fitClass) {
      for (const key of ['lowerTolerance', 'upperTolerance', 'lowerLimit', 'upperLimit']) result[key] = '';
      result.toleranceStandard = '';
      result.toleranceExplicit = false;
      result.limitDimension = false;
    }
    result.chamferAngle = '';
    result.chamferAngleTolerance = '';
    result.specialDesignator = '';
    result.surfaceTexture = null;
    result.angleFormat = type === 'Açı' ? 'decimal' : '';
    const allowedCallouts = new Set(sizeTypes.includes(type) || type === 'Açı' ? ['basic', 'reference'] : []);
    if (['Çap', 'Yarıçap'].includes(type)) allowedCallouts.add('spherical');
    if (['Çap', 'Geçme', 'Diş'].includes(type)) for (const key of ['depth', 'through', 'pitchCircleDiameter', 'equallySpaced']) allowedCallouts.add(key);
    if (['Çap', 'Geçme'].includes(type)) for (const key of ['holeForm', 'countersinkAngle', 'secondaryDiameter', 'secondaryThrough']) allowedCallouts.add(key);
    for (const key of Object.keys(result.callout)) if (!allowedCallouts.has(key)) delete result.callout[key];
    // Old source evidence remains in ocrText; generated field provenance must
    // not claim that the newly selected family was recognized by the OCR.
    result.measurementEvidence = null;
    return result;
  }

  // Display text is derived from structured fields, never parsed back into them.
  function generateRequirement(record) {
    const decimal = value => displayNumber(value, record);
    const type = normalizeType(record.type), n = number(record.nominalValue);
    const lo = number(record.lowerTolerance), hi = number(record.upperTolerance);
    const min = number(record.lowerLimit), max = number(record.upperLimit);
    const unit = record.unit && !['mm', '°', '—'].includes(record.unit) ? ` ${record.unit}` : '';
    const signed = v => (v > 0 ? '+' : '') + decimal(v);
    const deviations = lo !== null && hi !== null
      ? (lo === 0 && hi === 0 ? ' (0/0)' : lo < 0 && hi > 0 && Math.abs(lo + hi) <= Math.max(Math.abs(lo), Math.abs(hi)) * Number.EPSILON * 4 ? ` ±${decimal(hi)}` : ` (${signed(hi)}/${signed(lo)})`)
      : lo !== null ? ` (alt ${signed(lo)})` : hi !== null ? ` (üst ${signed(hi)})` : '';
    const prefix = type === 'Çap' ? 'Ø' : type === 'Yarıçap' ? 'R' : '';
    let value = '';
    if (type === 'GD&T') {
      // OCR is source evidence, not the requirement after characteristic edits.
      const entry = GDT_TYPES.find(item => item.value === record.gdtSubtype);
      const frame = record.gdtFrame || {};
      const tolerance = hi !== null ? hi : number(frame.tolerance);
      if (tolerance === null) return null;
      const datums = record.datumRefs != null ? String(record.datumRefs).trim() : (frame.datums || []).map(d => d.reference + (d.modifiers || []).join('')).join(' | ');
      value = `${entry ? entry.symbol + ' | ' : ''}${frame.diameter ? 'Ø' : ''}${decimal(tolerance)}${(frame.modifiers || []).join('')}${distributionText(frame)}${datums ? ' | ' + datums : ''}`;
    } else if (type === 'Datum') {
      if (!record.datumRefs) return null;
      value = `Datum ${record.datumRefs}`;
    } else if (type === 'Diş') {
      const form=record.callout?.threadForm||'';
      const hand=record.callout?.threadHand?` ${record.callout.threadHand}`:'';
      const threadNominal=n===null?'':limitDecimal(String(n));
      const fractionSize=value=>{let size=decimal(value);for(const d of [2,4,8,16,32,64])if(Math.abs(value*d-Math.round(value*d))<1e-8){const whole=Math.floor(value),part=Math.round((value-whole)*d);size=part?`${whole?whole+' ':''}${part}/${d}`:String(whole);break;}return size;};
      const pitch=String(record.threadPitch||'').trim().replace(/,/g,'.');
      const tpi=pitch.match(/^(\d+(?:\.\d+)?)\s*TPI$/i);
      if(n===null||n<=0)return null;
      if(['G','R','Rc','Rp'].includes(form))value=`${form} ${fractionSize(n)}${record.threadClass?' '+record.threadClass:''}${hand}`;
      else if(['BSPP','BSPT'].includes(form)&&tpi&&Number(tpi[1])>0)value=`${fractionSize(n)}-${tpi[1]} ${form}${hand}`;
      else if(/^(UNC|UNF|UNEF|UNR|UNJ|UNS|UN)$/.test(form)&&tpi&&Number(tpi[1])>0)value=`${fractionSize(n)}-${tpi[1]} ${form}${record.threadClass?'-'+record.threadClass:''}${hand}`;
      else if(form==='Tr'&&/^\d+(?:\.\d+)?(?:\s*\(P\d+(?:\.\d+)?\))?$/.test(pitch)&&Number.parseFloat(pitch)>0)value=`Tr${threadNominal} × ${pitch}${record.threadClass?'-'+record.threadClass:''}${hand}`;
      else if(/^(NPTF|NPTR|NPSC|NPSM|NPSL|NPT)$/.test(record.threadClass||'')&&tpi&&Number(tpi[1])>0)value=`${fractionSize(n)}-${tpi[1]} ${record.threadClass}${hand}`;
      else {
        // Unknown inch families and incomplete Tr/BSP/UN data must never turn
        // into an invented metric thread just because a numeric size exists.
        if(record.unit==='in'||/TPI/i.test(pitch)||(form&&form!=='M')||(pitch&&(number(pitch)===null||number(pitch)<=0)))return null;
        value=`M${threadNominal}${pitch?' × '+limitDecimal(pitch):''}${record.threadClass?'-'+record.threadClass:''}${hand}`;
      }
    } else if (type === 'Pah') {
      if (record.limitDimension && min!==null && max!==null) value=`${decimal(min)}–${decimal(max)}`;
      else if(n!==null)value=`${decimal(n)}${deviations}`;
      else return null;
      value += `${record.chamferAngle ? ' × ' + record.chamferAngle + '°' : ' pah'}${record.chamferAngleTolerance ? ' ±' + record.chamferAngleTolerance + '°' : ''}${unit}`;
    } else if (type === 'Yüzey') {
      const label = /^(?:R(?:a|z|q|t|p|v|max|zjis|sk|ku|sm)|S[aqzpv]|RMS|CLA)$/i.test(record.specialDesignator || '') ? record.specialDesignator : 'Yüzey';
      if((lo!==null||hi!==null)&&n!==null)value=`${label} ${decimal(n)}${deviations}${unit}`;
      else if(min!==null&&max!==null&&min!==0)value=`${label} ${decimal(min)}–${decimal(max)}${unit}`;
      else if(max!==null)value=`${label} ${record.upperInclusive===false?'<':'≤'}${decimal(max)}${unit}`;
      else if(min!==null)value=`${label} ${record.lowerInclusive===false?'>':'≥'}${decimal(min)}${unit}`;
      else if(n!==null)value=`${label} ${decimal(n)}${unit}`;
      else return null;
    } else if (['Uzunluk','Çap','Yarıçap','Açı','Geçme','Tolerans'].includes(type)) {
      const angle = type === 'Açı' && record.angleFormat!=='dms' ? '°' : '';
      // Explicit limit dimensions stay limit dimensions; do not publish an inferred midpoint.
      if ((n === null || record.limitDimension || /orta noktadan/.test(record.toleranceStandard || '')) && (min !== null || max !== null)) {
        value = min !== null && max !== null ? `${prefix}${decimal(min)}–${decimal(max)}${angle}${unit}`
          : `${prefix}${max !== null ? record.upperInclusive === false ? '<' : '≤' : record.lowerInclusive === false ? '>' : '≥'}${decimal(max ?? min)}${angle}${unit}`;
      } else if (n !== null) {
        value = `${prefix}${decimal(n)}${angle}${['Çap','Geçme','Uzunluk'].includes(type)&&record.fitClass ? ' ' + record.fitClass : ''}${deviations}${unit}`;
      } else if(type==='Tolerans'&&deviations)value=deviations.trim()+unit;
      else return null;
    } else {
      // Free-text families have no safe numeric reconstruction. In automatic
      // mode the current corrected OCR is their requirement, never old numbers.
      return typeof record.ocrText==='string'&&record.ocrText.trim()?record.ocrText.trim():null;
    }
    const callout=record.callout||{};
    if(['Çap','Yarıçap'].includes(type)&&callout.spherical&&!/^S/.test(value))value='S'+value;
    if(['Çap','Geçme','Diş'].includes(type)){
      if(callout.depth)value+=' x '+callout.depth+' DEEP';
      if(callout.through)value+=' THRU';
      if(callout.pitchCircleDiameter)value+=(callout.equallySpaced?' EQ SP ON ':' ON ')+'Ø'+callout.pitchCircleDiameter+' PCD';
    }
    if(['Çap','Geçme'].includes(type)){
      if(callout.countersinkAngle)value+=' x '+callout.countersinkAngle+'°';
      if(callout.secondaryDiameter)value+=' / Ø'+callout.secondaryDiameter+(callout.secondaryThrough?' THRU':'');
      if(callout.holeForm)value=({counterbore:'⌴ ',countersink:'⌵ ',spotface:'SF '}[callout.holeForm]||'')+value;
    }
    if(['Uzunluk','Çap','Yarıçap','Açı','Geçme','Pah','Tolerans'].includes(type)){
      if(callout.basic)value='[ '+value+' ]';
      if(callout.reference)value='( '+value+' )';
    }
    return Number(record.quantity) > 1 ? `${record.quantity} × ${value}` : value;
  }

  // Compare meanings rather than raw whitespace or OCR confidence alone.
  // No general-tolerance inference is performed by this assessment.
  function assessReading(text) {
    const record=global.ASMachApp?.parseRequirement?global.ASMachApp.parseRequirement(text,''):parse(text),n=number(record.nominalValue),lo=number(record.lowerTolerance),hi=number(record.upperTolerance),min=number(record.lowerLimit),max=number(record.upperLimit);
    const hasLimits=(record.limitDimension||n===null)&&(min!==null||max!==null);
    const kind=record.type==='GD&T'?'gdt':record.type==='Yüzey'?'surface':record.type==='Diş'?'thread':record.type==='Geçme'||record.fitClass?'fit':record.type==='Açı'?'angle':record.type==='Pah'?'chamfer':hasLimits?'limits':'dimension';
    const tolerance=kind==='gdt'?'geometric-zone':hasLimits?'limits':lo!==null&&hi!==null?(lo===-hi?'symmetric':lo===0||hi===0?'unilateral':'asymmetric'):lo!==null||hi!==null?'one-sided':'unspecified';
    const errors=consistencyErrors(record),warnings=activeWarnings(record);
    const valid=errors.length===0&&!record.toleranceAmbiguous&&!(min!==null&&max!==null&&min>max)&&(kind==='gdt'?record.gdtSubtype&&record.gdtSubtype!=='unknown'&&hi!==null:fieldProfile(record.type).numeric&&(n!==null||min!==null||max!==null));
    const signature=JSON.stringify([kind,record.type,tolerance,n,lo,hi,min,max,record.unit,record.quantity||1,record.gdtSubtype,record.gdtFrame?.cells,record.threadPitch,record.threadClass,record.threadStandard,record.fitClass,record.chamferAngle,record.specialDesignator]);
    return {kind,tolerance,valid:Boolean(valid),warnings,errors,signature};
  }

  function syncRequirement(record, force = false, options = {}) {
    record=normalizeLimitDimension(record);
    if(record.type==='GD&T')record=withGdtSubtype(record);
    if(record.type==='GD&T'&&force){
      const corrected=record.gdtFrame.cells.join(' | ');
      record={...record,cells:[...record.gdtFrame.cells],originalOcrText:record.originalOcrText||record.ocrText||'',ocrText:corrected};
    }
    const generated = generateRequirement(record);
    const marked = (record.manualFields || []).includes('requirement');
    const sameAsOcr = record.ocrText && String(record.requirement || '').replace(/\s/g,'') === String(record.ocrText).replace(/\s/g,'');
    const mode = force ? 'auto' : marked ? 'manual' : ['auto','manual'].includes(record.requirementMode) ? record.requirementMode
      : record.autoParse === false ? 'manual' : !record.requirement || sameAsOcr ? 'auto' : 'manual';
    const clearIncomplete = (force || options.clearIncomplete) && (fieldProfile(record.type).numeric || normalizeType(record.type)==='Datum');
    return { ...record, ...(force ? {manualFields:(record.manualFields || []).filter(name => name !== 'requirement')} : {}), requirementMode: mode, requirement: mode === 'auto' ? generated !== null ? generated : clearIncomplete ? '' : String(record.requirement || '') : String(record.requirement || '') };
  }

  function limits(record) {
    const nominal = number(record.nominalValue ?? record.nominal);
    let lower = number(record.lowerLimit);
    let upper = number(record.upperLimit);
    if (normalizeType(record.type) === "GD&T") {
      if (lower == null && number(record.upperTolerance) != null) lower = 0;
      if (upper == null) upper = number(record.upperTolerance);
    } else if (nominal != null) {
      if (lower == null && number(record.lowerTolerance) != null) lower = Number((nominal + number(record.lowerTolerance)).toFixed(10));
      if (upper == null && number(record.upperTolerance) != null) upper = Number((nominal + number(record.upperTolerance)).toFixed(10));
    }
    return { lower, upper };
  }

  function consistencyErrors(record) {
    if (!fieldProfile(record.type).numeric) return [];
    const errors = [], n = number(record.nominalValue), gdt = normalizeType(record.type) === 'GD&T';
    const differs = (a,b) => Math.abs(a-b) > Math.max(1e-7, Math.abs(b)*1e-10);
    for (const [tol,limit,label] of [['lowerTolerance','lowerLimit','Alt'],['upperTolerance','upperLimit','Üst']]) {
      const t=number(record[tol]), bound=number(record[limit]);
      const expected=gdt?(tol==='lowerTolerance'?0:number(record.upperTolerance)):n!==null&&t!==null?n+t:null;
      if (bound!==null&&expected!==null&&differs(bound,expected)) errors.push(`${label} limit nominal / toleransla çelişiyor. Limitleri toleranstan hesaplayın veya tolerans alanlarını temizleyip yalnız limit kullanın.`);
    }
    if(gdt&&number(record.upperTolerance)!==null&&number(record.upperTolerance)<0)errors.push('GD&T tolerans bölgesi negatif olamaz.');
    return errors;
  }

  function evaluate(record) {
    const raw = record.result ?? record.measuredValue ?? record.measurementResult ?? "";
    const bounds = limits(record);
    const response = (result, reason) => ({
      result, status: result, resultStatus: { pass: "UYGUN", fail: "UYGUN_DEGIL", pending: "BEKLIYOR", invalid: "BELIRSIZ" }[result],
      label: { pass: "Uygun", fail: "Uygun değil", pending: "Bekliyor", invalid: "Belirsiz" }[result],
      reason, note: reason, lowerLimit: bounds.lower, upperLimit: bounds.upper,
    });
    if (String(raw).trim() === "") return response("pending", "Ölçüm sonucu girilmedi.");
    if(record.callout?.depth||record.callout?.secondaryDiameter||record.callout?.countersinkAngle)return response('invalid','Birleşik ölçüyü tek sonuçla değerlendirmeyin; ölçü bileşenlerini ayrı kontrol edin.');
    if(record.callout?.basic||record.callout?.reference)return response('invalid','Temel / referans ölçü doğrudan boyutsal kabul toleransı değildir.');
    if(record.gdtFrame?.segments)return response('invalid','Çok segmentli GD&T için segment bazında sonuç ve ilişki doğrulaması gerekli.');
    const conflicts=consistencyErrors(record);
    if(conflicts.length)return response('invalid',conflicts.join(' '));
    if (record.evaluationMethod === "OK_NOT_OK") {
      const value = String(raw).trim().toLocaleUpperCase("tr-TR").replace(/[\s-]+/g, "_");
      if (["OK", "PASS", "UYGUN", "TRUE", "EVET"].includes(value)) return response("pass", "Kontrol sonucu OK.");
      if (["NOT_OK", "NOTOK", "NOK", "FAIL", "UYGUN_DEGİL", "UYGUN_DEGIL", "FALSE", "HAYIR"].includes(value)) return response("fail", "Kontrol sonucu NOT OK.");
      return response("invalid", "OK veya NOT OK sonucu seçin.");
    }
    if(record.type==='GD&T'&&record.gdtFrame?.distribution)return response('invalid','Eşit olmayan profil dağılımı için otomatik sayısal değerlendirme desteklenmiyor; ölçüm yöntemini doğrulayın.');
    const value = number(raw);
    if (value == null) return response("invalid", "Ölçüm sonucu sonlu bir sayı olmalıdır.");
    for (const key of NUMERIC_FIELDS) {
      if (record[key] != null && String(record[key]).trim() !== "" && number(record[key]) == null) return response("invalid", "Nominal, tolerans veya sınır sayısal değil.");
    }
    if (bounds.lower == null && bounds.upper == null) return response("invalid", "Kabul sınırları tanımlı değil; sonuç otomatik onaylanamaz.");
    if (bounds.lower != null && bounds.upper != null && bounds.lower > bounds.upper) return response("invalid", "Alt sınır üst sınırdan büyük.");
    const below = bounds.lower != null && (record.lowerInclusive === false ? value <= bounds.lower : value < bounds.lower);
    const above = bounds.upper != null && (record.upperInclusive === false ? value >= bounds.upper : value > bounds.upper);
    return response(below || above ? "fail" : "pass", below || above ? "Ölçüm kabul sınırlarının dışında." : "Ölçüm tanımlı kabul sınırlarını sağlıyor.");
  }

  function activeWarnings(record) {
    return [...new Set((record.parseWarnings||[]).filter(message=>{
      if(/Açı genel toleransı için kısa kenar/i.test(message)){
        if(record.type!=='Açı')return false;
        return !(number(record.lowerTolerance)!=null&&number(record.upperTolerance)!=null&&(record.toleranceExplicit||Number(record.referenceLength)>0));
      }
      if(/GD&T bölgesindeki/.test(message)&&record.type!=='GD&T')return false;
      return true;
    }))];
  }
  function validate(record) {
    const errors = [];
    const warnings = activeWarnings(record);
    const text = record.requirement ?? record.requirementText ?? record.text ?? record.label ?? "";
    errors.push(...consistencyErrors(record));
    if (!String(text).trim()) errors.push("Gereklilik / ölçü metni zorunludur.");
    if (!TYPES.includes(record.type) && !TYPE_ALIASES[record.type]) errors.push("Geçerli bir karakteristik türü seçin.");
    for (const key of NUMERIC_FIELDS) {
      if (record[key] != null && String(record[key]).trim() !== "" && number(record[key]) == null) errors.push(`${key}: sonlu bir sayı girin.`);
    }
    if (record.page != null && (!Number.isInteger(Number(record.page)) || Number(record.page) < 1)) errors.push("Sayfa pozitif bir tam sayı olmalıdır.");
    if (record.quantity != null && (!Number.isInteger(Number(record.quantity)) || Number(record.quantity) < 1)) errors.push("Tekrar adedi pozitif bir tam sayı olmalıdır.");
    if (record.number != null && !String(record.number).trim()) errors.push("Karakteristik numarası zorunludur.");
    const bounds = limits(record);
    if (bounds.lower != null && bounds.upper != null && bounds.lower > bounds.upper) errors.push("Alt sınır üst sınırdan büyük olamaz.");
    if (number(record.lowerTolerance) != null && number(record.upperTolerance) != null && number(record.lowerTolerance) > number(record.upperTolerance)) errors.push("Alt tolerans üst toleranstan büyük olamaz.");
    if (record.evaluationMethod && !["VALUE", "OK_NOT_OK"].includes(record.evaluationMethod)) errors.push("Değerlendirme yöntemi geçersiz.");
    if (record.evaluationMethod === "VALUE" && bounds.lower == null && bounds.upper == null) warnings.push("Kabul sınırı yok; ölçüm otomatik değerlendirilemez.");
    if (normalizeType(record.type) === "GD&T" && bounds.upper != null && bounds.upper < 0) errors.push("GD&T tolerans bölgesi negatif olamaz.");
    return { valid: errors.length === 0, errors, warnings: [...new Set(warnings)] };
  }

  function angleText(value){return String(value??'').trim().replace(/[−–—]/g,'-').replace(/,/g,'.').replace(/[º˚]/g,'°').replace(/(?:deg(?:rees)?|derece)/gi,'°').replace(/[’‘`]/g,"′").replace(/''|[“”]/g,'″').replace(/'/g,'′').replace(/"/g,'″');}
  function parseAngle(value){
    const text=angleText(value),sign=text.startsWith('-')?-1:1,body=text.replace(/^[+-]\s*/,'');
    if(/^\d+(?:\.\d+)?$/.test(body))return sign*Number(body);
    const colon=body.match(/^(\d+):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?$/);
    const m=colon||body.match(/^(?:(\d+(?:\.\d+)?)\s*°\s*)?(?:(\d+(?:\.\d+)?)\s*′\s*)?(?:(\d+(?:\.\d+)?)\s*″)?$/);
    if(!m||!m.slice(1).some(v=>v!==undefined))return null;
    const d=Number(m[1]||0),min=Number(m[2]||0),sec=Number(m[3]||0);
    if(min>=60||sec>=60||(m[2]!=null&&!Number.isInteger(d))||(m[3]!=null&&!Number.isInteger(min)))return null;
    return sign*(d+min/60+sec/3600);
  }
  function formatAngle(value){
    if(value==null||String(value).trim()===''||!Number.isFinite(Number(value)))return String(value??'');
    const n=Number(value),total=Math.round(Math.abs(n)*3600*1e6)/1e6,d=Math.floor(total/3600),m=Math.floor((total-d*3600)/60),s=Number((total-d*3600-m*60).toFixed(6));
    return `${n<0?'-':''}${d}° ${m}′ ${s}″`;
  }
  function parseAngularCallout(value){
    const text=angleText(value);if(!/^[+-]?\s*\d+(?:\.\d+)?\s*°/.test(text)||/[x×]/i.test(text))return null;
    const token='[+-]?\\s*(?:(?:\\d+(?:\\.\\d+)?)\\s*°\\s*)?(?:(?:\\d+(?:\\.\\d+)?)\\s*′\\s*)?(?:(?:\\d+(?:\\.\\d+)?)\\s*″)?';
    const first=text.match(new RegExp('^'+token));if(!first?.[0].trim())return null;
    const nominal=parseAngle(first[0]),tail=text.slice(first[0].length).trim().replace(/^\(|\)$/g,'').trim(),dms=/[′″]/.test(text);
    const out={nominal,dms,canonical:`${nominal??0}°`,lower:null,upper:null};
    const fail=()=>({...out,error:'Açı girişini doğrulayın: dakika ve saniye 0–59 aralığında olmalı; tolerans işaretleri açık olmalıdır.'});
    if(nominal===null)return fail();
    if(!tail)return out;
    if(tail.startsWith('±')){const t=parseAngle(tail.slice(1));if(t==null||t<0)return fail();out.lower=-t;out.upper=t;return out;}
    const parts=tail.replace(/([0-9°′″])(?=[+-])/g,'$1 ').split(/\s*\/\s*|\s+(?=[+-])/).filter(Boolean);
    if(parts.length>2||!parts.length)return fail();
    const nums=parts.map(p=>parseAngle(p));if(nums.some(n=>n==null)||parts.some(p=>!/^[-+]/.test(p)&&Number(p)!==0))return fail();
    if(nums.length===2){out.lower=Math.min(...nums);out.upper=Math.max(...nums);}else if(nums[0]>=0){out.upper=nums[0];out.lower=0;}else{out.lower=nums[0];out.upper=0;}return out;
  }
  function displayNumber(value, record){
    if(record?.type==='Açı'&&record.angleFormat==='dms')return formatAngle(value);
    const raw=String(value??'');if(!raw.trim()||!Number.isFinite(Number(raw.replace(',','.'))))return raw;
    const n=Number(raw.replace(',','.')),p=record?.decimalPlaces;
    if(record?.limitDimension||record?.nominalSource==='limit_midpoint'){
      const natural=limitDecimal(raw),[whole,fraction='']=natural.split('.');
      if(!Number.isInteger(p)||p<0||p>13)return natural;
      const places=Math.max(p,fraction.length);
      return whole+(places?'.'+fraction.padEnd(places,'0'):'');
    }
    if(!Number.isInteger(p)||p<0||p>6)return limitDecimal(n);
    const natural=limitDecimal(n),digits=(natural.split('.')[1]||'').length;
    if(digits>12)return natural;
    return n.toFixed(Math.min(12,Math.max(p,digits)));
  }
  function datumTokens(value){
    const text=String(value??'').trim();if(!text)return [];
    const parts=(text.includes('|')?text.split('|'):text.split(/\s+/)).map(s=>s.trim().toUpperCase());
    while(parts.length&&!parts.at(-1))parts.pop();return parts;
  }
  global.ASMachRequirements = Object.freeze({ applyDrawingTolerance, measurementEvidence, normalizeLimitDimension, transitionType, repairAutoRadius, assessReading, parseSurface, parseAngularCallout, parseAngle, formatAngle, displayNumber, parse, normalize, generateRequirement, syncRequirement, fitNotation, isoFitLookup, fitClasses: Object.freeze(Object.keys(ISO_FIT_TABLES)), datumTokens, gdtCells, detectGdt, GDT_TYPES, gdtOptions, withGdtSubtype, evaluate, consistencyErrors, activeWarnings, fieldProfile, TYPES, STATUSES, validate, normalizeStatus, normalizeType, MEASUREMENT_INTENTS, normalizeMeasurementIntent, measurementIntentEvidence, measurementIntentScore, applyMeasurementIntent });
})(typeof window === "undefined" ? globalThis : window);
