# Anime Record

見たアニメの評価、感想、視聴状況、ジャンル、イチ押し、フレンドを管理するNext.jsアプリです。

## Local Setup

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
