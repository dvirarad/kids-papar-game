// ══════════════════════════════════════════
// GENERATORS — All page generators + contour extraction
// ══════════════════════════════════════════

// ── Cover Page ──────────────────────────
async function generateCoverPage(kid) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');

  // Background
  ctx.fillStyle = '#FFF8F0'; ctx.fillRect(0, 0, 1024, 1024);

  // Double border
  ctx.strokeStyle = '#4ECDC4'; ctx.lineWidth = 8; roundRect(ctx, 30, 30, 964, 964, 40); ctx.stroke();
  ctx.strokeStyle = '#FFE66D'; ctx.lineWidth = 4; roundRect(ctx, 50, 50, 924, 924, 30); ctx.stroke();

  // Decorations around edges
  const deco = ['⭐','🌟','✨','🎨','🖍️','✏️','📚','🌈'];
  ctx.font = '42px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.fillText(deco[i % deco.length], 512 + Math.cos(a) * 420 - 20, 512 + Math.sin(a) * 420 + 15);
  }

  // Title line: "חוברת הצביעה של" in balloon letters
  drawBalloonText(ctx, '📖 חוברת הצביעה של', 512, 170, 52, '#FF6B6B', '#E85555');

  // Kid name in big balloon letters
  const nameSize = kid.name.length > 6 ? 72 : 90;
  drawBalloonText(ctx, kid.name, 512, 280, nameSize, '#A78BFA', '#8B5CF6');

  // Photo → line art portrait OR emoji
  if (kid.photoB64) {
    let portraitImg = null;
    // Primary: use image edit API to convert photo directly (preserves likeness)
    try {
      const editB64 = await convertPhotoToLineArt(kid.photoB64);
      portraitImg = await loadImage(b64toDataUrl(editB64));
    } catch (err) {
      console.warn('Image edit API failed, falling back to describe+generate:', err.message || err);
      // Fallback: describe with GPT-4o then generate with DALL-E
      try {
        const description = await describeChildPhoto(kid.photoB64);
        const portraitB64 = await callDalle(
          `A children's coloring book portrait of ${description}. ` +
          `Pure black and white LINE ART, bold clean outlines on white background, cute cartoon style. ` +
          `The child should be centered, smiling, drawn in a friendly simple style suitable for a kid to color in. ` +
          `NO shading, NO gray, NO color — ONLY black outlines on pure white.`
        );
        portraitImg = await loadImage(b64toDataUrl(portraitB64));
      } catch (err2) {
        console.error('Fallback portrait generation also failed:', err2.message || err2);
      }
    }
    if (portraitImg) {
      // Draw in circle
      ctx.save();
      ctx.beginPath(); ctx.arc(512, 540, 175, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(portraitImg, 512 - 175, 540 - 175, 350, 350);
      ctx.restore();
      // Circle borders
      ctx.beginPath(); ctx.arc(512, 540, 178, 0, Math.PI * 2);
      ctx.strokeStyle = '#FF6B6B'; ctx.lineWidth = 5; ctx.stroke();
      ctx.beginPath(); ctx.arc(512, 540, 187, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFE66D'; ctx.lineWidth = 3; ctx.stroke();
      // Label
      ctx.fillStyle = '#636E72'; ctx.font = '24px Rubik, Arial'; ctx.textAlign = 'center';
      ctx.fillText('צבעו אותי! 🖍️', 512, 745);
    } else {
      // Fallback to emoji
      ctx.font = '180px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🧒', 512, 550);
    }
  } else {
    ctx.font = '180px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🧒', 512, 550);
  }

  ctx.fillStyle = '#636E72'; ctx.font = '34px Rubik, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🎨 צבעו, חשבו, ומצאו! 🔍', 512, 820);
  return c.toDataURL('image/png');
}

// ── Coloring Page ───────────────────────
async function generateColoringPage(kidName, catObj, avgAge) {
  const catEn = catObj?.en || 'animals';
  const detail = getEffectiveDetail(avgAge);
  let style, sceneGuide;

  if (detail === 'simple') {
    style = 'very thick bold outlines (5px+), extremely simple rounded shapes, very large coloring areas, toddler-friendly';
    sceneGuide = `Show only ONE main ${catEn} character, big and centered, with maybe 1-2 tiny background elements. Very minimal, like a toddler coloring book.`;
  } else if (detail === 'medium') {
    style = 'thick bold outlines (3-4px), simple shapes, large coloring areas, preschool level';
    sceneGuide = `Show 2-3 simple ${catEn} themed objects. Keep it clean and spacious with lots of white space. No clutter. Like a kindergarten coloring book.`;
  } else {
    style = 'clean medium outlines, good detail, varied coloring areas';
    sceneGuide = `A detailed ${catEn} themed scene with many objects, patterns, and background elements. Engaging and complex.`;
  }

  const prompt = `A children's coloring book page. ${sceneGuide} ` +
    `Style: pure black and white line art on clean white background, ${style}. ` +
    `ONLY black outlines on white — NO shading, NO gray, NO color fills. Printable coloring page for kids.`;

  const b64 = await callDalle(prompt);
  return b64toDataUrl(b64);
}

// ── Find the Differences ────────────────
async function generateDifferencesPage(kidName, catObj, avgAge) {
  const catId = catObj?.id || 'default';
  const sceneTiers = DIFF_SCENES[catId] || DIFF_SCENES.default;
  const detail = getEffectiveDetail(avgAge);

  let sceneIdx, numDiffs, diffRadius, lineW, ageStyle;
  if (detail === 'simple') {
    sceneIdx = 0; numDiffs = 3; diffRadius = [30, 45]; lineW = 4;
    ageStyle = 'Very thick bold outlines (5px+), extremely simple rounded shapes, very large objects, maximum white space, toddler coloring book style.';
  } else if (detail === 'medium') {
    sceneIdx = 1; numDiffs = 5; diffRadius = [24, 35]; lineW = 3;
    ageStyle = 'Thick clean outlines (3px), simple clear shapes, spacious layout, kindergarten coloring book style.';
  } else {
    sceneIdx = 2; numDiffs = 7; diffRadius = [18, 28]; lineW = 2.5;
    ageStyle = 'Clean outlines with good detail, varied shapes, school-age coloring book style.';
  }

  // Pick 2 different scenes for 2 games
  const allCatIds = Array.from(selectedCategories);
  const cat2Id = allCatIds.length > 1 ? (allCatIds.find(c => c !== catId) || catId) : catId;
  const sceneTiers2 = DIFF_SCENES[cat2Id] || DIFF_SCENES.default;
  const scene1 = sceneTiers[sceneIdx];
  const scene2 = cat2Id !== catId ? sceneTiers2[sceneIdx] : sceneTiers[Math.min(sceneIdx + 1, 2)];

  const makePrompt = (scene) =>
    `A children's coloring book illustration of ${scene}. ${ageStyle} ` +
    `Pure black and white LINE ART only, clean outlines on white background. ` +
    `NO shading, NO gray tones, NO filled areas — ONLY black outlines on white.`;

  // Generate 2 scenes (2 DALL-E calls)
  const b64_1 = await callDalle(makePrompt(scene1));
  const origImg1 = await loadImage(b64toDataUrl(b64_1));
  const b64_2 = await callDalle(makePrompt(scene2));
  const origImg2 = await loadImage(b64toDataUrl(b64_2));

  // Create modified versions
  const modImg1 = await createModifiedImage(origImg1, numDiffs, diffRadius, lineW);
  const modImg2 = await createModifiedImage(origImg2, numDiffs, diffRadius, lineW);

  // Composite: 2 games stacked
  const cW = 1024, cH = 1480;
  const c = document.createElement('canvas'); c.width = cW; c.height = cH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, cW, cH);

  // Game 1
  drawDiffGame(ctx, origImg1, modImg1, kidName, numDiffs, 1, 10, cW);

  // Separator
  const sepY = 730;
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#CCC'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, sepY); ctx.lineTo(cW - 40, sepY); ctx.stroke();
  ctx.setLineDash([]);

  // Game 2
  drawDiffGame(ctx, origImg2, modImg2, kidName, numDiffs, 2, sepY + 10, cW);

  return c.toDataURL('image/png');
}

async function createModifiedImage(origImg, numDiffs, diffRadius, lineW) {
  const mod = document.createElement('canvas');
  mod.width = 1024; mod.height = 1024;
  const ctx = mod.getContext('2d');
  ctx.drawImage(origImg, 0, 0, 1024, 1024);

  const used = [];
  const margin = 80;
  for (let d = 0; d < numDiffs; d++) {
    let px, py, r, attempts = 0;
    do {
      r = diffRadius[0] + Math.random() * (diffRadius[1] - diffRadius[0]);
      px = margin + Math.random() * (1024 - margin * 2);
      py = margin + Math.random() * (1024 - margin * 2);
      attempts++;
    } while (attempts < 80 && used.some(z => Math.hypot(z.x - px, z.y - py) < z.r + r + 25));
    used.push({ x: px, y: py, r });

    ctx.save();
    const type = d % 4;
    if (type === 0) {
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = '#FFF'; ctx.fill();
    } else if (type === 1) {
      ctx.strokeStyle = '#000'; ctx.lineWidth = lineW;
      ctx.beginPath(); drawStar(ctx, px, py, 5, r * 0.8, r * 0.4); ctx.stroke();
    } else if (type === 2) {
      ctx.strokeStyle = '#000'; ctx.lineWidth = lineW;
      ctx.beginPath(); ctx.arc(px, py, r * 0.7, 0, Math.PI * 2); ctx.stroke();
      const s = r * 0.35;
      ctx.beginPath();
      ctx.moveTo(px - s, py - s); ctx.lineTo(px + s, py + s);
      ctx.moveTo(px + s, py - s); ctx.lineTo(px - s, py + s);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(px, py, r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#000'; ctx.fill();
    }
    ctx.restore();
  }
  return await loadImage(mod.toDataURL('image/png'));
}

function drawDiffGame(ctx, origImg, modImg, kidName, numDiffs, gameNum, startY, cW) {
  ctx.fillStyle = '#000'; ctx.font = 'bold 26px Rubik, Arial'; ctx.textAlign = 'center';
  ctx.fillText(`🔍 משחק ${gameNum}: מצאו ${numDiffs} הבדלים`, cW / 2, startY + 26);

  const panelW = 465, panelH = 370;
  const gap = 14;
  const totalW = panelW * 2 + gap;
  const panelX1 = (cW - totalW) / 2;
  const panelX2 = panelX1 + panelW + gap;
  const panelY = startY + 40;

  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.strokeRect(panelX1, panelY, panelW, panelH);
  ctx.drawImage(origImg, panelX1, panelY, panelW, panelH);

  ctx.strokeRect(panelX2, panelY, panelW, panelH);
  ctx.drawImage(modImg, panelX2, panelY, panelW, panelH);

  ctx.fillStyle = '#000'; ctx.font = 'bold 14px Rubik, Arial'; ctx.textAlign = 'center';
  ctx.fillText('תמונה א׳', panelX1 + panelW / 2, panelY + panelH + 15);
  ctx.fillText('תמונה ב׳', panelX2 + panelW / 2, panelY + panelH + 15);

  // Checkboxes
  const checkY = panelY + panelH + 22;
  for (let i = 0; i < numDiffs; i++) {
    const cx = cW / 2 + (i - numDiffs / 2 + 0.5) * 38;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - 9, checkY + 6, 18, 18);
    ctx.fillStyle = '#999'; ctx.font = '11px Rubik, Arial';
    ctx.fillText(`${i + 1}`, cx, checkY + 19);
  }
}

// ── Matching Page ───────────────────────
async function generateMatchingPage(kidName, avgAge, onStep) {
  const numPairs = avgAge <= 5 ? 3 : avgAge <= 7 ? 4 : 5;

  // Pick random association pairs
  const shuffledPairs = [...MATCHING_PAIRS].sort(() => Math.random() - 0.5);
  const selectedPairs = shuffledPairs.slice(0, numPairs);

  const stylePrompt = `Simple cute cartoon children's book illustration, centered on a pure white background. ` +
    `No text, no other objects. Bold clean outlines, colorful, friendly.`;

  // Generate DALL-E images: 2 per pair (item A and item B)
  const pairImages = [];
  const totalCalls = selectedPairs.length * 2;
  let callNum = 0;

  for (let i = 0; i < selectedPairs.length; i++) {
    const [aEn, aHe, bEn, bHe] = selectedPairs[i];
    let aImg = null, bImg = null;

    callNum++;
    onStep(1, `🔗 מצייר ${aHe} (${callNum}/${totalCalls})...`);
    try {
      const aB64 = await callDalle(`A single ${aEn}. ${stylePrompt}`);
      aImg = await loadImage(b64toDataUrl(aB64));
    } catch (e) { console.warn(`Failed: ${aEn}`, e); }

    callNum++;
    onStep(1, `🔗 מצייר ${bHe} (${callNum}/${totalCalls})...`);
    try {
      const bB64 = await callDalle(`A single ${bEn}. ${stylePrompt}`);
      bImg = await loadImage(b64toDataUrl(bB64));
    } catch (e) { console.warn(`Failed: ${bEn}`, e); }

    if (aImg && bImg) {
      pairImages.push({ aImg, bImg, aHe, bHe, idx: i });
    }
  }

  if (pairImages.length < 2) throw new Error('Not enough matching pairs generated');

  // Build two columns: right = A items (in order), left = B items (shuffled)
  const n = pairImages.length;
  const rightItems = pairImages.map(p => ({ img: p.aImg, label: p.aHe, idx: p.idx }));
  const leftItems  = pairImages.map(p => ({ img: p.bImg, label: p.bHe, idx: p.idx }));

  // Shuffle left column
  for (let i = leftItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [leftItems[i], leftItems[j]] = [leftItems[j], leftItems[i]];
  }
  // Ensure at least one pair is displaced
  if (n > 1 && leftItems.every((e, i) => e.idx === rightItems[i].idx)) {
    [leftItems[0], leftItems[1]] = [leftItems[1], leftItems[0]];
  }

  // Canvas
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1024, 1024);

  // Title
  ctx.fillStyle = '#2D3436'; ctx.font = 'bold 36px Rubik, Arial'; ctx.textAlign = 'center';
  ctx.fillText(`🔗 חברו בין הדומים — ${kidName}`, 512, 50);
  ctx.fillStyle = '#636E72'; ctx.font = '20px Rubik, Arial';
  ctx.fillText('חברו קו בין כל זוג שקשור', 512, 80);

  const startY = 108;
  const rowH = Math.min(175, (1024 - startY - 40) / n);
  const thumbSize = Math.min(rowH - 30, 130);
  const rightX = 830, leftX = 194;

  for (let i = 0; i < n; i++) {
    const y = startY + i * rowH + rowH / 2;
    const rItem = rightItems[i], lItem = leftItems[i];

    // Right image (A)
    ctx.save();
    ctx.beginPath(); roundRect(ctx, rightX - thumbSize/2, y - thumbSize/2, thumbSize, thumbSize, 14); ctx.clip();
    ctx.drawImage(rItem.img, rightX - thumbSize/2, y - thumbSize/2, thumbSize, thumbSize);
    ctx.restore();
    ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 2;
    roundRect(ctx, rightX - thumbSize/2, y - thumbSize/2, thumbSize, thumbSize, 14); ctx.stroke();
    ctx.fillStyle = '#2D3436'; ctx.font = 'bold 15px Rubik, Arial'; ctx.textAlign = 'center';
    ctx.fillText(rItem.label, rightX, y + thumbSize/2 + 18);

    // Left image (B, shuffled)
    ctx.save();
    ctx.beginPath(); roundRect(ctx, leftX - thumbSize/2, y - thumbSize/2, thumbSize, thumbSize, 14); ctx.clip();
    ctx.drawImage(lItem.img, leftX - thumbSize/2, y - thumbSize/2, thumbSize, thumbSize);
    ctx.restore();
    ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 2;
    roundRect(ctx, leftX - thumbSize/2, y - thumbSize/2, thumbSize, thumbSize, 14); ctx.stroke();
    ctx.fillStyle = '#2D3436'; ctx.font = 'bold 15px Rubik, Arial'; ctx.textAlign = 'center';
    ctx.fillText(lItem.label, leftX, y + thumbSize/2 + 18);

    // Connection dots
    ctx.beginPath(); ctx.arc(rightX - thumbSize/2 - 14, y, 6, 0, Math.PI * 2); ctx.fillStyle = '#CCC'; ctx.fill();
    ctx.beginPath(); ctx.arc(leftX + thumbSize/2 + 14, y, 6, 0, Math.PI * 2); ctx.fillStyle = '#CCC'; ctx.fill();
  }

  return c.toDataURL('image/png');
}

// ── Math Page ───────────────────────────
function generateMathPage(kidName, avgAge) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 3;
  roundRect(ctx, 20, 20, 984, 984, 20); ctx.stroke();

  ctx.fillStyle = '#2D3436'; ctx.font = 'bold 42px Rubik, Arial'; ctx.textAlign = 'center';
  ctx.fillText(`✏️ תרגילי חשבון — ${kidName}`, 512, 70);
  ctx.strokeStyle = '#4ECDC4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(100, 95); ctx.lineTo(924, 95); ctx.stroke();

  const count = avgAge <= 5 ? 6 : avgAge <= 7 ? 8 : 10;
  const problems = [];
  const fruitEmoji = ['🍎','🌟','🐟','🎈','🍪','🦋','⚽','🌸'];

  for (let i = 0; i < count; i++) {
    let a, b, op, answer;
    if (avgAge <= 4) { a = rand(1, 5); b = rand(1, 5); op = '+'; answer = a + b; }
    else if (avgAge <= 6) {
      if (Math.random() > 0.3) { a = rand(1, 10); b = rand(1, 10); op = '+'; answer = a + b; }
      else { a = rand(3, 12); b = rand(1, a); op = '-'; answer = a - b; }
    } else if (avgAge <= 8) {
      const r = Math.random();
      if (r < 0.4) { a = rand(5, 50); b = rand(5, 50); op = '+'; answer = a + b; }
      else if (r < 0.7) { a = rand(10, 50); b = rand(1, a); op = '-'; answer = a - b; }
      else { a = rand(2, 9); b = rand(2, 9); op = '×'; answer = a * b; }
    } else {
      const r = Math.random();
      if (r < 0.3) { a = rand(10, 100); b = rand(10, 100); op = '+'; answer = a + b; }
      else if (r < 0.5) { a = rand(20, 100); b = rand(10, a); op = '-'; answer = a - b; }
      else { a = rand(2, 12); b = rand(2, 12); op = '×'; answer = a * b; }
    }
    problems.push({ a, b, op, answer });
  }

  const cols = 2;
  const colW = 420;
  const startX = 512 - colW;
  const startY = 130;
  const rowH = avgAge <= 5 ? 120 : 80;

  problems.forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * colW + colW / 2;
    const y = startY + row * rowH;

    ctx.fillStyle = '#B2BEC3'; ctx.font = 'bold 20px Rubik, Arial'; ctx.textAlign = 'center';
    ctx.fillText(`.${i + 1}`, x + 180, y + 10);

    if (avgAge <= 5 && p.op === '+' && p.a <= 5 && p.b <= 5) {
      const emoji = fruitEmoji[i % fruitEmoji.length];
      ctx.font = '28px serif'; let ox = x - 150;
      for (let j = 0; j < p.a; j++) ctx.fillText(emoji, ox + j * 30, y + 8);
      ctx.fillStyle = '#2D3436'; ctx.font = 'bold 30px Rubik, Arial';
      ctx.fillText('+', ox + p.a * 30 + 8, y + 10);
      ctx.font = '28px serif'; let ox2 = ox + p.a * 30 + 30;
      for (let j = 0; j < p.b; j++) ctx.fillText(emoji, ox2 + j * 30, y + 8);
      ctx.fillStyle = '#2D3436'; ctx.font = 'bold 30px Rubik, Arial';
      ctx.fillText('= ___', ox2 + p.b * 30 + 18, y + 10);
      ctx.fillStyle = '#B2BEC3'; ctx.font = '20px Rubik, Arial';
      ctx.fillText(`${p.a} ${p.op} ${p.b} = ___`, x, y + 48);
    } else {
      ctx.fillStyle = '#2D3436'; ctx.font = 'bold 36px Rubik, Arial'; ctx.textAlign = 'center';
      ctx.fillText(`${p.a}  ${p.op}  ${p.b}  =  ____`, x, y + 15);
    }
  });

  // Upside down answers
  ctx.save(); ctx.translate(512, 975); ctx.rotate(Math.PI);
  ctx.fillStyle = '#DDD'; ctx.font = '14px Rubik, Arial'; ctx.textAlign = 'center';
  ctx.fillText(`תשובות: ${problems.map((p, i) => `${i + 1}.${p.answer}`).join('  ')}`, 0, 0);
  ctx.restore();

  return c.toDataURL('image/png');
}

// ── Maze Page ───────────────────────────
function generateMazePage(kidName, avgAge) {
  const detail = getEffectiveDetail(avgAge);
  let cols, rows, cellSize, wallW;
  if (detail === 'simple') { cols = 6; rows = 6; cellSize = 110; wallW = 6; }
  else if (detail === 'medium') { cols = 10; rows = 10; cellSize = 70; wallW = 4; }
  else { cols = 16; rows = 16; cellSize = 46; wallW = 3; }

  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1024, 1024);

  // Title
  ctx.fillStyle = '#000'; ctx.font = 'bold 40px Rubik, Arial'; ctx.textAlign = 'center';
  ctx.fillText(`🏁 מבוך — ${kidName}`, 512, 50);
  ctx.fillStyle = '#636E72'; ctx.font = '22px Rubik, Arial';
  ctx.fillText('מצאו את הדרך מהכניסה 🚪 אל היציאה ⭐', 512, 82);

  // Generate maze using recursive backtracking
  const maze = generateMazeGrid(cols, rows);

  // Draw maze
  const mazeW = cols * cellSize;
  const mazeH = rows * cellSize;
  const offX = (1024 - mazeW) / 2;
  const offY = 110;

  ctx.strokeStyle = '#000'; ctx.lineWidth = wallW; ctx.lineCap = 'round';

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = maze[y][x];
      const cx = offX + x * cellSize;
      const cy = offY + y * cellSize;
      // Top wall
      if (cell.walls.top && !(y === 0 && x === 0)) {
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + cellSize, cy); ctx.stroke();
      }
      // Right wall
      if (cell.walls.right && !(y === rows - 1 && x === cols - 1)) {
        ctx.beginPath(); ctx.moveTo(cx + cellSize, cy); ctx.lineTo(cx + cellSize, cy + cellSize); ctx.stroke();
      }
      // Bottom wall
      if (cell.walls.bottom) {
        ctx.beginPath(); ctx.moveTo(cx, cy + cellSize); ctx.lineTo(cx + cellSize, cy + cellSize); ctx.stroke();
      }
      // Left wall
      if (cell.walls.left) {
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + cellSize); ctx.stroke();
      }
    }
  }

  // Entrance and exit markers
  ctx.font = `${Math.min(cellSize * 0.7, 40)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🚪', offX + cellSize / 2, offY + cellSize / 2);
  ctx.fillText('⭐', offX + (cols - 0.5) * cellSize, offY + (rows - 0.5) * cellSize);

  // Difficulty label
  const labels = { simple: 'קל 🟢', medium: 'בינוני 🟡', detailed: 'קשה 🔴' };
  ctx.fillStyle = '#636E72'; ctx.font = '18px Rubik, Arial'; ctx.textAlign = 'center';
  ctx.fillText(`רמה: ${labels[detail]}`, 512, offY + mazeH + 35);

  return c.toDataURL('image/png');
}

function generateMazeGrid(cols, rows) {
  // Initialize grid
  const grid = [];
  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      grid[y][x] = { visited: false, walls: { top: true, right: true, bottom: true, left: true } };
    }
  }

  // Recursive backtracking
  const stack = [{ x: 0, y: 0 }];
  grid[0][0].visited = true;

  while (stack.length > 0) {
    const { x, y } = stack[stack.length - 1];
    const neighbors = [];
    if (y > 0 && !grid[y - 1][x].visited) neighbors.push({ nx: x, ny: y - 1, dir: 'top' });
    if (x < cols - 1 && !grid[y][x + 1].visited) neighbors.push({ nx: x + 1, ny: y, dir: 'right' });
    if (y < rows - 1 && !grid[y + 1][x].visited) neighbors.push({ nx: x, ny: y + 1, dir: 'bottom' });
    if (x > 0 && !grid[y][x - 1].visited) neighbors.push({ nx: x - 1, ny: y, dir: 'left' });

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      const { nx, ny, dir } = neighbors[Math.floor(Math.random() * neighbors.length)];
      // Remove walls between current and next
      if (dir === 'top') { grid[y][x].walls.top = false; grid[ny][nx].walls.bottom = false; }
      if (dir === 'right') { grid[y][x].walls.right = false; grid[ny][nx].walls.left = false; }
      if (dir === 'bottom') { grid[y][x].walls.bottom = false; grid[ny][nx].walls.top = false; }
      if (dir === 'left') { grid[y][x].walls.left = false; grid[ny][nx].walls.right = false; }
      grid[ny][nx].visited = true;
      stack.push({ x: nx, y: ny });
    }
  }
  return grid;
}

// ── Dot-to-Dot Page ─────────────────────
async function generateDotsPage(kidName, avgAge, catObj) {
  const detail = getEffectiveDetail(avgAge);
  let numDots, dotSize, fontSize;
  if (detail === 'simple') { numDots = 12; dotSize = 10; fontSize = 22; }
  else if (detail === 'medium') { numDots = 25; dotSize = 7; fontSize = 16; }
  else { numDots = 45; dotSize = 5; fontSize = 12; }

  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1024, 1024);

  // Title
  ctx.fillStyle = '#000'; ctx.font = 'bold 40px Rubik, Arial'; ctx.textAlign = 'center';
  ctx.fillText(`🔢 קו לקו — ${kidName}`, 512, 50);
  ctx.fillStyle = '#636E72'; ctx.font = '22px Rubik, Arial';
  ctx.fillText('חברו את הנקודות לפי הסדר וגלו מה מסתתר!', 512, 82);

  // Try DALL-E themed silhouette first, then fall back to parametric shapes
  let rawPoints = null;
  const cx2 = 512, cy2 = 530, size2 = 300;

  if (catObj) {
    try {
      const silB64 = await callDalle(
        `A single solid BLACK silhouette of a ${catObj.en} themed object on a pure WHITE background. ` +
        `The shape should be simple and recognizable, centered, filling most of the frame. ` +
        `Completely filled black shape — no internal details, no outlines, no gray. Just one solid black silhouette on white.`
      );
      const contour = await extractContourFromImage(b64toDataUrl(silB64), numDots);
      if (contour && contour.length >= Math.min(numDots, 8)) {
        rawPoints = scaleAndCenterPoints(contour, 256, 256, cx2, cy2, size2);
      }
    } catch (err) {
      console.warn('DALL-E silhouette failed, falling back to parametric shape:', err.message || err);
    }
  }

  if (!rawPoints) {
    // Fallback: parametric shapes
    const shapes = [
      { name: 'כוכב', fn: starPoints },
      { name: 'לב', fn: heartPoints },
      { name: 'בית', fn: housePoints },
      { name: 'דג', fn: fishPoints },
      { name: 'עץ', fn: treePoints },
      { name: 'פרפר', fn: butterflyPoints },
    ];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    rawPoints = shape.fn(cx2, cy2, size2, numDots);
  }

  // Draw dots and numbers
  ctx.textBaseline = 'middle';
  for (let i = 0; i < rawPoints.length; i++) {
    const p = rawPoints[i];

    // Dot
    ctx.beginPath(); ctx.arc(p.x, p.y, dotSize, 0, Math.PI * 2);
    ctx.fillStyle = '#000'; ctx.fill();

    // Number label (offset to avoid overlap with dot)
    ctx.fillStyle = '#FF6B6B'; ctx.font = `bold ${fontSize}px Rubik, Arial`;
    ctx.textAlign = 'center';
    const labelOffset = dotSize + fontSize * 0.6;
    // Place label above or below depending on position
    const labelY = p.y < cy2 ? p.y - labelOffset : p.y + labelOffset;
    ctx.fillText(`${i + 1}`, p.x, labelY);
  }

  // Light hint lines (very faint dashed)
  if (detail === 'simple') {
    ctx.setLineDash([2, 8]);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rawPoints[0].x, rawPoints[0].y);
    for (let i = 1; i < rawPoints.length; i++) ctx.lineTo(rawPoints[i].x, rawPoints[i].y);
    ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Difficulty label
  const labels = { simple: 'קל 🟢', medium: 'בינוני 🟡', detailed: 'קשה 🔴' };
  ctx.fillStyle = '#636E72'; ctx.font = '18px Rubik, Arial'; ctx.textAlign = 'center';
  ctx.fillText(`רמה: ${labels[detail]} · ${numDots} נקודות`, 512, 950);

  return c.toDataURL('image/png');
}

// ── Shape point generators ──────────────
function starPoints(cx, cy, size, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const angle = t * Math.PI * 2 - Math.PI / 2;
    const spike = (i % 2 === 0) ? size : size * 0.45;
    pts.push({ x: cx + Math.cos(angle) * spike, y: cy + Math.sin(angle) * spike });
  }
  return pts;
}

function heartPoints(cx, cy, size, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push({ x: cx + x * (size / 17), y: cy + y * (size / 17) });
  }
  return pts;
}

function housePoints(cx, cy, size, n) {
  // House outline: base rectangle + triangle roof
  const path = [
    { x: cx - size * 0.6, y: cy + size * 0.7 },   // bottom-left
    { x: cx - size * 0.6, y: cy - size * 0.1 },   // top-left wall
    { x: cx, y: cy - size * 0.7 },                 // roof peak
    { x: cx + size * 0.6, y: cy - size * 0.1 },   // top-right wall
    { x: cx + size * 0.6, y: cy + size * 0.7 },   // bottom-right
  ];
  return distributePointsOnPath(path, n, true);
}

function fishPoints(cx, cy, size, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    // Fish shape using parametric equation
    const r = size * (0.7 + 0.3 * Math.cos(t));
    const x = r * Math.cos(t) * (1 + 0.3 * Math.cos(t));
    const y = r * Math.sin(t) * 0.6;
    pts.push({ x: cx + x, y: cy + y });
  }
  return pts;
}

function treePoints(cx, cy, size, n) {
  const path = [
    { x: cx - size * 0.1, y: cy + size * 0.8 },   // trunk bottom-left
    { x: cx - size * 0.1, y: cy + size * 0.2 },   // trunk top-left
    { x: cx - size * 0.6, y: cy + size * 0.2 },   // tree bottom-left
    { x: cx - size * 0.35, y: cy - size * 0.15 },  // mid-left
    { x: cx - size * 0.5, y: cy - size * 0.15 },   // second tier left
    { x: cx, y: cy - size * 0.7 },                  // top
    { x: cx + size * 0.5, y: cy - size * 0.15 },   // second tier right
    { x: cx + size * 0.35, y: cy - size * 0.15 },   // mid-right
    { x: cx + size * 0.6, y: cy + size * 0.2 },    // tree bottom-right
    { x: cx + size * 0.1, y: cy + size * 0.2 },    // trunk top-right
    { x: cx + size * 0.1, y: cy + size * 0.8 },    // trunk bottom-right
  ];
  return distributePointsOnPath(path, n, true);
}

function butterflyPoints(cx, cy, size, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = size * 0.6 * (Math.sin(2 * t) + 0.3);
    const x = r * Math.cos(t);
    const y = r * Math.sin(t) * 0.9;
    pts.push({ x: cx + x, y: cy + y });
  }
  return pts;
}

// ── Contour extraction ──────────────────
async function extractContourFromImage(imageDataUrl, targetDots) {
  const img = await loadImage(imageDataUrl);
  const size = 256;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, size, size);
  const scale = Math.min(size / img.width, size / img.height) * 0.85;
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  const imageData = ctx.getImageData(0, 0, size, size);
  const binary = thresholdImage(imageData, 128);
  const contour = traceContour(binary, size, size);
  if (!contour || contour.length < 3) return null;
  // Simplify to target number of dots
  let epsilon = 1;
  let simplified = rdpSimplify(contour, epsilon);
  while (simplified.length > targetDots && epsilon < 50) {
    epsilon += 0.5;
    simplified = rdpSimplify(contour, epsilon);
  }
  while (simplified.length < targetDots && epsilon > 0.5) {
    epsilon -= 0.3;
    simplified = rdpSimplify(contour, epsilon);
  }
  // If still too many, sample evenly
  if (simplified.length > targetDots) {
    const step = simplified.length / targetDots;
    const sampled = [];
    for (let i = 0; i < targetDots; i++) sampled.push(simplified[Math.floor(i * step)]);
    simplified = sampled;
  }
  return simplified;
}

function thresholdImage(imageData, threshold) {
  const { data, width, height } = imageData;
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const gray = (r + g + b) / 3;
    binary[i] = gray < threshold ? 1 : 0;
  }
  return binary;
}

function traceContour(binary, w, h) {
  // Find first black pixel (start of contour)
  let startX = -1, startY = -1;
  outer: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (binary[y * w + x] === 1) { startX = x; startY = y; break outer; }
    }
  }
  if (startX < 0) return null;

  // Moore-neighbor tracing
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];
  const contour = [{ x: startX, y: startY }];
  let cx = startX, cy = startY, dir = 7; // start looking from left

  for (let step = 0; step < w * h * 2; step++) {
    let found = false;
    const startDir = (dir + 5) % 8; // backtrack
    for (let i = 0; i < 8; i++) {
      const d = (startDir + i) % 8;
      const nx = cx + dx[d], ny = cy + dy[d];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && binary[ny * w + nx] === 1) {
        cx = nx; cy = ny; dir = d;
        if (cx === startX && cy === startY) return contour; // closed loop
        contour.push({ x: cx, y: cy });
        found = true;
        break;
      }
    }
    if (!found) break;
  }
  return contour;
}

function rdpSimplify(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDist = 0, maxIdx = 0;
  const first = points[0], last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointLineDistance(points[i], first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function pointLineDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function scaleAndCenterPoints(points, srcW, srcH, cx, cy, size) {
  // Find bounding box of source points
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const bw = maxX - minX || 1, bh = maxY - minY || 1;
  const scale = Math.min(size * 2 / bw, size * 2 / bh);
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  return points.map(p => ({
    x: cx + (p.x - midX) * scale,
    y: cy + (p.y - midY) * scale
  }));
}
