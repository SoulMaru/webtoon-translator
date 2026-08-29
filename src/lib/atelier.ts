import type { Site, Work, WorkList } from './atelier-types';

export const API_BASE = (
  process.env.NEXT_PUBLIC_ATELIER_API_BASE ?? 'https://api.saegimai.com'
).replace(/\/+$/, '');

export const mediaUrl = (file: string) => `${API_BASE}/media/${encodeURIComponent(file)}`;

// 내 PC는 꺼져 있을 수 있습니다. 응답이 없을 때 방문자를 기다리게 두지 않으려고
// 모든 요청에 짧은 제한 시간을 겁니다.
async function call<T>(
  path: string,
  { timeoutMs = 4000, revalidate }: { timeoutMs?: number; revalidate?: number } = {},
): Promise<T | null> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal,
      ...(revalidate === undefined
        ? { cache: 'no-store' as const }
        : { next: { revalidate } }),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** 내 PC가 켜져 있는지 확인합니다. 캐시하지 않으므로 언제나 지금 상태입니다. */
export async function isOnline(): Promise<boolean> {
  const health = await call<{ ok: boolean }>('/health', { timeoutMs: 3000 });
  return health?.ok === true;
}

/** 작품 목록. 30초 동안은 Vercel이 들고 있으므로 내 PC를 자주 두드리지 않습니다. */
export async function getWorks(): Promise<WorkList | null> {
  return call<WorkList>('/api/works?limit=120', { revalidate: 30 });
}

export async function getWork(slug: string): Promise<Work | null> {
  return call<Work>(`/api/works/${encodeURIComponent(slug)}`, { revalidate: 30 });
}

export async function getSite(): Promise<Site> {
  const site = await call<Site>('/api/site', { revalidate: 30 });
  return site ?? { title: '새김AI', tagline: 'Atelier', intro: '' };
}
