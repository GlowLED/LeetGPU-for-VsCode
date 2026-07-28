const vscode = acquireVsCodeApi();
const language = document.getElementById('language');
const gpu = document.getElementById('gpu');
const toast = document.getElementById('toast');
let currentTab = 'problem';

if (typeof window.renderMathInElement === 'function') {
  window.renderMathInElement(document.getElementById('problem'), {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false }
    ],
    throwOnError: false
  });
}

document.getElementById('run').addEventListener('click', () => vscode.postMessage({ command: 'action', action: 'run' }));
document.getElementById('submit').addEventListener('click', () => vscode.postMessage({ command: 'action', action: 'submit' }));
gpu.addEventListener('click', () => vscode.postMessage({ command: 'selectAccelerator' }));
language.addEventListener('change', () => vscode.postMessage({ command: 'openLanguage', language: language.value }));
document.querySelectorAll('nav button').forEach((button) => button.addEventListener('click', () => {
  currentTab = button.dataset.tab;
  document.querySelectorAll('nav button,.tab').forEach((element) => element.classList.remove('active'));
  button.classList.add('active');
  document.getElementById(currentTab).classList.add('active');
  if (currentTab !== 'problem') {
    document.getElementById(currentTab).innerHTML = '<div class="placeholder">Loading…</div>';
    vscode.postMessage({ command: 'loadTab', tab: currentTab, language: language.value });
  }
}));
document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a');
  if (anchor && anchor.href) {
    event.preventDefault();
    vscode.postMessage({ command: 'openExternal', url: anchor.href });
  }
  const submission = event.target.closest('[data-submission-id]');
  if (submission) vscode.postMessage({ command: 'openSubmission', submissionId: submission.dataset.submissionId });
});

window.addEventListener('message', ({ data }) => {
  if (data.type === 'state') {
    const previous = data.language;
    language.replaceChildren(...data.languages.map((value) => {
      const option = document.createElement('option');
      option.value = value; option.textContent = value; option.selected = value === previous; return option;
    }));
    setAccelerator(data.accelerator);
  }
  if (data.type === 'accelerator') setAccelerator(data.accelerator);
  if (data.type === 'tabData') renderRows(data.tab, data.data);
  if (data.type === 'error') showError(data.message);
  if (data.type === 'invalidate' && data.tabs.includes(currentTab) && currentTab !== 'problem') {
    vscode.postMessage({ command: 'loadTab', tab: currentTab, language: language.value });
  }
  if (data.type === 'activateTab') document.querySelector(`nav button[data-tab="${data.tab}"]`)?.click();
});

function renderRows(tab, payload) {
  const target = document.getElementById(tab);
  const rows = Array.isArray(payload) ? payload : payload?.[tab] || payload?.submissions || payload?.leaderboard || [];
  if (!Array.isArray(rows) || rows.length === 0) { target.innerHTML = '<div class="placeholder">No entries are available.</div>'; return; }
  const preferred = tab === 'submissions'
    ? ['status','runtime','language','accelerator','createdAt','created_at','id']
    : ['rank','username','displayName','runtime','score','language','accelerator'];
  const allKeys = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
  const keys = [...preferred.filter((key) => allKeys.includes(key)), ...allKeys.filter((key) => !preferred.includes(key))].slice(0, 7);
  const table = document.createElement('table');
  const thead = table.createTHead().insertRow(); keys.forEach((key) => { const th = document.createElement('th'); th.textContent = key; thead.appendChild(th); });
  const tbody = table.createTBody();
  rows.forEach((row) => {
    const tr = tbody.insertRow();
    if (tab === 'submissions' && row.id) { tr.dataset.submissionId = row.id; tr.title = 'Open submitted code'; tr.tabIndex = 0; }
    keys.forEach((key) => { const td = tr.insertCell(); const value = row[key]; td.textContent = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value); });
  });
  target.replaceChildren(table);
}
function showError(message) { toast.textContent = message; toast.hidden = false; setTimeout(() => { toast.hidden = true; }, 6000); }
function setAccelerator(accelerator) { gpu.textContent = `Accelerator: ${accelerator}`; }
vscode.postMessage({ command: 'ready' });
