"use client";

// 잠깐 보이는 알림. 보여 준 뒤 주소의 ?done= 을 지워 새로고침해도 다시 뜨지 않게 한다.
import { useEffect } from "react";

export function Toast({ message }: { message: string }) {
  useEffect(() => {
    // ?done= 만 지우고 ?k=(홈 화면용 링크)는 남긴다
    const u = new URL(window.location.href);
    u.searchParams.delete("done");
    window.history.replaceState(null, "", u.pathname + u.search);
  }, []);
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
