import type { Company, BrowserTab, Thread, Message, Task, EvidenceFragment, NotebookEntry, Draft, BrowserRun, BrowserRunEvent, BrowserContext, SiteProfile, FieldProfile, AutomationRecipe, BrowserAnnotation, BrowserActionButton } from './types';

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

// Browser Orchestration
export interface IpcBrowserRunSummary {
  id: string;
  runType: string;
  mode: string;
  status: string;
  leaderBrowserType: string;
  followerBrowserType: string | null;
  watchEnabled: boolean | null;
  linkedCompanyId: string | null;
  linkedTaskId: string | null;
  targetUrl: string | null;
  startedAt: Date | null;
  createdAt: Date;
  error: string | null;
}

export interface IpcBrowserRun extends BrowserRun {
  leaderContext: BrowserContext | null;
  followerContext: BrowserContext | null;
  events: BrowserRunEvent[];
}

export interface IpcWatchState {
  runId: string;
  status: string;
  currentUrl: string;
  title: string;
  currentAction: string | null;
  screenshotDataUrl: string | null;
  events: BrowserRunEvent[];
}

export interface IpcSiteProfileDetail extends SiteProfile {
  fieldProfiles: FieldProfile[];
  automationRecipes: AutomationRecipe[];
  annotations: BrowserAnnotation[];
  actionButtons: BrowserActionButton[];
}
