export function normalizeImageUrl(value: string) {
  const source = value.trim();
  if (!source) return '';
  if (/^\/uploads\/[a-zA-Z0-9-]+\.(?:jpg|png|webp|gif)$/i.test(source)) return source;
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(source)) return source;

  const linkStart = source.indexOf('](');
  const markdownUrl = source.match(/\]\((https?:\/\/[^)\s]+)/i)?.[1];
  const candidate = /^https?:\/\//i.test(source) && linkStart >= 0
    ? source.slice(0, linkStart)
    : markdownUrl || source;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? candidate : '';
  } catch {
    return '';
  }
}