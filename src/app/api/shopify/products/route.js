import { NextResponse } from "next/server";
import { getAdminProducts } from "@/lib/shopify/products";

function parseLimit(rawLimit) {
  const parsed = Number.parseInt(rawLimit ?? "12", 10);
  if (Number.isNaN(parsed)) return 12;
  return Math.min(Math.max(parsed, 1), 50);
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const q = url.searchParams.get("q")?.trim() || "";
    const collectionId = url.searchParams.get("collectionId")?.trim() || "";

    const result = await getAdminProducts({
      limit,
      query: q,
      collectionId,
    });

    if (result.missingCollection) {
      return NextResponse.json(
        {
          ok: false,
          error: "Collection not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: result.products.length,
      collection: result.collection,
      products: result.products,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("[products] Full error:", details);
    return NextResponse.json(
      {
        ok: false,
        error: "Products are temporarily unavailable. Please try again shortly.",
      },
      { status: 503 }
    );
  }
}
