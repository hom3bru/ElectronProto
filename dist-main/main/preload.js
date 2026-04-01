"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    browser: {
        createTab: (partition, url) => electron_1.ipcRenderer.invoke('browser:createTab', { partition, url }),
        restoreTab: (id, partition, url) => electron_1.ipcRenderer.invoke('browser:restoreTab', { id, partition, url }),
        switchTab: (id) => electron_1.ipcRenderer.invoke('browser:switchTab', id),
        closeTab: (id) => electron_1.ipcRenderer.invoke('browser:closeTab', id),
        updateTabOrder: (tabIds) => electron_1.ipcRenderer.invoke('browser:updateTabOrder', tabIds),
        setBounds: (bounds) => electron_1.ipcRenderer.invoke('browser:setBounds', bounds),
        navigate: (id, url) => electron_1.ipcRenderer.invoke('browser:navigate', { id, url }),
        goBack: (id) => electron_1.ipcRenderer.invoke('browser:goBack', id),
        goForward: (id) => electron_1.ipcRenderer.invoke('browser:goForward', id),
        reload: (id) => electron_1.ipcRenderer.invoke('browser:reload', id),
        getTabs: () => electron_1.ipcRenderer.invoke('browser:getTabs'),
        getActiveTab: () => electron_1.ipcRenderer.invoke('browser:getActiveTab'),
        getTabContext: (tabId) => electron_1.ipcRenderer.invoke('browser:getTabContext', tabId),
        onTabUpdated: (callback) => {
            const listener = (e, data) => callback(data);
            electron_1.ipcRenderer.on('tab-updated', listener);
            return () => electron_1.ipcRenderer.removeListener('tab-updated', listener);
        },
    },
    cmd: {
        execute: (commandName, payload) => electron_1.ipcRenderer.invoke('cmd:execute', { commandName, payload }),
    },
    inbox: {
        getThreads: (archived) => electron_1.ipcRenderer.invoke('inbox:getThreads', archived),
        getThreadMessages: (threadId) => electron_1.ipcRenderer.invoke('inbox:getThreadMessages', threadId),
        getThreadContext: (threadId) => electron_1.ipcRenderer.invoke('inbox:getThreadContext', threadId),
        getLabels: () => electron_1.ipcRenderer.invoke('inbox:getLabels'),
    },
    crm: {
        getCompanies: () => electron_1.ipcRenderer.invoke('crm:getCompanies'),
        getCompanyDetail: (companyId) => electron_1.ipcRenderer.invoke('crm:getCompanyDetail', companyId),
        getCompanyLinks: (companyId) => electron_1.ipcRenderer.invoke('crm:getCompanyLinks', companyId),
    },
    evidence: {
        getEvidenceList: () => electron_1.ipcRenderer.invoke('evidence:getEvidenceList'),
        getEvidenceDetail: (id) => electron_1.ipcRenderer.invoke('evidence:getEvidenceDetail', id),
    },
    tasks: {
        getTasks: () => electron_1.ipcRenderer.invoke('tasks:getTasks'),
        getTaskDetail: (id) => electron_1.ipcRenderer.invoke('tasks:getTaskDetail', id),
    },
    notebook: {
        getEntries: (entityType) => electron_1.ipcRenderer.invoke('notebook:getEntries', entityType),
    },
    outreach: {
        getDrafts: () => electron_1.ipcRenderer.invoke('outreach:getDrafts'),
    },
    db: {
        query: (model, action, args) => electron_1.ipcRenderer.invoke('db:query', { model, action, args }),
    }
});
