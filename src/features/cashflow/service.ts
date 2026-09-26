import "server-only";
import { all, instance, get } from "../../server/records";
import { balance } from "../../integrations/td-ledger";
import type { Invoice, Payment, Rule } from "../../shared/domain";
import { calculate } from "./calculate";
export async function cashflow(override?: Rule) {
  const s = instance();
  const rule = override ?? get<Rule>("rules", "investment");
  return calculate(
    all<Invoice>("invoices"),
    all<Payment>("payment_history"),
    s.clock,
    await balance(s.token, s.customer),
    rule?.safetyBufferJpy ?? "100000",
    rule?.maxInvestmentJpy ?? "400000",
    rule?.minimumBalanceJpy ?? "0",
  );
}
