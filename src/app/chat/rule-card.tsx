import type { Proposal, Rule } from "@/shared/domain";
export function Conditions({ rule }: { rule: Proposal["conditions"] | Rule }) {
  return rule.id === "payment" && rule.paymentRecipients?.length ? (
    <div>
      {rule.paymentRecipients.map((recipient) => (
        <p key={recipient.recipientId}>
          {recipient.recipientId === "aoba"
            ? "アオバデザイン"
            : "サクラオフィス"}
          : 1件 ¥{BigInt(recipient.maxPaymentJpy).toLocaleString()} / 月合計 ¥
          {BigInt(recipient.monthlyLimitJpy).toLocaleString()} · 期日払い
        </p>
      ))}
    </div>
  ) : rule.id === "payment" ? (
    <p>
      アオバデザイン · 1件 ¥{BigInt(rule.maxPaymentJpy).toLocaleString()} /
      月合計 ¥{BigInt(rule.monthlyLimitJpy).toLocaleString()} · 期日払い
    </p>
  ) : (
    <p>
      1回の運用上限 ¥{BigInt(rule.maxInvestmentJpy).toLocaleString()} / 予備資金
      ¥{BigInt(rule.safetyBufferJpy).toLocaleString()}
    </p>
  );
}
export function ProposalCard({
  proposal,
  snapshot,
}: {
  proposal: Proposal;
  snapshot?: Record<string, string>;
}) {
  return (
    <div className="card">
      <b>
        {proposal.kind === "payment"
          ? "自動支払いの設定案"
          : "余力運用の設定案"}
      </b>
      {snapshot && (
        <p>
          現在の預金 ¥{BigInt(snapshot.td).toLocaleString()}
          <br />
          月末までの支払い ¥
          {(
            BigInt(snapshot.confirmedJpy) + BigInt(snapshot.predictedJpy)
          ).toLocaleString()}
          <br />
          確保額 ¥{BigInt(snapshot.reserveJpy).toLocaleString()} /
          今回の運用可能額 ¥{BigInt(snapshot.investJpy).toLocaleString()}
        </p>
      )}
      <Conditions rule={proposal.conditions} />
    </div>
  );
}
