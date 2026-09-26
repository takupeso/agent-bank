"use client";
import { apiFetch } from "../api-client";
import { useEffect, useRef, useState } from "react";
import type { Invoice, Mail } from "@/shared/domain";
import { invoiceDocument } from "@/shared/invoice-document";
export default function Invoices() {
  const [selected, setSelected] = useState<Invoice | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const document = selected ? invoiceDocument(selected) : undefined;
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  const [data, setData] = useState<{ invoices: Invoice[]; emails: Mail[] }>({
    invoices: [],
    emails: [],
  });
  useEffect(() => {
    async function load() {
      const r = await apiFetch("/api/invoices");
      if (r.ok) setData(await r.json());
    }
    const refresh = () => void load();
    void load();
    window.addEventListener("agent-bank:invoices-updated", refresh);
    return () =>
      window.removeEventListener("agent-bank:invoices-updated", refresh);
  }, []);
  return (
    <>
      <header>
        <h1>送金予定</h1>
        <p>支払い設定済みの請求書と、その送金状況・根拠。</p>
      </header>
      {data.invoices.map((i) => (
        <section className="panel" id={i.id} key={i.id}>
          <span className="badge">
            {i.status === "paid" ? "支払済み" : "支払い予定"}
          </span>
          <h2>{i.issuer}</h2>
          <strong>¥{BigInt(i.amountJpy).toLocaleString()}</strong>
          <p>
            期日：
            {new Date(i.dueAt).toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
            })}
          </p>
          <details>
            <summary>元メールを表示</summary>
            <p>{data.emails.find((m) => m.id === i.emailId)?.body}</p>
          </details>
          <div className="invoice-attachment">
            <div>
              <strong>添付請求書</strong>
              <p>{i.number}</p>
            </div>
            {invoiceDocument(i) ? (
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`${i.issuer}の請求書を見る`}
              >
                請求書を見る
              </button>
            ) : (
              <p>この請求書のPDFは準備されていません。</p>
            )}
          </div>
        </section>
      ))}
      {!data.invoices.length && (
        <section className="panel">
          支払い条件に同意すると、対象の請求書がここに表示されます。
        </section>
      )}
      <dialog
        ref={dialog}
        className="invoice-dialog"
        aria-labelledby="invoice-preview-title"
        onClose={() => setSelected(null)}
      >
        {selected && document && (
          <>
            <div className="invoice-preview-header">
              <div>
                <h2 id="invoice-preview-title">{selected.issuer}の請求書</h2>
                <p>{selected.number} · デモ用サンプル</p>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => setSelected(null)}
              >
                閉じる
              </button>
            </div>
            <div className="invoice-preview-actions">
              <a href={document.url} target="_blank" rel="noopener noreferrer">
                別タブで開く
              </a>
              <a href={document.url} download={`${selected.number}.pdf`}>
                ダウンロード
              </a>
              <span>表示されない場合は別タブで開いてください。</span>
            </div>
            <iframe
              title={`${selected.issuer}の請求書PDF`}
              src={`${document.url}#view=FitH`}
            />
          </>
        )}
      </dialog>
    </>
  );
}
