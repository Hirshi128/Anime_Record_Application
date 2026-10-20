import Link from "next/link";
import { ArrowLeft, BookOpen, Plus } from "lucide-react";
import { getCurrentUserInsights } from "@/lib/anime-insights";
import { isGenre } from "@/lib/anime-options";
import { getCurrentUserFriendRecommendations } from "@/lib/friend-recommendations";
import { animeRegistrationHref } from "@/lib/anime-registration";

export const dynamic = "force-dynamic";

export default async function AnimeInsightsPage() {
  const [insights, recommendations] = await Promise.all([
    getCurrentUserInsights(), getCurrentUserFriendRecommendations(),
  ]);
  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell space-y-8">
        <header className="record-hero">
          <div className="record-hero-content">
            <div className="mb-5"><Link className="button-secondary" href="/anime"><ArrowLeft aria-hidden="true" size={18} />アニメ一覧へ戻る</Link></div>
            <p className="eyebrow">Insights</p>
            <h1 className="mt-3 text-3xl font-semibold">好みの傾向</h1>
            <p className="mt-2 text-sm text-zinc-600">{insights.ownerName}さん / 集計対象：視聴済みの記録</p>
          </div>
        </header>
        <dl className="grid grid-cols-3 gap-3 border-b border-zinc-200 pb-6">
          {[["視聴済み", insights.completedCount], ["SS・S", insights.highRatedCount], ["ジャンル", insights.genres.length]].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm font-medium text-zinc-600">{label}</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {insights.completedCount === 0 ? (
          <section className="space-y-4">
            <p className="text-sm text-zinc-600">視聴済みの記録はまだありません。</p>
            <Link className="button-primary button-large" href="/anime"><BookOpen aria-hidden="true" size={20} />アニメ一覧を開く</Link>
          </section>
        ) : (
          <>
            <section className="space-y-5">
              <h2 className="text-xl font-semibold">評価の分布</h2>
              <ul className="space-y-3">
                {insights.ratings.map(({ rating, count }) => (
                  <li key={rating} className="grid grid-cols-[48px_minmax(0,1fr)_64px] items-center gap-3">
                    <span className={`rating-badge rating-${rating}`}>{rating}</span>
                    <meter className="insight-meter" min={0} max={insights.completedCount} value={count} aria-label={`${rating}の作品数`} aria-valuetext={`${count}作品 / ${insights.completedCount}作品`} />
                    <span className="text-right text-sm tabular-nums">{count}作品</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="border-t border-zinc-200 pt-6">
              <h2 className="text-xl font-semibold">ジャンル別の評価</h2>
              {insights.genres.length ? (
                <table className="insight-table mt-5 w-full table-fixed text-sm">
                  <thead><tr><th scope="col" className="w-2/5">ジャンル</th><th scope="col">視聴済み</th><th scope="col">SS・S</th><th scope="col">SS・S率</th></tr></thead>
                  <tbody>{insights.genres.map((genre) => (
                    <tr key={genre.name}>
                      <th scope="row">{isGenre(genre.name) ? <Link className="text-teal-800 underline underline-offset-4" href={`/anime?status=COMPLETED&tag=${encodeURIComponent(genre.name)}&sort=rating`}>{genre.name}</Link> : genre.name}</th>
                      <td>{genre.count}</td><td>{genre.highCount}</td><td>{genre.highPercentage}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <p className="mt-4 text-sm text-zinc-600">視聴済み作品にジャンルが登録されていません。</p>}
            </section>
          </>
        )}
        <section className="space-y-5 border-t border-zinc-200 pt-6">
          <h2 className="text-xl font-semibold">フレンドからのおすすめ</h2>
          {recommendations.length ? <div className="grid gap-4 sm:grid-cols-2">
            {recommendations.map((pick) => <article key={pick.id} className={`record-card rating-${pick.rating} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-lg font-semibold">{pick.title}</h3>
                <span className={`rating-badge rating-${pick.rating} shrink-0`}>{pick.rating}</span>
              </div>
              <p className="mt-3 text-sm"><Link className="text-teal-800 underline underline-offset-4" href={`/users/search?q=${encodeURIComponent(pick.username)}`}>{pick.friendName || `@${pick.username}`}</Link>さんのイチ押し</p>
              <p className="mt-4 text-xs text-zinc-600">SS・S作品との共通ジャンル</p>
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="おすすめの根拠となる共通ジャンル">
                {pick.genres.map((genre) => <li className="genre-chip" key={genre}>{genre}</li>)}
              </ul>
              <Link className="button-primary button-large mt-4" href={animeRegistrationHref(pick.title)}><Plus aria-hidden="true" size={18} />記録する</Link>
            </article>)}
          </div> : <p className="text-sm text-zinc-600">条件に合うフレンドのイチ押しはまだありません。</p>}
        </section>
      </section>
    </main>
  );
}
