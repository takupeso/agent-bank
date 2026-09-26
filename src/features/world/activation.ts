import "server-only";
import { internalAgentPrincipal } from "../../server/auth";
import { get } from "../../server/records";
import type { Rule, Run } from "../../shared/domain";
import { invest } from "../investment/service";
import { message } from "../chat/service";

export async function activateApprovedInvestment<T extends { rule?: Rule }>(
  approval: T,
) {
  const rule = approval.rule;
  if (rule?.id !== "investment" || !rule.enabled) return approval;
  const requestId = rule.consentId;
  try {
    const run = await invest(internalAgentPrincipal(), requestId, rule);
    return { ...approval, activation: { status: run.status, runId: run.id } };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const detail =
      reason === "Bank USDC inventory insufficient"
        ? "銀行側のUSDC在庫が不足しています。"
        : reason === "Public transaction execution is not enabled"
          ? "public chainへの実送信が無効です。"
          : reason === "Sepolia gas balance insufficient"
            ? "Base Sepoliaのガス代残高が不足しています。"
            : "権限・残高・実行記録を確認してください。";
    const run = get<Run>("runs", requestId);
    message(
      "assistant",
      `運用条件は設定済みですが、運用開始に失敗しました。${detail}`,
      run ? "execution" : "text",
      run ? { run } : undefined,
    );
    return {
      ...approval,
      activation: { status: "failed", runId: run?.id, message: detail },
    };
  }
}
