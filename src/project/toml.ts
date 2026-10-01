// ── opm.toml: write the keys the page controls, read the few it needs ─────
// Not a TOML parser: it reads string and string-array values, which is all the
// page looks at, and edits leave every other line of the file as it is.

export type TomlValue = string | string[];
export type TomlConfig = Record<string, Record<string, TomlValue>>;

const q = (s: string) => JSON.stringify(s);
const sectionEnd = (lines: string[], head: number) => {
  for (let i = head + 1; i < lines.length; i++) if (/^\s*\[/.test(lines[i])) return i;
  return lines.length;
};

/** Set section.key = value in place, keeping everything else in the file as it is. */
export function setToml(text: string, section: string, key: string, value: string): string {
  const line = `${key} = ${q(value)}`, lines = text ? text.split('\n') : [];
  const head = lines.findIndex(l => l.trim() === `[${section}]`);
  if (head < 0) return (text && !text.endsWith('\n') ? text + '\n' : text) + (text ? '\n' : '') + `[${section}]\n${line}\n`;
  const end = sectionEnd(lines, head), re = new RegExp(`^\\s*${key}\\s*=`);
  for (let i = head + 1; i < end; i++) if (re.test(lines[i])) { lines[i] = line; return lines.join('\n'); }
  lines.splice(head + 1, 0, line);
  return lines.join('\n');
}

/** Drop section.key, leaving the rest of the file as it is. */
export function unsetToml(text: string, section: string, key: string): string {
  const lines = text.split('\n'), head = lines.findIndex(l => l.trim() === `[${section}]`);
  if (head < 0) return text;
  const end = sectionEnd(lines, head), re = new RegExp(`^\\s*${key}\\s*=`);
  for (let i = head + 1; i < end; i++) if (re.test(lines[i])) { lines.splice(i, 1); break; }
  return lines.join('\n');
}

export function readToml(text: string): TomlConfig {
  const cfg: TomlConfig = {};
  let sec = '';
  for (const line of text.split('\n')) {
    const h = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (h) { sec = h[1].trim(); continue; }
    const kv = line.match(/^\s*([\w.-]+)\s*=\s*(.+?)\s*$/);
    if (!kv || sec.startsWith('[')) continue;
    const raw = kv[2];
    let v: TomlValue;
    if (raw.startsWith('"')) {
      const m = raw.match(/^"(?:[^"\\]|\\.)*"/);
      try { v = JSON.parse(m![0]); } catch { continue; }
    } else if (raw.startsWith('[')) {
      v = (raw.match(/"(?:[^"\\]|\\.)*"/g) || []).map(s => JSON.parse(s) as string);
    } else continue;
    (cfg[sec] ||= {})[kv[1]] = v;
  }
  return cfg;
}

/** A string value from the config, or '' when it is missing or not a string. */
export const tomlString = (cfg: TomlConfig, section: string, key: string): string => {
  const v = cfg[section]?.[key];
  return typeof v === 'string' ? v : '';
};
