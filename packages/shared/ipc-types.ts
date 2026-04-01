import type { Company, BrowserTab, Thread, Message, Task, EvidenceFragment, NotebookEntry, Draft } from './types';

export interface IpcLabel { id: string; name: string; color: string | null; createdAt: Date; }
export interface IpcContact { id: string; companyId: string | null; name: string; email: string | null; role: string | null; createdAt: Date; }
export interface IpcSourceProfile { id: string; companyId: string | null; contactId: string | null; platform: string; url: string; handle: string | null; scrapedData: any; lastScrapedAt: Date | null; }

// Browser
export interface IpcBrowserTab extends BrowserTab {}
export interface IpcTabContext {
  tab: IpcBrowserTab;
  linkedCompany: Company | null;
  recentEvidence: EvidenceFragment[];
  recentTasks: Task[];
}

// Inbox
export interface IpcThreadSummary {
  id: string; 
  subject: string | null; 
  status: string | null;
  messageCount: number; 
  unreadCount: number;
  latestMessageFrom: string | null; 
  latestMessageAt: Date | null;
  labels: IpcLabel[];
}
export interface IpcMessageWithLabels extends Message {
  labelIds: string[];
}
export interface IpcThreadMessages {
  thread: { id: string; subject: string | null; status: string | null };
  messages: IpcMessageWithLabels[];
}
export interface IpcThreadContext {
  thread: { id: string; subject: string | null };
  linkedCompanies: Company[];
  drafts: Draft[];
}

// CRM
export interface IpcCompanySummary extends Company {}
export interface IpcCompanyDetail extends Company {
  contacts: IpcContact[];
  sourceProfiles: IpcSourceProfile[];
}
export interface IpcCompanyLinks {
  messages: Message[];
  evidence: EvidenceFragment[];
  tasks: Task[];
  drafts: Draft[];
  browserTabs: BrowserTab[];
}
