import Masthead from '@/components/atelier/Masthead';
import Colophon from '@/components/atelier/Colophon';
import ClosedNotice from '@/components/atelier/ClosedNotice';
import Gallery from '@/components/atelier/Gallery';
import { getSite, getWorks, isOnline } from '@/lib/atelier';

// 작업실 컴퓨터가 켜져 있는지를 방문 때마다 확인해야 하므로 미리 구워 두지 않습니다.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const [online, site] = await Promise.all([isOnline(), getSite()]);

  if (!online) {
    return (
      <main className="shell">
        <Masthead title={site.title} tagline={site.tagline} />
        <ClosedNotice />
      </main>
    );
  }

  const list = await getWorks();
  const works = list?.items ?? [];

  return (
    <main className="shell">
      <Masthead title={site.title} tagline={site.tagline} />
      <section className="hero">
        <h1>{site.intro || '한 장씩 새겨 둔 것들입니다.'}</h1>
        <p>작업실 컴퓨터에서 곧바로 가져와 걸어 둡니다.</p>
      </section>
      <Gallery works={works} />
      <Colophon count={list?.total ?? 0} />
    </main>
  );
}
