import type { Metadata } from "next";
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import "./atelier.css";

// 모의화면과 같은 글꼴을 씁니다.
// 두 글꼴 모두 한글 글리프가 없으므로, 한글은 CSS 의 시스템 글꼴 스택으로 떨어집니다.
// 덕분에 내려받는 양이 작고 한글이 늦게 뜨는 일도 없습니다.
const display = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--atelier-display",
  display: "swap",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--atelier-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://saegimai.com"),
  title: { default: "새김AI · Atelier", template: "%s · 새김AI" },
  description: "한 장씩 새겨 둔 것들을 걸어 두는 자리입니다.",
  openGraph: { type: "website", siteName: "새김AI", locale: "ko_KR" },
};

export default function AtelierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${sans.variable} atelier-root`}>
      {children}
    </div>
  );
}
