import type { KeyValueRecord } from "../../domain/shared/types.js";
import type {
  ShipmentBookingRequest,
  ShipmentBookingResult,
  ShipmentStatusRequest,
  ShipmentStatusResult,
  ShippingGateway
} from "../../ports/shipping-gateway.js";

export interface KarrioAddressConfig {
  city?: string;
  stateCode?: string;
  postalCode: string;
  countryCode: string;
  addressLine1?: string;
  addressLine2?: string;
  companyName?: string;
  personName?: string;
  phoneNumber?: string;
  email?: string;
}

export interface KarrioParcelConfig {
  length?: number;
  width?: number;
  height?: number;
  distanceUnit?: string;
  weight: number;
  weightUnit: string;
}

export interface KarrioShippingGatewayOptions {
  baseUrl: string;
  apiKey: string;
  providerName?: string;
  carrierId?: string;
  service?: string;
  shipperAddress: KarrioAddressConfig;
  recipientDefaults: Omit<KarrioAddressConfig, "city"> & { city?: string };
  parcelTemplate: KarrioParcelConfig;
  fetchFn?: typeof fetch;
}

type KarrioShipmentResponse = {
  id?: string;
  shipment_id?: string;
  tracking_number?: string;
  tracking_url?: string;
  label_url?: string;
  carrier_name?: string;
  provider?: string;
  status?: string;
  updated_at?: string;
  messages?: Array<{
    code?: string;
    message?: string;
  }>;
  error?: {
    code?: string;
    message?: string;
  };
};

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toAddressPayload(address: KarrioAddressConfig) {
  return {
    city: address.city,
    state_code: address.stateCode,
    postal_code: address.postalCode,
    country_code: address.countryCode,
    address_line1: address.addressLine1,
    address_line2: address.addressLine2,
    company_name: address.companyName,
    person_name: address.personName,
    phone_number: address.phoneNumber,
    email: address.email
  };
}

function toParcelPayload(parcel: KarrioParcelConfig) {
  return {
    length: parcel.length,
    width: parcel.width,
    height: parcel.height,
    distance_unit: parcel.distanceUnit,
    weight: parcel.weight,
    weight_unit: parcel.weightUnit
  };
}

function extractPayloadObject(payload: unknown): KeyValueRecord {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as KeyValueRecord;
  }

  return {
    value: payload === undefined ? null : JSON.stringify(payload)
  };
}

function normalizeFailure(
  provider: string,
  payload: unknown,
  fallbackMessage: string
): ShipmentBookingResult {
  const rawPayload = extractPayloadObject(payload);
  const objectPayload = payload as KarrioShipmentResponse | undefined;
  const firstMessage = objectPayload?.messages?.[0];

  return {
    success: false,
    provider,
    rawPayload,
    failureCode: objectPayload?.error?.code ?? firstMessage?.code,
    failureMessage: objectPayload?.error?.message ?? firstMessage?.message ?? fallbackMessage
  };
}

function normalizeSuccess(
  provider: string,
  payload: unknown,
  fallbackProviderName?: string
): ShipmentBookingResult {
  const rawPayload = extractPayloadObject(payload);
  const shipment = payload as KarrioShipmentResponse;
  const providerReference = shipment.id ?? shipment.shipment_id;
  const trackingUrl = shipment.tracking_url ?? shipment.label_url;
  const courierName = shipment.carrier_name ?? shipment.provider ?? fallbackProviderName ?? provider;

  if (!providerReference && !shipment.tracking_number) {
    return normalizeFailure(provider, payload, "Karrio response missing shipment identifiers");
  }

  return {
    success: true,
    provider,
    providerReference,
    bookingReference: providerReference,
    trackingNumber: shipment.tracking_number,
    trackingUrl,
    courierName,
    rawPayload
  };
}

function normalizeStatusSuccess(
  provider: string,
  payload: unknown,
  fallbackProviderName?: string
): ShipmentStatusResult {
  const rawPayload = extractPayloadObject(payload);
  const tracker = payload as KarrioShipmentResponse;
  const providerReference = tracker.id ?? tracker.shipment_id;
  const trackingUrl = tracker.tracking_url ?? tracker.label_url;
  const courierName = tracker.carrier_name ?? tracker.provider ?? fallbackProviderName ?? provider;
  const normalizedStatus = tracker.status?.toLowerCase();

  if (!normalizedStatus) {
    return {
      success: false,
      provider,
      rawPayload,
      failureMessage: "Karrio status response missing shipment status"
    };
  }

  return {
    success: true,
    provider,
    providerReference,
    trackingNumber: tracker.tracking_number,
    trackingUrl,
    courierName,
    normalizedStatus,
    observedAt: tracker.updated_at,
    rawPayload
  };
}

export class KarrioShippingGateway implements ShippingGateway {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: KarrioShippingGatewayOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async bookShipment(request: ShipmentBookingRequest): Promise<ShipmentBookingResult> {
    const provider = this.options.providerName ?? "karrio";
    const endpoint = `${trimTrailingSlash(this.options.baseUrl)}/v1/shipments`;
    const response = await this.fetchFn(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...(this.options.carrierId ? { carrier_id: this.options.carrierId } : {}),
        ...(this.options.service ? { service: this.options.service } : {}),
        shipper: toAddressPayload(this.options.shipperAddress),
        recipient: toAddressPayload({
          ...this.options.recipientDefaults,
          city: request.destinationCity ?? this.options.recipientDefaults.city
        }),
        parcels: [toParcelPayload(this.options.parcelTemplate)],
        metadata: {
          order_id: request.orderId,
          items: request.items
        }
      })
    });

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      payload = {
        error: {
          message: "Karrio response was not valid JSON"
        }
      };
    }

    if (!response.ok) {
      return normalizeFailure(provider, payload, `Karrio request failed with ${response.status}`);
    }

    const shipmentPayload =
      ((payload as { data?: unknown; shipment?: unknown })?.shipment ??
        (payload as { data?: unknown })?.data ??
        payload) as unknown;

    return normalizeSuccess(provider, shipmentPayload, this.options.providerName);
  }

  async getShipmentStatus(request: ShipmentStatusRequest): Promise<ShipmentStatusResult> {
    const provider = this.options.providerName ?? "karrio";

    if (!request.bookingReference && !request.trackingNumber) {
      return {
        success: false,
        provider,
        failureMessage: "Shipment status lookup requires booking reference or tracking number"
      };
    }

    const reference = request.bookingReference ?? request.trackingNumber!;
    const endpoint = `${trimTrailingSlash(this.options.baseUrl)}/v1/trackers/${encodeURIComponent(reference)}`;
    const response = await this.fetchFn(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Token ${this.options.apiKey}`,
        "Content-Type": "application/json"
      }
    });

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      payload = {
        error: {
          message: "Karrio status response was not valid JSON"
        }
      };
    }

    if (!response.ok) {
      const failure = normalizeFailure(provider, payload, `Karrio status request failed with ${response.status}`);
      return {
        success: false,
        provider,
        rawPayload: failure.rawPayload,
        failureCode: failure.failureCode,
        failureMessage: failure.failureMessage
      };
    }

    const trackerPayload =
      ((payload as { data?: unknown; tracker?: unknown })?.tracker ??
        (payload as { data?: unknown })?.data ??
        payload) as unknown;

    return normalizeStatusSuccess(provider, trackerPayload, this.options.providerName);
  }
}
