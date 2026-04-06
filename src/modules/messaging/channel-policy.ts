import type { ConversationChannel } from "../../domain/messaging/conversation.js";
import { uaeMarketProfile } from "../../domain/localization/uae-market.js";

export function getPreferredChannels(): ConversationChannel[] {
  return uaeMarketProfile.preferredChannels as ConversationChannel[];
}

export function isPrimarySocialCommerceChannel(channel: ConversationChannel): boolean {
  return getPreferredChannels().includes(channel);
}
