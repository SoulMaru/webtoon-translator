import Image from 'next/image';
import Link from 'next/link';
import { mediaUrl } from '@/lib/atelier';
import type { Work } from '@/lib/atelier-types';

const ORIENTATION: Record<string, string> = {
  landscape: '가로',
  portrait: '세로',
  square: '정사각',
};

export default function Gallery({ works }: { works: Work[] }) {
  if (works.length === 0) {
    return <p className="empty">아직 걸어 둔 작품이 없습니다.</p>;
  }

  return (
    <div className="grid">
      {works.map((work, i) => (
        <Link key={work.slug} href={`/work/${work.slug}`} className="card">
          <div className="card-frame">
            <Image
              src={mediaUrl(work.mediaFile)}
              alt={work.title}
              width={work.width || 1600}
              height={work.height || 900}
              sizes="(max-width: 860px) 100vw, (max-width: 1300px) 45vw, 300px"
              priority={i < 4}
            />
            <span className="card-veil">
              <span className="card-open">보기 ↗</span>
            </span>
          </div>

          <div className="card-body">
            <div className="card-title">{work.title}</div>
            {work.description && <p className="card-desc">{work.description}</p>}
            <div className="card-meta">
              <span>{ORIENTATION[work.orientation] ?? work.orientation}</span>
              <span className="sep">·</span>
              <span>
                {work.width} × {work.height}
              </span>
              {work.tags[0] && <span className="chip">{work.tags[0]}</span>}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
