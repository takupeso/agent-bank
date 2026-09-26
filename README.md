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

1. AIチャットからサンプルメールの閲覧を依頼し、対象と範囲を画面で確認して許可する。メール閲覧にWorld確認は使わない。
2. 請求書の抽出結果、支払い条件、余力の運用条件を確認し、初期設定を一度に承認する。WorldモードではWorld確認を1回行う。
3. 「送金予定」から元メールや請求書PDFを確認する。
4. デモ操作で支払期日を迎え、自動支払いを確認する。
5. 承認後に始まる余力の運用と全額償還を試す。

デモ承認はWorldでの人間であることの確認や、銀行の本人確認を意味しません。デモログイン・承認でpublic送信スイッチが有効になることはありません。

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

## 公開デモ（Cloudflare Containers）

ETHGlobal等で誰でも触れるデモとして、Cloudflare Containersへデプロイできます。訪問者ごとに使い捨てのコンテナ（アプリ＋ローカルAnvil＋SQLite、資産はstub）を割り当て、他の訪問者と状態を共有しません。コンテナは10分操作がないと停止し、状態は破棄されます。

```sh
pnpm exec wrangler login
pnpm cf:deploy
```

Docker（Rancher Desktop等）とWorkers Paidプランが必要です。`/new-sandbox`を開くと新しいサンドボックスに切り替わります。

- コンテナ内でアプリはloopbackにバインドしたままです。`deploy/cloudflare/proxy.mjs`が同一オリジンのリクエストだけをloopbackとして中継します。架空資産のみを扱う隔離サンドボックスであることが前提です。
- 設定は`wrangler.jsonc`の`vars`、キーはWorker secretで渡します。secretは`pnpm exec wrangler secret put GEMINI_API_KEY`（`WORLD_RP_SIGNING_KEY`も同様）で登録します。値の入力が必要なため、対話できるターミナルで実行してください（入力できない環境では空の値が登録されます）。`AI_MODE=gemini`か`WORLD_MODE=live`のときだけコンテナの外部通信を有効にします。
- 既定は`BANK_AUTH_MODE=local-demo`（デモログイン）です。`world`にすると、サンドボックスでは最初のWorldログインで口座にsession IDを紐づけます（`WORLD_ENROLL_WITHOUT_TICKET=true`、イメージで有効）。localhostでも同じ設定を使えます。後のログイン・承認では登録したsession IDを照合します。
- 公開デモでは誰でもGeminiを呼べるため、AI Studio側で利用上限を設定してください。資産はstub固定で、Base Sepoliaは使いません。
- 同時に起動するサンドボックスは最大10台です（`max_instances`）。`standard-1`で全台が起動し続けた場合、Workers Paidの込み分を超えると約$0.36/時です。

## 認証・AI

- [World（人間であることの確認）・Agent credential](docs/world-setup.md)
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
