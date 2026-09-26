import "server-only";
import { instance, put, get } from "../../server/records";
import { sqlite, save } from "../../server/db";
export function supplyAndDeposit(operationId: string, units: string) {
  return sqlite.transaction(() => {
    const old = get<{ id: string }>("execution_steps", operationId);
    if (old) return old;
    const s = instance();
    const treasury = BigInt(s.treasuryUsdc as string);
    const amount = BigInt(units);
    if (amount <= 0n || treasury < amount)
      throw new Error("Stub inventory insufficient");
    s.treasuryUsdc = (treasury - amount).toString();
    s.positionUsdc = (BigInt(s.positionUsdc as string) + amount).toString();
    save(s);
    return put("execution_steps", {
      id: operationId,
      mode: "stub",
      units,
      owner: s.customer,
      action: "supply-and-deposit",
    });
  })();
}
export function withdrawAndReturn(operationId: string, units: string) {
  return sqlite.transaction(() => {
    const old = get<{
      id: string;
      units: string;
      owner: string;
      action: string;
    }>("execution_steps", operationId);
    if (old) return old;
    const s = instance();
    const amount = BigInt(units),
      position = BigInt(s.positionUsdc as string);
    if (amount <= 0n || position < amount)
      throw new Error("Stub position insufficient");
    s.positionUsdc = (position - amount).toString();
    s.treasuryUsdc = (BigInt(s.treasuryUsdc as string) + amount).toString();
    save(s);
    return put("execution_steps", {
      id: operationId,
      mode: "stub",
      units,
      owner: s.customer,
      action: "withdraw-and-return",
    });
  })();
}
