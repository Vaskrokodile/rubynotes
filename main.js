const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { app, BrowserWindow, ipcMain } = require('electron');
const pty = require('@homebridge/node-pty-prebuilt-multiarch');

const terminals = new Map();
const isWindows = process.platform === 'win32';

const CLI_DEFS = {
  default: {
    label: 'Shell',
    executables: [],
    install: null,
    docs: null
  },
  opencode: {
    label: 'OpenCode',
    executables: isWindows ? ['opencode.cmd', 'opencode.exe', 'opencode'] : ['opencode'],
    install: {
      win32: 'npm i -g opencode-ai',
      default: 'npm install -g opencode-ai'
    },
    docs: 'https://opencode.ai/docs/'
  },
  qwen: {
    label: 'Qwen Code',
    executables: ['qwen'],
    install: {
      win32: "Invoke-WebRequest 'https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.bat' -OutFile (Join-Path $env:TEMP 'install-qwen.bat'); & (Join-Path $env:TEMP 'install-qwen.bat')",
      default: 'curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.sh | bash'
    },
    docs: 'https://qwenlm.github.io/qwen-code-docs/en/users/overview/'
  },
  codex: {
    label: 'Codex',
    executables: ['codex'],
    install: {
      win32: 'npm install -g @openai/codex',
      default: 'npm install -g @openai/codex'
    },
    docs: 'https://help.openai.com/en/articles/11096431-openai-codex-cli-getting-started'
  },
  agy: {
    label: 'Antigravity',
    executables: ['agy'],
    install: {
      win32: 'irm https://antigravity.google/cli/install.ps1 | iex',
      default: 'curl -fsSL https://antigravity.google/cli/install.sh | bash'
    },
    docs: 'https://www.antigravity.google/docs/cli-getting-started'
  },
  kilo: {
    label: 'Kilo Code',
    executables: ['kilo', 'kilocode'],
    install: {
      win32: 'npm install -g @kilocode/cli',
      default: 'npm install -g @kilocode/cli'
    },
    docs: 'https://kilo.ai/docs/cli'
  }
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 620,
    backgroundColor: '#0c0c0c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

function getShell() {
  if (isWindows) {
    return process.env.RUBYNOTES_SHELL || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function getShellArgs(script) {
  if (isWindows) {
    const shell = path.basename(getShell()).toLowerCase();
    if (shell === 'cmd.exe') {
      return script ? ['/d', '/s', '/k', script] : ['/d', '/s', '/k'];
    }
    return script
      ? ['-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', script]
      : ['-NoExit', '-ExecutionPolicy', 'Bypass'];
  }

  return script ? ['-lc', script] : ['-l'];
}

function resolveExecutable(names) {
  for (const name of names) {
    const result = spawnSync(isWindows ? 'where.exe' : 'which', [name], {
      encoding: 'utf8',
      windowsHide: true
    });
    if (result.status === 0) {
      const found = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      for (const candidate of found) {
        if (isUsableExecutable(candidate)) return candidate;
      }
    }
  }
  return null;
}

function isUsableExecutable(candidate) {
  const result = spawnSync(candidate, ['--version'], {
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
    shell: isWindows && /\.(cmd|bat)$/i.test(candidate)
  });
  return result.status === 0;
}

function quotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function quoteSh(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function buildWindowsCliScript(type, def) {
  const install = def.install && (def.install.win32 || def.install.default);
  const executables = def.executables.map(quotePowerShell).join(', ');
  const label = quotePowerShell(def.label);
  const docs = quotePowerShell(def.docs || '');
  const installLiteral = quotePowerShell(install || '');

  return `
$Host.UI.RawUI.WindowTitle = 'RubyNotes - ${def.label}';
$env:TERM = 'xterm-256color';
try {
  $npmPrefix = (npm prefix -g 2>$null);
  if ($npmPrefix) {
    $env:PATH = "$npmPrefix;$npmPrefix\\node_modules\\.bin;$env:APPDATA\\npm;$env:PATH";
  }
} catch {}
$executables = @(${executables});
$label = ${label};
$docs = ${docs};
$installCommand = ${installLiteral};
function Find-RubyNotesCommand {
  foreach ($name in $executables) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue;
    if ($cmd) {
      try {
        & $cmd.Source --version *> $null;
        if ($LASTEXITCODE -eq 0) { return $cmd.Source; }
      } catch {}
    }
  }
  return $null;
}
$resolved = Find-RubyNotesCommand;
if (-not $resolved) {
  Write-Host "$label is not installed correctly or is not on PATH." -ForegroundColor Yellow;
  if ($docs) { Write-Host "Official install docs: $docs" -ForegroundColor DarkGray; }
  if ($installCommand) {
    Write-Host "Installing ${label}:" -ForegroundColor Cyan;
    Write-Host "  $installCommand" -ForegroundColor DarkGray;
    Invoke-Expression $installCommand;
    try {
      $npmPrefix = (npm prefix -g 2>$null);
      if ($npmPrefix) { $env:PATH = "$npmPrefix;$npmPrefix\\node_modules\\.bin;$env:APPDATA\\npm;$env:PATH"; }
    } catch {}
    $resolved = Find-RubyNotesCommand;
  }
}
if ($resolved) {
  & $resolved;
} else {
  Write-Host "RubyNotes could not find $label after installation." -ForegroundColor Red;
  Write-Host "Install docs: $docs";
}
`;
}

function buildUnixCliScript(type, def) {
  const install = def.install && (def.install[process.platform] || def.install.default);
  const executables = def.executables.map(quoteSh).join(' ');
  const label = quoteSh(def.label);
  const docs = quoteSh(def.docs || '');
  const installLiteral = quoteSh(install || '');

  return `
export TERM=xterm-256color
NPM_PREFIX="$(npm prefix -g 2>/dev/null || true)"
if [ -n "$NPM_PREFIX" ]; then
  export PATH="$NPM_PREFIX/bin:$NPM_PREFIX:$PATH"
fi
executables="${executables}"
label=${label}
docs=${docs}
install_command=${installLiteral}
find_rubynotes_command() {
  for name in $executables; do
    command -v "$name" 2>/dev/null && return 0
  done
  return 1
}
resolved="$(find_rubynotes_command || true)"
if [ -z "$resolved" ]; then
  printf '\\033[1;33m%s is not installed correctly or is not on PATH.\\033[0m\\n' "$label"
  [ -n "$docs" ] && printf '\\033[90mOfficial install docs: %s\\033[0m\\n' "$docs"
  if [ -n "$install_command" ]; then
    printf '\\033[36mInstalling %s:\\033[0m\\n  \\033[90m%s\\033[0m\\n' "$label" "$install_command"
    eval "$install_command"
    NPM_PREFIX="$(npm prefix -g 2>/dev/null || true)"
    if [ -n "$NPM_PREFIX" ]; then
      export PATH="$NPM_PREFIX/bin:$NPM_PREFIX:$PATH"
    fi
    resolved="$(find_rubynotes_command || true)"
  fi
fi
if [ -n "$resolved" ]; then
  exec "$resolved"
else
  printf '\\033[1;31mRubyNotes could not find %s after installation.\\033[0m\\n' "$label"
  printf 'Install docs: %s\\n' "$docs"
  SHELL_TO_RUN="\${SHELL:-/bin/bash}"
  exec "$SHELL_TO_RUN" -l
fi
`;
}

function buildCliScript(type) {
  const def = CLI_DEFS[type] || CLI_DEFS.default;
  if (!def.install) return null;
  return isWindows ? buildWindowsCliScript(type, def) : buildUnixCliScript(type, def);
}

function safeName(value) {
  return String(value || 'untitled')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'untitled';
}

function envText(value, limit = 8000) {
  const text = String(value || '');
  return text.length > limit ? `${text.slice(0, limit)}\n...[truncated, see RUBYNOTES_NOTE_FILE]` : text;
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function stripDirectives(body = '') {
  return String(body)
    .replace(/^\/\/whitepaper\s*\n?/gm, '')
    .replace(/^\/\/terminal(?:\s+\S+)?\s*\n?/gm, '')
    .trim();
}

function mrldFence(text = '') {
  return [
    'Code: mrld',
    String(text || '(empty note)')
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')
  ].join('\n');
}

function buildNoteMrld(noteContext = {}) {
  const title = noteContext.title || 'untitled';
  const body = stripDirectives(noteContext.body || '');
  return [
    `Title: ${title}`,
    '= Type: Active RubyNotes note context',
    `= Updated: ${formatDate(noteContext.updatedAt)}`,
    `= Note ID: ${noteContext.id || ''}`,
    '',
    'h2: Note Body',
    '',
    body || '(empty note)'
  ].join('\n');
}

function buildAllNotesMrld(noteContext = {}) {
  const allNotes = Array.isArray(noteContext.notes) ? noteContext.notes : [];
  if (!allNotes.length) return 'Title: RubyNotes Notes\n\n@ No other notes were provided.\n';

  return allNotes.map((note) => [
    `Title: ${note.title || 'untitled'}`,
    `= Updated: ${formatDate(note.updatedAt)}`,
    `= Note ID: ${note.id || ''}`,
    '',
    stripDirectives(note.body || '') || '(empty note)'
  ].join('\n')).join('\n\n---\n\n');
}

function buildAgentMrld(noteContext = {}) {
  const noteTitle = noteContext.title || 'untitled';
  const noteBody = stripDirectives(noteContext.body || '') || '(empty note)';
  return [
    'Title: RubyNotes AI Context',
    '= Format: .mrld',
    '= Purpose: Give embedded CLI agents first-class RubyNotes note context',
    '',
    'h2: Instructions',
    '> Treat RubyNotes .mrld as the source of truth.',
    '> Use the active note context before answering questions.',
    '> If the user asks what you see, summarize the active note content, not only the terminal environment.',
    '> Preserve RubyNotes syntax when creating or editing note content.',
    '> Prefer .mrld examples over Markdown examples.',
    '',
    'h2: RubyNotes Syntax Quick Reference',
    '= Title: Title: My Note or # My Note',
    '= Section: h2: Section',
    '= Paragraph: @ text or plain text',
    '= Task: > task text',
    '= Question: ? question text',
    '= Warning: ! important text',
    '= Toggle: + expandable text',
    '= Key Value: = Key: Value',
    '= Table: Table: Name followed by pipe rows',
    '= Code: Code: lang followed by indented code lines',
    '= Terminal Directive: //terminal opencode | codex | qwen | agy | kilo',
    '',
    'h2: Context Files',
    '= Active Note: RUBYNOTES_NOTE.mrld',
    '= All Notes: RUBYNOTES_ALL_NOTES.mrld',
    '= Agent Context: RUBYNOTES_AGENT_CONTEXT.mrld',
    '',
    'h2: Active Note',
    `= Title: ${noteTitle}`,
    '',
    mrldFence(noteBody)
  ].join('\n');
}

function buildAgentCompatibilityMrld(noteContext = {}) {
  return [
    'Title: RubyNotes Agent Context Bridge',
    '= Format: .mrld content in AGENTS.md compatibility file',
    '',
    'h2: Instructions',
    '> Read RUBYNOTES_AGENT_CONTEXT.mrld before answering.',
    '> Read RUBYNOTES_NOTE.mrld for the active note.',
    '> Read RUBYNOTES_ALL_NOTES.mrld when wider notebook context is useful.',
    '> These files use RubyNotes .mrld syntax, not Markdown.',
    '> Treat .mrld as the source of truth and preserve RubyNotes syntax.',
    '',
    `= Active Note Title: ${noteContext.title || 'untitled'}`
  ].join('\n');
}

function createTerminalWorkspace(noteContext, type) {
  if (!noteContext || !noteContext.id) return { cwd: app.getPath('home'), env: {} };

  const dirName = `${safeName(noteContext.title)}-${safeName(noteContext.id)}`;
  const root = path.join(app.getPath('userData'), 'terminal-contexts', dirName);
  fs.mkdirSync(root, { recursive: true });

  const noteFile = path.join(root, 'RUBYNOTES_NOTE.mrld');
  const allNotesFile = path.join(root, 'RUBYNOTES_ALL_NOTES.mrld');
  const agentContextFile = path.join(root, 'RUBYNOTES_AGENT_CONTEXT.mrld');
  const agentsFile = path.join(root, 'AGENTS.md');

  fs.writeFileSync(noteFile, buildNoteMrld(noteContext), 'utf8');
  fs.writeFileSync(allNotesFile, buildAllNotesMrld(noteContext), 'utf8');
  fs.writeFileSync(agentContextFile, buildAgentMrld(noteContext), 'utf8');
  fs.writeFileSync(agentsFile, buildAgentCompatibilityMrld(noteContext), 'utf8');

  return {
    cwd: root,
    noteContext,
    env: {
      RUBYNOTES_NOTE_ID: String(noteContext.id || ''),
      RUBYNOTES_NOTE_TITLE: String(noteContext.title || ''),
      RUBYNOTES_NOTE_BODY: envText(noteContext.body),
      RUBYNOTES_NOTE_FILE: noteFile,
      RUBYNOTES_ALL_NOTES_FILE: allNotesFile,
      RUBYNOTES_AGENT_CONTEXT_FILE: agentContextFile,
      RUBYNOTES_AGENTS_FILE: agentsFile,
      RUBYNOTES_TERMINAL_TYPE: type
    }
  };
}

function writeTerminalWorkspace(workspace, noteContext, type) {
  if (!workspace || !workspace.cwd || !noteContext) return workspace;

  fs.mkdirSync(workspace.cwd, { recursive: true });
  const noteFile = path.join(workspace.cwd, 'RUBYNOTES_NOTE.mrld');
  const allNotesFile = path.join(workspace.cwd, 'RUBYNOTES_ALL_NOTES.mrld');
  const agentContextFile = path.join(workspace.cwd, 'RUBYNOTES_AGENT_CONTEXT.mrld');
  const agentsFile = path.join(workspace.cwd, 'AGENTS.md');

  fs.writeFileSync(noteFile, buildNoteMrld(noteContext), 'utf8');
  fs.writeFileSync(allNotesFile, buildAllNotesMrld(noteContext), 'utf8');
  fs.writeFileSync(agentContextFile, buildAgentMrld(noteContext), 'utf8');
  fs.writeFileSync(agentsFile, buildAgentCompatibilityMrld(noteContext), 'utf8');

  workspace.noteContext = noteContext;
  workspace.env = {
    ...(workspace.env || {}),
    RUBYNOTES_NOTE_ID: String(noteContext.id || ''),
    RUBYNOTES_NOTE_TITLE: String(noteContext.title || ''),
    RUBYNOTES_NOTE_BODY: envText(noteContext.body),
    RUBYNOTES_NOTE_FILE: noteFile,
    RUBYNOTES_ALL_NOTES_FILE: allNotesFile,
    RUBYNOTES_AGENT_CONTEXT_FILE: agentContextFile,
    RUBYNOTES_AGENTS_FILE: agentsFile,
    RUBYNOTES_TERMINAL_TYPE: type
  };

  return workspace;
}

ipcMain.handle('terminal:create', (event, options = {}) => {
  const id = options.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const type = options.type || 'default';
  const workspace = createTerminalWorkspace(options.noteContext, type);
  const cwd = options.cwd && path.isAbsolute(options.cwd) ? options.cwd : workspace.cwd;
  const def = CLI_DEFS[type] || CLI_DEFS.default;
  const resolved = def.install ? resolveExecutable(def.executables) : null;
  const script = resolved ? null : buildCliScript(type);
  const shell = resolved && !(isWindows && /\.(cmd|bat)$/i.test(resolved)) ? resolved : getShell();
  const args = resolved
    ? (isWindows && /\.(cmd|bat)$/i.test(resolved) ? getShellArgs(`& ${quotePowerShell(resolved)}`) : [])
    : getShellArgs(script);

  const term = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: options.cols || 100,
    rows: options.rows || 28,
    cwd,
    env: {
      ...process.env,
      ...workspace.env,
      TERM: 'xterm-256color',
      RUBYNOTES_TERMINAL: type
    }
  });

  terminals.set(id, { term, workspace, type });

  term.onData((data) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('terminal:data', { id, data });
    }
  });

  term.onExit(({ exitCode, signal }) => {
    terminals.delete(id);
    if (!event.sender.isDestroyed()) {
      event.sender.send('terminal:exit', { id, exitCode, signal });
    }
  });

  return { id };
});

ipcMain.on('terminal:write', (_event, payload) => {
  const session = terminals.get(payload.id);
  if (session) session.term.write(payload.data);
});

ipcMain.on('terminal:resize', (_event, payload) => {
  const session = terminals.get(payload.id);
  if (session) session.term.resize(payload.cols, payload.rows);
});

ipcMain.on('terminal:update-context', (_event, payload) => {
  const session = terminals.get(payload.id);
  if (session) {
    session.workspace = writeTerminalWorkspace(session.workspace, payload.noteContext, session.type);
  }
});

ipcMain.on('terminal:dispose', (_event, payload) => {
  const session = terminals.get(payload.id);
  if (session) {
    session.term.kill();
    terminals.delete(payload.id);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  for (const session of terminals.values()) session.term.kill();
  terminals.clear();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
