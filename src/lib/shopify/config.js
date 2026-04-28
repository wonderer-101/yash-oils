const DEFAULT_STOREFRONT_API_VERSION = "2026-04";

function normalizeStoreDomain(storeDomain) {
  if (!storeDomain) return "";
  return storeDomain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(name) {
  return (process.env[name] ?? "").trim();
}

export function getShopifyConfig() {
  const privateToken = optionalEnv("SHOPIFY_STOREFRONT_PRIVATE_TOKEN");
  const publicToken = optionalEnv("SHOPIFY_STOREFRONT_ACCESS_TOKEN");

  // Pick the best available token
  const storefrontAccessToken = privateToken || publicToken;

  if (!storefrontAccessToken) {
    throw new Error(
      "Missing Shopify Storefront token. Set SHOPIFY_STOREFRONT_PRIVATE_TOKEN in .env.local. " +
      "Get it from: Shopify Admin -> Sales channels -> Headless -> Storefront API."
    );
  }

  return {
    storeDomain: normalizeStoreDomain(requiredEnv("SHOPIFY_STORE_DOMAIN")),
    storefrontAccessToken,
    storefrontApiVersion:
      optionalEnv("SHOPIFY_STOREFRONT_API_VERSION") || DEFAULT_STOREFRONT_API_VERSION,
  };
}
