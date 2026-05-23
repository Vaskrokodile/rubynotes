const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rubyNotesTerminal', {
  create(options) {
    return ipcRenderer.invoke('terminal:create', options);
  },
  write(id, data) {
    ipcRenderer.send('terminal:write', { id, data });
  },
  resize(id, cols, rows) {
    ipcRenderer.send('terminal:resize', { id, cols, rows });
  },
  updateContext(id, noteContext) {
    ipcRenderer.send('terminal:update-context', { id, noteContext });
  },
  dispose(id) {
    ipcRenderer.send('terminal:dispose', { id });
  },
  onData(id, callback) {
    const listener = (_event, payload) => {
      if (payload.id === id) callback(payload.data);
    };
    ipcRenderer.on('terminal:data', listener);
    return () => ipcRenderer.removeListener('terminal:data', listener);
  },
  onExit(id, callback) {
    const listener = (_event, payload) => {
      if (payload.id === id) callback(payload);
    };
    ipcRenderer.on('terminal:exit', listener);
    return () => ipcRenderer.removeListener('terminal:exit', listener);
  }
});

contextBridge.exposeInMainWorld('rubyNotesSettings', {
  get() {
    return ipcRenderer.invoke('settings:get');
  },
  save(settings) {
    return ipcRenderer.invoke('settings:save', settings);
  },
  transcribe(audio, mimeType) {
    return ipcRenderer.invoke('voice:transcribe', { audio, mimeType });
  },
  createNote(transcript) {
    return ipcRenderer.invoke('voice:create-note', { transcript });
  },
  onVoiceShortcut(callback) {
    const listener = () => callback();
    ipcRenderer.on('voice:shortcut', listener);
    return () => ipcRenderer.removeListener('voice:shortcut', listener);
  }
});
