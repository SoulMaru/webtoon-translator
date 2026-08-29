import Link from 'next/link';

export default function Masthead({ title, tagline }: { title: string; tagline: string }) {
  return (
    <header className="masthead">
      <Link href="/" className="wordmark">{title}</Link>
      <span className="wordmark-sub">{tagline}</span>
    </header>
  );
}
