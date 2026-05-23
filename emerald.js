function parseEmerald(text) {
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let listType = '';
  let indentStack = [];
  let toggleDepth = -1;
  let inFrontmatter = false;
  let fmHtml = '';

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

    if (trimmed === '---') {
      closeList();
      closeDownTo(0);
      toggleDepth = -1;
      fmHtml = '<div class="em-frontmatter">';
      inFrontmatter = true;
      continue;
    }

    if (trimmed === '') {
      closeList();
      closeDownTo(0);
      toggleDepth = -1;
      continue;
    }

    const type = detectType(trimmed);
    const content = stripPrefix(trimmed, type);

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

    const isListItem = type === 'task' || type === 'question' || type === 'warning' || type === 'list' || type === 'bullet';
    if (isListItem) {
      const effType = type === 'bullet' ? 'list' : type === 'warning' ? 'important' : type;
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
  closeList();
  closeDownTo(0);
  return html;

  function closeList() {
    if (inList) { html += '</ul>'; inList = false; listType = ''; }
  }

  function closeDownTo(level) {
    while (indentStack.length > level) {
      const popped = indentStack.pop();
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
  let tabs = 0;
  let spaces = 0;
  for (const c of line) {
    if (c === '\t') tabs++;
    else if (c === ' ') spaces++;
    else break;
  }
  return tabs + Math.floor(spaces / 2);
}

function detectType(trimmed) {
  if (trimmed === '---') return 'fm';
  if (trimmed.startsWith('# ')) return 'h1';
  if (trimmed.startsWith('!! ')) return 'h1';
  if (trimmed.startsWith('Title: ')) return 'h1';
  if (trimmed.startsWith('h2: ')) return 'h2';
  if (trimmed.startsWith('h3: ')) return 'h3';
  if (trimmed.startsWith('h4: ')) return 'h4';
  if (trimmed.startsWith('@ai ')) return 'ai';
  if (trimmed.startsWith('@ ')) return 'paragraph';
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
  const lengths = {
    h2: 4, h3: 4, h4: 4,
    ai: 4, task: 2, question: 2, warning: 2,
    comment: 2, toggle: 2, kv: 2,
    list: 2, bullet: 2,
  };
  if (lengths[type]) return trimmed.slice(lengths[type]);
  if (type === 'paragraph' && trimmed.startsWith('@ ')) return trimmed.slice(2);
  return trimmed;
}

function renderBlock(type, content, indent) {
  const parsed = parseInline(content);
  const pad = indent > 0 ? ' style="margin-left:' + (indent * 24) + 'px"' : '';
  switch (type) {
    case 'h1': return '<h1>' + parsed + '</h1>';
    case 'h2': return '<h2>' + parsed + '</h2>';
    case 'h3': return '<h3>' + parsed + '</h3>';
    case 'h4': return '<h4>' + parsed + '</h4>';
    case 'ai':
      return '<div class="em-ai"' + pad + '><span class="em-ai-label">@ai</span> ' + parsed + '</div>';
    case 'kv': {
      const colon = content.indexOf(':');
      if (colon > 0) {
        const key = parseInline(content.slice(0, colon).trim());
        const val = parseInline(content.slice(colon + 1).trim());
        return '<div class="em-kv"' + pad + '><span class="em-kv-key">' + key + '</span><span class="em-kv-val">' + val + '</span></div>';
      }
      return '<div class="em-kv"' + pad + '>' + parsed + '</div>';
    }
    default: return '<p' + pad + '>' + parsed + '</p>';
  }
}

function renderListItem(type, content) {
  const parsed = parseInline(content);
  switch (type) {
    case 'task':
      return '<li class="em-task">' + parseTaskInternal(content) + '</li>';
    case 'question':
      return '<li class="em-question"><span class="em-qmark">?</span> ' + parsed + '</li>';
    case 'warning':
      return '<li class="em-important"><span class="em-prio">!</span> ' + parsed + '</li>';
    default:
      return '<li>' + parsed + '</li>';
  }
}

function renderFmRow(trimmed) {
  const colon = trimmed.indexOf(':');
  if (colon > 0) {
    const key = trimmed.slice(0, colon).trim();
    const val = trimmed.slice(colon + 1).trim();
    return '<div class="em-fm-row"><span class="em-fm-key">' + escapeParser(key) + '</span><span class="em-fm-val">' + parseInline(val) + '</span></div>';
  }
  return '<div class="em-fm-row"><span class="em-fm-val">' + parseInline(trimmed) + '</span></div>';
}

function parseTaskInternal(text) {
  let dueDate = '';
  const dueMatch = text.match(/@due\((.+?)\)/);
  if (dueMatch) {
    dueDate = dueMatch[1];
    text = text.replace(/@due\(.+?\)/, '').trim();
  }
  let result = '<input type="checkbox" class="em-checkbox" onclick="return false;"> ' + parseInline(text);
  if (dueDate) {
    result += ' <span class="em-due">' + dueDate + '</span>';
  }
  return result;
}

function parseInline(text) {
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  text = text.replace(/!([^!\s][^!]*[^!\s]|[^!\s])!/g, '<strong>$1</strong>');

  text = text.replace(/\[([^\]]+)\]/g, function(match, inner) {
    if (inner.includes(':') || inner.includes('|')) {
      const parts = inner.split('|').map(function(p) { return p.trim(); });
      let result = '<span class="em-inline-prop">';
      parts.forEach(function(part) {
        const colon = part.indexOf(':');
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

function escapeParser(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
