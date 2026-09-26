"use client";
export async function apiFetch(input: string, init?: RequestInit) {
  const response = await fetch(input, { ...init, cache: "no-store" });
  if (response.status === 401)
    window.dispatchEvent(new Event("agent-bank:session-expired"));
  return response;
}
export async function apiPost(path: string, body: object) {
  const response = await apiFetch(path, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? "条件が変更されたか、確認の期限が切れています。新しい確認を始めてください。"
        : "操作を完了できませんでした。設定と現在の状態を確認してください。",
    );
  return response.json();
}
