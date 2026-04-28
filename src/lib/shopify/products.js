import { shopifyStorefrontGraphQL } from "./storefront";
import { getShopifyConfig } from "./config";

const IMAGE_NODE_FIELDS = `
  url
  altText
  width
  height
`;

const PRODUCT_LIST_NODE_FIELDS = `
  id
  title
  handle
  availableForSale
  featuredImage {
    ${IMAGE_NODE_FIELDS}
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  compareAtPriceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
`;

const PRODUCT_DETAIL_NODE_FIELDS = `
  ${PRODUCT_LIST_NODE_FIELDS}
  description
  descriptionHtml
  tags
  images(first: 12) {
    edges {
      node {
        ${IMAGE_NODE_FIELDS}
      }
    }
  }
  variants(first: 1) {
    edges {
      node {
        id
      }
    }
  }
`;

const PRODUCTS_QUERY = `
  query StorefrontProducts($first: Int!, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
    products(first: $first, query: $query, sortKey: $sortKey, reverse: $reverse) {
      edges {
        node {
          ${PRODUCT_LIST_NODE_FIELDS}
        }
      }
    }
  }
`;

const COLLECTION_PRODUCTS_QUERY = `
  query StorefrontCollectionProducts($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      id
      title
      handle
      products(first: $first) {
        edges {
          node {
            ${PRODUCT_LIST_NODE_FIELDS}
          }
        }
      }
    }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = `
  query StorefrontProductByHandle($handle: String!) {
    product(handle: $handle) {
      ${PRODUCT_DETAIL_NODE_FIELDS}
    }
  }
`;

function mapImage(image, fallbackAlt) {
  if (!image?.url) return null;
  return {
    url: image.url,
    alt: image.altText || fallbackAlt || "Product image",
    width: image.width || null,
    height: image.height || null,
  };
}

function mapProductSummary(node) {
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    availableForSale: node.availableForSale ?? true,
    image: mapImage(node.featuredImage, node.title),
    price: node.priceRange?.minVariantPrice || null,
    compareAtPrice: node.compareAtPriceRange?.minVariantPrice || null,
  };
}

function normalizeVariantId(variantGid) {
  if (!variantGid) return "";
  const lastPart = variantGid.split("/").pop();
  return /^\d+$/.test(lastPart || "") ? lastPart : "";
}

function mapProductDetail(node) {
  const { storeDomain } = getShopifyConfig();
  const imageMap = new Map();

  const featuredImage = mapImage(node.featuredImage, node.title);
  if (featuredImage?.url) imageMap.set(featuredImage.url, featuredImage);

  node.images?.edges?.forEach(({ node: imageNode }) => {
    const image = mapImage(imageNode, node.title);
    if (image?.url) imageMap.set(image.url, image);
  });

  const images = Array.from(imageMap.values());
  const variantGid = node.variants?.edges?.[0]?.node?.id || "";
  const variantNumericId = normalizeVariantId(variantGid);

  return {
    ...mapProductSummary(node),
    description: node.description || "",
    descriptionHtml: node.descriptionHtml || "",
    tags: node.tags || [],
    images,
    variantGid,
    variantNumericId,
    storeDomain,
    storefrontUrl: `https://${storeDomain}/products/${node.handle}`,
  };
}

export async function getAdminProducts({
  limit,
  query = "",
  collectionId = "",
  sortKey = "UPDATED_AT",
  reverse = true,
}) {
  // collectionId in Storefront API is a handle (string) not a GID
  // Support both GID format (legacy) and plain handle
  let collectionHandle = collectionId;
  if (collectionHandle && collectionHandle.includes("/")) {
    // Extract handle from GID like gid://shopify/Collection/123 - not possible, need handle
    // If a GID is passed, fallback to regular product query with filter
    collectionHandle = "";
  }

  const data = await shopifyStorefrontGraphQL(
    collectionHandle
      ? {
          query: COLLECTION_PRODUCTS_QUERY,
          variables: { first: limit, handle: collectionHandle },
        }
      : {
          query: PRODUCTS_QUERY,
          variables: {
            first: limit,
            query: query || undefined,
            sortKey: sortKey || "UPDATED_AT",
            reverse: Boolean(reverse),
          },
        }
  );

  if (collectionHandle && !data.collection) {
    return {
      missingCollection: true,
      collection: null,
      products: [],
    };
  }

  const productEdges = collectionHandle
    ? data.collection?.products?.edges || []
    : data.products?.edges || [];

  return {
    missingCollection: false,
    collection: collectionHandle
      ? {
          id: data.collection.id,
          title: data.collection.title,
          handle: data.collection.handle,
        }
      : null,
    products: productEdges.map(({ node }) => mapProductSummary(node)),
  };
}

export async function getAdminProductByHandle(handle) {
  const normalizedHandle = handle?.trim().toLowerCase();
  if (!normalizedHandle) return null;

  const data = await shopifyStorefrontGraphQL({
    query: PRODUCT_BY_HANDLE_QUERY,
    variables: { handle: normalizedHandle },
  });

  const node = data.product;
  if (!node) return null;

  return mapProductDetail(node);
}
