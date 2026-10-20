import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type AniListMedia = {
  id: number;
  format?: string | null;
  seasonYear?: number | null;
  title?: {
    native?: string | null;
    romaji?: string | null;
    english?: string | null;
    userPreferred?: string | null;
  } | null;
};

type AniListResponse = {
  errors?: { message?: string }[];
  data?: {
    Page?: {
      media?: (AniListMedia | null)[];
    };
  };
};

const query = `
  query AnimeTitleSuggestions($search: String) {
    Page(page: 1, perPage: 8) {
      media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
        id
        format
        seasonYear
        title {
          native
          romaji
          english
          userPreferred
        }
      }
    }
  }
`;

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("query")?.trim() ?? "";

  if (search.length < 2) {
    return Response.json({ suggestions: [] });
  }

  if (search.length > 200) {
    return Response.json({ suggestions: [] }, { status: 400 });
  }

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { search },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return Response.json({ suggestions: [] }, { status: 502 });
    }

    const payload = (await response.json()) as AniListResponse;
    if (payload.errors?.length || !Array.isArray(payload.data?.Page?.media)) {
      return Response.json({ suggestions: [] }, { status: 502 });
    }
    const seen = new Set<string>();
    const seenIds = new Set<number>();
    const suggestions =
      payload.data?.Page?.media
        ?.map((media) => {
          if (!media || typeof media !== "object" || !Number.isSafeInteger(media.id) || media.id <= 0 || seenIds.has(media.id)) {
            return null;
          }
          const title = [
            media.title?.native,
            media.title?.userPreferred,
            media.title?.romaji,
            media.title?.english,
          ]
            .find(
              (value) => typeof value === "string" && value.trim().length > 0,
            )
            ?.trim();

          if (!title || seen.has(title)) {
            return null;
          }

          seen.add(title);
          seenIds.add(media.id);

          return {
            id: media.id,
            title,
            subtitle: [
              typeof media.title?.romaji === "string" ? media.title.romaji.trim() : null,
              typeof media.seasonYear === "number" && Number.isInteger(media.seasonYear) && media.seasonYear > 0 ? media.seasonYear : null,
              typeof media.format === "string" ? media.format.trim() : null,
            ]
              .filter(Boolean)
              .join(" / "),
          };
        })
        .filter(Boolean) ?? [];

    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] }, { status: 502 });
  }
}
