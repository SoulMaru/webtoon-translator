import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="shell">
      <div className="closed">
        <div className="seal" aria-hidden="true">없음</div>
        <h1>그 자리에는 아무것도 걸려 있지 않습니다</h1>
        <p className="note"><Link href="/">목록으로 돌아가기</Link></p>
      </div>
    </main>
  );
}
