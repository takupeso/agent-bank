import { chromium } from "@playwright/test";
import { PDFDocument, PDFName, PDFRef } from "pdf-lib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Mail } from "../src/shared/domain";

// Requires Playwright Chromium and a Japanese system font.
const mails: Mail[] = JSON.parse(await readFile("fixtures/mail.json", "utf8"));
const output = "public/invoices";
await mkdir(output, { recursive: true });
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const yen = (amount: bigint) => `¥${amount.toLocaleString("ja-JP")}`;
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL,
});
const manifest = [];
try {
  const page = await browser.newPage();
  for (const mail of mails) {
    const invoice = mail.attachment;
    if (!/^[A-Z0-9-]+$/.test(invoice.number))
      throw new Error("Invalid invoice number");
    const total = BigInt(invoice.amountJpy);
    const tax = (total * 10n) / 110n;
    const subtotal = total - tax;
    const office = invoice.recipientId === "sakura";
    const due = new Date(invoice.dueAt).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const date = new Date(invoice.dueAt).toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    });
    const issued = `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月1日`;
    const period = `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月分`;
    await page.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escape(invoice.number)}</title>
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #253449; font: 12px "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans CJK JP", sans-serif; }
        main { width: 210mm; height: 297mm; padding: 22mm 20mm; position: relative; }
        header { display: flex; justify-content: space-between; border-top: 5px solid ${office ? "#526b61" : "#345777"}; padding-top: 24px; }
        h1 { font-size: 30px; letter-spacing: 8px; font-weight: 500; margin: 0; }
        .meta { text-align: right; color: #596574; line-height: 1.9; font-size: 11px; }
        .parties { display: flex; justify-content: space-between; gap: 30px; margin: 42px 0 32px; }
        h2 { font-size: 17px; font-weight: 500; margin: 8px 0 14px; }
        p { margin: 6px 0; line-height: 1.8; }
        .muted { color: #6a7583; font-size: 10px; }
        .issuer { width: 245px; }
        .total { background: #f1f4f6; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; }
        .total strong { font-size: 30px; font-weight: 500; letter-spacing: 1px; }
        .due { margin: 16px 0 30px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f4f6; padding: 12px; text-align: left; font-weight: 500; font-size: 11px; }
        td { padding: 20px 12px; border-bottom: 1px solid #dce1e7; }
        .right { text-align: right; white-space: nowrap; }
        .sums { width: 270px; margin: 16px 0 36px auto; }
        .sums div { display: flex; justify-content: space-between; padding: 8px 0; }
        .sums .grand { border-top: 1px solid #83909f; margin-top: 5px; font-size: 15px; font-weight: 600; }
        .bank { border-top: 1px solid #dce1e7; padding-top: 18px; }
        h3 { font-size: 12px; font-weight: 600; margin: 0 0 12px; }
        footer { position: absolute; bottom: 19mm; left: 20mm; right: 20mm; border-top: 1px solid #dce1e7; padding-top: 12px; display: flex; justify-content: space-between; color: #7a8490; font-size: 9px; }
      </style></head><body><main>
      <header><h1>請求書</h1><div class="meta">請求番号 ${escape(invoice.number)}<br>発行日 ${issued}</div></header>
      <section class="parties"><div><p class="muted">請求先</p><h2>デモ口座ご利用者 様</h2><p>下記のとおりご請求申し上げます。</p></div>
      <div class="issuer"><h2>${escape(invoice.issuer)}</h2><p>${office ? "オフィスサービス事業部" : "デザイン制作事業部"}</p><p class="muted">お問い合わせ：${escape(mail.sender)}</p></div></section>
      <div class="total"><span>ご請求金額（税込）</span><strong>${yen(total)}</strong></div>
      <p class="due">お支払期日：${due}（日本時間）</p>
      <table><thead><tr><th>品目・内容</th><th class="right">数量</th><th class="right">税抜金額</th></tr></thead>
      <tbody><tr><td>${office ? "オフィス利用料" : "業務委託費（デザイン制作）"}<p class="muted">${period}</p></td><td class="right">1 式</td><td class="right">${yen(subtotal)}</td></tr></tbody></table>
      <section class="sums"><div><span>小計（税抜）</span><span>${yen(subtotal)}</span></div><div><span>消費税（10%・内税）</span><span>${yen(tax)}</span></div><div class="grand"><span>合計</span><span>${yen(total)}</span></div></section>
      <section class="bank"><h3>お振込先</h3><p>デモ銀行　本店営業部<br>普通預金　${office ? "0000002" : "0000001"}<br>口座名義　${office ? "サクラオフィス" : "アオバデザイン"}</p>
      <p class="muted">デモでは、上記取引先に対応する銀行内口座へTDで振り替えます。</p></section>
      <footer><span>デモ用サンプル ／ 記載の取引・口座情報は架空です。</span><span>1 / 1</span></footer>
      </main></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const filename = `${invoice.number}.pdf`;
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
    });
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    const infoRef = pdf.context.trailerInfo.Info;
    if (infoRef instanceof PDFRef) pdf.context.delete(infoRef);
    delete pdf.context.trailerInfo.Info;
    pdf.catalog.delete(PDFName.of("Metadata"));
    await writeFile(`${output}/${filename}`, await pdf.save());
    manifest.push({
      number: invoice.number,
      issuer: invoice.issuer,
      amountJpy: invoice.amountJpy,
      dueAt: invoice.dueAt,
      emailId: mail.id,
      url: `/invoices/${filename}`,
    });
  }
  await writeFile(
    `${output}/manifest.json`,
    JSON.stringify(manifest, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
