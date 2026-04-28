import { getShopifyConfig } from "./config";
import { createStorefrontApiClient } from "@shopify/storefront-api-client";

const clientCache = new Map();

function getClient({ storeDomain, storefrontAccessToken, storefrontApiVersion, cache }) {
  const key = `${storeDomain}|${storefrontApiVersion}|${storefrontAccessToken.slice(0, 16)}|${cache}`;
  const existing = clientCache.get(key);
  if (existing) return existing;

  const client = createStorefrontApiClient({
    storeDomain,
    apiVersion: storefrontApiVersion,
    privateAccessToken: storefrontAccessToken,
    retries: 1,
    customFetchApi: (url, init) => fetch(url, { ...init, cache }),
  });

  clientCache.set(key, client);
  return client;
}

export async function shopifyStorefrontGraphQL({
  query,
  variables = {},
  cache = "no-store",
}) {
  const {
    storeDomain,
    storefrontAccessToken,
    storefrontApiVersion,
  } = getShopifyConfig();

  if (!storefrontAccessToken) {
    throw new Error(
      "Missing Storefront API token. Set SHOPIFY_STOREFRONT_PRIVATE_TOKEN in .env.local. " +
      "Get it from: Shopify Admin -> Sales channels -> Headless -> Storefront API."
    );
  }

  const client = getClient({
    storeDomain,
    storefrontAccessToken,
    storefrontApiVersion,
    cache,
  });

  const result = await client.request(query, { variables });
  const status = result?.errors?.networkStatusCode || 200;

  if (status === 404) {
    throw new Error(
      `Storefront API 404 on ${storeDomain}. ` +
      "This usually means: (1) the token is from a different store, or " +
      "(2) the Headless sales channel has not been added in Shopify Admin yet. " +
      "Go to Shopify Admin -> Sales channels -> Add -> Headless, then copy the Storefront API private token."
    );
  }

  if (status === 401 || status === 403) {
    throw new Error(
      `Storefront API auth failed (${status}) on ${storeDomain}. ` +
      "Regenerate the Storefront API private token in Shopify Admin -> Sales channels -> Headless."
    );
  }

  if (result?.errors) {
    const details = result.errors?.graphQLErrors
      ? ` ${JSON.stringify(result.errors.graphQLErrors)}`
      : ` ${result.errors.message || ""}`;
    throw new Error(`Shopify Storefront API error (${status}).${details}`);
  }

  if (!result?.data) {
    throw new Error("Shopify Storefront API returned no data.");
  }

  return result.data;
}
