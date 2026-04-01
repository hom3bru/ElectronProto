export interface Company {
  id: string;
  name: string;
  domain: string | null;
  hq: string | null;
  country: string | null;
  sector: string | null;
  subsector: string | null;
  status: string | null;
  qualificationScore: number | null;
  confidenceScore: number | null;
  contradictionFlag: boolean | null;
  websiteStatus: string | null;
  leadStage: string | null;
  outreachState: string | null;
  linkedSourceCount: number | null;
  linkedEvidenceCount: number | null;
  lastTouched: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrowserTab {
  id: string;
  sessionPartition: string;
  url: string;
  title: string | null;
  loadingState: boolean | null;
  pinnedFlag: boolean | null;
  linkedCompanyId: string | null;
  linkedInboxItemId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Thread {
  id: string;
  subject: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  providerId: string | null;
  threadId: string | null;
  mailboxId: string | null;
  from: string;
  to: string;
  cc: string | null;
  bcc: string | null;
  subject: string | null;
  snippet: string | null;
  plainTextBody: string | null;
  htmlBody: string | null;
  receivedAt: Date;
  readState: boolean | null;
  labels: any | null;
  routeStatus: string | null;
  trustScore: number | null;
  sourceClassification: string | null;
}

export interface Task {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  escalationReason: string | null;
  recommendedNextAction: string | null;
  owner: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface EvidenceFragment {
  id: string;
  type: string;
  sourceType: string;
  sourceId: string;
  companyId: string | null;
  claimSummary: string;
  quote: string | null;
  url: string | null;
  inboxMessageId: string | null;
  browserTabId: string | null;
  timestamp: Date;
  confidence: number | null;
  contradictionFlag: boolean | null;
  extractedBy: string | null;
  reviewerStatus: string | null;
}

export interface NotebookEntry {
  id: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  entryType: string;
  message: string;
  actorType: string | null;
  actorName: string | null;
  metadataJson: any | null;
  createdAt: Date;
}

export interface Draft {
  id: string;
  companyId: string | null;
  contactId: string | null;
  subject: string | null;
  body: string | null;
  status: string;
  approvalStatus: string | null;
  blockedReason: string | null;
  linkedInboxThreadId: string | null;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
}
