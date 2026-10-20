# Anime Record

見たアニメの評価・感想・視聴状況・ジャンルを、ログインなしで自分のブラウザに記録するNext.jsアプリです。

## Current Personal App

- `/` または `/library` で起動。ユーザー登録・パスワード・フレンド機能は使用しません。
- 評価は **SS / S / A / B / C / D / E** の7段階。数値スコアは使用しません。
- タイトル・見た年月（必須）・任意の感想を入力し、「ティア表で評価」へ進みます。
  新規作品はティアへ配置して初めて保存されます。段内は左ほど上位で、順序も保存します。
- マウス・タッチ・キーボードのドラッグ操作に対応。小さなカードの左上に見た年月、その下にタイトルを表示します。
  カードをタップして開く配置画面でも、評価・挿入位置・左右移動を指定できます。
  年・年月フィルターで「2025年のティア表」などを表示し、一覧では年月順にも並べられます。
  古いバックアップに年月がなければ「年月未登録」とし、推測した年月は付けません。
- 検索、複数ジャンルのAND/OR絞り込み、並べ替え、登録・編集・削除に対応。
  検索は全角・半角を揃えた複数語のAND検索。一覧は24件ずつ追加表示します。
- 評価基準はSS〜Eごとに自分用の説明を保存できます。基準は記録と別の保存領域です。
- 一覧の「再視聴」で過去の年月・評価・感想を残したまま、最新の視聴を追加できます。
  新規・再視聴ともティアに配置して初めて保存。キャンセルしても元の作品は変更しません。
  再視聴の年月は前回以降を指定します。過去の履歴を個別に訂正する画面は未対応です。
  同名タイトルの登録時は重複を知らせ、再視聴か別作品としての登録を選べます。
- 「振り返り」には年・月別の作品数、再視聴を含む視聴回数、ベスト作品、評価分布、
  ジャンルごとのSS・S作品数、月別の視聴記録を表示します。
  各作品は期間内の最終評価で集計。同評価の順序は現在のティア内の左右順です。
  過去の視聴を含む期間のティア配置は閲覧専用とし、最新の評価は上書きしません。
- 選択中のティア表はPNG画像で保存できます。データの書き出し・復元ではありません。
  ティアのカードから記録の詳細、編集、再視聴へ進め、評価待ちの入力内容も修正できます。
- 保存状態を表示し、編集中の破棄を確認します。直前の削除は次の変更・再読み込みまで
  元に戻せます。別タブで変更があれば取り消しでも上書きしません。
- 記録はアクセスしたURLのブラウザ保存領域にのみ保存され、サーバーへ送信しません。
  PCとスマホ、ブラウザ、ホスト名やポートが異なれば保存領域も異なります。
- 手動の書き出し・読み込みは不要です。保存済みの記録は再読み込み・通常終了後も残ります。
  ユーザー要望によりファイル書き出し・読み込みUIは削除しました。ブラウザデータ削除で
  記録も消え、別端末・別ブラウザ・別URLへの引き継ぎや自動同期はできません。
- タイトル候補検索だけは入力中のタイトルを候補API経由でAniListへ送信します。
  感想や保存済み一覧は送信しません。取得失敗時も手入力できます。
- 初回利用とタイトル候補の検索にはネット接続が必要です。HTTPS（またはlocalhost）で
  一度画面と静的ファイルが保存された後は、オフラインでも記録の閲覧・編集ができます。
  API・旧ユーザー画面・個人の記録内容はService Workerにキャッシュしません。
  キャッシュやブラウザデータの削除後は再び接続が必要です。端末間の同期はありません。
- 既存の保存形式v1は読み込み時に変更せず、次の保存から履歴対応v2にします。
  古い画面はv2を読めないため編集を停止し、再視聴履歴の欠落を防ぎます。
- 旧Neonのユーザー・パスワード・アニメ記録は削除も自動移行もしません。
  旧URL `/anime/...` `/users/...` は個人用一覧へ案内します。旧実装は参照・移行検討用に保管しています。

```powershell
npm.cmd install
npm.cmd run dev -- --hostname 127.0.0.1 --port 3032
```

検証は `npm.cmd run verify`。個人用画面とそのビルドにDB URL設定は不要です。
旧実装のDBクライアントは実際に利用された時だけ初期化します。
verifyはテスト用URLをダミーに強制置換し、ビルド時はDB URLを空にして回帰を検出します。
本番DBのmigrationは実行しないでください。

## Legacy Server Setup (Reference Only)

```bash
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run build
npm.cmd run start:lan -- --port 3020
```

同じWi-Fi上のAndroidから使う場合は、PCのIPアドレスを使ってアクセスします。

```text
http://<PCのIPアドレス>:3020
```

メール・パスワード認証の本番モードはHTTPSが必要です。HTTPのLANアクセスでは
Secure Cookieが使えないため、認証の公開前にDB移行とHTTPS設定を完了してください。
旧ユーザー選択のデモ確認は `127.0.0.1` 限定とし、他人に公開しないでください。

## Environment Variables

Neon/Postgresで動かす場合は `.env` に以下を設定します。

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST-POOLER/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require&channel_binding=require"
```

- `DATABASE_URL`: アプリ実行用。Neonのpooled接続URLを入れます。
- `DIRECT_URL`: Prisma migration用。Neonのdirect接続URLを入れます。

`.env` はGitHubにコミットしません。

## Migrate SQLite Data To Neon

既存のSQLiteデータをNeon/Postgresに移す手順です。

```bash
npm.cmd run prisma:generate
npm.cmd run db:migrate
npm.cmd run data:migrate-to-postgres
```

内部では以下を行います。

1. `prisma/postgres-migrations` のmigrationをNeonへ適用
2. `prisma/dev.db` から `prisma/sqlite-export.json` へ書き出し
3. `prisma/sqlite-export.json` をNeonへ取り込み

`prisma/sqlite-export.json` は個人データを含むためGitHubにコミットしません。

## Verification

The library supports 24-record pages and update/rating/title sorting while keeping
search and genre filters. Friend notifications have independent 12-request pages,
manual refresh, and action redirects that keep the search context. The
[preference summary](docs/anime-insights.md) aggregates the signed-in owner's
completed records and suggests up to six friends' featured picks with matching
SS/S genres, excluding registered titles. It does not use review analysis or an
external recommendation service.
Each recommendation can open a personal registration draft with only its title
prefilled. No record is saved until the signed-in user submits the existing form.

Production credentials are enabled by default. Before publishing the new auth
flow, follow [the credential rollout checklist](docs/credentials-rollout.md).
No production migration has been applied by the local implementation.

Confirmed existing owners can retain their IDs and data using the
[local administrator handover command](docs/legacy-user-handover.md).
It defaults to read-only checks and never reads the application's `.env`.

One-command isolated verification (no Neon connection or existing-user writes):

```bash
npm.cmd run verify
```

This runs unit/component/in-memory PostgreSQL tests, lint, build, and credential
browser tests with dummy localhost DB URLs. The auth browser suite starts and
stops its own server on port 3031. Windows uses installed Microsoft Edge;
Linux uses Playwright Chromium (`npx playwright install --with-deps chromium`).
The prepared GitHub workflow is manual-only and has not been published or run.
It does not push, migrate data, or deploy; it needs no Neon/Vercel secrets.

Unit and component regression checks:

```bash
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

The separate legacy/demo browser checks use an existing user in the configured database.
Start the local server on port 3030, then run the checks in another terminal:

```powershell
$env:AUTH_MODE="demo"
npm.cmd run dev -- --hostname 127.0.0.1 --port 3030
npm.cmd run test:browser
```

These browser checks inspect desktop and Android-sized layouts, title selection,
cancelled deletion, rejected invalid form input, and offline recovery. They do not
create or modify database records. Mutation unit tests replace Prisma with mocks.
The auth tests additionally exercise SQL constraints and transactional flows in
an in-memory PGlite DB using a test query adapter. They do not prove the real
Prisma/Neon adapter or distributed PostgreSQL concurrency. Screenshots are written
to the Git-ignored `test-results` directory.

## Scripts

```bash
npm.cmd run lint
npm.cmd run build
npm.cmd run start
npm.cmd run start:lan -- --port 3020
npm.cmd run db:migrate
npm.cmd run data:export-sqlite
npm.cmd run data:import-postgres
```
