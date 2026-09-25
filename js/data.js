"use strict";
/* Banner data tables: light-source helpers, per-family mode codes, connectors, known catalog models */
/* ================= LIGHT SOURCE HELPERS ================= */
const L = {
  IR: (nm) => ({kind:'ir', label:'Infrared LED', detail:(nm?nm+' nm · ':'')+'invisible beam'}),
  RED: (nm) => ({kind:'red', label:'Visible red LED', detail:(nm?nm+' nm · visible beam':'visible beam')}),
  L1: (nm) => ({kind:'laser', label:'LASER · Class 1', detail:(nm||655)+' nm visible red'}),
  L2: (nm) => ({kind:'laser', label:'LASER · Class 2', detail:(nm||655)+' nm visible red'}),
  US: () => ({kind:'us', label:'Ultrasonic', detail:'sound waves — no light'}),
  UNK: () => ({kind:'unk', label:'See datasheet', detail:'light source varies'})
};

/* ================= QS18 DATA ================= */
const QS18_MODES = {
  R:    {m:'Opposed (through-beam) — receiver', r:'20 m', l:L.IR(940), note:'Pairs with QS186E / QS186EV / QS186LE emitter'},
  RB:   {m:'Opposed (through-beam) — short-range receiver', r:'3 m', l:L.IR(940), note:'Pairs with QS186EB emitter'},
  LV:   {m:'Retroreflective (non-polarized)', r:'6.5 m', l:L.RED(628)},
  LP:   {m:'Polarized retroreflective', r:'3.5 m', re:'3.5 m', l:L.RED(630)},
  LLP:  {m:'Polarized retroreflective — LASER', r:'0.1–10 m', l:L.L1(650)},
  XLP:  {m:'Clear object detection (coaxial polarized retro)', r:'3 m', l:L.RED(625)},
  XLPC: {m:'Clear object detection — TEACH', r:'3 m', l:L.RED(625), expertOnly:true},
  CV15: {m:'Convergent beam', r:'16 mm focus', l:L.RED(630)},
  CV45: {m:'Convergent beam', r:'43 mm focus', l:L.RED(630)},
  D:    {m:'Diffuse (proximity)', r:'450 mm', re:'800 mm', l:L.IR(940)},
  DB:   {m:'Diffuse — flush front lens', r:'450 mm', re:'500 mm', l:L.IR(940)},
  DL:   {m:'Diffuse — long range', r:'600 mm', l:L.IR(940)},
  DVS:  {m:'Diffuse — visible spot', r:'250 mm', l:L.RED(630)},
  DV:   {m:'Diffuse — visible red', r:'600 mm', l:L.RED(660), expertOnly:true},
  W:    {m:'Divergent diffuse (wide beam)', r:'100 mm', re:'300 mm', l:L.IR(940)},
  DXL:  {m:'Diffuse — extended range', r:'1 m', l:L.IR(850), wOnly:true},
  FF50: {m:'Fixed-field (background suppression)', r:'50 mm cutoff', l:L.RED(630)},
  FF100:{m:'Fixed-field (background suppression)', r:'100 mm cutoff', l:L.RED(630)},
  FF125:{m:'Fixed-field (background suppression)', r:'125 mm cutoff', l:L.RED(630), note:'Catalog models are PNP only'},
  FF150:{m:'Fixed-field (background suppression)', r:'150 mm cutoff', l:L.RED(630)},
  AF100:{m:'Adjustable-field background suppression', r:'cutoff adj. 20–100 mm', l:L.RED(660)},
  AF120:{m:'Adjustable-field background suppression', r:'cutoff adj. 30–120 mm', l:L.RED(640)},
  AF250:{m:'Adjustable-field background suppression', r:'cutoff adj. 30–250 mm', l:L.RED(640)},
  AF300:{m:'Adjustable-field background suppression', r:'cutoff adj. 30–300 mm', l:L.RED(640)},
  LAF250:{m:'Adjustable-field BGS — LASER', r:'cutoff adj. 50–250 mm', l:L.L2(658)},
  LAF:  {m:'Adjustable-field BGS — LASER', r:'cutoff adj. 30–150 mm', l:L.L1(650)},
  LD:   {m:'Diffuse — LASER', r:'300 mm (≈1 mm spot at focus)', l:L.L1(650)},
  F:    {m:'Fiber-optic amplifier — glass fibers', r:'depends on fiber', l:L.IR(940)},
  FP:   {m:'Fiber-optic amplifier — plastic fibers', r:'depends on fiber', l:L.RED(660)}
};
const QS18_MODE_ORDER = ['LAF250','XLPC','AF100','AF120','AF250','AF300','FF100','FF125','FF150','LLP','LAF','XLP','CV15','CV45','DVS','DXL','FF50','DB','DL','DV','LD','LP','LV','RB','FP','F','D','R','W'];
const QS18_EMITTERS = {
  E:  {m:'Opposed (through-beam) — emitter', r:'20 m beam', l:L.IR(940)},
  EV: {m:'Opposed — emitter, visible', r:'20 m beam', l:L.RED(624)},
  EB: {m:'Opposed — short-range emitter', r:'3 m beam', l:L.IR(940)},
  LE: {m:'Opposed — LASER emitter', r:'up to 30 m beam', l:L.L1(650), note:'Small precise spot'}
};
const QS18_OUT = {
  VN:'NPN (sinking) ×2 — complementary NO + NC',
  VP:'PNP (sourcing) ×2 — complementary NO + NC',
  EN:'NPN — Expert TEACH (button + remote teach)',
  EP:'PNP — Expert TEACH (button + remote teach)',
  EK:'IO-Link + push-pull — Expert TEACH',
  K :'IO-Link (smart sensor profile)',
  AB:'Bipolar (1 NPN + 1 PNP) — light operate',
  RB:'Bipolar (1 NPN + 1 PNP) — dark operate'
};
const QS18_EXPERT_OK = new Set(['D','DB','W','DV','LP','XLPC','CV15','CV45','FP','F','AF120','AF250']);
/* Expert IO-Link opposed-mode pairs — QS18EK6E/EV emitters, QS18EK6R/RV receivers (p/n 196872) */
const QS18_EK_OPPOSED = {
  E:  {m:'Opposed (through-beam) — emitter', r:'20 m beam', l:L.IR(), emitter:true},
  EV: {m:'Opposed — emitter, visible red',   r:'20 m beam', l:L.RED(), emitter:true},
  R:  {m:'Opposed (through-beam) — receiver', r:'20 m', l:L.IR(),  note:'Pairs with the QS18EK6E emitter'},
  RV: {m:'Opposed — receiver, visible red',   r:'20 m', l:L.RED(), note:'Pairs with the QS18EK6EV emitter'}
};
const QD = {
  '':'Integral 2 m PVC cable',
  Q:'150 mm pigtail → 4-pin M8 (Pico) QD',
  Q5:'150 mm pigtail → 4-pin M12 (Euro) QD',
  Q7:'Integral 4-pin M8 (Pico) QD',
  Q8:'Integral 4-pin M12 (Euro) QD',
  Q9:'Integral 4-pin M8 QD (snap-fit)',
  Q1:'Special-order connector variant',
  Q2:'150 mm pigtail → 4-pin ½"-20UNF QD',
  C1:'2 m 600 V-rated PVC cable',
  QPMA:'150 mm PUR pigtail → 4-pin M12 QD'
};

/* ================= OTHER FAMILY DATA ================= */
/* Every S18-2 model uses a visible red emitter LED (p/n 170670 — "Emitter LED: Visible Red");
   the manual does not publish a wavelength. */
const S18_MODES = {
  EL:{m:'Opposed — emitter', r:'25 m beam', l:L.RED(), na:true},
  ES:{m:'Opposed — emitter with power adjust', r:'25 m beam', l:L.RED(), na:true},
  EJ:{m:'Opposed — emitter with beam-inhibit input', r:'25 m beam', l:L.RED(), na:true},
  RL:{m:'Opposed — receiver', r:'25 m', l:L.RED()},
  RS:{m:'Opposed — receiver with sensitivity pot', r:'25 m', l:L.RED()},
  LPC:{m:'Polarized retroreflective (with pot)', r:'6 m', l:L.RED(), note:'Range specified with a BRT-84 reflector'},
  LP:{m:'Polarized retroreflective', r:'6 m', l:L.RED(), note:'Range specified with a BRT-84 reflector'},
  LV:{m:'Retroreflective (non-polarized, with adjust)', r:'7.5 m', l:L.RED(), note:'Range specified with a BRT-84 reflector'},
  DL:{m:'Diffuse — long range (with adjust)', r:'750 mm', l:L.RED()},
  DS:{m:'Diffuse — short range (with pot)', r:'300 mm', l:L.RED()},
  FF30:{m:'Fixed-field (background suppression)', r:'30 mm cutoff', l:L.RED()},
  FF50:{m:'Fixed-field (background suppression)', r:'50 mm cutoff', l:L.RED()},
  FF75:{m:'Fixed-field (background suppression)', r:'75 mm cutoff', l:L.RED()},
  FF100:{m:'Fixed-field (background suppression)', r:'100 mm cutoff', l:L.RED()},
  FF150:{m:'Fixed-field (background suppression)', r:'150 mm cutoff', l:L.RED()},
  FF200:{m:'Fixed-field (background suppression)', r:'200 mm cutoff', l:L.RED()}
};
const QS30_MODES = {
  ELVC:{m:'Clear object detection — retro, TEACH', r:'100 mm – 2 m', l:L.RED(660), note:'“Expert” TEACH model'},
  EXH2O:{m:'Opposed — high-power emitter, water detection', r:'213 m beam', l:L.IR(), na:true},
  LLPC:{m:'Polarized retro — LASER, low-contrast TEACH', r:'0.2–18 m', l:L.L1(), note:'For small / partial-beam targets, thread break'},
  AFF400:{m:'Adjustable foreground suppression', r:'400 mm', l:L.RED()},
  FF200:{m:'Fixed-field (background suppression)', r:'200 mm cutoff', l:L.RED(680)},
  FF400:{m:'Fixed-field (background suppression)', r:'400 mm cutoff', l:L.RED(680)},
  FF600:{m:'Fixed-field (background suppression)', r:'600 mm cutoff', l:L.RED(680)},
  AF600:{m:'Adjustable-field background suppression', r:'cutoff adj. 50–600 mm', l:L.RED()},
  EDV:{m:'Diffuse — visible red, TEACH', r:'≈1.4 m', l:L.RED(), note:'“Expert” TEACH model'},
  ARX:{m:'Opposed — high-power receiver (light operate)', r:'213 m', l:L.IR()},
  RRX:{m:'Opposed — high-power receiver (dark operate)', r:'213 m', l:L.IR()},
  LLP:{m:'Polarized retroreflective — LASER', r:'0.2–18 m', l:L.L1()},
  LDL:{m:'Diffuse — LASER, long range', r:'800 mm', l:L.L2()},
  EX:{m:'Opposed — high-power emitter', r:'213 m beam', l:L.IR(), na:true},
  LD:{m:'Diffuse — LASER', r:'400 mm', l:L.L1()},
  LP:{m:'Polarized retroreflective', r:'8 m', l:L.RED(630)},
  LV:{m:'Retroreflective (non-polarized)', r:'12 m', l:L.RED(630)},
  AF:{m:'Adjustable-field background suppression', r:'cutoff adj. 50–300 mm', l:L.RED()},
  E:{m:'Opposed — emitter', r:'60 m beam', l:L.IR(875), na:true},
  R:{m:'Opposed — receiver', r:'60 m', l:L.IR(875)},
  D:{m:'Diffuse (proximity)', r:'1 m', l:L.IR(940)}
};
const QS30_ORDER = ['ELVC','EXH2O','LLPC','AFF400','FF200','FF400','FF600','AF600','EDV','ARX','RRX','LLP','LDL','EX','LD','LP','LV','AF','E','R','D'];
const Q2X_MODES = {
  FFVS30:{m:'Fixed-field BGS — small variable spot', r:'30 mm cutoff', l:L.RED(645)},
  FFVS50:{m:'Fixed-field BGS — small variable spot', r:'50 mm cutoff', l:L.RED(645)},
  FF15:{m:'Fixed-field (background suppression)', r:'15 mm cutoff', l:L.RED(645)},
  FF30:{m:'Fixed-field (background suppression)', r:'30 mm cutoff', l:L.RED(645)},
  FF50:{m:'Fixed-field (background suppression)', r:'50 mm cutoff', l:L.RED(645)},
  FF75:{m:'Fixed-field (background suppression)', r:'75 mm cutoff', l:L.RED(645)},
  AF150:{m:'Adjustable-field background suppression', r:'cutoff adj. 18–150 mm', l:L.RED()},
  LAF100:{m:'Adjustable-field BGS — LASER', r:'cutoff adj. 18–100 mm', l:L.L1()},
  LAF2IR:{m:'Laser measurement — infrared', r:'20–2000 mm', l:{kind:'laser', label:'LASER · Class 1 (IR)', detail:'infrared — invisible beam'}},
  LAF3IR:{m:'Laser measurement — infrared', r:'20–3000 mm', l:{kind:'laser', label:'LASER · Class 1 (IR)', detail:'infrared — invisible beam'}},
  LPF:{m:'Polarized retroreflective', r:'see datasheet', l:L.RED()},
  R:{m:'Opposed — receiver', r:'3 m', l:L.RED()}
};
const Q20_MODES = {
  RL:{m:'Opposed — receiver (long range)', r:'20 m', l:L.IR(850), note:'Pairs with Q20EL emitter'},
  R:{m:'Opposed — receiver', r:'12 m', l:L.RED(624), note:'Pairs with Q20E emitter'},
  LP:{m:'Polarized retroreflective', r:'4 m', l:L.RED(645), note:'Range specified with a BRT-84 reflector'},
  LV:{m:'Retroreflective (non-polarized)', r:'6 m', l:L.RED(645), note:'Range specified with a BRT-84 reflector'},
  DVS:{m:'Diffuse — small visible spot', r:'250 mm', l:L.RED(660)},
  DXL:{m:'Diffuse — extra-long range', r:'1.5 m', l:L.IR(850)},
  DL:{m:'Diffuse — long range', r:'800 mm', l:L.RED(624)},
  D:{m:'Diffuse (proximity)', r:'250 mm', l:L.RED(624)},
  FF50:{m:'Fixed-field (background suppression)', r:'50 mm cutoff', l:L.RED(655)},
  FF100:{m:'Fixed-field (background suppression)', r:'100 mm cutoff', l:L.RED(655)},
  FF150:{m:'Fixed-field (background suppression)', r:'150 mm cutoff', l:L.RED(655)}
};

/* ================= KNOWN CATALOG MODELS ================= */
/* Catalog models pulled from the Banner product manuals linked in the footer.
   Comma-separated because cable-length suffixes contain a space ("QS18VP6LV W/30"). */
const KNOWN = new Set((
  "Q20E,Q20EL,Q20EQ5,Q20EQ7,Q20EQPMA,Q20NDL,Q20NDVS,Q20NDXL,Q20NFF100,Q20NFF150,Q20NFF50,Q20NLP,Q20NLV,Q20NR,"+
  "Q20NRL,Q20PDL,Q20PDVS,Q20PDXL,Q20PFF100,Q20PFF150,Q20PFF50,Q20PLP,Q20PLPQ7,Q20PLV,Q20PR,Q20PRL,"+
  "Q2XABAF150-Q5,Q2XABFF15-Q,Q2XABFF30-Q,Q2XABFF50-Q,Q2XABFF75-Q,Q2XABFFVS30-Q,Q2XABFFVS50-Q,Q2XABLAF100-Q5,"+
  "Q2XAPLPF-Q3,Q2XAPR-Q3,Q2XKLAF2IR-Q,Q2XKLAF2IR-Q5,Q2XKLAF3IR-Q,Q2XKLAF3IR-Q5,Q2XNLAF2IR-Q,Q2XNLAF3IR-Q,"+
  "Q2XRBAF150-Q5,Q2XRPAF150-2M,Q3XTBLD-Q8,Q3XTBLD100-Q8,Q3XTBLD150-Q8,Q3XTBLD200-Q8,Q3XTBLD50-Q8,"+
  "Q4XFILAF110-Q8,Q4XFILAF310-Q8,Q4XFILAF610-Q8,Q4XFKLAF110-Q8,Q4XFKLAF310-Q8,Q4XFKLAF610-Q8,Q4XFNLAF110-Q8,"+
  "Q4XFNLAF310-Q8,Q4XFPCOD310-Q8,Q4XFPLAF110-Q8,Q4XFPLAF310-Q8,Q4XFULAF110-Q8,Q4XFULAF310-Q8,Q4XFULAF610-Q8,"+
  "Q4XTBCOD300-Q8,Q4XTBLAF100-Q8,Q4XTBLAF300-Q8,Q4XTBLAF500-Q8,Q4XTILAF100-Q8,Q4XTILAF300-Q8,Q4XTILAF500-Q8,"+
  "Q4XTILAF600-Q8,Q4XTKLAF100-Q8,Q4XTKLAF300-Q8,Q4XTKLAF600-Q8,Q4XTULAF100-Q8,Q4XTULAF300-Q8,Q4XTULAF500-Q8,"+
  "Q4XTULAF600-Q8,Q5XKLAF10000-Q8,Q5XKLAF2000-Q8,Q5XKLAF2000-Q8-JAM,Q5XKLAF2000-Q8-PFM,Q5XKLAF3000-Q8,"+
  "Q5XKLAF5000-Q8,QS186E,QS186E W/30,QS186EB,QS186EB W/30,QS186EBQ,QS186EBQ5,QS186EBQ7,QS186EBQ8,QS186EQ,"+
  "QS186EQ5,QS186EQ7,QS186EQ8,QS186EV,QS186EV W/30,QS186EVQ,QS186EVQ5,QS186EVQ7,QS186EVQ8,QS186LE,QS186LEQ8,"+
  "QS18AB6AF300,QS18ANWDLQ2,QS18ANWDXL,QS18ANWDXLQ2,QS18ANWLP,QS18ANWLPQ2,QS18ANWLV,QS18ANWLV W/30,QS18ANWLVQ2,"+
  "QS18ANWR,QS18APWDL,QS18APWDL W/30,QS18APWDLC1,QS18APWDLQ2,QS18APWDXL,QS18APWDXL W/30,QS18APWDXLQ2,QS18APWLP,"+
  "QS18APWLPC1,QS18APWLPQ2,QS18APWLV,QS18APWLV W/30,QS18APWLVC1 W/30,QS18APWLVQ2,QS18APWR,QS18APWR W/30,"+
  "QS18APWRC1,QS18APWRQ2,QS18EK6CV15Q,QS18EK6CV15Q5,QS18EK6CV15Q7,QS18EK6CV15Q8,QS18EK6CV45Q,QS18EK6CV45Q5,"+
  "QS18EK6CV45Q7,QS18EK6CV45Q8,QS18EK6DQ,QS18EK6DQ5,QS18EK6DQ7,QS18EK6DQ8,QS18EK6DVQ,QS18EK6DVQ5,QS18EK6DVQ7,"+
  "QS18EK6DVQ8,QS18EK6E,QS18EK6EV,QS18EK6FPQ,QS18EK6FPQ5,QS18EK6FPQ7,QS18EK6FPQ8,QS18EK6LPQ,QS18EK6LPQ5,"+
  "QS18EK6LPQ7,QS18EK6LPQ8,QS18EK6R,QS18EK6RV,QS18EK6XLPC,QS18EN6CV15,QS18EN6CV45,QS18EN6D,QS18EN6DB,QS18EN6DV,"+
  "QS18EN6FP,QS18EN6FP W/30,QS18EN6FPQ,QS18EN6FPQ5,QS18EN6FPQ7,QS18EN6FPQ8,QS18EN6LP,QS18EN6LPQ8,QS18EN6W,"+
  "QS18EN6XLPC,QS18EP6CV15,QS18EP6CV45,QS18EP6D,QS18EP6DB,QS18EP6DQ8,QS18EP6DV,QS18EP6DVQ5,QS18EP6FP,QS18EP6LP,"+
  "QS18EP6LPQ8,QS18EP6W,QS18EP6XLPC,QS18K6AF120Q,QS18K6AF120Q5,QS18K6AF120Q7,QS18K6AF120Q8,QS18K6AF250Q,"+
  "QS18K6AF250Q5,QS18K6AF250Q7,QS18K6AF250Q8,QS18RB6LPQ8,QS18RNWDL,QS18RNWDXL,QS18RNWDXL W/30,QS18RNWLP,"+
  "QS18RNWLP W/30,QS18RNWLPQ2,QS18RNWLV,QS18RNWR,QS18RNWRQ2,QS18RPWDL,QS18RPWDL W/30,QS18RPWDLQ2,QS18RPWDXL,"+
  "QS18RPWDXL W/30,QS18RPWDXLQ2,QS18RPWLP,QS18RPWLP W/30,QS18RPWLPQ2,QS18RPWLV,QS18RPWLVQ2,QS18RPWR,"+
  "QS18RPWR W/30,QS18RPWRQ2,QS18UNA,QS18UNA W/30,QS18UNAE,QS18UNAEQ7,QS18UNAQ,QS18UNAQ5,QS18UNAQ7,QS18UNAQ8,"+
  "QS18UPA,QS18UPAE,QS18UPAE W/30,QS18UPAEQ7,QS18UPAQ8,QS18VN6AF100,QS18VN6AF100Q,QS18VN6AF100Q5,QS18VN6AF120,"+
  "QS18VN6AF120 W/30,QS18VN6AF250,QS18VN6AF250 W/30,QS18VN6AF250Q,QS18VN6AF250Q5,QS18VN6AF250Q7,QS18VN6AF250Q8,"+
  "QS18VN6AF300,QS18VN6AF300 W/30,QS18VN6AF300Q,QS18VN6AF300Q5,QS18VN6CV15,QS18VN6CV15 W/30,QS18VN6CV15Q,"+
  "QS18VN6CV15Q5,QS18VN6CV15Q7,QS18VN6CV15Q8,QS18VN6CV45,QS18VN6CV45 W/30,QS18VN6CV45Q,QS18VN6CV45Q5,"+
  "QS18VN6CV45Q7,QS18VN6CV45Q8,QS18VN6D,QS18VN6D W/30,QS18VN6DB,QS18VN6DB W/30,QS18VN6DBQ,QS18VN6DBQ5,"+
  "QS18VN6DBQ7,QS18VN6DBQ8,QS18VN6DL,QS18VN6DL W/30,QS18VN6DLQ,QS18VN6DLQ5,QS18VN6DLQ7,QS18VN6DLQ8,QS18VN6DQ,"+
  "QS18VN6DQ5,QS18VN6DQ7,QS18VN6DQ8,QS18VN6DVS,QS18VN6DVS W/30,QS18VN6DVSQ,QS18VN6DVSQ5,QS18VN6DVSQ7,"+
  "QS18VN6DVSQ8,QS18VN6F,QS18VN6F W/30,QS18VN6FF100,QS18VN6FF100 W/30,QS18VN6FF100Q,QS18VN6FF100Q5,"+
  "QS18VN6FF100Q7,QS18VN6FF100Q8,QS18VN6FF150,QS18VN6FF150 W/30,QS18VN6FF150Q,QS18VN6FF150Q5,QS18VN6FF150Q7,"+
  "QS18VN6FF150Q8,QS18VN6FF50,QS18VN6FF50 W/30,QS18VN6FF50Q,QS18VN6FF50Q5,QS18VN6FF50Q7,QS18VN6FF50Q8,"+
  "QS18VN6FP,QS18VN6FP W/30,QS18VN6FPQ,QS18VN6FPQ5,QS18VN6FPQ7,QS18VN6FPQ8,QS18VN6FQ,QS18VN6FQ5,QS18VN6FQ7,"+
  "QS18VN6LAF,QS18VN6LAF250,QS18VN6LD,QS18VN6LD W/30,QS18VN6LDQ,QS18VN6LDQ5,QS18VN6LDQ7,QS18VN6LDQ8,QS18VN6LLP,"+
  "QS18VN6LLPQ8,QS18VN6LP,QS18VN6LP W/30,QS18VN6LPQ,QS18VN6LPQ5,QS18VN6LPQ7,QS18VN6LPQ8,QS18VN6LV,"+
  "QS18VN6LV W/30,QS18VN6LVQ,QS18VN6LVQ5,QS18VN6LVQ7,QS18VN6LVQ8,QS18VN6R,QS18VN6R W/30,QS18VN6RB,"+
  "QS18VN6RB W/30,QS18VN6RBQ,QS18VN6RBQ5,QS18VN6RBQ7,QS18VN6RBQ8,QS18VN6RQ,QS18VN6RQ5,QS18VN6RQ7,QS18VN6RQ8,"+
  "QS18VN6W,QS18VN6W W/30,QS18VN6WQ,QS18VN6WQ5,QS18VN6WQ7,QS18VN6WQ8,QS18VN6XLP,QS18VP6AF100,QS18VP6AF100Q5,"+
  "QS18VP6AF120,QS18VP6AF250,QS18VP6AF250 W/30,QS18VP6AF250Q8,QS18VP6AF300,QS18VP6CV15,QS18VP6CV15 W/30,"+
  "QS18VP6CV15Q,QS18VP6CV15Q5,QS18VP6CV15Q7,QS18VP6CV15Q8,QS18VP6CV45,QS18VP6CV45Q,QS18VP6CV45Q5,QS18VP6CV45Q7,"+
  "QS18VP6CV45Q8,QS18VP6D,QS18VP6D W/30,QS18VP6DB,QS18VP6DB W/30,QS18VP6DBQ,QS18VP6DBQ5,QS18VP6DBQ7,"+
  "QS18VP6DBQ8,QS18VP6DL,QS18VP6DL W/30,QS18VP6DLQ,QS18VP6DLQ5,QS18VP6DLQ7,QS18VP6DLQ8,QS18VP6DQ,QS18VP6DQ7,"+
  "QS18VP6DQ8,QS18VP6DVS,QS18VP6DVS W/30,QS18VP6DVSQ,QS18VP6DVSQ5,QS18VP6DVSQ7,QS18VP6DVSQ8,QS18VP6F,"+
  "QS18VP6F W/30,QS18VP6FF100,QS18VP6FF100Q9,QS18VP6FF125,QS18VP6FF150,QS18VP6FF150 W/30,QS18VP6FF150Q,"+
  "QS18VP6FF150Q5,QS18VP6FF150Q7,QS18VP6FF150Q8,QS18VP6FF50,QS18VP6FF50 W/30,QS18VP6FF50Q,QS18VP6FF50Q5,"+
  "QS18VP6FF50Q7,QS18VP6FF50Q8,QS18VP6FP,QS18VP6FP W/30,QS18VP6FPQ,QS18VP6FPQ5,QS18VP6FPQ7,QS18VP6FPQ8,"+
  "QS18VP6FQ,QS18VP6FQ5,QS18VP6FQ8,QS18VP6LAF,QS18VP6LAF250,QS18VP6LAF250Q,QS18VP6LD,QS18VP6LD W/30,QS18VP6LLP,"+
  "QS18VP6LLPQ8,QS18VP6LP,QS18VP6LP W/30,QS18VP6LPQ,QS18VP6LPQ5,QS18VP6LPQ7,QS18VP6LPQ8,QS18VP6LV,"+
  "QS18VP6LV W/10,QS18VP6LV W/30,QS18VP6LVQ,QS18VP6LVQ5,QS18VP6LVQ7,QS18VP6LVQ8,QS18VP6R,QS18VP6R W/30,"+
  "QS18VP6RB,QS18VP6RBQ,QS18VP6RBQ5,QS18VP6RBQ7,QS18VP6RBQ8,QS18VP6RQ,QS18VP6RQ5,QS18VP6RQ7,QS18VP6RQ8,"+
  "QS18VP6W,QS18VP6W W/30,QS18VP6WQ,QS18VP6WQ5,QS18VP6WQ7,QS18VP6WQ8,QS18VP6XLP,QS18VP6XLPQ8,QS18WE,"+
  "QS18WE W/30,QS18WEC1,QS18WEC1 W/30,QS18WEQ2,QS30AF600Q,QS30ARX,QS30ARXQ,QS30D,QS30DQ,QS30E,QS30E W/30,"+
  "QS30ELVC,QS30ELVCQ,QS30ELVCQ5,QS30EQ,QS30EX,QS30EX W/30,QS30EXQ,QS30FF200,QS30FF400,QS30FF600,QS30LD,"+
  "QS30LDL,QS30LDLQ,QS30LDQ,QS30LLP,QS30LLP W/30,QS30LLPC,QS30LLPCQ,QS30LLPQ,QS30LP,QS30LPQ,QS30LV,QS30LVQ,"+
  "QS30R,QS30RQ,QS30RRX,QS30RRXQ,S18-2NAEJ-2M,S18-2NAEJ-9M,S18-2NAEJ-Q3,S18-2NAEJ-Q5,S18-2NAEJ-Q8,S18-2NAEL-2M,"+
  "S18-2NAEL-9M,S18-2NAEL-Q3,S18-2NAEL-Q5,S18-2NAEL-Q8,S18-2NAES-2M,S18-2NAES-9M,S18-2NAES-Q3,S18-2NAES-Q5,"+
  "S18-2NAES-Q8,S18-2VNDL-2M,S18-2VNDL-9M,S18-2VNDL-Q3,S18-2VNDL-Q5,S18-2VNDL-Q8,S18-2VNDS-2M,S18-2VNDS-9M,"+
  "S18-2VNDS-Q3,S18-2VNDS-Q5,S18-2VNDS-Q8,S18-2VNFF100-2M,S18-2VNFF100-9M,S18-2VNFF100-Q3,S18-2VNFF100-Q5,"+
  "S18-2VNFF100-Q8,S18-2VNFF150-2M,S18-2VNFF150-9M,S18-2VNFF150-Q3,S18-2VNFF150-Q5,S18-2VNFF150-Q8,"+
  "S18-2VNFF200-2M,S18-2VNFF200-9M,S18-2VNFF200-Q3,S18-2VNFF200-Q5,S18-2VNFF200-Q8,S18-2VNFF30-2M,"+
  "S18-2VNFF30-9M,S18-2VNFF30-Q3,S18-2VNFF30-Q5,S18-2VNFF30-Q8,S18-2VNFF50-2M,S18-2VNFF50-9M,S18-2VNFF50-Q3,"+
  "S18-2VNFF50-Q5,S18-2VNFF50-Q8,S18-2VNFF75-2M,S18-2VNFF75-9M,S18-2VNFF75-Q3,S18-2VNFF75-Q5,S18-2VNFF75-Q8,"+
  "S18-2VNLP-2M,S18-2VNLP-9M,S18-2VNLP-Q3,S18-2VNLP-Q5,S18-2VNLP-Q8,S18-2VNLPC-2M,S18-2VNLPC-9M,S18-2VNLPC-Q3,"+
  "S18-2VNLPC-Q5,S18-2VNLPC-Q8,S18-2VNLV-2M,S18-2VNLV-9M,S18-2VNLV-Q3,S18-2VNLV-Q5,S18-2VNLV-Q8,S18-2VNRL-2M,"+
  "S18-2VNRL-9M,S18-2VNRL-Q3,S18-2VNRL-Q5,S18-2VNRL-Q8,S18-2VNRS-2M,S18-2VNRS-9M,S18-2VNRS-Q3,S18-2VNRS-Q5,"+
  "S18-2VNRS-Q8,S18-2VPDL-2M,S18-2VPDL-9M,S18-2VPDL-Q3,S18-2VPDL-Q5,S18-2VPDL-Q8,S18-2VPDS-2M,S18-2VPDS-9M,"+
  "S18-2VPDS-Q3,S18-2VPDS-Q5,S18-2VPDS-Q8,S18-2VPFF100-2M,S18-2VPFF100-9M,S18-2VPFF100-Q3,S18-2VPFF100-Q5,"+
  "S18-2VPFF100-Q8,S18-2VPFF150-2M,S18-2VPFF150-9M,S18-2VPFF150-Q3,S18-2VPFF150-Q5,S18-2VPFF150-Q8,"+
  "S18-2VPFF200-2M,S18-2VPFF200-9M,S18-2VPFF200-Q3,S18-2VPFF200-Q5,S18-2VPFF200-Q8,S18-2VPFF30-2M,"+
  "S18-2VPFF30-9M,S18-2VPFF30-Q3,S18-2VPFF30-Q5,S18-2VPFF30-Q8,S18-2VPFF50-2M,S18-2VPFF50-9M,S18-2VPFF50-Q3,"+
  "S18-2VPFF50-Q5,S18-2VPFF50-Q8,S18-2VPFF75-2M,S18-2VPFF75-9M,S18-2VPFF75-Q3,S18-2VPFF75-Q5,S18-2VPFF75-Q8,"+
  "S18-2VPLP-2M,S18-2VPLP-9M,S18-2VPLP-Q3,S18-2VPLP-Q5,S18-2VPLP-Q8,S18-2VPLPC-2M,S18-2VPLPC-9M,S18-2VPLPC-Q3,"+
  "S18-2VPLPC-Q5,S18-2VPLPC-Q8,S18-2VPLV-2M,S18-2VPLV-9M,S18-2VPLV-Q3,S18-2VPLV-Q5,S18-2VPLV-Q8,S18-2VPRL-2M,"+
  "S18-2VPRL-9M,S18-2VPRL-Q3,S18-2VPRL-Q5,S18-2VPRL-Q8,S18-2VPRS-2M,S18-2VPRS-9M,S18-2VPRS-Q3,S18-2VPRS-Q5,"+
  "S18-2VPRS-Q8"
).split(/,/));
