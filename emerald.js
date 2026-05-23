var _emeraldNotes = [];

function setEmeraldNotes(notes) {
  _emeraldNotes = notes || [];
}

function parseEmerald(text) {
  var lines = text.split('\n');
  var html = '';
  var inList = false, listType = '';
  var indentStack = [], toggleDepth = -1;
  var inFrontmatter = false, fmHtml = '';
  var tableRows = [], tableCaption = '';
  var codeLines = [], codeLang = '';
  var kanbanCols = [], kanbanItems = {}, kanbanName = '', kanbanColIdx = -1;
  var inKanban = false;

  function closeList() {
    if (inList) { html += '</ul>'; inList = false; listType = ''; }
  }
  function closeDownTo(level) {
    while (indentStack.length > level) {
      var popped = indentStack.pop();
      if (popped === toggleDepth + 1 && toggleDepth >= 0) {
        html += '</details>'; toggleDepth = -1;
      } else { html += '</div>'; }
    }
  }
  function flushTable() {
    if (tableRows.length > 0) { html += renderTable(tableCaption, tableRows); tableRows = []; tableCaption = ''; }
  }
  function flushCode() {
    if (codeLines.length > 0) { html += renderCodeBlock(codeLang, codeLines); codeLines = []; codeLang = ''; }
  }
  function flushKanban() {
    if (kanbanCols.length > 0) { html += renderKanban(kanbanName, kanbanCols, kanbanItems); kanbanCols = []; kanbanItems = {}; kanbanName = ''; kanbanColIdx = -1; inKanban = false; }
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();
    var indent = countIndent(line);

    if (inFrontmatter) {
      if (trimmed === '---') { fmHtml += '</div>'; html += fmHtml; inFrontmatter = false; continue; }
      fmHtml += renderFmRow(trimmed); continue;
    }

    if (codeLines.length > 0) {
      if (trimmed === '') { flushCode(); closeList(); closeDownTo(0); toggleDepth = -1; continue; }
      codeLines.push(line); continue;
    }

    if (inKanban) {
      if (trimmed === '') { flushKanban(); closeList(); closeDownTo(0); toggleDepth = -1; continue; }
      if (trimmed.startsWith('> ')) {
        var colName = trimmed.slice(2).trim();
        if (kanbanCols.indexOf(colName) === -1) { kanbanCols.push(colName); }
        kanbanColIdx = kanbanCols.indexOf(colName);
        continue;
      }
      var content = stripPrefix(trimmed, detectType(trimmed));
      if (kanbanColIdx >= 0) {
        if (!kanbanItems[kanbanColIdx]) kanbanItems[kanbanColIdx] = '';
        kanbanItems[kanbanColIdx] += '<div class="em-kb-item">' + parseInline(content) + '</div>';
      }
      continue;
    }

    if (trimmed === '') {
      closeList(); closeDownTo(0); toggleDepth = -1;
      flushTable(); continue;
    }

    if (trimmed === '---') {
      closeList(); closeDownTo(0); toggleDepth = -1;
      flushTable(); flushCode(); flushKanban();
      fmHtml = '<div class="em-frontmatter">'; inFrontmatter = true; continue;
    }

    if (trimmed.match(/^Kanban:\s*(.+)/)) {
      closeList(); flushTable(); flushCode(); flushKanban();
      kanbanName = RegExp.$1.trim(); inKanban = true; continue;
    }

    if (trimmed.match(/^Table:\s*(.+)/)) {
      closeList(); flushTable(); flushCode(); flushKanban();
      tableCaption = RegExp.$1.trim(); continue;
    }

    if (trimmed.match(/^Code:\s*(\w*)/)) {
      closeList(); flushTable(); flushCode(); flushKanban();
      codeLang = (RegExp.$1 || '').trim(); continue;
    }

    if (trimmed.match(/^(Image|Video|File):\s*(.+)/)) {
      closeList(); flushTable(); flushCode(); flushKanban();
      var mtype = RegExp.$1.toLowerCase();
      var mrest = RegExp.$2.trim();
      var url = mrest, caption = '';
      var capMatch = mrest.match(/^(.+?)\s*\[caption:\s*"(.+?)"\]/);
      if (capMatch) { url = capMatch[1].trim(); caption = capMatch[2]; }
      if (mtype === 'image') html += '<div class="em-media em-image"><div class="em-media-icon">IMG</div><span class="em-media-url">' + esc(url) + '</span>' + (caption ? '<span class="em-media-cap">' + esc(caption) + '</span>' : '') + '</div>';
      else if (mtype === 'video') html += '<div class="em-media em-video"><div class="em-media-icon">VID</div><span class="em-media-url">' + esc(url) + '</span>' + (caption ? '<span class="em-media-cap">' + esc(caption) + '</span>' : '') + '</div>';
      else html += '<div class="em-media em-file"><div class="em-media-icon">FILE</div><span class="em-media-url">' + esc(url) + '</span>' + (caption ? '<span class="em-media-cap">' + esc(caption) + '</span>' : '') + '</div>';
      continue;
    }

    if (tableCaption && (trimmed.startsWith('|') || trimmed.indexOf('|') !== -1)) {
      closeList();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        tableRows.push(trimmed);
      } else {
        tableRows.push('| ' + trimmed.replace(/\s*\|\s*/g, ' | ') + ' |');
      }
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList(); flushCode(); flushKanban();
      tableRows.push(trimmed); continue;
    }

    var kanbanMatch = trimmed.match(/^~\s*(.+?)\s*~$/);
    if (kanbanMatch) {
      closeList(); flushTable(); flushCode(); flushKanban();
      kanbanCols = kanbanMatch[1].split('|').map(function(s) { return s.trim(); });
      continue;
    }
    if (kanbanCols.length > 0 && /^\[([A-Za-z0-9 ]+)\]/.test(trimmed)) {
      closeList();
      var colMatch = trimmed.match(/^\[([A-Za-z0-9 ]+)\]\s*(.*)/);
      var cn = colMatch[1].trim();
      var cidx = kanbanCols.indexOf(cn);
      if (cidx < 0) cidx = kanbanCols.length;
      if (!kanbanItems[cidx]) kanbanItems[cidx] = '';
      kanbanItems[cidx] += '<div class="em-kb-item">' + parseInline(colMatch[2] || '') + '</div>';
      continue;
    }

    var type = detectType(trimmed);
    var content = stripPrefix(trimmed, type);

    if (type === 'comment') continue;

    if (indent < indentStack.length) {
      closeDownTo(indent);
      if (toggleDepth >= indent) toggleDepth = indent - 1;
    }

    if (type === 'toggle') {
      closeList(); closeDownTo(indent);
      html += '<details class="em-toggle"' + (indent > 0 ? ' style="margin-left:' + (indent * 24) + 'px"' : '') + '>';
      html += '<summary>' + parseInline(content) + '</summary>';
      toggleDepth = indent; indentStack.push(indent + 1); continue;
    }

    var isListItem = type === 'task' || type === 'question' || type === 'warning' || type === 'list' || type === 'bullet';
    if (isListItem) {
      var effType = type === 'bullet' ? 'list' : type === 'warning' ? 'important' : type;
      if (!inList || listType !== effType || indent !== (indentStack.length > 0 ? indentStack[indentStack.length - 1] : 0)) {
        closeList();
        html += '<ul class="em-' + effType + '-list"' + (indent > 0 ? ' style="margin-left:' + (indent * 24) + 'px"' : '') + '>';
        inList = true; listType = effType;
      }
      html += renderListItem(type, content);
    } else {
      closeList(); html += renderBlock(type, content, indent);
    }
  }

  if (inFrontmatter) { fmHtml += '</div>'; html += fmHtml; }
  flushTable(); flushCode(); flushKanban();
  closeList(); closeDownTo(0);
  return html;
}

function countIndent(line) {
  var tabs = 0, spaces = 0;
  for (var i = 0; i < line.length; i++) {
    var c = line[i]; if (c === '\t') tabs++; else if (c === ' ') spaces++; else break;
  }
  return tabs + Math.floor(spaces / 2);
}

function detectType(trimmed) {
  if (trimmed.match(/^Kanban:\s*.+/)) return 'kanban';
  if (trimmed.startsWith('### ')) return 'h3md';
  if (trimmed.startsWith('## ')) return 'h2md';
  if (trimmed.startsWith('# ')) return 'h1';
  if (trimmed.startsWith('!! ')) return 'h1';
  if (trimmed.startsWith('Title: ')) return 'h1';
  if (trimmed.startsWith('h2: ')) return 'h2';
  if (trimmed.startsWith('h3: ')) return 'h3';
  if (trimmed.startsWith('h4: ')) return 'h4';
  if (trimmed.startsWith('@memory ')) return 'memory';
  if (trimmed.startsWith('@ai ')) return 'ai';
  if (trimmed.startsWith('@ ')) return 'paragraph';
  if (/^@\d{4}-\d{2}-\d{2}/.test(trimmed)) return 'calendar';
  if (trimmed.startsWith('> ')) return 'task';
  if (trimmed.startsWith('? ')) return 'question';
  if (trimmed.match(/^!\s/) && !trimmed.startsWith('!! ')) return 'warning';
  if (trimmed.startsWith('/ ')) return 'comment';
  if (trimmed.startsWith('+ ')) return 'toggle';
  if (trimmed.startsWith('= ')) return 'kv';
  if (trimmed.startsWith('- ')) return 'list';
  if (trimmed.startsWith('\u2022 ')) return 'bullet';
  return 'paragraph';
}

function stripPrefix(trimmed, type) {
  if (type === 'h1') {
    if (trimmed.startsWith('# ')) return trimmed.slice(2);
    if (trimmed.startsWith('!! ')) return trimmed.slice(3);
    return trimmed.slice(7);
  }
  if (type === 'h2md') return trimmed.slice(3);
  if (type === 'h3md') return trimmed.slice(4);
  var lengths = {
    h2: 4, h3: 4, h4: 4,
    ai: 4, memory: 8,
    task: 2, question: 2, warning: 2,
    comment: 2, toggle: 2, kv: 2,
    list: 2, bullet: 2,
  };
  if (lengths[type]) return trimmed.slice(lengths[type]);
  if (type === 'paragraph' && trimmed.startsWith('@ ')) return trimmed.slice(2);
  return trimmed;
}

function renderBlock(type, content, indent) {
  var parsed = parseInline(content);
  var pad = indent > 0 ? ' style="margin-left:' + (indent * 24) + 'px"' : '';
  switch (type) {
    case 'h1': return '<h1>' + parsed + '</h1>';
    case 'h2': case 'h2md': return '<h2>' + parsed + '</h2>';
    case 'h3': case 'h3md': return '<h3>' + parsed + '</h3>';
    case 'h4': return '<h4>' + parsed + '</h4>';
    case 'ai': return '<div class="em-ai"' + pad + '><span class="em-ai-label">@ai</span> ' + parsed + '</div>';
    case 'memory': return '<div class="em-memory"' + pad + '><span class="em-memory-label">MEM</span> ' + parsed + '</div>';
    case 'calendar':
      var dm = content.match(/^@(\d{4}-\d{2}-\d{2})\s+(.+)/);
      if (dm) {
        return '<div class="em-calendar"' + pad + '><span class="em-cal-date">' + dm[1] + '</span><span class="em-cal-text">' + parseInline(dm[2]) + '</span></div>';
      }
      return '<div class="em-calendar"' + pad + '>' + parsed + '</div>';
    case 'kv': {
      var colon = content.indexOf(':');
      if (colon > 0) {
        return '<div class="em-kv"' + pad + '><span class="em-kv-key">' + parseInline(content.slice(0, colon).trim()) + '</span><span class="em-kv-val">' + parseInline(content.slice(colon + 1).trim()) + '</span></div>';
      }
      return '<div class="em-kv"' + pad + '>' + parsed + '</div>';
    }
    default: return '<p' + pad + '>' + parsed + '</p>';
  }
}

function renderListItem(type, content) {
  var parsed = parseInline(content);
  switch (type) {
    case 'task': return '<li class="em-task">' + renderTask(content) + '</li>';
    case 'question': return '<li class="em-question"><span class="em-qmark">?</span> ' + parsed + '</li>';
    case 'warning': return '<li class="em-important"><span class="em-prio">!</span> ' + parsed + '</li>';
    default: return '<li>' + parsed + '</li>';
  }
}

function renderFmRow(trimmed) {
  var colon = trimmed.indexOf(':');
  if (colon > 0) {
    return '<div class="em-fm-row"><span class="em-fm-key">' + esc(trimmed.slice(0, colon).trim()) + '</span><span class="em-fm-val">' + parseInline(trimmed.slice(colon + 1).trim()) + '</span></div>';
  }
  return '<div class="em-fm-row"><span class="em-fm-val">' + parseInline(trimmed) + '</span></div>';
}

function renderTable(caption, rows) {
  if (rows.length === 0) return '';
  var html = '';
  if (caption) html += '<div class="em-table-caption">' + esc(caption) + '</div>';
  html += '<table class="em-table"><thead><tr>';
  var hcells = rows[0].split('|').filter(function(c) { return c.trim(); });
  hcells.forEach(function(c) { html += '<th>' + parseInline(c.trim()) + '</th>'; });
  html += '</tr></thead><tbody>';
  var start = 1;
  if (rows.length > 1) {
    var sep = rows[1].replace(/\|/g, '').replace(/-/g, '').replace(/\s/g, '');
    if (sep === '') start = 2;
  }
  for (var i = start; i < rows.length; i++) {
    html += '<tr>';
    var cells = rows[i].split('|').filter(function(c) { return c.trim() || true; });
    cells.forEach(function(c) {
      var ct = c.trim();
      if (ct.startsWith('! ')) html += '<td class="em-td-warn">' + parseInline(ct.slice(2)) + '</td>';
      else if (ct.startsWith('> ')) html += '<td class="em-td-good">' + parseInline(ct.slice(2)) + '</td>';
      else html += '<td>' + parseInline(ct) + '</td>';
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderCodeBlock(lang, lines) {
  var code = '';
  lines.forEach(function(l) { code += l + '\n'; });
  return '<pre class="em-code"' + (lang ? ' data-lang="' + esc(lang) + '"' : '') + '>' +
    (lang ? '<div class="em-code-lang">' + esc(lang) + '</div>' : '') +
    '<code>' + esc(code.trim()) + '</code></pre>';
}

function renderKanban(name, cols, items) {
  var html = '<div class="em-kanban">';
  if (name) html += '<div class="em-kanban-title">' + esc(name) + '</div>';
  html += '<div class="em-kanban-cols">';
  cols.forEach(function(col, idx) {
    html += '<div class="em-kb-col"><div class="em-kb-col-header">' + esc(col) + '</div>';
    if (items[idx]) html += items[idx];
    html += '</div>';
  });
  html += '</div></div>';
  return html;
}

function renderTask(text) {
  var parsed = parseInline(text);
  var dueHtml = '';
  var dueMatch = text.match(/@due\((.+?)\)/);
  if (dueMatch) {
    dueHtml = dueMatch[1];
  } else {
    var autoDate = parseNaturalDate(text);
    if (autoDate) dueHtml = autoDate;
  }
  var result = '<input type="checkbox" class="em-checkbox" onclick="return false;"> ' + parsed;
  if (dueHtml) result += ' <span class="em-due">' + dueHtml + '</span>';
  return result;
}

var DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

function parseNaturalDate(text) {
  var lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) { var d = new Date(); d.setDate(d.getDate() + 1); return fmtDate(d); }
  if (/\btoday\b/.test(lower)) return fmtDate(new Date());
  if (/\bnext week\b/.test(lower)) { var d = new Date(); d.setDate(d.getDate() + 7); return fmtDate(d); }
  var dm = lower.match(/\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (dm) return fmtDate(nextDay(DAYS.indexOf(dm[1])));
  for (var i = 0; i < DAYS.length; i++) {
    if (lower.indexOf(DAYS[i]) !== -1) return fmtDate(nextDay(i));
  }
  var dm2 = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (dm2) return dm2[0];
  return null;
}

function nextDay(target) {
  var d = new Date(), current = d.getDay(), diff = target - current;
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() + diff); return d;
}

function fmtDate(d) {
  var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function parseInline(text) {
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  text = text.replace(/!([^!\s][^!]*[^!\s]|[^!\s])!/g, '<strong>$1</strong>');

  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.+?)_/g, '<em>$1</em>');

  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  text = text.replace(/\[\[note:([^\]]+)\]\]/gi, function(match, title) {
    var t = title.trim();
    return '<span class="em-wikilink">' + esc(t) + '</span>';
  });

  text = text.replace(/\{\{note:([^}]+)\}\}/gi, function(match, title) {
    var t = title.trim(), found = null;
    for (var i = 0; i < _emeraldNotes.length; i++) {
      if (_emeraldNotes[i].title.toLowerCase() === t.toLowerCase()) { found = _emeraldNotes[i]; break; }
    }
    if (found) {
      return '<div class="em-transclude"><div class="em-transclude-header">' + esc(found.title || 'untitled') + '.mrld</div><div class="em-transclude-body emerald-render">' + parseEmerald(found.body) + '</div></div>';
    }
    return '<span class="em-transclude-miss">~' + esc(t) + '.mrld not found~</span>';
  });

  text = text.replace(/\[([^\]]+)\]/g, function(match, inner) {
    if (inner.indexOf(':') !== -1 || inner.indexOf('|') !== -1) {
      var parts = inner.split('|').map(function(p) { return p.trim(); });
      var result = '<span class="em-inline-prop">';
      parts.forEach(function(part) {
        var colon = part.indexOf(':');
        if (colon > 0) {
          result += '<span class="em-ip-key">' + part.slice(0, colon).trim() + '</span>';
          result += '<span class="em-ip-sep">:</span>';
          result += '<span class="em-ip-val">' + part.slice(colon + 1).trim() + '</span>';
        } else { result += '<span class="em-ip-tag">' + part + '</span>'; }
        result += ' ';
      });
      result += '</span>';
      return result;
    }
    return match;
  });

  return text;
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
