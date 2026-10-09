import { PageLoading } from "@/components/student/PageLoading";
import "../../student.css";

// 뉴스북 보기에는 하단 탭이 없으므로 뼈대에도 탭을 그리지 않는다
export default function Loading() {
  return <PageLoading />;
}
