export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const [key, value] = cookie.split("=").map((c) => c.trim());
    cookies[key] = decodeURIComponent(value);
  });

  return cookies;
}
