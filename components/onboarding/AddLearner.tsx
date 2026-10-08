"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Onboarding as State } from "@/lib/server/onboarding";
import { Learners } from "./Onboarding";

export function AddLearner({ state }: { state: State }) {
  const router = useRouter();
  return (
    <div className="app">
      <div className="topbar">
        <Link className="back" href="/">
          ‹ 홈
        </Link>
      </div>
      <Learners s={state} adding onDone={() => router.push("/")} />
    </div>
  );
}
