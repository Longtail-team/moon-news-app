import Link from "next/link";
import { DocIcon, HomeIcon, UpIcon } from "./icons";

type Tab = "home" | "materials" | "upload";

export function TabBar({ active, uploadCount }: { active: Tab; uploadCount: number }) {
  const item = (key: Tab, href: string, label: string, icon: React.ReactNode, badge?: number) => (
    <Link className={`tab${active === key ? " on" : ""}`} href={href} aria-current={active === key ? "page" : undefined}>
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
    </nav>
  );
}
