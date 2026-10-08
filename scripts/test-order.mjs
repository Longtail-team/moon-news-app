// 시험용 주문 만들기 (아임웹 결제 신호 연결 전까지)
// 사용: node --env-file=.env.local scripts/test-order.mjs <번호 0100000xxxx> [수량=1] [기수=1] [주소=https://news.momthereader.com]
// 결제자(보호자)·주문·보호자 링크를 만들고 링크를 출력한다. 샘플 번호(0100000xxxx)만 허용한다.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const [phone, qty = "1", cohortNo = "1", origin = "https://news.momthereader.com"] = process.argv.slice(2);
if (!/^0100000\d{4}$/.test(phone ?? "")) {
  console.error("샘플 번호(0100000xxxx)만 쓸 수 있어요. 예: node --env-file=.env.local scripts/test-order.mjs 01000009001 2");
  process.exit(1);
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: cohort, error: e0 } = await db.from("cohorts").select("cohort_id").eq("cohort_no", Number(cohortNo)).single();
if (e0) throw e0;
const { data: order, error: e1 } = await db.rpc("record_order", {
  p_imweb_order_no: `TEST-${Date.now()}`,
  p_phone: phone,
  p_cohort: cohort.cohort_id,
  p_quantity: Number(qty),
  p_paid_amount: 120000 * Number(qty),
});
if (e1) throw e1;
const raw = randomBytes(24).toString("base64url");
const { error: e2 } = await db.rpc("issue_token", {
  p_holder: "guardian",
  p_guardian: order.guardian_id,
  p_student: null,
  p_phone: phone,
  p_token_hash: createHash("sha256").update(raw, "utf8").digest("hex"),
});
if (e2) throw e2;
console.log(`주문 ${qty}명 · ${cohortNo}기 · ${phone}`);
console.log(`${origin}/a/${raw}`);
