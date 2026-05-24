export type NormalizedImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  sourceUrl: string;
};

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
};

type PexelsResponse = {
  photos: PexelsPhoto[];
};

export async function searchPexels(query: string, perPage = 8): Promise<NormalizedImage[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error("PEXELS_API_KEY missing");
  }

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Pexels search failed: ${response.status}`);
  }

  const data = (await response.json()) as PexelsResponse;
  return (data.photos ?? []).map((photo) => ({
    url: photo.src.original || photo.src.large2x || photo.src.large,
    width: photo.width,
    height: photo.height,
    alt: photo.alt || "Stock photo",
    photographer: photo.photographer,
    sourceUrl: photo.url
  }));
}
