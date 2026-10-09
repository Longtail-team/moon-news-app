// 다음 화면을 불러오는 동안 바로 보여 주는 뼈대(각 화면의 loading.tsx). 누르자마자 화면이 바뀌어 기다리는 느낌을 줄인다.
import { TabBar, type Tab } from "./TabBar";

export function PageLoading({ tab }: { tab?: Exclude<Tab, "home"> }) {
  return (
    <div className="app" aria-busy="true" aria-label="불러오는 중">
      <div className="scroll pad stack" style={{ paddingTop: 20 }}>
        <div className="skel" style={{ height: 28, width: "45%", borderRadius: 8 }} />
        <div className="skel" style={{ height: 150 }} />
        <div className="skel" style={{ height: 96 }} />
        <div className="skel" style={{ height: 72 }} />
      </div>
      {tab && <TabBar active={tab} />}
    </div>
  );
}
