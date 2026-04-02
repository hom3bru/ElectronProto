'use client';

import { useEffect, useState } from 'react';
import { Globe, Shield, ShieldCheck, ShieldX, ShieldAlert, Tag, Zap, FileText, MousePointer } from 'lucide-react';
import { clsx } from 'clsx';

const TRUST_STYLES: Record<string, { icon: any; color: string; bg: string }> = {
  trusted: { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  suspicious: { icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  blocked: { icon: ShieldX, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  unreviewed: { icon: Shield, color: 'text-zinc-500', bg: 'bg-zinc-800/50 border-zinc-700' },
};

export default function SiteProfilesPage() {
  const electron = typeof window !== 'undefined' ? (window as any).electron : null;
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'fields' | 'recipes' | 'annotations' | 'buttons'>('fields');
  const [trustFilter, setTrustFilter] = useState<string>('all');

  const load = async () => {
    const res = await electron?.siteProfile.list();
    if (res?.ok) setProfiles(res.data ?? []);
  };

  const loadDetail = async (id: string) => {
    const res = await electron?.siteProfile.get(id);
    if (res?.ok) setDetail(res.data);
  };

  useEffect(() => { load(); }, [electron]);

  const selectProfile = (p: any) => {
    setSelected(p);
    loadDetail(p.id);
  };

  const updateTrust = async (id: string, trustStatus: string) => {
    await electron?.training.updateSiteProfile(id, { trustStatus, approvedByUser: trustStatus === 'trusted' });
    await load();
    if (selected?.id === id) loadDetail(id);
  };

  const filtered = trustFilter === 'all' ? profiles : profiles.filter(p => p.trustStatus === trustFilter);

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden">
      {/* Left: site list */}
      <div className="w-72 border-r border-zinc-800 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-zinc-400" />
            <h1 className="text-base font-semibold text-zinc-100">Site Profiles</h1>
          </div>
          <select value={trustFilter} onChange={e => setTrustFilter(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-400 focus:outline-none">
            <option value="all">All sites</option>
            <option value="trusted">Trusted</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="suspicious">Suspicious</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-xs text-zinc-600 text-center py-12">No sites yet.<br/>Approve a site in the browser Training panel.</div>
          )}
          {filtered.map((p) => {
            const ts = TRUST_STYLES[p.trustStatus] ?? TRUST_STYLES.unreviewed;
            const Icon = ts.icon;
            return (
              <div key={p.id} onClick={() => selectProfile(p)}
                className={clsx('flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-zinc-800/50 hover:bg-zinc-900/80 transition-colors',
                  selected?.id === p.id && 'bg-zinc-900 border-l-2 border-l-zinc-400'
                )}>
                <Icon className={clsx('w-4 h-4 shrink-0', ts.color)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200 truncate">{p.domain}</div>
                  {p.siteType && <div className="text-[10px] text-zinc-600">{p.siteType}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">Select a site profile</div>
        ) : (
          <div className="p-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-100">{selected.domain}</h2>
                {selected.notes && <p className="text-sm text-zinc-500 mt-1">{selected.notes}</p>}
              </div>
              <div className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold', TRUST_STYLES[selected.trustStatus]?.bg)}>
                <span className={TRUST_STYLES[selected.trustStatus]?.color}>{selected.trustStatus}</span>
              </div>
            </div>

            {/* Trust controls */}
            <div className="flex gap-2">
              {(['trusted', 'suspicious', 'blocked', 'unreviewed'] as const).map((t) => (
                <button key={t} onClick={() => updateTrust(selected.id, t)}
                  className={clsx('text-xs px-2.5 py-1 rounded-md border capitalize transition-all',
                    selected.trustStatus === t
                      ? `${TRUST_STYLES[t].bg} ${TRUST_STYLES[t].color}`
                      : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                  )}>
                  {t}
                </button>
              ))}
            </div>

            {/* Sub-tabs */}
            <div className="border-b border-zinc-800 flex gap-4">
              {([
                { key: 'fields', label: 'Field Profiles', icon: Tag },
                { key: 'recipes', label: 'Recipes', icon: Zap },
                { key: 'annotations', label: 'Annotations', icon: FileText },
                { key: 'buttons', label: 'Action Buttons', icon: MousePointer },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setDetailTab(key as any)}
                  className={clsx('flex items-center gap-1.5 text-sm pb-3 border-b-2 transition-colors',
                    detailTab === key ? 'border-zinc-300 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  )}>
                  <Icon className="w-4 h-4" />{label}
                  <span className="text-[10px] text-zinc-600 ml-1">
                    {detailTab === 'fields' && key === 'fields' ? detail?.fieldProfiles?.length ?? 0 :
                     key === 'recipes' ? detail?.automationRecipes?.length ?? 0 :
                     key === 'annotations' ? detail?.annotations?.length ?? 0 :
                     key === 'buttons' ? detail?.actionButtons?.length ?? 0 : ''}
                  </span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            {detailTab === 'fields' && (
              <div className="space-y-2">
                {(detail?.fieldProfiles ?? []).length === 0 && <div className="text-xs text-zinc-600">No field profiles. Create one in Training mode.</div>}
                {(detail?.fieldProfiles ?? []).map((f: any) => (
                  <div key={f.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-sm font-medium text-zinc-200">{f.fieldName}</span>
                      <span className="text-[10px] text-zinc-600 ml-auto">{f.detectionType}</span>
                    </div>
                    {f.description && <div className="text-xs text-zinc-500 mt-1">{f.description}</div>}
                    {f.selectorRulesJson?.primary && <div className="text-[10px] font-mono text-zinc-600 mt-1">selector: {f.selectorRulesJson.primary}</div>}
                    {f.keywordRulesJson?.length > 0 && <div className="text-[10px] text-zinc-600 mt-1">keywords: {Array.isArray(f.keywordRulesJson) ? f.keywordRulesJson.join(', ') : JSON.stringify(f.keywordRulesJson)}</div>}
                  </div>
                ))}
              </div>
            )}

            {detailTab === 'recipes' && (
              <div className="space-y-2">
                {(detail?.automationRecipes ?? []).length === 0 && <div className="text-xs text-zinc-600">No recipes yet.</div>}
                {(detail?.automationRecipes ?? []).map((r: any) => (
                  <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-sm font-medium text-zinc-200">{r.name}</span>
                      <span className="text-[10px] text-zinc-600 ml-auto">{r.triggerType}</span>
                    </div>
                    {r.description && <div className="text-xs text-zinc-500 mt-1">{r.description}</div>}
                  </div>
                ))}
              </div>
            )}

            {detailTab === 'annotations' && (
              <div className="space-y-2">
                {(detail?.annotations ?? []).length === 0 && <div className="text-xs text-zinc-600">No annotations yet.</div>}
                {(detail?.annotations ?? []).map((a: any) => (
                  <div key={a.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600 font-mono">{a.annotationType}</span>
                      <span className="text-xs text-zinc-400 truncate">{a.pageUrl}</span>
                    </div>
                    {a.note && <div className="text-xs text-zinc-300 mt-1">{a.note}</div>}
                  </div>
                ))}
              </div>
            )}

            {detailTab === 'buttons' && (
              <div className="space-y-2">
                {(detail?.actionButtons ?? []).length === 0 && <div className="text-xs text-zinc-600">No action buttons yet.</div>}
                {(detail?.actionButtons ?? []).map((b: any) => (
                  <div key={b.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <MousePointer className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-sm font-medium text-zinc-200">{b.label}</span>
                      <span className="text-[10px] text-zinc-600 ml-auto">{b.actionType}</span>
                    </div>
                    {b.description && <div className="text-xs text-zinc-500 mt-1">{b.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
