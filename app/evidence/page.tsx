'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileSearch, Link as LinkIcon, AlertTriangle, X, Check, Ban,
  Search, Filter, ChevronDown, Edit3, Trash2, ExternalLink,
  Shield, Activity, Globe, Inbox, MessageSquare, Plus, Save,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvidenceFilters {
  type?: string;
  reviewerStatus?: string;
  contradictionFlag?: boolean;
  search?: string;
}

const REVIEWER_STATUS = ['pending', 'confirmed', 'disputed', 'retracted'] as const;
const EVIDENCE_TYPES = ['claim', 'quote', 'screenshot', 'document', 'data_point', 'attribute'] as const;

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-zinc-800 text-zinc-400',
  confirmed: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  disputed:  'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  retracted: 'bg-red-500/10 text-red-500 border border-red-500/20',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function unwrap<T>(res: any, fallback: T): T {
  if (!res) return fallback;
  if (typeof res === 'object' && 'ok' in res) return res.ok ? res.data : fallback;
  return res;
}

function ConfidenceBar({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-zinc-600 text-xs">—</span>;
  const pct = Math.round(value * 100);
  const color = value > 0.7 ? 'bg-emerald-500' : value > 0.4 ? 'bg-blue-500' : 'bg-amber-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-zinc-400 tabular-nums w-7 text-right">{pct}%</span>
    </div>
  );
}

function Pill({ label, colorMap }: { label?: string | null; colorMap: Record<string, string> }) {
  if (!label) return null;
  const cls = colorMap[label] || 'bg-zinc-800 text-zinc-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EvidencePage() {
  const router = useRouter();
  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  const [evidence,         setEvidence]         = useState<any[]>([]);
  const [selected,         setSelected]          = useState<any | null>(null);
  const [companies,        setCompanies]         = useState<any[]>([]);
  const [filters,          setFilters]           = useState<EvidenceFilters>({});
  const [showFilters,      setShowFilters]        = useState(false);
  const [showLinkPicker,   setShowLinkPicker]    = useState(false);
  const [linkSearch,       setLinkSearch]        = useState('');
  const [editingClaim,     setEditingClaim]      = useState(false);
  const [claimDraft,       setClaimDraft]        = useState('');
  const [showCreateForm,   setShowCreateForm]    = useState(false);
  const [newFrag,          setNewFrag]           = useState({ claimSummary: '', quote: '', url: '', type: 'claim', extractedBy: 'human' });
  const claimRef = useRef<HTMLTextAreaElement>(null);

  // ─── Data ─────────────────────────────────────────────────────────────────

  const loadEvidence = useCallback(async () => {
    if (!electron) return;
    const res = await electron.evidence.getFragments(filters);
    setEvidence(unwrap(res, []));
  }, [electron, filters]);

  const loadCompanies = useCallback(async () => {
    if (!electron) return;
    const res = await electron.crm.getCompanies();
    setCompanies(unwrap(res, []));
  }, [electron]);

  useEffect(() => { loadEvidence(); }, [loadEvidence]);
  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const select = (item: any) => {
    setSelected(item);
    setEditingClaim(false);
    setClaimDraft(item.claimSummary ?? '');
    setShowLinkPicker(false);
  };

  // ─── Mutations ────────────────────────────────────────────────────────────

  const setStatus = async (fragmentId: string, status: string) => {
    if (!electron) return;
    await electron.evidence.review(fragmentId, status);
    await reload(fragmentId);
  };

  const toggleContradiction = async (fragmentId: string, current: boolean) => {
    if (!electron) return;
    const reason = current ? undefined : window.prompt('Describe the contradiction (optional):') || undefined;
    await electron.evidence.setContradiction(fragmentId, !current, reason);
    await reload(fragmentId);
  };

  const saveClaim = async () => {
    if (!electron || !selected || !claimDraft.trim()) return;
    await electron.evidence.updateClaim(selected.id, claimDraft.trim());
    setEditingClaim(false);
    await reload(selected.id);
  };

  const updateConfidence = async (fragmentId: string, value: number) => {
    if (!electron) return;
    await electron.evidence.updateConfidence(fragmentId, value);
    await reload(fragmentId);
  };

  const deleteFragment = async (fragmentId: string) => {
    if (!electron) return;
    const ok = window.confirm('Permanently delete this evidence fragment? This cannot be undone.');
    if (!ok) return;
    await electron.evidence.delete(fragmentId);
    setSelected(null);
    await loadEvidence();
  };

  const linkToCompany = async (companyId: string) => {
    if (!electron || !selected) return;
    await electron.evidence.linkToCompany(selected.id, companyId);
    setShowLinkPicker(false);
    await reload(selected.id);
  };

  const createFragment = async () => {
    if (!electron || !newFrag.claimSummary.trim()) return;
    await electron.evidence.createFragment(
      newFrag.claimSummary.trim(),
      'manual',
      'manual',
      {
        quote: newFrag.quote.trim() || undefined,
        url: newFrag.url.trim() || undefined,
        type: newFrag.type,
        extractedBy: newFrag.extractedBy || 'human',
      },
    );
    setNewFrag({ claimSummary: '', quote: '', url: '', type: 'claim', extractedBy: 'human' });
    setShowCreateForm(false);
    await loadEvidence();
  };

  /** Reload a single fragment in the list without refetching everything. */
  const reload = async (fragmentId: string) => {
    if (!electron) return;
    const res = await electron.evidence.getFragment(fragmentId);
    const updated = unwrap(res, null);
    if (updated) {
      setEvidence(prev => prev.map(e => e.id === fragmentId ? updated : e));
      if (selected?.id === fragmentId) setSelected(updated);
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const filteredCompanies = companies.filter(c =>
    !linkSearch || c.name?.toLowerCase().includes(linkSearch.toLowerCase()) || c.domain?.toLowerCase().includes(linkSearch.toLowerCase())
  );

  const pendingCount = evidence.filter(e => e.reviewerStatus === 'pending').length;
  const contradictedCount = evidence.filter(e => e.contradictionFlag).length;

  // ─── Source navigation ────────────────────────────────────────────────────

  const navigateToSource = () => {
    if (!selected) return;
    if (selected.sourceType === 'inbox_message' || selected.inboxMessageId) router.push('/inbox');
    else if (selected.sourceType === 'browser_tab' || selected.browserTabId) router.push('/browser');
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full overflow-hidden">

      {/* ── Left panel: list + filters ─────────────────────────────────────── */}
      <div className={`flex flex-col h-full overflow-hidden border-r border-zinc-800 ${selected ? 'w-[420px] shrink-0' : 'flex-1'}`}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Evidence Store</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                <span>{evidence.length} fragment{evidence.length !== 1 ? 's' : ''}</span>
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Shield className="w-3 h-3" />{pendingCount} pending review
                  </span>
                )}
                {contradictedCount > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertTriangle className="w-3 h-3" />{contradictedCount} contradicted
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  showFilters || Object.keys(filters).some(k => filters[k as keyof EvidenceFilters] !== undefined)
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800'
                }`}>
                <Filter className="w-3 h-3" /> Filter
              </button>
              <button onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors">
                <Plus className="w-3 h-3" /> New
              </button>
            </div>
          </div>

          {/* Filter bar */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800">
              {/* Search */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 flex-1 min-w-[160px]">
                <Search className="w-3 h-3 text-zinc-600 shrink-0" />
                <input
                  value={filters.search ?? ''}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value || undefined }))}
                  placeholder="Search claims..."
                  className="bg-transparent text-xs outline-none flex-1 text-zinc-200 placeholder-zinc-600"
                />
              </div>

              {/* Type filter */}
              <select value={filters.type ?? ''} onChange={e => setFilters(f => ({ ...f, type: e.target.value || undefined }))}
                className="text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none">
                <option value="">All types</option>
                {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              {/* Status filter */}
              <select value={filters.reviewerStatus ?? ''} onChange={e => setFilters(f => ({ ...f, reviewerStatus: e.target.value || undefined }))}
                className="text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none">
                <option value="">All statuses</option>
                {REVIEWER_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Contradiction toggle */}
              <button
                onClick={() => setFilters(f => ({ ...f, contradictionFlag: f.contradictionFlag === true ? undefined : true }))}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  filters.contradictionFlag === true
                    ? 'bg-red-500/15 text-red-400 border-red-500/20'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                }`}>
                ⚠ Contradicted only
              </button>

              {/* Clear */}
              {Object.values(filters).some(v => v !== undefined) && (
                <button onClick={() => setFilters({})} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
            <h3 className="text-sm font-semibold mb-3">New Evidence Fragment</h3>
            <div className="space-y-2">
              <textarea
                value={newFrag.claimSummary}
                onChange={e => setNewFrag(p => ({ ...p, claimSummary: e.target.value }))}
                placeholder="Claim summary *"
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input value={newFrag.quote} onChange={e => setNewFrag(p => ({ ...p, quote: e.target.value }))}
                  placeholder="Quote (optional)" className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                <input value={newFrag.url} onChange={e => setNewFrag(p => ({ ...p, url: e.target.value }))}
                  placeholder="Source URL (optional)" className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={newFrag.type} onChange={e => setNewFrag(p => ({ ...p, type: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none">
                  {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={newFrag.extractedBy} onChange={e => setNewFrag(p => ({ ...p, extractedBy: e.target.value }))}
                  placeholder="Extracted by" className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowCreateForm(false)} className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5">Cancel</button>
                <button onClick={createFragment} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded transition-colors">Create Fragment</button>
              </div>
            </div>
          </div>
        )}

        {/* Card list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {evidence.length === 0 && (
            <div className="text-center py-16 text-zinc-600 text-sm">
              {Object.values(filters).some(v => v !== undefined)
                ? 'No fragments match the current filters.'
                : 'No evidence fragments yet. Create one or extract from a message.'}
            </div>
          )}

          {evidence.map((item) => (
            <div
              key={item.id}
              onClick={() => select(item)}
              className={`relative bg-zinc-900 border rounded-lg p-4 cursor-pointer transition-all hover:border-zinc-600 ${
                selected?.id === item.id ? 'border-blue-500/50 shadow-[0_0_0_1px_rgba(59,130,246,0.1)]' : 'border-zinc-800'
              } ${item.contradictionFlag ? 'border-l-2 border-l-red-500/60' : ''}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{item.type}</span>
                  {item.reviewerStatus && (
                    <Pill label={item.reviewerStatus} colorMap={STATUS_COLORS} />
                  )}
                  {item.contradictionFlag && (
                    <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3" /> Contradiction
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-600 shrink-0">
                  {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ''}
                </span>
              </div>

              <p className="text-sm text-zinc-200 line-clamp-2 mb-2">{item.claimSummary}</p>

              <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                <span>{item.sourceType}</span>
                {item.extractedBy && <span>by {item.extractedBy}</span>}
                {item.companyId && <span className="text-blue-500/70">● linked</span>}
              </div>

              {item.confidence != null && (
                <div className="mt-2">
                  <ConfidenceBar value={item.confidence} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: detail + actions ─────────────────────────────────── */}
      {selected && (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">

          {/* Panel header */}
          <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-blue-400" />
              <h2 className="font-semibold text-sm">Evidence Detail</h2>
              <Pill label={selected.reviewerStatus} colorMap={STATUS_COLORS} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => deleteFragment(selected.id)}
                className="p-1.5 text-zinc-600 hover:text-red-400 rounded hover:bg-zinc-800 transition-colors" title="Delete fragment">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setSelected(null)} className="p-1.5 text-zinc-500 hover:text-white rounded hover:bg-zinc-800 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Claim — editable */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Claim</span>
                <button onClick={() => { setEditingClaim(!editingClaim); setClaimDraft(selected.claimSummary ?? ''); }}
                  className="text-xs text-zinc-600 hover:text-blue-400 flex items-center gap-1 transition-colors">
                  <Edit3 className="w-3 h-3" /> {editingClaim ? 'Cancel' : 'Edit'}
                </button>
              </div>
              {editingClaim ? (
                <div className="space-y-2">
                  <textarea ref={claimRef} value={claimDraft} onChange={e => setClaimDraft(e.target.value)}
                    rows={4} autoFocus
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingClaim(false)} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1">Cancel</button>
                    <button onClick={saveClaim} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded flex items-center gap-1 transition-colors">
                      <Save className="w-3 h-3" /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-200 leading-relaxed">{selected.claimSummary}</p>
              )}
            </section>

            {/* Quote */}
            {selected.quote && (
              <section>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Quote</div>
                <blockquote className="border-l-2 border-blue-500/40 pl-3 py-1.5 text-sm text-zinc-400 italic leading-relaxed">
                  "{selected.quote}"
                </blockquote>
              </section>
            )}

            {/* Review actions */}
            <section>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Review</div>
              <div className="flex flex-wrap gap-2">
                {(['pending', 'confirmed', 'disputed', 'retracted'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setStatus(selected.id, status)}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      selected.reviewerStatus === status
                        ? STATUS_COLORS[status]
                        : 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    {status === 'confirmed' && <Check className="w-3 h-3 inline mr-1" />}
                    {status === 'disputed'  && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                    {status === 'retracted' && <Ban className="w-3 h-3 inline mr-1" />}
                    {status}
                  </button>
                ))}
              </div>
            </section>

            {/* Contradiction */}
            <section>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Contradiction Flag</div>
              <button onClick={() => toggleContradiction(selected.id, !!selected.contradictionFlag)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-medium w-full transition-colors ${
                  selected.contradictionFlag
                    ? 'bg-red-500/15 text-red-400 border-red-500/20'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-600'
                }`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                {selected.contradictionFlag ? 'Contradiction flagged — click to clear' : 'Flag as contradicting other evidence'}
              </button>
            </section>

            {/* Confidence */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Confidence</span>
                <span className="text-xs text-zinc-400">{selected.confidence != null ? `${Math.round(selected.confidence * 100)}%` : 'Unset'}</span>
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={selected.confidence != null ? Math.round(selected.confidence * 100) : 50}
                onChange={e => updateConfidence(selected.id, parseInt(e.target.value) / 100)}
                className="w-full accent-blue-500"
              />
              <ConfidenceBar value={selected.confidence} />
            </section>

            {/* Source traceability */}
            <section>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Provenance</div>
              <div className="space-y-1.5 text-xs divide-y divide-zinc-800/40">
                {[
                  ['Source Type',   selected.sourceType],
                  ['Extracted By',  selected.extractedBy],
                  ['URL',           selected.url],
                  ['Captured',      selected.timestamp ? new Date(selected.timestamp).toLocaleString() : null],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label as string} className="flex justify-between py-1.5">
                    <span className="text-zinc-600">{label}</span>
                    {label === 'URL' ? (
                      <a href={val as string} target="_blank" rel="noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 truncate ml-2 max-w-[60%]">
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{val}</span>
                      </a>
                    ) : (
                      <span className="text-zinc-300">{String(val)}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Jump to source */}
              {(selected.inboxMessageId || selected.browserTabId ||
                selected.sourceType === 'inbox_message' || selected.sourceType === 'browser_tab') && (
                <button onClick={navigateToSource}
                  className="mt-3 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  {selected.sourceType === 'inbox_message' || selected.inboxMessageId
                    ? <><Inbox className="w-3 h-3" /> Jump to message in Inbox</>
                    : <><Globe className="w-3 h-3" /> Jump to tab in Browser</>
                  }
                </button>
              )}
            </section>

            {/* Link to company */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Company Link</span>
                <button onClick={() => { setShowLinkPicker(!showLinkPicker); setLinkSearch(''); }}
                  className="text-xs text-zinc-600 hover:text-blue-400 flex items-center gap-1 transition-colors">
                  <LinkIcon className="w-3 h-3" /> {selected.companyId ? 'Relink' : 'Link to Company'}
                </button>
              </div>

              {selected.companyId && !showLinkPicker && (
                <div className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                  <span className="text-sm text-zinc-300">
                    {companies.find(c => c.id === selected.companyId)?.name ?? selected.companyId}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); electron.evidence.unlinkFromCompany(selected.id, selected.companyId).then(() => reload(selected.id)); }}
                    className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {showLinkPicker && (
                <div className="border border-zinc-700 rounded-lg overflow-hidden bg-zinc-900">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
                    <Search className="w-3 h-3 text-zinc-600" />
                    <input autoFocus value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                      placeholder="Search companies..."
                      className="bg-transparent text-sm outline-none flex-1 text-zinc-200 placeholder-zinc-600" />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredCompanies.map(c => (
                      <button key={c.id} onClick={() => linkToCompany(c.id)}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors">
                        <div className="text-sm text-zinc-200">{c.name}</div>
                        {c.domain && <div className="text-xs text-zinc-600">{c.domain}</div>}
                      </button>
                    ))}
                    {filteredCompanies.length === 0 && (
                      <div className="px-3 py-4 text-xs text-zinc-600 text-center">No companies match</div>
                    )}
                  </div>
                </div>
              )}
            </section>

          </div>
        </div>
      )}
    </div>
  );
}
