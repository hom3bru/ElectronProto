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
    onTabUpdated: (callback: (data: any) => void) => {
      ipcRenderer.on('tab-updated', (e, data) => callback(data));
    },
  },
  db: {
    getTabs: () => ipcRenderer.invoke('db:getTabs'),
    getCompanies: () => ipcRenderer.invoke('db:getCompanies'),
    getInboxItems: () => ipcRenderer.invoke('db:getInboxItems'),
    getTasks: () => ipcRenderer.invoke('db:getTasks'),
    getEvidence: () => ipcRenderer.invoke('db:getEvidence'),
    getNotebook: () => ipcRenderer.invoke('db:getNotebook'),
    getDrafts: () => ipcRenderer.invoke('db:getDrafts'),
  },
  cmd: {
    createCompany: (data: any) => ipcRenderer.invoke('cmd:createCompany', data),
    createTask: (data: any) => ipcRenderer.invoke('cmd:createTask', data),
    createEvidence: (data: any) => ipcRenderer.invoke('cmd:createEvidence', data),
  }
});
