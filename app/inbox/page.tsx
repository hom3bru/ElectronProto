'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Message, Thread } from '@/packages/shared/types';
import { format } from 'date-fns';
import { Mail, Reply, Archive, Tag, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function InboxPage() {
  const [threads, setThreads] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [linkedCompanies, setLinkedCompanies] = useState<any[]>([]);
  const [linkedEvidence, setLinkedEvidence] = useState<any[]>([]);
  const [threadDrafts, setThreadDrafts] = useState<any[]>([]);
  const [allLabels, setAllLabels] = useState<any[]>([]);
  const [messageLabels, setMessageLabels] = useState<any[]>([]);
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [filter, setFilter] = useState<'active' | 'archived'>('active');
  const [showLabelMenu, setShowLabelMenu] = useState<string | null>(null);
  const [showCompanyMenu, setShowCompanyMenu] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState('');

  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  const loadData = useCallback(async () => {
    if (electron) {
      const ths = await electron.db.query('threads', 'findMany', { orderBy: { updatedAt: 'desc' } });
      const msgs = await electron.db.query('messages', 'findMany', { orderBy: { receivedAt: 'asc' } });
      const lbls = await electron.db.query('labels', 'findMany', {});
      const msgLbls = await electron.db.query('messageLabels', 'findMany', {});
      const comps = await electron.db.query('companies', 'findMany', { orderBy: { name: 'asc' } });
      setThreads(ths);
      setMessages(msgs);
      setAllLabels(lbls);
      setMessageLabels(msgLbls);
      setAllCompanies(comps);
    }
  }, [electron]);

  const loadLinkedData = useCallback(async (threadId: string, threadMessages: Message[]) => {
    if (!electron || threadMessages.length === 0) return;
    const msgIds = threadMessages.map(m => m.id);
    
    // Fetch entity links where sourceId is in msgIds and targetType is 'company'
    const links = await electron.db.query('entityLinks', 'findMany', {
      where: { sourceType: 'message' }
    });
    
    const relevantLinks = links.filter((l: any) => msgIds.includes(l.sourceId) && l.targetType === 'company');
    const companyIds = [...new Set(relevantLinks.map((l: any) => l.targetId))];
    
    const companies = [];
    for (const cid of companyIds) {
      const comp = await electron.db.query('companies', 'findById', { id: cid });
      if (comp) companies.push(comp);
    }
    setLinkedCompanies(companies);

    // Fetch evidence where inboxMessageId is in msgIds
    const evidence = await electron.db.query('evidenceFragments', 'findMany', {});
    const relevantEvidence = evidence.filter((e: any) => msgIds.includes(e.inboxMessageId));
    setLinkedEvidence(relevantEvidence);

    // Fetch drafts for this thread
    const drafts = await electron.db.query('drafts', 'findMany', {
      where: { linkedInboxThreadId: threadId }
    });
    setThreadDrafts(drafts);
  }, [electron]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedThreadId) {
      const threadMsgs = messages.filter(m => m.threadId === selectedThreadId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadLinkedData(selectedThreadId, threadMsgs);
    } else {
      setLinkedCompanies([]);
      setLinkedEvidence([]);
      setThreadDrafts([]);
    }
  }, [selectedThreadId, messages, loadLinkedData]);

  const handleIngest = async () => {
    if (!electron) return;
    setIsIngesting(true);
    await electron.cmd.execute('ingestMail', {});
    await loadData();
    setIsIngesting(false);
  };

  const handleAction = async (command: string, payload: any) => {
    if (!electron) return;
    await electron.cmd.execute(command, payload);
    await loadData();
  };

  const activeThreadMessages = useMemo(() => {
    if (!selectedThreadId) return [];
    return messages.filter(m => m.threadId === selectedThreadId);
  }, [messages, selectedThreadId]);

  const threadList = useMemo(() => {
    return threads
      .filter(t => (filter === 'active' ? t.status !== 'archived' : t.status === 'archived'))
      .map(t => {
        const tMsgs = messages.filter(m => m.threadId === t.id);
        const latestMsg = tMsgs[tMsgs.length - 1];
        const unreadCount = tMsgs.filter(m => !m.readState).length;
        return {
          ...t,
          latestMsg,
          unreadCount
        };
      }).filter(t => t.latestMsg);
  }, [threads, messages, filter]);

  const handleSelectThread = async (threadId: string) => {
    setSelectedThreadId(threadId);
    if (!electron) return;
    // Mark all messages in thread as read
    const unreadMsgs = messages.filter(m => m.threadId === threadId && !m.readState);
    for (const msg of unreadMsgs) {
      await electron.cmd.execute('markMessageRead', { messageId: msg.id });
    }
    if (unreadMsgs.length > 0) {
      await loadData();
    }
  };

  return (
    <div className="flex h-full">
      {/* Thread List */}
      <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-950 shrink-0">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Inbox</h2>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as 'active' | 'archived')}
              className="bg-zinc-900 border border-zinc-800 text-xs rounded px-2 py-1 text-zinc-300"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <button 
            onClick={handleIngest} 
            disabled={isIngesting}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors"
            title="Fetch Mail"
          >
            <RefreshCw className={`w-4 h-4 ${isIngesting ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threadList.map((thread) => (
            <div
              key={thread.id}
              onClick={() => handleSelectThread(thread.id)}
              className={`p-4 border-b border-zinc-800/50 cursor-pointer hover:bg-zinc-900 transition-colors ${selectedThreadId === thread.id ? 'bg-zinc-900' : ''}`}
            >
              <div className="flex justify-between items-baseline mb-1">
                <span className={`text-sm truncate pr-2 ${thread.unreadCount > 0 ? 'font-bold text-zinc-100' : 'font-medium text-zinc-300'}`}>
                  {thread.latestMsg.from}
                </span>
                <span className="text-xs text-zinc-500 shrink-0">{format(new Date(thread.latestMsg.receivedAt), 'MMM d')}</span>
              </div>
              <div className={`text-sm truncate mb-1 ${thread.unreadCount > 0 ? 'font-bold text-zinc-200' : 'text-zinc-400'}`}>
                {thread.subject}
              </div>
              <div className="text-xs text-zinc-500 truncate">{thread.latestMsg.snippet}</div>
              {thread.unreadCount > 0 && (
                <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 uppercase tracking-wider">
                  {thread.unreadCount} Unread
                </div>
              )}
            </div>
          ))}
          {threadList.length === 0 && (
            <div className="p-4 text-center text-sm text-zinc-500">
              No threads found.
            </div>
          )}
        </div>
      </div>

      {/* Thread Detail */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0">
        {selectedThreadId && activeThreadMessages.length > 0 ? (
          <>
            <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-semibold mb-2">{activeThreadMessages[0].subject}</h1>
                <div className="text-sm text-zinc-400">
                  {activeThreadMessages.length} message{activeThreadMessages.length > 1 ? 's' : ''} in thread
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {filter === 'active' && (
                  <button 
                    onClick={() => {
                      handleAction('archiveThread', { threadId: selectedThreadId });
                      setSelectedThreadId(null);
                    }}
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors"
                    title="Archive Thread"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Context Panel */}
              {(linkedCompanies.length > 0 || linkedEvidence.length > 0) && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-6">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Thread Context</h3>
                  
                  {linkedCompanies.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs text-zinc-400 mb-2">Linked Companies</div>
                      <div className="flex flex-wrap gap-2">
                        {linkedCompanies.map(c => (
                          <div key={c.id} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            {c.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {linkedEvidence.length > 0 && (
                    <div>
                      <div className="text-xs text-zinc-400 mb-2">Extracted Evidence</div>
                      <div className="space-y-2">
                        {linkedEvidence.map(e => (
                          <div key={e.id} className="p-2 bg-zinc-800/50 rounded text-xs text-zinc-300 border border-zinc-700/50">
                            <div className="font-medium mb-1">{e.claimSummary}</div>
                            {e.quote && <div className="text-zinc-500 italic">&quot;{e.quote}&quot;</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeThreadMessages.map((msg, index) => (
                <div key={msg.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-start">
                    <div>
                      <div className="font-medium text-zinc-200">{msg.from}</div>
                      <div className="text-xs text-zinc-500 mt-1">to {msg.to}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-xs text-zinc-500">
                        {format(new Date(msg.receivedAt), 'MMM d, yyyy h:mm a')}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {messageLabels.filter(ml => ml.messageId === msg.id).map(ml => {
                          const label = allLabels.find(l => l.id === ml.labelId);
                          if (!label) return null;
                          return (
                            <span key={label.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color }}></span>
                              {label.name}
                              <button 
                                onClick={() => handleAction('removeLabelFromMessage', { messageId: msg.id, labelId: label.id })}
                                className="ml-1 text-zinc-500 hover:text-zinc-300"
                              >×</button>
                            </span>
                          );
                        })}
                        {msg.routeStatus && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 uppercase tracking-wider">
                            {msg.routeStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 text-sm text-zinc-300 whitespace-pre-wrap">
                    {msg.plainTextBody}
                    
                    {/* Extracted Links */}
                    {(() => {
                      const links = msg.plainTextBody?.match(/https?:\/\/[^\s]+/g) || [];
                      if (links.length === 0) return null;
                      return (
                        <div className="mt-4 pt-4 border-t border-zinc-800/50">
                          <div className="text-xs font-medium text-zinc-500 mb-2">Extracted Links</div>
                          <div className="flex flex-col gap-1">
                            {Array.from(new Set(links)).map((link, i) => (
                              <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate">
                                {link}
                              </a>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Message Actions */}
                  {index === activeThreadMessages.length - 1 && (
                    <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex gap-3 flex-wrap relative">
                      <button 
                        onClick={() => handleAction('createCompanyFromMessage', { messageId: msg.id, name: msg.from, domain: msg.from.split('@')[1] })}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium transition-colors"
                      >
                        Create Company
                      </button>

                      <div className="relative">
                        <button 
                          onClick={() => setShowCompanyMenu(showCompanyMenu === msg.id ? null : msg.id)}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium transition-colors"
                        >
                          Link Company
                        </button>
                        {showCompanyMenu === msg.id && (
                          <div className="absolute bottom-full left-0 mb-2 w-48 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg overflow-hidden z-10">
                            <div className="max-h-40 overflow-y-auto">
                              {allCompanies.length === 0 ? (
                                <div className="p-2 text-xs text-zinc-500 text-center">No companies</div>
                              ) : (
                                allCompanies.map(company => (
                                  <button
                                    key={company.id}
                                    onClick={() => {
                                      handleAction('linkMessageToCompany', { messageId: msg.id, companyId: company.id });
                                      setShowCompanyMenu(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-700 truncate"
                                  >
                                    {company.name}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => handleAction('createEvidenceFromMessage', { messageId: msg.id, claimSummary: 'Evidence from email' })}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium transition-colors"
                      >
                        Extract Evidence
                      </button>
                      <button 
                        onClick={() => handleAction('createTask', { title: `Follow up with ${msg.from}`, type: 'follow-up', relatedEntityType: 'message', relatedEntityId: msg.id })}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium transition-colors"
                      >
                        Create Task
                      </button>
                      
                      <div className="relative">
                        <button 
                          onClick={() => setShowLabelMenu(showLabelMenu === msg.id ? null : msg.id)}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <Tag className="w-3 h-3" />
                          Label
                        </button>
                        {showLabelMenu === msg.id && (
                          <div className="absolute bottom-full left-0 mb-2 w-48 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg overflow-hidden z-10">
                            <div className="p-2 border-b border-zinc-700">
                              <input 
                                type="text" 
                                value={newLabelName}
                                onChange={(e) => setNewLabelName(e.target.value)}
                                placeholder="New label..."
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && newLabelName.trim()) {
                                    await handleAction('createLabel', { name: newLabelName.trim() });
                                    setNewLabelName('');
                                  }
                                }}
                              />
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                              {allLabels.map(label => {
                                const isAssigned = messageLabels.some(ml => ml.messageId === msg.id && ml.labelId === label.id);
                                return (
                                  <button
                                    key={label.id}
                                    onClick={() => {
                                      if (isAssigned) {
                                        handleAction('removeLabelFromMessage', { messageId: msg.id, labelId: label.id });
                                      } else {
                                        handleAction('addLabelToMessage', { messageId: msg.id, labelId: label.id });
                                      }
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-700 flex items-center gap-2"
                                  >
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: label.color }}></span>
                                    <span className="flex-1 truncate">{label.name}</span>
                                    {isAssigned && <CheckCircle2 className="w-3 h-3 text-blue-400" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => handleAction('escalateMessage', { messageId: msg.id, reason: 'Manual escalation from inbox' })}
                        className="px-3 py-1.5 bg-red-950/30 text-red-400 hover:bg-red-900/50 rounded text-xs font-medium transition-colors ml-auto flex items-center gap-1"
                      >
                        <AlertCircle className="w-3 h-3" />
                        Escalate
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {/* Drafts Panel */}
              {threadDrafts.map(draft => (
                <div key={draft.id} className="bg-blue-950/20 border border-blue-900/50 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-blue-900/50 bg-blue-950/30 flex justify-between items-center">
                    <div className="font-medium text-blue-200">Draft Reply</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-400 uppercase tracking-wider font-semibold">{draft.status}</span>
                      {draft.status === 'draft' && (
                        <button 
                          onClick={() => handleAction('approveDraft', { draftId: draft.id })}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      {draft.status === 'approved' && (
                        <button 
                          onClick={() => handleAction('sendDraft', { draftId: draft.id })}
                          className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium transition-colors"
                        >
                          Send
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    {draft.status === 'draft' ? (
                      <div className="space-y-3">
                        <input 
                          type="text" 
                          defaultValue={draft.subject}
                          onBlur={(e) => handleAction('updateDraft', { draftId: draft.id, subject: e.target.value, body: draft.body })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                        />
                        <textarea 
                          defaultValue={draft.body}
                          onBlur={(e) => handleAction('updateDraft', { draftId: draft.id, subject: draft.subject, body: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 min-h-[100px] focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="text-sm text-zinc-300 mb-2 font-medium">Subject: {draft.subject}</div>
                        <div className="text-sm text-zinc-400 whitespace-pre-wrap">{draft.body}</div>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Reply Button */}
              {threadDrafts.length === 0 && (
                <div className="pt-4">
                  <button 
                    onClick={() => handleAction('createDraftFromThread', { 
                      threadId: selectedThreadId, 
                      subject: `Re: ${activeThreadMessages[0].subject}`, 
                      body: 'Thank you for your message. We will get back to you shortly.' 
                    })}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Reply className="w-4 h-4" />
                    Draft Reply
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Select a thread to read</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
