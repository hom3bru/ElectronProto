import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  browser: {
    createTab: (partition: string, url: string) => ipcRenderer.invoke('browser:createTab', { partition, url }),
    switchTab: (id: string) => ipcRenderer.invoke('browser:switchTab', id),
    closeTab: (id: string) => ipcRenderer.invoke('browser:closeTab', id),
    setBounds: (bounds: any) => ipcRenderer.invoke('browser:setBounds', bounds),
    navigate: (id: string, url: string) => ipcRenderer.invoke('browser:navigate', { id, url }),
    goBack: (id: string) => ipcRenderer.invoke('browser:goBack', id),
    goForward: (id: string) => ipcRenderer.invoke('browser:goForward', id),
    reload: (id: string) => ipcRenderer.invoke('browser:reload', id),
    getState: () => ipcRenderer.invoke('browser:getState'),
    getTabContext: (tabId: string) => ipcRenderer.invoke('browser:getTabContext', tabId),
    onStateUpdated: (callback: (state: any) => void) => {
      const listener = (e: any, state: any) => callback(state);
      ipcRenderer.on('browser:stateUpdated', listener);
      return () => ipcRenderer.removeListener('browser:stateUpdated', listener);
    },
  },

  inbox: {
    // Queries
    sync: () => ipcRenderer.invoke('inbox:sync'),
    getSyncStatus: () => ipcRenderer.invoke('inbox:getSyncStatus'),
    getAccounts: () => ipcRenderer.invoke('inbox:getAccounts'),
    getThreads: (archived?: boolean) => ipcRenderer.invoke('inbox:getThreads', archived),
    search: (query: string) => ipcRenderer.invoke('inbox:search', query),
    getThreadContext: (threadId: string) => ipcRenderer.invoke('inbox:getThreadContext', threadId),
    getMessage: (messageId: string) => ipcRenderer.invoke('inbox:getMessage', messageId),
    getMessageLabels: () => ipcRenderer.invoke('inbox:getMessageLabels'),
    getLabels: () => ipcRenderer.invoke('inbox:getLabels'),

    // Commands
    createEvidenceFromMessage: (messageId: string, claimSummary?: string, quote?: string) =>
      ipcRenderer.invoke('inbox:createEvidenceFromMessage', { messageId, claimSummary, quote }),
    createEvidenceFromBrowserTab: (tabId: string, url: string, title?: string) =>
      ipcRenderer.invoke('inbox:createEvidenceFromBrowserTab', { tabId, url, title }),
    escalateMessage: (messageId: string, reason?: string) =>
      ipcRenderer.invoke('inbox:escalateMessage', { messageId, reason }),
    quarantineMessage: (messageId: string, reason?: string) =>
      ipcRenderer.invoke('inbox:quarantineMessage', { messageId, reason }),
    markThreadRead: (threadId: string) => ipcRenderer.invoke('inbox:markThreadRead', threadId),
    archiveThread: (threadId: string) => ipcRenderer.invoke('inbox:archiveThread', threadId),
    markMessageRead: (messageId: string) => ipcRenderer.invoke('inbox:markMessageRead', messageId),
    archiveMessage: (messageId: string) => ipcRenderer.invoke('inbox:archiveMessage', messageId),
    markMessageIgnored: (messageId: string) => ipcRenderer.invoke('inbox:markMessageIgnored', messageId),
    createLabel: (name: string, color?: string) => ipcRenderer.invoke('inbox:createLabel', { name, color }),
    addLabelToMessage: (messageId: string, labelId: string) =>
      ipcRenderer.invoke('inbox:addLabelToMessage', { messageId, labelId }),
    removeLabelFromMessage: (messageId: string, labelId: string) =>
      ipcRenderer.invoke('inbox:removeLabelFromMessage', { messageId, labelId }),
  },

  crm: {
    // Queries
    getCompanies: () => ipcRenderer.invoke('crm:getCompanies'),
    getCompanyDetail: (companyId: string) => ipcRenderer.invoke('crm:getCompanyDetail', companyId),
    getCompanyLinks: (companyId: string) => ipcRenderer.invoke('crm:getCompanyLinks', companyId),
    getContacts: (companyId: string) => ipcRenderer.invoke('crm:getContacts', companyId),

    // Commands
    createCompanyFromMessage: (messageId: string) =>
      ipcRenderer.invoke('crm:createCompanyFromMessage', messageId),
    createContact: (opt: { companyId: string; name: string; email?: string; role?: string }) =>
      ipcRenderer.invoke('crm:createContact', opt),
    updateCompany: (companyId: string, patch: Record<string, any>) =>
      ipcRenderer.invoke('crm:updateCompany', { companyId, patch }),
    linkMessageToCompany: (messageId: string, companyId: string) =>
      ipcRenderer.invoke('crm:linkMessageToCompany', { messageId, companyId }),
    linkBrowserTabToCompany: (tabId: string, companyId?: string | null, url?: string) =>
      ipcRenderer.invoke('crm:linkBrowserTabToCompany', { tabId, companyId, url }),
  },

  link: {
    create: (opt: { sourceType: string; sourceId: string; targetType: string; targetId: string; linkType: string; metadata?: any }) =>
      ipcRenderer.invoke('link:create', opt),
    remove: (linkId: string) => ipcRenderer.invoke('link:remove', linkId),
    getForEntity: (type: string, id: string) => ipcRenderer.invoke('link:getForEntity', { type, id }),
  },

  tasks: {
    // Queries
    getTasks: () => ipcRenderer.invoke('tasks:getTasks'),
    getTask: (taskId: string) => ipcRenderer.invoke('tasks:getTask', taskId),

    // Commands
    createTask: (opt: any) => ipcRenderer.invoke('tasks:createTask', opt),
    updateTaskStatus: (taskId: string, status: string) =>
      ipcRenderer.invoke('tasks:updateTaskStatus', { taskId, status }),
    updateTaskWorkflow: (taskId: string, update: any) =>
      ipcRenderer.invoke('tasks:updateTaskWorkflow', { taskId, update }),
    appendNotebookEntryFromBrowserTab: (tabId: string, message: string) =>
      ipcRenderer.invoke('tasks:appendNotebookEntryFromBrowserTab', { tabId, message }),
  },

  evidence: {
    // Queries
    getFragments: (filters?: Record<string, any>) =>
      ipcRenderer.invoke('evidence:getFragments', filters),
    getFragment: (fragmentId: string) =>
      ipcRenderer.invoke('evidence:getFragment', fragmentId),
    getPendingReview: () =>
      ipcRenderer.invoke('evidence:getPendingReview'),
    getContradicted: () =>
      ipcRenderer.invoke('evidence:getContradicted'),

    // Creation
    createFragment: (
      claimSummary: string, sourceType: string, sourceId: string,
      opts?: Record<string, any>,
    ) => ipcRenderer.invoke('evidence:createFragment', { claimSummary, sourceType, sourceId, opts }),

    // Lifecycle commands
    review: (fragmentId: string, status: string) =>
      ipcRenderer.invoke('evidence:review', { fragmentId, status }),
    setContradiction: (fragmentId: string, contradicts: boolean, reason?: string) =>
      ipcRenderer.invoke('evidence:setContradiction', { fragmentId, contradicts, reason }),
    updateConfidence: (fragmentId: string, confidence: number) =>
      ipcRenderer.invoke('evidence:updateConfidence', { fragmentId, confidence }),
    updateClaim: (fragmentId: string, claimSummary: string) =>
      ipcRenderer.invoke('evidence:updateClaim', { fragmentId, claimSummary }),
    deleteFragment: (fragmentId: string) =>
      ipcRenderer.invoke('evidence:delete', fragmentId),

    // Links
    linkToCompany: (evidenceId: string, companyId: string) =>
      ipcRenderer.invoke('evidence:linkToCompany', { evidenceId, companyId }),
    unlinkFromCompany: (evidenceId: string, companyId: string) =>
      ipcRenderer.invoke('evidence:unlinkFromCompany', { evidenceId, companyId }),
  },


  notebook: {
    getEntries: (filters?: any) => ipcRenderer.invoke('notebook:getEntries', filters),
  },

  outreach: {
    // Queries
    getDrafts: () => ipcRenderer.invoke('outreach:getDrafts'),
    getDraft: (draftId: string) => ipcRenderer.invoke('outreach:getDraft', draftId),

    // Commands
    sendDraft: (draftId: string) => ipcRenderer.invoke('outreach:sendDraft', draftId),
    createDraftFromThread: (threadId: string, subject?: string, body?: string) =>
      ipcRenderer.invoke('outreach:createDraftFromThread', { threadId, subject, body }),
    createDraftFromCompany: (companyId: string, subject?: string, body?: string) =>
      ipcRenderer.invoke('outreach:createDraftFromCompany', { companyId, subject, body }),
    updateDraft: (draftId: string, subject: string, body: string) =>
      ipcRenderer.invoke('outreach:updateDraft', { draftId, subject, body }),
    approveDraft: (draftId: string) => ipcRenderer.invoke('outreach:approveDraft', draftId),
    blockDraft: (draftId: string, reason: string) =>
      ipcRenderer.invoke('outreach:blockDraft', { draftId, reason }),
    retractDraft: (draftId: string) => ipcRenderer.invoke('outreach:retractDraft', draftId),
    submitDraftForReview: (draftId: string) =>
      ipcRenderer.invoke('outreach:submitDraftForReview', draftId),
    resolveDraftBlocker: (draftId: string, resolution: string) =>
      ipcRenderer.invoke('outreach:resolveDraftBlocker', { draftId, resolution }),
  },

  audit: {
    /** Returns all notebook entries for an entity — the agent's own action replay log. */
    getCommandLog: (entityId: string) => ipcRenderer.invoke('audit:getCommandLog', entityId),
  },

  browserRun: {
    create: (input: any) => ipcRenderer.invoke('browserRun:create', input),
    start: (input: any) => ipcRenderer.invoke('browserRun:start', input),
    stop: (runId: string) => ipcRenderer.invoke('browserRun:stop', runId),
    list: () => ipcRenderer.invoke('browserRun:list'),
    get: (runId: string) => ipcRenderer.invoke('browserRun:get', runId),
    enableWatch: (runId: string) => ipcRenderer.invoke('browserRun:enableWatch', runId),
    disableWatch: (runId: string) => ipcRenderer.invoke('browserRun:disableWatch', runId),
    watchSnapshot: (runId: string) => ipcRenderer.invoke('browserRun:watchSnapshot', runId),
    setMode: (runId: string, mode: string) => ipcRenderer.invoke('browserRun:setMode', runId, mode),
    navigate: (runId: string, url: string) => ipcRenderer.invoke('browserRun:navigate', runId, url),
    onWatchUpdate: (callback: (state: any) => void) => {
      const listener = (_e: any, state: any) => callback(state);
      ipcRenderer.on('browserRun:watchUpdate', listener);
      return () => ipcRenderer.removeListener('browserRun:watchUpdate', listener);
    },
  },

  training: {
    approveSite: (domain: string, notes?: string) =>
      ipcRenderer.invoke('training:approveSite', domain, notes),
    createSiteProfile: (input: any) =>
      ipcRenderer.invoke('training:createSiteProfile', input),
    updateSiteProfile: (id: string, patch: any) =>
      ipcRenderer.invoke('training:updateSiteProfile', id, patch),
    createFieldProfile: (input: any) =>
      ipcRenderer.invoke('training:createFieldProfile', input),
    updateFieldKeywordRules: (id: string, rules: any) =>
      ipcRenderer.invoke('training:updateFieldKeywordRules', id, rules),
    updateFieldSelectorRules: (id: string, rules: any) =>
      ipcRenderer.invoke('training:updateFieldSelectorRules', id, rules),
    createAutomationRecipe: (input: any) =>
      ipcRenderer.invoke('training:createAutomationRecipe', input),
    updateAutomationRecipe: (id: string, patch: any) =>
      ipcRenderer.invoke('training:updateAutomationRecipe', id, patch),
    createAnnotation: (input: any) =>
      ipcRenderer.invoke('training:createAnnotation', input),
    createActionButton: (input: any) =>
      ipcRenderer.invoke('training:createActionButton', input),
    getSiteProfileForUrl: (url: string) =>
      ipcRenderer.invoke('training:getSiteProfileForUrl', url),
  },

  siteProfile: {
    list: () => ipcRenderer.invoke('siteProfile:list'),
    get: (id: string) => ipcRenderer.invoke('siteProfile:get', id),
    getByDomain: (domain: string) => ipcRenderer.invoke('siteProfile:getByDomain', domain),
  },
});
