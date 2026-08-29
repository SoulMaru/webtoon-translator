import Rail, { type RailTag } from '@/components/atelier/Rail';
import Gallery from '@/components/atelier/Gallery';
import ClosedNotice from '@/components/atelier/ClosedNotice';
import Colophon from '@/components/atelier/Colophon';
import { getSite, getWorks, isOnline } from '@/lib/atelier';
import type { Work } from '@/lib/atelier-types';

// 작업실 컴퓨터가 켜져 있는지를 방문 때마다 확인해야 하므로 미리 구워 두지 않습니다.
export const dynamic = 'force-dynamic';

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Seoul',
});

function countTags(works: Work[]): RailTag[] {
  const counts = new Map<string, number>();
  for (const w of works) {
    for (const t of w.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))
    .slice(0, 6);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const [{ tag }, online, site] = await Promise.all([
    searchParams,
    isOnline(),
    getSite(),
  ]);

  if (!online) {
    return (
      <div className="layout">
        <Rail
          title={site.title}
          tagline={site.tagline}
          online={false}
          total={0}
          tags={[]}
          latest={null}
        />
        <main className="stage">
          <div className="crumbs">
            <span>작업실</span>
            <span>/</span>
            <span className="here">보관함</span>
          </div>
          <div className="stage-inner">
            <ClosedNotice />
          </div>
        </main>
      </div>
    );
  }

  const list = await getWorks();
  const all = list?.items ?? [];
  const works = tag ? all.filter((w) => w.tags.includes(tag)) : all;
  const latest = all[0] ? dateFormat.format(new Date(all[0].createdAt)) : null;

  return (
    <div className="layout">
      <Rail
        title={site.title}
        tagline={site.tagline}
        online
        total={all.length}
        tags={countTags(all)}
        latest={latest}
      />

      <main className="stage">
        <div className="crumbs">
          <span>작업실</span>
          <span>/</span>
          <span className="here">{tag ? tag : '보관함'}</span>
        </div>

        <div className="stage-inner">
          <section className="hero">
            <div>
              <div className="eyebrow">새김 작업실</div>
              <h1>
                한 장씩 새겨
                <br />
                <span className="tint">여기에 걸어 둡니다.</span>
              </h1>
              <p>{site.intro || '작업실 컴퓨터에서 곧바로 가져와 걸어 둡니다.'}</p>
            </div>

            <aside className="note">
              <div className="note-num">01</div>
              <div className="note-body">
                <strong>작업실이 곧 서버입니다.</strong>
                컴퓨터를 끄면 이 자리도 함께 닫힙니다.
              </div>
            </aside>
          </section>

          <section>
            <div className="shelf-head">
              <div>
                <div className="eyebrow" style={{ marginBottom: 14 }}>
                  내 보관함
                </div>
                <h2>{tag ? `${tag} 작업` : '걸어 둔 작품'}</h2>
              </div>
            </div>

            <p className="shelf-count">
              <b>{works.length}</b>개의 작품이 이 작업실에 있어요
              {tag && (
                <>
                  {' · '}
                  <a href="/" style={{ color: 'var(--primary)' }}>
                    전체 보기
                  </a>
                </>
              )}
            </p>

            <Gallery works={works} />
          </section>

          <Colophon count={all.length} />
        </div>
      </main>
    </div>
  );
}
