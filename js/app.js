"use strict";
/* App UI: rendering, history, catalog browser, find-by-style */
/* ================= RENDER ================= */
const outEl = document.getElementById('out');
const pnEl = document.getElementById('pn');
const clearBtn = document.getElementById('clearbtn');
const histEl = document.getElementById('hist');
function loadHist(){ try{ const v = JSON.parse(localStorage.getItem('bannerpn_hist')||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
function saveHist(){ try{ localStorage.setItem('bannerpn_hist', JSON.stringify(history)); }catch(e){} }
let history = loadHist();
let histTimer = null;
let scanRaw = null;   // what the camera actually read, when the value in the box came from a scan

function esc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

function render(){
  const q = pnEl.value.trim();
  clearBtn.style.display = q ? 'flex' : 'none';
  if(!q){
    outEl.innerHTML = '<div class="card empty"><div class="big">⌖</div>Type a Banner part number or tap <b>Scan</b> to read the label with your camera.<br><br>Try: <b>QS18VN6LV</b>, <b>QS18VP6LD</b>, <b>Q4XTBLAF300-Q8</b></div>';
    return;
  }
  // Decode first — decodeFuzzy repairs OCR/typo prefixes such as QSI8 → QS18, which
  // a prefix test on the raw text would reject before it ever got a chance.
  const {res, used} = decodeFuzzy(q);
  if(res && res.ok){ renderResult(res, used, q); return; }
  // keyword search mode if it doesn't look like a PN
  if(!/^(QS18|QS30|S18|Q4X|Q5X|Q3X|Q2X|Q20)/i.test(q.replace(/\s+/g,''))){
    renderSearch(q); return;
  }
  if(!res){ outEl.innerHTML = '<div class="card empty">Not a recognized Banner family prefix.</div>'; return; }
  renderFail(res, q);
}

function lightTile(l){
  return '<div class="tile light-'+l.kind+'"><div class="k">Light source</div><div class="v">'+esc(l.label)+'</div><div class="d">'+esc(l.detail)+'</div></div>';
}

function renderResult(r, q, typed){
  const compact = q.toUpperCase().replace(/\s+/g,'');
  // Banner prints the cable-length suffix with a space: "QS18VP6LP W/30"
  const norm = compact.replace(/(W\/?\d+)$/,' $1');
  const known = KNOWN.has(norm) || KNOWN.has(compact);
  let html = '<div class="card">';
  // say so when the fuzzy pass repaired what was typed or scanned
  if(scanRaw && scanRaw !== compact) html += '<div class="fixedpn">Scanned <b>'+esc(scanRaw)+'</b> · read as <b>'+esc(norm)+'</b></div>';
  else if(typed && norm !== typed.toUpperCase().trim().replace(/\s+/g,' ')) html += '<div class="fixedpn">Read as <b>'+esc(norm)+'</b></div>';
  html += '<div class="famline"><span class="famname">'+esc(r.fam.famName)+'</span>';
  html += known ? '<span class="badge ok">✓ catalog model</span>' : '<span class="badge gen">decoded from nomenclature</span>';
  html += '</div><div class="famdesc">'+esc(r.fam.famDesc)+'</div>';
  html += '<div class="tiles">';
  html += '<div class="tile mode"><div class="k">Sensing mode</div><div class="v">'+esc(r.mode)+'</div>'+(r.modeNote?'<div class="d">'+esc(r.modeNote)+'</div>':'')+'</div>';
  html += lightTile(r.light);
  html += '<div class="tile"><div class="k">Range</div><div class="v">'+esc(r.range)+'</div></div>';
  html += '</div>';
  html += '<div class="rows">';
  html += '<div class="row"><span class="rk">Output</span><span class="rv">'+esc(r.output)+'</span></div>';
  html += '<div class="row"><span class="rk">Supply</span><span class="rv">'+esc(r.supply)+'</span></div>';
  html += '<div class="row"><span class="rk">Connection</span><span class="rv">'+esc(r.conn)+'</span></div>';
  if(r.housing) html += '<div class="row"><span class="rk">Housing</span><span class="rv">'+esc(r.housing)+'</span></div>';
  html += '</div>';
  for(const w of (r.warns||[])) html += '<div class="warnbox">⚠ '+esc(w)+'</div>';
  for(const n of (r.notes||[])) html += '<div class="warnbox" style="background:var(--unk-bg);color:var(--ink2)">ℹ '+esc(n)+'</div>';
  html += '<div class="segs">'+r.segs.map(s=>'<div class="seg"><b>'+esc(s.t)+'</b><span>'+esc(s.d)+'</span></div>').join('')+'</div>';
  const doc = docFor(r);
  html += '<div class="links">';
  if(doc) html += '<a class="linkbtn" href="'+esc(doc)+'" target="_blank" rel="noopener">📄 Datasheet / manual (PDF)</a>';
  html += '<a class="linkbtn" href="'+esc(bannerSearchUrl(norm))+'" target="_blank" rel="noopener">🔍 Find on Banner.com</a>';
  html += '</div>';
  html += '</div>';
  outEl.innerHTML = html;
  pushHistory(norm);
}

function renderFail(res, q){
  const norm = q.toUpperCase().replace(/\s+/g,'');
  let html = '<div class="card">';
  html += '<div class="famline"><span class="famname">'+esc(res.fam.famName)+'</span><span class="badge gen">family recognized</span></div>';
  html += '<div class="famdesc">'+esc(res.fam.famDesc)+'</div>';
  if(scanRaw && scanRaw !== norm) html += '<div class="fixedpn">Scanned <b>'+esc(scanRaw)+'</b></div>';
  html += '<div class="warnbox">⚠ '+esc(res.msg)+'. Check for typos — or it may be a customer-special.</div></div>';
  const sug = suggestions(norm);
  if(sug.length){
    html += '<div class="card sugg"><h3>Did you mean</h3>';
    for(const s of sug) html += '<button class="suggitem" data-pn="'+esc(s)+'"><b>'+esc(s)+'</b><span>'+esc(describeShort(s))+'</span></button>';
    html += '</div>';
  }
  outEl.innerHTML = html;
}

function renderSearch(q){
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = [];
  for(const k of KNOWN){
    const desc = (k+' '+describeShort(k)).toLowerCase();
    if(terms.every(t=>desc.includes(t))) hits.push(k);
    if(hits.length>=30) break;
  }
  let html = '<div class="card listwrap"><h3>'+(hits.length?'Models matching “'+esc(q)+'”':'No known models match “'+esc(q)+'” — try “laser”, “retro”, “diffuse”, “clear”…')+'</h3>';
  for(const h of hits) html += '<button class="modelitem" data-pn="'+esc(h)+'"><b>'+esc(h)+'</b><span>'+esc(describeShort(h))+'</span></button>';
  html += '</div>';
  outEl.innerHTML = html;
}

function pushHistory(pn){
  // debounce so half-typed part numbers don't pollute history
  clearTimeout(histTimer);
  histTimer = setTimeout(()=>{
    history = [pn].concat(history.filter(h=>h!==pn)).slice(0,15);
    saveHist();
    renderHist();
  }, 1000);
}
function renderHist(){
  histEl.innerHTML = history.map(h=>'<button data-pn="'+esc(h)+'">'+esc(h)+'</button>').join('')
    + (history.length ? '<button data-histclear="1" style="color:var(--warn)">✕ clear</button>' : '');
}
renderHist();

document.addEventListener('click', e=>{
  if(e.target.closest('[data-histclear]')){ history=[]; saveHist(); renderHist(); return; }
  const b = e.target.closest('[data-pn]');
  if(b){ pnEl.value = b.dataset.pn; scanRaw = null; render(); window.scrollTo({top:0,behavior:'smooth'}); }
});
pnEl.addEventListener('input', ()=>{ scanRaw = null; render(); });
clearBtn.addEventListener('click', ()=>{ pnEl.value=''; scanRaw = null; render(); pnEl.focus(); });

/* model browser */
const modelList = document.getElementById('modellist');
const modelSearch = document.getElementById('modelsearch');
function renderModelList(){
  const f = modelSearch.value.toLowerCase().split(/\s+/).filter(Boolean);
  const items = []; let matched = 0;
  for(const k of Array.from(KNOWN).sort()){
    const desc = describeShort(k);
    if(f.length && !f.every(t=>(k+' '+desc).toLowerCase().includes(t))) continue;
    matched++;
    if(items.length<60) items.push('<button class="modelitem" data-pn="'+esc(k)+'"><b>'+esc(k)+'</b><span>'+esc(desc)+'</span></button>');
  }
  if(matched>items.length) items.push('<div class="findercount">Showing the first '+items.length+' of '+matched+' — type to narrow it down.</div>');
  modelList.innerHTML = items.join('') || '<div class="empty">No matches.</div>';
}
modelSearch.addEventListener('input', renderModelList);
document.getElementById('browse').addEventListener('toggle', e=>{ if(e.target.open) renderModelList(); });

/* ================= FIND BY STYLE ================= */
const FINDER_GROUPS = {
  style: ['Any','Diffuse','Polarized retro','Retro (any)','Opposed','Fixed-field BGS','Adjustable-field','Laser distance','Clear object','Convergent','Fiber','Ultrasonic','Contrast'],
  light: ['Any','Laser','Red LED','Infrared'],
  out:   ['Any','PNP','NPN','Bipolar','IO-Link','TEACH','Analog','Emitter only'],
  fam:   ['Any','QS18','S18-2','QS30','Q4X','Q5X','Q3X','Q2X','Q20'],
  conn:  ['Any','Cable','M12 QD','M8 QD','Pigtail']
};
const finderState = {style:'Any', light:'Any', out:'Any', fam:'Any', conn:'Any'};
let CATALOG = null;
function catalog(){
  if(CATALOG) return CATALOG;
  CATALOG = [];
  for(const pn of Array.from(KNOWN).sort()){
    const r = decodePN(pn);
    if(r && r.ok) CATALOG.push({pn, r});
  }
  return CATALOG;
}
function styleMatch(modeStr, s){
  const m = modeStr.toLowerCase();
  switch(s){
    case 'Diffuse': return m.includes('diffuse');
    case 'Polarized retro': return m.includes('polarized');
    case 'Retro (any)': return m.includes('retroreflective');
    case 'Opposed': return m.includes('opposed');
    case 'Fixed-field BGS': return m.includes('fixed-field');
    case 'Adjustable-field': return m.includes('adjustable');
    case 'Laser distance': return m.includes('laser distance') || m.includes('laser measurement');
    case 'Clear object': return m.includes('clear object');
    case 'Convergent': return m.includes('convergent');
    case 'Fiber': return m.includes('fiber');
    case 'Ultrasonic': return m.includes('ultrasonic');
    case 'Contrast': return m.includes('contrast');
    default: return true;
  }
}
function lightMatch(r, s){
  if(s==='Any') return true;
  return r.light.kind === {Laser:'laser','Red LED':'red',Infrared:'ir'}[s];
}
function outMatch(r, s){
  const o = r.output || '';
  switch(s){
    case 'Any': return true;
    case 'PNP': return /PNP|sourcing/i.test(o) && !/Bipolar/i.test(o);
    case 'NPN': return /NPN|sinking/i.test(o) && !/Bipolar/i.test(o);
    case 'Bipolar': return /Bipolar/i.test(o);
    case 'IO-Link': return /IO-Link/i.test(o);
    case 'TEACH': return /TEACH/i.test(o) || /TEACH/i.test(r.fam.famName);
    case 'Analog': return /Analog/i.test(o);
    case 'Emitter only': return /None/i.test(o);
    default: return true;
  }
}
function connMatch(r, s){
  const c = r.conn || '';
  switch(s){
    case 'Any': return true;
    case 'Cable': return /cable/i.test(c);
    case 'M12 QD': return /M12/i.test(c);
    case 'M8 QD': return /M8/i.test(c);
    case 'Pigtail': return /pigtail/i.test(c);
    default: return true;
  }
}
function findMatches(st){
  return catalog().filter(({r}) =>
    styleMatch(r.mode, st.style) && lightMatch(r, st.light) &&
    outMatch(r, st.out) && connMatch(r, st.conn) &&
    (st.fam==='Any' || r.fam.family===st.fam)
  ).map(x=>x.pn);
}
/* PN pattern hints, generated from the mode tables */
function codesForStyle(table, style, lightSel){
  const out = [];
  for(const [code, e] of Object.entries(table)){
    if(!styleMatch(e.m, style)) continue;
    if(lightSel && lightSel!=='Any'){
      const k = (typeof e.l==='object') ? e.l.kind : null;
      if(k !== {Laser:'laser','Red LED':'red',Infrared:'ir'}[lightSel]) continue;
    }
    out.push('<code>'+code+'</code> '+esc(shortR(e)));
  }
  return out;
}
function shortR(e){
  const lk = e.l && e.l.kind;
  const lt = lk==='laser'?'laser':lk==='ir'?'IR':lk==='red'?'red':'';
  return (e.r||'').replace(' cutoff','').replace('cutoff adj. ','adj ') + (lt?' · '+lt:'');
}
const FAM_STRUCT = {
  'QS18': 'QS18 + output <code>[VN</code><span class="pl">=NPN</span> <code>VP</code><span class="pl">=PNP</span> <code>EN/EP</code><span class="pl">=TEACH</span> <code>EK</code><span class="pl">=TEACH+IO-Link</span> <code>AB/RB</code><span class="pl">=bipolar LO/DO]</span> + <code>6</code> + mode + connector <span class="pl">(none=2 m cable,</span> <code>Q</code><span class="pl">=M8 pigtail,</span> <code>Q5</code><span class="pl">=M12 pigtail,</span> <code>Q7</code><span class="pl">=M8,</span> <code>Q8</code><span class="pl">=M12,</span> <code>W/30</code><span class="pl">=9 m cable)</span>',
  'S18-2': 'S18-2 + <code>[VN</code><span class="pl">=NPN</span> <code>VP</code><span class="pl">=PNP</span> <code>NA</code><span class="pl">=emitter]</span> + mode + <code>[-2M</code><span class="pl">=cable</span> <code>-Q8</code><span class="pl">=M12</span> <code>-Q5</code><span class="pl">=M12 pigtail]</span>',
  'QS30': 'QS30 + mode + <code>[Q</code><span class="pl">=M12 QD,</span> <code>Q5</code><span class="pl">=M12 pigtail,</span> <span class="pl">none=2 m cable]</span> — <span class="pl">all DC models are bipolar NPN+PNP</span>',
  'Q2X': 'Q2X + <code>[A</code><span class="pl">=light-op</span> <code>R</code><span class="pl">=dark-op</span> <span class="pl">— omitted on the laser models]</span> + <code>[B</code><span class="pl">=bipolar</span> <code>P</code><span class="pl">=PNP</span> <code>N</code><span class="pl">=NPN</span> <code>K</code><span class="pl">=IO-Link]</span> + mode + <code>[-2M -Q -Q3 -Q5]</code>',
  'Q20': 'Q20 + <code>[P</code><span class="pl">=PNP</span> <code>N</code><span class="pl">=NPN]</span> + mode + <code>[Q7</code><span class="pl">=M8,</span> <code>Q/Q5</code><span class="pl">=pigtail,</span> <span class="pl">none=cable]</span>',
  'Q4X': 'Q4X + <code>[T</code><span class="pl">=threaded barrel</span> <code>F</code><span class="pl">=flush mount]</span> + <code>[B N P I U K]</code><span class="pl"> output</span> + <code>[LAF|COD]</code> + range mm <span class="pl">(T: 100/300/500/600, F: 110/310/610)</span> + <code>-Q8</code> — <span class="pl">all Class 1 laser</span>',
  'Q5X': 'Q5X + <code>K</code><span class="pl">=IO-Link</span> + <code>LAF</code> + <code>[2000 3000 5000 10000]</code> + <code>-Q8</code> — <span class="pl">Class 2 laser, 650 nm</span>',
  'Q3X': 'Q3X + <code>TB</code> + <code>LD</code> + <code>[— 50 100 150 200]</code> + <code>-Q8</code> — <span class="pl">Class 2 laser, bipolar</span>'
};
const FAM_TABLES = {'QS18':QS18_MODES, 'S18-2':S18_MODES, 'QS30':QS30_MODES, 'Q2X':Q2X_MODES, 'Q20':Q20_MODES};
function renderPatternHint(){
  const el = document.getElementById('patternhint');
  const fams = finderState.fam==='Any' ? ['QS18'] : [finderState.fam];
  let html = '';
  for(const f of fams){
    html += '<div class="patternbox"><b>'+esc(f)+' pattern:</b><br>' + (FAM_STRUCT[f]||'');
    if(finderState.style!=='Any' && FAM_TABLES[f]){
      const codes = codesForStyle(FAM_TABLES[f], finderState.style, finderState.light);
      if(codes.length) html += '<br><b>'+esc(finderState.style)+' mode codes:</b> ' + codes.join(' &nbsp;·&nbsp; ');
      else html += '<br><span class="pl">No '+esc(finderState.style.toLowerCase())+' modes in this family.</span>';
    }
    html += '</div>';
  }
  if(finderState.fam==='Any') html += '<div class="findercount">Showing the QS18 pattern — pick a family chip for others.</div>';
  el.innerHTML = html;
}
function renderFinder(){
  for(const [group, opts] of Object.entries(FINDER_GROUPS)){
    const box = document.querySelector('.chips[data-group="'+group+'"]');
    box.innerHTML = opts.map(o=>'<button class="chip'+(finderState[group]===o?' on':'')+'" data-fgroup="'+group+'" data-fval="'+esc(o)+'">'+esc(o)+'</button>').join('');
  }
  renderPatternHint();
  const pns = findMatches(finderState);
  const shown = pns.slice(0,50);
  document.getElementById('findercount').textContent = pns.length + ' matching catalog model' + (pns.length===1?'':'s')
    + (pns.length>shown.length ? ' — showing the first '+shown.length : '');
  document.getElementById('finderresults').innerHTML = shown.map(p=>
    '<button class="modelitem" data-pn="'+esc(p)+'"><b>'+esc(p)+'</b><span>'+esc(describeShort(p))+'</span></button>').join('');
}
document.addEventListener('click', e=>{
  const c = e.target.closest('[data-fgroup]');
  if(c){ finderState[c.dataset.fgroup] = c.dataset.fval; renderFinder(); }
});
document.getElementById('finder').addEventListener('toggle', e=>{ if(e.target.open) renderFinder(); });
window.__find = findMatches;

/* expose for testing */
window.__decode = decodePN;
window.__decodeFuzzy = decodeFuzzy;
window.__suggest = suggestions;

render();
