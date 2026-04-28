import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  refreshAccessToken,
  resolveAppUrl,
  queryCustomerApi,
  serializeCookie,
  makeTokenCookieOptions,
} from "@/lib/shopify/customerAuth";

const ADDRESS_FIELDS = `
  id
  firstName
  lastName
  company
  address1
  address2
  city
  zoneCode
  zip
  territoryCode
  phoneNumber
`;

const LIST_ADDRESSES_QUERY = `
  query CustomerAddresses {
    customer {
      defaultAddress { id }
      addresses(first: 50) {
        edges {
          node {
            ${ADDRESS_FIELDS}
          }
        }
      }
    }
  }
`;

const CREATE_ADDRESS_MUTATION = `
  mutation CustomerAddressCreate($address: CustomerAddressInput!, $defaultAddress: Boolean) {
    customerAddressCreate(address: $address, defaultAddress: $defaultAddress) {
      customerAddress {
        ${ADDRESS_FIELDS}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_ADDRESS_MUTATION = `
  mutation CustomerAddressUpdate($addressId: ID!, $address: CustomerAddressInput!, $defaultAddress: Boolean) {
    customerAddressUpdate(addressId: $addressId, address: $address, defaultAddress: $defaultAddress) {
      customerAddress {
        ${ADDRESS_FIELDS}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DELETE_ADDRESS_MUTATION = `
  mutation CustomerAddressDelete($addressId: ID!) {
    customerAddressDelete(addressId: $addressId) {
      deletedAddressId
      userErrors {
        field
        message
      }
    }
  }
`;

async function getAccessToken(request) {
  const appUrl = resolveAppUrl(request);
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
  const refreshToken = cookieStore.get(COOKIE_REFRESH_TOKEN)?.value;
  let refreshed = null;

  if (!accessToken && refreshToken) {
    refreshed = await refreshAccessToken(refreshToken, appUrl);
    accessToken = refreshed.accessToken;
  }

  return { appUrl, accessToken, refreshToken, refreshed };
}

function withRefreshedCookies(response, refreshed) {
  if (!refreshed?.accessToken) return response;
  response.headers.append(
    "Set-Cookie",
    serializeCookie(
      COOKIE_ACCESS_TOKEN,
      refreshed.accessToken,
      makeTokenCookieOptions(refreshed.expiresIn || 86400)
    )
  );
  if (refreshed.refreshToken) {
    response.headers.append(
      "Set-Cookie",
      serializeCookie(
        COOKIE_REFRESH_TOKEN,
        refreshed.refreshToken,
        makeTokenCookieOptions(60 * 60 * 24 * 30)
      )
    );
  }
  return response;
}

function cleanAddressInput(raw) {
  const v = raw || {};
  const input = {
    firstName: String(v.firstName || "").trim(),
    lastName: String(v.lastName || "").trim(),
    company: String(v.company || "").trim(),
    address1: String(v.address1 || "").trim(),
    address2: String(v.address2 || "").trim(),
    city: String(v.city || "").trim(),
    zoneCode: String(v.zoneCode || "").trim(),
    zip: String(v.zip || "").trim(),
    territoryCode: String(v.territoryCode || "").trim().toUpperCase(),
    phoneNumber: String(v.phoneNumber || "").trim(),
  };

  // Remove empty optional fields to reduce Shopify validation errors.
  return Object.fromEntries(
    Object.entries(input).filter(([key, value]) => {
      if (key === "address1" || key === "city" || key === "territoryCode" || key === "zip") {
        return true;
      }
      return value !== "";
    })
  );
}

function mapAddressConnection(addresses) {
  const edges = addresses?.edges || [];
  const nodes = addresses?.nodes || [];
  if (nodes.length) return nodes;
  return edges.map((edge) => edge?.node).filter(Boolean);
}

async function runWithRetry({ appUrl, accessToken, refreshToken, query, variables }) {
  try {
    return await queryCustomerApi(accessToken, query, variables, appUrl);
  } catch (err) {
    if (!refreshToken) throw err;
    const retried = await refreshAccessToken(refreshToken, appUrl);
    const data = await queryCustomerApi(retried.accessToken, query, variables, appUrl);
    return { data, retried };
  }
}

export async function GET(request) {
  try {
    const { appUrl, accessToken, refreshToken, refreshed } = await getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ ok: false, addresses: [] }, { status: 401 });
    }

    const result = await runWithRetry({
      appUrl,
      accessToken,
      refreshToken,
      query: LIST_ADDRESSES_QUERY,
      variables: undefined,
    });

    const data = result?.data || result;
    const retried = result?.retried || null;
    const customer = data?.customer || {};
    const defaultAddressId = customer?.defaultAddress?.id || null;
    const addresses = mapAddressConnection(customer?.addresses).map((address) => ({
      ...address,
      isDefault: address.id === defaultAddressId,
    }));

    const response = NextResponse.json({ ok: true, addresses, defaultAddressId });
    return withRefreshedCookies(response, retried || refreshed);
  } catch (err) {
    console.error("[shopify/addresses:list]", err);
    return NextResponse.json({ ok: false, addresses: [] }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { appUrl, accessToken, refreshToken, refreshed } = await getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const address = cleanAddressInput(body?.address);
    if (!address.address1 || !address.city || !address.territoryCode || !address.zip) {
      return NextResponse.json(
        { ok: false, error: "Address1, city, country code, and ZIP are required." },
        { status: 400 }
      );
    }

    const result = await runWithRetry({
      appUrl,
      accessToken,
      refreshToken,
      query: CREATE_ADDRESS_MUTATION,
      variables: {
        address,
        defaultAddress: Boolean(body?.defaultAddress),
      },
    });

    const data = result?.data || result;
    const retried = result?.retried || null;
    const userErrors = data?.customerAddressCreate?.userErrors || [];
    if (userErrors.length) {
      return NextResponse.json({ ok: false, userErrors }, { status: 400 });
    }

    const response = NextResponse.json({
      ok: true,
      address: data?.customerAddressCreate?.customerAddress || null,
    });
    return withRefreshedCookies(response, retried || refreshed);
  } catch (err) {
    console.error("[shopify/addresses:create]", err);
    return NextResponse.json({ ok: false, error: "Failed to create address." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { appUrl, accessToken, refreshToken, refreshed } = await getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const addressId = String(body?.addressId || "").trim();
    const address = cleanAddressInput(body?.address);
    if (!addressId) {
      return NextResponse.json({ ok: false, error: "Address ID is required." }, { status: 400 });
    }
    if (!address.address1 || !address.city || !address.territoryCode || !address.zip) {
      return NextResponse.json(
        { ok: false, error: "Address1, city, country code, and ZIP are required." },
        { status: 400 }
      );
    }

    const result = await runWithRetry({
      appUrl,
      accessToken,
      refreshToken,
      query: UPDATE_ADDRESS_MUTATION,
      variables: {
        addressId,
        address,
        defaultAddress: Boolean(body?.defaultAddress),
      },
    });

    const data = result?.data || result;
    const retried = result?.retried || null;
    const userErrors = data?.customerAddressUpdate?.userErrors || [];
    if (userErrors.length) {
      return NextResponse.json({ ok: false, userErrors }, { status: 400 });
    }

    const response = NextResponse.json({
      ok: true,
      address: data?.customerAddressUpdate?.customerAddress || null,
    });
    return withRefreshedCookies(response, retried || refreshed);
  } catch (err) {
    console.error("[shopify/addresses:update]", err);
    return NextResponse.json({ ok: false, error: "Failed to update address." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { appUrl, accessToken, refreshToken, refreshed } = await getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const addressId = String(body?.addressId || "").trim();
    if (!addressId) {
      return NextResponse.json({ ok: false, error: "Address ID is required." }, { status: 400 });
    }

    const result = await runWithRetry({
      appUrl,
      accessToken,
      refreshToken,
      query: DELETE_ADDRESS_MUTATION,
      variables: { addressId },
    });

    const data = result?.data || result;
    const retried = result?.retried || null;
    const userErrors = data?.customerAddressDelete?.userErrors || [];
    if (userErrors.length) {
      return NextResponse.json({ ok: false, userErrors }, { status: 400 });
    }

    const response = NextResponse.json({
      ok: true,
      deletedAddressId: data?.customerAddressDelete?.deletedAddressId || addressId,
    });
    return withRefreshedCookies(response, retried || refreshed);
  } catch (err) {
    console.error("[shopify/addresses:delete]", err);
    return NextResponse.json({ ok: false, error: "Failed to delete address." }, { status: 500 });
  }
}

