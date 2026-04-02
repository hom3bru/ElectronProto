'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Link as LinkIcon, Building2, CheckSquare, Mail, FileText, ChevronRight, Info, AlertCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** A utility for cleaner tailwind classes */
function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface UniversalLinkerProps {
  sourceType: string;
  sourceId: string;
  sourceName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type EntityType = 'company' | 'task' | 'message' | 'evidence';

const ENTITY_CONFIG: Record<EntityType, { icon: any; label: string; color: string }> = {
  company:  { icon: Building2,   label: 'Company',  color: 'text-blue-400' },
  task:     { icon: CheckSquare, label: 'Task',     color: 'text-purple-400' },
  message:  { icon: Mail,        label: 'Message',  color: 'text-amber-400' },
  evidence: { icon: FileText,    label: 'Evidence', color: 'text-emerald-400' },
};

const LINK_TYPES = [
  'mentions',
  'related_to',
  'blocking',
  'evidence_for',
  'contradicts',
  'escalated_for',
  'part_of',
];

export default function UniversalLinker({ sourceType, sourceId, sourceName, onClose, onSuccess }: UniversalLinkerProps) {
  const electron = (window as any).electron;
  
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [linkType, setLinkType] = useState('related_to');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search logic
  useEffect(() => {
    if (!search.trim() || search.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Multi-domain search
        const [companies, tasks, threads] = await Promise.all([
          electron.crm.getCompanies(),
          electron.tasks.getTasks(),
          electron.inbox.getThreads()
        ]);

        const all = [
          ...((companies.ok ? companies.data : companies) || []).map((c: any) => ({ ...c, type: 'company', label: c.name, sub: c.domain })),
          ...((tasks.ok ? tasks.data : tasks) || []).map((t: any) => ({ ...t, type: 'task', label: t.title, sub: t.status })),
          ...((threads.ok ? threads.data : threads) || []).map((t: any) => ({ ...t, type: 'message', label: t.subject || 'No Subject', sub: t.latestMsg?.from })),
        ];

        const filtered = all.filter(item => 
          (item.label?.toLowerCase() || '').includes(search.toLowerCase()) ||
          (item.sub?.toLowerCase() || '').includes(search.toLowerCase())
        );

        setResults(filtered.slice(0, 10));
      } catch (e) {
        console.error("Search failed", e);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, electron]);

  const handleLink = async () => {
    if (!selectedEntity) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await electron.link.create({
        sourceType,
        sourceId,
        targetType: selectedEntity.type,
        targetId: selectedEntity.id,
        linkType,
        metadata: {
          reason,
          timestamp: new Date().toISOString(),
          context: `Created via Universal Linker on ${sourceType} view`
        }
      });

      if (res.ok) {
        onSuccess?.();
        onClose();
      } else {
        setError(res.error?.message || 'Failed to create link');
      }
    } catch (e: any) {
      setError(e.message || 'Internal Error');
    }
    setSubmitting(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <LinkIcon className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">Forensic Linker</h2>
              <p className="text-[10px] text-zinc-500 font-medium">Linking from <span className="text-zinc-300">{sourceName || sourceId}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          
          <AnimatePresence mode="wait">
            {!selectedEntity ? (
              <motion.div 
                key="search"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input 
                    autoFocus
                    placeholder="Search for Entity (Company, Task, Message)..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-all shadow-inner"
                  />
                  {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                  {results.length > 0 ? (
                    results.map((item) => {
                      const cfg = ENTITY_CONFIG[item.type as EntityType];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          onClick={() => setSelectedEntity(item)}
                          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-900 transition-all border border-transparent hover:border-zinc-800 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn("w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:border-zinc-700", cfg.color)}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="text-left min-w-0">
                              <div className="text-sm font-semibold text-zinc-200 truncate">{item.label}</div>
                              <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{cfg.label} • {item.sub}</div>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                        </button>
                      );
                    })
                  ) : search.length >= 2 && !loading && (
                    <div className="py-10 text-center space-y-2">
                      <Info className="w-8 h-8 text-zinc-800 mx-auto" />
                      <p className="text-sm text-zinc-600">No matching entities found.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="confirm"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                {/* Target Entity Card */}
                <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800", ENTITY_CONFIG[selectedEntity.type as EntityType].color)}>
                      {React.createElement(ENTITY_CONFIG[selectedEntity.type as EntityType].icon, { className: "w-6 h-6" })}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-zinc-100">{selectedEntity.label}</h4>
                      <p className="text-xs text-zinc-500 font-medium">{ENTITY_CONFIG[selectedEntity.type as EntityType].label}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedEntity(null)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider px-3 py-1.5 hover:bg-blue-500/10 rounded-lg transition-all"
                  >
                    Change
                  </button>
                </div>

                {/* Link Configuration */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Relationship</label>
                      <select 
                        value={linkType}
                        onChange={e => setLinkType(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                      >
                        {LINK_TYPES.map(t => (
                          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Forensic Context / Reason</label>
                    <textarea 
                      placeholder="Why are these entities being linked? (Auditable note)"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      rows={3}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-3 px-6 pb-6">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors"
          >
            Cancel
          </button>
          <button 
            disabled={!selectedEntity || submitting}
            onClick={handleLink}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2",
              selectedEntity 
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
                : "bg-zinc-800 text-zinc-600 border border-zinc-700 cursor-not-allowed"
            )}
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Establish Link
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
