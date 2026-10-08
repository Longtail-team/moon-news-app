// 콘텐츠 시트 → 앱 반영 (docs/tasks/T05-콘텐츠-시트-반영.md)
// GitHub Actions(.github/workflows/content-sync.yml)가 매일 새벽 실행한다. 구글 연결은 키 파일 없이(Workload Identity Federation)
// 받은 1시간짜리 토큰(GOOGLE_ACCESS_TOKEN)으로 시트·드라이브를 "읽기만" 한다.
//
// 사용: node scripts/sync-content.mjs [--dry-run] [--fixture <시트를 내려받은 JSON>]
//   --dry-run  검사 결과만 보여 주고 아무것도 바꾸지 않는다
//   --fixture  구글 대신 파일에서 시트 값을 읽는다(로컬 시험용, --dry-run과 함께)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { TABS, buildSync, storageKey } from "../lib/content/parse.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const FIXTURE = args.includes("--fixture") ? args[args.indexOf("--fixture") + 1] : null;
const TOKEN = process.env.GOOGLE_ACCESS_TOKEN;
const TRIGGER = process.env.SYNC_TRIGGER || "manual";
if (!FIXTURE && !TOKEN) throw new Error("GOOGLE_ACCESS_TOKEN이 없습니다(GitHub Actions의 구글 연결 단계 확인)");
if (FIXTURE && !DRY) throw new Error("--fixture는 --dry-run과 함께만 씁니다");

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

async function google(url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) throw new Error(`구글 ${r.status} ${url.split("?")[0]}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

/** 시트의 반영 대상 탭 값 */
async function readSheet(sheetId) {
  const names = Object.values(TABS);
  const q = names.map((t) => "ranges=" + encodeURIComponent(`'${t}'!A1:Z2000`)).join("&");
  const j = await (await google(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${q}`)).json();
  return Object.fromEntries(names.map((t, i) => [t, j.valueRanges?.[i]?.values ?? []]));
}

/** 자료 폴더(하위 폴더 포함)의 파일: 이름 → {id, md5, mimeType}. 이름이 겹치면 경고 */
async function listFiles(folderId, warnings) {
  const files = new Map();
  const queue = [folderId];
  while (queue.length) {
    const parent = queue.shift();
    let page = "";
    do {
      const q = encodeURIComponent(`'${parent}' in parents and trashed = false`);
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,md5Checksum)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${page ? `&pageToken=${page}` : ""}`;
      const j = await (await google(url)).json();
      for (const f of j.files ?? []) {
        if (f.mimeType === "application/vnd.google-apps.folder") queue.push(f.id);
        else if (!f.md5Checksum) continue; // 구글 문서·시트(콘텐츠 시트 자체 등)는 자료 파일이 아니다
        else if (files.has(f.name)) warnings.push(`자료 폴더에 "${f.name}" 이름이 두 개 있어요. 먼저 찾은 것을 씁니다`);
        else files.set(f.name, { id: f.id, md5: f.md5Checksum, mimeType: f.mimeType });
      }
      page = j.nextPageToken ?? "";
    } while (page);
  }
  return files;
}

async function download(fileId) {
  const r = await google(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`);
  return Buffer.from(await r.arrayBuffer());
}

const CONTENT_TYPE = { pdf: "application/pdf", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

async function syncCohort(src) {
  const cohort = src.cohorts;
  const label = `${cohort.course_title} ${cohort.cohort_no}기`;
  const fixture = FIXTURE ? JSON.parse(readFileSync(FIXTURE, "utf8")) : null;
  const runWarnings = [];
  const run = DRY ? null : must(await db.from("sync_runs").insert({ cohort_id: src.cohort_id, trigger: TRIGGER }).select("run_id").single());

  const weeks = must(await db.from("cohort_weeks").select("week_no, starts_at").eq("cohort_id", src.cohort_id));
  const tabs = fixture ? fixture.tabs : await readSheet(src.sheet_id);
  const files = fixture ? new Map(Object.entries(fixture.files ?? {})) : await listFiles(src.folder_id, runWarnings);
  const r = buildSync(tabs, { weeks, now: new Date(), files, cohortNo: cohort.cohort_no });

  const report = { cohort: label, globalErrors: r.globalErrors, warnings: [...runWarnings, ...r.fileWarnings], weeks: [], live: r.live.length, liveErrors: r.liveErrors };
  if (r.globalErrors.length === 0) {
    const state = new Map((must(await db.rpc("sync_asset_state", { p_cohort: src.cohort_id })) ?? []).map((s) => [`${s.week_no}:${s.type}`, s]));
    for (const w of r.weeks) {
      const uploaded = [];
      const assets = [];
      if (!w.skip) {
        for (const f of w.files) {
          const key = storageKey(cohort.cohort_no, w.week_no, f.type, f.file_name, f.source_md5);
          const cur = state.get(`${w.week_no}:${f.type}`);
          if (!cur || cur.source_md5 !== f.source_md5) {
            uploaded.push(f.file_name);
            if (!DRY) {
              const body = await download(f.source_file_id);
              const ext = key.split(".").pop();
              must(await db.storage.from("course").upload(key, body, { contentType: CONTENT_TYPE[ext] ?? f.mime ?? "application/octet-stream", upsert: true }));
            }
          }
          assets.push({ type: f.type, file_name: f.file_name, storage_key: key, source_file_id: f.source_file_id, source_md5: f.source_md5 });
        }
        if (!DRY) must(await db.rpc("sync_week", { p_cohort: src.cohort_id, p_week: w.week_no, p: { ...w.payload, assets } }));
      }
      report.weeks.push({ week: w.week_no, status: w.status, applied: !w.skip, uploaded, errors: w.errors, warnings: w.warnings });
    }
    if (!DRY && r.live.length) must(await db.rpc("sync_live", { p_cohort: src.cohort_id, p_sessions: r.live }));
  }

  const ok = r.globalErrors.length === 0 && report.weeks.every((w) => w.applied) && r.liveErrors.length === 0;
  if (run) must(await db.from("sync_runs").update({ finished_at: new Date().toISOString(), ok, summary: report }).eq("run_id", run.run_id));
  return { ok, report };
}

function print({ ok, report }) {
  console.log(`\n━━ ${report.cohort} ${DRY ? "(검사만)" : ""} ━━ ${ok ? "정상" : "확인 필요"}`);
  for (const e of report.globalErrors) console.log(`  ✕ ${e}`);
  for (const w of report.warnings) console.log(`  ! ${w}`);
  for (const w of report.weeks) {
    const status = { draft: "초안", reviewed: "검수완료", published: "공개" }[w.status];
    console.log(`  ${w.applied ? "✓" : "✕"} ${w.week}주차 [${status}] ${w.applied ? "반영" : "반영 안 함(이전 상태 유지)"}${w.uploaded.length ? ` · 파일 ${w.uploaded.join(", ")}` : ""}`);
    for (const e of w.errors) console.log(`      ✕ ${e}`);
    for (const x of w.warnings) console.log(`      ! ${x}`);
  }
  console.log(`  라이브 ${report.live}회 반영${report.liveErrors.length ? "" : ""}`);
  for (const e of report.liveErrors) console.log(`  ✕ ${e}`);
}

const sources = must(await db.from("content_sources").select("cohort_id, sheet_id, folder_id, cohorts(course_title, cohort_no)"));
let allOk = true;
for (const src of sources) {
  const res = await syncCohort(src);
  print(res);
  allOk &&= res.ok;
}
// 공개 주차를 반영하지 못했거나 시트 형식 오류가 있으면 실패로 끝낸다(GitHub가 알림 메일을 보낸다)
process.exit(allOk ? 0 : 1);
