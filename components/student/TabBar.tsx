"use client";

import Link from "next/link";
import { useState } from "react";
import { BookIcon, DocIcon, HomeIcon, UpIcon } from "./icons";

export type Tab = "home" | "materials" | "upload" | "record";

// 누르는 즉시 그 탭을 켜 보여 준다(다음 화면을 불러오는 동안에도 눌렸다는 걸 알 수 있게)
export function TabBar({ active, uploadCount }: { active: Tab | null; uploadCount?: number }) {
  const [going, setGoing] = useState<Tab | null>(null);
  const item = (key: Tab, href: string, label: string, icon: React.ReactNode, badge?: number) => (
    <Link
      className={`tab${active === key ? " on" : going === key ? " going" : ""}`}
      href={href}
      aria-current={active === key ? "page" : undefined}
      onClick={() => active !== key && setGoing(key)}
    >
      {icon}
      {badge ? <span className="badge">{badge}</span> : null}
      <span>{label}</span>
    </Link>
  );
  return (
    <nav className="tabs" aria-label="메뉴">
      {item("home", "/", "홈", <HomeIcon />)}
      {item("materials", "/materials", "이번 주 자료", <DocIcon />)}
      {item("upload", "/upload", "인스타 올리기", <UpIcon />, uploadCount)}
      {item("record", "/record", "내 기록", <BookIcon />)}
    </nav>
  );
}
