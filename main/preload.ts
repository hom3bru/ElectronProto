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
    onTabUpdated: (callback: (data: any) => void) => {
      const listener = (e: any, data: any) => callback(data);
      ipcRenderer.on('tab-updated', listener);
      return () => ipcRenderer.removeListener('tab-updated', listener);
    },
  },
  cmd: {
    execute: (commandName: string, payload: any) => ipcRenderer.invoke('cmd:execute', { commandName, payload }),
  },
  db: {
    query: (model: string, action: string, args: any) => ipcRenderer.invoke('db:query', { model, action, args }),
  }
});
