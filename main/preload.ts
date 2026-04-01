import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  browser: {
    createTab: (partition: string, url: string) => ipcRenderer.invoke('browser:createTab', { partition, url }),
    restoreTab: (id: string, partition: string, url: string) => ipcRenderer.invoke('browser:restoreTab', { id, partition, url }),
    switchTab: (id: string) => ipcRenderer.invoke('browser:switchTab', id),
    closeTab: (id: string) => ipcRenderer.invoke('browser:closeTab', id),
    updateTabOrder: (tabIds: string[]) => ipcRenderer.invoke('browser:updateTabOrder', tabIds),
    setBounds: (bounds: any) => ipcRenderer.invoke('browser:setBounds', bounds),
    navigate: (id: string, url: string) => ipcRenderer.invoke('browser:navigate', { id, url }),
    goBack: (id: string) => ipcRenderer.invoke('browser:goBack', id),
    goForward: (id: string) => ipcRenderer.invoke('browser:goForward', id),
    reload: (id: string) => ipcRenderer.invoke('browser:reload', id),
    getTabs: () => ipcRenderer.invoke('browser:getTabs'),
    getActiveTab: () => ipcRenderer.invoke('browser:getActiveTab'),
    getTabContext: (tabId: string) => ipcRenderer.invoke('browser:getTabContext', tabId),
    onTabUpdated: (callback: (data: any) => void) => {
      const listener = (e: any, data: any) => callback(data);
      ipcRenderer.on('tab-updated', listener);
      return () => ipcRenderer.removeListener('tab-updated', listener);
    },
  },
  cmd: {
    execute: (commandName: string, payload: any) => ipcRenderer.invoke('cmd:execute', { commandName, payload }),
  },
  inbox: {
    getThreads: (archived?: boolean) => ipcRenderer.invoke('inbox:getThreads', archived),
    getThreadMessages: (threadId: string) => ipcRenderer.invoke('inbox:getThreadMessages', threadId),
    getThreadContext: (threadId: string) => ipcRenderer.invoke('inbox:getThreadContext', threadId),
    getMessageLabels: () => ipcRenderer.invoke('inbox:getMessageLabels'),
    getLabels: () => ipcRenderer.invoke('inbox:getLabels'),
  },
  crm: {
    getCompanies: () => ipcRenderer.invoke('crm:getCompanies'),
    getCompanyDetail: (companyId: string) => ipcRenderer.invoke('crm:getCompanyDetail', companyId),
    getCompanyLinks: (companyId: string) => ipcRenderer.invoke('crm:getCompanyLinks', companyId),
  },
  evidence: {
    getFragments: () => ipcRenderer.invoke('evidence:getFragments'),
  },
  tasks: {
    getTasks: () => ipcRenderer.invoke('tasks:getTasks'),
  },
  notebook: {
    getEntries: () => ipcRenderer.invoke('notebook:getEntries'),
  },
  outreach: {
    getDrafts: () => ipcRenderer.invoke('outreach:getDrafts'),
  }
});
