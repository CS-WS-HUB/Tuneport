import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, BadgeCheck, Banknote, BarChart3,
  Bell, Cable, Check, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, CircleHelp,
  Clock3, Copy, CreditCard, FileCheck2, FileSpreadsheet, Gauge, KeyRound, LayoutDashboard,
  LoaderCircle, LogOut, Menu, MoreHorizontal, Plus, Search, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, Users, Wrench, X,
} from 'lucide-react';
import {
  Route, Switch, Link, useLocation, useRoute,
} from 'wouter';
import {
  useAcceptInvitation, useConfirmProjectCompletion, useCreateProject,
  useCreateProjectCheckout, useCreateStripeOnboardingLink, useCreateTenantInvitation,
  useGetAccount, useGetDashboard, useGetProject, useGetProjectPayment,
  useGetStripeConnectStatus, useListActivity, useListAdminTenants,
  useListProjectTelemetry, useListProjects, useListTenantInvitations,
  useListTenantMembers, useListTenants, useRequestUploadUrl, useUpdateAdminTenant,
  useUpdateProject, useUpdateProjectLifecycle, useUpdateTenant,
  useValidateProjectTelemetry, getGetAccountQueryKey, getGetDashboardQueryKey,
  getGetProjectPaymentQueryKey, getGetProjectQueryKey, getGetStripeConnectStatusQueryKey,
  getListActivityQueryKey, getListAdminTenantsQueryKey, getListProjectTelemetryQueryKey,
  getListProjectsQueryKey, getListTenantInvitationsQueryKey, getListTenantMembersQueryKey,
  getListTenantsQueryKey,
} from '@workspace/api-client-react';
import {
  ProjectLifecycle, TenantInvitationRole, TenantStatus, type CalibrationProject,
  type ProjectInput,
} from '@workspace/api-client-react/src/generated/api.schemas';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } });

const lifecycleLabel: Record<string, string> = {
  AWAITING_BUILD_SHEET: 'Build sheet', DIAGNOSTIC_MAPPING: 'Diagnostic mapping',
  LOGGING_PENDING: 'Awaiting logs', CALIBRATION_READY: 'Calibration ready',
  COMPLETION_VERIFIED: 'Completed',
};
const lifecycleOrder = [
  ProjectLifecycle.AWAITING_BUILD_SHEET, ProjectLifecycle.DIAGNOSTIC_MAPPING,
  ProjectLifecycle.LOGGING_PENDING, ProjectLifecycle.CALIBRATION_READY,
  ProjectLifecycle.COMPLETION_VERIFIED,
];
const cash = (cents?: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((cents || 0) / 100);
const dateShort = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const errorText = (error: unknown) => (error as { message?: string })?.message || 'Something went wrong. Please try again.';

function Button({ children, variant = 'primary', className = '', ...props }: {
  children: ReactNode; variant?: 'primary' | 'outline' | 'quiet' | 'danger'; className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="skeleton-stack" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <i key={i} />)}</div>;
}
function QueryState({ loading, error, retry, children }: { loading: boolean; error?: unknown; retry: () => void; children: ReactNode }) {
  if (loading) return <Skeleton />;
  if (error) return <div className="state-card"><CircleAlert size={20} /><strong>We couldn’t load this view.</strong><p>{errorText(error)}</p><Button variant="outline" onClick={retry}>Try again</Button></div>;
  return <>{children}</>;
}
function Empty({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-mark"><FileCheck2 size={21} /></span><strong>{title}</strong><p>{copy}</p>{action}</div>;
}
function StatusPill({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function RootApp() {
  const [tenantId, setTenantId] = useState('');
  const account = useGetAccount();
  const membershipQuery = useListTenants({ query: { queryKey: getListTenantsQueryKey(), enabled: !account.data } });
  const tenants = account.data?.tenants || membershipQuery.data || [];
  const activeTenantId = tenantId || tenants[0]?.id || '';
  const user = account.data?.user;
  const activeTenant = tenants.find((tenant) => tenant.id === activeTenantId);
  const [location] = useLocation();
  const isPublic = location === '/';
  const isAdmin = location.startsWith('/admin');
  const admin = user?.globalRole === 'SUPER_ADMIN';
  const showApp = !isPublic || Boolean(user && activeTenant);

  if (isPublic && !showApp) return <Landing accountLoading={account.isLoading} />;
  if (location.startsWith('/sign-in') || location.startsWith('/sign-up')) return <AuthBranding />;
  if (location === '/invitations/accept') return <InvitationAccept />;
  if (isAdmin && !admin) return <Restricted />;
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand-lockup"><span className="brand-symbol"><Gauge size={20} /></span><span>calibration<span className="brand-light">hub</span><small>WORKSPACE</small></span></Link>
        <div className="tenant-switch">
          <span className="tenant-monogram">{activeTenant?.companyName?.slice(0, 1) || 'C'}</span>
          <select aria-label="Select shop" data-testid="select-tenant" value={activeTenantId} onChange={(e) => setTenantId(e.target.value)}>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.companyName}</option>)}
            {!tenants.length && <option value="">No shop selected</option>}
          </select><ChevronDown size={14} />
        </div>
        <nav className="nav-group">
          <span className="nav-caption">WORKSPACE</span>
          <NavItem href="/dashboard" icon={<LayoutDashboard size={17} />} active={location === '/dashboard'}>Overview</NavItem>
          <NavItem href="/projects" icon={<Wrench size={17} />} active={location.startsWith('/projects')}>Projects</NavItem>
          <NavItem href="/team" icon={<Users size={17} />} active={location === '/team'}>Team</NavItem>
        </nav>
        <nav className="nav-group nav-bottom">
          <span className="nav-caption">ADMINISTRATION</span>
          <NavItem href="/settings" icon={<Settings2 size={17} />} active={location === '/settings'}>Shop settings</NavItem>
          {admin && <NavItem href="/admin/tenants" icon={<ShieldCheck size={17} />} active={location.startsWith('/admin')}>Platform tenants</NavItem>}
        </nav>
        <div className="sidebar-footer">
          <div className="secure-note"><ShieldCheck size={16} /><span>Private by design<small>Tenant data stays scoped</small></span></div>
          <div className="profile-row"><span className="avatar">{user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2) || 'CH'}</span><span className="profile-name">{user?.name || 'Workspace member'}<small>{user?.email || 'Signed in account'}</small></span><button title="Sign out" className="icon-button" onClick={() => { window.location.assign('/sign-in'); }}><LogOut size={16} /></button></div>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar"><div className="breadcrumb"><span>{activeTenant?.companyName || 'Calibration Hub'}</span><ChevronRight size={14} /><span>{navTitle(location)}</span></div><div className="topbar-right"><span className="live-indicator"><i /> System operational</span><button aria-label="Notifications" className="icon-button"><Bell size={17} /></button><span className="topbar-divider" /><span className="topbar-user">{user?.name || 'Workspace'}</span></div></header>
        {tenants.length === 0 && !account.isLoading ? <NoTenant /> : (
          <Switch>
            <Route path="/"><Dashboard tenantId={activeTenantId} /></Route>
            <Route path="/dashboard"><Dashboard tenantId={activeTenantId} /></Route>
            <Route path="/projects/new"><NewProject tenantId={activeTenantId} /></Route>
            <Route path="/projects/:projectId"><ProjectDetails /></Route>
            <Route path="/projects"><Projects tenantId={activeTenantId} /></Route>
            <Route path="/team"><Team tenantId={activeTenantId} /></Route>
            <Route path="/settings"><Settings tenantId={activeTenantId} tenant={activeTenant} /></Route>
            <Route path="/admin/tenants"><AdminTenants /></Route>
            <Route component={NotFound} />
          </Switch>
        )}
      </main>
    </div>
  );
}
function navTitle(path: string) {
  if (path === '/' || path === '/dashboard') return 'Overview';
  if (path.startsWith('/projects/new')) return 'New project';
  if (path.startsWith('/projects/')) return 'Project workspace';
  return ({ '/projects': 'Projects', '/team': 'Team', '/settings': 'Shop settings', '/admin/tenants': 'Platform tenants' } as Record<string, string>)[path] || 'Workspace';
}
function NavItem({ href, icon, active, children }: { href: string; icon: ReactNode; active: boolean; children: ReactNode }) {
  return <Link href={href} className={`nav-item ${active ? 'active' : ''}`} data-testid={`link-nav-${href.replaceAll('/', '-').replace(/^-/, '')}`}>{icon}<span>{children}</span>{active && <i />}</Link>;
}

function Landing({ accountLoading }: { accountLoading: boolean }) {
  return <div className="landing">
    <header className="landing-nav"><Link href="/" className="brand-lockup dark-brand"><span className="brand-symbol"><Gauge size={20} /></span><span>calibration<span className="brand-light">hub</span><small>CALIBRATION OPERATIONS</small></span></Link><nav><a href="#platform">Platform</a><a href="#workflow">How it works</a><a href="#payments">Payments</a></nav><div className="landing-actions"><Link href="/sign-in" className="login-link">Sign in</Link><Link href="/sign-up" className="button button-primary">Create workspace <ArrowRight size={16} /></Link></div></header>
    <section className="hero-section">
      <div className="hero-copy"><div className="eyebrow"><span /> BUILT FOR THE PEOPLE BEHIND THE PULL</div><h1>Good calibration<br />starts <em>before</em> the dyno.</h1><p className="hero-lede">One precise workspace for the shop, the calibrator, and the driver. Build sheets, validated logs, and clear handoffs — all in sync.</p><div className="hero-ctas"><Link href={accountLoading ? '/sign-in' : '/sign-up'} className="button button-primary button-large">Open your workspace <ArrowRight size={17} /></Link><a href="#workflow" className="text-link">See how it works <ArrowDownRight size={16} /></a></div><div className="trust-row"><ShieldCheck size={17} /><span>Tenant-scoped access</span><i /><span>Private telemetry</span><i /><span>Stripe Connect payments</span></div></div>
      <div className="hero-visual" aria-label="Calibration workflow dashboard illustration"><div className="visual-top"><span className="tiny-dot" /><span>LIVE WORKSPACE</span><span className="mono">CH / 08</span></div><div className="visual-project"><div className="visual-project-head"><span className="visual-tag">ACTIVE PROJECT</span><span className="visual-time">updated 4m ago</span></div><h3>2021 Supra<br /><span>3.0L B58 · MG1CS003</span></h3><div className="trace-chart"><div className="trace-grid" /><svg viewBox="0 0 440 132" preserveAspectRatio="none"><path d="M0 100 C46 99 44 88 82 90 S120 74 152 77 S193 63 220 65 S267 40 298 52 S342 23 372 34 S409 14 440 8" /><path className="trace-secondary" d="M0 119 C40 112 60 102 88 106 S130 95 160 96 S197 84 228 88 S275 70 310 75 S353 57 384 62 S414 50 440 48" /></svg><div className="chart-labels"><span>1.8k rpm</span><span>4.2k rpm</span><span>6.8k rpm</span></div></div><div className="visual-data"><div><span>LOG VALIDATION</span><b><CheckCircle2 size={14} /> All checks passed</b></div><div><span>PAYMENT</span><b className="auth-badge"><CreditCard size={13} /> Authorized</b></div></div></div><div className="visual-step"><span className="step-index">03</span><span><b>Logs reviewed</b><small>12 columns · monotonic</small></span><BadgeCheck size={17} /></div><div className="visual-note"><span className="note-line" /><span>From first spec to final handoff.<br /><b>Nothing gets lost in the handoff.</b></span></div></div>
    </section>
    <section className="signal-strip"><span>THE CALIBRATION WORKFLOW, CONNECTED</span><div><span>SHOP</span><ArrowRight size={17} /><span>CALIBRATOR</span><ArrowRight size={17} /><span>DRIVER</span><ArrowRight size={17} /><span>DELIVERY</span></div></section>
    <section className="story-section" id="platform"><div className="section-kicker">THE WORK, IN ONE PLACE <span>01 — 03</span></div><div className="story-heading"><h2>Less chasing.<br /><em>More signal.</em></h2><p>Calibration work moves across people, files, and systems. Hub gives every handoff a clear state and every project a shared source of truth.</p></div><div className="feature-columns"><article className="feature feature-dark"><span className="feature-num">01 / SPEC</span><Cable size={22} /><h3>Start with<br />the hardware.</h3><p>Keep engine architecture, ECU, fuel system, induction, and diagnostics in one build sheet everyone can trust.</p><span className="feature-foot">BUILD SHEETS THAT HOLD UP</span></article><article className="feature feature-mint"><span className="feature-num">02 / VALIDATE</span><FileSpreadsheet size={22} /><h3>Logs that are<br />ready to work.</h3><p>Upload private CSV telemetry and check units, monotonicity, rows, and columns before tuning begins.</p><span className="feature-foot">PRIVATE CSV · VALIDATED FIRST</span></article><article className="feature feature-amber"><span className="feature-num">03 / DELIVER</span><CreditCard size={22} /><h3>Payment state.<br />No guesswork.</h3><p>Temporary card authorization is visible from checkout through capture and transfer. No escrow language, ever.</p><span className="feature-foot">CLEAR STATUS AT EVERY STEP</span></article></div></section>
    <section className="workflow-section" id="workflow"><div className="workflow-side"><div className="section-kicker">A SHARED RUNBOOK <span>02</span></div><h2>One project.<br />Five clear states.</h2><p>Move work forward only when the right details are in place. Every person sees the next meaningful step.</p><Link href="/sign-up" className="text-link">Build your workflow <ArrowRight size={16} /></Link></div><div className="workflow-list">{lifecycleOrder.map((state, i) => <div className={`workflow-row ${i === 2 ? 'current' : ''}`} key={state}><span className="workflow-count">0{i + 1}</span><div><b>{lifecycleLabel[state]}</b><small>{['Record the vehicle and calibration scope.', 'Map diagnostics before changes begin.', 'Add validated telemetry for review.', 'Ready for the calibrator to work.', 'Delivery confirmed by the client.'][i]}</small></div><span className="workflow-check">{i < 2 ? <Check size={15} /> : <ChevronRight size={15} />}</span></div>)}</div></section>
    <section className="payment-section" id="payments"><div className="payment-card"><div className="payment-card-label"><span><CreditCard size={17} /> PAYMENT CONTROL</span><span className="payment-card-serial">CONNECT / 04</span></div><div className="payment-amount">$1,240<span>.00</span></div><div className="payment-line"><span>Card authorization</span><StatusPill tone="mint">Active</StatusPill></div><div className="payment-line"><span>Expires</span><b>in 5 days</b></div><div className="authorization-copy"><CircleHelp size={15} /><span>This is a temporary card authorization, not a charge. Capture and transfer occur after the client confirms delivery. Authorization may expire if not captured in time.</span></div><div className="payment-progress"><i /><i /><i /></div><div className="payment-steps"><span>Authorized</span><span>Captured</span><span>Transferred</span></div></div><div className="payment-copy"><div className="section-kicker">PAYMENTS WITH CONTEXT <span>03</span></div><h2>Clear authorization.<br /><em>Clear expectations.</em></h2><p>Connect your shop through Stripe. Clients authorize a card for a project, then completion confirmation triggers capture and transfer — before the authorization expires.</p><div className="payment-assurance"><ShieldCheck size={19} /><span><b>Not escrow.</b> Funds are not held in escrow. Card authorization is temporary and subject to expiry.</span></div></div></section>
    <section className="closing-section"><span className="closing-mark"><Gauge size={24} /></span><h2>Make the handoff<br /><em>feel as precise as the tune.</em></h2><Link href="/sign-up" className="button button-dark button-large">Create your workspace <ArrowRight size={17} /></Link></section>
    <footer className="landing-footer"><Link href="/" className="footer-brand">calibration<span>hub</span></Link><span>Built for careful work.</span><div><Link href="/sign-in">Sign in</Link><Link href="/sign-up">Create workspace</Link></div></footer>
  </div>;
}

function AuthBranding() {
  const [location] = useLocation();
  const signUp = location.startsWith('/sign-up');
  return <div className="auth-page"><Link href="/" className="brand-lockup dark-brand"><span className="brand-symbol"><Gauge size={20} /></span><span>calibration<span className="brand-light">hub</span><small>CALIBRATION OPERATIONS</small></span></Link><div className="auth-panel"><span className="auth-seal"><KeyRound size={19} /></span><p className="eyebrow">SECURE WORKSPACE ACCESS</p><h1>{signUp ? 'Set up your access.' : 'Welcome back.'}</h1><p>{signUp ? 'Your shop workspace begins with a verified account.' : 'Sign in to continue to your calibration workspace.'}</p><div className="auth-integrity"><ShieldCheck size={17} /><span><b>Private by design</b><small>Workspace access is verified and tenant-scoped.</small></span></div><a className="button button-primary auth-button" href={signUp ? '/sign-up' : '/sign-in'}>{signUp ? 'Continue to secure sign up' : 'Continue to secure sign in'} <ArrowRight size={16} /></a><small className="auth-note">Authentication is handled by your workspace identity provider.</small><Link className="auth-switch" href={signUp ? '/sign-in' : '/sign-up'}>{signUp ? 'Already have access? Sign in' : 'Need an account? Create one'}</Link></div><span className="auth-footer">CALIBRATION HUB · VERIFIED ACCESS</span></div>;
}
function Restricted() {
  return <main className="content"><div className="state-card"><ShieldCheck size={24} /><h2>Platform administrators only</h2><p>This surface is restricted to accounts with the SUPER_ADMIN global role.</p><Link className="button button-outline" href="/dashboard">Return to workspace</Link></div></main>;
}
function NoTenant() {
  return <main className="content"><div className="page-heading"><p className="eyebrow">WORKSPACE ACCESS</p><h1>Choose your shop.</h1></div><Empty title="No tenant membership found" copy="Accept an invitation or contact your shop owner to get access." action={<Link className="button button-primary" href="/invitations/accept">Accept invitation <ArrowRight size={16} /></Link>} /></main>;
}

function Dashboard({ tenantId }: { tenantId: string }) {
  const params = { tenantId };
  const dashboard = useGetDashboard(params, { query: { queryKey: getGetDashboardQueryKey(params), enabled: !!tenantId } });
  const activity = useListActivity({ tenantId, limit: 7 }, { query: { queryKey: getListActivityQueryKey({ tenantId, limit: 7 }), enabled: !!tenantId } });
  const projects = dashboard.data?.recentProjects || [];
  return <main className="content">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">SHOP OVERVIEW <span className="eyebrow-dot" /></p><h1>Good work, in motion.</h1><p className="subheading">A clear view of the projects and handoffs that need your attention.</p></div><Link href="/projects/new" className="button button-primary"><Plus size={17} /> New project</Link></div>
    <QueryState loading={dashboard.isLoading} error={dashboard.error} retry={() => dashboard.refetch()}>
      {dashboard.data && <>
        <div className="metric-grid"><Metric label="Total projects" value={dashboard.data.totalProjects} icon={<Wrench size={17} />} note="all time" /><Metric label="Active work" value={dashboard.data.activeProjects} icon={<Activity size={17} />} note="in progress" accent /><Metric label="Awaiting telemetry" value={dashboard.data.awaitingTelemetry} icon={<FileSpreadsheet size={17} />} note="logs needed" /><Metric label="Authorized cards" value={dashboard.data.authorizedPayments} icon={<CreditCard size={17} />} note="temporary authorization" /></div>
        <div className="dashboard-grid"><section className="panel recent-panel"><PanelTitle title="Recent projects" detail="Latest project movement" action={<Link href="/projects" className="text-link">All projects <ArrowRight size={14} /></Link>} /><div className="project-list">{projects.length ? projects.map((project) => <ProjectListRow project={project} key={project.id} />) : <Empty title="A clean slate" copy="Create a project to begin your shop’s calibration workflow." action={<Link className="button button-outline" href="/projects/new">Create first project <Plus size={15} /></Link>} />}</div></section>
          <section className="panel activity-panel"><PanelTitle title="Activity" detail="Recent shop events" /><QueryState loading={activity.isLoading} error={activity.error} retry={() => activity.refetch()}>{activity.data?.length ? <div className="timeline">{activity.data.map((event) => <div className="timeline-item" key={event.id}><span className="timeline-dot" /><div><b>{event.action}</b><p>{event.summary}</p><small>{event.actorName || 'Workspace'} · {dateShort(event.createdAt)}</small></div></div>)}</div> : <Empty title="No activity yet" copy="Project updates and handoffs will appear here." />}</QueryState></section></div>
        <div className="workflow-banner"><span className="banner-icon"><Sparkles size={18} /></span><span><b>{dashboard.data.awaitingCompletion} project{dashboard.data.awaitingCompletion === 1 ? '' : 's'} awaiting delivery confirmation</b><small>Client confirmation captures the temporary authorization and transfers funds through Stripe Connect.</small></span><Link href="/projects" className="banner-action">Review <ArrowRight size={15} /></Link></div>
      </>}
    </QueryState>
  </main>;
}
function Metric({ label, value, icon, note, accent = false }: { label: string; value: number; icon: ReactNode; note: string; accent?: boolean }) {
  return <div className={`metric-card ${accent ? 'metric-accent' : ''}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value.toLocaleString('en-US')}</strong><small>{note}</small></div>;
}
function PanelTitle({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="panel-title"><div><h2>{title}</h2><p>{detail}</p></div>{action}</div>;
}
function ProjectListRow({ project }: { project: CalibrationProject }) {
  const vehicle = [project.vehicleYear, project.vehicleMake, project.vehicleModel].filter(Boolean).join(' ') || 'Vehicle details pending';
  return <Link href={`/projects/${project.id}`} className="project-row" data-testid={`project-row-${project.id}`}><span className="vehicle-stamp"><Gauge size={18} /></span><span className="project-row-main"><b>{vehicle}</b><small>{project.engineArchitecture} · {project.ecuTargetPlatform}</small></span><StatusPill>{lifecycleLabel[project.lifecycleState]}</StatusPill><span className="project-row-price">{cash(project.priceAmountCents)}</span><ChevronRight className="row-chevron" size={16} /></Link>;
}

function Projects({ tenantId }: { tenantId: string }) {
  const [search, setSearch] = useState('');
  const [lifecycleState, setLifecycle] = useState('');
  const params = useMemo(() => ({ tenantId, limit: 50, ...(search ? { search } : {}), ...(lifecycleState ? { lifecycleState: lifecycleState as typeof ProjectLifecycle[keyof typeof ProjectLifecycle] } : {}) }), [tenantId, search, lifecycleState]);
  const projects = useListProjects(params, { query: { queryKey: getListProjectsQueryKey(params), enabled: !!tenantId } });
  return <main className="content">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">PROJECT REGISTER</p><h1>Projects</h1><p className="subheading">Search builds, check their lifecycle, and keep the next handoff visible.</p></div><Link href="/projects/new" className="button button-primary"><Plus size={17} /> New project</Link></div>
    <div className="filter-bar"><label className="search-field"><Search size={17} /><input data-testid="input-search-projects" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle, engine, or ECU" /><kbd>/</kbd></label><label className="filter-select"><SlidersHorizontal size={16} /><select data-testid="select-project-status" value={lifecycleState} onChange={(e) => setLifecycle(e.target.value)}><option value="">Every lifecycle</option>{lifecycleOrder.map((state) => <option value={state} key={state}>{lifecycleLabel[state]}</option>)}</select></label><span className="result-note">{projects.data?.length ?? '—'} records</span></div>
    <section className="panel table-panel"><div className="table-head"><span>VEHICLE / PROJECT</span><span>LIFECYCLE</span><span>CLIENT</span><span>AMOUNT</span><span>UPDATED</span></div><QueryState loading={projects.isLoading} error={projects.error} retry={() => projects.refetch()}>{projects.data?.length ? projects.data.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="table-row" data-testid={`project-row-${project.id}`}><span className="table-vehicle"><span className="vehicle-stamp"><Gauge size={17} /></span><span><b>{[project.vehicleYear, project.vehicleMake, project.vehicleModel].filter(Boolean).join(' ') || 'Vehicle details pending'}</b><small>{project.engineArchitecture} · {project.ecuTargetPlatform}</small></span></span><span><StatusPill>{lifecycleLabel[project.lifecycleState]}</StatusPill></span><span className="muted-cell">{project.clientName || 'Client pending'}</span><b className="amount-cell">{cash(project.priceAmountCents)}</b><span className="muted-cell">{dateShort(project.updatedAt)}</span></Link>) : <Empty title="No matching projects" copy={search || lifecycleState ? 'Try a broader search or remove the lifecycle filter.' : 'Your project register is ready for its first build sheet.'} action={!search && !lifecycleState ? <Link className="button button-outline" href="/projects/new">Create project <Plus size={15} /></Link> : undefined} />}</QueryState></section>
  </main>;
}

function NewProject({ tenantId }: { tenantId: string }) {
  const createProject = useCreateProject();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [error, setError] = useState('');
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('');
    const data = new FormData(e.currentTarget);
    const value: ProjectInput = {
      tenantId, engineArchitecture: String(data.get('engineArchitecture')), ecuTargetPlatform: String(data.get('ecuTargetPlatform')),
      vehicleMake: String(data.get('vehicleMake') || '') || null, vehicleModel: String(data.get('vehicleModel') || '') || null,
      vehicleYear: Number(data.get('vehicleYear')) || null, injectorFlowRatingCc: Number(data.get('injectorFlowRatingCc')),
      inductionSpecs: { induction: String(data.get('induction') || ''), boost: String(data.get('boost') || '') },
      diagnosticTroubleCodes: String(data.get('diagnostics') || '').split(',').map((code) => code.trim()).filter(Boolean),
      priceAmountCents: Math.round(Number(data.get('price')) * 100),
    };
    createProject.mutate({ data: value }, { onSuccess: (project) => { qc.invalidateQueries({ queryKey: getListProjectsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey({ tenantId }) }); setLocation(`/projects/${project.id}`); }, onError: (err) => setError(errorText(err)) });
  };
  return <main className="content narrow-content"><Link href="/projects" className="back-link"><ArrowLeft size={16} /> Back to projects</Link><div className="page-heading"><p className="eyebrow">NEW CALIBRATION BUILD</p><h1>Start with the details.</h1><p className="subheading">Create the shared build sheet before the work begins.</p></div><form className="form-panel" onSubmit={submit}>
    <div className="form-section"><div className="form-section-title"><span>01</span><div><b>Vehicle</b><small>Identify the platform being calibrated.</small></div></div><div className="field-grid three-col"><Field label="Make"><input name="vehicleMake" placeholder="Toyota" data-testid="input-vehicle-make" /></Field><Field label="Model"><input name="vehicleModel" placeholder="GR Supra" data-testid="input-vehicle-model" /></Field><Field label="Year"><input name="vehicleYear" type="number" min="1900" max="2100" placeholder="2021" data-testid="input-vehicle-year" /></Field></div></div>
    <div className="form-section"><div className="form-section-title"><span>02</span><div><b>Engine & ECU</b><small>Record the hardware and target platform.</small></div></div><div className="field-grid two-col"><Field label="Engine architecture"><input name="engineArchitecture" required placeholder="3.0L inline-six · B58" data-testid="input-engine" /></Field><Field label="ECU target platform"><input name="ecuTargetPlatform" required placeholder="Bosch MG1CS003" data-testid="input-ecu" /></Field><Field label="Injector flow rating" hint="cc/min"><input name="injectorFlowRatingCc" required type="number" min="1" placeholder="980" data-testid="input-injector-flow" /></Field><Field label="Induction type"><input name="induction" placeholder="Single turbo, direct injection" data-testid="input-induction" /></Field><Field label="Boost specification" hint="Optional"><input name="boost" placeholder="24 psi target" data-testid="input-boost" /></Field><Field label="Diagnostic trouble codes" hint="Comma separated"><input name="diagnostics" placeholder="P0299, P0300" data-testid="input-diagnostics" /></Field></div></div>
    <div className="form-section"><div className="form-section-title"><span>03</span><div><b>Project amount</b><small>Price to be authorized at checkout.</small></div></div><Field label="Calibration amount (USD)"><div className="money-input"><span>$</span><input name="price" type="number" min="1" step="0.01" required placeholder="1,240.00" data-testid="input-price" /></div><small>Payment is a temporary card authorization, not escrow. Capture and transfer follow client confirmation.</small></Field></div>
    {error && <p className="inline-error"><CircleAlert size={15} /> {error}</p>}<div className="form-actions"><Link className="button button-quiet" href="/projects">Cancel</Link><Button type="submit" disabled={createProject.isPending}>{createProject.isPending ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Create build sheet</Button></div>
  </form></main>;
}

function ProjectDetails() {
  const [match, params] = useRoute('/projects/:projectId');
  const projectId = match ? params.projectId : '';
  const projectQuery = useGetProject(projectId, { query: { queryKey: getGetProjectQueryKey(projectId), enabled: !!projectId } });
  const logs = useListProjectTelemetry(projectId, { query: { queryKey: getListProjectTelemetryQueryKey(projectId), enabled: !!projectId } });
  const payment = useGetProjectPayment(projectId, { query: { queryKey: getGetProjectPaymentQueryKey(projectId), enabled: !!projectId } });
  const updateLifecycle = useUpdateProjectLifecycle();
  const updateProject = useUpdateProject();
  const requestUpload = useRequestUploadUrl();
  const validate = useValidateProjectTelemetry();
  const checkout = useCreateProjectCheckout();
  const complete = useConfirmProjectCompletion();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [expectedX, setExpectedX] = useState('rpm');
  const [expectedY, setExpectedY] = useState('load');
  const [busyUpload, setBusyUpload] = useState(false);
  const project = projectQuery.data;
  const invalidateProject = () => {
    qc.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) }); qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetProjectPaymentQueryKey(projectId) });
    qc.invalidateQueries({ queryKey: getListProjectTelemetryQueryKey(projectId) });
  };
  const next = project ? lifecycleOrder[lifecycleOrder.indexOf(project.lifecycleState) + 1] : undefined;
  const onUpload = async (file?: File) => {
    if (!file || !project) return;
    setError(''); setBusyUpload(true);
    try {
      const grant = await requestUpload.mutateAsync({ data: { projectId, name: file.name, size: file.size, contentType: file.type === 'text/csv' ? 'text/csv' : 'application/octet-stream' } });
      const response = await fetch(grant.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!response.ok) throw new Error('Upload could not be completed. Try again.');
      await validate.mutateAsync({ projectId, data: { objectPath: grant.objectPath, filename: file.name, expectedXUnit: expectedX, expectedYUnit: expectedY } });
      invalidateProject();
    } catch (err) { setError(errorText(err)); }
    finally { setBusyUpload(false); }
  };
  return <main className="content">
    <Link href="/projects" className="back-link"><ArrowLeft size={16} /> Project register</Link>
    <QueryState loading={projectQuery.isLoading} error={projectQuery.error} retry={() => projectQuery.refetch()}>{project && <>
      <div className="project-heading"><div><p className="eyebrow">PROJECT / {project.id.slice(0, 8).toUpperCase()}</p><h1>{[project.vehicleYear, project.vehicleMake, project.vehicleModel].filter(Boolean).join(' ') || project.engineArchitecture}</h1><p className="subheading">{project.engineArchitecture} <span>·</span> {project.ecuTargetPlatform}</p></div><div className="heading-actions"><StatusPill>{lifecycleLabel[project.lifecycleState]}</StatusPill>{next && <Button disabled={updateLifecycle.isPending} onClick={() => updateLifecycle.mutate({ projectId, data: { lifecycleState: next } }, { onSuccess: invalidateProject, onError: (err) => setError(errorText(err)) })}>Advance to {lifecycleLabel[next]} <ArrowRight size={15} /></Button>}</div></div>
      <div className="project-detail-grid"><div className="detail-main">
        <section className="panel lifecycle-panel"><PanelTitle title="Lifecycle" detail="Project handoff status" /><div className="lifecycle-track">{lifecycleOrder.map((step, i) => { const current = lifecycleOrder.indexOf(project.lifecycleState); return <div className={`lifecycle-step ${i <= current ? 'done' : ''} ${i === current ? 'now' : ''}`} key={step}><span className="lifecycle-dot">{i < current ? <Check size={12} /> : `0${i + 1}`}</span><b>{lifecycleLabel[step]}</b></div>; })}</div></section>
        <section className="panel build-panel"><PanelTitle title="Build sheet" detail="Vehicle and calibration specifications" action={<button className="text-link" onClick={() => { const updated = window.prompt('Assign calibrator name', project.assignedCalibratorName || ''); if (updated !== null) updateProject.mutate({ projectId, data: { ecuTargetPlatform: project.ecuTargetPlatform } }, { onSuccess: invalidateProject }); }}> <MoreHorizontal size={17} /> </button>} /><div className="spec-grid"><Spec label="Vehicle" value={[project.vehicleYear, project.vehicleMake, project.vehicleModel].filter(Boolean).join(' ') || 'Not specified'} /><Spec label="Engine architecture" value={project.engineArchitecture} /><Spec label="ECU target" value={project.ecuTargetPlatform} /><Spec label="Injector flow" value={`${project.injectorFlowRatingCc} cc/min`} /><Spec label="Induction" value={Object.values(project.inductionSpecs || {}).filter(Boolean).join(' · ') || 'Not specified'} /><Spec label="Diagnostic codes" value={project.diagnosticTroubleCodes?.join(', ') || 'None recorded'} /></div></section>
        <section className="panel telemetry-panel"><PanelTitle title="Telemetry validation" detail="Private CSV files · checked before calibration" action={<StatusPill tone="mint"><ShieldCheck size={12} /> Private</StatusPill>} /><div className="upload-controls"><Field label="X-axis unit"><input value={expectedX} onChange={(e) => setExpectedX(e.target.value)} data-testid="input-x-unit" /></Field><Field label="Y-axis unit"><input value={expectedY} onChange={(e) => setExpectedY(e.target.value)} data-testid="input-y-unit" /></Field></div><label className={`upload-drop ${busyUpload ? 'uploading' : ''}`}><input type="file" accept=".csv,text/csv" disabled={busyUpload} onChange={(e) => onUpload(e.target.files?.[0])} data-testid="input-telemetry-upload" /><span className="upload-icon">{busyUpload ? <LoaderCircle className="spin" size={20} /> : <Plus size={20} />}</span><b>{busyUpload ? 'Uploading and validating…' : 'Choose a telemetry CSV'}</b><small>Private file · up to 25 MB · CSV format</small></label>{error && <p className="inline-error"><CircleAlert size={15} /> {error}</p>}
          <QueryState loading={logs.isLoading} error={logs.error} retry={() => logs.refetch()}>{logs.data?.length ? <div className="log-list">{logs.data.map((log) => <div className="log-row" key={log.id}><span className="log-icon"><FileSpreadsheet size={17} /></span><span className="log-main"><b>{log.filename}</b><small>{log.detectedRows.toLocaleString()} rows · {log.detectedCols} columns · {log.isMonotonic ? 'monotonic' : 'non-monotonic'}</small>{log.errors.length > 0 && <small className="log-errors">{log.errors.join(' · ')}</small>}</span><StatusPill tone={log.validationStatus === 'VALID' ? 'mint' : log.validationStatus === 'WARNING' ? 'amber' : 'red'}>{log.validationStatus}</StatusPill></div>)}</div> : <Empty title="No telemetry files" copy="Upload a private CSV to validate its units and data sequence." />}</QueryState>
        </section>
      </div><aside className="detail-rail"><section className="panel payment-state-panel"><PanelTitle title="Payment" detail="Stripe Connect" /><QueryState loading={payment.isLoading} error={payment.error} retry={() => payment.refetch()}>{payment.data ? <><div className="payment-state"><span className="payment-icon"><CreditCard size={19} /></span><b>{payment.data.state.replaceAll('_', ' ')}</b></div><div className="rail-pair"><span>Project amount</span><b>{cash(payment.data.amountCents)}</b></div><div className="rail-pair"><span>Platform fee</span><b>{cash(payment.data.applicationFeeCents)}</b></div>{payment.data.authorizationExpiresAt && <div className="expiry-note"><Clock3 size={14} /><span>Temporary authorization expires {dateShort(payment.data.authorizationExpiresAt)}. Capture must occur before expiry.</span></div>}{payment.data.state === 'AUTHORIZED' && <Button className="full-button" onClick={() => complete.mutate({ projectId, data: { confirmDelivery: true } }, { onSuccess: invalidateProject, onError: (err) => setError(errorText(err)) })} disabled={complete.isPending}>Confirm delivery & capture</Button>}<small className="not-escrow">Temporary card authorization only. Not escrow.</small></> : <><p className="rail-copy">Authorize a client card for this project using a secure Stripe Checkout session.</p><Button className="full-button" onClick={() => checkout.mutate({ projectId }, { onSuccess: (result) => window.location.assign(result.checkoutUrl), onError: (err) => setError(errorText(err)) })} disabled={checkout.isPending}>{checkout.isPending ? 'Preparing secure checkout…' : 'Start card authorization'} <ArrowRight size={15} /></Button><small className="not-escrow">Authorization is temporary and expires if not captured. No escrow.</small></>}</QueryState>{error && <p className="inline-error"><CircleAlert size={15} /> {error}</p>}</section>
        <section className="panel client-panel"><PanelTitle title="Project contacts" detail="People in this handoff" /><Spec label="Client" value={project.clientName || 'Not assigned'} /><Spec label="Calibrator" value={project.assignedCalibratorName || 'Not assigned'} /><Spec label="Created" value={dateShort(project.createdAt)} /></section>
        <div className="rail-security"><ShieldCheck size={17} /><span><b>Scoped access</b><small>Project files are private to this shop and its invited members.</small></span></div>
      </aside></div>
    </>}</QueryState>
  </main>;
}
function Spec({ label, value }: { label: string; value: string }) {
  return <div className="spec"><span>{label}</span><b>{value}</b></div>;
}

function Team({ tenantId }: { tenantId: string }) {
  const members = useListTenantMembers(tenantId, { query: { queryKey: getListTenantMembersQueryKey(tenantId), enabled: !!tenantId } });
  const invitations = useListTenantInvitations(tenantId, { query: { queryKey: getListTenantInvitationsQueryKey(tenantId), enabled: !!tenantId } });
  const createInvite = useCreateTenantInvitation();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const submitInvite = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    createInvite.mutate({ tenantId, data: { email: String(form.get('email')), role: String(form.get('role')) as typeof TenantInvitationRole[keyof typeof TenantInvitationRole] } }, {
      onSuccess: (created) => { setInviteUrl(created.inviteUrl); qc.invalidateQueries({ queryKey: getListTenantInvitationsQueryKey(tenantId) }); },
      onError: (err) => setError(errorText(err)),
    });
  };
  const copyInvite = async () => { await navigator.clipboard?.writeText(inviteUrl); };
  return <main className="content">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">PEOPLE & ACCESS</p><h1>Team</h1><p className="subheading">Invite calibrators and clients into this tenant workspace.</p></div><Button onClick={() => { setInviteOpen(true); setInviteUrl(''); setError(''); }}><Plus size={16} /> Invite member</Button></div>
    <div className="team-layout"><section className="panel"><PanelTitle title="Members" detail="Active tenant access" /><QueryState loading={members.isLoading} error={members.error} retry={() => members.refetch()}>{members.data?.length ? <div className="member-list">{members.data.map((member) => <div className="member-row" key={member.id}><span className="avatar member-avatar">{member.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span className="member-details"><b>{member.name}</b><small>{member.email}</small></span><StatusPill>{member.role.replaceAll('_', ' ')}</StatusPill><span className="member-date">Joined {dateShort(member.joinedAt)}</span></div>)}</div> : <Empty title="No team members yet" copy="When members accept an invitation, they’ll appear here." />}</QueryState></section>
      <section className="panel"><PanelTitle title="Invitations" detail="Pending and recent invitations" /><QueryState loading={invitations.isLoading} error={invitations.error} retry={() => invitations.refetch()}>{invitations.data?.length ? <div className="invite-list">{invitations.data.map((invite) => <div key={invite.id} className="invite-row"><span className="invite-status"><Clock3 size={15} /></span><span><b>{invite.email}</b><small>{invite.role.replaceAll('_', ' ')} · expires {dateShort(invite.expiresAt)}</small></span><StatusPill tone={invite.status === 'PENDING' ? 'amber' : ''}>{invite.status}</StatusPill></div>)}</div> : <Empty title="No invitations sent" copy="Invite a calibrator or client to work with your shop." action={<Button variant="outline" onClick={() => setInviteOpen(true)}>Invite someone <Plus size={15} /></Button>} />}</QueryState></section></div>
    {inviteOpen && <div className="modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setInviteOpen(false); }}><div className="modal"><button className="modal-close" aria-label="Close invitation dialog" onClick={() => setInviteOpen(false)}><X size={17} /></button>{inviteUrl ? <><span className="modal-icon success"><Check size={19} /></span><p className="eyebrow">INVITATION CREATED</p><h2>Ready to share.</h2><p className="modal-copy">This invitation link is private. Share it directly with the invited person.</p><div className="copy-field"><input readOnly value={inviteUrl} /><Button variant="outline" onClick={copyInvite}><Copy size={15} /> Copy</Button></div><Button className="full-button" onClick={() => setInviteOpen(false)}>Done</Button></> : <><span className="modal-icon"><Users size={19} /></span><p className="eyebrow">TENANT INVITATION</p><h2>Bring the right people in.</h2><form onSubmit={submitInvite}><Field label="Email address"><input name="email" type="email" required placeholder="calibrator@shop.com" data-testid="input-invite-email" /></Field><Field label="Workspace role"><select name="role" defaultValue="STAFF_CALIBRATOR" data-testid="select-invite-role"><option value="STAFF_CALIBRATOR">Staff calibrator</option><option value="END_USER_CLIENT">End-user client</option></select></Field>{error && <p className="inline-error">{error}</p>}<Button className="full-button" type="submit" disabled={createInvite.isPending}>{createInvite.isPending ? 'Creating invitation…' : 'Create invitation'} <ArrowRight size={15} /></Button></form><small className="modal-footnote">Invitations expire automatically. Only the selected tenant is granted access.</small></>}</div></div>}
  </main>;
}

function Settings({ tenantId, tenant }: { tenantId: string; tenant?: { id: string; companyName: string; corporateSlug: string; status: string; stripeConnected?: boolean } }) {
  const updateTenant = useUpdateTenant();
  const connect = useCreateStripeOnboardingLink();
  const status = useGetStripeConnectStatus(tenantId, { query: { queryKey: getGetStripeConnectStatusQueryKey(tenantId), enabled: !!tenantId } });
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const save = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const form = new FormData(e.currentTarget); setError(''); updateTenant.mutate({ tenantId, data: { companyName: String(form.get('companyName')) } }, { onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: getListTenantsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAccountQueryKey() }); }, onError: (err) => setError(errorText(err)) }); };
  return <main className="content">
    <div className="page-heading"><p className="eyebrow">TENANT CONFIGURATION</p><h1>Shop settings</h1><p className="subheading">Manage your shop profile and payment connection.</p></div>
    <div className="settings-layout"><section className="panel settings-panel"><PanelTitle title="Shop profile" detail="Your tenant identity in Calibration Hub" /><form onSubmit={save}><Field label="Company name"><input name="companyName" required minLength={2} maxLength={120} defaultValue={tenant?.companyName || ''} data-testid="input-company-name" /></Field><Field label="Workspace slug"><input value={tenant?.corporateSlug || ''} readOnly data-testid="input-workspace-slug" /><small>Workspace URLs are managed by the platform.</small></Field><div className="settings-meta"><span>Tenant status</span><StatusPill tone={tenant?.status === 'ACTIVE' ? 'mint' : 'amber'}>{tenant?.status || 'Unknown'}</StatusPill></div>{error && <p className="inline-error">{error}</p>}{saved && <p className="inline-success"><CheckCircle2 size={15} /> Shop details saved.</p>}<Button disabled={updateTenant.isPending}>{updateTenant.isPending ? 'Saving…' : 'Save changes'} <Check size={15} /></Button></form></section>
      <section className="panel connect-panel"><div className="connect-head"><span className="connect-icon"><CreditCard size={20} /></span><span><p className="eyebrow">STRIPE CONNECT</p><h2>Receive project payments</h2></span></div><p className="connect-copy">Connect your shop to enable temporary card authorizations, capture after confirmed delivery, and transfer to your account.</p><QueryState loading={status.isLoading} error={status.error} retry={() => status.refetch()}>{status.data && <div className="connect-checks">{[['Account connected', status.data.connected], ['Onboarding complete', status.data.onboardingComplete], ['Card charges enabled', status.data.chargesEnabled], ['Payouts enabled', status.data.payoutsEnabled]].map(([label, value]) => <div key={String(label)}><span>{label}</span>{value ? <StatusPill tone="mint"><Check size={11} /> Ready</StatusPill> : <StatusPill tone="amber">Needs setup</StatusPill>}</div>)}</div>}</QueryState><div className="connect-disclosure"><CircleHelp size={15} /><span>Card authorizations are temporary and may expire. Payments are not escrow; capture and transfer occur after completion confirmation.</span></div><Button className="full-button" onClick={() => connect.mutate({ tenantId }, { onSuccess: (result) => window.location.assign(result.accountLinkUrl), onError: (err) => setError(errorText(err)) })} disabled={connect.isPending}>{connect.isPending ? 'Preparing secure setup…' : status.data?.onboardingComplete ? 'Review Stripe account' : 'Continue Stripe onboarding'} <ArrowRight size={15} /></Button>{error && <p className="inline-error">{error}</p>}</section></div>
  </main>;
}

function InvitationAccept() {
  const [location, setLocation] = useLocation();
  const token = new URLSearchParams(location.split('?')[1] || '').get('token') || '';
  const accept = useAcceptInvitation();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); setError(''); accept.mutate({ data: { token } }, { onSuccess: (tenant) => { qc.invalidateQueries({ queryKey: getListTenantsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAccountQueryKey() }); setLocation('/dashboard'); }, onError: (err) => setError(errorText(err)) }); };
  return <div className="auth-page"><Link href="/" className="brand-lockup dark-brand"><span className="brand-symbol"><Gauge size={20} /></span><span>calibration<span className="brand-light">hub</span><small>CALIBRATION OPERATIONS</small></span></Link><div className="auth-panel"><span className="auth-seal"><Users size={19} /></span><p className="eyebrow">TENANT INVITATION</p><h1>Join the workspace.</h1><p>Accept your private invitation to access a calibration shop.</p>{!token && <div className="invite-token-entry"><label className="field"><span>Invitation token</span><input value={token} onChange={() => {}} placeholder="Open the complete invite link" readOnly /></label><p>Open the full invitation URL provided by your shop to continue.</p></div>}{error && <p className="inline-error">{error}</p>}<Button className="auth-button" onClick={submit} disabled={!token || accept.isPending}>{accept.isPending ? 'Accepting invitation…' : 'Accept invitation'} <ArrowRight size={16} /></Button><Link className="auth-switch" href="/sign-in">Sign in to your account</Link></div><span className="auth-footer">CALIBRATION HUB · VERIFIED ACCESS</span></div>;
}

function AdminTenants() {
  const tenants = useListAdminTenants();
  const update = useUpdateAdminTenant();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const params = useMemo(() => status ? { status: status as typeof TenantStatus[keyof typeof TenantStatus] } : undefined, [status]);
  const list = useListAdminTenants(params, { query: { queryKey: getListAdminTenantsQueryKey(params), enabled: true } });
  const mutation = (tenantId: string, next: typeof TenantStatus[keyof typeof TenantStatus]) => update.mutate({ tenantId, data: { status: next } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAdminTenantsQueryKey() }); qc.invalidateQueries({ queryKey: getListTenantsQueryKey() }); }, onError: () => undefined });
  return <main className="content"><div className="page-heading dashboard-heading"><div><p className="eyebrow">PLATFORM CONTROL</p><h1>Tenant administration</h1><p className="subheading">Restricted platform view for tenant status management.</p></div><StatusPill tone="mint"><ShieldCheck size={12} /> SUPER_ADMIN</StatusPill></div><div className="admin-filter"><label className="filter-select"><SlidersHorizontal size={16} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All tenant statuses</option>{Object.values(TenantStatus).map((v) => <option value={v} key={v}>{v}</option>)}</select></label></div><section className="panel table-panel"><div className="table-head admin-head"><span>TENANT</span><span>SLUG</span><span>STATUS</span><span>CREATED</span><span>ACTION</span></div><QueryState loading={list.isLoading || tenants.isLoading} error={list.error || tenants.error} retry={() => { list.refetch(); tenants.refetch(); }}>{list.data?.length ? list.data.map((tenant) => <div className="table-row admin-row" key={tenant.id}><span><b>{tenant.companyName}</b><small>{tenant.id}</small></span><span className="muted-cell">{tenant.corporateSlug}</span><span><StatusPill tone={tenant.status === 'ACTIVE' ? 'mint' : 'amber'}>{tenant.status}</StatusPill></span><span className="muted-cell">{dateShort(tenant.createdAt)}</span><span className="admin-actions"><select value={tenant.status} aria-label={`Set ${tenant.companyName} status`} onChange={(e) => mutation(tenant.id, e.target.value as typeof TenantStatus[keyof typeof TenantStatus])}><option value="PROVISIONING">Provisioning</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="TERMINATED">Terminated</option></select></span></div>) : <Empty title="No tenants found" copy={status ? 'Try selecting another tenant status.' : 'Platform tenants will appear here.'} />}</QueryState></section></main>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><RootApp /></ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Switch>
    <Route path="/sign-in/:rest*"><AuthBranding /></Route><Route path="/sign-up/:rest*"><AuthBranding /></Route>
    <Route path="/"><Router /></Route><Route path="/dashboard"><Router /></Route><Route path="/projects/new"><Router /></Route><Route path="/projects/:projectId"><Router /></Route><Route path="/projects"><Router /></Route><Route path="/team"><Router /></Route><Route path="/settings"><Router /></Route><Route path="/invitations/accept"><InvitationAccept /></Route><Route path="/admin/tenants"><Router /></Route><Route><NotFound /></Route>
  </Switch><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
