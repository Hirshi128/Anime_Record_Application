# Anime Record

見たアニメの評価・感想・視聴状況・ジャンルを、ログインなしで自分のブラウザに記録するNext.jsアプリです。

## Current Personal App

- `/` または `/library` で起動。ユーザー登録・パスワード・フレンド機能は使用しません。
- 評価は **SS / S / A / B / C / D / E** の7段階。数値スコアは使用しません。
- タイトル・見た年月（必須）・任意の感想を入力し、「ティア表で評価」へ進みます。
  新規作品はティアへ配置して初めて保存されます。段内は左ほど上位で、順序も保存します。
- マウス・タッチ・キーボードのドラッグ操作に対応。小さなカードの左上に見た年月、その下にタイトルを表示します。
  年・年月フィルターで「2025年のティア表」などを表示し、一覧では年月順にも並べられます。
  古いバックアップに年月がなければ「年月未登録」とし、推測した年月は付けません。
- 検索、複数ジャンルのAND/OR絞り込み、並べ替え、登録・編集・削除に対応。
- 記録はアクセスしたURLのブラウザ保存領域にのみ保存され、サーバーへ送信しません。
  PCとスマホ、ブラウザ、ホスト名やポートが異なれば保存領域も異なります。
- 「書き出し」でJSONバックアップ、「読み込み」で復元。復元は確認後に全件置換します。
  ブラウザデータ削除・端末変更・公開URL変更前に書き出してください。
- タイトル候補検索だけは入力中のタイトルを候補API経由でAniListへ送信します。
  感想や保存済み一覧は送信しません。取得失敗時も手入力できます。
- アプリ画面の初回取得にはネット接続が必要です。完全なオフライン起動や端末間の自動同期は未対応です。
- 旧Neonのユーザー・パスワード・アニメ記録は削除も自動移行もしません。
  旧URL `/anime/...` `/users/...` は個人用一覧へ案内します。旧実装は参照・移行検討用に保管しています。

```powershell
npm.cmd install
npm.cmd run dev -- --hostname 127.0.0.1 --port 3032
```

検証は `npm.cmd run verify`。個人用画面はDBを使用しませんが、旧実装が同居する間は
ビルドのためにDB URL設定が必要です。verifyは安全なダミーURLに強制置換します。
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
