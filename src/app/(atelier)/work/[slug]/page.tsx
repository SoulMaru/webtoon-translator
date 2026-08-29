import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Masthead from '@/components/atelier/Masthead';
import ClosedNotice from '@/components/atelier/ClosedNotice';
import { getSite, getWork, isOnline, mediaUrl } from '@/lib/atelier';

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
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul',
});

export default async function WorkPage({ params }: Props) {
  const { slug } = await params;
  const [online, site] = await Promise.all([isOnline(), getSite()]);

  if (!online) {
    return (
      <main className="shell">
        <Masthead title={site.title} tagline={site.tagline} />
        <ClosedNotice />
      </main>
    );
  }

  const work = await getWork(slug);
  if (!work) notFound();

  return (
    <main className="shell">
      <Masthead title={site.title} tagline={site.tagline} />
      <Link href="/" className="back">← 목록으로</Link>

      <article className="work">
        <div className="work-frame">
          <Image
            src={mediaUrl(work.mediaFile)}
            alt={work.title}
            width={work.width || 1600}
            height={work.height || 900}
            sizes="(max-width: 900px) 100vw, 860px"
            priority
          />
        </div>

        <div className="work-info">
          <h1>{work.title}</h1>
          {work.description && <p>{work.description}</p>}

          <dl className="spec">
            <div>
              <dt>크기</dt>
              <dd>{work.width} × {work.height}</dd>
            </div>
            <div>
              <dt>방향</dt>
              <dd>
                {work.orientation === 'landscape' ? '가로'
                  : work.orientation === 'portrait' ? '세로' : '정사각'}
              </dd>
            </div>
            <div>
              <dt>새긴 날</dt>
              <dd>{dateFormat.format(new Date(work.createdAt))}</dd>
            </div>
          </dl>

          {work.tags.length > 0 && (
            <div className="tags">
              {work.tags.map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
        </div>
      </article>
    </main>
  );
}
