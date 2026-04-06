import type { AppConfig } from "../../core/config.js";
import { KarrioShippingGateway } from "../../adapters/karrio/karrio-shipping-gateway.js";
import type { ShippingGateway } from "../../ports/shipping-gateway.js";

export function createShippingGateway(
  config: Pick<
    AppConfig,
    | "KARRIO_BASE_URL"
    | "KARRIO_API_KEY"
    | "KARRIO_PROVIDER_NAME"
    | "KARRIO_CARRIER_ID"
    | "KARRIO_SERVICE"
    | "KARRIO_SHIPPER_POSTAL_CODE"
    | "KARRIO_SHIPPER_COUNTRY_CODE"
    | "KARRIO_SHIPPER_CITY"
    | "KARRIO_SHIPPER_STATE_CODE"
    | "KARRIO_SHIPPER_ADDRESS_LINE1"
    | "KARRIO_SHIPPER_ADDRESS_LINE2"
    | "KARRIO_SHIPPER_COMPANY_NAME"
    | "KARRIO_SHIPPER_PERSON_NAME"
    | "KARRIO_SHIPPER_PHONE_NUMBER"
    | "KARRIO_SHIPPER_EMAIL"
    | "KARRIO_RECIPIENT_POSTAL_CODE"
    | "KARRIO_RECIPIENT_COUNTRY_CODE"
    | "KARRIO_RECIPIENT_CITY"
    | "KARRIO_RECIPIENT_STATE_CODE"
    | "KARRIO_RECIPIENT_ADDRESS_LINE1"
    | "KARRIO_RECIPIENT_ADDRESS_LINE2"
    | "KARRIO_RECIPIENT_COMPANY_NAME"
    | "KARRIO_RECIPIENT_PERSON_NAME"
    | "KARRIO_RECIPIENT_PHONE_NUMBER"
    | "KARRIO_RECIPIENT_EMAIL"
    | "KARRIO_PARCEL_WEIGHT"
    | "KARRIO_PARCEL_WEIGHT_UNIT"
    | "KARRIO_PARCEL_LENGTH"
    | "KARRIO_PARCEL_WIDTH"
    | "KARRIO_PARCEL_HEIGHT"
    | "KARRIO_PARCEL_DISTANCE_UNIT"
  >,
  options: {
    fetchFn?: typeof fetch;
  } = {}
): ShippingGateway {
  if (
    !config.KARRIO_BASE_URL ||
    !config.KARRIO_API_KEY ||
    !config.KARRIO_SHIPPER_POSTAL_CODE ||
    !config.KARRIO_SHIPPER_COUNTRY_CODE ||
    !config.KARRIO_RECIPIENT_POSTAL_CODE ||
    !config.KARRIO_RECIPIENT_COUNTRY_CODE ||
    config.KARRIO_PARCEL_WEIGHT === undefined ||
    !config.KARRIO_PARCEL_WEIGHT_UNIT
  ) {
    throw new Error("Karrio shipping gateway requires complete production configuration");
  }

  return new KarrioShippingGateway({
    baseUrl: config.KARRIO_BASE_URL,
    apiKey: config.KARRIO_API_KEY,
    providerName: config.KARRIO_PROVIDER_NAME,
    carrierId: config.KARRIO_CARRIER_ID,
    service: config.KARRIO_SERVICE,
    shipperAddress: {
      postalCode: config.KARRIO_SHIPPER_POSTAL_CODE,
      countryCode: config.KARRIO_SHIPPER_COUNTRY_CODE,
      city: config.KARRIO_SHIPPER_CITY,
      stateCode: config.KARRIO_SHIPPER_STATE_CODE,
      addressLine1: config.KARRIO_SHIPPER_ADDRESS_LINE1,
      addressLine2: config.KARRIO_SHIPPER_ADDRESS_LINE2,
      companyName: config.KARRIO_SHIPPER_COMPANY_NAME,
      personName: config.KARRIO_SHIPPER_PERSON_NAME,
      phoneNumber: config.KARRIO_SHIPPER_PHONE_NUMBER,
      email: config.KARRIO_SHIPPER_EMAIL
    },
    recipientDefaults: {
      postalCode: config.KARRIO_RECIPIENT_POSTAL_CODE,
      countryCode: config.KARRIO_RECIPIENT_COUNTRY_CODE,
      city: config.KARRIO_RECIPIENT_CITY,
      stateCode: config.KARRIO_RECIPIENT_STATE_CODE,
      addressLine1: config.KARRIO_RECIPIENT_ADDRESS_LINE1,
      addressLine2: config.KARRIO_RECIPIENT_ADDRESS_LINE2,
      companyName: config.KARRIO_RECIPIENT_COMPANY_NAME,
      personName: config.KARRIO_RECIPIENT_PERSON_NAME,
      phoneNumber: config.KARRIO_RECIPIENT_PHONE_NUMBER,
      email: config.KARRIO_RECIPIENT_EMAIL
    },
    parcelTemplate: {
      weight: config.KARRIO_PARCEL_WEIGHT,
      weightUnit: config.KARRIO_PARCEL_WEIGHT_UNIT,
      length: config.KARRIO_PARCEL_LENGTH,
      width: config.KARRIO_PARCEL_WIDTH,
      height: config.KARRIO_PARCEL_HEIGHT,
      distanceUnit: config.KARRIO_PARCEL_DISTANCE_UNIT
    },
    fetchFn: options.fetchFn
  });
}
