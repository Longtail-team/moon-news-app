// 시험용 주문 지우기: test-order.mjs로 만든 보호자(샘플 번호 0100000xxxx)와 그 주문·학습자·기록·링크를 지운다
// 사용: node --env-file=.env.local scripts/delete-test-order.mjs <번호 0100000xxxx>
import { createClient } from "@supabase/supabase-js";

const phone = process.argv[2];
if (!/^0100000\d{4}$/.test(phone ?? "")) {
  console.error("샘플 번호(0100000xxxx)만 지울 수 있어요.");
  process.exit(1);
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = ({ error }) => {
  if (error) throw error;
};
const { data: g } = await db.from("guardians").select("guardian_id").eq("phone", phone).maybeSingle();
if (!g) {
  console.log("없음");
  process.exit(0);
}
const { data: studs } = await db.from("students").select("student_id").eq("guardian_id", g.guardian_id);
const sids = (studs ?? []).map((s) => s.student_id);
const { data: ens } = sids.length ? await db.from("enrollments").select("enrollment_id").in("student_id", sids) : { data: [] };
const eids = (ens ?? []).map((e) => e.enrollment_id);

// 올린 파일
for (const folder of ["recordings", "photos"])
  for (const e of eids) {
    const { data: files } = await db.storage.from("media").list(`${folder}/${e}`);
    if (files?.length) must(await db.storage.from("media").remove(files.map((f) => `${folder}/${e}/${f.name}`)));
  }
must(await db.from("notifications").delete().eq("guardian_id", g.guardian_id));
if (sids.length) must(await db.from("notifications").delete().in("student_id", sids));
if (eids.length) must(await db.from("activities").delete().in("enrollment_id", eids));
if (eids.length) must(await db.from("enrollments").delete().in("enrollment_id", eids));
must(await db.from("access_tokens").delete().eq("guardian_id", g.guardian_id)); // 세션은 함께 지워진다
if (sids.length) must(await db.from("access_tokens").delete().in("student_id", sids));
if (sids.length) must(await db.from("students").delete().in("student_id", sids));
must(await db.from("orders").delete().eq("guardian_id", g.guardian_id));
must(await db.from("guardians").delete().eq("guardian_id", g.guardian_id));
console.log(`지움: 보호자 1, 학습자 ${sids.length}, 수강 ${eids.length}`);
