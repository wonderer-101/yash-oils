import { NextResponse } from "next/server";
import { shopifyAdminGraphQL } from "@/lib/shopify/admin";
import { getShopifyConfig } from "@/lib/shopify/config";
import { shopifyStorefrontGraphQL } from "@/lib/shopify/storefront";

const ADMIN_SHOP_QUERY = `
  query AdminShopHealth {
    shop {
      id
      name
      myshopifyDomain
    }
  }
`;

const STOREFRONT_SHOP_QUERY = `
  query StorefrontShopHealth {
    shop {
      id
      name
      primaryDomain {
        host
        url
      }
    }
  }
`;

export async function GET() {
  try {
    const {
      storeDomain,
      adminApiVersion,
      storefrontApiVersion,
      hasAdminAccessToken,
      hasStorefrontAccessToken,
    } = getShopifyConfig();

    const [adminResult, storefrontResult] = await Promise.allSettled([
      hasAdminAccessToken
        ? shopifyAdminGraphQL({ query: ADMIN_SHOP_QUERY })
        : Promise.resolve(null),
      hasStorefrontAccessToken
        ? shopifyStorefrontGraphQL({ query: STOREFRONT_SHOP_QUERY })
        : Promise.resolve(null),
    ]);

    const adminOk =
      !hasAdminAccessToken ||
      (adminResult.status === "fulfilled" && Boolean(adminResult.value));
    const storefrontOk =
      !hasStorefrontAccessToken ||
      (storefrontResult.status === "fulfilled" && Boolean(storefrontResult.value));
    const ok = adminOk || storefrontOk;

    return NextResponse.json(
      {
        ok,
        storeDomain,
        adminApiVersion,
        storefrontApiVersion,
        admin: adminOk && adminResult.status === "fulfilled" ? adminResult.value?.shop : null,
        storefront:
          storefrontOk && storefrontResult.status === "fulfilled"
            ? storefrontResult.value?.shop
            : null,
        configured: {
          admin: hasAdminAccessToken,
          storefront: hasStorefrontAccessToken,
        },
        errors: [
          hasAdminAccessToken && !adminOk
            ? { source: "admin", message: adminResult.reason?.message }
            : null,
          hasStorefrontAccessToken && !storefrontOk
            ? { source: "storefront", message: storefrontResult.reason?.message }
            : null,
        ].filter(Boolean),
      },
      { status: ok ? 200 : 500 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
