import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
} from "@/lib/shopify/customerAuth";

function toAbsoluteUrl(request, pathname) {
  return new URL(pathname, request.url);
}

export async function GET(request) {
  const cookieStore = await cookies();
  const hasAccessToken = Boolean(cookieStore.get(COOKIE_ACCESS_TOKEN)?.value);
  const hasRefreshToken = Boolean(cookieStore.get(COOKIE_REFRESH_TOKEN)?.value);

  if (!hasAccessToken && !hasRefreshToken) {
    return NextResponse.redirect(toAbsoluteUrl(request, "/api/auth/shopify/login"));
  }

  try {
    const cartApiUrl = toAbsoluteUrl(request, "/api/shopify/cart");
    const response = await fetch(cartApiUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    if (!response.ok) {
      return NextResponse.redirect(toAbsoluteUrl(request, "/cart"));
    }

    const payload = await response.json().catch(() => ({}));
    const checkoutUrl = String(payload?.cart?.checkoutUrl || "");
    if (checkoutUrl.startsWith("http://") || checkoutUrl.startsWith("https://")) {
      return NextResponse.redirect(checkoutUrl);
    }

    return NextResponse.redirect(toAbsoluteUrl(request, "/cart"));
  } catch {
    return NextResponse.redirect(toAbsoluteUrl(request, "/cart"));
  }
}
