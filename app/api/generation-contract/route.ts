import { NextResponse } from "next/server";
import { buildGenerationContract } from "@/lib/deterministic-templates";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

const normalizeNiche = (value: string): string | null => {
  const niche = value.trim().toLowerCase();
  if (!niche) return null;

  if (["restaurant", "cafe", "bistro"].includes(niche)) return "restaurant";
  if (["dental", "dental_clinic", "dental clinic", "dentist"].includes(niche)) return "dental";
  if (["real_estate", "real estate", "realtor", "property"].includes(niche)) return "real_estate";
  if (["barbershop", "barber"].includes(niche)) return "barbershop";
  if (["beauty_salon", "beauty salon", "beauty"].includes(niche)) return "beauty_salon";
  if (["nail_salon", "nail salon", "nails", "nail"].includes(niche)) return "nail_salon";

  return null;
};

const parseNicheFromRequest = async (request: Request): Promise<string | null> => {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("niche");
  if (fromQuery) return fromQuery;

  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    const niche = typeof body?.niche === "string" ? body.niche : null;
    return niche;
  }

  return null;
};

const unauthorized = () => NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });

const badRequest = (code: string, message: string) =>
  NextResponse.json(
    {
      error: message,
      code
    },
    { status: 400 }
  );

const handle = async (request: Request) => {
  const supabase = getSupabaseRouteClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return unauthorized();
  if (!(await userHasLaunchAccess(data.user.id))) return forbidden();

  const rawNiche = await parseNicheFromRequest(request);
  if (!rawNiche) {
    return badRequest("MISSING_NICHE", "Provide a niche via query param or POST body.");
  }

  const normalized = normalizeNiche(rawNiche);
  if (!normalized) {
    return badRequest(
      "UNKNOWN_NICHE",
      "Unsupported niche. Allowed: restaurant, dental, real_estate, barbershop, beauty_salon, nail_salon."
    );
  }

  const contract = buildGenerationContract(normalized);

  return NextResponse.json({
    rail: contract.template,
    prompt: contract.prompt,
    schema: contract.jsonSchema
  });
};

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
