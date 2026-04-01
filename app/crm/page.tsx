'use client';

import { useEffect, useState } from 'react';
import { Company } from '@/packages/shared/types';
import { Building2, Globe, Users, FileText, CheckSquare, Mail, Link as LinkIcon, MapPin, Activity } from 'lucide-react';

export default function CRMPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [linkedEntities, setLinkedEntities] = useState<any>({ messages: [], tasks: [], evidence: [], drafts: [] });

  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  useEffect(() => {
    if (electron) {
      electron.db.query('companies', 'findMany', {}).then(setCompanies);
    } else {
      Promise.resolve().then(() => {
        setCompanies([
          {
            id: '1',
            name: 'Acme Corp',
            domain: 'acme.com',
            hq: 'San Francisco',
            sector: 'Technology',
            status: 'Active',
            qualificationScore: 85,
            leadStage: 'Qualified',
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Company
        ]);
      });
    }
  }, [electron]);

  useEffect(() => {
    if (electron && selectedCompany) {
      const loadLinkedData = async () => {
        // Fetch entity links where target is this company
        const links = await electron.db.query('entityLinks', 'findMany', { 
          where: { targetType: 'company', targetId: selectedCompany.id } 
        });

        const messageIds = links.filter((l: any) => l.sourceType === 'message').map((l: any) => l.sourceId);
        const tabIds = links.filter((l: any) => l.sourceType === 'browser_tab').map((l: any) => l.sourceId);

        let messages = [];
        if (messageIds.length > 0) {
          // Fetch messages by IDs (simplifying by fetching all and filtering for now due to IPC limitations)
          const allMsgs = await electron.db.query('messages', 'findMany', {});
          messages = allMsgs.filter((m: any) => messageIds.includes(m.id));
        }

        const tasks = await electron.db.query('tasks', 'findMany', { 
          where: { relatedEntityType: 'company', relatedEntityId: selectedCompany.id } 
        });
        
        const drafts = await electron.db.query('drafts', 'findMany', { 
          where: { companyId: selectedCompany.id } 
        });

        // Fetch evidence linked to this company or its tabs/messages
        const allEvidence = await electron.db.query('evidenceFragments', 'findMany', {});
        const evidence = allEvidence.filter((e: any) => 
          e.companyId === selectedCompany.id || 
          (e.sourceType === 'inbox_message' && messageIds.includes(e.sourceId)) ||
          (e.sourceType === 'browser_tab' && tabIds.includes(e.sourceId))
        );

        setLinkedEntities({ messages, tasks, evidence, drafts });
      };
      
      loadLinkedData();
    }
  }, [electron, selectedCompany]);

  if (!selectedCompany) {
    return (
      <div className="p-8 h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <button className="px-4 py-2 bg-zinc-100 text-zinc-900 hover:bg-white rounded-md text-sm font-medium transition-colors">
            Add Company
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <div key={company.id} onClick={() => setSelectedCompany(company)} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-zinc-800 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="font-medium">{company.name}</h3>
                    <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                      <Globe className="w-3 h-3" />
                      {company.domain}
                    </div>
                  </div>
                </div>
                <div className="px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 uppercase tracking-wider">
                  {company.leadStage}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {company.hq || 'Unknown HQ'}
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Score: {company.qualificationScore || 'N/A'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Company List Sidebar */}
      <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-950 shrink-0">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h2 className="text-sm font-semibold">Companies</h2>
          <button onClick={() => setSelectedCompany(null)} className="text-xs text-zinc-400 hover:text-zinc-200">Back to Grid</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {companies.map((company) => (
            <div
              key={company.id}
              onClick={() => setSelectedCompany(company)}
              className={`p-4 border-b border-zinc-800/50 cursor-pointer hover:bg-zinc-900 transition-colors ${selectedCompany?.id === company.id ? 'bg-zinc-900' : ''}`}
            >
              <div className="font-medium text-sm mb-1">{company.name}</div>
              {company.domain && (
                <div className="text-xs text-zinc-500 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {company.domain}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Company Detail */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto w-full">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <Building2 className="w-8 h-8 text-zinc-400" />
                {selectedCompany.name}
              </h1>
              {selectedCompany.domain && (
                <a href={`https://${selectedCompany.domain}`} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-zinc-200 flex items-center gap-2 text-sm">
                  <Globe className="w-4 h-4" />
                  {selectedCompany.domain}
                </a>
              )}
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-md text-sm font-medium transition-colors border border-zinc-800">
                Edit Details
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Activity / Linked Entities */}
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Recent Messages
                </h3>
                <div className="space-y-2">
                  {linkedEntities.messages.map((msg: any) => (
                    <div key={msg.id} className="p-3 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
                      <div className="text-sm font-medium mb-1 truncate">{msg.subject}</div>
                      <div className="text-xs text-zinc-500 truncate">{msg.snippet}</div>
                    </div>
                  ))}
                  {linkedEntities.messages.length === 0 && <div className="text-sm text-zinc-600">No messages found.</div>}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  Tasks
                </h3>
                <div className="space-y-2">
                  {linkedEntities.tasks.map((task: any) => (
                    <div key={task.id} className="p-3 bg-zinc-900/50 border border-zinc-800/50 rounded-lg flex justify-between items-center">
                      <div className="text-sm font-medium">{task.title}</div>
                      <div className="text-xs px-2 py-1 bg-zinc-800 rounded text-zinc-400">{task.status}</div>
                    </div>
                  ))}
                  {linkedEntities.tasks.length === 0 && <div className="text-sm text-zinc-600">No tasks found.</div>}
                </div>
              </section>
            </div>

            {/* CRM Data */}
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Contacts
                </h3>
                <div className="p-4 border border-zinc-800/50 rounded-lg border-dashed text-center text-sm text-zinc-500">
                  No contacts linked.
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Evidence & Notes
                </h3>
                <div className="space-y-2">
                  {linkedEntities.evidence.map((ev: any) => (
                    <div key={ev.id} className="p-3 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
                      <div className="text-sm font-medium mb-1 truncate">{ev.claimSummary}</div>
                      {ev.quote && <div className="text-xs text-zinc-500 italic truncate">&quot;{ev.quote}&quot;</div>}
                    </div>
                  ))}
                  {linkedEntities.evidence.length === 0 && (
                    <div className="p-4 border border-zinc-800/50 rounded-lg border-dashed text-center text-sm text-zinc-500">
                      No evidence linked.
                    </div>
                  )}
                </div>
              </section>
              
              <section>
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Outreach Drafts
                </h3>
                <div className="space-y-2">
                  {linkedEntities.drafts.map((draft: any) => (
                    <div key={draft.id} className="p-3 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
                      <div className="text-sm font-medium mb-1">{draft.subject}</div>
                      <div className="text-xs text-zinc-500">Status: {draft.status}</div>
                    </div>
                  ))}
                  {linkedEntities.drafts.length === 0 && <div className="text-sm text-zinc-600">No drafts found.</div>}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
