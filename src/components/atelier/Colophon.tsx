export default function Colophon({ count }: { count: number }) {
  return (
    <footer className="colophon">
      <span>새김AI · saegimai.com</span>
      <span>{count > 0 ? `작품 ${count}점` : ''}</span>
    </footer>
  );
}
