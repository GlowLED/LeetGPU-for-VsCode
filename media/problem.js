const vscode = acquireVsCodeApi();
const language = document.getElementById('language');
const gpu = document.getElementById('gpu');
const toast = document.getElementById('toast');
let currentTab = 'problem';
let solutionsPage = 1;

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
language.addEventListener('change', () => {
  solutionsPage = 1;
  vscode.postMessage({ command: 'openLanguage', language: language.value });
});

document.querySelectorAll('nav button').forEach((button) => button.addEventListener('click', () => {
  currentTab = button.dataset.tab;
  if (currentTab === 'solutions') solutionsPage = 1;
  document.querySelectorAll('nav button,.tab').forEach((element) => element.classList.remove('active'));
  button.classList.add('active');
  document.getElementById(currentTab).classList.add('active');
  if (currentTab !== 'problem') loadCurrentTab();
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

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const submission = event.target.closest('[data-submission-id]');
  if (!submission) return;
  event.preventDefault();
  vscode.postMessage({ command: 'openSubmission', submissionId: submission.dataset.submissionId });
});

window.addEventListener('message', ({ data }) => {
  if (data.type === 'state') {
    const previous = data.language;
    language.replaceChildren(...data.languages.map((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.selected = value === previous;
      return option;
    }));
    setAccelerator(data.accelerator);
    if (currentTab !== 'problem') loadCurrentTab();
  }
  if (data.type === 'accelerator') setAccelerator(data.accelerator);
  if (data.type === 'tabData') renderRows(data.tab, data.data);
  if (data.type === 'error') showError(data.message);
  if (data.type === 'invalidate' && data.tabs.includes(currentTab) && currentTab !== 'problem') loadCurrentTab();
  if (data.type === 'activateTab') document.querySelector(`nav button[data-tab="${data.tab}"]`)?.click();
});

function loadCurrentTab() {
  const target = document.getElementById(currentTab);
  if (!target || currentTab === 'problem') return;
  target.innerHTML = '<div class="placeholder">Loading…</div>';
  vscode.postMessage({
    command: 'loadTab',
    tab: currentTab,
    language: language.value,
    page: currentTab === 'solutions' ? solutionsPage : 1
  });
}

function renderRows(tab, payload) {
  if (tab === 'solutions') {
    renderSolutions(payload);
    return;
  }

  const target = document.getElementById(tab);
  const rows = Array.isArray(payload) ? payload : payload?.[tab] || payload?.submissions || payload?.leaderboard || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    target.innerHTML = '<div class="placeholder">No entries are available.</div>';
    return;
  }
  const preferred = tab === 'submissions'
    ? ['status','runtime','language','accelerator','createdAt','created_at','id']
    : ['rank','username','displayName','runtime','score','language','accelerator'];
  const allKeys = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
  const keys = [...preferred.filter((key) => allKeys.includes(key)), ...allKeys.filter((key) => !preferred.includes(key))].slice(0, 7);
  const table = document.createElement('table');
  const thead = table.createTHead().insertRow();
  keys.forEach((key) => {
    const th = document.createElement('th');
    th.textContent = key;
    thead.appendChild(th);
  });
  const tbody = table.createTBody();
  rows.forEach((row) => {
    const tr = tbody.insertRow();
    if (tab === 'submissions' && row.id) {
      tr.dataset.submissionId = row.id;
      tr.title = 'Open submitted code in a read-only editor';
      tr.tabIndex = 0;
    }
    keys.forEach((key) => {
      const td = tr.insertCell();
      const value = row[key];
      td.textContent = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
  });
  target.replaceChildren(table);
}

function renderSolutions(payload) {
  const target = document.getElementById('solutions');
  const rows = Array.isArray(payload) ? payload : payload?.solutions || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    target.innerHTML = '<div class="placeholder">No public solutions are available for this language and accelerator.</div>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'solution-list';
  rows.forEach((row, index) => {
    const card = document.createElement('article');
    card.className = 'solution-card';

    const header = document.createElement('div');
    header.className = 'solution-header';
    const author = document.createElement('strong');
    author.textContent = row?.displayName || 'LeetGPU user';
    const metadata = document.createElement('span');
    metadata.className = 'solution-metadata';
    const parts = [];
    if (row?.executionTime != null) parts.push(formatRuntime(row.executionTime));
    if (row?.fileName) parts.push(String(row.fileName));
    metadata.textContent = parts.join(' · ');
    header.append(author, metadata);
    card.appendChild(header);

    const viewCode = document.createElement('button');
    viewCode.className = 'view-code';
    viewCode.textContent = 'View Code';
    viewCode.disabled = typeof row?.fileContent !== 'string';
    viewCode.addEventListener('click', () => vscode.postMessage({
      command: 'openSolution',
      solutionId: String(row?.id || `${solutionsPage}-${index}-${row?.displayName || 'solution'}`),
      fileName: String(row?.fileName || defaultSolutionFileName(language.value)),
      content: row?.fileContent
    }));
    card.appendChild(viewCode);
    list.appendChild(card);
  });
  target.replaceChildren(list);

  const totalPages = Number(payload?.totalPages) || 1;
  const page = Number(payload?.page) || solutionsPage;
  if (totalPages > 1) target.appendChild(solutionPagination(page, totalPages, Number(payload?.totalRecords)));
}

function solutionPagination(page, totalPages, totalRecords) {
  const controls = document.createElement('div');
  controls.className = 'pagination';
  const previous = document.createElement('button');
  previous.textContent = 'Previous';
  previous.disabled = page <= 1;
  const label = document.createElement('span');
  label.textContent = `Page ${page} of ${totalPages}${Number.isFinite(totalRecords) ? ` · ${totalRecords} solutions` : ''}`;
  const next = document.createElement('button');
  next.textContent = 'Next';
  next.disabled = page >= totalPages;
  previous.addEventListener('click', () => changeSolutionsPage(page - 1));
  next.addEventListener('click', () => changeSolutionsPage(page + 1));
  controls.append(previous, label, next);
  return controls;
}

function changeSolutionsPage(page) {
  solutionsPage = page;
  loadCurrentTab();
}

function formatRuntime(value) {
  const runtime = Number(value);
  if (!Number.isFinite(runtime)) return String(value);
  if (runtime < 1000) return `${runtime.toFixed(4)}ms`;
  if (runtime < 60000) return `${(runtime / 1000).toFixed(4)}s`;
  return `${Math.floor(runtime / 60000)}m ${((runtime % 60000) / 1000).toFixed(4)}s`;
}

function defaultSolutionFileName(selectedLanguage) {
  if (selectedLanguage === 'cuda') return 'solution.cu';
  if (selectedLanguage === 'mojo') return 'solution.mojo';
  return 'solution.py';
}

function showError(message) {
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 6000);
}

function setAccelerator(accelerator) {
  gpu.textContent = `Accelerator: ${accelerator}`;
}

vscode.postMessage({ command: 'ready' });
