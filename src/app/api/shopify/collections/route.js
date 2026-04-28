import { NextResponse } from "next/server";
import { shopifyStorefrontGraphQL } from "@/lib/shopify/storefront";

const COLLECTIONS_QUERY = `
  query StorefrontCollections($first: Int!) {
    collections(first: $first, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          handle
          description
          image {
            url
            altText
            width
            height
          }
        }
      }
    }
  }
`;

function parseLimit(rawLimit) {
  const parsed = Number.parseInt(rawLimit ?? "12", 10);
  if (Number.isNaN(parsed)) return 12;
  return Math.min(Math.max(parsed, 1), 30);
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));

    const data = await shopifyStorefrontGraphQL({
      query: COLLECTIONS_QUERY,
      variables: { first: limit },
    });

    const collections =
      data.collections?.edges?.map(({ node }) => ({
        id: node.id,
        title: node.title,
        handle: node.handle,
        description: node.description || "",
        image: node.image
          ? {
              url: node.image.url,
              alt: node.image.altText || node.title,
              width: node.image.width,
              height: node.image.height,
            }
          : null,
      })) || [];

    return NextResponse.json({ ok: true, count: collections.length, collections });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("[collections] Full error:", details);
    return NextResponse.json(
      {
        ok: false,
        error: "Categories are temporarily unavailable. Please try again shortly.",
      },
      { status: 503 }
    );
  }
}
