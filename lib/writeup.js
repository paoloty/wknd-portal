// Shared writeup parser — handles all three storage formats:
//   1. Legacy:  **Title** Body text
//   2. HTML:    <b>Title</b><br>Body text  (saved by WYSIWYG editor)
//   3. Plain:   First line\nBody text

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseWriteup(writeup) {
  const s = String(writeup || '').trim();
  if (!s) return { title: '', body: '' };

  // HTML format (WYSIWYG output)
  if (/<[a-z][\s\S]*>/i.test(s)) {
    const m = s.match(/^([\s\S]*?)(?:<br\s*\/?>|<\/(?:p|div|h[1-6])>)([\s\S]*)$/i);
    if (m) {
      return {
        title: stripTags(m[1]).replace(/\*\*/g, '').trim(),
        body:  stripTags(m[2]).replace(/\*\*/g, '').trim(),
      };
    }
    return { title: stripTags(s).replace(/\*\*/g, '').trim(), body: '' };
  }

  // Legacy ** format: **Title** rest
  const starM = s.match(/^\*\*(.+?)\*\*\s*([\s\S]*)/);
  if (starM) return { title: starM[1].trim(), body: starM[2].trim() };

  // Plain text: first line = title
  const nl = s.indexOf('\n');
  if (nl !== -1) return {
    title: s.slice(0, nl).replace(/\*\*/g, '').trim(),
    body:  s.slice(nl + 1).trim(),
  };

  return { title: s.replace(/\*\*/g, '').trim(), body: '' };
}
