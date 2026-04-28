import { NextResponse } from "next/server";

const ALLOWED_SECTIONS = new Set(["profile", "addresses"]);

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

export async function GET(request, { params }) {
  const storeDomain = resolveStoreDomain();
  if (!storeDomain) {
    return NextResponse.redirect(new URL("/profile?account_link_error=missing_store_domain", request.url));
  }

  const section = String(params?.section || "").toLowerCase();
  const targetPath = ALLOWED_SECTIONS.has(section) ? `/account/${section}` : "/account";

  return NextResponse.redirect(`https://${storeDomain}${targetPath}`);
}

