# Agent Bank

請求書の確認、自動支払いルールの設定、余剰資金の運用を体験するローカルデモです。人間が条件を承認し、Agentがその条件内で操作を依頼し、銀行側が権限と金額を検証します。

Next.js・TypeScript・SQLite・Hardhat/Solidityを使用します。TDは非forkローカルAnvil上で扱い、1 TDを1円として表示します。メール・請求書は架空サンプルです。AIはstubとGemini、運用はstubとBase SepoliaのAave疑似USDCに対応しています。疑似USDCはCircle USDCとは異なるテスト用tokenです。

このアプリは固定のデモ口座・単一Nodeプロセス・localhost向けです。公開サービスや実資産の銀行として運用するための実装ではありません。

## ローカルデモを起動する

Node.js 24、pnpm（`package.json`指定版）、Anvil、Python 3、C/C++ビルドツールが必要です。AnvilはFoundryに含まれます。macOSではXcode Command Line Toolsを利用できます。

```sh
git clone git@github.com:takupeso/agent-bank.git
cd agent-bank
pnpm install --frozen-lockfile
pnpm setup:env stub
pnpm contracts:build
pnpm db:migrate
pnpm auth agent
```

`setup:env`は`.env.local`にランダムなカストディ暗号化鍵を生成します。既存ファイルは上書きしません。`auth agent`はAgent credentialを`.data/agent-credential`へ保存し、値を標準出力には表示しません。credentialの発行だけでメール閲覧や資金操作が許可されることはありません。

ターミナル1でAnvilを起動します。

```sh
anvil --host 127.0.0.1 --port 8545 --chain-id 31337 --state .data/anvil.json
```

ターミナル2でアプリを起動します。

```sh
pnpm dev
```

http://127.0.0.1:3000 を開き、ローカルデモでの継続を選んでログインし、「デモを初期化」を押します。`pnpm dev`と`pnpm start`はloopbackへバインドする専用起動スクリプトを使います。

1. AIチャットからサンプルメールの閲覧を依頼し、対象と権限を確認してデモ承認する。
2. 請求書の抽出結果と具体的な支払い条件を確認し、設定を承認する。
3. 「送金予定」から元メールや請求書PDFを確認する。
4. デモ操作で支払期日を迎え、自動支払いを確認する。
5. 余力の運用条件を承認し、運用・全額償還を試す。

デモ承認はWorld認証の成功や本人確認を意味しません。デモログイン・承認でpublic送信スイッチが有効になることはありません。

再起動時は`.env.local`、SQLite、Anvil stateを保持してください。暗号化鍵を失うと保存済みウォレットを復元できません。データを初期化し直す場合も、運用中の元本を先に償還してください。

## Base Sepoliaでの運用

外部テストネットを使う場合は、新しい環境で`pnpm setup:env base-sepolia`を実行します。stubとテストネットのDBは分けてください。共有ウォレットの鍵は同梱していません。

```sh
pnpm sepolia wallets
pnpm sepolia status
```

銀行・顧客のウォレットは各環境で生成して暗号化保存します。既存のテスト専用ウォレットを取り込む場合だけ、`.env.local`の`DEMO_BANK_PRIVATE_KEY`・`DEMO_CUSTOMER_PRIVATE_KEY`へ設定してください。メインネット用の鍵を使用しないでください。

表示された自分の銀行アドレスへBase Sepolia ETHを用意します。`status`で在庫・gas・Faucet制限を確認し、必要分だけ準備します。

```sh
# 事前シミュレーション
pnpm sepolia mint 10000
pnpm sepolia fund 0.002

# 内容を確認した場合だけ実送信
pnpm sepolia mint 10000 --send
pnpm sepolia fund 0.002 --send
```

アプリの実送信は`PUBLIC_TRANSACTIONS_ENABLED=true`を明示した場合のみ有効です。既定はfalseです。`ten-usdc`プロファイルは10 USDC、`standard`は2,500 USDCを上限に運用します。固定換算は1 USDC＝160円です。運用中はDB・Anvil state・鍵を一緒に保持し、全額償還後に実送信を無効にしてください。

## 認証・AI

- [World・本人認証・Agent credential](docs/world-setup.md)
- [Gemini接続](docs/ai-setup.md)
- [アーキテクチャ](docs/architecture.md)

`BANK_AUTH_MODE`省略時の既定は`world`です。ローカルデモではテンプレートの`BANK_AUTH_MODE=local-demo`を明示します。本人はHttpOnly Cookie、Agentは専用credentialを使います。認証モードの切替時は古い認証情報を再利用できません。

## 検証

```sh
pnpm test
pnpm contracts:test
pnpm build
pnpm typecheck
pnpm exec playwright install chromium
```

独立したstub環境を起動して、ブラウザテストを実行します。テストはデモ状態を変更するため、作業中のDBを使わないでください。

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm test:e2e
```

devとbuildは同時実行しないでください。ビルド済みのアプリは`pnpm start`で起動します。

## 請求書PDFの再生成

`fixtures/mail.json`のサンプルからPDFと照合用manifestを生成します。Playwright Chromiumと日本語フォントが必要です。

```sh
pnpm invoices:pdf
```

PDFの本文には架空の請求日・支払期日を記載し、ファイルの実作成・更新日時を含むメタデータは保存しません。

## 公開ファイルの扱い

`.env.local`、`.data/`、秘密鍵、APIキー、credential、実際のメール・請求書、内部資料や作業記録をGitへ追加しないでください。ソースにはAnvilの公開済み開発用鍵と、その既知の鍵をpublic側で拒否するための公開テストニーモニックがあります。いずれも個人の認証情報ではなく、実資産には使用しません。

## 設計・計画

[ロードマップ](docs/roadmap.md)からEpic・Story・Task・ADRを参照できます。[公開資料の調査](llm-wiki/wiki/index.md)は実装仕様とは分けて整理しています。
