# World・本人認証・Agent credential

## ローカルデモ

`.env.local`に`BANK_AUTH_MODE=local-demo`、`WORLD_MODE=disabled`を設定し、`pnpm dev`または`pnpm start`で起動します。画面でデモ継続を明示的に選びます。本人のログインと、メール閲覧・支払い条件などの操作単位の承認は別です。

```sh
pnpm auth agent
```

Agent credentialは`.data/agent-credential`に0600の権限で保存します。本人セッションは30分、Agent credentialは24時間です。更新は新しいファイルへ発行し、`BANK_AGENT_CREDENTIAL_FILE`を変更して再起動します。

```sh
pnpm auth agent .data/agent-credential-next
pnpm auth revoke <credential-id>
```

認証CLIはアプリと同じ`DEMO_DB`・`BANK_AUTH_MODE`で実行してください。credentialを発行するだけでは業務権限は与えません。

## Worldモード

Developer Portalで自身のApp・RPを設定し、Orb認証済みのWorld IDを用意します。RP署名鍵は`.env.local`だけに保存してください。

```dotenv
BANK_AUTH_MODE=world
WORLD_MODE=live
WORLD_APP_ID=app_your_app
WORLD_RP_ID=rp_your_rp
WORLD_RP_SIGNING_KEY=
WORLD_ENVIRONMENT=production
WORLD_FLOW=request
PUBLIC_ASSET_MODE=stub
PUBLIC_TRANSACTIONS_ENABLED=false
```

`WORLD_RP_SIGNING_KEY`へ自分のRP署名鍵を設定します。アプリを停止したうえで、同じモードの認証情報を準備します。

```sh
pnpm auth agent .data/world-agent-credential
pnpm auth enroll
```

`BANK_AGENT_CREDENTIAL_FILE=.data/world-agent-credential`を設定して起動します。初回登録では5分間有効な`.data/enrollment-ticket`の値を本人が登録画面へ入力し、Worldで確認します。登録済みの場合はWorldログインします。モード切替前のセッションやAgent credentialは再利用できません。

本実装は`IDKit.request`のOrb proof（`proof_of_human`）と固定action `agent-bank-account`を使います。nonce・signal・action・environment・登録したnullifierとの対応を銀行側で確認し、Developer Portalで証明を検証します。session方式やSelfie Checkへの切替は提供していません。

口座への登録、ログイン、Agentへの委任、ルール設定・変更をそれぞれ必要な条件で確認します。worldモードではデモ継続へ自動的に切り替わりません。停止・取消は本人が実行でき、権限拡大や再有効化には新しい承認が必要です。

`pnpm world:status`は設定や登録の状態を確認するコマンドです。DBには本人識別子・承認内容を保存するため、DB、proof、cookie、ticket、credentialをGitや会話へ貼り付けないでください。World連携は銀行KYCの代替ではありません。

## 検証結果

単体/API 26件、World承認からAnvil Gatewayへの統合1件、Hardhat 1件、Playwright 5件、build/typecheckが成功。初期session計画のWorld実機検証は未実施。後続のOrb実機検証はWorld振り返りを参照。
