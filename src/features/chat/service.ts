import "server-only";
import {
  redeem,
  redemptionRequest,
  createRedemptionRequest,
} from "../investment/redemption";
import { proposeInvestment } from "../investment/service";
import { classifyRequest } from "../../integrations/ai";
import { randomUUID } from "node:crypto";
import { all, put, get } from "../../server/records";
import { readAuthorized } from "../invoices/service";
import { proposePayment } from "../rules/service";
import {
  requirePrincipal,
  internalAgentPrincipal,
  AuthorizationError,
  type Principal,
} from "../../server/auth";
import {
  allowedMailIds,
  createDelegationProposal,
} from "../delegations/service";
import type { Mail, Message, Proposal } from "../../shared/domain";
export const message = (
  role: "assistant",
  text: string,
  kind?: string,
  data?: Record<string, unknown>,
) => put("messages", { id: randomUUID(), role, text, kind, data });
export async function chat(
  principal: Principal,
  text: string,
  proposalId?: string,
) {
  requirePrincipal(principal, "human");
  put("messages", {
    id: randomUUID(),
    role: "user",
    text,
    accountId: principal.accountId,
    credentialId: principal.credentialId,
  });
  const request = [
    "サンプルメールの閲覧を許可して確認して",
    redemptionRequest,
    "余力を運用したい",
    "そうしてください",
    "はい",
    "OK",
  ].includes(text)
    ? "other"
    : await classifyRequest(text);
  requirePrincipal(principal, "human");
  if (
    text === "サンプルメールの閲覧を許可して確認して" ||
    request === "read_mail"
  ) {
    const agent = internalAgentPrincipal();
    let ids: string[] = [];
    try {
      ids = allowedMailIds(agent);
    } catch (error) {
      if (!(error instanceof AuthorizationError && error.status === 403))
        throw error;
    }
    if (!ids.length) {
      const proposal = createDelegationProposal(principal, [
        "aoba-mail",
        "sakura-mail",
      ]);
      message(
        "assistant",
        "サンプルメールの閲覧を許可しますか？",
        "approval-request",
        { input: { purpose: "delegation", proposalId: proposal.id } },
      );
    } else {
      const invoices = await readAuthorized(agent);
      requirePrincipal(principal, "human");
      message(
        "assistant",
        "許可されたメールから請求書を確認しました。",
        "invoices",
        {
          invoices,
          emails: all<Mail>("emails").filter((mail) => ids.includes(mail.id)),
        },
      );
      const proposal = proposePayment(agent);
      message(
        "assistant",
        "アオバデザイン（1件20万円・月合計20万円）とサクラオフィス（1件10万円・月合計10万円）への支払いを、期日に自動化しますか？",
        "proposal",
        { proposal },
      );
    }
  } else if (text === redemptionRequest) {
    const request = createRedemptionRequest(principal);
    await redeem(internalAgentPrincipal(), request.id);
  } else if (text === "余力を運用したい" || request === "propose_investment") {
    const { proposal, snapshot } = await proposeInvestment(
      internalAgentPrincipal(),
    );
    requirePrincipal(principal, "human");
    message(
      "assistant",
      `必要資金と予備資金を残し、1回¥${BigInt(proposal.conditions.maxInvestmentJpy).toLocaleString("ja-JP")}を上限に運用しますか？`,
      "proposal",
      { proposal, snapshot },
    );
  } else if (["そうしてください", "はい", "OK"].includes(text) && proposalId) {
    const proposal = get<Proposal>("proposals", proposalId);
    if (!proposal || proposal.status !== "proposed")
      throw new Error("Pending proposal required");
    message(
      "assistant",
      "具体的な条件を確認して承認してください。",
      "approval-request",
      { input: { purpose: "proposal", proposalId } },
    );
  } else
    message(
      "assistant",
      "サンプルメールの閲覧を許可すると、請求書の内容を確認できます。",
    );
  requirePrincipal(principal, "human");
  return all<Message>("messages");
}
