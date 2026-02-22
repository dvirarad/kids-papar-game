// ══════════════════════════════════════════
// APP — UI, orchestrator, gallery, PDF, init
// ══════════════════════════════════════════

// ── Mode Selection ──────────────────────
function selectMode(mode) {
  apiMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('selected', b.dataset.mode === mode));
  document.getElementById('proKeySection').style.display = mode === 'pro' ? 'block' : 'none';
  document.getElementById('keyStatus').className = 'key-status';
  document.getElementById('keyStatus').textContent = '';
  updateCost();
}

function continueFromScreen0() {
  if (apiMode === 'pro') {
    validateKey();
  } else {
    // Free mode requires http:// for Puter.js
    if (location.protocol === 'file:') {
      showError('keyError', 'מצב חינם דורש שרת מקומי. הריצו בטרמינל: python3 -m http.server 8000 ואז גלשו ל-http://localhost:8000');
      return;
    }
    goToScreen(1);
  }
}

// ── Navigation ──────────────────────────
function goToScreen(n) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${n}`).classList.add('active');
  document.querySelectorAll('.step-dot').forEach((d, i) => {
    d.className = 'step-dot' + (i < n ? ' done' : '') + (i === n ? ' active' : '');
  });
  // Hide photo upload in free mode
  if (n === 1) {
    const photoRow = document.getElementById('photoUploadRow');
    if (photoRow) photoRow.style.display = apiMode === 'free' ? 'none' : '';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetToConfig() { generatedPages = []; goToScreen(1); }

// ── Config UI ───────────────────────────
function onPhotoSelected(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); const size = 512; // larger for better Vision results
      c.width = size; c.height = size; const ctx = c.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      ctx.drawImage(img, (size - img.width * scale) / 2, (size - img.height * scale) / 2, img.width * scale, img.height * scale);
      pendingPhotoB64 = c.toDataURL('image/jpeg', 0.85);
      document.getElementById('photoLabel').innerHTML = `<img src="${pendingPhotoB64}" alt=""> תמונה נבחרה ✓<input type="file" accept="image/*" style="display:none" onchange="onPhotoSelected(this)">`;
      // If a kid was already added without a photo, attach it to the last kid
      if (kids.length > 0 && !kids[kids.length - 1].photoB64) {
        kids[kids.length - 1].photoB64 = pendingPhotoB64;
        renderKids();
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function addKid() {
  const input = document.getElementById('kidNameInput');
  const name = input.value.trim();
  if (!name || kids.length >= 8 || kids.some(k => k.name === name)) { input.value = ''; return; }
  kids.push({ name, photoB64: pendingPhotoB64 });
  input.value = ''; pendingPhotoB64 = null;
  document.getElementById('photoLabel').innerHTML = `📷 הוספת תמונה (רשות)<input type="file" accept="image/*" style="display:none" onchange="onPhotoSelected(this)">`;
  renderKids(); input.focus();
}
function removeKid(i) { kids.splice(i, 1); renderKids(); }
function renderKids() {
  document.getElementById('kidsList').innerHTML = kids.map((k, i) => {
    const av = k.photoB64 ? `<img class="avatar-mini" src="${k.photoB64}" alt="">` : '';
    return `<span class="kid-chip">${av}${esc(k.name)}<button onclick="removeKid(${i})">✕</button></span>`;
  }).join('');
}

function toggleActivity(btn) {
  const id = btn.dataset.id;
  selectedActivities.has(id) ? (selectedActivities.delete(id), btn.classList.remove('selected')) : (selectedActivities.add(id), btn.classList.add('selected'));
  document.getElementById('categoriesSection').classList.toggle('visible', selectedActivities.has('coloring') || selectedActivities.has('differences') || selectedActivities.has('dots'));
  updateCost();
}

function setDetail(btn) {
  document.querySelectorAll('.detail-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  detailLevel = btn.dataset.level;
}

function changePages(d) {
  pageCount = Math.min(30, Math.max(1, pageCount + d));
  document.getElementById('pagesCount').textContent = pageCount;
  updateCost();
}

function updateCost() {
  const acts = Array.from(selectedActivities);
  if (acts.length === 0) { document.getElementById('costEstimate').innerHTML = ''; return; }
  if (apiMode === 'free') {
    document.getElementById('costEstimate').innerHTML =
      `<strong>$0 — חינם</strong><br>` +
      `<span style="font-size:0.78rem">תמונות נוצרות באמצעות Puter.ai ללא עלות</span>`;
    return;
  }
  // Estimate DALL-E calls per activity type per page
  let totalDalleCalls = 0;
  const pagesPerType = Math.ceil(pageCount / acts.length);
  if (acts.includes('coloring')) totalDalleCalls += pagesPerType; // 1 call per page
  if (acts.includes('differences')) totalDalleCalls += pagesPerType * 2; // 2 calls per page (2 games)
  if (acts.includes('matching')) totalDalleCalls += pagesPerType * 8; // ~8 calls per page (2 per pair × ~4 pairs)
  if (acts.includes('dots')) totalDalleCalls += pagesPerType; // 1 call per page (silhouette)
  // math, maze = 0 calls
  const realCost = (totalDalleCalls * 0.08).toFixed(2);
  document.getElementById('costEstimate').innerHTML =
    `קריאות DALL·E משוערות: <strong>${totalDalleCalls}</strong> · עלות: <strong>~$${realCost}</strong><br>` +
    `<span style="font-size:0.78rem">חשבון ומבוך — חינם (נוצרים בדפדפן)</span>`;
}

// ── Generation Orchestrator ─────────────
async function startGeneration() {
  const error = document.getElementById('configError');
  error.classList.remove('visible');
  if (kids.length === 0) { showError('configError', 'הוסיפו לפחות ילד/ה.'); return; }
  if (selectedActivities.size === 0) { showError('configError', 'בחרו לפחות סוג פעילות.'); return; }
  const needsCats = selectedActivities.has('coloring') || selectedActivities.has('differences') || selectedActivities.has('dots');
  if (needsCats && selectedCategories.size === 0) { showError('configError', 'בחרו לפחות קטגוריה אחת.'); return; }

  goToScreen(2);
  document.getElementById('genTitle').textContent = 'מייצר את הדפים...';
  document.getElementById('genSubtitle').textContent = 'רגע אחד — מכינים את החוברת.';
  document.getElementById('gallery').innerHTML = '';
  document.getElementById('progressContainer').style.display = 'block';
  document.getElementById('resultButtons').style.display = 'none';
  document.getElementById('genError').classList.remove('visible');
  generatedPages = [];

  const ageMin = parseInt(document.getElementById('ageMin').value) || 4;
  const ageMax = parseInt(document.getElementById('ageMax').value) || 7;
  const avgAge = (ageMin + ageMax) / 2;
  const acts = Array.from(selectedActivities);
  const cats = Array.from(selectedCategories);

  // Build plan
  const plan = [];
  // Cover pages for each kid
  kids.forEach(kid => plan.push({ type: 'cover', kid }));
  // Activity pages
  for (let i = 0; i < pageCount; i++) {
    const kid = kids[i % kids.length];
    const act = acts[i % acts.length];
    const cat = cats.length > 0 ? cats[i % cats.length] : null;
    plan.push({ type: act, kid, category: cat });
  }

  // Count total steps (matching pages have multiple DALL-E calls)
  let totalSteps = 0;
  for (const p of plan) {
    if (p.type === 'matching') totalSteps += 9;
    else if (p.type === 'differences') totalSteps += 2;
    else if (p.type === 'dots') totalSteps += 2; // DALL-E + extraction
    else if (p.type === 'cover' && p.kid.photoB64) totalSteps += 2; // vision + DALL-E
    else totalSteps += 1;
  }
  let currentStep = 0;

  const updateProg = (msg) => {
    const pct = Math.round((currentStep / totalSteps) * 100);
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressText').textContent = msg;
  };

  let failed = 0;

  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];
    const kidName = item.kid.name;
    try {
      let dataUrl, label;
      if (item.type === 'cover') {
        updateProg(`מכין שער עבור ${kidName}...`);
        dataUrl = await generateCoverPage(item.kid);
        label = `שער — ${kidName}`;
        currentStep += item.kid.photoB64 ? 2 : 1;
      } else if (item.type === 'coloring') {
        const catObj = CATEGORIES.find(c => c.id === item.category);
        updateProg(`🎨 מצייר דף צביעה: ${catObj?.label || ''} — ${kidName}...`);
        dataUrl = await generateColoringPage(kidName, catObj, avgAge);
        label = `צביעה: ${catObj?.label || ''} — ${kidName}`;
        currentStep++;
      } else if (item.type === 'differences') {
        const catObj = CATEGORIES.find(c => c.id === item.category);
        updateProg(`🔍 מצייר מצא ההבדלים: ${catObj?.label || ''} — ${kidName}...`);
        dataUrl = await generateDifferencesPage(kidName, catObj, avgAge);
        label = `2× מצא ההבדלים — ${kidName}`;
        currentStep += 2;
      } else if (item.type === 'math') {
        updateProg(`➕ מכין תרגילי חשבון — ${kidName}...`);
        dataUrl = generateMathPage(kidName, avgAge);
        label = `חשבון — ${kidName}`;
        currentStep++;
      } else if (item.type === 'matching') {
        updateProg(`🔗 מצייר חבר בין דומים — ${kidName}...`);
        dataUrl = await generateMatchingPage(kidName, avgAge, (step, msg) => {
          currentStep++;
          updateProg(msg);
        });
        label = `חבר בין דומים — ${kidName}`;
        currentStep++;
      } else if (item.type === 'maze') {
        updateProg(`🏁 מכין מבוך — ${kidName}...`);
        dataUrl = generateMazePage(kidName, avgAge);
        label = `מבוך — ${kidName}`;
        currentStep++;
      } else if (item.type === 'dots') {
        const catObj = CATEGORIES.find(c => c.id === item.category);
        updateProg(`🔢 מכין קו לקו: ${catObj?.label || ''} — ${kidName}...`);
        dataUrl = await generateDotsPage(kidName, avgAge, catObj);
        label = `קו לקו — ${kidName}`;
        currentStep += 2;
      }
      generatedPages.push({ imageDataUrl: dataUrl, label, kidName });
      addToGallery(dataUrl, label);
    } catch (err) {
      console.error(`Page ${i + 1} failed:`, err);
      failed++;
      currentStep += (item.type === 'matching' ? 9 : item.type === 'differences' ? 2 : item.type === 'dots' ? 2 : (item.type === 'cover' && item.kid.photoB64) ? 2 : 1);
    }
    updateProg(i < plan.length - 1 ? '' : 'מסיים...');
  }

  document.getElementById('progressContainer').style.display = 'none';
  document.getElementById('resultButtons').style.display = 'flex';
  if (generatedPages.length === 0) {
    document.getElementById('genTitle').textContent = 'היצירה נכשלה';
    document.getElementById('genSubtitle').textContent = 'לא הצלחנו ליצור דפים. בדקו את הקרדיט ונסו שוב.';
  } else {
    document.getElementById('genTitle').textContent = `${generatedPages.length} דפים מוכנים! 🎉`;
    document.getElementById('genSubtitle').textContent = failed > 0
      ? `${failed} דפים נכשלו, אבל ${generatedPages.length} מוכנים.`
      : 'חוברת הפעילויות מוכנה להורדה.';
  }
}

// ── Gallery & PDF ───────────────────────
function addToGallery(dataUrl, label) {
  const gallery = document.getElementById('gallery');
  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.innerHTML = `<img src="${dataUrl}" alt="${esc(label)}"><div class="gallery-item-label">${esc(label)}</div>`;
  gallery.appendChild(item);
}

async function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  for (let i = 0; i < generatedPages.length; i++) {
    if (i > 0) pdf.addPage();
    const page = generatedPages[i];
    // Detect image dimensions from dataUrl via temp image
    try {
      const img = await loadImage(page.imageDataUrl);
      const aspect = img.width / img.height;
      const maxW = 190, maxH = 277; // A4 with 10mm margins
      let w, h;
      if (aspect >= maxW / maxH) {
        w = maxW; h = maxW / aspect;
      } else {
        h = maxH; w = maxH * aspect;
      }
      const x = (210 - w) / 2;
      const y = (297 - h) / 2;
      pdf.addImage(page.imageDataUrl, 'PNG', x, y, w, h);
    } catch (e) { console.error('PDF err:', e); }
  }
  pdf.save(`חוברת_פעילויות_${kids[0]?.name || 'ColorCraft'}.pdf`);
}

// ── Init ────────────────────────────────
function init() {
  const grid = document.getElementById('categoriesGrid');
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.textContent = cat.label;
    btn.dataset.id = cat.id;
    btn.onclick = () => {
      selectedCategories.has(cat.id) ? (selectedCategories.delete(cat.id), btn.classList.remove('selected')) : (selectedCategories.add(cat.id), btn.classList.add('selected'));
      updateCost();
    };
    grid.appendChild(btn);
  });
  updateCost();
}

init();
