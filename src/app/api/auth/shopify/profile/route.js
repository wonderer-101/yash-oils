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

const UPDATE_CUSTOMER_MUTATION_WITH_PHONE = `
  mutation CustomerUpdate($input: CustomerUpdateInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        firstName
        lastName
        emailAddress { emailAddress }
        phoneNumber { phoneNumber }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_CUSTOMER_MUTATION_NO_PHONE = `
  mutation CustomerUpdate($input: CustomerUpdateInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        firstName
        lastName
        emailAddress { emailAddress }
      }
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

async function runMutationWithRetry({
  appUrl,
  accessToken,
  refreshToken,
  mutation,
  variables,
}) {
  try {
    const data = await queryCustomerApi(accessToken, mutation, variables, appUrl);
    return { data, refreshed: null };
  } catch (err) {
    if (!refreshToken) throw err;
    const retried = await refreshAccessToken(refreshToken, appUrl);
    const data = await queryCustomerApi(
      retried.accessToken,
      mutation,
      variables,
      appUrl
    );
    return { data, refreshed: retried };
  }
}

export async function PATCH(request) {
  try {
    const { appUrl, accessToken, refreshToken, refreshed } = await getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const firstName = String(body?.firstName || "").trim();
    const lastName = String(body?.lastName || "").trim();
    const phoneNumber = String(body?.phoneNumber || "").trim();

    const hasPhoneInPayload = Object.prototype.hasOwnProperty.call(body || {}, "phoneNumber");
    const inputWithoutPhone = {};
    if (firstName) inputWithoutPhone.firstName = firstName;
    if (lastName) inputWithoutPhone.lastName = lastName;

    if (!Object.keys(inputWithoutPhone).length && !hasPhoneInPayload) {
      return NextResponse.json({ ok: false, error: "No changes to update." }, { status: 400 });
    }

    let mutation = hasPhoneInPayload
      ? UPDATE_CUSTOMER_MUTATION_WITH_PHONE
      : UPDATE_CUSTOMER_MUTATION_NO_PHONE;
    let variables = {
      input: hasPhoneInPayload
        ? { ...inputWithoutPhone, phoneNumber: phoneNumber || null }
        : inputWithoutPhone,
    };

    let result;
    try {
      result = await runMutationWithRetry({
        appUrl,
        accessToken,
        refreshToken,
        mutation,
        variables,
      });
    } catch (err) {
      const msg = String(err?.message || "");
      // Some storefront/customer schemas do not allow phone updates. Fallback to name-only.
      const canFallback =
        hasPhoneInPayload &&
        /phone/i.test(msg) &&
        Object.keys(inputWithoutPhone).length > 0;
      if (!canFallback) throw err;

      mutation = UPDATE_CUSTOMER_MUTATION_NO_PHONE;
      variables = { input: inputWithoutPhone };
      result = await runMutationWithRetry({
        appUrl,
        accessToken,
        refreshToken,
        mutation,
        variables,
      });
    }

    if (!result) {
      return NextResponse.json({ ok: false, error: "Failed to update profile." }, { status: 500 });
    }
    const data = result.data;
    const usedRefresh = result.refreshed || refreshed;

    const userErrors = data?.customerUpdate?.userErrors || [];
    if (userErrors.length) {
      return NextResponse.json({ ok: false, userErrors }, { status: 400 });
    }

    const response = NextResponse.json({
      ok: true,
      customer: data?.customerUpdate?.customer || null,
      userErrors: [],
    });
    return withRefreshedCookies(response, usedRefresh);
  } catch (err) {
    console.error("[shopify/profile:update]", err);
    return NextResponse.json({ ok: false, error: "Failed to update profile." }, { status: 500 });
  }
}
