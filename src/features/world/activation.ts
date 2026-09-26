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
        ? "The bank has insufficient USDC inventory."
        : reason === "Public transaction execution is not enabled"
          ? "Public chain transactions are disabled."
          : reason === "Sepolia gas balance insufficient"
            ? "Insufficient gas balance on Base Sepolia."
            : "Check permissions, balances, and execution records.";
    const run = get<Run>("runs", requestId);
    message(
      "assistant",
      `Investment terms are saved, but investing could not start. ${detail}`,
      run ? "execution" : "text",
      run ? { run } : undefined,
    );
    return {
      ...approval,
      activation: { status: "failed", runId: run?.id, message: detail },
    };
  }
}
