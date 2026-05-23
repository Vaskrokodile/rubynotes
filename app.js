const STORAGE_KEY = 'rubynotes';

let notes = [];
let activeId = null;
let currentView = 'editor';
let cliActive = false;
let cliHistory = [];
let cliHistIdx = -1;

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
  currentView = 'editor';
  activeId = id;
  cliActive = false;
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

  try {
    setEmeraldNotes(notes);
    previewBody.innerHTML = parseEmerald(body);
  } catch (e) {
    previewBody.innerHTML = '<p style="color:var(--red)">Preview error</p>';
  }

  var existing = document.getElementById('em-cli');
  if (existing) existing.remove();
  cliActive = false;

  if (isTerminal && activeId) {
    appendCLI(previewBody);
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
  reader.onload = function(ev) { importFileContent(file.name, ev.target.result); };
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

/* ===================== EMERALD CLI ===================== */

function appendCLI(container) {
  if (cliActive) return;
  cliActive = true;

  const note = notes.find(n => n.id === activeId);
  const noteName = (note ? note.title : 'untitled') || 'untitled';
  const noteBodyTxt = note ? note.body : '';

  const cli = document.createElement('div');
  cli.className = 'em-cli';
  cli.id = 'em-cli';
  cli.innerHTML =
    '<div class="em-cli-banner">' +
      '<div class="em-cli-logo">E M E R A L D</div>' +
      '<div class="em-cli-subtitle">AI Coding Harness v1.0 &mdash; context: '+esc(noteName)+'.mrld</div>' +
    '</div>' +
    '<div class="em-cli-output" id="em-cli-output"></div>' +
    '<div class="em-cli-input-line">' +
      '<span class="em-cli-prompt">emerald &gt;</span>' +
      '<input class="em-cli-input" id="em-cli-input" placeholder="Type a command... (help)" />' +
    '</div>';

  container.appendChild(cli);

  const output = cli.querySelector('#em-cli-output');
  const input = cli.querySelector('#em-cli-input');

  cliHistory = [];
  cliHistIdx = -1;

  cliWrite(output, 'EMERALD AI Coding Harness ready.', 'info');
  cliWrite(output, 'Context loaded: ' + esc(noteName) + '.mrld (' + noteBodyTxt.split('\n').length + ' lines)', 'info');
  cliWrite(output, '', '');
  cliWrite(output, 'Type help for commands. The note above is my context.', 'out');
  cliWrite(output, 'You can say things like "build this app" or "explain the architecture".', 'out');
  cliWrite(output, '', '');

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const cmd = input.value.trim();
      input.value = '';
      if (cmd) {
        cliHistory.push(cmd);
        cliHistIdx = cliHistory.length;
        processCLI(output, cmd, noteName, noteBodyTxt);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cliHistory.length > 0) {
        if (cliHistIdx === cliHistory.length) cliHistIdx = cliHistory.length - 1;
        else if (cliHistIdx > 0) cliHistIdx--;
        input.value = cliHistory[cliHistIdx] || '';
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cliHistIdx < cliHistory.length - 1) {
        cliHistIdx++;
        input.value = cliHistory[cliHistIdx] || '';
      } else {
        cliHistIdx = cliHistory.length;
        input.value = '';
      }
    }
  });

  input.focus();
  output.scrollTop = output.scrollHeight;
}

function cliWrite(output, text, type) {
  const div = document.createElement('div');
  div.className = 'em-cli-msg em-cli-msg-' + (type || 'out');
  div.innerHTML = text;
  output.appendChild(div);
  output.scrollTop = output.scrollHeight;
}

function cliWriteCmd(output, cmd) {
  cliWrite(output, '<span class="em-cli-prompt">emerald &gt;</span> ' + esc(cmd), 'cmd');
}

function processCLI(output, cmd, noteName, noteBodyTxt) {
  cliWriteCmd(output, cmd);
  const lower = cmd.toLowerCase().trim();

  if (lower === 'help') {
    cliWrite(output, '  <strong>help</strong>       — show this menu', 'out');
    cliWrite(output, '  <strong>clear</strong>      — clear the terminal', 'out');
    cliWrite(output, '  <strong>context</strong>    — show note context summary', 'out');
    cliWrite(output, '  <strong>explain</strong>    — explain the note content and structure', 'out');
    cliWrite(output, '  <strong>tasks</strong>      — extract all tasks with due dates', 'out');
    cliWrite(output, '  <strong>build</strong>      — simulate building the project from note spec', 'out');
    cliWrite(output, '  <strong>review</strong>     — code-review the note as a spec document', 'out');
    cliWrite(output, '  <strong>arch</strong>       — generate architecture from note description', 'out');
    cliWrite(output, '  <strong>exit</strong>       — close the terminal', 'out');
  } else if (lower === 'clear') {
    output.innerHTML = '';
    return;
  } else if (lower === 'exit') {
    cliActive = false;
    const cli = document.getElementById('em-cli');
    if (cli) cli.remove();
    return;
  } else if (lower === 'context') {
    cliWrite(output, '  <strong>Note:</strong> ' + esc(noteName) + '.mrld', 'out');
    cliWrite(output, '  <strong>Lines:</strong> ' + noteBodyTxt.split('\n').length + ' | <strong>Chars:</strong> ' + noteBodyTxt.length, 'out');
    const headers = noteBodyTxt.match(/^(#|!!|Title:|h[234]:)\s*.+/gm);
    if (headers) {
      cliWrite(output, '  <strong>Sections detected:</strong>', 'out');
      headers.forEach(h => cliWrite(output, '    &bull; ' + esc(h.replace(/^(#|!!|Title:|h[234]:)\s*/, '')), 'out'));
    }
  } else if (lower === 'tasks') {
    const tasks = noteBodyTxt.match(/^>\s*.+/gm);
    if (tasks && tasks.length) {
      cliWrite(output, '  Found <strong>' + tasks.length + '</strong> tasks:', 'info');
      tasks.forEach(t => {
        const text = t.replace(/^>\s*/, '');
        cliWrite(output, '    [ ] ' + esc(text), 'out');
      });
    } else {
      cliWrite(output, '  No tasks found.', 'err');
    }
  } else if (lower === 'explain') {
    cliWrite(output, '  Analyzing <strong>' + esc(noteName) + '.mrld</strong>...', 'info');
    cliWrite(output, '', '');
    const lines = noteBodyTxt.split('\n').filter(l => l.trim()).length;
    cliWrite(output, '  This note contains ' + lines + ' lines of Emerald syntax.', 'out');
    if (/>\s/.test(noteBodyTxt)) cliWrite(output, '  Detected <strong>task blocks</strong> with checkboxes and due dates.', 'out');
    if (/@ai\s/.test(noteBodyTxt)) cliWrite(output, '  Contains <strong>@ai command blocks</strong> — ready for AI execution.', 'out');
    if (/@memory\s/.test(noteBodyTxt)) cliWrite(output, '  Has <strong>@memory tags</strong> for persistent AI context.', 'out');
    if (/^---/m.test(noteBodyTxt)) cliWrite(output, '  Includes <strong>frontmatter</strong> with structured metadata.', 'out');
    if (/\|.*\|/.test(noteBodyTxt)) cliWrite(output, '  Contains <strong>tables</strong> with structured data.', 'out');
    if (/~.*~/.test(noteBodyTxt)) cliWrite(output, '  Has <strong>kanban boards</strong> for project tracking.', 'out');
    if (/{{note:/.test(noteBodyTxt)) cliWrite(output, '  Uses <strong>transclusion</strong> to embed other notes.', 'out');
    cliWrite(output, '', '');
    cliWrite(output, '  The note is structured as a self-contained specification.', 'out');
    cliWrite(output, '  It describes architecture, tasks, questions, and metadata —', 'out');
    cliWrite(output, '  everything I need to understand and act on the project.', 'out');
  } else if (lower.startsWith('build')) {
    cliWrite(output, '  Reading specification from <strong>' + esc(noteName) + '.mrld</strong>...', 'info');
    setTimeout(() => {
      cliWrite(output, '  Parsing project structure and dependencies...', 'out');
      setTimeout(() => {
        cliWrite(output, '  Generating scaffold based on note architecture...', 'out');
        const tasks = (noteBodyTxt.match(/^>\s*.+/gm) || []).length;
        if (tasks > 0) {
          cliWrite(output, '  Found ' + tasks + ' tasks to implement.', 'info');
        }
        setTimeout(() => {
          cliWrite(output, '', '');
          cliWrite(output, '  <strong style="color:var(--green)">Build simulation complete.</strong>', 'info');
          cliWrite(output, '  In a real environment, I would generate the full project', 'out');
          cliWrite(output, '  based on the specification in ' + esc(noteName) + '.mrld.', 'out');
          cliWrite(output, '  The note contains all necessary context for implementation.', 'out');
        }, 300);
      }, 400);
    }, 200);
  } else if (lower.startsWith('review')) {
    cliWrite(output, '  Performing code review of <strong>' + esc(noteName) + '.mrld</strong>...', 'info');
    cliWrite(output, '', '');
    cliWrite(output, '  <strong style="color:var(--yellow)">Review Findings:</strong>', 'out');
    cliWrite(output, '  Structure is well-organized with clear sections.', 'out');
    cliWrite(output, '  Tasks are properly defined with due dates.', 'out');
    const warnings = noteBodyTxt.match(/^!\s*.+/gm);
    if (warnings && warnings.length) {
      cliWrite(output, '  ' + warnings.length + ' warnings/risks flagged for attention.', 'out');
    }
    cliWrite(output, '  Recommendation: add more detail to implementation tasks.', 'out');
    cliWrite(output, '  Overall score: <strong style="color:var(--green)">8.5/10</strong>', 'info');
  } else if (lower.startsWith('arch')) {
    cliWrite(output, '  Generating architecture from <strong>' + esc(noteName) + '.mrld</strong>...', 'info');
    cliWrite(output, '', '');
    cliWrite(output, '<span class="em-cli-msg-code">' +
      esc(noteName) + '\n' +
      '\u251C\u2500\u2500 Components derived from note:\n' +
      '    \u251C\u2500\u2500 Frontend: React + TypeScript\n' +
      '    \u251C\u2500\u2500 Backend: Node.js + Express\n' +
      '    \u2514\u2500\u2500 Database: PostgreSQL\n' +
      '\n' +
      '  Data flow: Client \u2192 API \u2192 Service \u2192 DB\n' +
      '  Auth: JWT tokens with refresh rotation\n' +
      '  Deploy: Docker + Kubernetes</span>', 'out');
    cliWrite(output, '', '');
    cliWrite(output, '  This architecture is <strong>inferred</strong> from your note.', 'out');
    cliWrite(output, '  Add more detail to refine the generated structure.', 'out');
  } else {
    cliWrite(output, '  <span style="color:var(--red)">Unknown command: ' + esc(cmd) + '</span>', 'err');
    cliWrite(output, '  Type <strong>help</strong> to see available commands.', 'out');
  }

  cliWrite(output, '', '');
  output.scrollTop = output.scrollHeight;
}

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
