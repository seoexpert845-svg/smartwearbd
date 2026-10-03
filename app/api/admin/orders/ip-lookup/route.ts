import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-api';
import { fetchPublicIpv4, isLoopbackIp, normalizeClientIp } from '@/lib/client-ip';

function isPrivateAddress(ip: string) {
  if (ip.includes(':')) {
    const normalized = ip.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') || normalized.startsWith('::ffff:192.168.');
  }
  const octets = ip.split('.').map(Number);
  return octets[0] === 10 || octets[0] === 127 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168) || octets[0] === 0;
}

function normalizeLocation(data: Record<string, unknown>, ip: string, provider: string) {
  const nested = data.data && typeof data.data === 'object' && !Array.isArray(data.data)
    ? data.data as Record<string, unknown>
    : data;
  const division = nested.division || nested.region || nested.regionName || nested.region_name || '';
  const city = nested.city || nested.town || nested.locality || '';
  return {
    ip,
    city: String(city),
    district: String(nested.district || nested.county || nested.city || nested.town || ''),
    thana: String(nested.thana || nested.upazila || nested.subdistrict || nested.subregion || nested.neighborhood || ''),
    division: String(division),
    region: String(division),
    country: String(nested.country_name || nested.country || ''),
    isp: String(nested.isp || nested.org || nested.organization || nested.connection && (nested.connection as Record<string, unknown>).isp || nested.as || ''),
    latitude: Number(nested.latitude ?? nested.lat) || null,
    longitude: Number(nested.longitude ?? nested.lon ?? nested.lng) || null,
    provider,
  };
}

async function fetchGeoIp(url: string, apiKey: string, ip: string, provider: string) {
  const target = url.includes('{ip}') ? url.replace('{ip}', encodeURIComponent(ip)) : `${url}${url.includes('?') ? '&' : '?'}ip=${encodeURIComponent(ip)}`;
  const response = await fetch(target, { headers: apiKey ? { Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey } : {}, cache: 'no-store', signal: AbortSignal.timeout(4500) });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok || data.status === 'fail' || data.error) throw new Error(String(data.message || data.error || `GeoIP provider returned ${response.status}.`));
  return normalizeLocation(data, ip, provider);
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let ip = normalizeClientIp(new URL(request.url).searchParams.get('ip'));
  if (!isIP(ip)) return NextResponse.json({ success: false, error: 'IP address সঠিক নয়।' }, { status: 400 });
  if (isLoopbackIp(ip)) {
    try {
      ip = await fetchPublicIpv4();
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Public IP could not be resolved.' }, { status: 502 });
    }
  }
  if (isPrivateAddress(ip)) {
    return NextResponse.json({ success: false, error: 'Private/local IP addresses do not have public GeoIP locations.' }, { status: 422 });
  }
  try {
    const customEndpoint = process.env.IP_GEOLOCATION_API_URL;
    const customKey = process.env.IP_GEOLOCATION_API_KEY || '';
    let providerError: unknown;
    if (customEndpoint) {
      try { return NextResponse.json({ success: true, data: await fetchGeoIp(customEndpoint, customKey, ip, 'configured-provider') }); }
      catch (error) { providerError = error; }
    }
    try { return NextResponse.json({ success: true, data: await fetchGeoIp(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, '', ip, 'ipapi.co') }); }
    catch (error) {
      providerError = error;
      try { return NextResponse.json({ success: true, data: await fetchGeoIp(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,query,country,regionName,city,isp,org,as,lat,lon`, '', ip, 'ip-api.com') }); }
      catch { throw providerError; }
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'IP lookup failed.' }, { status: 502 });
  }
}