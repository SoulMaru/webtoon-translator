import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Rail from '@/components/atelier/Rail';
import ClosedNotice from '@/components/atelier/ClosedNotice';
import Colophon from '@/components/atelier/Colophon';
import { getSite, getWork, getWorks, isOnline, mediaUrl } from '@/lib/atelier';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const work = await getWork(slug);
  if (!work) return { title: '없는 작품' };
  return {
    title: work.title,
    description: work.description || undefined,
    openGraph: { images: [mediaUrl(work.mediaFile)] },
  };
}

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Seoul',
});

const ORIENTATION: Record<string, string> = {
  landscape: '가로',
  portrait: '세로',
  square: '정사각',
};

export default async function WorkPage({ params }: Props) {
  const { slug } = await params;
  const [online, site] = await Promise.all([isOnline(), getSite()]);

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
          <div className="stage-inner">
            <ClosedNotice />
          </div>
        </main>
      </div>
    );
  }

  const [work, list] = await Promise.all([getWork(slug), getWorks()]);
  if (!work) notFound();
  const total = list?.total ?? 0;

  return (
    <div className="layout">
      <Rail
        title={site.title}
        tagline={site.tagline}
        online
        total={total}
        tags={[]}
        latest={null}
      />

      <main className="stage">
        <div className="crumbs">
          <Link href="/">작업실</Link>
          <span>/</span>
          <span className="here">{work.title}</span>
        </div>

        <div className="stage-inner">
          <Link href="/" className="back">
            ← 목록으로
          </Link>

          <article className="work">
            <div className="work-frame">
              <Image
                src={mediaUrl(work.mediaFile)}
                alt={work.title}
                width={work.width || 1600}
                height={work.height || 900}
                sizes="(max-width: 980px) 100vw, 700px"
                priority
              />
            </div>

            <div className="work-info">
              <h1>{work.title}</h1>
              {work.description && <p>{work.description}</p>}

              <dl className="spec">
                <div>
                  <dt>크기</dt>
                  <dd>
                    {work.width} × {work.height}
                  </dd>
                </div>
                <div>
                  <dt>방향</dt>
                  <dd>{ORIENTATION[work.orientation] ?? work.orientation}</dd>
                </div>
                <div>
                  <dt>새긴 날</dt>
                  <dd>{dateFormat.format(new Date(work.createdAt))}</dd>
                </div>
              </dl>

              {work.tags.length > 0 && (
                <div className="tags">
                  {work.tags.map((t) => (
                    <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="chip">
                      {t}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </article>

          <Colophon count={total} />
        </div>
      </main>
    </div>
  );
}
