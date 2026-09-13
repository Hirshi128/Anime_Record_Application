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
  data?: {
    Page?: {
      media?: AniListMedia[];
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
    });

    if (!response.ok) {
      return Response.json({ suggestions: [] }, { status: 502 });
    }

    const payload = (await response.json()) as AniListResponse;
    const seen = new Set<string>();
    const suggestions =
      payload.data?.Page?.media
        ?.map((media) => {
          const title =
            media.title?.native ??
            media.title?.userPreferred ??
            media.title?.romaji ??
            media.title?.english;

          if (!title || seen.has(title)) {
            return null;
          }

          seen.add(title);

          return {
            id: media.id,
            title,
            subtitle: [media.title?.romaji, media.seasonYear, media.format]
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
