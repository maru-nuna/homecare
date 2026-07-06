// HomeCare - 우리집 살림 매니저
const { createClient } = supabase;
const db = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

const LEVELS = [
  { min: 0,    name: "Lv.1 살림초보" },
  { min: 100,  name: "Lv.2 살림인" },
  { min: 300,  name: "Lv.3 살림마스터" },
  { min: 700,  name: "Lv.4 살림장인" },
  { min: 1500, name: "Lv.5 살림신" }
];

const URGENT_DAYS = 3;
const SOON_DAYS = 7;

let state = {
  tasks: [],
  totalPoints: 0,
  currentTab: "cleaning",
  editingId: null
};

// ===== 유틸 =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function todayStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split("T")[0];
}

function daysUntilDue(task) {
  if (!task.last_done_at) return 0;
  const last = new Date(task.last_done_at);
  const due = new Date(last);
  due.setDate(due.getDate() + task.cycle_days);
  const today = new Date(todayStr());
  return Math.floor((due - today) / (1000 * 60 * 60 * 24));
}

function ddayLabel(days) {
  if (days < 0) return { text: `⚠️ ${Math.abs(days)}일 지남`, cls: "overdue" };
  if (days === 0) return { text: "⚠️ 오늘 마감", cls: "urgent" };
  if (days <= URGENT_DAYS) return { text: `⚠️ D-${days}`, cls: "urgent" };
  if (days <= SOON_DAYS) return { text: `D-${days}`, cls: "soon" };
  return { text: `D-${days}`, cls: "normal" };
}

function getLevel(points) {
  let current = LEVELS[0];
  let next = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].min) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }
  return { current, next };
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 2000);
}

// ===== 데이터 로드 =====
async function loadAll() {
  try {
    const [tasksRes, historyRes] = await Promise.all([
      db.from("homecare_tasks").select("*").order("created_at", { ascending: true }),
      db.from("homecare_history").select("points_earned")
    ]);

    if (tasksRes.error) throw tasksRes.error;
    if (historyRes.error) throw historyRes.error;

    state.tasks = tasksRes.data || [];
    state.totalPoints = (historyRes.data || []).reduce((sum, h) => sum + (h.points_earned || 0), 0);

    renderLevel();
    renderList();
  } catch (e) {
    console.error("로드 실패", e);
    toast("데이터를 불러오지 못했어요. 테이블이 만들어졌는지 확인해주세요.");
  }
}

// ===== 렌더링 =====
function renderLevel() {
  const { current, next } = getLevel(state.totalPoints);
  $("#level-badge").textContent = current.name;
  $("#level-points").textContent = `${state.totalPoints} P`;

  if (next) {
    const progress = ((state.totalPoints - current.min) / (next.min - current.min)) * 100;
    $("#level-bar-fill").style.width = `${Math.min(100, progress)}%`;
    $("#level-next").textContent = `다음 레벨까지 ${next.min - state.totalPoints}P`;
  } else {
    $("#level-bar-fill").style.width = "100%";
    $("#level-next").textContent = "최고 레벨 달성! 🎉";
  }
}

function isOneShotDone(t) {
  return t.is_recurring === false && !!t.last_done_at;
}

function renderList() {
  const list = $("#task-list");
  const tabTasks = state.tasks.filter((t) => t.category === state.currentTab);

  if (tabTasks.length === 0) {
    list.innerHTML = "";
    $("#empty-msg").hidden = false;
    return;
  }

  $("#empty-msg").hidden = true;

  // 정렬: 완료된 일회성은 항상 하단. 나머지는 임박순 (D-day 오름차순)
  tabTasks.sort((a, b) => {
    const aDone = isOneShotDone(a);
    const bDone = isOneShotDone(b);
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;
    return daysUntilDue(a) - daysUntilDue(b);
  });

  list.innerHTML = tabTasks
    .map((t) => {
      const days = daysUntilDue(t);
      const d = ddayLabel(days);
      const completed = isOneShotDone(t);
      const stateClass = completed ? "completed" : d.cls;
      const last = t.last_done_at
        ? `${t.last_done_at.slice(5).replace("-", ".")} 완료`
        : "아직 한 번도";
      const memoToggle = t.memo
        ? `<button class="memo-toggle" data-action="memo" data-id="${t.id}" aria-label="메모 보기">메모</button>`
        : "";
      const memo = t.memo
        ? `<div class="task-memo" data-memo-for="${t.id}" hidden>${escapeHtml(t.memo)}</div>`
        : "";
      const doyoungBadge = t.for_doyoung ? '<span class="doyoung-badge">👶 For 도영이</span>' : "";
      const ddayHtml = completed
        ? `<span class="dday completed">✓ 완료됨</span>`
        : `<span class="dday ${d.cls}">${d.text}</span>`;
      const btnAttrs = completed ? "disabled" : "";
      const btnLabel = completed ? "완료됨" : "완료";
      return `
        <div class="task-card ${stateClass}" data-id="${t.id}">
          <div class="task-info">
            <div class="task-name">${escapeHtml(t.name)}</div>
            <div class="task-meta">
              ${ddayHtml}
              <span class="dot">·</span>
              <span>${t.cycle_days}일 주기</span>
              <span class="dot">·</span>
              <span>${last}</span>
              <span class="pt">+${t.points}P</span>
              ${doyoungBadge}
              ${memoToggle}
            </div>
            ${memo}
          </div>
          <button class="task-done-btn" data-action="done" data-id="${t.id}" ${btnAttrs}>${btnLabel}</button>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-action='done']")) return;
      openEditModal(card.dataset.id);
    });
  });

  list.querySelectorAll("[data-action='done']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      markDone(btn.dataset.id);
    });
  });

  list.querySelectorAll("[data-action='memo']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const memoEl = list.querySelector(`[data-memo-for="${id}"]`);
      if (memoEl) {
        memoEl.hidden = !memoEl.hidden;
        btn.classList.toggle("open", !memoEl.hidden);
      }
    });
  });
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ===== 동작 =====
async function markDone(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  // 일회성이고 이미 완료된 항목은 더 이상 처리하지 않음 (안전망)
  if (isOneShotDone(task)) return;

  try {
    const today = todayStr();
    const { error: hError } = await db.from("homecare_history").insert({
      task_id: taskId,
      done_at: today,
      points_earned: task.points
    });
    if (hError) throw hError;

    const { error: tError } = await db
      .from("homecare_tasks")
      .update({ last_done_at: today })
      .eq("id", taskId);
    if (tError) throw tError;

    state.totalPoints += task.points;
    task.last_done_at = today;

    const prevLevel = getLevel(state.totalPoints - task.points).current.name;
    const newLevel = getLevel(state.totalPoints).current.name;
    if (prevLevel !== newLevel) {
      toast(`🎉 레벨업! ${newLevel}`);
    } else {
      toast(`+${task.points}P 획득!`);
    }

    renderLevel();
    renderList();
  } catch (e) {
    console.error("완료 처리 실패", e);
    toast("저장에 실패했어요.");
  }
}

function openAddModal() {
  state.editingId = null;
  $("#modal-title").textContent = "새 항목 추가";
  $("#f-category").value = state.currentTab;
  $("#f-name").value = "";
  $("#f-cycle").value = "";
  $("#f-points").value = "10";
  $("#f-last").value = "";
  $("#f-memo").value = "";
  $("#f-for-doyoung").checked = false;
  $("#f-recurring").checked = true; // 기본 반복
  $("#btn-delete").hidden = true;
  $("#task-modal").hidden = false;
  setTimeout(() => $("#f-name").focus(), 100);
}

function openEditModal(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  state.editingId = id;
  $("#modal-title").textContent = "항목 수정";
  $("#f-category").value = t.category;
  $("#f-name").value = t.name;
  $("#f-cycle").value = t.cycle_days || "";
  $("#f-points").value = t.points || 10;
  $("#f-last").value = t.last_done_at || "";
  $("#f-memo").value = t.memo || "";
  $("#f-for-doyoung").checked = !!t.for_doyoung;
  $("#f-recurring").checked = t.is_recurring !== false; // undefined/null도 기본 true
  $("#btn-delete").hidden = false;
  $("#task-modal").hidden = false;
}

function closeModal() {
  $("#task-modal").hidden = true;
}

async function saveTask(e) {
  e.preventDefault();
  const lastInput = $("#f-last").value;
  const existing = state.editingId ? state.tasks.find((t) => t.id === state.editingId) : null;

  const data = {
    category: $("#f-category").value,
    name: $("#f-name").value.trim(),
    cycle_days: parseInt($("#f-cycle").value, 10),
    points: parseInt($("#f-points").value, 10),
    // 수정 모드: 사용자가 비우면 기존값 유지 (포인트/완료 이력 보호)
    // 추가 모드: 사용자가 비우면 null ("아직 한 번도" 상태로 시작)
    last_done_at: lastInput || (existing ? existing.last_done_at : null),
    memo: $("#f-memo").value.trim() || null,
    for_doyoung: $("#f-for-doyoung").checked,
    is_recurring: $("#f-recurring").checked
  };

  if (!data.name || !data.cycle_days || !data.points || isNaN(data.cycle_days) || isNaN(data.points)) {
    toast("필수 항목을 올바르게 입력해주세요.");
    return;
  }

  try {
    if (state.editingId) {
      const { error } = await db.from("homecare_tasks").update(data).eq("id", state.editingId);
      if (error) throw error;
      toast("수정 완료");
    } else {
      const { error } = await db.from("homecare_tasks").insert(data);
      if (error) throw error;
      toast("추가 완료");
    }
    closeModal();
    await loadAll();
    // 추가한 카테고리 탭으로 자동 이동
    if (data.category !== state.currentTab) {
      switchTab(data.category);
    }
  } catch (e) {
    console.error("저장 실패", e);
    toast("저장에 실패했어요.");
  }
}

async function deleteTask() {
  if (!state.editingId) return;
  if (!confirm("이 항목을 삭제할까요?\n(누적 포인트는 유지됩니다)")) return;

  try {
    const { error } = await db.from("homecare_tasks").delete().eq("id", state.editingId);
    if (error) throw error;
    toast("삭제 완료");
    closeModal();
    await loadAll();
  } catch (e) {
    console.error("삭제 실패", e);
    toast("삭제에 실패했어요.");
  }
}

function switchTab(tab) {
  state.currentTab = tab;
  $$(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  renderList();
}

// ===== 푸시 알림 =====
async function getPushStatus() {
  if (!("Notification" in window)) return "unsupported";
  if (!("serviceWorker" in navigator)) return "unsupported";
  if (!("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "off";
    const sub = await reg.pushManager.getSubscription();
    return sub ? "on" : "off";
  }
  return "off";
}

async function refreshNotifModal() {
  const status = await getPushStatus();
  const statusEl = $("#notif-status");
  const btn = $("#btn-notif-toggle");
  statusEl.className = "notif-status";

  if (status === "unsupported") {
    statusEl.textContent = "❌ 이 기기에서는 푸시 알림을 지원하지 않아요.";
    statusEl.classList.add("denied");
    btn.hidden = true;
  } else if (status === "denied") {
    statusEl.textContent = "❌ 알림이 차단되어 있어요. 브라우저 설정에서 허용해주세요.";
    statusEl.classList.add("denied");
    btn.hidden = true;
  } else if (status === "on") {
    statusEl.textContent = "✅ 알림이 켜져 있어요.";
    statusEl.classList.add("on");
    btn.textContent = "알림 끄기";
    btn.hidden = false;
  } else {
    statusEl.textContent = "⏸ 알림이 꺼져 있어요.";
    statusEl.classList.add("off");
    btn.textContent = "알림 켜기";
    btn.hidden = false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function togglePush() {
  const status = await getPushStatus();
  const reg = await navigator.serviceWorker.getRegistration();

  if (status === "on") {
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await db.from("homecare_push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    toast("알림을 껐어요");
  } else {
    if (!window.VAPID_PUBLIC_KEY) {
      toast("VAPID 키 설정이 필요해요 (배포 후 안내)");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      toast("알림 권한이 필요해요");
      await refreshNotifModal();
      return;
    }
    try {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY)
      });
      await db.from("homecare_push_subscriptions").upsert(
        { endpoint: sub.endpoint, subscription: sub.toJSON() },
        { onConflict: "endpoint" }
      );
      toast("✅ 알림이 켜졌어요");
    } catch (e) {
      console.error("푸시 구독 실패", e);
      toast("푸시 구독에 실패했어요");
    }
  }
  await refreshNotifModal();
}

// ===== 툴팁 =====
function bindTooltips() {
  document.querySelectorAll(".tooltip-trigger").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const content = btn.nextElementSibling;
      const isOpen = !content.hidden;
      // 다른 툴팁 모두 닫기
      document.querySelectorAll(".tooltip-content").forEach((c) => (c.hidden = true));
      document.querySelectorAll(".tooltip-trigger").forEach((t) => t.classList.remove("open"));
      // 토글
      if (!isOpen) {
        content.hidden = false;
        btn.classList.add("open");
      }
    });
  });
  // 바깥 클릭 시 닫기
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".tooltip-wrap")) {
      document.querySelectorAll(".tooltip-content").forEach((c) => (c.hidden = true));
      document.querySelectorAll(".tooltip-trigger").forEach((t) => t.classList.remove("open"));
    }
  });
}

// ===== 이벤트 바인딩 =====
function bindEvents() {
  $$(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  $("#add-btn").addEventListener("click", openAddModal);
  $("#btn-cancel").addEventListener("click", closeModal);
  $("#btn-delete").addEventListener("click", deleteTask);
  $("#task-form").addEventListener("submit", saveTask);

  $("#task-modal").addEventListener("click", (e) => {
    if (e.target.id === "task-modal") closeModal();
  });

  $("#notif-btn").addEventListener("click", async () => {
    $("#notif-modal").hidden = false;
    await refreshNotifModal();
  });
  $("#btn-notif-close").addEventListener("click", () => {
    $("#notif-modal").hidden = true;
  });
  $("#btn-notif-toggle").addEventListener("click", togglePush);
  $("#notif-modal").addEventListener("click", (e) => {
    if (e.target.id === "notif-modal") $("#notif-modal").hidden = true;
  });
}

// ===== Service Worker 등록 =====
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((e) => {
      console.warn("Service Worker 등록 실패", e);
    });
  });
}

// ===== 시작 =====
bindEvents();
bindTooltips();
loadAll();
