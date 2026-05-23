var STORAGE_KEY = 'rubynotes';
var notes = [];
var activeId = null;
var currentView = 'editor';
var termActive = false;
var WS_PORT = 8081;

var notesList = document.getElementById('notes-list');
var editorEmpty = document.getElementById('editor-empty');
var editorContent = document.getElementById('editor-content');
var docsContent = document.getElementById('docs-content');
var noteTitle = document.getElementById('note-title');
var noteBody = document.getElementById('note-body');
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
  activeId = null; noteTitle.value = ''; noteBody.value = ''; livePreview.innerHTML = ''; destroyTerminal();
  editorEmpty.classList.remove('hidden'); editorContent.classList.add('hidden'); renderNotesList();
}

function showEditorView() {
  currentView = 'editor'; docsContent.classList.add('hidden');
  editorContent.classList.remove('hidden'); editorEmpty.classList.add('hidden'); updateDocsBtn();
}
function showDocsView() {
  currentView = 'docs'; activeId = null; destroyTerminal();
  editorContent.classList.add('hidden'); editorEmpty.classList.add('hidden');
  docsContent.classList.remove('hidden'); updateDocsBtn(); renderNotesList();
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
  else if (/^\/\/terminal/m.test(body)) { cliType = 'default'; body = body.replace(/^\/\/terminal\s*\n?/gm, ''); }

  editorContent.classList.toggle('whitepaper', isWhitepaper);
  editorContent.classList.toggle('terminal-mode', !!cliType);

  if (cliType) {
    livePreview.innerHTML = '';
  } else {
    try {
      setEmeraldNotes(notes);
      livePreview.innerHTML = parseEmerald(body);
    } catch(e) { livePreview.innerHTML = '<p style="color:var(--red)">Preview error</p>'; }
  }

  if (cliType && activeId) {
    openTerminal(cliType);
  } else if (!cliType) {
    destroyTerminal();
  }
}

function autoSave() {
  if (!activeId || currentView !== 'editor') return;
  var note = notes.find(function(n) { return n.id === activeId; });
  if (!note) return;
  note.title = noteTitle.value; note.body = noteBody.value; note.updatedAt = Date.now();
  saveNotes(); saveStatus.textContent = 'Saved ' + new Date().toLocaleTimeString(); renderNotesList();
}

var SELF_RENDER_CSS = "body{background:#0c0c0c;color:#bbb;font-family:'IBM Plex Mono','Fira Code','SF Mono','Consolas',monospace;font-size:13px;line-height:1.75;padding:40px 48px;max-width:780px;margin:0 auto}h1{font-size:20px;color:#eee;border-bottom:1px solid #2a2a2a;padding-bottom:8px}h1::before{content:'# ';color:#3f3}h2{font-size:16px;color:#eee;margin-top:24px}h2::before{content:'## ';color:#3f3;opacity:.6}h3{font-size:14px;color:#bbb}h3::before{content:'### ';color:#3f3;opacity:.4}p{margin:6px 0;color:#bbb}strong{color:#eee;font-weight:700}em{font-style:italic}code{background:#111;color:#3f3;padding:1px 5px;font-size:.92em}pre{background:#080808;border:1px solid #2a2a2a;padding:14px 16px;overflow-x:auto;white-space:pre-wrap}ul{list-style:none;padding:0;margin:6px 0}li{padding:4px 0 4px 16px;position:relative;color:#bbb}li::before{content:'-';position:absolute;left:0;color:#666}";
var SELF_RENDER_JS = parseEmerald.toString();

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

/* ===================== REAL TERMINAL (Electron PTY + xterm.js) ===================== */

var termInstance = null;
var termFitAddon = null;
var termSessionId = null;
var termDataUnsubscribe = null;
var termExitUnsubscribe = null;
var currentTerminalType = null;
var terminalDisposables = [];

var CLI_NAMES = {
  default: 'SHELL',
  opencode: 'OPENCODE',
  qwen: 'QWEN',
  codex: 'CODEX',
  agy: 'ANTIGRAVITY',
  kilo: 'KILO'
};

function terminalColors(type) {
  var map = {
    default: { bg:'#0c0c0c', fg:'#33ff33', cursor:'#33ff33', border:'#33ff33' },
    opencode: { bg:'#0c0c0c', fg:'#00cc66', cursor:'#00cc66', border:'#00cc66' },
    qwen: { bg:'#0c0c0c', fg:'#55aaff', cursor:'#55aaff', border:'#55aaff' },
    codex: { bg:'#0c0c0c', fg:'#ff9933', cursor:'#ff9933', border:'#ff9933' },
    agy: { bg:'#0c0c0c', fg:'#ff55ff', cursor:'#ff55ff', border:'#ff55ff' },
    kilo: { bg:'#0c0c0c', fg:'#aaaaaa', cursor:'#aaaaaa', border:'#888888' }
  };
  return map[type] || map.default;
}

function openTerminal(type) {
  if (termActive && currentTerminalType === type && termInstance) return;

  destroyTerminal();
  termActive = true;
  currentTerminalType = type;

  var displayName = CLI_NAMES[type] || type.toUpperCase();
  var colors = terminalColors(type);

  var wrap = document.createElement('div');
  wrap.className = 'cli-wrap';
  wrap.style.borderColor = colors.border;
  wrap.innerHTML =
    '<div class="cli-wrap-header">' +
      '<span>' + esc(displayName) + '</span>' +
      '<button class="cli-wrap-close">&times;</button>' +
    '</div>' +
    '<div class="cli-term"></div>';

  cliContainer.appendChild(wrap);

  var termEl = wrap.querySelector('.cli-term');
  var closeBtn = wrap.querySelector('.cli-wrap-close');

  termInstance = new Terminal({
    cursorBlink: true,
    fontFamily: '"IBM Plex Mono","Fira Code","SF Mono","Cascadia Code","Consolas","Courier New",monospace',
    fontSize: 13,
    lineHeight: 1.3,
    theme: {
      background: colors.bg,
      foreground: colors.fg,
      cursor: colors.cursor,
      selectionBackground: 'rgba(51,255,51,0.3)'
    },
    allowProposedApi: true,
    allowTransparency: false,
    scrollback: 5000
  });

  if (typeof FitAddon !== 'undefined') {
    termFitAddon = new FitAddon.FitAddon();
    termInstance.loadAddon(termFitAddon);
    termInstance.open(termEl);
    try { termFitAddon.fit(); } catch(e) {}
  } else {
    termInstance.open(termEl);
  }

  connectTerminal(type);

  closeBtn.addEventListener('click', function() { destroyTerminal(); });

  var resizeObserver = new ResizeObserver(function() {
    if (termFitAddon) try { termFitAddon.fit(); } catch(e) {}
    resizeTerminalSession();
  });
  resizeObserver.observe(termEl);
  terminalDisposables.push(function() { try { resizeObserver.disconnect(); } catch(e) {} });
}

function connectTerminal(type) {
  if (window.rubyNotesTerminal) {
    connectElectronTerminal(type);
    return;
  }

  connectWebSocketTerminal(type);
}

function connectElectronTerminal(type) {
  if (!termInstance) return;

  var api = window.rubyNotesTerminal;
  var id = 'term-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  termSessionId = id;

  termDataUnsubscribe = api.onData(id, function(data) {
    if (termInstance) termInstance.write(data);
  });

  termExitUnsubscribe = api.onExit(id, function(payload) {
    if (termInstance && termActive) {
      termInstance.writeln('\r\n\x1b[90m[terminal exited: ' + payload.exitCode + ']\x1b[0m\r\n');
    }
  });

  var dataDisposable = termInstance.onData(function(data) {
    if (termSessionId) api.write(termSessionId, data);
  });
  terminalDisposables.push(function() { try { dataDisposable.dispose(); } catch(e) {} });

  api.create({
    id: id,
    type: type,
    cols: termInstance.cols || 100,
    rows: termInstance.rows || 28
  }).then(function() {
    resizeTerminalSession();
  }).catch(function(err) {
    if (termInstance) {
      termInstance.writeln('\r\n\x1b[91m[terminal error: ' + esc(err && err.message ? err.message : err) + ']\x1b[0m\r\n');
    }
  });
}

function resizeTerminalSession() {
  if (!termInstance || !termSessionId || !window.rubyNotesTerminal) return;
  try {
    window.rubyNotesTerminal.resize(termSessionId, termInstance.cols, termInstance.rows);
  } catch(e) {}
}

function connectWebSocketTerminal(type) {
  var proto = location.protocol === 'https:' ? 'wss' : 'ws';
  var wsUrl = proto + '://' + location.hostname + ':' + WS_PORT + '/ws/' + type;

  var termSocket = new WebSocket(wsUrl);
  termSocket.binaryType = 'arraybuffer';
  terminalDisposables.push(function() { try { termSocket.close(); } catch(e) {} });

  termSocket.onopen = function() {
    if (termInstance) {
      var dataDisposable = termInstance.onData(function(data) {
        if (termSocket && termSocket.readyState === WebSocket.OPEN) {
          termSocket.send(JSON.stringify({ type: 'input', data: data }));
        }
      });
      terminalDisposables.push(function() { try { dataDisposable.dispose(); } catch(e) {} });

      termSocket.send(JSON.stringify({ type: 'resize', rows: termInstance.rows, cols: termInstance.cols }));
    }
  };

  termSocket.onmessage = function(ev) {
    if (termInstance) {
      termInstance.write(new Uint8Array(ev.data));
    }
  };

  termSocket.onclose = function() {
    if (termInstance) {
      termInstance.writeln('\r\n\x1b[90m[terminal disconnected]\x1b[0m\r\n');
    }
  };

  termSocket.onerror = function() {
    if (termInstance) {
      termInstance.writeln('\r\n\x1b[91m[connection error — is server.py running?]\x1b[0m\r\n');
    }
  };
}

function destroyTerminal() {
  terminalDisposables.forEach(function(dispose) { try { dispose(); } catch(e) {} });
  terminalDisposables = [];

  if (termDataUnsubscribe) {
    try { termDataUnsubscribe(); } catch(e) {}
    termDataUnsubscribe = null;
  }
  if (termExitUnsubscribe) {
    try { termExitUnsubscribe(); } catch(e) {}
    termExitUnsubscribe = null;
  }
  if (termSessionId && window.rubyNotesTerminal) {
    try { window.rubyNotesTerminal.dispose(termSessionId); } catch(e) {}
  }
  termSessionId = null;

  if (termInstance) {
    try { termInstance.dispose(); } catch(e) {}
    termInstance = null;
  }
  termFitAddon = null;
  termActive = false;
  currentTerminalType = null;
  cliContainer.innerHTML = '';
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
