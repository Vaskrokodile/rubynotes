function parseEmerald(text) {
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let listType = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      if (inList) { html += '</ul>'; inList = false; listType = ''; }
      continue;
    }

    if (trimmed.startsWith('!! ')) {
      closeList();
      html += '<h1>' + parseInline(trimmed.slice(3)) + '</h1>';
    } else if (trimmed.startsWith('Title: ')) {
      closeList();
      html += '<h1>' + parseInline(trimmed.slice(7)) + '</h1>';
    } else if (trimmed.startsWith('h2: ')) {
      closeList();
      html += '<h2>' + parseInline(trimmed.slice(4)) + '</h2>';
    } else if (trimmed.startsWith('h3: ')) {
      closeList();
      html += '<h3>' + parseInline(trimmed.slice(4)) + '</h3>';
    } else if (trimmed.startsWith('h4: ')) {
      closeList();
      html += '<h4>' + parseInline(trimmed.slice(4)) + '</h4>';
    } else if (trimmed.startsWith('> ')) {
      openList('task');
      html += '<li class="em-task">' + parseTask(trimmed.slice(2)) + '</li>';
    } else if (trimmed.startsWith('? ')) {
      openList('question');
      html += '<li class="em-question"><span class="em-qmark">?</span> ' + parseInline(trimmed.slice(2)) + '</li>';
    } else if (trimmed.match(/^!\s/) && !trimmed.startsWith('!! ')) {
      openList('important');
      html += '<li class="em-important"><span class="em-prio">HIGH</span> ' + parseInline(trimmed.slice(2)) + '</li>';
    } else if (trimmed.startsWith('- ')) {
      openList('ul');
      html += '<li>' + parseInline(trimmed.slice(2)) + '</li>';
    } else {
      closeList();
      html += '<p>' + parseInline(trimmed) + '</p>';
    }
  }

  closeList();
  return html;

  function closeList() {
    if (inList) { html += '</ul>'; inList = false; listType = ''; }
  }

  function openList(type) {
    if (!inList || listType !== type) {
      closeList();
      const cls = type === 'task' ? 'em-task-list' : type === 'question' ? 'em-question-list' : type === 'important' ? 'em-important-list' : 'em-list';
      html += '<ul class="' + cls + '">';
      inList = true;
      listType = type;
    }
  }
}

function parseInline(text) {
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  text = text.replace(/!([^!\s][^!]*[^!\s]|[^!\s])!/g, '<strong>$1</strong>');
  return text;
}

function parseTask(text) {
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
