const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getBaseUrl = (request?: Request) => {
  const envUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    return trimTrailingSlash(envUrl);
  }

  if (request) {
    const headers = request.headers;
    const rawProto = headers.get("x-forwarded-proto") || "http";
    const rawHost = headers.get("x-forwarded-host") || headers.get("host");
    const proto = rawProto.split(",")[0]?.trim() || "http";
    const host = rawHost?.split(",")[0]?.trim();
    if (host) {
      return trimTrailingSlash(`${proto}://${host}`);
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing APP_URL or NEXT_PUBLIC_APP_URL in production.");
  }

  return "http://localhost:3000";
};
