export interface Mailbox {
  providerId: string;
  name: string;
}

export interface SyncDelta {
  lastHistoryId: string;
  addedMessages: RemoteMessage[];
  removedMessageIds: string[];
  addedMailboxes: Mailbox[];
}

export interface RemoteMessage {
  providerId: string;
  mailboxProviderIds: string[];
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  snippet: string;
  plainTextBody: string;
  htmlBody?: string;
  receivedAt: Date;
  readState: boolean;
  remoteMessageId: string; // Message-ID header (e.g., <msg123@domain>)
  inReplyTo?: string; // In-Reply-To header
  referencesHeader?: string; // References header
}

export interface MailProvider {
  /** Init credentials or OAuth keys */
  initialize(credentialsJSON: string): Promise<void>;
  
  /** Fetch a differential delta from a given checkpoint (or null for initial sync) */
  syncDelta(sinceHistoryId: string | null): Promise<SyncDelta>;
  
  /** Dispatch a new message */
  sendDraft(params: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string;
  }): Promise<{ success: boolean; error?: string; providerId?: string }>;
  
  /** Modify Labels/Mailboxes on the remote server (e.g. archiving) */
  modifyLabels(providerMessageId: string, addMailboxIds: string[], removeMailboxIds: string[]): Promise<void>;
}
