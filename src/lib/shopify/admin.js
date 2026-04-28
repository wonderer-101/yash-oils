import { getShopifyConfig } from "./config";

function formatApiError({ status, statusText, errors }) {
  const details = errors ? ` ${JSON.stringify(errors)}` : "";
  return `Shopify Admin API error (${status} ${statusText}).${details}`;
}

export async function shopifyAdminGraphQL({
  query,
  variables = {},
  cache = "no-store",
}) {
  const { storeDomain, adminAccessToken, adminApiVersion } = getShopifyConfig();
  if (!adminAccessToken) {
    throw new Error(
      "Missing Admin API token. Set SHOPIFY_ACCESS_TOKEN or SHOPIFY_ADMIN_ACCESS_TOKEN."
    );
  }
  const endpoint = `https://${storeDomain}/admin/api/${adminApiVersion}/graphql.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminAccessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.errors) {
    throw new Error(
      formatApiError({
        status: response.status,
        statusText: response.statusText,
        errors: payload.errors,
      })
    );
  }

  return payload.data;
}
