export interface MailProvider {
  id: string;
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  fetchMessages(since?: Date): Promise<any[]>;
  sendDraft(draftId: string): Promise<void>;
}
