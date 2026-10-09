import { useEffect, useMemo, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Activity, ArrowDownToLine, ArrowUpRight, Clipboard, DollarSign, Layers3,
  Save, Sparkles, Trash2,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const STORAGE_KEY = 'creator-rate-snapshots-v1';
const MULTIPLIERS: Record<string, number> = { Finance: 1.5, Tech: 1.5, Fashion: 1, Comedy: 0.75, Memes: 0.5 };

type CreatorSnapshot = {
  id: string;
  createdAt: string;
  creatorName: string;
  handle: string;
  niche: string;
  followers: number;
  avgLikes: number;
  avgComments: number;
  baseRate: number;
};
type SnapshotForm = Omit<CreatorSnapshot, 'id' | 'createdAt'>;

const blankForm: SnapshotForm = {
  creatorName: '', handle: '', niche: 'Fashion', followers: 0, avgLikes: 0, avgComments: 0, baseRate: 0,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}
function compact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CR';
}
function snapshotEngagement(snapshot: SnapshotForm) {
  if (!snapshot.followers) return 0;
  return ((snapshot.avgLikes + snapshot.avgComments) / snapshot.followers) * 100;
}
function localDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function isSnapshot(value: unknown): value is CreatorSnapshot {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CreatorSnapshot>;
  return typeof item.id === 'string' && typeof item.createdAt === 'string'
    && typeof item.creatorName === 'string' && typeof item.handle === 'string'
    && typeof item.niche === 'string'
    && [item.followers, item.avgLikes, item.avgComments, item.baseRate].every((number) => typeof number === 'number' && Number.isFinite(number));
}

function Home() {
  const [form, setForm] = useState<SnapshotForm>(blankForm);
  const [history, setHistory] = useState<CreatorSnapshot[]>([]);
  const [storageError, setStorageError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [brandName, setBrandName] = useState('');
  const [campaign, setCampaign] = useState('');
  const [pitch, setPitch] = useState('');
  const [pitchFeedback, setPitchFeedback] = useState('');
  const [exportState, setExportState] = useState<'idle' | 'loading' | 'error'>('idle');
  const reportRef = useRef<HTMLDivElement>(null);
  const engagement = snapshotEngagement(form);
  const multiplier = MULTIPLIERS[form.niche] ?? 1;
  const offer = form.baseRate * multiplier;
  const hasBaselineRate = Number.isFinite(form.baseRate) && form.baseRate > 0;
  const hasProfile = form.creatorName.trim().length > 0 && form.followers > 0;
  const chartData = useMemo(() => [...history].reverse().map((item) => ({
    date: new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    engagement: Number(snapshotEngagement(item).toFixed(2)),
    name: item.creatorName,
  })), [history]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setHistory(parsed.filter(isSnapshot));
      }
    } catch {
      setStorageError('Saved snapshots could not be read from this browser. Your current form still works.');
    }
  }, []);

  function updateField<K extends keyof SnapshotForm>(key: K, value: SnapshotForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFeedback('');
    setErrors((current) => ({ ...current, [key]: '' }));
  }
  function persist(next: CreatorSnapshot[]) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setHistory(next);
      setStorageError('');
      return true;
    } catch {
      setStorageError('Could not save to browser storage. Check available storage or privacy settings.');
      return false;
    }
  }
  function validate() {
    const next: Record<string, string> = {};
    if (!form.creatorName.trim()) next.creatorName = 'Enter a creator name.';
    if (!form.handle.trim()) next.handle = 'Enter an Instagram handle.';
    if (!form.niche) next.niche = 'Choose a niche.';
    if (!Number.isFinite(form.followers) || form.followers <= 0) next.followers = 'Followers must be greater than 0.';
    if (!Number.isFinite(form.avgLikes) || form.avgLikes < 0) next.avgLikes = 'Enter a non-negative number.';
    if (!Number.isFinite(form.avgComments) || form.avgComments < 0) next.avgComments = 'Enter a non-negative number.';
    if (!Number.isFinite(form.baseRate) || form.baseRate < 0) next.baseRate = 'Enter a non-negative amount.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    if (!validate()) return;
    const record: CreatorSnapshot = {
      ...form,
      creatorName: form.creatorName.trim(),
      handle: form.handle.trim().replace(/^@/, ''),
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      createdAt: new Date().toISOString(),
    };
    if (persist([record, ...history])) setFeedback('Snapshot saved in this browser.');
  }
  function loadSnapshot(snapshot: CreatorSnapshot) {
    setForm({
      creatorName: snapshot.creatorName,
      handle: snapshot.handle,
      niche: snapshot.niche,
      followers: snapshot.followers,
      avgLikes: snapshot.avgLikes,
      avgComments: snapshot.avgComments,
      baseRate: snapshot.baseRate,
    });
    setErrors({});
    setFeedback(`Loaded ${snapshot.creatorName} into the snapshot form.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function deleteSnapshot(id: string) {
    const snapshot = history.find((item) => item.id === id);
    if (snapshot && !window.confirm(`Delete the saved snapshot for ${snapshot.creatorName}? This cannot be undone.`)) return;
    if (persist(history.filter((item) => item.id !== id))) setFeedback('Saved snapshot deleted.');
  }
  function fieldNumber(key: 'followers' | 'avgLikes' | 'avgComments' | 'baseRate', raw: string) {
    updateField(key, raw === '' ? 0 : Number(raw));
  }
  function createPitch() {
    setPitchFeedback('');
    if (!form.creatorName.trim() || !form.handle.trim() || form.followers <= 0) {
      setPitchFeedback('Add a creator name, Instagram handle, and followers above before drafting.');
      return;
    }
    const brand = brandName.trim() || 'your brand';
    const campaignLine = campaign.trim() ? `\n\nFor ${campaign.trim()}, I’d love to shape a concept that feels natural to my audience and supports your campaign goals.` : '';
    const pricingLine = hasBaselineRate
      ? `Based on my ${form.niche} niche benchmark (${multiplier}×) and a baseline rate of ${formatMoney(form.baseRate)}, my estimated sponsored-post offer is ${formatMoney(offer)}.`
      : 'My sponsored-post rates are available on request.';
    const drafted = `Hi ${brand} team,\n\nI’m ${form.creatorName.trim()} (@${form.handle.trim().replace(/^@/, '')}), a ${form.niche.toLowerCase()} creator connecting with a community of ${compact(form.followers)} on Instagram. My recent average is ${compact(form.avgLikes)} likes and ${compact(form.avgComments)} comments per post, for an engagement rate of ${engagement.toFixed(2)}%.\n\nI’d love to explore a sponsored post together. ${pricingLine}${campaignLine}\n\nIf this feels like a fit, I’d be happy to talk through timing, creative direction, and deliverables.\n\nBest,\n${form.creatorName.trim()}`;
    setPitch(drafted);
    setPitchFeedback('Draft ready. Make any edits before copying.');
  }
  async function copyPitch() {
    if (!pitch.trim()) {
      setPitchFeedback('Draft a pitch first, then copy it here.');
      return;
    }
    try {
      await navigator.clipboard.writeText(pitch);
      setPitchFeedback('Pitch copied to clipboard.');
    } catch {
      setPitchFeedback('Clipboard access was blocked. Select the draft text and copy it manually.');
    }
  }
  async function exportReport() {
    if (!reportRef.current || !hasProfile) return;
    setExportState('loading');
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#242238', scale: 2, useCORS: true, logging: false,
      });
      const link = document.createElement('a');
      link.download = `creator-rate-${(form.handle || 'report').replace(/^@/, '').replace(/[^a-z0-9-]/gi, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setExportState('idle');
    } catch {
      setExportState('error');
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Activity aria-hidden="true" /></span><span>creator rate</span></div>
        <div className="top-meta">
          <div className="local-pill"><span className="local-dot" /><span>Private · stored on this device</span></div>
        </div>
      </header>
      <main className="dashboard">
        <div className="page-heading">
          <div><div className="eyebrow">Creator workspace / 01</div><h1>Your numbers, made pitch-ready.</h1><p>Build a clear snapshot of your Instagram performance and what a partnership could look like.</p></div>
          <div className="header-badge">NO ACCOUNT CONNECTION REQUIRED</div>
        </div>
        {storageError && <div className="status-message status-error" role="alert" data-testid="status-storage-error">{storageError}</div>}
        <div className="content-grid">
          <section>
            <form className="card snapshot-card" onSubmit={handleSave} noValidate>
              <div className="card-title-row">
                <div><div className="section-kicker">Profile snapshot</div><h2 className="card-title" style={{ marginTop: 5 }}>Enter your latest numbers</h2><div className="card-subtitle">A snapshot you provide. Nothing is pulled from Instagram.</div></div>
                <span className="section-number">01 / INPUT</span>
              </div>
              <div className="form-grid">
                <div className="field"><label htmlFor="creator-name">Creator name</label><input id="creator-name" data-testid="input-creator-name" value={form.creatorName} onChange={(e) => updateField('creatorName', e.target.value)} placeholder="e.g. Riley Chen" autoComplete="name" />{errors.creatorName && <div className="error-text" role="alert">{errors.creatorName}</div>}</div>
                <div className="field"><label htmlFor="creator-handle">Instagram handle</label><input id="creator-handle" data-testid="input-creator-handle" value={form.handle} onChange={(e) => updateField('handle', e.target.value)} placeholder="@yourhandle" />{errors.handle && <div className="error-text" role="alert">{errors.handle}</div>}</div>
                <div className="field"><label htmlFor="creator-niche">Creator niche</label><select id="creator-niche" data-testid="select-creator-niche" value={form.niche} onChange={(e) => updateField('niche', e.target.value)}>{Object.keys(MULTIPLIERS).map((niche) => <option key={niche} value={niche}>{niche}</option>)}</select></div>
                <div className="field"><label htmlFor="creator-followers">Followers</label><input id="creator-followers" data-testid="input-followers" type="number" min="1" step="1" value={form.followers || ''} onChange={(e) => fieldNumber('followers', e.target.value)} placeholder="e.g. 24500" />{errors.followers && <div className="error-text" role="alert">{errors.followers}</div>}</div>
                <div className="field"><label htmlFor="creator-likes">Average likes / post</label><input id="creator-likes" data-testid="input-average-likes" type="number" min="0" step="1" value={form.avgLikes || ''} onChange={(e) => fieldNumber('avgLikes', e.target.value)} placeholder="e.g. 1840" />{errors.avgLikes && <div className="error-text" role="alert">{errors.avgLikes}</div>}</div>
                <div className="field"><label htmlFor="creator-comments">Average comments / post</label><input id="creator-comments" data-testid="input-average-comments" type="number" min="0" step="1" value={form.avgComments || ''} onChange={(e) => fieldNumber('avgComments', e.target.value)} placeholder="e.g. 96" />{errors.avgComments && <div className="error-text" role="alert">{errors.avgComments}</div>}</div>
                <div className="field full"><label htmlFor="creator-rate">Your baseline rate per sponsored post</label><div className="input-with-prefix"><span aria-hidden="true">$</span><input id="creator-rate" data-testid="input-baseline-rate" type="number" min="0" step="0.01" value={form.baseRate || ''} onChange={(e) => fieldNumber('baseRate', e.target.value)} placeholder="e.g. 650" /></div><div className="field-hint">Your starting point. The niche adjustment is shown separately below.</div>{errors.baseRate && <div className="error-text" role="alert">{errors.baseRate}</div>}</div>
              </div>
              <div className="form-actions">
                <button className="button button-primary" type="submit" data-testid="button-save-snapshot"><Save aria-hidden="true" />Save snapshot</button>
                <span className="save-feedback" role="status" data-testid="status-save-feedback">{feedback}</span>
              </div>
            </form>
            <div className="metrics-grid" aria-label="Calculated profile metrics">
              <div className="card metric-card"><div className="metric-label">Engagement rate</div><div className="metric-value" data-testid="value-engagement-rate">{hasProfile ? `${engagement.toFixed(2)}%` : '—'}</div><div className="metric-detail">((likes + comments) ÷ followers) × 100</div></div>
              <div className="card metric-card"><div className="metric-label">Average interactions</div><div className="metric-value" data-testid="value-average-interactions">{hasProfile ? compact(form.avgLikes + form.avgComments) : '—'}</div><div className="metric-detail">Likes plus comments per post</div></div>
              <div className="card metric-card"><div className="metric-label">Community size</div><div className="metric-value" data-testid="value-follower-count">{hasProfile ? compact(form.followers) : '—'}</div><div className="metric-detail">Instagram followers</div></div>
              <div className="card metric-card offer-card">
                <div className="offer-top"><span className="offer-overline">Rate estimate</span><span className="offer-label"><DollarSign />per sponsored post</span></div>
                <div className="offer-value" data-testid="value-sponsored-offer">{hasBaselineRate ? formatMoney(offer) : '—'}</div>
                <div className="offer-foot"><span>{hasBaselineRate ? `Baseline ${formatMoney(form.baseRate)} × ${form.niche}` : 'Add a baseline rate to estimate'}</span><span className="multiplier" data-testid="value-niche-multiplier">{multiplier.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}× niche factor</span></div>
              </div>
            </div>
          </section>
          <aside className="side-stack">
            <section className="card chart-card">
              <div className="chart-head"><div><div className="section-kicker">Saved snapshots</div><h2 className="card-title" style={{ marginTop: 5 }}>Engagement over time</h2></div><span className="chart-legend"><i className="legend-dot" />Rate</span></div>
              {chartData.length > 1 ? <div className="chart-wrap" data-testid="chart-engagement-history"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 15, right: 4, left: -22, bottom: 0 }}><defs><linearGradient id="engagementFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8e7cff" stopOpacity={0.3} /><stop offset="95%" stopColor="#8e7cff" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#343644" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#818394', fontSize: 9 }} minTickGap={25} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#818394', fontSize: 9 }} tickFormatter={(v) => `${v}%`} /><ChartTooltip contentStyle={{ background: '#242633', border: '1px solid #454657', borderRadius: 8, fontSize: 11, color: '#eee' }} formatter={(value: number) => [`${value.toFixed(2)}%`, 'Engagement']} /><Area type="monotone" dataKey="engagement" stroke="#9686ff" strokeWidth={2.5} fill="url(#engagementFill)" activeDot={{ r: 4, fill: '#b4aaff', stroke: '#242633', strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div> : <div className="chart-empty" data-testid="empty-engagement-chart">{history.length === 0 ? 'Your saved snapshots will appear here. Save at least two to see how engagement changes.' : 'Save another snapshot to compare engagement over time.'}</div>}
            </section>
            <section className="card history-card">
              <div className="card-title-row" style={{ marginBottom: 0 }}><div><div className="section-kicker">Your browser</div><h2 className="card-title" style={{ marginTop: 5 }}>Snapshot history</h2></div><span className="section-number" data-testid="value-history-count">{history.length} SAVED</span></div>
              {history.length ? <div className="history-list">{history.map((item) => <div className="history-row" key={item.id} data-testid={`row-snapshot-${item.id}`}>
                <div className="history-avatar" aria-hidden="true">{initials(item.creatorName)}</div><div className="history-info"><div className="history-name">{item.creatorName} <span style={{ color: '#787a8b', fontWeight: 400 }}>@{item.handle.replace(/^@/, '')}</span></div><div className="history-date">{localDate(item.createdAt)} · {item.niche}</div></div><div className="history-rate">{snapshotEngagement(item).toFixed(2)}%<small>{compact(item.followers)} followers</small></div><div className="row-actions"><button type="button" className="icon-button" aria-label={`Load ${item.creatorName} snapshot`} title="Load snapshot" onClick={() => loadSnapshot(item)} data-testid={`button-load-snapshot-${item.id}`}><ArrowUpRight /></button><button type="button" className="icon-button" aria-label={`Delete ${item.creatorName} snapshot`} title="Delete snapshot" onClick={() => deleteSnapshot(item.id)} data-testid={`button-delete-snapshot-${item.id}`}><Trash2 /></button></div>
              </div>)}</div> : <div className="empty-history" data-testid="empty-snapshot-history"><div className="empty-icon"><Layers3 /></div>No snapshots saved yet. Add your current numbers to start a private history. No tracking data is made up.</div>}
            </section>
          </aside>
        </div>
        <div className="lower-grid">
          <section className="card pitch-card">
            <div className="card-title-row">
              <div><div className="section-kicker">Partnership outreach</div><h2 className="card-title" style={{ marginTop: 5 }}>Draft your brand pitch</h2><div className="card-subtitle">A practical first draft, grounded in the numbers above.</div></div><span className="section-number">02 / WRITE</span>
            </div>
            <div className="field"><label htmlFor="brand-name">Brand name <span style={{ color: '#7a7c8b', fontWeight: 400 }}>· optional</span></label><input id="brand-name" data-testid="input-brand-name" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. Northstar Skincare" /></div>
            <div className="field"><label htmlFor="campaign-details">Campaign details <span style={{ color: '#7a7c8b', fontWeight: 400 }}>· optional</span></label><textarea id="campaign-details" data-testid="input-campaign-details" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Product launch, key message, timing, or a creative idea…" /></div>
            <div className="pitch-actions"><button className="button button-primary" type="button" onClick={createPitch} data-testid="button-generate-pitch"><Sparkles aria-hidden="true" />{pitch ? 'Refresh draft' : 'Generate pitch'}</button>{pitch && <button className="button button-secondary" type="button" onClick={copyPitch} data-testid="button-copy-pitch"><Clipboard aria-hidden="true" />Copy pitch</button>}</div>
            {pitch && <div className="pitch-output"><label className="section-kicker" htmlFor="pitch-draft">Editable pitch draft</label><textarea id="pitch-draft" data-testid="textarea-pitch-draft" value={pitch} onChange={(e) => setPitch(e.target.value)} aria-label="Editable brand pitch draft" /></div>}
            {pitchFeedback && <div className={`status-message ${pitchFeedback.includes('blocked') || pitchFeedback.includes('first') || pitchFeedback.includes('Add') ? 'status-error' : 'status-success'}`} role="status" data-testid="status-pitch-feedback">{pitchFeedback}</div>}
          </section>
          <section className="card report-card">
            <div className="card-title-row" style={{ marginBottom: 0 }}>
              <div><div className="section-kicker">Shareable snapshot</div><h2 className="card-title" style={{ marginTop: 5 }}>Creator report card</h2></div><span className="section-number">03 / EXPORT</span>
            </div>
            <div className="report-surface" ref={reportRef} data-testid="report-card">
              <div className="report-brand"><span className="brand"><span className="brand-mark"><Activity aria-hidden="true" /></span><span className="report-name">creator rate</span></span><span className="report-tag">CREATOR SNAPSHOT</span></div>
              {hasProfile ? <>
                <div className="report-person" data-testid="report-creator-name">{form.creatorName.trim()}</div><div className="report-handle" data-testid="report-creator-handle">@{form.handle.trim().replace(/^@/, '')} · {form.niche}</div>
                <div className="report-metrics">
                  <div className="report-metric"><span>FOLLOWERS</span><strong data-testid="report-followers">{compact(form.followers)}</strong></div>
                  <div className="report-metric"><span>ENGAGEMENT</span><strong data-testid="report-engagement">{engagement.toFixed(2)}%</strong></div>
                  <div className="report-metric"><span>AVG. INTERACTIONS</span><strong data-testid="report-interactions">{compact(form.avgLikes + form.avgComments)}</strong></div>
                </div>
                <div className="report-offer"><span>{hasBaselineRate ? `Estimated sponsored-post offer · ${multiplier}× niche factor` : 'Sponsored-post rate · baseline not set'}</span><strong data-testid="report-offer">{hasBaselineRate ? formatMoney(offer) : 'On request'}</strong></div>
              </> : <div style={{ padding: '25px 0 14px', color: '#aaaabc', fontSize: 12, lineHeight: 1.6 }}>Your report card will fill in when you add a creator name and follower count.</div>}
              <div className="report-note">Estimate uses your stated baseline rate and published niche multiplier. For planning only.</div>
            </div>
            <div className="export-row"><button className="button button-secondary" type="button" onClick={exportReport} disabled={!hasProfile || exportState === 'loading'} data-testid="button-download-report"><ArrowDownToLine aria-hidden="true" />{exportState === 'loading' ? 'Preparing PNG…' : 'Download PNG'}</button></div>
            {exportState === 'error' && <div className="status-message status-error" role="alert" data-testid="status-export-error">The report could not be exported. Try again, or check your browser’s download permissions.</div>}
            {exportState === 'loading' && <div className="status-message" role="status" style={{ color: '#bdb5ff' }} data-testid="status-export-loading">Rendering your report card at high resolution…</div>}
          </section>
        </div>
        <div className="footer-note"><span>Creator Rate</span> · Your data stays in this browser. Rate estimates are transparent benchmarks, not guarantees.</div>
      </main>
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
