import { z } from "zod";
const money = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .max(16);
const paymentRecipient = z.object({
  recipientId: z.enum(["aoba", "sakura"]),
  maxPaymentJpy: money,
  monthlyLimitJpy: money,
});
export const conditions = z
  .object({
    id: z.enum(["payment", "investment"]),
    enabled: z.boolean(),
    recipientId: z.enum(["aoba", ""]),
    maxPaymentJpy: money,
    monthlyLimitJpy: money,
    paymentRecipients: z.array(paymentRecipient).optional(),
    safetyBufferJpy: money,
    maxInvestmentJpy: money,
    minimumBalanceJpy: money,
    payAt: z.literal("dueDate"),
  })
  .superRefine((value, context) => {
    const recipientIds =
      value.paymentRecipients?.map((recipient) => recipient.recipientId) ?? [];
    if (new Set(recipientIds).size !== recipientIds.length)
      context.addIssue({
        code: "custom",
        message: "Duplicate payment recipient",
      });
    if (value.id === "investment" && recipientIds.length)
      context.addIssue({
        code: "custom",
        message: "Investment rule cannot include payment recipients",
      });
  });
export const ruleChange = z.object({
  baseVersion: z.number().int().nonnegative(),
  conditions,
});
