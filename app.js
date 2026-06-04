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
var settingsBtn = document.getElementById('settings-btn');
var settingsContent = document.getElementById('settings-content');
var settingsSaveBtn = document.getElementById('settings-save-btn');
var aiProviderInput = document.getElementById('ai-provider');
var openaiApiKeyInput = document.getElementById('openai-api-key');
var openaiBaseUrlInput = document.getElementById('openai-base-url');
var xaiApiKeyInput = document.getElementById('xai-api-key');
var xaiBaseUrlInput = document.getElementById('xai-base-url');
var textModelInput = document.getElementById('text-model');
var transcriptionModelInput = document.getElementById('transcription-model');
var xaiTextModelInput = document.getElementById('xai-text-model');
var xaiTranscriptionLanguageInput = document.getElementById('xai-transcription-language');
var voiceShortcutInput = document.getElementById('voice-shortcut');
var voiceBtn = document.getElementById('voice-btn');
var voiceTestBtn = document.getElementById('voice-test-btn');
var voiceStatus = document.getElementById('voice-status');
var aiWorking = document.getElementById('ai-working');
var aiWorkingText = document.getElementById('ai-working-text');
var importBtn = document.getElementById('import-btn');
var exportBtn = document.getElementById('export-btn');
var importFile = document.getElementById('import-file');
var renderCacheKey = null;
var renderCacheHtml = '';
var notesListTimer = null;
var lastTerminalSync = '';

function loadNotes() {
  var raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      var parsed = JSON.parse(raw);
      notes = Array.isArray(parsed) ? parsed : [];
    } catch(e) { notes = []; }
  }
  if (!Array.isArray(notes)) notes = [];
}
function saveNotes() { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); }
function scheduleNotesListRender() {
  clearTimeout(notesListTimer);
  notesListTimer = setTimeout(renderNotesList, 250);
}

function renderNotesList() {
  notes.sort(function(a,b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  notesList.innerHTML = '';
  notes.forEach(function(note) {
    if (!note || typeof note !== 'object') return;
    var el = document.createElement('div');
    el.className = 'note-item' + (note.id === activeId && currentView === 'editor' ? ' active' : '');
    var tr = document.createElement('div'); tr.className = 'note-item-title-row';
    var te = document.createElement('span'); te.className = 'note-item-title'; te.textContent = note.title || 'untitled';
    var ee = document.createElement('span'); ee.className = 'note-item-ext'; ee.textContent = '.mrld';
    tr.appendChild(te); tr.appendChild(ee);
    var body = typeof note.body === 'string' ? note.body : '';
    var pe = document.createElement('div'); pe.className = 'note-item-preview'; pe.textContent = body.replace(/^\/\/\S+.*\n?/gm,'').slice(0,60) || 'No content';
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
function createNoteFromAi(title, body) {
  var now = Date.now();
  notes.push({ id: now.toString(), title: title || 'Voice idea', body: stripDuplicateBodyTitle(title, body || ''), createdAt: now, updatedAt: now });
  saveNotes(); currentView = 'editor'; activeId = notes[notes.length-1].id;
  noteTitle.value = notes[notes.length-1].title; noteBody.value = notes[notes.length-1].body; updatePreview();
  showEditorView(); renderNotesList(); updateDocsBtn(); noteBody.focus();
}

function deleteNote() {
  if (!activeId || currentView !== 'editor') return;
  notes = notes.filter(function(n) { return n.id !== activeId; }); saveNotes();
  activeId = null; noteTitle.value = ''; noteBody.value = ''; livePreview.innerHTML = ''; destroyTerminal();
  editorEmpty.classList.remove('hidden'); editorContent.classList.add('hidden'); renderNotesList();
}

function showEditorView() {
  currentView = 'editor'; docsContent.classList.add('hidden'); settingsContent.classList.add('hidden');
  editorContent.classList.remove('hidden'); editorEmpty.classList.add('hidden'); updateDocsBtn();
}
function showDocsView() {
  currentView = 'docs'; activeId = null; destroyTerminal();
  editorContent.classList.add('hidden'); editorEmpty.classList.add('hidden');
  settingsContent.classList.add('hidden'); docsContent.classList.remove('hidden'); updateDocsBtn(); renderNotesList();
}
function showSettingsView() {
  currentView = 'settings'; activeId = null; destroyTerminal();
  editorContent.classList.add('hidden'); editorEmpty.classList.add('hidden'); docsContent.classList.add('hidden');
  settingsContent.classList.remove('hidden'); updateDocsBtn(); renderNotesList(); loadSettingsForm();
}
function updateDocsBtn() {
  docsBtn.classList.toggle('active', currentView === 'docs');
  settingsBtn.classList.toggle('active', currentView === 'settings');
}
function stripDuplicateBodyTitle(title, body) {
  var lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  var first = (lines[0] || '').trim();
  var expected = String(title || '').trim().toLowerCase();
  if (first.toLowerCase() === ('title: ' + expected) || first.toLowerCase() === ('# ' + expected)) {
    lines.shift();
    while (lines.length && !lines[0].trim()) lines.shift();
  }
  return lines.join('\n').trim();
}
function terminalNoteContext(body, cliType) {
  var note = notes.find(function(n) { return n.id === activeId; });
  var cleanedBody = body
    .replace(/^\/\/whitepaper\s*\n?/gm, '')
    .replace(/^\/\/terminal(?:\s+\S+)?\s*\n?/gm, '')
    .trim();

  return {
    id: activeId,
    title: noteTitle.value || (note && note.title) || 'untitled',
    body: cleanedBody,
    rawBody: body,
    cliType: cliType,
    updatedAt: note ? note.updatedAt : Date.now(),
    notes: notes.map(function(n) {
      return {
        id: n.id,
        title: n.title || 'untitled',
        body: n.body || '',
        updatedAt: n.updatedAt
      };
    })
  };
}

function analyzeDirectives(source) {
  var body = source || '';
  var result = { body: body, isWhitepaper: false, cliType: null };

  if (/^\/\/whitepaper/m.test(result.body)) {
    result.isWhitepaper = true;
    result.body = result.body.replace(/^\/\/whitepaper\s*\n?/gm, '');
  }

  if (/^\/\/terminal\s+opencode/m.test(result.body)) { result.cliType = 'opencode'; result.body = result.body.replace(/^\/\/terminal\s+opencode\s*\n?/gm, ''); }
  else if (/^\/\/terminal\s+qwen/m.test(result.body)) { result.cliType = 'qwen'; result.body = result.body.replace(/^\/\/terminal\s+qwen\s*\n?/gm, ''); }
  else if (/^\/\/terminal\s+codex/m.test(result.body)) { result.cliType = 'codex'; result.body = result.body.replace(/^\/\/terminal\s+codex\s*\n?/gm, ''); }
  else if (/^\/\/terminal\s+agy/m.test(result.body)) { result.cliType = 'agy'; result.body = result.body.replace(/^\/\/terminal\s+agy\s*\n?/gm, ''); }
  else if (/^\/\/terminal\s+kilo/m.test(result.body)) { result.cliType = 'kilo'; result.body = result.body.replace(/^\/\/terminal\s+kilo\s*\n?/gm, ''); }
  else if (/^\/\/terminal/m.test(result.body)) { result.cliType = 'default'; result.body = result.body.replace(/^\/\/terminal\s*\n?/gm, ''); }

  result.body = stripDuplicateBodyTitle(noteTitle.value, result.body);
  return result;
}

function syncDirectivesFromSource(source) {
  var analyzed = analyzeDirectives(source || '');
  var key = analyzed.isWhitepaper + ':' + (analyzed.cliType || 'none');
  editorContent.classList.toggle('whitepaper', analyzed.isWhitepaper);
  editorContent.classList.toggle('terminal-mode', !!analyzed.cliType);
  if (key === lastTerminalSync && (!analyzed.cliType || termActive)) {
    if (analyzed.cliType) updateTerminalContext(analyzed.cliType);
    return analyzed;
  }
  lastTerminalSync = key;
  if (analyzed.cliType && activeId) openTerminal(analyzed.cliType);
  else if (!analyzed.cliType) destroyTerminal();
  return analyzed;
}

function updatePreview() {
  if (!activeId) return;
  var body = noteBody.value;
  var analyzed = syncDirectivesFromSource(body);

  if (analyzed.cliType) {
    livePreview.innerHTML = '';
  } else {
    try {
      setEmeraldNotes(notes);
      var cacheKey = activeId + ':' + noteTitle.value + ':' + analyzed.body + ':' + notes.length;
      if (cacheKey !== renderCacheKey) {
        renderCacheHtml = parseEmerald(analyzed.body);
        renderCacheKey = cacheKey;
      }
      livePreview.innerHTML = renderCacheHtml;
    } catch(e) { livePreview.innerHTML = '<p style="color:var(--red)">Preview error</p>'; }
  }
}

/* ===================== LIVE IN-PLACE TRANSFORM ===================== */

var _transformLock = false;

function getCaretTextNode() {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  var range = sel.getRangeAt(0);
  if (!livePreview.contains(range.commonAncestorContainer)) return null;
  var node = range.endContainer;
  if (node.nodeType === Node.TEXT_NODE) return { node: node, offset: range.endOffset };
  if (node.nodeType === Node.ELEMENT_NODE) {
    var t = node.lastChild;
    while (t && t.nodeType !== Node.TEXT_NODE) t = t.lastChild;
    if (t) return { node: t, offset: t.textContent.length };
  }
  return null;
}

function setCaretAfter(node) {
  var range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function setCaretIn(node, offset) {
  var range = document.createRange();
  range.setStart(node, Math.min(offset, node.childNodes.length));
  range.collapse(true);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function replaceTextRange(textNode, start, end, replacementNode) {
  var fullText = textNode.textContent;
  var before = fullText.substring(0, start);
  var after = fullText.substring(end);
  var parent = textNode.parentNode;
  var beforeNode = before ? document.createTextNode(before) : null;
  var afterNode = after ? document.createTextNode(after) : null;
  if (beforeNode) parent.insertBefore(beforeNode, textNode);
  parent.insertBefore(replacementNode, textNode);
  if (afterNode) parent.insertBefore(afterNode, textNode);
  parent.removeChild(textNode);
  return { beforeNode: beforeNode, replacementNode: replacementNode, afterNode: afterNode };
}

function makeInlineEl(tag, inner, className) {
  var el = className ? document.createElement(tag) : document.createElement(tag);
  if (className) el.className = className;
  el.textContent = inner;
  return el;
}

function isWordBoundary(text, idx) {
  if (idx <= 0) return true;
  var ch = text[idx - 1];
  return !/[A-Za-z0-9_]/.test(ch);
}

function tryInlineTransform() {
  if (_transformLock) return;
  var info = getCaretTextNode();
  if (!info) return;
  var node = info.node;
  var text = node.textContent;
  var offset = info.offset;

  // Bold: **...** (triggered by typing the second * of **)
  if (offset >= 4 && text.substring(offset - 2, offset) === '**') {
    var before = text.substring(0, offset - 2);
    var openIdx = before.lastIndexOf('**');
    if (openIdx !== -1) {
      var inner = before.substring(openIdx + 2);
      if (inner.length > 0 && inner.indexOf('\n') === -1 && isWordBoundary(before, openIdx)) {
        _transformLock = true;
        try {
          var el = makeInlineEl('strong', inner);
          replaceTextRange(node, openIdx, offset, el);
          setCaretAfter(el);
          return;
        } finally { _transformLock = false; }
      }
    }
  }

  // Italic: *...* (triggered by typing a single * not part of **)
  if (offset >= 3 && text[offset - 1] === '*' && (offset < 2 || text[offset - 2] !== '*')) {
    var before = text.substring(0, offset - 1);
    var openIdx = before.lastIndexOf('*');
    if (openIdx !== -1) {
      var prevCh = openIdx > 0 ? before[openIdx - 1] : '';
      if (openIdx === 0 || !/[A-Za-z0-9_]/.test(prevCh)) {
        var inner = before.substring(openIdx + 1);
        if (inner.length > 0 && inner.indexOf('\n') === -1 && inner.indexOf('*') === -1) {
          _transformLock = true;
          try {
            var el = makeInlineEl('em', inner);
            replaceTextRange(node, openIdx, offset, el);
            setCaretAfter(el);
            return;
          } finally { _transformLock = false; }
        }
      }
    }
  }

  // Code: `...`
  if (offset >= 3 && text[offset - 1] === '`') {
    var before = text.substring(0, offset - 1);
    var openIdx = before.lastIndexOf('`');
    if (openIdx !== -1) {
      var inner = before.substring(openIdx + 1);
      if (inner.length > 0 && inner.indexOf('\n') === -1 && inner.indexOf('`') === -1 && isWordBoundary(before, openIdx)) {
        _transformLock = true;
        try {
          var el = makeInlineEl('code', inner);
          replaceTextRange(node, openIdx, offset, el);
          setCaretAfter(el);
          return;
        } finally { _transformLock = false; }
      }
    }
  }

  // Wikilink: [[...]]
  if (offset >= 5 && text.substring(offset - 2, offset) === ']]') {
    var before = text.substring(0, offset - 2);
    var openIdx = before.lastIndexOf('[[');
    if (openIdx !== -1) {
      var inner = before.substring(openIdx + 2);
      if (inner.length > 0 && inner.indexOf('\n') === -1 && inner.indexOf(']') === -1 && isWordBoundary(before, openIdx)) {
        _transformLock = true;
        try {
          var el = makeInlineEl('span', inner, 'em-wikilink');
          replaceTextRange(node, openIdx, offset, el);
          setCaretAfter(el);
          return;
        } finally { _transformLock = false; }
      }
    }
  }

  // Inline prop: [K:V]
  if (offset >= 4 && text[offset - 1] === ']' && (offset < 2 || text[offset - 2] !== ']')) {
    var before = text.substring(0, offset - 1);
    var openIdx = before.lastIndexOf('[');
    if (openIdx !== -1 && (openIdx === 0 || before[openIdx - 1] !== '[')) {
      var inner = before.substring(openIdx + 1);
      if (inner.length > 0 && inner.indexOf('\n') === -1 && inner.indexOf(']') === -1 && isWordBoundary(before, openIdx)) {
        var colonIdx = inner.indexOf(':');
        if (colonIdx > 0) {
          var key = inner.substring(0, colonIdx).trim();
          if (key && /^[A-Za-z0-9_\- ]+$/.test(key)) {
            _transformLock = true;
            try {
              var el = makeInlineEl('span', inner, 'em-inline-prop');
              replaceTextRange(node, openIdx, offset, el);
              setCaretAfter(el);
              return;
            } finally { _transformLock = false; }
          }
        }
      }
    }
  }
}

var BLOCK_PREFIXES = [
  { prefix: 'Title: ', tag: 'h1' },
  { prefix: 'h2: ', tag: 'h2' },
  { prefix: 'h3: ', tag: 'h3' },
  { prefix: 'h4: ', tag: 'h4' },
  { prefix: '@ai ', tag: 'div', className: 'em-ai', stripPrefix: true },
  { prefix: '@memory ', tag: 'div', className: 'em-memory', stripPrefix: true },
  { prefix: '@ ', tag: 'p', stripPrefix: true }
];

function tryBlockTransform() {
  if (_transformLock) return;
  var info = getCaretTextNode();
  if (!info) return;
  var node = info.node;
  var text = node.textContent;
  var offset = info.offset;

  for (var i = 0; i < BLOCK_PREFIXES.length; i++) {
    var p = BLOCK_PREFIXES[i];
    if (text.substring(0, p.prefix.length) === p.prefix) {
      var content = text.substring(p.prefix.length);
      _transformLock = true;
      try {
        var el = document.createElement(p.tag);
        if (p.className) el.className = p.className;
        el.textContent = content;
        var parent = node.parentNode;
        parent.insertBefore(el, node);
        parent.removeChild(node);
        var r = document.createRange();
        if (el.lastChild && el.lastChild.nodeType === Node.TEXT_NODE) {
          r.setStart(el.lastChild, el.lastChild.textContent.length);
        } else {
          r.setStart(el, el.childNodes.length);
        }
        r.collapse(true);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        return;
      } finally { _transformLock = false; }
    }
  }
}

/* ===================== SERIALIZE (DOM -> .mrld) ===================== */

function inlineToMrld(node) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  var tag = node.tagName.toLowerCase();
  var inner = '';
  for (var i = 0; i < node.childNodes.length; i++) {
    inner += inlineToMrld(node.childNodes[i]);
  }
  if (tag === 'br') return '\n';
  if (tag === 'input' || tag === 'hr') return '';
  if (tag === 'strong' || tag === 'b') {
    var t = inner.replace(/^\s+|\s+$/g, '');
    return t ? '**' + t + '**' : '';
  }
  if (tag === 'em' || tag === 'i') {
    var t = inner.replace(/^\s+|\s+$/g, '');
    return t ? '*' + t + '*' : '';
  }
  if (tag === 'code') {
    var t = inner.replace(/^\s+|\s+$/g, '');
    return t ? '`' + t + '`' : '';
  }
  if (tag === 'span' && node.classList.contains('em-wikilink')) {
    var t = node.textContent.replace(/^\s+|\s+$/g, '');
    return t ? '[[' + t + ']]' : '';
  }
  if (tag === 'span' && node.classList.contains('em-inline-prop')) {
    var t = node.textContent.replace(/^\s+|\s+$/g, '');
    return t ? '[' + t + ']' : '';
  }
  return inner;
}

function pushTextLines(text, lines) {
  String(text || '').replace(/\u00a0/g, ' ').split('\n').forEach(function(line) {
    var clean = line.trim();
    if (clean) lines.push(clean);
  });
}

function serializePreviewNode(node, lines) {
  if (node.nodeType === Node.TEXT_NODE) {
    pushTextLines(node.textContent, lines);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  var tag = node.tagName.toLowerCase();
  if (tag === 'input' || tag === 'hr' || tag === 'br') return;

  if (tag === 'h1') {
    var t = inlineToMrld(node).replace(/^#\s*/, '').replace(/^\s+|\s+$/g, '');
    if (t) lines.push('Title: ' + t);
    return;
  }
  if (tag === 'h2') {
    var t = inlineToMrld(node).replace(/^##\s*/, '').replace(/^\s+|\s+$/g, '');
    if (t) lines.push('h2: ' + t);
    return;
  }
  if (tag === 'h3') {
    var t = inlineToMrld(node).replace(/^###\s*/, '').replace(/^\s+|\s+$/g, '');
    if (t) lines.push('h3: ' + t);
    return;
  }
  if (tag === 'h4') {
    var t = inlineToMrld(node).replace(/^####\s*/, '').replace(/^\s+|\s+$/g, '');
    if (t) lines.push('h4: ' + t);
    return;
  }
  if (tag === 'p' || tag === 'div' || tag === 'span') {
    var t = inlineToMrld(node);
    var trimmed = t.replace(/^\s+|\s+$/g, '');
    if (!trimmed) return;
    if (node.classList.contains('em-ai')) lines.push('@ai ' + trimmed);
    else if (node.classList.contains('em-memory')) lines.push('@memory ' + trimmed);
    else if (node.classList.contains('em-wikilink')) lines.push('[[' + trimmed + ']]');
    else if (node.classList.contains('em-inline-prop')) lines.push('[' + trimmed + ']');
    else pushTextLines(t, lines);
    return;
  }
  pushTextLines(inlineToMrld(node), lines);
}

function serializeLivePreview() {
  var lines = [];
  Array.prototype.forEach.call(livePreview.childNodes, function(node) {
    serializePreviewNode(node, lines);
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function autoSave() {
  if (!activeId || currentView !== 'editor') return;
  var note = notes.find(function(n) { return n.id === activeId; });
  if (!note) return;
  note.title = noteTitle.value; note.body = noteBody.value; note.updatedAt = Date.now();
  saveNotes(); saveStatus.textContent = 'Saved ' + new Date().toLocaleTimeString(); scheduleNotesListRender();
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

function stripTerminalDirectives(body) {
  return String(body || '').replace(/^\/\/terminal(?:\s+\S+)?[ \t]*\n?/gm, '');
}

function importFileContent(filename, content) {
  var now = Date.now();
  var safeBody = stripTerminalDirectives(content);
  notes.push({ id: now.toString(), title: filename.replace(/\.mrld$/i,''), body: safeBody, createdAt: now, updatedAt: now });
  saveNotes(); currentView = 'editor'; activeId = notes[notes.length-1].id;
  noteTitle.value = notes[notes.length-1].title; noteBody.value = safeBody; updatePreview();
  showEditorView(); renderNotesList(); updateDocsBtn();
  if (safeBody !== content) saveStatus.textContent = 'Imported ' + filename + ' (terminal directive stripped)';
  else saveStatus.textContent = 'Imported ' + filename;
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
  function setDrag(on) { noteBody.classList.toggle('drag-over', on); editorContent.classList.toggle('drag-over', on); }
  app.addEventListener('dragenter', function(e) { e.preventDefault(); e.stopPropagation(); dc++; if (dc===1) setDrag(true); });
  app.addEventListener('dragleave', function(e) { e.preventDefault(); e.stopPropagation(); dc--; if (dc===0) setDrag(false); });
  app.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); });
  app.addEventListener('drop', function(e) {
    e.preventDefault(); e.stopPropagation(); dc=0; setDrag(false);
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
  if (termActive && currentTerminalType === type && termInstance) {
    updateTerminalContext(type);
    return;
  }

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

function updateTerminalContext(type) {
  if (!termSessionId || !window.rubyNotesTerminal) return;
  try {
    window.rubyNotesTerminal.updateContext(termSessionId, terminalNoteContext(noteBody.value, type));
  } catch(e) {}
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
    rows: termInstance.rows || 28,
    noteContext: terminalNoteContext(noteBody.value, type)
  }).then(function() {
    resizeTerminalSession();
  }).catch(function(err) {
    if (termInstance) {
      termInstance.writeln('\r\n\x1b[91m[terminal error: ' + esc(err && err.message ? err.message : err) + ']\x1b[0m\r\n');
    }
  });
}

/* ===================== SETTINGS + VOICE NOTES ===================== */

var mediaRecorder = null;
var audioChunks = [];
var recording = false;

function setVoiceStatus(text) {
  if (voiceStatus) voiceStatus.textContent = text || '';
}
function setAiWorking(active, text) {
  aiWorking.classList.toggle('hidden', !active);
  aiWorkingText.textContent = text || 'AI is working';
}

function loadSettingsForm() {
  if (!window.rubyNotesSettings) return;
  window.rubyNotesSettings.get().then(function(settings) {
    aiProviderInput.value = settings.aiProvider || 'openai';
    openaiApiKeyInput.value = settings.openaiApiKey || '';
    openaiBaseUrlInput.value = settings.openaiBaseUrl || 'https://api.openai.com/v1';
    xaiApiKeyInput.value = settings.xaiApiKey || '';
    xaiBaseUrlInput.value = settings.xaiBaseUrl || 'https://api.x.ai/v1';
    textModelInput.value = settings.textModel || 'gpt-5.2';
    transcriptionModelInput.value = settings.transcriptionModel || 'gpt-4o-mini-transcribe';
    xaiTextModelInput.value = settings.xaiTextModel || 'grok-4.3';
    xaiTranscriptionLanguageInput.value = settings.xaiTranscriptionLanguage || 'en';
    voiceShortcutInput.value = settings.voiceShortcut || 'CommandOrControl+Shift+Space';
  }).catch(function(err) { setVoiceStatus(err.message || 'Could not load settings'); });
}

function saveSettingsForm() {
  if (!window.rubyNotesSettings) return;
  setVoiceStatus('Saving settings...');
  window.rubyNotesSettings.save({
    aiProvider: aiProviderInput.value,
    openaiApiKey: openaiApiKeyInput.value,
    openaiBaseUrl: openaiBaseUrlInput.value,
    xaiApiKey: xaiApiKeyInput.value,
    xaiBaseUrl: xaiBaseUrlInput.value,
    textModel: textModelInput.value,
    transcriptionModel: transcriptionModelInput.value,
    xaiTextModel: xaiTextModelInput.value,
    xaiTranscriptionLanguage: xaiTranscriptionLanguageInput.value,
    voiceShortcut: voiceShortcutInput.value
  }).then(function(settings) {
    openaiApiKeyInput.value = settings.openaiApiKey || '';
    xaiApiKeyInput.value = settings.xaiApiKey || '';
    setVoiceStatus('Settings saved');
  }).catch(function(err) { setVoiceStatus(err.message || 'Could not save settings'); });
}

function captureShortcut(e) {
  var parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  var key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (['Control','Shift','Alt','Meta'].indexOf(key) === -1) parts.push(key === ' ' ? 'Space' : key);
  if (parts.length) voiceShortcutInput.value = parts.join('+');
}

function startVoiceCapture() {
  if (recording) return stopVoiceCapture();
  if (!window.rubyNotesSettings || !navigator.mediaDevices) {
    setVoiceStatus('Voice capture is unavailable');
    return;
  }
  setVoiceStatus('Listening...');
  setAiWorking(true, 'Listening...');
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    recording = true;
    [voiceBtn, voiceTestBtn].forEach(function(btn) { if (btn) btn.classList.add('active'); });
    mediaRecorder.ondataavailable = function(e) { if (e.data && e.data.size) audioChunks.push(e.data); };
    mediaRecorder.onstop = function() {
      stream.getTracks().forEach(function(track) { track.stop(); });
      finishVoiceCapture(mediaRecorder.mimeType || 'audio/webm');
    };
    mediaRecorder.start();
  }).catch(function(err) { setAiWorking(false); setVoiceStatus(err.message || 'Microphone permission denied'); });
}

function stopVoiceCapture() {
  if (mediaRecorder && recording) {
    setVoiceStatus('Processing voice idea...');
    setAiWorking(true, 'Processing voice idea...');
    recording = false;
    [voiceBtn, voiceTestBtn].forEach(function(btn) { if (btn) btn.classList.remove('active'); });
    mediaRecorder.stop();
  }
}

function finishVoiceCapture(mimeType) {
  var blob = new Blob(audioChunks, { type: mimeType });
  blob.arrayBuffer().then(function(buffer) {
    setVoiceStatus('Transcribing...');
    setAiWorking(true, 'Transcribing voice...');
    return window.rubyNotesSettings.transcribe(buffer, mimeType);
  }).then(function(result) {
    setVoiceStatus('Writing .mrld note...');
    setAiWorking(true, 'AI is making clean .mrld notes...');
    return window.rubyNotesSettings.createNote(result.transcript);
  }).then(function(note) {
    createNoteFromAi(note.title, note.body);
    setAiWorking(false);
    setVoiceStatus('Voice note created');
  }).catch(function(err) {
    setAiWorking(false);
    setVoiceStatus(err.message || 'Voice note failed');
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
var directiveTimer = null;
noteTitle.addEventListener('input', function() {
  saveStatus.textContent = 'Saving...';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function() {
    autoSave();
    if (activeId && currentView === 'editor') updatePreview();
  }, 300);
});

livePreview.addEventListener('input', function(e) {
  if (!activeId || currentView !== 'editor') return;
  tryInlineTransform();
  tryBlockTransform();
  noteBody.value = serializeLivePreview();
  saveStatus.textContent = 'Saving...';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(autoSave, 150);
  clearTimeout(directiveTimer);
  directiveTimer = setTimeout(function() {
    syncDirectivesFromSource(noteBody.value);
  }, 250);
});

livePreview.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    setTimeout(tryBlockTransform, 0);
  }
});

livePreview.addEventListener('blur', function() {
  if (!activeId || currentView !== 'editor') return;
  noteBody.value = serializeLivePreview();
  autoSave();
});

newNoteBtn.addEventListener('click', createNote);
deleteNoteBtn.addEventListener('click', deleteNote);
docsBtn.addEventListener('click', showDocsView);
settingsBtn.addEventListener('click', showSettingsView);
exportBtn.addEventListener('click', exportNote);
importBtn.addEventListener('click', triggerImport);
importFile.addEventListener('change', handleFileSelect);
settingsSaveBtn.addEventListener('click', saveSettingsForm);
voiceShortcutInput.addEventListener('keydown', function(e) { e.preventDefault(); captureShortcut(e); });
voiceBtn.addEventListener('click', startVoiceCapture);
voiceTestBtn.addEventListener('click', startVoiceCapture);
if (window.rubyNotesSettings) {
  window.rubyNotesSettings.onVoiceShortcut(startVoiceCapture);
}

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
