import Link from 'next/link';

export type RailTag = { name: string; count: number };

const DOTS = ['var(--dot-orange)', 'var(--dot-blue)', 'var(--dot-green)'];

/** 왼쪽 세로 띠 — 이름표, 공방 상태, 작품 수, 태그별 바로가기. */
export default function Rail({
  title,
  tagline,
  online,
  total,
  tags,
  latest,
}: {
  title: string;
  tagline: string;
  online: boolean;
  total: number;
  tags: RailTag[];
  latest: string | null;
}) {
  return (
    <aside className="rail">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden="true">
          새
        </span>
        <span>
          <span className="brand-name">{tagline || 'Atelier'}</span>
          <span className="brand-sub">{title} · 이미지 작업실</span>
        </span>
      </Link>

      <div className={online ? 'status' : 'status is-off'}>
        <span className="status-dot" aria-hidden="true" />
        <span>
          <span className="status-title">{online ? '공방 문 열림' : '공방 문 닫힘'}</span>
          <span className="status-note">
            {online ? '작업실 컴퓨터가 켜져 있습니다' : '작업실 컴퓨터가 꺼져 있습니다'}
          </span>
        </span>
      </div>

      <div>
        <div className="rail-label">작업실</div>
        <nav className="rail-group">
          <Link href="/" className="rail-item is-on">
            보관함
            <span className="count">{total}</span>
          </Link>
        </nav>
      </div>

      {tags.length > 0 && (
        <div>
          <div className="rail-label">바로가기</div>
          <nav className="rail-group">
            {tags.map((t, i) => (
              <Link key={t.name} href={`/?tag=${encodeURIComponent(t.name)}`} className="rail-item">
                <span
                  className="rail-diamond"
                  style={{ background: DOTS[i % DOTS.length] }}
                  aria-hidden="true"
                />
                {t.name}
                <span className="count">{String(t.count).padStart(2, '0')}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}

      <hr className="rail-rule" />

      <div className="rail-foot">
        모든 작품은 작업실 컴퓨터에만
        <br />
        보관되어 있습니다.
        {latest && (
          <>
            <br />
            <br />
            마지막으로 새긴 날 {latest}
          </>
        )}
      </div>
    </aside>
  );
}
