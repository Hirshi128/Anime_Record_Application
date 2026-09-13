import Link from "next/link";

const features = [
  {
    title: "記録",
    body: "タイトル、評価、感想、視聴状況をすばやく保存できます。",
  },
  {
    title: "整理",
    body: "タグと評価ランクで、見返したい作品を探しやすくします。",
  },
  {
    title: "分析の準備",
    body: "あとから好みの傾向やおすすめ機能へ自然につなげられます。",
  },
];

export default function Home() {
  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell flex min-h-screen max-w-6xl flex-col justify-center gap-10">
        <div className="record-hero">
          <div className="record-hero-content max-w-4xl space-y-6">
          <p className="eyebrow">
            Anime Record
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            見たアニメの評価と感想を、あとから振り返れる形で残す。
          </h1>
          <p className="max-w-2xl text-base leading-8 text-white/78">
            一覧、登録、詳細・編集から始めるシンプルな記録アプリです。
            タグも保存できるので、将来の好み分析やおすすめ機能にも育てられます。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              className="button-primary"
              href="/anime"
            >
              アニメ一覧を開く
            </Link>
            <Link
              className="button-secondary"
              href="/users"
            >
              ユーザー選択
            </Link>
          </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <article
              className="surface-panel p-5"
              key={feature.title}
            >
              <h2 className="text-base font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
