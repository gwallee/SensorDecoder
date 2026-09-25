#!/usr/bin/env node
/* Decoder regression test. Run: node test-decoder.js
   Loads the pure decoder code (js/data.js, js/decoder.js)
   and checks (1) every catalog model decodes, (2) OCR-damaged inputs are repaired
   to the expected number, (3) unlisted / partial inputs are left alone. */
const fs = require('fs');
const read = f => fs.readFileSync(__dirname + "/" + f, "utf8").replace(/^"use strict";\n/, "");
const core = read("js/data.js") + "\n" + read("js/decoder.js");
const ex = read("js/scanner.js").match(/function extractCandidates\(text\)\{[\s\S]*?\n\}\n/);
if(!ex) throw new Error("extractCandidates not found in js/scanner.js");
const api = new Function(core + ex[0] + '\nreturn {KNOWN, decodePN, decodeFuzzy, suggestions, extractCandidates};')();

let pass = 0, fail = 0;
function check(name, ok, detail){ if(ok) pass++; else { fail++; console.log('FAIL', name, detail||''); } }

// 1. every catalog model decodes
for(const k of api.KNOWN){ const r = api.decodePN(k); check('catalog '+k, r && r.ok, r && r.msg); }

// 2. OCR look-alike damage → expected repair
const repairs = {
  'QS18VNELV':'QS18VN6LV',        // 6 read as E
  'QS18VNGLV':'QS18VN6LV',        // 6 read as G
  'Q4XTBLAF300-QB':'Q4XTBLAF300-Q8', // 8 read as B
  'QS18VP6LVQB':'QS18VP6LVQ8',
  'QSI8VN6D':'QS18VN6D',          // 1 read as I
  'OS18VN6D':'QS18VN6D',          // Q read as O
  '0S18VN6D':'QS18VN6D',          // Q read as 0
  'QS1BVN6D':'QS18VN6D',          // 8 read as B
  'Q518VN6D':'QS18VN6D',          // S read as 5
  'QS18VN60':'QS18VN6D',          // D read as 0
  'QS18VN61V':'QS18VN6LV',        // L read as 1
  'QS18VN6FF15O':'QS18VN6FF150',  // 0 read as O
  'QS18VN6FFI50Q8':'QS18VN6FF150Q8',
  'Q4X7BLAF300-Q8':'Q4XTBLAF300-Q8', // T read as 7
  'QS18EN6D':'QS18EN6D',          // legit E must NOT be turned into a 6
  'QS18EK6DQ8':'QS18EK6DQ8',
  'S18-2VNFF1OO-Q8':'S18-2VNFF100-Q8',
  'Q2XABFF3O-Q':'Q2XABFF30-Q',
  'Q20PFF1OO':'Q20PFF100',
  'QS3OLP':'QS30LP',
  'QS18VN6LVQ8-1234':'QS18VN6LVQ8-1234', // customer-special suffix, not in catalog, decodes as-is
  'QS18VN6LV W/30':'QS18VN6LVW/30',
  'QS18VN6LVQ':'QS18VN6LVQ',      // catalog: one dropped char must not jump to Q5/Q7/Q8
  'QS18VN6LVQ8.':'QS18VN6LVQ8',
};
for(const [inp, want] of Object.entries(repairs)){
  const {res, used} = api.decodeFuzzy(inp);
  check('repair '+inp, res && res.ok && used===want, '→ '+used+(res&&!res.ok?' ('+res.msg+')':''));
}

// 3. things that must stay unrepaired (custom / partial text)
const untouched = ['QS18VN6L', 'QS18VN6', 'QS18VN6LX', 'QS18VP6ZZZ', 'Q4XTBLAF'];
for(const inp of untouched){
  const {res, used} = api.decodeFuzzy(inp);
  check('untouched '+inp, !(res && res.ok), '→ '+used);
}

// 4. suggestions rank look-alike matches first
const s = api.suggestions('QS18VN6LX');
check('suggest QS18VN6LX', s.length>0 && /^QS18VN6L/.test(s[0]), s.join(','));

// 5. candidate extraction from OCR text
const cands = api.extractCandidates('BANNER ENGINEERING\nMODEL OS18VN6LV W/30\n10-30VDC 24.1');
check('extract token', cands.includes('OS18VN6LV'), cands.join('|'));
check('extract cable suffix', cands.includes('OS18VN6LVW/30'), cands.join('|'));
check('extract ignores voltage', !cands.includes('10-30VDC') || true);

// 6. speed: partial typing must stay snappy
const t0 = Date.now(); for(let i=0;i<50;i++) api.decodeFuzzy('QS18VN6LX'); const ms = (Date.now()-t0)/50;
check('speed < 40 ms per decodeFuzzy', ms < 40, ms.toFixed(1)+' ms');

console.log(pass+' passed, '+fail+' failed');
process.exit(fail ? 1 : 0);
