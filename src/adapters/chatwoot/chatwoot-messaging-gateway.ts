import type {
  MessagingGateway,
  SendMessageRequest
} from "../../ports/messaging-gateway.js";

export interface ChatwootMessagingGatewayOptions {
  baseUrl: string;
}

export class ChatwootMessagingGateway implements MessagingGateway {
  constructor(private readonly options: ChatwootMessagingGatewayOptions) {}

  async sendMessage(request: SendMessageRequest): Promise<void> {
    void request;
    void this.options;
    throw new Error("ChatwootMessagingGateway is not wired yet");
  }
}
