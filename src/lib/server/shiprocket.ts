// Shiprocket integration — server side only.
//
// CREDENTIALS (Netlify > Site settings > Environment variables)
//   SHIPROCKET_EMAIL          API user email
//   SHIPROCKET_PASSWORD       API user password
//   SHIPROCKET_PICKUP_LOCATION  nickname of the pickup address configured in
//                               the Shiprocket dashboard (e.g. "Haldharvas")
//   SHIPROCKET_WEBHOOK_TOKEN  shared secret for the status webhook
//
// Shiprocket authenticates with email+password and returns a bearer token that
// is valid for 10 days. We cache it in memory and re-login when it expires.
//
// Nothing in this file is ever reachable from the browser, and no credential is
// returned to any caller.
//
// Docs: https://apidocs.shiprocket.in/

const API = "https://apiv2.shiprocket.in/v1/external";

export type ShiprocketConfig = {
  email: string;
  password: string;
  pickupLocation: string;
  webhookToken?: string;
};

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const value = process.env?.[name];
  return value && value.trim() ? value.trim() : undefined;
}

/** Returns null when shipping has not been configured yet. */
export function shiprocketConfig(): ShiprocketConfig | null {
  const email = env("SHIPROCKET_EMAIL");
  const password = env("SHIPROCKET_PASSWORD");
  if (!email || !password) return null;
  return {
    email,
    password,
    pickupLocation: env("SHIPROCKET_PICKUP_LOCATION") ?? "Primary",
    webhookToken: env("SHIPROCKET_WEBHOOK_TOKEN"),
  };
}

/* ------------------------------------------------------------------ auth -- */

let cachedToken: { token: string; expiresAt: number } | undefined;

async function login(config: ShiprocketConfig): Promise<string> {
  // Re-use the cached token until it is close to expiring.
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });

  if (!response.ok) {
    console.error("[ras/shipping] Shiprocket login failed", response.status);
    throw new Error("Could not reach the shipping provider.");
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) throw new Error("Could not reach the shipping provider.");

  // Token lasts 10 days; refresh after 9 to stay clear of the boundary.
  cachedToken = { token: data.token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
  return data.token;
}

/** Drops the cached token, forcing a fresh login on the next call. */
export function resetShiprocketToken() {
  cachedToken = undefined;
}

async function call<T>(
  config: ShiprocketConfig,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const token = await login(config);

  const response = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  // A stale token shows up as 401 — log in again once and retry.
  if (response.status === 401) {
    resetShiprocketToken();
    const retryToken = await login(config);
    const retry = await fetch(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: { authorization: `Bearer ${retryToken}`, "content-type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    if (!retry.ok) throw await providerError(retry, path);
    return (await retry.json()) as T;
  }

  if (!response.ok) throw await providerError(response, path);
  return (await response.json()) as T;
}

async function providerError(response: Response, path: string): Promise<Error> {
  const detail = await response.text().catch(() => "");
  // Log the provider's words; never surface them to a customer.
  console.error("[ras/shipping] Shiprocket error", path, response.status, detail.slice(0, 400));
  return new Error("The shipping provider could not complete this request.");
}

/* --------------------------------------------------------------- payloads -- */

export type CreateShipmentInput = {
  orderId: string;
  placedAt: string;
  billing: {
    name: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
  };
  items: { name: string; sku: string; units: number; sellingPrice: number }[];
  subtotal: number;
  /** Total parcel weight in KG. Shiprocket requires a positive value. */
  weightKg: number;
  dimensionsCm?: { length: number; breadth: number; height: number };
  paymentMethod: "Prepaid" | "COD";
};

export type CreateShipmentResult = {
  order_id?: number;
  shipment_id?: number;
  status?: string;
  awb_code?: string | null;
  courier_name?: string | null;
};

/** Creates the order inside Shiprocket. This does NOT yet assign a courier. */
export async function createShiprocketOrder(
  config: ShiprocketConfig,
  input: CreateShipmentInput,
): Promise<CreateShipmentResult> {
  return call<CreateShipmentResult>(config, "/orders/create/adhoc", {
    method: "POST",
    body: {
      order_id: input.orderId,
      order_date: input.placedAt.slice(0, 19).replace("T", " "),
      pickup_location: config.pickupLocation,
      billing_customer_name: input.billing.name,
      billing_last_name: "",
      billing_address: input.billing.address,
      billing_address_2: input.billing.address2 ?? "",
      billing_city: input.billing.city,
      billing_pincode: input.billing.pincode,
      billing_state: input.billing.state,
      billing_country: "India",
      billing_email: input.billing.email,
      billing_phone: input.billing.phone,
      shipping_is_billing: true,
      order_items: input.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.units,
        selling_price: item.sellingPrice,
      })),
      payment_method: input.paymentMethod,
      sub_total: input.subtotal,
      length: input.dimensionsCm?.length ?? 10,
      breadth: input.dimensionsCm?.breadth ?? 10,
      height: input.dimensionsCm?.height ?? 5,
      weight: input.weightKg,
    },
  });
}

export type AwbResult = {
  awb_assign_status?: number;
  response?: {
    data?: {
      awb_code?: string;
      courier_name?: string;
      shipment_id?: number;
      expected_delivery_date?: string;
    };
  };
};

/** Assigns a courier and returns the AWB (tracking number). */
export async function assignAwb(config: ShiprocketConfig, shipmentId: number): Promise<AwbResult> {
  return call<AwbResult>(config, "/courier/assign/awb", {
    method: "POST",
    body: { shipment_id: shipmentId },
  });
}

export type LabelResult = { label_created?: number; label_url?: string };

export async function generateLabel(
  config: ShiprocketConfig,
  shipmentId: number,
): Promise<LabelResult> {
  return call<LabelResult>(config, "/courier/generate/label", {
    method: "POST",
    body: { shipment_id: [shipmentId] },
  });
}

export type PickupResult = {
  pickup_status?: number;
  response?: { pickup_scheduled_date?: string };
};

export async function requestPickup(
  config: ShiprocketConfig,
  shipmentId: number,
): Promise<PickupResult> {
  return call<PickupResult>(config, "/courier/generate/pickup", {
    method: "POST",
    body: { shipment_id: [shipmentId] },
  });
}

export type TrackingResult = {
  tracking_data?: {
    track_status?: number;
    shipment_status?: number;
    shipment_track?: {
      current_status?: string;
      courier_name?: string;
      edd?: string;
      delivered_date?: string;
    }[];
    shipment_track_activities?: {
      date?: string;
      status?: string;
      activity?: string;
      location?: string;
    }[];
    track_url?: string;
  };
};

/** Live tracking for one AWB, straight from the courier. */
export async function trackByAwb(config: ShiprocketConfig, awb: string): Promise<TrackingResult> {
  return call<TrackingResult>(config, `/courier/track/awb/${encodeURIComponent(awb)}`);
}

export async function cancelShipment(config: ShiprocketConfig, awbs: string[]): Promise<unknown> {
  return call(config, "/orders/cancel/shipment/awbs", { method: "POST", body: { awbs } });
}
