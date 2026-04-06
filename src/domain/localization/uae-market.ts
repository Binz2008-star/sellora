export interface MarketLocaleProfile {
  market: string;
  defaultCurrency: string;
  supportedLocales: string[];
  preferredChannels: string[];
  commonPaymentPolicies: string[];
}

export const uaeMarketProfile: MarketLocaleProfile = {
  market: "UAE",
  defaultCurrency: "AED",
  supportedLocales: ["en-AE", "ar-AE"],
  preferredChannels: ["whatsapp", "instagram", "web_chat"],
  commonPaymentPolicies: ["full-upfront", "deposit-then-balance", "manual-invoice"]
};
