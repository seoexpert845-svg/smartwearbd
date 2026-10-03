import { isIP } from 'node:net';

export function normalizeClientIp(value: string | null | undefined) {
  let candidate = value?.split(',')[0]?.trim().replace(/^for=/i, '').replace(/^"|"$/g, '') || '';
  const bracketed = candidate.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) candidate = bracketed[1];
  const mappedIpv4 = candidate.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedIpv4 && isIP(mappedIpv4[1]) === 4) return mappedIpv4[1];
  return isIP(candidate) ? candidate : '';
}

export function isLoopbackIp(ip: string) {
  return ip === '::1' || ip.toLowerCase() === '0:0:0:0:0:0:0:1' || ip.startsWith('127.');
}

function isPrivateIpv4(ip: string) {
  const [first, second] = ip.split('.').map(Number);
  return first === 0 || first === 10 || first === 127
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 169 && second === 254);
}

export async function fetchPublicIpv4() {
  let providerError: unknown;
  for (const endpoint of ['https://ipapi.co/json/', 'https://api.ipify.org?format=json']) {
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(3500) });
      if (!response.ok) throw new Error(`Public IP service returned ${response.status}.`);
      const body = await response.json() as { ip?: unknown };
      const ip = normalizeClientIp(typeof body.ip === 'string' ? body.ip : '');
      if (isIP(ip) !== 4 || isPrivateIpv4(ip)) throw new Error('Public IP service did not return a public IPv4 address.');
      return ip;
    } catch (error) {
      providerError = error;
    }
  }
  throw providerError instanceof Error ? providerError : new Error('Unable to fetch a public IPv4 address.');
}

export async function resolveClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const candidate = normalizeClientIp(forwarded) || normalizeClientIp(request.headers.get('x-real-ip'));
  const requestHost = request.headers.get('host') || new URL(request.url).hostname;
  const isLocalDevelopmentRequest = process.env.NODE_ENV !== 'production'
    && (requestHost === 'localhost' || requestHost.startsWith('localhost:')
      || requestHost === '127.0.0.1' || requestHost.startsWith('127.0.0.1:')
      || requestHost === '[::1]' || requestHost.startsWith('[::1]:'));
  if (candidate && !isLoopbackIp(candidate)) return candidate;
  if (candidate && !isLocalDevelopmentRequest) return '';
  if (!candidate && !isLocalDevelopmentRequest) return '';
  try {
    return await fetchPublicIpv4();
  } catch (error) {
    console.warn('Unable to resolve a public IP for a local client:', error);
    return '';
  }
}
