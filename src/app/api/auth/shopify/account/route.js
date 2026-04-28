import { NextResponse } from "next/server";

function normalizeStoreDomain(value) {
  return (value || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function resolveStoreDomain() {
  return normalizeStoreDomain(
    process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || ""
  );
}

export async function GET(request) {
  const storeDomain = resolveStoreDomain();
  if (!storeDomain) {
    return NextResponse.redirect(new URL("/profile?account_link_error=missing_store_domain", request.url));
  }

  return NextResponse.redirect(`https://${storeDomain}/account`);
}

