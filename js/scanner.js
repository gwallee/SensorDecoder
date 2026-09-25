"use strict";
/* Camera scanner: live OCR of the label with auto and manual capture */
/* ================= SCANNER (camera + OCR) ================= */
const scanner = document.getElementById('scanner');
const video = document.getElementById('video');
const snapBtn = document.getElementById('snap');
const torchBtn = document.getElementById('torch');
const autoBtn = document.getElementById('automode');
const scanStatus = document.getElementById('scanstatus');
let stream = null, tessWorker = null, tessLoading = null;
let scanAuto = (()=>{ try{ return localStorage.getItem('bannerpn_scanauto') !== '0'; }catch(e){ return true; } })();
let scanGen = 0;   // bumped whenever the scanner closes or the mode changes; a running auto loop sees it and stops
let torchOn = false;

function loadTesseract(){
  if(window.Tesseract) return Promise.resolve();
  if(tessLoading) return tessLoading;
  tessLoading = new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.0/tesseract.min.js';
    s.onload = res; s.onerror = ()=>rej(new Error('Could not load the OCR engine (needs internet).'));
    document.head.appendChild(s);
  });
  return tessLoading;
}
async function getWorker(){
  if(tessWorker) return tessWorker;
  await loadTesseract();
  tessWorker = await Tesseract.createWorker('eng');
  await tessWorker.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/. ',
    tessedit_pageseg_mode: '7'   // the guide box holds a single line of text
  });
  return tessWorker;
}
/* OCR jobs run one at a time — the auto loop and a manual capture can overlap */
let ocrChain = Promise.resolve();
function ocrQueue(fn){ const p = ocrChain.then(fn, fn); ocrChain = p.catch(()=>{}); return p; }
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function updateAutoBtn(){
  autoBtn.classList.toggle('on', scanAuto);
  autoBtn.setAttribute('aria-pressed', String(scanAuto));
  autoBtn.textContent = scanAuto ? 'Auto: on' : 'Auto: off';
}
autoBtn.addEventListener('click', ()=>{
  scanAuto = !scanAuto;
  try{ localStorage.setItem('bannerpn_scanauto', scanAuto?'1':'0'); }catch(e){}
  updateAutoBtn();
  scanGen++;
  if(scanAuto) startAutoLoop();
  else scanStatus.textContent = 'Line up the model number in the box, then tap the button.';
});

document.getElementById('scanopen').addEventListener('click', async ()=>{
  scanner.classList.add('open');
  scanStatus.textContent = 'Starting camera…';
  snapBtn.disabled = true; torchBtn.hidden = true; torchBtn.classList.remove('on'); torchOn = false;
  updateAutoBtn();
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:2560}, height:{ideal:1440}}});
    video.srcObject = stream;
    await video.play();
    snapBtn.disabled = false;
    // flashlight, where the browser exposes it (Android Chrome; iOS Safari does not)
    const track = stream.getVideoTracks()[0];
    const caps = track && track.getCapabilities ? track.getCapabilities() : {};
    if(caps && caps.torch) torchBtn.hidden = false;
    if(scanAuto) startAutoLoop();
    else { scanStatus.textContent = 'Line up the model number in the box, then tap the button.'; getWorker().catch(()=>{}); }
  }catch(err){
    scanStatus.textContent = 'Camera unavailable: ' + (err && err.message ? err.message : err) + ' — you can still type the part number.';
  }
});
torchBtn.addEventListener('click', async ()=>{
  const track = stream && stream.getVideoTracks()[0];
  if(!track) return;
  torchOn = !torchOn;
  try{ await track.applyConstraints({advanced:[{torch:torchOn}]}); torchBtn.classList.toggle('on', torchOn); }
  catch(e){ torchOn = false; torchBtn.classList.remove('on'); torchBtn.hidden = true; }
});
function closeScanner(){
  scanGen++;
  scanner.classList.remove('open');
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
  video.srcObject = null;
}
document.getElementById('scanclose').addEventListener('click', closeScanner);
// release the camera if the app is backgrounded mid-scan
document.addEventListener('visibilitychange', ()=>{ if(document.hidden && scanner.classList.contains('open')) closeScanner(); });

/* Grab the guide-box region, clean it up, OCR it, and pick the best part-number candidate. */
async function readFrame(opts){
  opts = opts || {};
  const vw = video.videoWidth, vh = video.videoHeight;
  if(!vw) return null;
  // guide box: left 5%, top 39%, w 90%, h 22% (matches the CSS overlay)
  const sx = vw*0.05, sy = vh*0.39, sw = vw*0.90, sh = vh*0.22;
  const scale = Math.max(0.5, Math.min(3, 1800/sw));   // normalise the crop to ~1800 px wide
  const cv = document.createElement('canvas');
  cv.width = Math.round(sw*scale); cv.height = Math.round(sh*scale);
  const cx = cv.getContext('2d', {willReadFrequently:true});
  cx.drawImage(video, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  // grayscale + contrast stretch
  const img = cx.getImageData(0,0,cv.width,cv.height);
  const d = img.data; let mn=255, mx=0;
  for(let i=0;i<d.length;i+=4){
    const g = 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    d[i]=d[i+1]=d[i+2]=g;
    if(g<mn)mn=g; if(g>mx)mx=g;
  }
  const span = Math.max(1, mx-mn);
  for(let i=0;i<d.length;i+=4){
    const v = Math.max(0, Math.min(255, (d[i]-mn)*255/span));
    d[i]=d[i+1]=d[i+2]=v;
  }
  cx.putImageData(img,0,0);
  const worker = await getWorker();
  let text = await ocrQueue(async ()=>{
    let t = (await worker.recognize(cv)).data.text || '';
    if(opts.fallbackBlock && !extractCandidates(t.toUpperCase()).length){
      // nothing on the single line — retry treating the box as a block of text
      await worker.setParameters({tessedit_pageseg_mode:'6'});
      try{ t = (await worker.recognize(cv)).data.text || ''; }
      finally{ await worker.setParameters({tessedit_pageseg_mode:'7'}); }
    }
    return t;
  });
  text = text.toUpperCase();
  return {text, best: rankCandidates(extractCandidates(text))};
}
function rankCandidates(cands){
  const scored = cands.map(raw=>{
    const f = decodeFuzzy(raw);
    return {raw, used:f.used, ok:!!(f.res && f.res.ok), known:isKnown(f.used), repaired:!!f.repaired};
  });
  scored.sort((a,b)=> (b.ok-a.ok) || (b.known-a.known) || (a.repaired-b.repaired) || (b.used.length-a.used.length));
  return scored[0] || null;
}
function acceptScan(best){
  if(navigator.vibrate) navigator.vibrate(40);
  scanRaw = best.raw.toUpperCase().replace(/\s+/g,'');
  pnEl.value = best.used;
  closeScanner();
  render();
  window.scrollTo({top:0});
}

/* Auto mode: OCR frame after frame; accept once the same decodable number shows up
   in 2 of the last 3 frames, or the same undecodable text in 3 frames in a row
   (so a number the app doesn't know can still be scanned in and edited). */
async function startAutoLoop(){
  const gen = ++scanGen;
  scanStatus.textContent = 'Loading OCR engine…';
  try{ await getWorker(); }catch(err){ scanStatus.textContent = err.message; return; }
  if(gen!==scanGen) return;
  scanStatus.textContent = 'Looking for a part number…';
  const votes = [];
  while(gen===scanGen && scanner.classList.contains('open')){
    if(!video.videoWidth){ await sleep(100); continue; }
    const t0 = performance.now();
    let r = null;
    try{ r = await readFrame(); }
    catch(err){ scanStatus.textContent = 'OCR failed: ' + (err && err.message ? err.message : err); await sleep(800); continue; }
    if(gen!==scanGen) return;
    const best = r && r.best;
    votes.push(best ? best.used : null); if(votes.length>3) votes.shift();
    if(best){
      const n = votes.filter(v=>v===best.used).length;
      const need = best.ok ? 2 : 3;
      if(n>=need){ acceptScan(best); return; }
      scanStatus.textContent = (best.ok ? 'Reading ' : 'Not recognized: ') + best.used + ' — hold steady… ' + n + '/' + need;
    } else {
      scanStatus.textContent = 'Looking for a part number…';
    }
    const dt = performance.now()-t0;
    if(dt<120) await sleep(120-dt);
  }
}

/* Manual capture: one careful read (with a block-mode retry). Also works as a
   "take what you see now" override while auto mode is running. */
snapBtn.addEventListener('click', async ()=>{
  if(!video.videoWidth) return;
  const wasAuto = scanAuto; scanGen++;   // pause the auto loop
  snapBtn.disabled = true;
  scanStatus.textContent = 'Reading label…';
  try{
    const r = await readFrame({fallbackBlock:true});
    if(r && r.best){ acceptScan(r.best); return; }
    scanStatus.textContent = 'No part number found — move closer, add light, and try again.';
  }catch(err){
    scanStatus.textContent = 'OCR failed: ' + (err && err.message ? err.message : err);
  }
  snapBtn.disabled = false;
  if(wasAuto && scanner.classList.contains('open')){ await sleep(1500); if(scanner.classList.contains('open')) startAutoLoop(); }
});

/* Pull part-number candidates out of OCR text. Whole tokens are kept as well as
   family-prefixed runs, so the repair pass can fix a misread prefix (OS18 → QS18). */
function extractCandidates(text){
  const found = new Set();
  const FAM = /(?:QS18|QS30|S18-?2|Q4X|Q5X|Q3X|Q2X|Q20)[A-Z0-9\-\/]{1,18}/g;
  for(const lineRaw of text.split(/\n+/)){
    const line = lineRaw.replace(/[^A-Z0-9\-\/. ]/g,' ');
    for(const tok of line.split(/\s+/)){
      const t = tok.replace(/^[-\/.]+|[-\/.]+$/g,'');
      if(t.length>=5 && t.length<=24 && /\d/.test(t)) found.add(t);
    }
    for(const s of [line, line.replace(/\s+/g,'')]){
      let m; FAM.lastIndex = 0;
      while((m = FAM.exec(s))){ const t = m[0].replace(/[-\/.]+$/,''); if(t.length>=5) found.add(t); }
    }
    // cable-length suffix is printed with a space ("QS18VP6LV W/30") — keep it attached
    const w = line.match(/([A-Z0-9\-\/]{5,})\s+(W\/?\d{1,3})\b/);
    if(w) found.add(w[1]+w[2]);
  }
  return Array.from(found);
}
window.__extract = extractCandidates;
