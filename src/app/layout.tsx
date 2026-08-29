import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// 이 저장소는 두 가지를 담고 있습니다.
//   /            새김AI Atelier  — src/app/(atelier)
//   /translator  이미지 번역기   — src/app/(tool)
// 서로 스타일이 섞이지 않도록 전역 CSS 는 각 그룹의 레이아웃에서 따로 불러옵니다.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
