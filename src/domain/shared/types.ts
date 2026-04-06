export type EntityId = string;
export type ISODateString = string;

export type CurrencyCode = "AED" | "USD" | "SAR" | "EUR" | string;

export interface AuditStamp {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export interface JsonArray extends Array<JsonValue> {}

export interface KeyValueRecord extends JsonObject {}
