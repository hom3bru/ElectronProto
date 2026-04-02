'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Globe, Users, FileText, CheckSquare, Mail,
  AlertTriangle, Clock, ExternalLink, Plus, X, Check,
  Ban, Activity, BookOpen, Send, Shield, ChevronDown,
  BarChart2, Inbox, ArrowRight, Trash2, RotateCcw, Link, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import UniversalLinker from '../../components/universal-linker';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Unwrap a CommandResult envelope or raw array from IPC */
function unwrap<T>(res: any, fallback: T): T {
  if (res === null || res === undefined) return fallback;
  if (typeof res === 'object' && 'ok' in res) {
    return res.ok ? res.data : fallback;
  }
  return res;
}

const LEAD_STAGE_COLORS: Record<string, string> = {
  prospect:    'bg-zinc-800 text-zinc-300',
  lead:        'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  qualified:   'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
  proposal:    'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  negotiation: 'bg-orange-500/15 text-orange-400 border border-orange-500/20',
  'closed-won':  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  'closed-lost': 'bg-red-500/15 text-red-400 border border-red-500/20',
};
const LEAD_STAGE_OPTIONS = ['prospect','lead','qualified','proposal','negotiation','closed-won','closed-lost'];

const OUTREACH_STATE_COLORS: Record<string, string> = {
  'not-started':  'bg-zinc-800 text-zinc-400',
  researching:    'bg-blue-500/15 text-blue-400',
  drafting:       'bg-purple-500/15 text-purple-400',
  sent:           'bg-amber-500/15 text-amber-400',
  replied:        'bg-emerald-500/15 text-emerald-400',
  unresponsive:   'bg-orange-500/15 text-orange-400',
  'opted-out':    'bg-red-500/15 text-red-400',
};
const OUTREACH_STATE_OPTIONS = ['not-started','researching','drafting','sent','replied','unresponsive','opted-out'];

const DRAFT_STATUS_COLORS: Record<string, string> = {
  draft:            'bg-zinc-800 text-zinc-400',
  pending_approval: 'bg-amber-500/15 text-amber-400',
  approved:         'bg-emerald-500/15 text-emerald-400',
  sent:             'bg-blue-500/15 text-blue-400',
  blocked:          'bg-red-500/15 text-red-400',
};

const TASK_PRIORITY_COLORS: Record<string, string> = {
  low:      'bg-zinc-800 text-zinc-500',
  normal:   'bg-zinc-800 text-zinc-400',
  high:     'bg-red-500/10 text-red-400',
  critical: 'bg-red-500/20 text-red-300',
};

// ─── Small components ─────────────────────────────────────────────────────────

function Pill({ label, colorMap }: { label?: string | null; colorMap: Record<string, string> }) {
  if (!label) return <span className="text-zinc-600 text-xs">—</span>;
  const cls = colorMap[label] || 'bg-zinc-800 text-zinc-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function ScoreBar({ value, color = 'blue' }: { value?: number | null; color?: 'blue' | 'emerald' | 'amber' }) {
  if (value == null) return <span className="text-zinc-600 text-xs tabular-nums">—</span>;
  const pct = Math.max(0, Math.min(100, value));
  const bar = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', amber: 'bg-amber-400' }[color];
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-zinc-400 tabular-nums w-6 text-right">{Math.round(pct)}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, action }: { icon: any; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
        <Icon className="w-3 h-3" />{title}
      </h3>
      {action}
    </div>
  );
}

type Tab = 'overview' | 'evidence' | 'outreach' | 'tasks' | 'timeline';

// ─── Main component ───────────────────────────────────────────────────────────

export default function CRMPage() {
  const router = useRouter();
  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  const [companies, setCompanies]   = useState<any[]>([]);
  const [selected,  setSelected]    = useState<any | null>(null);
  const [links,     setLinks]       = useState<any>({ messages: [], tasks: [], evidence: [], drafts: [], browserTabs: [] });
  const [contacts,  setContacts]    = useState<any[]>([]);
  const [notebook,  setNotebook]    = useState<any[]>([]);
  const [activeTab, setActiveTab]   = useState<Tab>('overview');

  // Inline forms
  const [showAddContact,  setShowAddContact]  = useState(false);
  const [newContact,      setNewContact]      = useState({ name: '', email: '', role: '' });
  const [showCreateTask,  setShowCreateTask]  = useState(false);
  const [newTask,         setNewTask]         = useState({ title: '', type: 'crm-update', priority: 'normal', owner: '', notes: '' });
  const [expandedTaskId, setExpandedTaskId]  = useState<string | null>(null);
  const [showCreateDraft, setShowCreateDraft] = useState(false);
  const [newDraft,        setNewDraft]        = useState({ subject: '', body: '' });
  const [showLinker,      setShowLinker]      = useState(false);

  // ─── Data ───────────────────────────────────────────────────────────────────

  const loadCompanies = useCallback(async () => {
    if (!electron) return;
    const res = await electron.crm.getCompanies();
    setCompanies(unwrap(res, []));
  }, [electron]);

  const loadDetail = useCallback(async (company: any) => {
    if (!electron) return;
    const [linksRes, contactsRes, notebookRes] = await Promise.all([
      electron.crm.getCompanyLinks(company.id),
      electron.crm.getContacts(company.id),
      electron.audit.getCommandLog(company.id),
    ]);
    setLinks(unwrap(linksRes, { messages: [], tasks: [], evidence: [], drafts: [], browserTabs: [] }));
    setContacts(unwrap(contactsRes, []));
    setNotebook(unwrap(notebookRes, []));
  }, [electron]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const selectCompany = useCallback((company: any) => {
    setSelected(company);
    setActiveTab('overview');
    setShowAddContact(false);
    setShowCreateTask(false);
    setShowCreateDraft(false);
    loadDetail(company);
  }, [loadDetail]);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const updateField = async (field: string, value: string) => {
    if (!electron || !selected) return;
    await electron.crm.updateCompany(selected.id, { [field]: value });
    const updated = { ...selected, [field]: value };
    setSelected(updated);
    setCompanies(cs => cs.map(c => c.id === selected.id ? updated : c));
  };

  const addContact = async () => {
    if (!electron || !selected || !newContact.name.trim()) return;
    const res = await electron.crm.createContact({ companyId: selected.id, ...newContact });
    if (unwrap(res, null) !== null || res?.ok !== false) {
      setNewContact({ name: '', email: '', role: '' });
      setShowAddContact(false);
      await loadDetail(selected);
    }
  };

  const createTask = async () => {
    if (!electron || !selected || !newTask.title.trim()) return;
    await electron.tasks.createTask({
      title: newTask.title, type: newTask.type, priority: newTask.priority,
      owner: newTask.owner || undefined, notes: newTask.notes || undefined,
      relatedEntityType: 'company', relatedEntityId: selected.id,
    });
    setNewTask({ title: '', type: 'crm-update', priority: 'normal', owner: '', notes: '' });
    setShowCreateTask(false);
    await loadDetail(selected);
  };

  const createDraft = async () => {
    if (!electron || !selected || !newDraft.subject.trim()) return;
    await electron.outreach.createDraftFromCompany(selected.id, newDraft.subject, newDraft.body);
    setNewDraft({ subject: '', body: '' });
    setShowCreateDraft(false);
    await loadDetail(selected);
  };

  const openInBrowser = async () => {
    if (!electron || !selected?.domain) return;
    const url = `https://${selected.domain}`;
    await electron.browser.createTab(`persist:company-${selected.id}`, url);
    router.push('/browser');
  };

  const approveDraft = async (draftId: string) => {
    if (!electron) return;
    await electron.outreach.approveDraft(draftId);
    await loadDetail(selected);
  };

  const blockDraft = async (draftId: string) => {
    if (!electron) return;
    const reason = window.prompt('Reason for blocking this draft:');
    if (!reason?.trim()) return;
    await electron.outreach.blockDraft(draftId, reason.trim());
    await loadDetail(selected);
  };

  const retractDraft = async (draftId: string) => {
    if (!electron) return;
    await electron.outreach.retractDraft(draftId);
    await loadDetail(selected);
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    if (!electron) return;
    await electron.tasks.updateTaskStatus(taskId, status);
    await loadDetail(selected);
  };

  const updateTaskWorkflow = async (taskId: string, update: any) => {
    if (!electron) return;
    await electron.tasks.updateTaskWorkflow(taskId, update);
    await loadDetail(selected);
  };

  const reviewEvidence = async (fragmentId: string, status: string) => {
    if (!electron) return;
    await electron.evidence.review(fragmentId, status);
    await loadDetail(selected);
  };

  const toggleContradiction = async (fragmentId: string, current: boolean) => {
    if (!electron) return;
    let reason = '';
    if (!current) {
      reason = window.prompt('Reason for contradiction flag:') || '';
      if (!reason.trim()) return;
    }
    await electron.evidence.setContradiction(fragmentId, !current, reason);
    await loadDetail(selected);
  };

  const deleteEvidence = async (fragmentId: string) => {
    if (!electron || !window.confirm('Retract this evidence fragment permanently?')) return;
    await electron.evidence.deleteFragment(fragmentId);
    await loadDetail(selected);
  };

  const unlinkEntity = async (linkId: string) => {
    if (!electron || !window.confirm('Remove this forensic link? The entities will remain, but the relationship will be severed.')) return;
    await electron.link.remove(linkId);
    await loadDetail(selected);
  };

  // ─── List (grid) view ────────────────────────────────────────────────────────

  if (!selected) {
    return (
      <div className="p-8 h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
            <p className="text-sm text-zinc-500 mt-1">{companies.length} companies in workspace</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <div
              key={company.id}
              onClick={() => selectCompany(company)}
              className={`group bg-zinc-900 border rounded-xl p-5 hover:border-zinc-600 hover:shadow-lg hover:shadow-black/20 transition-all cursor-pointer ${
                company.contradictionFlag ? 'border-red-500/40' : 'border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                    <Building2 className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{company.name}</h3>
                      {company.contradictionFlag && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" aria-label="Contradiction flag" />
                      )}
                    </div>
                    {company.domain && (
                      <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                        <Globe className="w-3 h-3" />{company.domain}
                      </div>
                    )}
                  </div>
                </div>
                <Pill label={company.leadStage} colorMap={LEAD_STAGE_COLORS} />
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="flex items-center justify-between text-[10px] text-zinc-600 uppercase tracking-wider">
                  <span>Qualification</span>
                  <span className="normal-case text-zinc-500">{company.sector || '—'}</span>
                </div>
                <ScoreBar value={company.qualificationScore} color="blue" />
                {company.confidenceScore != null && (
                  <ScoreBar value={company.confidenceScore} color="emerald" />
                )}
              </div>

              <div className="flex items-center justify-between text-xs pt-2.5 border-t border-zinc-800/50">
                <Pill label={company.outreachState || 'not-started'} colorMap={OUTREACH_STATE_COLORS} />
                <span className="text-zinc-600">{company.hq || '—'}</span>
              </div>
            </div>
          ))}
          {companies.length === 0 && (
            <div className="col-span-3 text-center py-16 text-zinc-600">
              No companies yet. Companies are created automatically when messages are linked.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Detail workbench ────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview',  label: 'Overview' },
    { key: 'evidence',  label: 'Evidence',  count: links.evidence?.length  || 0 },
    { key: 'outreach',  label: 'Outreach',  count: links.drafts?.length    || 0 },
    { key: 'tasks',     label: 'Tasks',     count: links.tasks?.length     || 0 },
    { key: 'timeline',  label: 'Timeline',  count: notebook.length         || 0 },
  ];

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Company sidebar ───────────────────────────────────────────────── */}
      <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950 shrink-0">
        <div className="px-3 py-2.5 border-b border-zinc-800 flex justify-between items-center">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Companies</span>
          <button onClick={() => setSelected(null)} className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors">
            Grid View
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {companies.map((company) => (
            <button
              key={company.id}
              onClick={() => selectCompany(company)}
              className={`w-full text-left px-3 py-2.5 border-b border-zinc-800/30 hover:bg-zinc-900/60 transition-colors ${
                selected?.id === company.id
                  ? 'bg-zinc-900 border-l-2 border-l-blue-500 pl-2.5'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {company.contradictionFlag && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                  <span className="font-medium text-xs truncate">{company.name}</span>
                </div>
                <Pill label={company.leadStage} colorMap={LEAD_STAGE_COLORS} />
              </div>
              {company.domain && (
                <div className="text-[10px] text-zinc-600 truncate">{company.domain}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main workbench ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Company header */}
        <div className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm px-6 py-4 shrink-0">
          <div className="flex items-start justify-between gap-6 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold truncate">{selected.name}</h1>
                {selected.contradictionFlag && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/15 text-red-400 rounded text-[10px] font-bold border border-red-500/20 uppercase tracking-wider shrink-0">
                    <AlertTriangle className="w-3 h-3" /> Contradiction
                  </span>
                )}
              </div>
              {selected.domain && (
                <a href={`https://${selected.domain}`} target="_blank" rel="noreferrer"
                  className="text-xs text-zinc-500 hover:text-blue-400 flex items-center gap-1 transition-colors w-fit">
                  <Globe className="w-3 h-3" />{selected.domain}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Scorecards */}
            <div className="flex items-start gap-5 text-xs shrink-0">
              <div className="w-28">
                <div className="text-[10px] text-zinc-600 mb-1 uppercase tracking-wider">Qualification</div>
                <ScoreBar value={selected.qualificationScore} color="blue" />
              </div>
              <div className="w-28">
                <div className="text-[10px] text-zinc-600 mb-1 uppercase tracking-wider">Confidence</div>
                <ScoreBar value={selected.confidenceScore} color="emerald" />
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Lead stage */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Stage</span>
              <select
                value={selected.leadStage || ''}
                onChange={e => updateField('leadStage', e.target.value)}
                className="text-[11px] bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">— Select —</option>
                {LEAD_STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Outreach state */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Outreach</span>
              <select
                value={selected.outreachState || ''}
                onChange={e => updateField('outreachState', e.target.value)}
                className="text-[11px] bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">— Select —</option>
                {OUTREACH_STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="w-px h-4 bg-zinc-800 mx-1" />

            {selected.domain && (
              <button onClick={openInBrowser}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-[11px] font-medium transition-colors border border-zinc-700">
                <Globe className="w-3 h-3" /> Open in Browser
              </button>
            )}
            <button onClick={() => { setShowCreateTask(true); setActiveTab('tasks'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-[11px] font-medium transition-colors border border-zinc-700">
              <CheckSquare className="w-3 h-3" /> Create Task
            </button>
            <button onClick={() => { setShowCreateDraft(true); setActiveTab('outreach'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-[11px] font-semibold transition-colors">
              <Send className="w-3 h-3" /> Start Outreach
            </button>
            <button onClick={() => setShowLinker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] font-semibold transition-colors border border-zinc-700">
              <Link className="w-3 h-3" /> Link Entity
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-800 bg-zinc-950/50 px-6 shrink-0 flex items-end">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Overview ──────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 max-w-4xl">

              {/* Contacts */}
              <section>
                <SectionHeader icon={Users} title="Contacts"
                  action={
                    <button onClick={() => setShowAddContact(!showAddContact)}
                      className="text-[10px] text-zinc-600 hover:text-blue-400 flex items-center gap-1 transition-colors">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  }
                />
                {showAddContact && (
                  <div className="mb-3 p-3 bg-zinc-900 border border-zinc-700 rounded-lg space-y-2">
                    <input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))}
                      placeholder="Name *" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                    <input value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                      placeholder="Email" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                    <input value={newContact.role} onChange={e => setNewContact(p => ({ ...p, role: e.target.value }))}
                      placeholder="Role" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={() => setShowAddContact(false)} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1">Cancel</button>
                      <button onClick={addContact} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors">Save Contact</button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {contacts.map((c: any) => (
                    <div key={c.id} className="p-3 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
                      <div className="font-medium text-sm">{c.name}</div>
                      {c.role && <div className="text-xs text-zinc-500 mt-0.5">{c.role}</div>}
                      {c.email && <div className="text-xs text-blue-400 mt-0.5">{c.email}</div>}
                    </div>
                  ))}
                  {contacts.length === 0 && !showAddContact && (
                    <button onClick={() => setShowAddContact(true)}
                      className="w-full p-4 border border-zinc-800/40 border-dashed rounded-lg text-xs text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-colors">
                      + Add first contact
                    </button>
                  )}
                </div>
              </section>

              {/* Company metadata */}
              <section>
                <SectionHeader icon={FileText} title="Company Details" />
                <div className="space-y-0 divide-y divide-zinc-800/40 text-xs">
                  {([
                    ['HQ',             selected.hq],
                    ['Country',        selected.country],
                    ['Sector',         selected.sector],
                    ['Subsector',      selected.subsector],
                    ['Status',         selected.status],
                    ['Website Status', selected.websiteStatus],
                    ['Sources Linked', selected.linkedSourceCount],
                    ['Evidence Count', selected.linkedEvidenceCount],
                    ['Last Touched',   selected.lastTouched
                      ? new Date(selected.lastTouched).toLocaleDateString()
                      : null],
                  ] as [string, any][]).filter(([, v]) => v != null && v !== 0).map(([label, val]) => (
                    <div key={label} className="flex justify-between py-1.5">
                      <span className="text-zinc-600">{label}</span>
                      <span className="text-zinc-300 font-medium">{String(val)}</span>
                    </div>
                  ))}
                  {selected.confidenceScore != null && (
                    <div className="py-2">
                      <div className="flex justify-between text-zinc-600 mb-1">
                        <span>Confidence</span><span>{Math.round(selected.confidenceScore)}%</span>
                      </div>
                      <ScoreBar value={selected.confidenceScore} color="emerald" />
                    </div>
                  )}
                </div>
              </section>

              {/* Linked messages */}
              <section className="col-span-2">
                <SectionHeader icon={Mail} title="Linked Messages" />
                <div className="space-y-2">
                  {(links.messages || []).map((msg: any) => (
                    <div key={msg.id} className="group p-3 bg-zinc-900/50 border border-zinc-800/50 rounded-lg flex items-start justify-between hover:border-zinc-700 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate mb-0.5">{msg.subject || '(no subject)'}</div>
                        <div className="text-xs text-zinc-500 truncate">{msg.snippet}</div>
                        <div className="text-xs text-zinc-700 mt-1">{msg.from}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-3">
                        <button onClick={() => router.push('/inbox')}
                          className="p-1.5 text-zinc-700 hover:text-blue-400 rounded hover:bg-zinc-800"
                          title="Open in Inbox">
                          <Inbox className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => unlinkEntity(msg.linkId)}
                          className="p-1.5 text-zinc-700 hover:text-red-400 rounded hover:bg-zinc-800"
                          title="Unlink Message">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!links.messages?.length) && (
                    <p className="text-xs text-zinc-600">No messages linked. Messages are linked via entity links.</p>
                  )}
                </div>
              </section>

              {/* Browser Sessions */}
              {links.browserTabs?.length > 0 && (
                <section className="col-span-2">
                  <SectionHeader icon={Globe} title="Browser Sessions" />
                  <div className="grid grid-cols-2 gap-2">
                    {links.browserTabs.map((tab: any) => (
                      <div key={tab.id} className="p-3 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
                        <div className="text-sm font-medium truncate mb-0.5">{tab.title || 'Untitled Tab'}</div>
                        <div className="text-xs text-blue-400 truncate">{tab.url}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ── Evidence ──────────────────────────────────────────────────── */}
          {activeTab === 'evidence' && (
            <div className="space-y-3 max-w-3xl">
              {(links.evidence || []).map((ev: any) => (
                <div key={ev.id} className={`p-4 bg-zinc-900/50 border rounded-xl ${
                  ev.contradictionFlag ? 'border-red-500/30 shadow-[0_0_0_1px_rgba(239,68,68,0.1)]' : 'border-zinc-800/50'
                }`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-medium leading-snug">{ev.claimSummary}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {ev.contradictionFlag && (
                        <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                          <AlertTriangle className="w-3 h-3" /> Contradiction
                        </span>
                      )}
                      {ev.reviewerStatus && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase tracking-wider">{ev.reviewerStatus}</span>
                      )}
                    </div>
                  </div>

                  {ev.quote && (
                    <blockquote className="text-xs text-zinc-400 italic border-l-2 border-zinc-700 pl-2 mb-3 line-clamp-2">
                      "{ev.quote}"
                    </blockquote>
                  )}

                  <div className="flex items-center justify-between gap-4 mt-1">
                    <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                      <span className="uppercase tracking-wider">{ev.sourceType}</span>
                      {ev.extractedBy && <span>by {ev.extractedBy}</span>}
                      {ev.url && (
                        <a href={ev.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate max-w-[200px]">
                          {ev.url}
                        </a>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <div className="flex bg-zinc-800 rounded p-0.5 border border-zinc-700">
                          <button onClick={() => reviewEvidence(ev.id, 'confirmed')}
                            className={`p-1 rounded transition-colors ${ev.reviewerStatus === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Confirm Evidence">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => reviewEvidence(ev.id, 'disputed')}
                            className={`p-1 rounded transition-colors ${ev.reviewerStatus === 'disputed' ? 'bg-red-500/20 text-red-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Dispute Evidence">
                            <X className="w-3 h-3" />
                          </button>
                          <button onClick={() => reviewEvidence(ev.id, 'pending')}
                            className={`p-1 rounded transition-colors ${ev.reviewerStatus === 'pending' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Reset to Pending">
                            <RotateCcw className="w-3 h-3" />
                          </button>
                       </div>
                       <button onClick={() => toggleContradiction(ev.id, ev.contradictionFlag)}
                         className={`p-1.5 rounded transition-colors border ${ev.contradictionFlag ? 'bg-red-500/20 border-red-500/30 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.2)]' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/30'}`}
                         title={ev.contradictionFlag ? "Clear Contradiction" : "Mark as Contradicting"}>
                         <AlertTriangle className="w-3.5 h-3.5" />
                       </button>
                       <button onClick={() => deleteEvidence(ev.id)}
                         className="p-1.5 bg-zinc-800 border border-zinc-700 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 rounded transition-colors"
                         title="Retract Evidence">
                         <Trash2 className="w-3.5 h-3.5" />
                       </button>
                       <button onClick={() => unlinkEntity(ev.linkId)}
                         className="p-1.5 bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-amber-400 hover:border-amber-500/30 rounded transition-colors"
                         title="Unlink from Company">
                         <RotateCcw className="w-3.5 h-3.5" />
                       </button>
                    </div>

                    {ev.confidence != null && (
                      <div className="flex items-center gap-2 w-28 shrink-0">
                        <span className="text-[10px] text-zinc-600">conf</span>
                        <ScoreBar
                          value={ev.confidence * 100}
                          color={ev.confidence > 0.7 ? 'emerald' : ev.confidence > 0.4 ? 'blue' : 'amber'}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!links.evidence?.length && (
                <p className="text-sm text-zinc-600">No evidence linked to this company yet.</p>
              )}
            </div>
          )}

          {/* ── Outreach ──────────────────────────────────────────────────── */}
          {activeTab === 'outreach' && (
            <div className="space-y-3 max-w-3xl">
              {showCreateDraft && (
                <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-xl space-y-3 mb-4">
                  <h4 className="text-sm font-semibold">New Outreach Draft</h4>
                  <input value={newDraft.subject} onChange={e => setNewDraft(p => ({ ...p, subject: e.target.value }))}
                    placeholder="Subject *"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  <textarea value={newDraft.body} onChange={e => setNewDraft(p => ({ ...p, body: e.target.value }))}
                    placeholder="Message body..." rows={5} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowCreateDraft(false)} className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5">Cancel</button>
                    <button onClick={createDraft} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded transition-colors">Create Draft</button>
                  </div>
                </div>
              )}

              {(links.drafts || []).map((draft: any) => (
                <div key={draft.id} className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{draft.subject || '(no subject)'}</div>
                      {draft.blockedReason && (
                        <div className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
                          <Ban className="w-3 h-3" /> {draft.blockedReason}
                        </div>
                      )}
                    </div>
                    <Pill label={draft.status} colorMap={DRAFT_STATUS_COLORS} />
                  </div>
                  {draft.body && (
                    <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{draft.body}</p>
                  )}
                  <div className="flex gap-2">
                    {!['sent','approved','blocked'].includes(draft.status) && (
                      <button onClick={() => approveDraft(draft.id)}
                        className="flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 px-2.5 py-1 rounded transition-colors border border-emerald-500/20">
                        <Check className="w-3 h-3" /> Approve
                      </button>
                    )}
                    {draft.status === 'approved' && (
                      <button onClick={() => retractDraft(draft.id)}
                        className="flex items-center gap-1 text-xs bg-zinc-800 text-zinc-400 hover:bg-zinc-700 px-2.5 py-1 rounded transition-colors">
                        <X className="w-3 h-3" /> Retract
                      </button>
                    )}
                    {draft.status !== 'sent' && draft.status !== 'blocked' && (
                      <button onClick={() => blockDraft(draft.id)}
                        className="flex items-center gap-1 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2.5 py-1 rounded transition-colors border border-red-500/20">
                        <Ban className="w-3 h-3" /> Block
                      </button>
                    )}
                    <button onClick={() => unlinkEntity(draft.linkId)}
                      className="flex items-center gap-1 text-xs bg-zinc-800 text-zinc-500 hover:text-amber-400 hover:bg-zinc-700 px-2.5 py-1 rounded transition-colors border border-zinc-700"
                      title="Unlink Draft">
                      <RotateCcw className="w-3 h-3" /> Unlink
                    </button>
                  </div>
                </div>
              ))}

              {!links.drafts?.length && !showCreateDraft && (
                <button onClick={() => setShowCreateDraft(true)}
                  className="w-full p-8 border border-zinc-800/40 border-dashed rounded-xl text-sm text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-colors">
                  + Start an outreach draft for {selected.name}
                </button>
              )}
            </div>
          )}

          {/* ── Tasks ─────────────────────────────────────────────────────── */}
          {activeTab === 'tasks' && (
            <div className="space-y-3 max-w-3xl">
              {showCreateTask && (
                <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-xl space-y-3 mb-4">
                  <h4 className="text-sm font-semibold">New Task for {selected.name}</h4>
                  <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="Task title *"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  <div className="grid grid-cols-2 gap-3">
                    <select value={newTask.type} onChange={e => setNewTask(p => ({ ...p, type: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      {['crm-update','outreach-followup','review-evidence','review-browser-tab','manual'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      {['low','normal','high','critical'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={newTask.owner} onChange={e => setNewTask(p => ({ ...p, owner: e.target.value }))}
                      placeholder="Owner (optional)"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                    <input value={newTask.notes} onChange={e => setNewTask(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Notes (optional)"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowCreateTask(false)} className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5">Cancel</button>
                    <button onClick={createTask} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded transition-colors">Create Task</button>
                  </div>
                </div>
              )}

              {(links.tasks || []).map((task: any) => {
                const isExpanded = expandedTaskId === task.id;
                const isBlocked = !!task.blockedReason;
                
                return (
                  <div key={task.id} className={`p-4 bg-zinc-900/50 border transition-all ${
                    isBlocked ? 'border-red-900/30 bg-red-950/5' : 
                    task.status === 'completed' ? 'border-zinc-800/20 opacity-60' :
                    'border-zinc-800/50 hover:border-zinc-700'
                  } rounded-xl space-y-3`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0" onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}>
                        <div className="flex items-center gap-2 mb-1">
                          <CheckSquare className={`w-4 h-4 ${task.status === 'completed' ? 'text-emerald-500' : 'text-zinc-500'}`} />
                          <div className="text-sm font-medium truncate cursor-pointer hover:text-blue-400">{task.title}</div>
                        </div>
                        {task.escalationReason && (
                          <div className="text-[10px] text-red-400 mb-2 flex items-center gap-1 font-bold">
                            <AlertTriangle className="w-3 h-3" /> ESCALATED: {task.escalationReason}
                          </div>
                        )}
                        {isBlocked && (
                          <div className="text-[10px] text-orange-400 mb-2 flex items-center gap-1">
                            <Ban className="w-3 h-3" /> BLOCKED: {task.blockedReason}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Pill label={task.priority} colorMap={TASK_PRIORITY_COLORS} />
                          <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">{task.type}</span>
                          {task.owner && <span className="text-[10px] text-zinc-500 flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{task.owner}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={task.status}
                          onChange={e => updateTaskStatus(task.id, e.target.value)}
                          className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                        >
                          {['queued','in-progress','needs-review','completed','cancelled'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          className="p-1 hover:bg-zinc-800 rounded text-zinc-500"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pt-3 border-t border-zinc-800/50 space-y-3">
                        {task.notes && (
                          <div className="text-xs text-zinc-400 bg-zinc-950/30 p-2 rounded border border-zinc-800/30 italic">
                            &quot;{task.notes}&quot;
                          </div>
                        )}
                        
                        {task.recommendedNextAction && (
                          <div className="bg-blue-900/10 border border-blue-500/20 p-3 rounded-lg flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="text-[10px] text-blue-400 font-bold uppercase mb-1">Recommended Action</div>
                              <div className="text-xs text-zinc-300">{task.recommendedNextAction}</div>
                            </div>
                            <button 
                              onClick={() => {
                                if (task.type === 'review-evidence') setActiveTab('overview');
                                if (task.type === 'review-browser-tab') router.push('/browser');
                                if (task.type === 'outreach-followup') setActiveTab('outreach');
                              }}
                              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded flex items-center gap-1.5 transition-all whitespace-nowrap"
                            >
                              Go to Action <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={async () => {
                              const reason = window.prompt("Reason for blocking this task?");
                              if (reason) await updateTaskWorkflow(task.id, { blockedReason: reason });
                            }}
                            className={`text-[10px] px-2 py-1 rounded border transition-colors ${isBlocked ? 'border-orange-500/40 text-orange-400 bg-orange-500/5' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                          >
                            {isBlocked ? 'Update Block' : 'Block Task'}
                          </button>
                          {isBlocked && (
                            <button 
                              onClick={() => updateTaskWorkflow(task.id, { blockedReason: null })}
                              className="text-[10px] px-2 py-1 rounded border border-emerald-900/50 text-emerald-400 hover:bg-emerald-500/10"
                            >
                              Unblock
                            </button>
                          )}
                          <button 
                            onClick={async () => {
                              const reason = window.prompt("Reason for escalation?");
                              if (reason) await updateTaskWorkflow(task.id, { escalationReason: reason });
                            }}
                            className="text-[10px] px-2 py-1 rounded border border-zinc-800 text-zinc-500 hover:border-red-900/50 hover:text-red-400"
                          >
                            Escalate
                          </button>
                          <button 
                            onClick={() => unlinkEntity(task.linkId)}
                            className="text-[10px] px-2 py-1 rounded border border-zinc-800 text-zinc-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
                            title="Remove forensic link"
                          >
                            Unlink
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {!links.tasks?.length && !showCreateTask && (
                <button onClick={() => setShowCreateTask(true)}
                  className="w-full p-8 border border-zinc-800/40 border-dashed rounded-xl text-sm text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-colors">
                  + Create a task for {selected.name}
                </button>
              )}
            </div>
          )}

          {/* ── Timeline ─────────────────────────────────────────────────── */}
          {activeTab === 'timeline' && (
            <div className="space-y-0 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-zinc-800">
              {notebook.map((entry: any, i: number) => (
                <div key={entry.id || i} className="relative pl-8 pb-6 group">
                  {/* Dot */}
                  <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-zinc-950 flex items-center justify-center transition-colors ${
                    entry.actorType === 'human' ? 'bg-blue-500' :
                    entry.actorType === 'system' ? 'bg-zinc-700' : 'bg-purple-500'
                  }`}>
                    {entry.actorType === 'human' ? <Users className="w-2.5 h-2.5 text-white" /> :
                     entry.entryType === 'sync_error' ? <AlertTriangle className="w-2.5 h-2.5 text-red-400" /> :
                     <Activity className="w-2.5 h-2.5 text-zinc-300" />}
                  </div>
                  
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                      {entry.relatedEntityType || 'system'}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-medium">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-zinc-700 bg-zinc-800/40 px-1.5 py-0.5 rounded">
                      {entry.actorName}
                    </span>
                  </div>
                  
                  <div className="bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/40 group-hover:border-zinc-700/60 transition-colors">
                    <p className="text-sm text-zinc-300 leading-relaxed font-medium">{entry.message}</p>
                    {entry.metadataJson && Object.keys(entry.metadataJson).length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {Object.entries(entry.metadataJson).map(([k, v]: [string, any]) => (
                          <div key={k} className="text-[10px] flex items-center gap-2 bg-black/20 p-1.5 rounded border border-zinc-800/30">
                            <span className="text-zinc-500 font-bold uppercase tracking-tighter">{k}:</span>
                            <span className="text-zinc-400 truncate">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {notebook.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-zinc-700" />
                  </div>
                  <p className="text-sm text-zinc-500">No activity logged for this company yet.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <AnimatePresence>
        {showLinker && selected && (
          <UniversalLinker 
            sourceType="company"
            sourceId={selected.id}
            sourceName={selected.name}
            onClose={() => setShowLinker(false)}
            onSuccess={() => loadDetail(selected)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
