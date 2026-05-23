var STORAGE_KEY = 'rubynotes';
var notes = [];
var activeId = null;
var currentView = 'editor';
var cliActive = false;

var notesList = document.getElementById('notes-list');
var editorEmpty = document.getElementById('editor-empty');
var editorContent = document.getElementById('editor-content');
var docsContent = document.getElementById('docs-content');
var noteTitle = document.getElementById('note-title');
var noteBody = document.getElementById('note-body');
var noteFilenameEl = document.getElementById('note-filename');
var saveStatus = document.getElementById('save-status');
var livePreview = document.getElementById('live-preview');
var cliContainer = document.getElementById('cli-container');
var newNoteBtn = document.getElementById('new-note-btn');
var deleteNoteBtn = document.getElementById('delete-note-btn');
var docsBtn = document.getElementById('docs-btn');
var importBtn = document.getElementById('import-btn');
var exportBtn = document.getElementById('export-btn');
var importFile = document.getElementById('import-file');

function loadNotes() {
  var raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { try { notes = JSON.parse(raw); } catch(e) { notes = []; } }
}
function saveNotes() { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); }

function renderNotesList() {
  notes.sort(function(a,b) { return b.updatedAt - a.updatedAt; });
  notesList.innerHTML = '';
  notes.forEach(function(note) {
    var el = document.createElement('div');
    el.className = 'note-item' + (note.id === activeId && currentView === 'editor' ? ' active' : '');
    var tr = document.createElement('div'); tr.className = 'note-item-title-row';
    var te = document.createElement('span'); te.className = 'note-item-title'; te.textContent = note.title || 'untitled';
    var ee = document.createElement('span'); ee.className = 'note-item-ext'; ee.textContent = '.mrld';
    tr.appendChild(te); tr.appendChild(ee);
    var pe = document.createElement('div'); pe.className = 'note-item-preview'; pe.textContent = note.body.replace(/^\/\/\S+.*\n?/gm,'').slice(0,60) || 'No content';
    var de = document.createElement('div'); de.className = 'note-item-date'; de.textContent = formatDate(note.updatedAt);
    el.appendChild(tr); el.appendChild(pe); el.appendChild(de);
    el.addEventListener('click', function() { selectNote(note.id); });
    notesList.appendChild(el);
  });
}

function selectNote(id) {
  currentView = 'editor'; activeId = id;
  var note = notes.find(function(n) { return n.id === id; });
  if (note) { noteTitle.value = note.title; noteBody.value = note.body; updatePreview(); }
  showEditorView(); renderNotesList(); updateDocsBtn();
}

function createNote() {
  var now = Date.now();
  notes.push({ id: now.toString(), title: '', body: '', createdAt: now, updatedAt: now });
  saveNotes(); currentView = 'editor'; activeId = notes[notes.length-1].id;
  noteTitle.value = ''; noteBody.value = ''; updatePreview();
  showEditorView(); renderNotesList(); updateDocsBtn(); noteBody.focus();
}

function deleteNote() {
  if (!activeId || currentView !== 'editor') return;
  notes = notes.filter(function(n) { return n.id !== activeId; }); saveNotes();
  activeId = null; noteTitle.value = ''; noteBody.value = ''; livePreview.innerHTML = ''; cliContainer.innerHTML = '';
  editorEmpty.classList.remove('hidden'); editorContent.classList.add('hidden'); renderNotesList();
}

function showEditorView() {
  currentView = 'editor'; docsContent.classList.add('hidden');
  editorContent.classList.remove('hidden'); editorEmpty.classList.add('hidden'); updateDocsBtn();
}
function showDocsView() {
  currentView = 'docs'; activeId = null; editorContent.classList.add('hidden');
  editorEmpty.classList.add('hidden'); docsContent.classList.remove('hidden'); updateDocsBtn(); renderNotesList();
}
function updateDocsBtn() { docsBtn.classList.toggle('active', currentView === 'docs'); }

function updatePreview() {
  if (!activeId) return;
  var body = noteBody.value;
  var isWhitepaper = false, cliType = null;

  if (/^\/\/whitepaper/m.test(body)) { isWhitepaper = true; body = body.replace(/^\/\/whitepaper\s*\n?/gm, ''); }
  if (/^\/\/terminal\s+opencode/m.test(body)) { cliType = 'opencode'; body = body.replace(/^\/\/terminal\s+opencode\s*\n?/gm, ''); }
  else if (/^\/\/terminal\s+qwen/m.test(body)) { cliType = 'qwen'; body = body.replace(/^\/\/terminal\s+qwen\s*\n?/gm, ''); }
  else if (/^\/\/terminal\s+codex/m.test(body)) { cliType = 'codex'; body = body.replace(/^\/\/terminal\s+codex\s*\n?/gm, ''); }
  else if (/^\/\/terminal\s+agy/m.test(body)) { cliType = 'agy'; body = body.replace(/^\/\/terminal\s+agy\s*\n?/gm, ''); }
  else if (/^\/\/terminal\s+kilo/m.test(body)) { cliType = 'kilo'; body = body.replace(/^\/\/terminal\s+kilo\s*\n?/gm, ''); }
  else if (/^\/\/terminal/m.test(body)) { cliType = 'emerald'; body = body.replace(/^\/\/terminal\s*\n?/gm, ''); }

  editorContent.classList.toggle('whitepaper', isWhitepaper);

  try {
    setEmeraldNotes(notes);
    livePreview.innerHTML = parseEmerald(body);
  } catch(e) { livePreview.innerHTML = '<p style="color:var(--red)">Preview error</p>'; }

  cliContainer.innerHTML = '';
  cliActive = false;
  if (cliType && activeId) appendCLI(cliType);
}

function autoSave() {
  if (!activeId || currentView !== 'editor') return;
  var note = notes.find(function(n) { return n.id === activeId; });
  if (!note) return;
  note.title = noteTitle.value; note.body = noteBody.value; note.updatedAt = Date.now();
  saveNotes(); saveStatus.textContent = 'Saved ' + new Date().toLocaleTimeString(); renderNotesList();
}

function buildSelfRenderingHTML(title, body) {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n<title>'+esc(title||'untitled')+'</title>\n<style>\n' + SELF_RENDER_CSS + '\n</style>\n</head>\n<body>\n<div id="mrld"></div>\n<script>\n' + SELF_RENDER_JS + '\n(function(){document.getElementById("mrld").innerHTML=parseEmerald('+JSON.stringify(body)+');})();\n</script>\n</body>\n</html>';
}

function exportNote() {
  if (!activeId || currentView !== 'editor') return;
  var note = notes.find(function(n) { return n.id === activeId; }); if (!note) return;
  var filename = (note.title || 'untitled') + '.mrld';
  var html = buildSelfRenderingHTML(note.title, note.body);
  var blob = new Blob([html], { type: 'text/html' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href); saveStatus.textContent = 'Exported ' + filename + ' (self-opening)';
}

function importFileContent(filename, content) {
  var now = Date.now();
  notes.push({ id: now.toString(), title: filename.replace(/\.mrld$/i,''), body: content, createdAt: now, updatedAt: now });
  saveNotes(); currentView = 'editor'; activeId = notes[notes.length-1].id;
  noteTitle.value = notes[notes.length-1].title; noteBody.value = content; updatePreview();
  showEditorView(); renderNotesList(); updateDocsBtn(); saveStatus.textContent = 'Imported ' + filename;
}
function handleFileSelect(e) {
  var file = e.target.files[0]; if (!file) return;
  if (!file.name.endsWith('.mrld')) { saveStatus.textContent = 'Only .mrld files supported'; return; }
  var reader = new FileReader();
  reader.onload = function(ev) { importFileContent(file.name, ev.target.result); };
  reader.readAsText(file); importFile.value = '';
}
function triggerImport() { importFile.click(); }
function setupDragDrop() {
  var app = document.querySelector('.app'), dc = 0;
  app.addEventListener('dragenter', function(e) { e.preventDefault(); e.stopPropagation(); dc++; if (dc===1) noteBody.classList.add('drag-over'); });
  app.addEventListener('dragleave', function(e) { e.preventDefault(); e.stopPropagation(); dc--; if (dc===0) noteBody.classList.remove('drag-over'); });
  app.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); });
  app.addEventListener('drop', function(e) {
    e.preventDefault(); e.stopPropagation(); dc=0; noteBody.classList.remove('drag-over');
    var files = e.dataTransfer.files; if (!files.length) return;
    for (var i=0; i<files.length; i++) {
      var file = files[i]; if (!file.name.endsWith('.mrld')) continue;
      (function(fn) {
        var r = new FileReader();
        r.onload = function(ev) { importFileContent(fn, ev.target.result); };
        r.readAsText(file);
      })(file.name);
    }
  });
}

/* ===================== CLI ENGINE ===================== */

var CLIS = {
  emerald: { name:'EMERALD', cls:'em-cli-emerald', prompt:'emerald >', sub:'AI Coding Harness v1.0',
    help: ['help','clear','context','explain','tasks','build','review','arch','exit'] },
  opencode: { name:'OPENCODE', cls:'em-cli-opencode', prompt:'opencode >', sub:'OpenCode AI v2.4',
    help: ['help','clear','context','build','review','refactor','test','deploy','explain','tasks','exit'] },
  qwen: { name:'QWEN', cls:'em-cli-qwen', prompt:'qwen >', sub:'Qwen Assistant — Alibaba',
    help: ['help','clear','context','chat','summarize','translate','analyze','generate','research','explain','exit'] },
  codex: { name:'CODEX', cls:'em-cli-codex', prompt:'codex >', sub:'Codex — OpenAI',
    help: ['help','clear','context','generate','complete','explain','translate','debug','optimize','exit'] },
  agy: { name:'ANTIGRAVITY', cls:'em-cli-agy', prompt:'agy >', sub:'Antigravity AGI Core',
    help: ['help','clear','context','think','solve','create','optimize','forecast','breakthrough','exit'] },
  kilo: { name:'KILO', cls:'em-cli-kilo', prompt:'kilo >', sub:'Kilo — Minimal CLI',
    help: ['help','clear','context','run','exec','eval','fmt','bench','exit'] }
};

function appendCLI(type) {
  if (cliActive) return;
  var cfg = CLIS[type] || CLIS.emerald;
  var note = notes.find(function(n) { return n.id === activeId; });
  var noteName = note ? (note.title || 'untitled') : 'untitled';
  var noteBodyTxt = note ? note.body : '';

  var cli = document.createElement('div');
  cli.className = 'em-cli ' + cfg.cls;
  cli.innerHTML =
    '<div class="em-cli-banner">' +
      '<div class="em-cli-logo">' + esc(cfg.name) + '</div>' +
      '<div class="em-cli-subtitle">' + esc(cfg.sub) + ' — context: ' + esc(noteName) + '.mrld</div>' +
    '</div>' +
    '<div class="em-cli-output"></div>' +
    '<div class="em-cli-input-line">' +
      '<span class="em-cli-prompt">' + esc(cfg.prompt) + '</span>' +
      '<input class="em-cli-input" placeholder="Type a command... (help)">' +
    '</div>';
  cliContainer.appendChild(cli);
  cliActive = true;

  var output = cli.querySelector('.em-cli-output');
  var input = cli.querySelector('.em-cli-input');
  var hist = [], hidx = -1;

  cliWrite(output, cfg.name + ' ' + cfg.sub + ' ready.', 'info');
  cliWrite(output, 'Context: ' + esc(noteName) + '.mrld (' + noteBodyTxt.split('\n').length + ' lines)', 'info');
  cliWrite(output, '', '');

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var cmd = input.value.trim(); input.value = '';
      if (cmd) { hist.push(cmd); hidx = hist.length; processCmd(output, cmd, cfg, noteName, noteBodyTxt); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hist.length) { if (hidx===hist.length) hidx=hist.length-1; else if (hidx>0) hidx--; input.value = hist[hidx]||''; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hidx < hist.length-1) { hidx++; input.value = hist[hidx]||''; }
      else { hidx = hist.length; input.value = ''; }
    }
  });
  input.focus(); output.scrollTop = output.scrollHeight;
}

function cliWrite(output, text, type) {
  var div = document.createElement('div');
  div.className = 'em-cli-msg em-cli-msg-' + (type||'out');
  div.innerHTML = text; output.appendChild(div); output.scrollTop = output.scrollHeight;
}

function processCmd(output, cmd, cfg, noteName, noteBodyTxt) {
  cliWrite(output, '<span class="em-cli-prompt">' + esc(cfg.prompt) + '</span> ' + esc(cmd), 'cmd');
  var lower = cmd.toLowerCase().trim();

  if (lower === 'help') {
    cfg.help.forEach(function(c) { cliWrite(output, '  <strong>' + c + '</strong>', 'out'); });
  } else if (lower === 'clear') { output.innerHTML = ''; return; }
  else if (lower === 'exit') { cliContainer.innerHTML = ''; cliActive = false; return; }
  else if (lower === 'context') {
    cliWrite(output, '  Note: ' + esc(noteName) + '.mrld', 'out');
    cliWrite(output, '  Lines: ' + noteBodyTxt.split('\n').length + ' | Chars: ' + noteBodyTxt.length, 'out');
    var hdrs = noteBodyTxt.match(/^(#|!!|Title:|h[234]:|##|###)\s*.+/gm);
    if (hdrs) { cliWrite(output, '  Sections:', 'out'); hdrs.forEach(function(h) { cliWrite(output, '    &bull; ' + esc(h.replace(/^(#|!!|Title:|h[234]:|##|###)\s*/,'')), 'out'); }); }
  } else if (lower === 'tasks') {
    var tasks = noteBodyTxt.match(/^>\s*.+/gm);
    if (tasks && tasks.length) { cliWrite(output, '  ' + tasks.length + ' tasks:', 'info'); tasks.forEach(function(t) { cliWrite(output, '    [ ] ' + esc(t.replace(/^>\s*/,'')), 'out'); }); }
    else cliWrite(output, '  No tasks found.', 'err');
  } else if (lower === 'explain') {
    cliWrite(output, '  Analyzing ' + esc(noteName) + '.mrld...', 'info');
    cliWrite(output, '  ' + noteBodyTxt.split('\n').filter(function(l){return l.trim();}).length + ' content lines.', 'out');
    if (/>\s/.test(noteBodyTxt)) cliWrite(output, '  Contains task blocks.', 'out');
    if (/@ai\s/.test(noteBodyTxt)) cliWrite(output, '  Has @ai commands.', 'out');
    if (/@memory\s/.test(noteBodyTxt)) cliWrite(output, '  Has @memory tags.', 'out');
    if (/^---/m.test(noteBodyTxt)) cliWrite(output, '  Has frontmatter.', 'out');
    if (/\|.*\|/.test(noteBodyTxt)) cliWrite(output, '  Contains tables.', 'out');
    if (/Kanban:/.test(noteBodyTxt) || /~.*~/.test(noteBodyTxt)) cliWrite(output, '  Has kanban boards.', 'out');
  } else if (lower === 'build') {
    cliWrite(output, '  Reading spec...', 'info');
    setTimeout(function() {
      cliWrite(output, '  Parsing structure...', 'out');
      setTimeout(function() {
        cliWrite(output, '  <strong>Build simulation complete.</strong> Output would be generated from ' + esc(noteName) + '.mrld.', 'info');
      }, 400);
    }, 200);
  } else if (lower === 'review') {
    cliWrite(output, '  Reviewing ' + esc(noteName) + '.mrld...', 'info');
    cliWrite(output, '  Structure is well-organized.', 'out');
    cliWrite(output, '  Score: <strong style="color:var(--green)">8.5/10</strong>', 'info');
  } else if (lower === 'arch') {
    cliWrite(output, '<span class="em-cli-msg-code">' + esc(noteName) + '\n\u251C\u2500\u2500 Inferred from note spec\n    \u251C\u2500\u2500 Frontend\n    \u251C\u2500\u2500 Backend\n    \u2514\u2500\u2500 Database</span>', 'out');
  } else if (lower === 'refactor') {
    cliWrite(output, '  Analyzing for refactoring opportunities...', 'info');
    cliWrite(output, '  No code smells detected in note structure.', 'out');
  } else if (lower === 'test') {
    cliWrite(output, '  Running test suite against spec...', 'info');
    cliWrite(output, '  All structural checks passed.', 'info');
  } else if (lower === 'deploy') {
    cliWrite(output, '  Simulating deployment of ' + esc(noteName) + '.mrld...', 'info');
    cliWrite(output, '  Deploy would use spec from note as build config.', 'out');
  } else if (lower === 'chat' || lower === 'summarize' || lower === 'translate' || lower === 'analyze' || lower === 'generate' || lower === 'research') {
    cliWrite(output, '  Processing request with note context...', 'info');
    cliWrite(output, '  This would use the note content as input for ' + lower + '.', 'out');
  } else if (lower === 'complete' || lower === 'debug' || lower === 'optimize') {
    cliWrite(output, '  Running ' + lower + ' on note specification...', 'info');
    cliWrite(output, '  Processed ' + noteBodyTxt.length + ' characters of context.', 'out');
  } else if (lower === 'think' || lower === 'solve' || lower === 'create' || lower === 'forecast' || lower === 'breakthrough') {
    cliWrite(output, '  Antigravity thinking on: ' + esc(noteName) + '.mrld...', 'info');
    cliWrite(output, '  Deep analysis would process the full context.', 'out');
  } else if (lower === 'run' || lower === 'exec' || lower === 'eval' || lower === 'fmt' || lower === 'bench') {
    cliWrite(output, '  Running <strong>' + lower + '</strong> on note context...', 'info');
    cliWrite(output, '  Operation complete. (' + noteBodyTxt.length + ' chars processed)', 'out');
  } else {
    cliWrite(output, '  <span style="color:var(--red)">Unknown command: ' + esc(cmd) + '</span>', 'err');
    cliWrite(output, '  Type <strong>help</strong> for available commands.', 'out');
  }
  cliWrite(output, '', ''); output.scrollTop = output.scrollHeight;
}

/* ===================== INIT ===================== */

var saveTimer = null;
noteTitle.addEventListener('input', function() {
  clearTimeout(saveTimer); saveStatus.textContent = 'Saving...';
  saveTimer = setTimeout(function() { autoSave(); updatePreview(); }, 400);
});
noteBody.addEventListener('input', function() {
  clearTimeout(saveTimer); saveStatus.textContent = 'Saving...';
  saveTimer = setTimeout(function() { autoSave(); updatePreview(); }, 400);
});

newNoteBtn.addEventListener('click', createNote);
deleteNoteBtn.addEventListener('click', deleteNote);
docsBtn.addEventListener('click', showDocsView);
exportBtn.addEventListener('click', exportNote);
importBtn.addEventListener('click', triggerImport);
importFile.addEventListener('change', handleFileSelect);

function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(ts) {
  var d = new Date(ts), now = new Date(), diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString();
  return d.toLocaleDateString();
}

function init() { loadNotes(); renderNotesList(); updateDocsBtn(); setupDragDrop(); }
init();

var SELF_RENDER_CSS = "body{background:#0c0c0c;color:#bbb;font-family:'IBM Plex Mono','Fira Code','SF Mono','Consolas',monospace;font-size:13px;line-height:1.75;padding:40px 48px;max-width:780px;margin:0 auto}h1{font-size:20px;color:#eee;border-bottom:1px solid #2a2a2a;padding-bottom:8px}h1::before{content:'# ';color:#3f3}h2{font-size:16px;color:#eee;margin-top:24px}h2::before{content:'## ';color:#3f3;opacity:.6}h3{font-size:14px;color:#bbb}h3::before{content:'### ';color:#3f3;opacity:.4}p{margin:6px 0;color:#bbb}strong{color:#eee;font-weight:700}em{font-style:italic}code{background:#111;color:#3f3;padding:1px 5px;font-size:.92em}pre{background:#080808;border:1px solid #2a2a2a;padding:14px 16px;overflow-x:auto;white-space:pre-wrap}ul{list-style:none;padding:0;margin:6px 0}li{padding:4px 0 4px 16px;position:relative;color:#bbb}li::before{content:'-';position:absolute;left:0;color:#666}";
var SELF_RENDER_JS = parseEmerald.toString();
