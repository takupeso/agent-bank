import documents from "../../public/invoices/manifest.json";
import type { Invoice } from "./domain";

export function invoiceDocument(invoice: Invoice) {
  return documents.find(
    (document) =>
      document.number === invoice.number &&
      document.emailId === invoice.emailId &&
      document.issuer === invoice.issuer &&
      document.amountJpy === invoice.amountJpy &&
      document.dueAt === invoice.dueAt,
  );
}
