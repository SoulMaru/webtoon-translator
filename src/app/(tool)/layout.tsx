import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "웹툰·만화 이미지 번역기",
  description:
    "업로드한 이미지/PDF에서 글자를 인식해 원본 위에 번역을 겹쳐 보여주는 오픈소스 도구",
};

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
