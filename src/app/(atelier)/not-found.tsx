import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="layout">
      <main className="stage">
        <div className="stage-inner">
          <div className="blank">
            <div className="seal" aria-hidden="true">없음</div>
            <h1>그 자리에는 아무것도 걸려 있지 않습니다</h1>
            <p className="quiet">
              <Link href="/" style={{ color: 'var(--primary)' }}>목록으로 돌아가기</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
