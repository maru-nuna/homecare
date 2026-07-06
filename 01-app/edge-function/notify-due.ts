// Supabase Edge Function: 매일 임박 항목 푸시 발송
// 배포: supabase functions deploy notify-due
// 실행: 매일 1회 (Supabase Dashboard → Edge Functions → Cron 또는 외부 cron)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const URGENT_DAYS = 3;

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:shindaecheon89@gmail.com";

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  // 1) 임박 항목 조회
  const { data: tasks, error: taskErr } = await supabase
    .from("homecare_tasks")
    .select("*");
  if (taskErr) return new Response(JSON.stringify({ error: taskErr.message }), { status: 500 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const urgent = (tasks || []).filter((t: any) => {
    if (!t.last_done_at) return false;
    const due = new Date(t.last_done_at);
    due.setDate(due.getDate() + t.cycle_days);
    const days = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days <= URGENT_DAYS;
  });

  if (urgent.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "임박 항목 없음" }));
  }

  // 2) 메시지 구성
  const title = `홈 프로텍터 - 확인할 항목 ${urgent.length}개`;
  const body = urgent
    .slice(0, 5)
    .map((t: any) => {
      const due = new Date(t.last_done_at);
      due.setDate(due.getDate() + t.cycle_days);
      const days = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const dday = days < 0 ? `${Math.abs(days)}일 지남` : days === 0 ? "오늘" : `D-${days}`;
      return `• ${t.name} (${dday})`;
    })
    .join("\n");

  const payload = JSON.stringify({ title, body });

  // 3) 모든 구독자에게 발송
  const { data: subs } = await supabase.from("homecare_push_subscriptions").select("*");
  let sent = 0;
  let removed = 0;

  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      sent++;
    } catch (err: any) {
      // 만료된 구독은 삭제
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from("homecare_push_subscriptions").delete().eq("id", sub.id);
        removed++;
      } else {
        console.error("push fail", err);
      }
    }
  }

  return new Response(
    JSON.stringify({ sent, removed, urgent_count: urgent.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
