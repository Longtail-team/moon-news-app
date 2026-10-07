"use client";

// 잠깐 보이는 알림. 보여 준 뒤 주소의 ?done= 을 지워 새로고침해도 다시 뜨지 않게 한다.
import { useEffect } from "react";

export function Toast({ message }: { message: string }) {
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
