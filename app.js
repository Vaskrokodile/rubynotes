const STORAGE_KEY = 'rubynotes';

let notes = [];
let activeId = null;
let currentView = 'editor'; // 'editor' | 'docs'
let currentMode = 'edit';   // 'edit' | 'preview'

const notesList = document.getElementById('notes-list');
const editorEmpty = document.getElementById('editor-empty');
const editorContent = document.getElementById('editor-content');
const docsContent = document.getElementById('docs-content');
const noteTitle = document.getElementById('note-title');
const noteBody = document.getElementById('note-body');
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
    el.innerHTML = `
      <div class="note-item-title">${escapeHtml(note.title || 'Untitled')}</div>
      <div class="note-item-preview">${escapeHtml(note.body.slice(0, 60) || 'No content')}</div>
      <div class="note-item-date">${formatDate(note.updatedAt)}</div>
    `;
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
    updatePreview();
  }
  showEditorView();
  renderNotesList();
  updateDocsBtn();
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
  updatePreview();
  showEditorView();
  renderNotesList();
  updateDocsBtn();
  noteTitle.focus();
}

function deleteNote() {
  if (!activeId || currentView !== 'editor') return;
  notes = notes.filter(n => n.id !== activeId);
  saveNotes();
  activeId = null;
  noteTitle.value = '';
  noteBody.value = '';
  currentMode = 'edit';
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
  currentMode = mode;
  if (mode === 'edit') {
    tabEdit.classList.add('active');
    tabPreview.classList.remove('active');
    paneEdit.classList.remove('hidden');
    panePreview.classList.add('hidden');
  } else {
    tabPreview.classList.add('active');
    tabEdit.classList.remove('active');
    panePreview.classList.remove('hidden');
    paneEdit.classList.add('hidden');
    updatePreview();
  }
}

function updatePreview() {
  previewTitle.textContent = noteTitle.value || 'Untitled';
  previewBody.innerHTML = parseEmerald(noteBody.value);
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

let saveTimer = null;
noteTitle.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveStatus.textContent = 'Saving...';
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
}

init();
