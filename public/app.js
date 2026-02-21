const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');
const previewModal = document.getElementById('previewModal');
const previewTitle = document.getElementById('previewTitle');
const previewMeta = document.getElementById('previewMeta');
const previewContent = document.getElementById('previewContent');
const closeModal = document.getElementById('closeModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const sendFromPreview = document.getElementById('sendFromPreview');
const toast = document.getElementById('toast');

let currentPreview = null;

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching...';
  resultsDiv.innerHTML = '<p class="loading-text">Searching for tabs...</p>';

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Search failed');
    }

    const { results } = await res.json();
    renderResults(results);
  } catch (err) {
    resultsDiv.innerHTML = `<p class="no-results">${err.message}</p>`;
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
});

function renderResults(results) {
  if (!results || results.length === 0) {
    resultsDiv.innerHTML = '<p class="no-results">No results found. Try different search terms.</p>';
    return;
  }

  resultsDiv.innerHTML = results.map((r, i) => `
    <div class="result-card">
      <div class="result-info">
        <h3>${esc(r.title)}</h3>
        <span class="artist">${esc(r.artist)}</span>
      </div>
      <div class="result-meta">
        <span class="type">${esc(r.type)}</span>
        ${r.rating ? `<span>Rating: ${r.rating.toFixed(1)}</span>` : ''}
        ${r.votes ? `<span>${r.votes.toLocaleString()} votes</span>` : ''}
      </div>
      <div class="result-actions">
        <button class="btn btn-secondary btn-sm" onclick="preview(${i})">Preview</button>
        <button class="btn btn-primary btn-sm" onclick="send(${i})" id="send-${i}">Send</button>
      </div>
    </div>
  `).join('');

  window._results = results;
}

async function preview(idx) {
  const r = window._results[idx];
  if (!r) return;

  previewTitle.textContent = `${r.title} — ${r.artist}`;
  previewMeta.textContent = 'Loading...';
  previewContent.textContent = '';
  previewModal.style.display = 'flex';
  sendFromPreview.disabled = true;

  try {
    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: r.url }),
    });

    if (!res.ok) throw new Error('Failed to load');

    const { sheet } = await res.json();
    currentPreview = { url: r.url, title: sheet.title, artist: sheet.artist };

    const metaParts = [];
    if (sheet.key) metaParts.push(`Key: ${sheet.key}`);
    if (sheet.capo && sheet.capo !== 'none') metaParts.push(`Capo: ${sheet.capo}`);
    if (sheet.tuning && sheet.tuning !== 'Standard') metaParts.push(`Tuning: ${sheet.tuning}`);
    previewMeta.textContent = metaParts.join('  |  ') || sheet.artist;
    previewContent.textContent = sheet.content;
    sendFromPreview.disabled = false;
  } catch (err) {
    previewMeta.textContent = '';
    previewContent.textContent = 'Could not load chord sheet. Try again.';
  }
}
window.preview = preview;

async function send(idx) {
  const r = window._results[idx];
  if (!r) return;

  const btn = document.getElementById(`send-${idx}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: r.url, title: r.title, artist: r.artist }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Send failed');
    }

    const data = await res.json();
    showToast(`Sent "${data.title}" by ${data.artist}!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
  }
}
window.send = send;

sendFromPreview.addEventListener('click', async () => {
  if (!currentPreview) return;
  sendFromPreview.disabled = true;
  sendFromPreview.textContent = 'Sending...';

  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentPreview),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Send failed');
    }

    const data = await res.json();
    showToast(`Sent "${data.title}" by ${data.artist}!`, 'success');
    closePreviewModal();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    sendFromPreview.disabled = false;
    sendFromPreview.textContent = 'Send as PDF';
  }
});

function closePreviewModal() {
  previewModal.style.display = 'none';
  currentPreview = null;
}
closeModal.addEventListener('click', closePreviewModal);
closeModalBtn.addEventListener('click', closePreviewModal);
previewModal.addEventListener('click', (e) => {
  if (e.target === previewModal) closePreviewModal();
});

function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
