const STORAGE_KEY = 'rubynotes';

let notes = [];
let activeId = null;

const notesList = document.getElementById('notes-list');
const editorEmpty = document.getElementById('editor-empty');
const editorContent = document.getElementById('editor-content');
const noteTitle = document.getElementById('note-title');
const noteBody = document.getElementById('note-body');
const saveStatus = document.getElementById('save-status');
const newNoteBtn = document.getElementById('new-note-btn');
const deleteNoteBtn = document.getElementById('delete-note-btn');

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
    el.className = 'note-item' + (note.id === activeId ? ' active' : '');
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
  activeId = id;
  const note = notes.find(n => n.id === id);
  if (note) {
    noteTitle.value = note.title;
    noteBody.value = note.body;
    editorEmpty.classList.add('hidden');
    editorContent.classList.remove('hidden');
  }
  renderNotesList();
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
  activeId = note.id;
  noteTitle.value = '';
  noteBody.value = '';
  editorEmpty.classList.add('hidden');
  editorContent.classList.remove('hidden');
  renderNotesList();
  noteTitle.focus();
}

function deleteNote() {
  if (!activeId) return;
  notes = notes.filter(n => n.id !== activeId);
  saveNotes();
  activeId = null;
  noteTitle.value = '';
  noteBody.value = '';
  editorEmpty.classList.remove('hidden');
  editorContent.classList.add('hidden');
  renderNotesList();
}

function autoSave() {
  if (!activeId) return;
  const note = notes.find(n => n.id === activeId);
  if (!note) return;
  note.title = noteTitle.value;
  note.body = noteBody.value;
  note.updatedAt = Date.now();
  saveNotes();
  const now = new Date();
  saveStatus.textContent = 'Saved ' + now.toLocaleTimeString();
  renderNotesList();
}

let saveTimer = null;
noteTitle.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveStatus.textContent = 'Saving...';
  saveTimer = setTimeout(autoSave, 400);
});
noteBody.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveStatus.textContent = 'Saving...';
  saveTimer = setTimeout(autoSave, 400);
});

newNoteBtn.addEventListener('click', createNote);
deleteNoteBtn.addEventListener('click', deleteNote);

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
}

init();
