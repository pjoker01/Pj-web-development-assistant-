import React, { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, LogOut, RefreshCw, Search, MessageCircle, ChevronDown, ExternalLink } from 'lucide-react';

type LeadStatus = 'New' | 'Contacted' | 'Discussing' | 'Approved' | 'In Progress' | 'Completed';

interface Lead {
  id: string;
  customer_name: string;
  business_name: string;
  business_type: string;
  location: string;
  customer_whatsapp: string;
  website_goal: string;
  requested_features: string[];
  recommended_package: 'Starter' | 'Business' | 'Premium';
  additional_requirements: string;
  created_at: string;
  lead_status: LeadStatus;
}

const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Discussing', 'Approved', 'In Progress', 'Completed'];

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | LeadStatus>('All');
  const [selected, setSelected] = useState<Lead | null>(null);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/leads', { credentials: 'include' });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      if (!res.ok) throw new Error('Unable to load leads');
      const data = await res.json();
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setAuthed(true);
    } catch {
      setLoginError('I could not load the lead dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setLoginError('Incorrect password.');
        return;
      }
      setPassword('');
      await loadLeads();
    } catch {
      setLoginError('Login failed. Please try again.');
    }
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAuthed(false);
    setLeads([]);
    setSelected(null);
  };

  const updateStatus = async (id: string, status: LeadStatus) => {
    const res = await fetch('/api/admin/leads/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ lead_status: status }),
    });
    if (!res.ok) {
      setLoginError('Could not update that lead. Please try again.');
      return;
    }
    const data = await res.json();
    setLeads(prev => prev.map(l => l.id === id ? data.lead : l));
    setSelected(prev => prev?.id === id ? data.lead : prev);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(l => {
      const matchesStatus = statusFilter === 'All' || l.lead_status === statusFilter;
      const haystack = [l.customer_name, l.business_name, l.business_type, l.location, l.customer_whatsapp, l.recommended_package].join(' ').toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [leads, search, statusFilter]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
        <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-7 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-5">
            <LockKeyhole className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">Private area</p>
          <h1 className="text-2xl font-bold mt-1">PJ Lead Dashboard</h1>
          <p className="text-sm text-slate-500 mt-2 mb-6">This area is only for PJ Web Development.</p>
          <form onSubmit={login} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin password"
              autoFocus
              className="w-full h-12 rounded-xl border border-slate-300 px-4 outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            <button className="w-full h-12 rounded-xl bg-slate-950 text-white font-semibold hover:bg-slate-800">
              Unlock dashboard
            </button>
          </form>
          {loginError && <p className="text-sm text-red-600 mt-3">{loginError}</p>}
          <a href="/" className="inline-flex items-center gap-1 text-xs text-slate-500 mt-6 hover:text-slate-900">
            <ExternalLink className="w-3 h-3" /> Back to assistant
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">PJ Web Development</p>
            <h1 className="text-xl sm:text-2xl font-bold">Lead Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadLeads} className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={logout} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
          {(['All', ...STATUSES] as const).map(status => {
            const count = status === 'All' ? leads.length : leads.filter(l => l.lead_status === status).length;
            const active = statusFilter === status;
            return (
              <button key={status} onClick={() => setStatusFilter(status as any)} className={`text-left rounded-2xl border p-3 transition ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                <div className="text-xs opacity-70">{status}</div>
                <div className="text-xl font-bold mt-1">{count}</div>
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, business, location..." className="flex-1 outline-none text-sm" />
          <span className="text-xs text-slate-400">{filtered.length} shown</span>
        </div>

        {loginError && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{loginError}</div>}

        <div className="space-y-3">
          {filtered.map(lead => (
            <div key={lead.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <button onClick={() => setSelected(lead)} className="text-left flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold truncate">{lead.business_name}</h2>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100">{lead.recommended_package}</span>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700">{lead.lead_status}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{lead.customer_name} · {lead.business_type} · {lead.location}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(lead.created_at).toLocaleString()}</p>
                </button>
                <div className="flex items-center gap-2">
                  <select value={lead.lead_status} onChange={e => updateStatus(lead.id, e.target.value as LeadStatus)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <a href={`https://wa.me/${lead.customer_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="h-10 px-3 rounded-xl bg-emerald-600 text-white inline-flex items-center gap-2 text-sm font-semibold">
                    <MessageCircle className="w-4 h-4" /> <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">No leads match this view.</div>}
        </div>
      </main>

      {selected && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 p-3 sm:p-6 flex items-end sm:items-center justify-center" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-5 sm:p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Lead details</p>
                <h2 className="text-2xl font-bold mt-1">{selected.business_name}</h2>
                <p className="text-sm text-slate-500">{selected.customer_name} · {selected.business_type}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              {[
                ['Location', selected.location],
                ['Customer WhatsApp', selected.customer_whatsapp],
                ['Package', selected.recommended_package],
                ['Status', selected.lead_status],
                ['Created', new Date(selected.created_at).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
                  <div className="font-semibold mt-1">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Website goal</div>
              <p className="mt-1 text-sm leading-relaxed">{selected.website_goal}</p>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Requested features</div>
              <ul className="mt-2 space-y-1 text-sm">{selected.requested_features.map((f, i) => <li key={i}>• {f}</li>)}</ul>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Additional requirements</div>
              <p className="mt-1 text-sm">{selected.additional_requirements || 'None'}</p>
            </div>
            <div className="flex gap-2 mt-6">
              <a href={`https://wa.me/${selected.customer_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center gap-2 font-semibold text-sm"><MessageCircle className="w-4 h-4" /> WhatsApp customer</a>
              <button onClick={() => setSelected(null)} className="px-5 h-11 rounded-xl border border-slate-200 font-semibold text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
