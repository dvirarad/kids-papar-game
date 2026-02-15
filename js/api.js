// ══════════════════════════════════════════
// API — OpenAI API communication
// ══════════════════════════════════════════

async function callDalle(prompt, size = '1024x1024') {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, quality: 'standard', response_format: 'b64_json' })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `HTTP ${res.status}`);
  }
  return (await res.json()).data[0].b64_json;
}

async function convertPhotoToLineArt(photoB64) {
  // Convert photo to PNG blob for the image edit API
  const img = await loadImage(photoB64);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  const scale = Math.max(1024 / img.width, 1024 / img.height);
  ctx.drawImage(img, (1024 - img.width * scale) / 2, (1024 - img.height * scale) / 2, img.width * scale, img.height * scale);
  const pngDataUrl = c.toDataURL('image/png');
  const pngBlob = base64ToBlob(pngDataUrl);

  const form = new FormData();
  form.append('image', pngBlob, 'photo.png');
  form.append('prompt', 'Convert this photo into a children\'s coloring book style portrait. Pure black and white LINE ART with bold clean outlines on white background. Keep the EXACT same face, hair, and clothing as in the photo. Cute friendly cartoon style suitable for kids to color. NO shading, NO gray, NO color — ONLY black outlines on pure white.');
  form.append('model', 'gpt-image-1');
  form.append('size', '1024x1024');
  form.append('response_format', 'b64_json');

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `HTTP ${res.status}`);
  }
  return (await res.json()).data[0].b64_json;
}

// Use GPT-4o Vision to describe a child's appearance from a photo
async function describeChildPhoto(photoB64) {
  const base64Data = photoB64.split(',')[1];
  const mediaType = photoB64.match(/data:(image\/\w+);/)?.[1] || 'image/jpeg';

  const models = ['gpt-4o-mini', 'gpt-4o']; // try mini first (cheaper, more available)

  for (const model of models) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mediaType};base64,${base64Data}`, detail: 'low' }
              },
              {
                type: 'text',
                text: 'Describe this child\'s appearance for an illustrator in one sentence. Include: approximate age, hair style and color, clothing, and pose. Do NOT include the child\'s name. Keep it brief and factual. Example: "a 5-year-old girl with long brown curly hair, wearing a pink dress, standing and smiling"'
              }
            ]
          }]
        })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.warn(`Vision ${model} failed: ${res.status}`, errBody.error?.message);
        continue; // try next model
      }
      const data = await res.json();
      const desc = data.choices?.[0]?.message?.content;
      if (desc) return desc;
    } catch (e) {
      console.warn(`Vision ${model} error:`, e);
    }
  }
  // If all models fail, return a generic description
  return 'a happy smiling child';
}

async function validateKey() {
  const input = document.getElementById('apiKey');
  const status = document.getElementById('keyStatus');
  const btn = document.getElementById('validateBtn');
  const key = input.value.trim();
  document.getElementById('keyError').classList.remove('visible');
  if (!key) { showError('keyError', 'נא להזין מפתח API.'); return; }
  status.className = 'key-status loading';
  status.innerHTML = '<span class="spinner"></span> מאמת...';
  btn.disabled = true;
  try {
    const res = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
    if (res.ok) {
      const data = await res.json();
      if (data.data?.some(m => m.id.includes('dall-e'))) {
        status.className = 'key-status success';
        status.textContent = '✓ מחובר — DALL·E 3 זמין';
        apiKey = key;
        setTimeout(() => goToScreen(1), 500);
      } else {
        status.className = 'key-status error';
        status.textContent = '✗ המפתח עובד אך DALL·E לא נמצא';
        showError('keyError', 'המפתח אינו תומך ב-DALL·E (2 או 3). ודאו שהמפתח שייך לחשבון עם גישה ל-DALL·E וקרדיט טעון.');
      }
    } else if (res.status === 401) {
      status.className = 'key-status error'; status.textContent = '✗ מפתח לא תקין';
    } else {
      status.className = 'key-status error'; status.textContent = '✗ שגיאה — בדקו את הקרדיט';
    }
  } catch { status.className = 'key-status error'; status.textContent = '✗ שגיאת רשת — בדקו את החיבור'; }
  btn.disabled = false;
}
