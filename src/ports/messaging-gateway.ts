export interface SendMessageRequest {
  threadId: string;
  channel: string;
  message: string;
}

export interface MessagingGateway {
  sendMessage(request: SendMessageRequest): Promise<void>;
}
