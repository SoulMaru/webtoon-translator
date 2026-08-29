import type { Metadata } from "next";
import "./atelier.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://saegimai.com"),
  title: { default: "새김AI · Atelier", template: "%s · 새김AI" },
  description: "한 장씩 새겨 둔 것들을 걸어 두는 자리입니다.",
  openGraph: { type: "website", siteName: "새김AI", locale: "ko_KR" },
};

export default function AtelierLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
