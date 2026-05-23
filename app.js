const STORAGE_KEY = 'rubynotes';

let notes = [];
let activeId = null;
let currentView = 'editor';

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
    try {
      notes = JSON.parse(raw);
    } catch (e) {
      notes = [];
    }
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
    previewEl.textContent = note.body.slice(0, 60) || 'No content';

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
  const note = {
    id: now.toString(),
    title: '',
    body: '',
    createdAt: now,
    updatedAt: now
  };
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
  if (currentView === 'docs') {
    docsBtn.classList.add('active');
  } else {
    docsBtn.classList.remove('active');
  }
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
  try {
    previewBody.innerHTML = parseEmerald(noteBody.value);
  } catch (e) {
    previewBody.innerHTML = '<p style="color:#e44">Preview error</p>';
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

function exportNote() {
  if (!activeId || currentView !== 'editor') return;
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  const filename = (note.title || 'untitled') + '.mrld';
  const blob = new Blob([note.body], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  saveStatus.textContent = 'Exported ' + filename;
}

function importFileContent(filename, content) {
  const now = Date.now();
  const title = filename.replace(/\.mrld$/i, '');
  const note = {
    id: now.toString(),
    title: title,
    body: content,
    createdAt: now,
    updatedAt: now
  };
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

function triggerImport() {
  importFile.click();
}

function setupDragDrop() {
  const app = document.querySelector('.app');
  let dragCounter = 0;

  app.addEventListener('dragenter', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (dragCounter === 1) {
      noteBody.classList.add('drag-over');
    }
  });

  app.addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
      noteBody.classList.remove('drag-over');
    }
  });

  app.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });

  app.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    noteBody.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.endsWith('.mrld')) continue;
      const reader = new FileReader();
      reader.onload = (function(filename) {
        return function(ev) {
          importFileContent(filename, ev.target.result);
        };
      })(file.name);
      reader.readAsText(file);
    }
  });
}

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
