import { API_BASE, isOnline } from '@/lib/atelier';

export const dynamic = 'force-dynamic';

/** 작업실 컴퓨터가 지금 켜져 있는지 확인하는 자리. /status 로 열면 됩니다. */
export async function GET() {
  const online = await isOnline();
  return Response.json(
    {
      online,
      apiBase: API_BASE,
      checkedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
