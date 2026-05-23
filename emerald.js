var _emeraldNotes = [];

function setEmeraldNotes(notes) {
  _emeraldNotes = notes || [];
}

function parseEmerald(text) {
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let listType = '';
  let indentStack = [];
  let toggleDepth = -1;
  let inFrontmatter = false;
  let fmHtml = '';
  let tableRows = [];
  let kanbanCols = null;
  let kanbanBuf = []; // [{col, html}]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = countIndent(line);

    if (inFrontmatter) {
      if (trimmed === '---') {
        fmHtml += '</div>';
        html += fmHtml;
        inFrontmatter = false;
        continue;
      }
      fmHtml += renderFmRow(trimmed);
      continue;
    }

    if (trimmed === '') {
      closeList();
      closeDownTo(0);
      toggleDepth = -1;
      tableRows = [];
      if (kanbanCols) { html += renderKanban(kanbanCols, [kanbanBuf]); kanbanCols = null; kanbanBuf = []; }
      continue;
    }

    if (trimmed === '---') {
      closeList();
      closeDownTo(0);
      toggleDepth = -1;
      tableRows = [];
      if (kanbanCols) { html += renderKanban(kanbanCols, [kanbanBuf]); kanbanCols = null; kanbanBuf = []; }
      fmHtml = '<div class="em-frontmatter">';
      inFrontmatter = true;
      continue;
    }

    var kanbanMatch = trimmed.match(/^~\s*(.+?)\s*~$/);
    if (kanbanMatch) {
      closeList();
      if (kanbanCols) { html += renderKanban(kanbanCols, [kanbanBuf]); kanbanBuf = []; }
      kanbanCols = kanbanMatch[1].split('|').map(function(s) { return s.trim(); });
      continue;
    }

    if (kanbanCols && /^\[([A-Za-z0-9 ]+)\]/.test(trimmed)) {
      closeList();
      var colMatch = trimmed.match(/^\[([A-Za-z0-9 ]+)\]\s*(.*)/);
      var colName = colMatch[1].trim();
      var colIdx = kanbanCols.indexOf(colName);
      if (colIdx < 0) colIdx = kanbanCols.length;
      if (!kanbanBuf[colIdx]) kanbanBuf[colIdx] = '';
      kanbanBuf[colIdx] += '<div class="em-kb-item">' + parseInline(colMatch[2] || '') + '</div>';
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      tableRows.push(trimmed);
      continue;
    }
    if (tableRows.length > 0) {
      html += renderTable(tableRows);
      tableRows = [];
    }

    var type = detectType(trimmed);
    var content = stripPrefix(trimmed, type);

    if (type === 'comment') continue;

    if (indent < indentStack.length) {
      closeDownTo(indent);
      if (toggleDepth >= indent) toggleDepth = indent - 1;
    }

    if (type === 'toggle') {
      closeList();
      closeDownTo(indent);
      html += '<details class="em-toggle"' + (indent > 0 ? ' style="margin-left:' + (indent * 24) + 'px"' : '') + '>';
      html += '<summary>' + parseInline(content) + '</summary>';
      toggleDepth = indent;
      indentStack.push(indent + 1);
      continue;
    }

    var isListItem = type === 'task' || type === 'question' || type === 'warning' || type === 'list' || type === 'bullet';
    if (isListItem) {
      var effType = type === 'bullet' ? 'list' : type === 'warning' ? 'important' : type;
      if (!inList || listType !== effType || indent !== (indentStack.length > 0 ? indentStack[indentStack.length - 1] : 0)) {
        closeList();
        html += '<ul class="em-' + effType + '-list"' + (indent > 0 ? ' style="margin-left:' + (indent * 24) + 'px"' : '') + '>';
        inList = true;
        listType = effType;
      }
      html += renderListItem(type, content);
    } else {
      closeList();
      html += renderBlock(type, content, indent);
    }
  }

  if (inFrontmatter) { fmHtml += '</div>'; html += fmHtml; }
  if (tableRows.length > 0) html += renderTable(tableRows);
  if (kanbanCols) html += renderKanban(kanbanCols, [kanbanBuf]);
  closeList();
  closeDownTo(0);
  return html;

  function closeList() {
    if (inList) { html += '</ul>'; inList = false; listType = ''; }
  }

  function closeDownTo(level) {
    while (indentStack.length > level) {
      var popped = indentStack.pop();
      if (popped === toggleDepth + 1 && toggleDepth >= 0) {
        html += '</details>';
        toggleDepth = -1;
      } else {
        html += '</div>';
      }
    }
  }
}

function countIndent(line) {
  var tabs = 0;
  var spaces = 0;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (c === '\t') tabs++;
    else if (c === ' ') spaces++;
    else break;
  }
  return tabs + Math.floor(spaces / 2);
}

function detectType(trimmed) {
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
  if (type === 'calendar') return trimmed;
  var lengths = {
    h2: 4, h3: 4, h4: 4,
    ai: 4, memory: 8, task: 2, question: 2, warning: 2,
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
    case 'h2': return '<h2>' + parsed + '</h2>';
    case 'h3': return '<h3>' + parsed + '</h3>';
    case 'h4': return '<h4>' + parsed + '</h4>';
    case 'ai':
      return '<div class="em-ai"' + pad + '><span class="em-ai-label">@ai</span> ' + parsed + '</div>';
    case 'memory':
      return '<div class="em-memory"' + pad + '><span class="em-memory-label">MEM</span> ' + parsed + '</div>';
    case 'calendar':
      var dateMatch = content.match(/^@(\d{4}-\d{2}-\d{2})\s+(.+)/);
      if (dateMatch) {
        return '<div class="em-calendar"' + pad + '><span class="em-cal-date">' + dateMatch[1] + '</span><span class="em-cal-text">' + parseInline(dateMatch[2]) + '</span></div>';
      }
      return '<div class="em-calendar"' + pad + '>' + parsed + '</div>';
    case 'kv': {
      var colon = content.indexOf(':');
      if (colon > 0) {
        var key = parseInline(content.slice(0, colon).trim());
        var val = parseInline(content.slice(colon + 1).trim());
        return '<div class="em-kv"' + pad + '><span class="em-kv-key">' + key + '</span><span class="em-kv-val">' + val + '</span></div>';
      }
      return '<div class="em-kv"' + pad + '>' + parsed + '</div>';
    }
    default: return '<p' + pad + '>' + parsed + '</p>';
  }
}

function renderListItem(type, content) {
  var parsed = parseInline(content);
  switch (type) {
    case 'task':
      return '<li class="em-task">' + renderTask(content) + '</li>';
    case 'question':
      return '<li class="em-question"><span class="em-qmark">?</span> ' + parsed + '</li>';
    case 'warning':
      return '<li class="em-important"><span class="em-prio">!</span> ' + parsed + '</li>';
    default:
      return '<li>' + parsed + '</li>';
  }
}

function renderFmRow(trimmed) {
  var colon = trimmed.indexOf(':');
  if (colon > 0) {
    var key = trimmed.slice(0, colon).trim();
    var val = trimmed.slice(colon + 1).trim();
    return '<div class="em-fm-row"><span class="em-fm-key">' + esc(key) + '</span><span class="em-fm-val">' + parseInline(val) + '</span></div>';
  }
  return '<div class="em-fm-row"><span class="em-fm-val">' + parseInline(trimmed) + '</span></div>';
}

function renderTable(rows) {
  if (rows.length === 0) return '';
  var html = '<table class="em-table"><thead><tr>';
  var headerCells = rows[0].split('|').filter(function(c) { return c.trim() !== ''; });
  headerCells.forEach(function(c) {
    html += '<th>' + parseInline(c.trim()) + '</th>';
  });
  html += '</tr></thead><tbody>';
  var start = 1;
  if (rows.length > 1) {
    var sep = rows[1].replace(/\|/g, '').replace(/-/g, '').trim();
    if (sep === '') start = 2;
  }
  for (var i = start; i < rows.length; i++) {
    html += '<tr>';
    var cells = rows[i].split('|').filter(function(c) { return c.trim() !== ''; });
    cells.forEach(function(c) {
      html += '<td>' + parseInline(c.trim()) + '</td>';
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderKanban(cols, buf) {
  var html = '<div class="em-kanban">';
  cols.forEach(function(col, idx) {
    html += '<div class="em-kb-col">';
    html += '<div class="em-kb-col-header">' + esc(col) + '</div>';
    if (buf[idx]) html += buf[idx];
    html += '</div>';
  });
  html += '</div>';
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
  if (dueHtml) {
    result += ' <span class="em-due">' + dueHtml + '</span>';
  }
  return result;
}

var DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
var MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
var MON3 = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function parseNaturalDate(text) {
  var lower = text.toLowerCase();

  if (/\btomorrow\b/.test(lower)) {
    var d = new Date(); d.setDate(d.getDate() + 1);
    return fmtDate(d);
  }
  if (/\btoday\b/.test(lower)) {
    return fmtDate(new Date());
  }
  if (/\bnext week\b/.test(lower)) {
    var d = new Date(); d.setDate(d.getDate() + 7);
    return fmtDate(d);
  }

  var dayMatch = lower.match(/\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (dayMatch) {
    return fmtDate(nextDay(DAYS.indexOf(dayMatch[1])));
  }

  for (var i = 0; i < DAYS.length; i++) {
    if (lower.indexOf(DAYS[i]) !== -1) {
      return fmtDate(nextDay(i));
    }
  }

  var dateMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (dateMatch) {
    return dateMatch[0];
  }

  return null;
}

function nextDay(target) {
  var d = new Date();
  var current = d.getDay();
  var diff = target - current;
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function fmtDate(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function parseInline(text) {
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  text = text.replace(/!([^!\s][^!]*[^!\s]|[^!\s])!/g, '<strong>$1</strong>');

  text = text.replace(/\{\{note:([^}]+)\}\}/gi, function(match, title) {
    var t = title.trim();
    var found = null;
    for (var i = 0; i < _emeraldNotes.length; i++) {
      if (_emeraldNotes[i].title.toLowerCase() === t.toLowerCase()) {
        found = _emeraldNotes[i];
        break;
      }
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
        } else {
          result += '<span class="em-ip-tag">' + part + '</span>';
        }
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
