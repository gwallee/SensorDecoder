"use strict";
/* Part-number decoder: family parsers, OCR/typo repair, suggestions, documentation links */
/* ================= PARSER ================= */
function seg(text, meaning){ return {t:text, d:meaning}; }

/* Cable-length suffix: Banner writes "W/30" (9 m / 30 ft), and also "W/10" (3 m)
   — plus the odd "W30" without the slash. Convert feet → metres generically. */
const CABLE_FT = {10:'3 m', 20:'6 m', 30:'9 m', 50:'15 m'};
function cableText(ft){
  const m = CABLE_FT[ft] || (Math.round(ft*0.3048*10)/10)+' m';
  return m + ' ('+ft+' ft) cable';
}
function stripSuffixes(pn, connSet){
  let cableFt = null, special = null, conn = '';
  let m = pn.match(/-(\d{3,5})$/);
  if(m){ special = m[1]; pn = pn.slice(0, -m[0].length); }
  m = pn.match(/\s*W\/?(\d{1,3})$/);
  if(m){ cableFt = Number(m[1]); pn = pn.slice(0, -m[0].length); }
  for(const c of connSet){
    if(pn.endsWith(c)){ conn = c; pn = pn.slice(0, -c.length); break; }
  }
  return {pn, conn, cableFt, special};
}

function parseQS18(raw){
  const fam = {family:'QS18', famName:'WORLD-BEAM QS18', famDesc:'Miniature universal-housing photoelectric — rectangular body with 18 mm threaded lens nose, 10–30 V DC, IP67.'};
  const S = stripSuffixes(raw, ['QPMA','Q8','Q9','Q7','Q5','Q2','Q1','C1','Q']);
  let pn = S.pn;
  const segs = [seg('QS18','WORLD-BEAM QS18 series')];
  const notes = [], warns = [];
  let out=null, supply='10–30 V DC', modeInfo=null, modeCode=null, expert=false;

  // Emitters QS186x
  let m = pn.match(/^QS186(LE|EV|EB|E)(\d+)?$/);
  if(m){
    modeCode = m[1]; modeInfo = QS18_EMITTERS[m[1]];
    segs.push(seg('6','DC family'), seg(m[1], modeInfo.m));
    if(m[2]) { notes.push('Factory variant “'+m[2]+'” — base model shown'); segs.push(seg(m[2],'factory variant')); }
    out = 'None — emitter only (2-wire); use with a matching receiver';
  }
  // Ultrasonic
  else if((m = pn.match(/^QS18(UN|UP)A(E)?$/))){
    modeCode='ULTRASONIC';
    modeInfo = {m:'Ultrasonic proximity (TEACH)', r:'50–500 mm', l:L.US()};
    out = (m[1]==='UN'?'NPN (sinking)':'PNP (sourcing)') + ' — TEACH-mode ultrasonic';
    segs.push(seg(m[1], m[1]==='UN'?'Ultrasonic, NPN output':'Ultrasonic, PNP output'), seg('A','TEACH model'));
    if(m[2]){ notes.push('E = epoxy-encapsulated electronics'); segs.push(seg('E','epoxy-encapsulated')); }
    fam.famName = 'QS18U (ultrasonic)';
  }
  // Universal voltage W-series
  else if((m = pn.match(/^QS18(A|R)(N|P)W(.*)$/))){
    supply = m[2]==='N' ? '20–270 V AC/DC (N-MOSFET)' : '20–140 V AC/DC (P-MOSFET)';
    out = (m[2]==='N'?'N-MOSFET (sinking)':'P-MOSFET (sourcing)') + ' — ' + (m[1]==='A'?'light operate':'dark operate') + ', 3-wire';
    segs.push(seg(m[1], m[1]==='A'?'Light operate':'Dark operate'), seg(m[2], m[2]==='N'?'N-MOSFET sinking':'P-MOSFET sourcing'), seg('W','universal voltage AC/DC family'));
    const rest = m[3];
    modeCode = rest || 'R';
    modeInfo = QS18_MODES[rest] || null;
    // W-series optics differ from the DC series (p/n 136003): opposed 20 m @ 940 nm,
    // polarized retro 3.5 m @ 660 nm, retro 6.5 m, visible diffuse 450 mm, IR diffuse 1 m.
    if(rest==='R'){ modeInfo = {m:'Opposed (through-beam) — receiver', r:'20 m', l:L.IR(940)}; }
    if(rest==='LP'){ modeInfo = {m:'Polarized retroreflective', r:'3.5 m', l:L.RED(660)}; }
    if(!modeInfo){ return fail(fam, raw, 'Unrecognized W-series mode “'+rest+'”'); }
    segs.push(seg(rest, modeInfo.m));
    fam.famName = 'QS18 (universal voltage)';
  }
  else if(pn === 'QS18WE'){
    modeCode='E'; modeInfo = {m:'Opposed — emitter (universal voltage)', r:'20 m beam', l:L.IR(940)};
    out='None — emitter only'; supply='20–270 V AC/DC';
    segs.push(seg('W','universal voltage family'), seg('E','emitter'));
  }
  // Standard DC
  else if((m = pn.match(/^QS18(VN|VP|EN|EP|EK|AB|RB|K)6(.+)$/))){
    const oc = m[1]; out = QS18_OUT[oc];
    expert = (oc==='EN'||oc==='EP'||oc==='EK');
    segs.push(seg(oc, out), seg('6','DC solid-state family'));
    const rest = m[2];
    // Expert IO-Link opposed pairs are their own nomenclature (QS18EK6E ↔ QS18EK6R)
    if(oc==='EK' && QS18_EK_OPPOSED[rest]){
      modeCode = rest; modeInfo = QS18_EK_OPPOSED[rest];
      segs.push(seg(rest, modeInfo.m));
      fam.famName = 'QS18 Expert (TEACH + IO-Link)';
      if(modeInfo.emitter) out = 'None — emitter only; IO-Link configurable, pairs with a matching receiver';
    } else {
    for(const code of QS18_MODE_ORDER){
      if(rest === code){ modeCode = code; modeInfo = QS18_MODES[code]; break; }
    }
    if(!modeInfo) return fail(fam, raw, 'Unrecognized QS18 sensing-mode code “'+rest+'”');
    segs.push(seg(modeCode, modeInfo.m));
    if(expert){
      fam.famName = 'QS18 Expert (TEACH)';
      if(!QS18_EXPERT_OK.has(modeCode)) warns.push('Heads-up: “'+modeCode+'” is not a standard Expert-series catalog mode — double-check this part number. (Expert opposed-mode pairs exist only as QS18EK6E/QS18EK6R and QS18EK6EV/QS18EK6RV.)');
      if(modeInfo.re) modeInfo = Object.assign({}, modeInfo, {r:modeInfo.re});
    }
    }
    if(modeInfo.expertOnly && !expert) warns.push('“'+modeCode+'” is normally an Expert (QS18Ex6…) mode.');
    if(modeCode==='FF125' && oc==='VN') warns.push('FF125 catalog models are PNP only — QS18VN6FF125 may not exist.');
  }
  else return fail(fam, raw, 'This QS18 part number doesn’t match the known nomenclature');

  if(S.conn){ segs.push(seg(S.conn, QD[S.conn]||'connector')); }
  if(S.cableFt) segs.push(seg('W/'+S.cableFt, cableText(S.cableFt)));
  if(S.special){ segs.push(seg('-'+S.special,'customer-special / factory-modified variant')); notes.push('“-'+S.special+'” = customer-special variant; base function shown, specifics may differ.'); }

  return {ok:true, fam, segs, notes, warns,
    mode:modeInfo.m, range:modeInfo.r, light:modeInfo.l,
    output:out, supply, conn: connText(S), modeNote: modeInfo.note};
}

function connText(S){
  if(S.cableFt) return 'Integral ' + cableText(S.cableFt);
  return QD[S.conn] || QD[''];
}

function parseQ4X(raw){
  const fam = {family:'Q4X', famName:'Q4X (stainless laser distance)', famDesc:'Rugged 316L stainless-steel laser distance sensor with display, 10–30 V DC.'};
  const m = raw.match(/^Q4X(T|F)(B|N|P|I|U|K)(LAF|COD)(\d{3})-?Q8$/);
  if(!m) return fail(fam, raw, 'This Q4X part number doesn’t match the known nomenclature');
  const [_, hs, oc, mode, rng] = m;
  const housing = hs==='T' ? 'Threaded-barrel housing — angled display + 3 buttons' : 'Flush-mount housing — flat face, IP69K';
  const minR = hs==='T' ? 25 : 35;
  const validT = ['100','300','500','600'], validF=['110','310','610'];
  const warns=[], notes=[];
  if((hs==='T'&&!validT.includes(rng)) || (hs==='F'&&!validF.includes(rng)))
    warns.push('Range “'+rng+'” is not a standard catalog range for the '+(hs==='T'?'standard':'flush')+' housing ('+(hs==='T'?validT:validF).join('/')+' mm).');
  // Analog (I/U) models have no discrete output at all — pin 4 is analog ground and
  // pin 5 is a remote-teach input (p/n 185624 wiring diagram).
  const OUT = {B:'Bipolar discrete (1 NPN + 1 PNP) · 5-pin M12', N:'NPN ×1 · 4-pin M12', P:'PNP ×1 · 4-pin M12',
    I:'Analog current 4–20 mA only · 5-pin M12 (pin 5 = remote input)',
    U:'Analog voltage 0–10 V only · 5-pin M12 (pin 5 = remote input)',
    K:'Dual channel: IO-Link/push-pull + PNP or PFM · 4-pin M12'};
  const MODE = {LAF:'Laser distance — adjustable field (BGS/FGS)', COD:'Clear object detection — laser distance'};
  return {ok:true, fam,
    segs:[seg('Q4X','Q4X series'), seg(hs,housing), seg(oc,OUT[oc]), seg(mode,MODE[mode]), seg(rng,'max range '+rng+' mm'), seg('-Q8','integral M12 QD')],
    notes, warns, mode:MODE[mode], range:minR+'–'+rng+' mm', light:L.L1(655),
    output:OUT[oc], supply:'10–30 V DC',
    conn:'Integral ' + (/5-pin/.test(OUT[oc]) ? '5' : '4') + '-pin M12 (Euro) QD', housing};
}

function parseQ5X(raw){
  const fam = {family:'Q5X', famName:'Q5X (high-power laser distance)', famDesc:'High-excess-gain laser distance sensor with display; handles dark or shiny targets, 10–30 V DC.'};
  const m = raw.match(/^Q5XKLAF(2000|3000|5000|10000)-?Q8(-JAM|-PFM)?$/);
  if(!m) return fail(fam, raw, 'This Q5X part number doesn’t match the known nomenclature');
  const rng = m[1]; const minR = (rng==='5000'||rng==='10000') ? 50 : 95;
  const notes=[];
  if(m[2]==='-JAM') notes.push('Factory-preconfigured for jam detection (dual mode).');
  if(m[2]==='-PFM') notes.push('Factory-preconfigured pulse-frequency-modulated (PFM) output.');
  return {ok:true, fam,
    segs:[seg('Q5X','Q5X series'), seg('K','dual discrete + IO-Link'), seg('LAF','laser adjustable field'), seg(rng,'max range '+rng+' mm'), seg('-Q8','rotatable M12 QD')].concat(m[2]?[seg(m[2],'preconfigured variant')]:[]),
    notes, warns:[], mode:'Laser distance — adjustable field (BGS/FGS)', range:minR+' mm – '+(Number(rng)/1000)+' m',
    light:L.L2(650), output:'Dual discrete + IO-Link (Ch1 IO-Link/push-pull, Ch2 PNP/multifunction)',
    supply:'10–30 V DC', conn:'Integral 4-pin M12 QD (rotates 270°)'};
}

function parseQ3X(raw){
  const fam = {family:'Q3X', famName:'Q3X (high-speed laser contrast)', famDesc:'Compact high-speed (250 µs) laser contrast sensor with display, 10–30 V DC.'};
  const m = raw.match(/^Q3XTBLD(50|100|150|200)?-?Q8$/);
  if(!m) return fail(fam, raw, 'This Q3X part number doesn’t match the known nomenclature');
  const cut = {50:'60',100:'120',150:'190',200:'280'}[m[1]];
  const range = m[1] ? ('0–'+m[1]+' mm (BGS cutoff '+cut+' mm)') : '0–300 mm (contrast only, no BGS)';
  return {ok:true, fam,
    segs:[seg('Q3X','Q3X series'), seg('T','standard display housing'), seg('B','bipolar NPN + PNP'), seg('LD'+(m[1]||''), m[1]?'laser diffuse w/ background suppression':'laser diffuse — contrast/intensity'), seg('-Q8','integral 5-pin M12 QD')],
    notes:[], warns:[], mode:'Laser contrast / diffuse' + (m[1]?' with background suppression':''), range,
    light:L.L2(655), output:'Bipolar (1 NPN + 1 PNP)', supply:'10–30 V DC', conn:'Integral 5-pin M12 QD'};
}

function parseS18(raw){
  const fam = {family:'S18-2', famName:'WORLD-BEAM S18-2', famDesc:'18 mm threaded-barrel photoelectric (2nd generation), 10–30 V DC.'};
  const m = raw.match(/^S18-?2(NA|VN|VP)(EL|ES|EJ|RL|RS|LPC|LP|LV|DL|DS|FF30|FF50|FF75|FF100|FF150|FF200)(?:-(2M|9M|Q8|Q5|Q3))?$/);
  if(!m) return fail(fam, raw, 'This S18-2 part number doesn’t match the known nomenclature');
  const [_, oc, mode, cn] = m;
  const mi = S18_MODES[mode];
  const warns=[];
  if(oc==='NA' && !mi.na) warns.push('“NA” (no output) is only used on emitters — check this part number.');
  if(oc!=='NA' && mi.na) warns.push('Emitter modes normally use “NA” (no output) — check this part number.');
  const out = oc==='NA' ? 'None — emitter only' : (oc==='VN'?'NPN (sinking) ×2 — complementary':'PNP (sourcing) ×2 — complementary');
  const CONN = {'2M':'Integral 2 m PVC cable','9M':'Integral 9 m cable','Q8':'Integral 4-pin M12 (Euro) QD','Q5':'150 mm pigtail → 4-pin M12 QD','Q3':'M8 (Pico) QD variant'};
  return {ok:true, fam,
    segs:[seg('S18-2','WORLD-BEAM S18-2 barrel'), seg(oc, oc==='NA'?'no output (emitter)':(oc==='VN'?'NPN complementary':'PNP complementary')), seg(mode, mi.m)].concat(cn?[seg('-'+cn, CONN[cn])]:[]),
    notes: mi.note?[mi.note]:[], warns, mode:mi.m, range:mi.r, light:mi.l,
    output:out, supply:'10–30 V DC', conn: cn?CONN[cn]:'Integral 2 m cable'};
}

function parseQS30(raw){
  const fam = {family:'QS30', famName:'WORLD-BEAM QS30', famDesc:'Long-range rectangular photoelectric, 10–30 V DC, bipolar NPN + PNP outputs.'};
  const S = stripSuffixes(raw.replace(/^QS30/,''), []); // handle W/30 + special on remainder
  let rest = S.pn;
  let conn='';
  if(rest.endsWith('Q5')){ conn='Q5'; rest=rest.slice(0,-2); }
  else if(rest.endsWith('Q') && !QS30_MODES[rest]){ conn='Q'; rest=rest.slice(0,-1); }
  let mi=null, mc=null;
  for(const code of QS30_ORDER){ if(rest===code){ mc=code; mi=QS30_MODES[code]; break; } }
  if(!mi) return fail(fam, raw, 'This QS30 part number doesn’t match the known nomenclature');
  const out = mi.na ? 'None — emitter only' : 'Bipolar (1 NPN + 1 PNP)';
  const CONN = {'':'Integral 2 m cable (5-wire)','Q':'Integral 5-pin M12 (Euro) QD','Q5':'150 mm pigtail → M12 QD'};
  const segs=[seg('QS30','WORLD-BEAM QS30 series'), seg(mc, mi.m)];
  if(conn) segs.push(seg(conn, CONN[conn]));
  if(S.cableFt) segs.push(seg('W/'+S.cableFt, cableText(S.cableFt)));
  return {ok:true, fam, segs, notes: mi.note?[mi.note]:[], warns:[],
    mode:mi.m, range:mi.r, light:mi.l, output:out, supply:'10–30 V DC',
    conn: S.cableFt ? 'Integral ' + cableText(S.cableFt) : CONN[conn]};
}

function parseQ2X(raw){
  const fam = {family:'Q2X', famName:'Q2X (miniature)', famDesc:'Miniature flat-body photoelectric, 10–30 V DC.'};
  // The light-operate/dark-operate letter is optional: the laser measurement models are
  // Q2XKLAF…/Q2XNLAF… with no A/R prefix (p/n 229259).
  const m = raw.match(/^Q2X(A|R)?(B|P|N|K)(FFVS30|FFVS50|FF15|FF30|FF50|FF75|AF150|LAF100|LAF2IR|LAF3IR|LPF|R)(?:-(2M|Q5|Q3|Q))?$/);
  if(!m) return fail(fam, raw, 'This Q2X part number doesn’t match the known nomenclature');
  const lo = m[1], oc = m[2], mode = m[3], cn = m[4];
  const mi = Q2X_MODES[mode];
  const OUT = {B:'Bipolar (1 NPN + 1 PNP)', P:'PNP ×1', N:'NPN ×1',
    K:'Dual channel: IO-Link/PNP + selectable remote input, PNP or PFM'};
  const CONN = {'2M':'Integral 2 m cable','Q':'150 mm pigtail → 4-pin M8 QD','Q3':'150 mm pigtail → 3-pin M8 QD','Q5':'150 mm pigtail → 4-pin M12 QD'};
  const segs=[seg('Q2X','Q2X series')];
  if(lo) segs.push(seg(lo, lo==='A'?'light operate':'dark operate'));
  segs.push(seg(oc, OUT[oc]), seg(mode, mi.m));
  if(cn) segs.push(seg('-'+cn, CONN[cn]));
  return {ok:true, fam, segs, notes:[], warns:[], mode:mi.m, range:mi.r, light:mi.l,
    output:OUT[oc] + (lo ? (' — '+(lo==='A'?'light operate':'dark operate')) : ''), supply:'10–30 V DC',
    conn: cn?CONN[cn]:'Integral 2 m cable'};
}

function parseQ20(raw){
  const fam = {family:'Q20', famName:'WORLD-BEAM Q20', famDesc:'Compact low-cost flat-body photoelectric, 10–30 V DC, single output.'};
  const S = stripSuffixes(raw.replace(/^Q20/,''), ['QPMA','Q7','Q5','Q']);
  let rest = S.pn;
  let m = rest.match(/^(E|EL)$/);
  if(m){
    const em = m[1]==='E' ? {m:'Opposed — emitter (visible red)', r:'12 m beam', l:L.RED(624)} : {m:'Opposed — emitter (infrared)', r:'20 m beam', l:L.IR(850)};
    return {ok:true, fam, segs:[seg('Q20','WORLD-BEAM Q20'), seg(m[1], em.m)].concat(S.conn?[seg(S.conn, QD[S.conn])]:[]),
      notes:[], warns:[], mode:em.m, range:em.r, light:em.l, output:'None — emitter only', supply:'10–30 V DC', conn:connText(S)};
  }
  m = rest.match(/^(P|N)(RL|R|LP|LV|DVS|DXL|DL|D|FF50|FF100|FF150)$/);
  if(!m) return fail(fam, raw, 'This Q20 part number doesn’t match the known nomenclature');
  const mi = Q20_MODES[m[2]];
  return {ok:true, fam,
    segs:[seg('Q20','WORLD-BEAM Q20'), seg(m[1], m[1]==='P'?'PNP output':'NPN output'), seg(m[2], mi.m)].concat(S.conn?[seg(S.conn, QD[S.conn])]:[]).concat(S.cableFt?[seg('W/'+S.cableFt, cableText(S.cableFt))]:[]),
    notes: mi.note?[mi.note]:[], warns:[], mode:mi.m, range:mi.r, light:mi.l,
    output:(m[1]==='P'?'PNP (sourcing) ×1':'NPN (sinking) ×1'), supply:'10–30 V DC', conn:connText(S)};
}

function fail(fam, raw, msg){ return {ok:false, fam, raw, msg}; }

function decodePN(input){
  let s = (input||'').toUpperCase().trim();
  s = s.replace(/[.,;]+$/,'');
  // spaces are cosmetic in Banner PNs (the "W/30" cable suffix survives compaction)
  const c = s.replace(/\s+/g,'');
  if(/^QS18/.test(c) || /^QS186/.test(c)) return parseQS18(c);
  if(/^QS30/.test(c)) return parseQS30(c);
  if(/^S18-?2/.test(c)) return parseS18(c);
  if(/^Q4X/.test(c)) return parseQ4X(c);
  if(/^Q5X/.test(c)) return parseQ5X(c);
  if(/^Q3X/.test(c)) return parseQ3X(c);
  if(/^Q2X/.test(c)) return parseQ2X(c);
  if(/^Q20/.test(c)) return parseQ20(c);
  return null; // not a recognized family
}

/* ================= OCR / TYPO REPAIR =================
   Two passes, both shown to the user on the result card ("read as …"):
   1. Grammar-aware: swap look-alike characters (6↔E/G, 8↔B, 0↔O/D/Q, 1↔I/L,
      5↔S, 2↔Z, 7↔T) a few positions at a time and keep the first variant a
      family parser accepts. The parsers know which slots are digits, so a
      legitimate letter elsewhere is never touched — and it works for numbers
      that are not in the catalog list.
   2. Catalog-aware: weighted edit distance against KNOWN with look-alike swaps
      nearly free. Accepted only when the difference is tiny (one dropped or
      extra character at most) and the match is unambiguous, so an unlisted /
      custom number stays as typed. */
const CONFUSE = {
  O:['0','Q'], D:['0'], Q:['0','O'], I:['1'], L:['1'], Z:['2'], S:['5'], G:['6'], E:['6'], B:['8'], T:['7'],
  '0':['O','D','Q'], '1':['I','L'], '2':['Z'], '5':['S'], '6':['G','E'], '7':['T'], '8':['B']
};
function isConfusable(a,b){ return a!==b && (CONFUSE[a]||[]).includes(b); }
function knownKey(pn){ return pn.toUpperCase().replace(/\s+/g,'').replace(/(W\/?\d+)$/,' $1'); }
function isKnown(pn){ const k = knownKey(pn); return KNOWN.has(k) || KNOWN.has(k.replace(/\s+/g,'')); }

const REPAIR_MAX_FLIPS = 4, REPAIR_MAX_TRIES = 4000;
function grammarRepair(compact){
  const pos = [];
  for(let i=0;i<compact.length;i++) if(CONFUSE[compact[i]]) pos.push(i);
  if(!pos.length) return null;
  const chars = compact.split('');
  let tries = 0;
  for(let k=1; k<=Math.min(REPAIR_MAX_FLIPS, pos.length); k++){
    let known = null, first = null;
    const rec = (start, left) => {
      if(known || tries>REPAIR_MAX_TRIES) return;
      if(left===0){
        tries++;
        const v = chars.join('');
        const r = decodePN(v);
        if(r && r.ok){ if(isKnown(v)) known = {v,r}; else if(!first) first = {v,r}; }
        return;
      }
      for(let i=start; i<=pos.length-left && !known; i++){
        const p = pos[i], orig = chars[p];
        for(const alt of CONFUSE[orig]){ chars[p] = alt; rec(i+1, left-1); if(known) break; }
        chars[p] = orig;
      }
    };
    rec(0, k);
    const hit = known || first;   // same number of swaps: prefer a catalog model
    if(hit) return {res:hit.r, used:hit.v, repaired:true};
    if(tries>REPAIR_MAX_TRIES) break;
  }
  return null;
}

/* Edit distance where look-alike substitutions are nearly free. */
const W_CONF = 0.2, W_INDEL = 0.6, W_SUB = 1;
function wdist(a, b){
  if(Math.abs(a.length-b.length) > 4) return 99;
  const dp = Array.from({length:a.length+1}, (_,i)=>{ const row = new Array(b.length+1).fill(0); row[0] = i*W_INDEL; return row; });
  for(let j=1;j<=b.length;j++) dp[0][j] = j*W_INDEL;
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++){
    const ca = a[i-1], cb = b[j-1];
    const sub = ca===cb ? 0 : (isConfusable(ca,cb) ? W_CONF : W_SUB);
    dp[i][j] = Math.min(dp[i-1][j]+W_INDEL, dp[i][j-1]+W_INDEL, dp[i-1][j-1]+sub);
  }
  return dp[a.length][b.length];
}
function nearestKnown(compact, max){
  const out = [];
  for(const k of KNOWN){
    const d = wdist(compact, k.replace(/\s+/g,''));
    if(d<=max) out.push({k, d});
  }
  return out.sort((x,y)=>x.d-y.d);
}

function decodeFuzzy(input){
  const compact = (input||'').toUpperCase().replace(/[.,;:]+$/,'').replace(/\s+/g,'');
  const r = decodePN(compact);
  if(r && r.ok) return {res:r, used:compact};
  const g = grammarRepair(compact);
  if(g) return g;
  // one dropped / extra character (plus look-alike swaps), only when unambiguous
  const near = nearestKnown(compact, 0.9);
  if(near.length && (near.length===1 || near[0].d < near[1].d)){
    const k = near[0].k.replace(/\s+/g,'');
    const r2 = decodePN(k);
    if(r2 && r2.ok) return {res:r2, used:k, repaired:true};
  }
  return {res:r, used:compact};
}

/* ================= SUGGESTIONS ================= */
function suggestions(pn){
  return nearestKnown(pn.replace(/\s+/g,''), 2.2).slice(0,5).map(x=>x.k);
}
function describeShort(pn){
  const r = decodePN(pn);
  if(r && r.ok) return r.mode + ' · ' + r.range + ' · ' + r.light.label;
  return '';
}

/* ================= DOCUMENTATION LINKS ================= */
function docFor(r){
  const lit = n => 'https://info.bannerengineering.com/cs/groups/public/documents/literature/'+n+'.pdf';
  const f = r.fam.family, fn = r.fam.famName, m = r.mode||'', rng = r.range||'', o = r.output||'';
  switch(f){
    case 'QS18':
      if(/ultrasonic/i.test(fn)) return lit(119287);
      if(/universal voltage/i.test(fn)) return lit(136003);
      if(/Expert/i.test(fn)) return /IO-Link/i.test(o) ? lit(196872) : lit(136564);
      if(/Adjustable-field/i.test(m)){
        if(/LASER/i.test(m)) return lit(66981);
        if(/20–100/.test(rng)) return lit(66981);
        if(/30–120|30–250/.test(rng)) return lit(201339);
        if(/30–300/.test(rng)) return lit(146923);
      }
      if(/Diffuse — LASER/i.test(m)) return lit(118899);
      return lit(197052);
    case 'Q4X':
      if(/Analog/i.test(o)) return lit(185624);
      if(/IO-Link/i.test(o)) return lit(190074);
      return lit(181483);
    case 'Q5X':
      return (r.notes||[]).join(' ').toLowerCase().includes('jam') ? lit(218902) : lit(208794);
    case 'Q3X': return lit(181485);
    case 'S18-2': return lit(170670);
    case 'QS30':
      if(/Polarized/i.test(m) && /LASER/i.test(m)) return lit(112355);
      if(/Diffuse — LASER/i.test(m)) return lit(109027);
      if(/high-power/i.test(m)) return lit(115011);
      return lit(119165);
    case 'Q2X': return /Fixed-field/i.test(m) ? lit(235660) : lit(229259);
    case 'Q20': return lit(127816);
  }
  return null;
}
function bannerSearchUrl(pn){
  return 'https://www.google.com/search?q=' + encodeURIComponent('"'+pn+'" site:bannerengineering.com');
}
