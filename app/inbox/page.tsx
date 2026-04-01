'use client';

import { useEffect, useState } from 'react';
import { Message } from '@/packages/shared/types';
import { format } from 'date-fns';
import { Mail, Reply, Archive, Tag, AlertCircle } from 'lucide-react';

export default function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  useEffect(() => {
    if (electron) {
      electron.db.getInboxItems().then(setMessages);
    } else {
      setMessages([
        {
          id: '1',
          from: 'founder@acme.com',
          to: 'agent@internal.com',
          subject: 'Interested in your product',
          snippet: 'Hi, we are looking for a solution...',
          plainTextBody: 'Hi, we are looking for a solution to our problem. Can we chat?',
          receivedAt: new Date(),
          readState: false,
          routeStatus: 'candidate',
        } as Message
      ]);
    }
  }, [electron]);

  return (
    <div className="flex h-full">
      {/* Message List */}
      <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-950 shrink-0">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold">Inbox</h2>
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
                <button className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors">
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
              <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm font-medium transition-colors">
                Link to Company
              </button>
              <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm font-medium transition-colors">
                Create Evidence Fragment
              </button>
              <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm font-medium transition-colors">
                Draft Outreach
              </button>
              <button className="px-4 py-2 bg-red-950/30 text-red-400 hover:bg-red-900/50 rounded-md text-sm font-medium transition-colors ml-auto flex items-center gap-2">
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
