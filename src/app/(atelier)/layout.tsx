import type { Metadata } from "next";
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import "./atelier.css";

// 라틴 글자용. 한글 글리프가 없으므로 한글은 아래 웹폰트가 받습니다.
const display = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--atelier-display-latin",
  display: "swap",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--atelier-sans-latin",
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
    <>
      {/*
        한글 웹폰트. 둘 다 unicode-range 로 잘게 나뉘어 있어서
        브라우저가 화면에 실제로 쓰인 글자 조각만 내려받습니다.
        React 19 가 이 link 들을 <head> 로 끌어올립니다.
      */}
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap"
      />
      <div className={`${display.variable} ${sans.variable} atelier-root`}>{children}</div>
    </>
  );
}
