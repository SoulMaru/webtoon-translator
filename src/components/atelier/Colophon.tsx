export default function Colophon({ count }: { count: number }) {
  return (
    <footer className="colophon">
      <span>ATELIER · 새김AI</span>
      <span>{count > 0 ? `작품 ${count}점 · saegimai.com` : 'saegimai.com'}</span>
    </footer>
  );
}
