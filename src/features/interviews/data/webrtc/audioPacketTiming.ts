import type { CallDescription } from '../../models/interview';

/** Ask Opus peers for 10 ms speech packets without changing transport or video negotiation. */
export function speechPacketTiming(description: CallDescription): CallDescription {
  const newline = description.sdp.includes('\r\n') ? '\r\n' : '\n';
  const lines = description.sdp.split(/\r?\n/);
  let changed = false;
  for (let start = 0; start < lines.length; start++) {
    if (!/^m=audio (?!0(?:\s|$))/.test(lines[start])) continue;
    let end = start + 1;
    while (end < lines.length && !lines[end].startsWith('m=')) end++;
    const section = lines.slice(start, end);
    if (!section.some((line) => /^a=rtpmap:\d+ opus\/48000(?:\/2)?$/i.test(line))) continue;
    const timing = section.findIndex((line) => /^a=ptime:/.test(line));
    if (timing >= 0) lines[start + timing] = 'a=ptime:10';
    else {
      lines.splice(start + 1, 0, 'a=ptime:10');
      end++;
    }
    changed = true;
    start = end - 1;
  }
  return changed ? { ...description, sdp: lines.join(newline) } : description;
}
