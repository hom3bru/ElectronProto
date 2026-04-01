'use client';

import { useEffect, useState } from 'react';
import { Company } from '@/packages/shared/types';
import { Building2, Globe, MapPin, Activity } from 'lucide-react';

export default function CRMPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const electron = typeof window !== 'undefined' ? (window as any).electron : null;

  useEffect(() => {
    if (electron) {
      electron.db.getCompanies().then(setCompanies);
    } else {
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
    }
  }, [electron]);

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
          <div key={company.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 transition-colors cursor-pointer">
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
