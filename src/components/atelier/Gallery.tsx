import Image from 'next/image';
import Link from 'next/link';
import { mediaUrl } from '@/lib/atelier';
import type { Work } from '@/lib/atelier-types';

export default function Gallery({ works }: { works: Work[] }) {
  if (works.length === 0) {
    return <p className="empty">아직 걸어 둔 작품이 없습니다.</p>;
  }

  return (
    <div className="gallery">
      {works.map((work, i) => (
        <Link key={work.slug} href={`/work/${work.slug}`} className="card">
          <div className="card-frame">
            <Image
              src={mediaUrl(work.mediaFile)}
              alt={work.title}
              width={work.width || 1600}
              height={work.height || 900}
              sizes="(max-width: 700px) 100vw, (max-width: 1180px) 50vw, 380px"
              priority={i < 3}
            />
          </div>
          <div className="card-label">
            <span className="card-title">{work.title}</span>
            <span className="card-meta">{work.width}×{work.height}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
