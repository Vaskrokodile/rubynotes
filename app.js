const STORAGE_KEY = 'rubynotes';

let notes = [];
let activeId = null;
let currentView = 'editor';
let terminalOpen = false;

const notesList = document.getElementById('notes-list');
const editorEmpty = document.getElementById('editor-empty');
const editorContent = document.getElementById('editor-content');
const docsContent = document.getElementById('docs-content');
const noteTitle = document.getElementById('note-title');
const noteBody = document.getElementById('note-body');
const noteFilename = document.getElementById('note-filename');
const saveStatus = document.getElementById('save-status');
const newNoteBtn = document.getElementById('new-note-btn');
const deleteNoteBtn = document.getElementById('delete-note-btn');
const docsBtn = document.getElementById('docs-btn');
const tabEdit = document.getElementById('tab-edit');
const tabPreview = document.getElementById('tab-preview');
const paneEdit = document.getElementById('pane-edit');
const panePreview = document.getElementById('pane-preview');
const previewTitle = document.getElementById('preview-title');
const previewBody = document.getElementById('preview-body');
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');

const termPanel = document.getElementById('terminal-panel');
const termOutput = document.getElementById('terminal-output');
const termInput = document.getElementById('terminal-input');
const termClose = document.getElementById('terminal-close');
const termHeader = document.querySelector('.terminal-header span');

const TERM_HISTORY = [];
let termHistIdx = -1;

function loadNotes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { notes = JSON.parse(raw); } catch (e) { notes = []; }
  }
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function renderNotesList() {
  notes.sort((a, b) => b.updatedAt - a.updatedAt);
  notesList.innerHTML = '';
  notes.forEach(note => {
    const el = document.createElement('div');
    el.className = 'note-item' + (note.id === activeId && currentView === 'editor' ? ' active' : '');
    const titleRow = document.createElement('div');
    titleRow.className = 'note-item-title-row';
    const titleEl = document.createElement('span');
    titleEl.className = 'note-item-title';
    titleEl.textContent = note.title || 'untitled';
    const extEl = document.createElement('span');
    extEl.className = 'note-item-ext';
    extEl.textContent = '.mrld';
    titleRow.appendChild(titleEl);
    titleRow.appendChild(extEl);
    const previewEl = document.createElement('div');
    previewEl.className = 'note-item-preview';
    previewEl.textContent = note.body.replace(/^\/\/\w+.*\n?/gm, '').slice(0, 60) || 'No content';
    const dateEl = document.createElement('div');
    dateEl.className = 'note-item-date';
    dateEl.textContent = formatDate(note.updatedAt);
    el.appendChild(titleRow);
    el.appendChild(previewEl);
    el.appendChild(dateEl);
    el.addEventListener('click', () => selectNote(note.id));
    notesList.appendChild(el);
  });
}

function selectNote(id) {
  closeTerminal();
  currentView = 'editor';
  activeId = id;
  const note = notes.find(n => n.id === id);
  if (note) {
    noteTitle.value = note.title;
    noteBody.value = note.body;
    updateFilename();
    updatePreview();
  }
  showEditorView();
  setMode('preview');
  renderNotesList();
  updateDocsBtn();
}

function updateFilename() {
  noteFilename.textContent = (noteTitle.value || 'untitled') + '.mrld';
}

function createNote() {
  closeTerminal();
  const now = Date.now();
  const note = { id: now.toString(), title: '', body: '', createdAt: now, updatedAt: now };
  notes.push(note);
  saveNotes();
  currentView = 'editor';
  activeId = note.id;
  noteTitle.value = '';
  noteBody.value = '';
  updateFilename();
  updatePreview();
  showEditorView();
  setMode('edit');
  renderNotesList();
  updateDocsBtn();
}

function deleteNote() {
  if (!activeId || currentView !== 'editor') return;
  notes = notes.filter(n => n.id !== activeId);
  saveNotes();
  activeId = null;
  noteTitle.value = '';
  noteBody.value = '';
  noteFilename.textContent = '';
  closeTerminal();
  setMode('edit');
  editorEmpty.classList.remove('hidden');
  editorContent.classList.add('hidden');
  renderNotesList();
}

function showEditorView() {
  currentView = 'editor';
  docsContent.classList.add('hidden');
  editorContent.classList.remove('hidden');
  editorEmpty.classList.add('hidden');
  updateDocsBtn();
}

function showDocsView() {
  currentView = 'docs';
  activeId = null;
  closeTerminal();
  editorContent.classList.add('hidden');
  editorEmpty.classList.add('hidden');
  docsContent.classList.remove('hidden');
  updateDocsBtn();
  renderNotesList();
}

function updateDocsBtn() {
  docsBtn.classList.toggle('active', currentView === 'docs');
}

function setMode(mode) {
  if (mode === 'edit') {
    tabEdit.classList.add('active');
    tabPreview.classList.remove('active');
    paneEdit.classList.remove('hidden');
    panePreview.classList.add('hidden');
    noteBody.focus();
  } else {
    tabPreview.classList.add('active');
    tabEdit.classList.remove('active');
    panePreview.classList.remove('hidden');
    paneEdit.classList.add('hidden');
    updatePreview();
  }
}

function updatePreview() {
  if (!activeId) return;
  previewTitle.textContent = noteTitle.value || 'Untitled';
  let body = noteBody.value;
  let isWhitepaper = false;
  let isTerminal = false;

  if (/^\/\/whitepaper/m.test(body)) {
    isWhitepaper = true;
    body = body.replace(/^\/\/whitepaper\s*\n?/gm, '');
  }
  if (/^\/\/terminal/m.test(body)) {
    isTerminal = true;
    body = body.replace(/^\/\/terminal\s*\n?/gm, '');
  }

  panePreview.classList.toggle('whitepaper', isWhitepaper);

  if (isTerminal && activeId) {
    const note = notes.find(n => n.id === activeId);
    openTerminal(note ? note.title : 'untitled', note ? note.body : body);
  }

  try {
    setEmeraldNotes(notes);
    previewBody.innerHTML = parseEmerald(body);
  } catch (e) {
    previewBody.innerHTML = '<p style="color:var(--red)">Preview error</p>';
  }
}

function autoSave() {
  if (!activeId || currentView !== 'editor') return;
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  note.title = noteTitle.value;
  note.body = noteBody.value;
  note.updatedAt = Date.now();
  saveNotes();
  saveStatus.textContent = 'Saved ' + new Date().toLocaleTimeString();
  renderNotesList();
}

function buildSelfRenderingHTML(title, body) {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n<title>'+esc(title||'untitled')+'</title>\n<style>\n' +
    SELF_RENDER_CSS +
    '\n</style>\n</head>\n<body>\n<div id="mrld">\n</div>\n<script>\n' +
    SELF_RENDER_JS +
    '\n(function(){var c=document.getElementById("mrld");c.innerHTML=parseEmerald('+JSON.stringify(body)+');})();\n</script>\n</body>\n</html>';
}

function exportNote() {
  if (!activeId || currentView !== 'editor') return;
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  const filename = (note.title || 'untitled') + '.mrld';
  const html = buildSelfRenderingHTML(note.title, note.body);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  saveStatus.textContent = 'Exported ' + filename + ' (self-opening)';
}

function importFileContent(filename, content) {
  const now = Date.now();
  const title = filename.replace(/\.mrld$/i, '');
  const note = { id: now.toString(), title: title, body: content, createdAt: now, updatedAt: now };
  notes.push(note);
  saveNotes();
  currentView = 'editor';
  activeId = note.id;
  noteTitle.value = note.title;
  noteBody.value = note.body;
  updateFilename();
  updatePreview();
  showEditorView();
  setMode('preview');
  renderNotesList();
  updateDocsBtn();
  saveStatus.textContent = 'Imported ' + filename;
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.endsWith('.mrld')) {
    saveStatus.textContent = 'Only .mrld files supported';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(ev) {
    importFileContent(file.name, ev.target.result);
  };
  reader.readAsText(file);
  importFile.value = '';
}

function triggerImport() { importFile.click(); }

function setupDragDrop() {
  const app = document.querySelector('.app');
  let dragCounter = 0;
  app.addEventListener('dragenter', function(e) {
    e.preventDefault(); e.stopPropagation();
    dragCounter++;
    if (dragCounter === 1) noteBody.classList.add('drag-over');
  });
  app.addEventListener('dragleave', function(e) {
    e.preventDefault(); e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) noteBody.classList.remove('drag-over');
  });
  app.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); });
  app.addEventListener('drop', function(e) {
    e.preventDefault(); e.stopPropagation();
    dragCounter = 0;
    noteBody.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.endsWith('.mrld')) continue;
      const reader = new FileReader();
      reader.onload = (function(filename) {
        return function(ev) { importFileContent(filename, ev.target.result); };
      })(file.name);
      reader.readAsText(file);
    }
  });
}

/* ===================== TERMINAL ===================== */

function openTerminal(noteTitle, noteBody) {
  terminalOpen = true;
  termPanel.classList.add('open');
  termHeader.textContent = 'opencode --context ' + (noteTitle || 'untitled') + '.mrld';
  termOutput.innerHTML = '';
  termWrite('<span class="term-info">opencode v4.0 — context loaded: ' + (noteTitle || 'untitled') + '.mrld</span>', '');
  termWrite('Context summary:', '');
  const lines = noteBody.split('\n').filter(l => l.trim());
  termWrite('  ' + lines.length + ' lines, ' + noteBody.length + ' chars', 'term-out');
  termWrite('', '');
  termWrite('Type <span class="term-cmd">help</span> for commands, <span class="term-cmd">clear</span> to reset.', 'term-out');
  termWrite('', '');
  termInput.value = '';
  termInput.focus();
  TERM_HISTORY.length = 0;
  termHistIdx = -1;
}

function closeTerminal() {
  terminalOpen = false;
  termPanel.classList.remove('open');
}

function termWrite(text, cls) {
  const div = document.createElement('div');
  div.className = 'term-line ' + (cls || '');
  div.innerHTML = text;
  termOutput.appendChild(div);
  termOutput.scrollTop = termOutput.scrollHeight;
}

function termWriteCmd(cmd) {
  termWrite('<span class="term-prompt" style="color:var(--green);font-weight:700">$</span> <span class="term-cmd">' + esc(cmd) + '</span>', '');
}

function processTermCommand(cmd) {
  const trimmed = cmd.trim();
  if (!trimmed) return;

  TERM_HISTORY.push(trimmed);
  termHistIdx = TERM_HISTORY.length;
  termWriteCmd(trimmed);

  const lower = trimmed.toLowerCase();

  if (lower === 'help') {
    termWrite('  opencode commands:', 'term-out');
    termWrite('  <span class="term-cmd">help</span>       — show this', 'term-out');
    termWrite('  <span class="term-cmd">clear</span>      — clear terminal', 'term-out');
    termWrite('  <span class="term-cmd">context</span>    — show note context summary', 'term-out');
    termWrite('  <span class="term-cmd">build</span>      — simulate building from note spec', 'term-out');
    termWrite('  <span class="term-cmd">explain</span>    — explain the note content', 'term-out');
    termWrite('  <span class="term-cmd">tasks</span>      — extract all tasks from note', 'term-out');
    termWrite('  <span class="term-cmd">exit</span>       — close terminal', 'term-out');
  } else if (lower === 'clear') {
    termOutput.innerHTML = '';
  } else if (lower === 'exit') {
    closeTerminal();
    return;
  } else if (lower === 'context') {
    const note = notes.find(n => n.id === activeId);
    if (note) {
      termWrite('  Note: ' + (note.title || 'untitled') + '.mrld', 'term-out');
      termWrite('  Lines: ' + note.body.split('\n').length, 'term-out');
      const headers = note.body.match(/^(#|!!|Title:|h[234]:)\s*.+/gm);
      if (headers) {
        termWrite('  Sections:', 'term-out');
        headers.forEach(h => termWrite('    ' + h.replace(/^(#|!!|Title:|h[234]:)\s*/, ''), 'term-out'));
      }
    }
  } else if (lower === 'tasks') {
    const note = notes.find(n => n.id === activeId);
    if (note) {
      const tasks = note.body.match(/^>\s*.+/gm);
      if (tasks && tasks.length) {
        termWrite('  Found ' + tasks.length + ' tasks:', 'term-info');
        tasks.forEach(t => termWrite('    [ ] ' + t.replace(/^>\s*/, ''), 'term-out'));
      } else {
        termWrite('  No tasks found in note.', 'term-out');
      }
    }
  } else if (lower === 'explain') {
    const note = notes.find(n => n.id === activeId);
    if (note) {
      termWrite('  Analyzing: ' + (note.title || 'untitled') + '.mrld', 'term-info');
      termWrite('', '');
      const lines = note.body.split('\n').filter(l => l.trim()).length;
      const hasTasks = />\s/.test(note.body);
      const hasAi = /@ai\s/.test(note.body);
      const hasFm = /^---/m.test(note.body);
      termWrite('  This note contains ' + lines + ' lines of Emerald syntax.', 'term-out');
      if (hasTasks) termWrite('  Includes actionable tasks with checkboxes.', 'term-out');
      if (hasAi) termWrite('  Contains @ai command blocks ready for AI execution.', 'term-out');
      if (hasFm) termWrite('  Has YAML-like frontmatter with structured metadata.', 'term-out');
      termWrite('', '');
      termWrite('  The note is structured as a self-contained document.', 'term-out');
      termWrite('  All syntax renders in the Preview tab. Use //whitepaper', 'term-out');
      termWrite('  to view as a formal document, or //terminal to open', 'term-out');
      termWrite('  this session.', 'term-out');
    }
  } else if (lower.startsWith('build')) {
    termWrite('  Building from note context...', 'term-info');
    const note = notes.find(n => n.id === activeId);
    if (note) {
      setTimeout(() => {
        termWrite('  Scanning project structure...', 'term-out');
        setTimeout(() => {
          termWrite('  Resolving dependencies from note spec...', 'term-out');
          setTimeout(() => {
            termWrite('  <span class="term-info">Build complete.</span> Output would be generated', 'term-info');
            termWrite('  based on the instructions in ' + (note.title || 'untitled') + '.mrld', 'term-out');
          }, 300);
        }, 300);
      }, 200);
    }
  } else {
    termWrite('  <span class="term-err">opencode: command not found: ' + esc(trimmed) + '</span>', '');
    termWrite('  Type <span class="term-cmd">help</span> for available commands.', 'term-out');
  }

  termWrite('', '');
  termOutput.scrollTop = termOutput.scrollHeight;
}

termInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const cmd = termInput.value;
    termInput.value = '';
    processTermCommand(cmd);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (TERM_HISTORY.length > 0) {
      if (termHistIdx === TERM_HISTORY.length) termHistIdx = TERM_HISTORY.length - 1;
      else if (termHistIdx > 0) termHistIdx--;
      termInput.value = TERM_HISTORY[termHistIdx] || '';
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (termHistIdx < TERM_HISTORY.length - 1) {
      termHistIdx++;
      termInput.value = TERM_HISTORY[termHistIdx] || '';
    } else {
      termHistIdx = TERM_HISTORY.length;
      termInput.value = '';
    }
  }
});

termClose.addEventListener('click', closeTerminal);

/* ===================== INIT ===================== */

let saveTimer = null;
noteTitle.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveStatus.textContent = 'Saving...';
  updateFilename();
  saveTimer = setTimeout(() => { autoSave(); updatePreview(); }, 400);
});
noteBody.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveStatus.textContent = 'Saving...';
  saveTimer = setTimeout(() => { autoSave(); updatePreview(); }, 400);
});

newNoteBtn.addEventListener('click', createNote);
deleteNoteBtn.addEventListener('click', deleteNote);
docsBtn.addEventListener('click', showDocsView);
tabEdit.addEventListener('click', () => setMode('edit'));
tabPreview.addEventListener('click', () => setMode('preview'));
exportBtn.addEventListener('click', exportNote);
importBtn.addEventListener('click', triggerImport);
importFile.addEventListener('change', handleFileSelect);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString();
  return d.toLocaleDateString();
}

function init() {
  loadNotes();
  renderNotesList();
  updateDocsBtn();
  setupDragDrop();
}

init();

const SELF_RENDER_CSS = "body{background:#0c0c0c;color:#bbb;font-family:'IBM Plex Mono','Fira Code','SF Mono','Consolas',monospace;font-size:13px;line-height:1.75;padding:40px 48px;max-width:780px;margin:0 auto}h1{font-size:20px;color:#eee;border-bottom:1px solid #2a2a2a;padding-bottom:8px}h1::before{content:'# ';color:#3f3}h2{font-size:16px;color:#eee;margin-top:24px}h2::before{content:'## ';color:#3f3;opacity:.6}h3{font-size:14px;color:#bbb}h3::before{content:'### ';color:#3f3;opacity:.4}p{margin:6px 0;color:#bbb}strong{color:#eee;font-weight:700}code{background:#111;color:#3f3;padding:1px 5px;font-size:.92em}pre{background:#080808;border:1px solid #2a2a2a;padding:14px 16px;overflow-x:auto;white-space:pre-wrap}ul{list-style:none;padding:0;margin:6px 0}li{padding:4px 0 4px 16px;position:relative;color:#bbb}li::before{content:'-';position:absolute;left:0;color:#666}em-ai{display:block;border-left:2px solid #3f3;padding:6px 12px;margin:6px 0;background:rgba(51,255,51,.04)}em-ai::before{content:'@ai ';color:#3f3;font-weight:700}em-memory{display:block;border-left:2px solid #fc3;padding:6px 12px;margin:6px 0;background:rgba(255,204,51,.06)}em-memory::before{content:'MEM ';background:#fc3;color:#000;font-size:9px;font-weight:800;padding:1px 6px;margin-right:8px;letter-spacing:1px}em-cal{display:block;border-left:2px solid #5af;padding:6px 10px;margin:4px 0;background:rgba(85,170,255,.04)}em-cal::before{content:attr(data-date);color:#5af;font-weight:700;font-size:11px;background:rgba(85,170,255,.1);padding:1px 6px;margin-right:8px}.em-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}.em-table th{text-align:left;color:#3f3;font-weight:600;padding:8px 12px;border-bottom:1px solid #3f3;text-transform:uppercase;letter-spacing:.5px}.em-table td{padding:7px 12px;border-bottom:1px solid #2a2a2a}.em-kanban{display:flex;gap:10px;margin:12px 0}.em-kb-col{flex:1;min-width:160px;border:1px solid #2a2a2a;background:#080808}.em-kb-col-header{padding:8px 12px;font-size:11px;font-weight:700;color:#3f3;border-bottom:1px solid #2a2a2a;text-transform:uppercase}.em-kb-item{padding:6px 12px;border-bottom:1px solid #111;font-size:12px}.em-transclude{border:1px solid #f5f;margin:10px 0}.em-transclude-header{padding:6px 14px;background:rgba(255,85,255,.06);font-size:11px;color:#f5f;font-weight:600;border-bottom:1px solid #2a2a2a}.em-transclude-body{padding:10px 14px;font-size:12px}.em-frontmatter{border:1px solid #2a2a2a;padding:12px 14px;background:#080808;margin-bottom:14px}.em-fm-row{display:flex;gap:10px;padding:3px 0}.em-fm-key{color:#3f3;font-size:12px;font-weight:600}.em-fm-val{color:#bbb;font-size:12px}.em-inline-prop{display:inline-flex;gap:4px;padding:2px 8px;background:#111;border:1px solid #2a2a2a;font-size:11px}.em-ip-key{color:#3f3;font-weight:600}.em-ip-val{color:#bbb}.em-ip-tag{color:#666}";

const SELF_RENDER_JS = parseEmerald.toString();
