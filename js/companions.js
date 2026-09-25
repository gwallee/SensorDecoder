"use strict";
/* Companion parts and cross-references for a decoded part number.
   Accessory numbers are Banner catalog items; each item links to a Banner.com search
   so the current datasheet is one tap away. Pairings (emitter ↔ receiver) decode in-app. */

/* ---- cordsets by connector ---- */
const CORDSETS = {
  m12_4: [['MQDC-406','M12 4-pin cordset · 2 m straight'], ['MQDC-415','5 m straight'], ['MQDC-430','9 m straight'], ['MQDC-406RA','2 m right-angle']],
  m12_5: [['MQDC1-506','M12 5-pin cordset · 2 m straight'], ['MQDC1-515','5 m straight'], ['MQDC1-530','9 m straight']],
  m8_4:  [['PKG4M-2','M8 4-pin cordset · 2 m straight'], ['PKW4M-2','2 m right-angle']],
  m8_3:  [['PKG3M-2','M8 3-pin cordset · 2 m straight']]
};
function cordsetsFor(conn){
  const c = conn || '';
  if(!/QD/i.test(c) && !/M12|M8/i.test(c)) return null;          // integral cable — nothing to add
  if(/M12/i.test(c)) return /5-pin/i.test(c) ? CORDSETS.m12_5 : CORDSETS.m12_4;
  if(/M8/i.test(c))  return /3-pin/i.test(c) ? CORDSETS.m8_3 : CORDSETS.m8_4;
  return null;
}

/* ---- emitter / receiver pairings ----
   Returns catalog part numbers where possible, keeping the same connector suffix
   as the sensor being looked at when such a model exists. */
function withConn(base, suffix){
  if(suffix && KNOWN.has(base+suffix)) return base+suffix;
  return base;
}
function pairings(compact, r){
  const fam = r.fam.family, out = [];
  let m;
  if(fam==='QS18'){
    if((m = compact.match(/^QS18(?:VN|VP|EN|EP|AB|RB|K)6(RB|R)(Q\d?|QPMA)?$/))){
      const sfx = m[2]||'';
      if(m[1]==='RB') out.push([withConn('QS186EB',sfx),'Short-range emitter this receiver pairs with']);
      else { out.push([withConn('QS186E',sfx),'Infrared emitter this receiver pairs with']);
             out.push([withConn('QS186EV',sfx),'Visible-red emitter (easier to aim)']);
             out.push([withConn('QS186LE',sfx),'Laser emitter (small precise spot)']); }
    }
    else if((m = compact.match(/^QS186(LE|EV|EB|E)(Q\d?)?$/))){
      const sfx = m[2]||'', rc = m[1]==='EB' ? 'RB' : 'R';
      out.push([withConn('QS18VN6'+rc,sfx),'NPN receiver for this emitter'], [withConn('QS18VP6'+rc,sfx),'PNP receiver for this emitter']);
    }
    else if((m = compact.match(/^QS18EK6(EV|E|RV|R)$/))){
      const map = {E:'QS18EK6R', EV:'QS18EK6RV', R:'QS18EK6E', RV:'QS18EK6EV'};
      out.push([map[m[1]], /^E/.test(m[1]) ? 'IO-Link receiver for this emitter' : 'Emitter this IO-Link receiver pairs with']);
    }
  }
  else if(fam==='Q20'){
    if((m = compact.match(/^Q20(P|N)(RL|R)(Q\d?|QPMA)?$/))) out.push([withConn(m[2]==='RL'?'Q20EL':'Q20E', m[3]||''), m[2]==='RL' ? 'Infrared long-range emitter for this receiver' : 'Visible-red emitter for this receiver']);
    else if((m = compact.match(/^Q20(EL|E)(Q\d?|QPMA)?$/))){ const rc = m[1]==='EL'?'RL':'R', sfx = m[2]||''; out.push([withConn('Q20P'+rc,sfx),'PNP receiver for this emitter'], [withConn('Q20N'+rc,sfx),'NPN receiver for this emitter']); }
  }
  else if(fam==='S18-2'){
    if((m = compact.match(/^S18-?2(VN|VP)(RL|RS)(-(?:2M|9M|Q8|Q5|Q3))?$/))){ const sfx = m[3]||''; out.push([withConn('S18-2NAEL',sfx),'Emitter for this receiver'], [withConn('S18-2NAES',sfx),'Emitter with power adjust']); }
    else if((m = compact.match(/^S18-?2NA(EL|ES|EJ)(-(?:2M|9M|Q8|Q5|Q3))?$/))){ const sfx = m[2]||''; out.push([withConn('S18-2VNRL',sfx),'NPN receiver for this emitter'], [withConn('S18-2VPRL',sfx),'PNP receiver for this emitter']); }
  }
  else if(fam==='QS30'){
    if((m = compact.match(/^QS30(ARX|RRX|R)(Q5|Q)?$/))){ const sfx = m[2]||''; out.push([withConn(m[1]==='R'?'QS30E':'QS30EX',sfx), m[1]==='R' ? 'Emitter for this receiver' : 'High-power emitter for this receiver']); }
    else if((m = compact.match(/^QS30(EX|E)(Q5|Q)?$/))){ const sfx = m[2]||''; if(m[1]==='E') out.push([withConn('QS30R',sfx),'Receiver for this emitter']); else out.push([withConn('QS30ARX',sfx),'Light-operate receiver for this emitter'], [withConn('QS30RRX',sfx),'Dark-operate receiver for this emitter']); }
  }
  return out;
}

/* ---- everything that goes with a decoded sensor ---- */
function companions(compact, r){
  const groups = [];
  const pair = pairings(compact, r);
  if(pair.length) groups.push({title:'Pairs with', items: pair.map(([pn,why])=>({pn, why, decode:true}))});
  const mode = (r.mode||'');
  if(/retroreflective|clear object/i.test(mode) && !/emitter|receiver/i.test(mode)){
    const items = [{pn:'BRT-84', why:'84 mm square reflector — the usual target; range is specified with the datasheet’s reflector'},
                   {pn:'BRT-3', why:'76 mm round reflector — smaller, shorter range'},
                   {pn:'BRT-2', why:'51 mm round reflector — tight spaces, shortest range'}];
    if(/laser/i.test(mode)) items[0].why = '84 mm reflector; laser retro models are fussier about reflector quality — check the datasheet';
    groups.push({title:'Reflector required', items});
  }
  if(/fiber/i.test(mode)){
    groups.push({title:'Fibers required', items: /glass/i.test(mode)
      ? [{pn:'IT23S', why:'Glass fiber, individual (opposed pair)'}, {pn:'BT23S', why:'Glass fiber, bifurcated (diffuse)'}]
      : [{pn:'PIT46U', why:'Plastic fiber, individual (opposed pair)'}, {pn:'PBT46U', why:'Plastic fiber, bifurcated (diffuse)'}]});
  }
  const cs = cordsetsFor(r.conn);
  if(cs) groups.push({title:'Cordset', items: cs.map(([pn,why])=>({pn, why}))});
  if(r.fam.family==='QS18' || r.fam.family==='S18-2'){
    groups.push({title:'Mounting', items:[{pn:'SMB18A', why:'18 mm right-angle bracket (fits the threaded nose)'}, {pn:'SMB18SF', why:'18 mm swivel bracket'}]});
  }
  return groups;
}

/* ---- cross-reference: other catalog models that sense the same way ---- */
function alternatives(compact, r){
  const norm = knownKey(compact).replace(/\s+/g,'');
  const same = [], other = [];
  for(const {pn, r: e} of catalog()){
    if(pn.replace(/\s+/g,'')===norm) continue;
    if(e.mode !== r.mode) continue;
    if(e.fam.family === r.fam.family){
      if(e.range !== r.range) continue;
      const sup = e.supply !== r.supply;
      same.push({pn, why: shortOut(e.output) + ' · ' + shortConn(e.conn) + (sup ? ' · ' + e.supply : ''),
                 rank: (sup?2:0) + (e.output!==r.output?0:1)});   // same supply first; different output before different connector
    } else {
      other.push({pn, why: e.fam.family + ' · ' + e.range + ' · ' + e.light.label});
    }
  }
  same.sort((a,b)=> a.rank-b.rank || a.pn.localeCompare(b.pn));
  return {same, other};
}
function shortOut(o){
  o = o||'';
  if(/Bipolar/i.test(o)) return 'Bipolar';
  if(/IO-Link/i.test(o)) return 'IO-Link';
  if(/None/i.test(o)) return 'Emitter';
  if(/Analog current/i.test(o)) return '4–20 mA';
  if(/Analog voltage/i.test(o)) return '0–10 V';
  if(/NPN|sinking/i.test(o)) return 'NPN' + (/TEACH/i.test(o)?' TEACH':'');
  if(/PNP|sourcing/i.test(o)) return 'PNP' + (/TEACH/i.test(o)?' TEACH':'');
  return o.split(' — ')[0];
}
function shortConn(c){
  c = c||'';
  const m = c.match(/(\d)-pin (M12|M8)/);
  if(/pigtail/i.test(c)) return (m ? m[2] : 'QD') + ' pigtail';
  if(m) return m[2] + ' QD';
  const cab = c.match(/(\d+(?:\.\d+)?) m/);
  return cab ? cab[1] + ' m cable' : c;
}
