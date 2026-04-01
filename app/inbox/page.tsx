'use client';

import { useEffect, useState } from 'react';
import { Message } from '@/packages/shared/types';
import { format } from 'date-fns';
import { Mail, Reply, Archive, Tag, AlertCircle, RefreshCw } from 'lucide-react';

export default function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);

  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  useEffect(() => {
    const loadMessages = async () => {
      if (electron) {
        const msgs = await electron.db.query('messages', 'findMany', {});
        setMessages(msgs);
      }
    };
    loadMessages();
  }, [electron]);

  const handleIngest = async () => {
    if (!electron) return;
    setIsIngesting(true);
    await electron.cmd.execute('ingestMail', {});
    const msgs = await electron.db.query('messages', 'findMany', {});
    setMessages(msgs);
    setIsIngesting(false);
  };

  const handleAction = async (command: string, payload: any) => {
    if (!electron) return;
    await electron.cmd.execute(command, payload);
    const msgs = await electron.db.query('messages', 'findMany', {});
    setMessages(msgs);
    if (selectedMessage) {
      const updated = await electron.db.query('messages', 'findById', { id: selectedMessage.id });
      setSelectedMessage(updated);
    }
    alert(`Executed ${command}`);
  };

  return (
    <div className="flex h-full">
      {/* Message List */}
      <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-950 shrink-0">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h2 className="text-sm font-semibold">Inbox</h2>
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
          {messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => setSelectedMessage(msg)}
              className={`p-4 border-b border-zinc-800/50 cursor-pointer hover:bg-zinc-900 transition-colors ${selectedMessage?.id === msg.id ? 'bg-zinc-900' : ''}`}
            >
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm font-medium truncate pr-2">{msg.from}</span>
                <span className="text-xs text-zinc-500 shrink-0">{format(new Date(msg.receivedAt), 'MMM d')}</span>
              </div>
              <div className="text-sm text-zinc-300 truncate mb-1">{msg.subject}</div>
              <div className="text-xs text-zinc-500 truncate">{msg.snippet}</div>
              {msg.routeStatus && (
                <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 uppercase tracking-wider">
                  {msg.routeStatus}
                </div>
              )}
            </div>
          ))}
          {messages.length === 0 && (
            <div className="p-4 text-center text-sm text-zinc-500">
              No messages. Click refresh to ingest mock mail.
            </div>
          )}
        </div>
      </div>

      {/* Message Detail */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0">
        {selectedMessage ? (
          <>
            <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-semibold mb-2">{selectedMessage.subject}</h1>
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <span>From: <span className="text-zinc-200">{selectedMessage.from}</span></span>
                  <span>•</span>
                  <span>{format(new Date(selectedMessage.receivedAt), 'MMM d, yyyy h:mm a')}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors">
                  <Reply className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleAction('markMessageIgnored', { messageId: selectedMessage.id })}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors"
                  title="Ignore"
                >
                  <Archive className="w-4 h-4" />
                </button>
                <button className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors">
                  <Tag className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 flex-1 overflow-y-auto text-sm text-zinc-300 whitespace-pre-wrap">
              {selectedMessage.plainTextBody}
            </div>
            
            {/* Action Bar */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex gap-3 shrink-0">
              <button 
                onClick={() => handleAction('createCompanyFromMessage', { messageId: selectedMessage.id, name: selectedMessage.from, domain: selectedMessage.from.split('@')[1] })}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm font-medium transition-colors"
              >
                Create Company
              </button>
              <button 
                onClick={() => handleAction('createEvidenceFromMessage', { messageId: selectedMessage.id, claimSummary: 'Evidence from email' })}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm font-medium transition-colors"
              >
                Extract Evidence
              </button>
              <button 
                onClick={() => handleAction('createTask', { title: `Follow up with ${selectedMessage.from}`, type: 'follow-up', relatedEntityType: 'message', relatedEntityId: selectedMessage.id })}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm font-medium transition-colors"
              >
                Create Task
              </button>
              <button 
                onClick={() => handleAction('escalateMessage', { messageId: selectedMessage.id, reason: 'Manual escalation from inbox' })}
                className="px-4 py-2 bg-red-950/30 text-red-400 hover:bg-red-900/50 rounded-md text-sm font-medium transition-colors ml-auto flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                Escalate
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Select a message to read</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
