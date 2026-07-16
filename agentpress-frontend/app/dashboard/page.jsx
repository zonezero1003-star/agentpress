'use client';

import { useState, useEffect } from 'react';
import {
  Store, ShoppingBag, Receipt, MessageCircle, Calculator, Calendar,
  Truck, Megaphone, Star, ChevronRight, ChevronLeft, Check, Wallet,
  Fingerprint, Radio, Sparkles, Grid3x3, Plus, Loader2, AlertCircle
} from 'lucide-react';
import { api } from '../../lib/api';

const ICONS = {
  orders: ShoppingBag, invoicing: Receipt, support: MessageCircle, books: Calculator,
  scheduling: Calendar, supplier: Truck, marketing: Megaphone, reputation: Star,
};

const INK = '#0B1220';
const SUB = '#5B6472';
const SURFACE = '#F2F9FF';
const LINE = '#E1ECF7';
const SKY = '#0EA5E9';
const SKY_DEEP = '#0284C7';
const SAGE = '#16A34A';
const DEMO_ITEMS = [
  { name: 'Jollof rice tray (large)', customer: 'Ada O.', address: '12 Allen Ave, Lagos' },
  { name: 'Ankara fabric, 6 yds', customer: 'Chuka N.', address: '4 Ogui Rd, Enugu' },
  { name: 'Shea butter, 500g x2', customer: 'Bimpe A.', address: '9 Ring Rd, Ibadan' },
];

function StepRail({ step }) {
  const steps = [
    { id: 'overview', label: 'Overview', icon: Store },
    { id: 'skills', label: 'Skills', icon: Grid3x3 },
    { id: 'configure', label: 'Build', icon: Sparkles },
    { id: 'preview', label: 'Deploy', icon: Fingerprint },
    { id: 'live', label: 'Live', icon: Radio },
  ];
  const order = steps.map((s) => s.id);
  const activeIdx = order.indexOf(step);
  return (
    <div className="hidden sm:flex flex-col gap-1 w-44 shrink-0 pr-4 border-r" style={{ borderColor: LINE }}>
      {steps.map((s, i) => {
        const Icon = s.icon;
        const active = i === activeIdx;
        const done = i < activeIdx;
        return (
          <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-md"
            style={{ color: active ? INK : done ? SAGE : SUB, background: active ? SURFACE : 'transparent' }}>
            <Icon size={15} />
            <span className="f-mono text-xs tracking-wide">{s.label}</span>
            {done && <Check size={12} className="ml-auto" style={{ color: SAGE }} />}
          </div>
        );
      })}
    </div>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2 p-3 rounded-md mb-4 text-sm" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
      <AlertCircle size={15} /> {message}
    </div>
  );
}

function Ticket({ order, onFulfill, fulfilling }) {
  const items = Array.isArray(order.items) ? order.items : [];
  return (
    <div className="f-mono text-xs p-3 mb-3 rounded-md" style={{ background: SURFACE, border: `1px dashed ${LINE}`, color: INK }}>
      <div className="flex justify-between" style={{ color: SUB }}>
        <span>TICKET #{order.id.slice(0, 8)}</span>
        <span>{new Date(order.created_at).toLocaleTimeString()}</span>
      </div>
      <div className="mt-1">{items.map((it) => `${it.qty}x ${it.name}`).join(', ')}</div>
      <div style={{ color: SUB }}>{order.customer_name || order.customer_contact} · {order.shipping_address}</div>
      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: `1px dashed ${LINE}` }}>
        <span className="px-2 py-0.5 rounded-full text-[10px]"
          style={{
            background: order.status === 'fulfilled' ? 'rgba(22,163,74,0.12)' : 'rgba(14,165,233,0.12)',
            color: order.status === 'fulfilled' ? SAGE : SKY_DEEP,
          }}>
          {order.status === 'fulfilled' ? 'Fulfilled' : 'New — awaiting you'}
        </span>
        {order.status !== 'fulfilled' && (
          <button onClick={() => onFulfill(order.id)} disabled={fulfilling === order.id}
            className="f-mono text-[10px] px-2 py-1 rounded" style={{ background: SKY, color: '#fff' }}>
            {fulfilling === order.id ? 'Marking...' : 'Mark fulfilled →'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [step, setStep] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [skillsCatalog, setSkillsCatalog] = useState([]);
  const [selected, setSelected] = useState(['orders', 'invoicing']);

  const [businessId, setBusinessId] = useState(null);
  const [agentId, setAgentId] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const [orderCfg, setOrderCfg] = useState({ catalog: '', fulfillment: 'manual', notifyVia: 'whatsapp' });
  const [invCfg, setInvCfg] = useState({ currency: 'USDG', escrow: true });
  const [maxSpend, setMaxSpend] = useState(0);

  const [manifest, setManifest] = useState(null);
  const [deployedAgent, setDeployedAgent] = useState(null);
  const [deploying, setDeploying] = useState(false);

  const [serviceDrafts, setServiceDrafts] = useState({});
  const [services, setServices] = useState([]);

  const [tickets, setTickets] = useState([]);
  const [fulfilling, setFulfilling] = useState(null);

  useEffect(() => {
    api.getSkills().then(setSkillsCatalog).catch((e) => setError(e.message));
  }, []);

  const selectedSkills = skillsCatalog.filter((s) => selected.includes(s.id));

  function toggleSkill(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function toggleServiceDraft(skillId, skillName) {
    setServiceDrafts((prev) => {
      const next = { ...prev };
      if (next[skillId]) {
        delete next[skillId];
      } else {
        next[skillId] = { name: skillName, price: '1.00', description: '' };
      }
      return next;
    });
  }

  function updateServiceDraft(skillId, field, value) {
    setServiceDrafts((prev) => ({ ...prev, [skillId]: { ...prev[skillId], [field]: value } }));
  }

  async function reviewDeployment() {
    setLoading(true);
    setError(null);
    try {
      let bId = businessId;
      let aId = agentId;

      if (!bId) {
        const business = await api.createBusiness({ name: businessName, owner_email: ownerEmail });
        bId = business.id;
        setBusinessId(bId);
      }
      if (!aId) {
        const agent = await api.createAgent({ business_id: bId, name: agentName });
        aId = agent.id;
        setAgentId(aId);
      } else {
        await api.updateAgent(aId, { name: agentName });
      }

      const skillsPayload = selected.map((id) => ({
        skill_id: id,
        config: id === 'orders' ? orderCfg : id === 'invoicing' ? invCfg : {},
      }));
      await api.setAgentSkills(aId, skillsPayload);
      await api.setGuardrails(aId, { max_spend_per_transaction: Number(maxSpend) || 0 });

      // Publish-as-service bridge: create a draft service per skill the
      // owner opted to list. Defaults to A2MCP (flat price, no negotiation).
      for (const [skillId, draft] of Object.entries(serviceDrafts)) {
        await api.createService(aId, {
          source_skill_id: skillId,
          name: draft.name,
          description: draft.description || `${draft.name} — provided by ${agentName}`,
          price: Number(draft.price) || 1,
          currency: 'USDG',
          pricing_model: 'fixed',
          service_type: 'A2MCP',
        });
      }

      await api.generateManifest(aId);
      const latestManifest = await api.getManifest(aId);
      setManifest(latestManifest);

      setStep('preview');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function deployAgent() {
    setDeploying(true);
    setError(null);
    try {
      const result = await api.deployAgent(agentId);
      if (!result.success) {
        setError(`Deployment stalled at "${result.failedStep}": ${result.error}`);
        setDeploying(false);
        return;
      }
      setDeployedAgent(result.agent);

      // Publish every drafted service now that the agent is a registered ASP.
      const createdServices = await api.getServices(agentId);
      for (const svc of createdServices) {
        if (!svc.listed) await api.publishService(svc.id);
      }
      setServices(await api.getServices(agentId));

      setStep('live');
      const orders = await api.getOrders(agentId);
      setTickets(orders);
    } catch (e) {
      setError(e.message);
    }
    setDeploying(false);
  }

  async function simulateOrder() {
    setError(null);
    const d = DEMO_ITEMS[Math.floor(Math.random() * DEMO_ITEMS.length)];
    try {
      await api.simulateOrder({
        agentId,
        customerContact: `demo-${Date.now()}@customer.test`,
        intentSkillId: 'orders',
        payload: {
          items: [{ name: d.name, qty: Math.ceil(Math.random() * 3) }],
          shippingAddress: d.address,
          channel: 'whatsapp',
        },
      });
      const orders = await api.getOrders(agentId);
      setTickets(orders);
    } catch (e) {
      setError(e.message);
    }
  }

  async function fulfill(orderId) {
    setFulfilling(orderId);
    try {
      await api.fulfillOrder(orderId, agentId);
      const orders = await api.getOrders(agentId);
      setTickets(orders);
    } catch (e) {
      setError(e.message);
    }
    setFulfilling(null);
  }

  return (
    <div className="min-h-screen w-full" style={{ background: '#fff', color: INK }}>
      <div className="max-w-5xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: SKY }}>
              <Store size={16} color="#fff" />
            </div>
            <span className="f-display text-lg font-semibold">AgentPress</span>
            <span className="f-mono text-[10px] px-2 py-0.5 rounded" style={{ background: SURFACE, color: SUB, border: `1px solid ${LINE}` }}>
              X LAYER · OKX AI
            </span>
          </div>
          <span className="f-mono text-[11px]" style={{ color: SUB }}>
            {deployedAgent ? '1 agent live' : 'no agents yet'}
          </span>
        </div>

        <div className="flex gap-6">
          <StepRail step={step} />

          <div className="flex-1 min-w-0">
            <ErrorBanner message={error} />

            {step === 'overview' && (
              <div>
                <h1 className="f-display text-2xl font-semibold mb-1">Build an agent</h1>
                <p className="text-sm mb-6" style={{ color: SUB }}>
                  Configure skills, guardrails, and pricing, then deploy straight to the OKX AI Marketplace on X Layer.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    ['ACTIVE AGENTS', deployedAgent ? '1' : '—'],
                    ['ORDERS TODAY', tickets.length ? String(tickets.length) : '—'],
                    ['SKILLS AVAILABLE', String(skillsCatalog.length || 8)],
                    ['WALLET', deployedAgent ? 'connected' : 'not set up'],
                  ].map(([label, val]) => (
                    <div key={label} className="p-4 rounded-lg" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
                      <div className="f-display text-xl">{val}</div>
                      <div className="f-mono text-[10px] tracking-wider mt-1" style={{ color: SUB }}>{label}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setStep(deployedAgent ? 'live' : 'skills')}
                  className="f-mono text-sm px-4 py-3 rounded-md w-full flex items-center justify-center gap-2"
                  style={{ background: SKY, color: '#fff' }}>
                  <Sparkles size={15} />
                  {deployedAgent ? 'Go to your live agent' : 'Start building'}
                </button>
              </div>
            )}

            {step === 'skills' && (
              <div id="skills">
                <h1 className="f-display text-2xl font-semibold mb-1">Pick skills</h1>
                <p className="text-sm mb-5" style={{ color: SUB }}>Toggle what this agent needs. Add or remove more anytime later.</p>
                <div className="grid sm:grid-cols-2 gap-3 mb-24">
                  {skillsCatalog.map((s) => {
                    const Icon = ICONS[s.id] || Store;
                    const on = selected.includes(s.id);
                    return (
                      <button key={s.id} onClick={() => toggleSkill(s.id)} className="text-left p-4 rounded-lg transition"
                        style={{ background: on ? 'rgba(14,165,233,0.06)' : '#fff', border: `1px solid ${on ? SKY : LINE}` }}>
                        <div className="flex items-start justify-between">
                          <Icon size={18} style={{ color: on ? SKY : SUB }} />
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: on ? SKY : 'transparent', border: `1px solid ${on ? SKY : LINE}` }}>
                            {on && <Check size={12} color="#fff" />}
                          </div>
                        </div>
                        <div className="f-display text-sm font-semibold mt-3">{s.name}</div>
                        <div className="text-xs mt-1" style={{ color: SUB }}>{s.description}</div>
                        <div className="flex items-center gap-2 mt-3 f-mono text-[10px]" style={{ color: SUB }}>
                          <span className="px-1.5 py-0.5 rounded" style={{ background: SURFACE }}>{s.category}</span>
                          <span>{s.pricing_model}</span>
                          {s.requires_escrow && <span style={{ color: SAGE }}>escrow</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="fixed bottom-0 left-0 right-0 sm:absolute sm:bottom-0 sm:left-0 sm:right-0 p-4 flex items-center justify-between"
                  style={{ background: '#fff', borderTop: `1px solid ${LINE}` }}>
                  <span className="f-mono text-xs" style={{ color: SUB }}>{selected.length} skill{selected.length !== 1 ? 's' : ''} selected</span>
                  <button disabled={selected.length === 0} onClick={() => setStep('configure')}
                    className="f-mono text-sm px-4 py-2 rounded-md flex items-center gap-1"
                    style={{ background: selected.length ? SKY : LINE, color: selected.length ? '#fff' : SUB }}>
                    Continue <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {step === 'configure' && (
              <div>
                <span className="f-mono text-xs" style={{ color: SUB }}>Step 1 of 2 — Name it</span>
                <h1 className="f-display text-2xl font-semibold mt-1 mb-5">Set up your agent</h1>

                <label className="f-mono text-xs" style={{ color: SUB }}>BUSINESS NAME</label>
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Ada's Kitchen"
                  className="w-full mb-4 mt-1 p-3 rounded-md outline-none text-sm" style={{ border: `1px solid ${LINE}`, color: INK }} />

                <label className="f-mono text-xs" style={{ color: SUB }}>AGENT NAME</label>
                <input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="e.g. Kemi"
                  className="w-full mb-6 mt-1 p-3 rounded-md outline-none text-sm" style={{ border: `1px solid ${LINE}`, color: INK }} />

                <label className="f-mono text-xs" style={{ color: SUB }}>YOUR EMAIL — for Agentic Wallet</label>
                <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="you@business.com"
                  className="w-full mb-1 mt-1 p-3 rounded-md outline-none text-sm" style={{ border: `1px solid ${LINE}`, color: INK }} />
                <p className="text-xs mb-6" style={{ color: SUB }}>
                  OKX's Agentic Wallet logs in by email, not a browser wallet connection — this is what actually holds your agent's funds and identity once deployed.
                </p>

                {selected.includes('orders') && (
                  <div className="mb-5 p-4 rounded-lg" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <ShoppingBag size={15} style={{ color: SKY_DEEP }} />
                      <span className="f-display text-sm font-semibold">Order Taking</span>
                    </div>
                    <label className="f-mono text-xs" style={{ color: SUB }}>WHAT DO YOU SELL?</label>
                    <textarea value={orderCfg.catalog} onChange={(e) => setOrderCfg({ ...orderCfg, catalog: e.target.value })}
                      placeholder="e.g. Jollof rice trays, small chops, drinks" rows={3}
                      className="w-full mt-1 mb-3 p-3 rounded-md outline-none text-sm" style={{ background: '#fff', border: `1px solid ${LINE}`, color: INK }} />
                    <label className="f-mono text-xs" style={{ color: SUB }}>WHEN AN ORDER COMES IN</label>
                    <div className="flex flex-col gap-2 mt-1 mb-3">
                      {[['manual', 'Notify the owner — they fulfill it themselves'], ['auto', 'Auto-confirm and auto-invoice']].map(([val, label]) => (
                        <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" checked={orderCfg.fulfillment === val} onChange={() => setOrderCfg({ ...orderCfg, fulfillment: val })} />
                          {label}
                        </label>
                      ))}
                    </div>
                    <label className="f-mono text-xs" style={{ color: SUB }}>NOTIFY VIA</label>
                    <select value={orderCfg.notifyVia} onChange={(e) => setOrderCfg({ ...orderCfg, notifyVia: e.target.value })}
                      className="w-full mt-1 p-3 rounded-md outline-none text-sm" style={{ background: '#fff', border: `1px solid ${LINE}`, color: INK }}>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                      <option value="dashboard">This dashboard only</option>
                    </select>
                  </div>
                )}

                {selected.includes('invoicing') && (
                  <div className="mb-5 p-4 rounded-lg" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Receipt size={15} style={{ color: SKY_DEEP }} />
                      <span className="f-display text-sm font-semibold">Invoicing & Collection</span>
                    </div>
                    <label className="f-mono text-xs" style={{ color: SUB }}>SETTLE PAYMENTS IN</label>
                    <select value={invCfg.currency} onChange={(e) => setInvCfg({ ...invCfg, currency: e.target.value })}
                      className="w-full mt-1 mb-3 p-3 rounded-md outline-none text-sm" style={{ background: '#fff', border: `1px solid ${LINE}`, color: INK }}>
                      <option>USDG</option>
                      <option>USDT</option>
                      <option>USDC</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={invCfg.escrow} onChange={(e) => setInvCfg({ ...invCfg, escrow: e.target.checked })} />
                      Hold payment in escrow until fulfilled
                    </label>
                  </div>
                )}

                {(selected.includes('invoicing') || selected.includes('supplier')) && (
                  <div className="mb-5 p-4 rounded-lg" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
                    <div className="f-display text-sm font-semibold mb-2">Guardrails</div>
                    <label className="f-mono text-xs" style={{ color: SUB }}>MAX SPEND THE AGENT CAN APPROVE AUTOMATICALLY (0 = always ask you)</label>
                    <input type="number" value={maxSpend} onChange={(e) => setMaxSpend(e.target.value)}
                      className="w-full mt-1 p-3 rounded-md outline-none text-sm" style={{ background: '#fff', border: `1px solid ${LINE}`, color: INK }} />
                  </div>
                )}

                {selectedSkills.filter((s) => !s.configurable).length > 0 && (
                  <div className="mb-5 p-4 rounded-lg" style={{ background: SURFACE, border: `1px dashed ${LINE}` }}>
                    <div className="f-mono text-xs mb-2" style={{ color: SUB }}>READY WITH DEFAULTS</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedSkills.filter((s) => !s.configurable).map((s) => (
                        <span key={s.id} className="f-mono text-[11px] px-2 py-1 rounded" style={{ background: '#fff', border: `1px solid ${LINE}` }}>{s.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-5 p-4 rounded-lg" style={{ border: `1px solid ${LINE}` }}>
                  <div className="f-display text-sm font-semibold mb-1">Publish as a service on OKX AI</div>
                  <p className="text-xs mb-3" style={{ color: SUB }}>
                    Optional — turn any skill into a paid listing other agents can hire. Flat price, no negotiation (A2MCP).
                  </p>
                  <div className="flex flex-col gap-2">
                    {selectedSkills.map((s) => {
                      const draft = serviceDrafts[s.id];
                      return (
                        <div key={s.id} className="rounded-md p-3" style={{ background: draft ? 'rgba(14,165,233,0.06)' : SURFACE, border: `1px solid ${draft ? SKY : LINE}` }}>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={!!draft} onChange={() => toggleServiceDraft(s.id, s.name)} />
                            List "{s.name}" as a service
                          </label>
                          {draft && (
                            <div className="mt-2 flex gap-2">
                              <input value={draft.name} onChange={(e) => updateServiceDraft(s.id, 'name', e.target.value)}
                                placeholder="Service name" className="flex-1 p-2 rounded-md outline-none text-xs" style={{ background: '#fff', border: `1px solid ${LINE}`, color: INK }} />
                              <input type="number" value={draft.price} onChange={(e) => updateServiceDraft(s.id, 'price', e.target.value)}
                                placeholder="Price" className="w-24 p-2 rounded-md outline-none text-xs" style={{ background: '#fff', border: `1px solid ${LINE}`, color: INK }} />
                              <span className="f-mono text-xs self-center" style={{ color: SUB }}>USDG</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between">
                  <button onClick={() => setStep('skills')} className="f-mono text-sm px-4 py-2 rounded-md flex items-center gap-1" style={{ color: SUB }}>
                    <ChevronLeft size={14} /> Back
                  </button>
                  <button disabled={!businessName || !agentName || !ownerEmail || loading} onClick={reviewDeployment}
                    className="f-mono text-sm px-4 py-2 rounded-md flex items-center gap-1"
                    style={{ background: businessName && agentName && ownerEmail ? SKY : LINE, color: businessName && agentName && ownerEmail ? '#fff' : SUB }}>
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <>Review deployment <ChevronRight size={14} /></>}
                  </button>
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div>
                <span className="f-mono text-xs" style={{ color: SUB }}>Step 2 of 2 — Review</span>
                <h1 className="f-display text-2xl font-semibold mt-1 mb-5">Deployment preview</h1>

                <div className="rounded-lg overflow-hidden mb-5" style={{ border: `1px solid ${LINE}` }}>
                  {[
                    ['Agent name', agentName || '—'],
                    ['Business', businessName || '—'],
                    ['Skills active', selectedSkills.map((s) => s.name).join(', ')],
                    ['Services to publish', Object.keys(serviceDrafts).length ? `${Object.keys(serviceDrafts).length} (A2MCP)` : 'none'],
                    ['Network', 'X Layer (Chain 196)'],
                    ['Identity', 'new Agent Identity will be registered'],
                    ['Wallet', 'new Agentic Wallet (self-custodial)'],
                    ['Marketplace', 'listed on OKX AI'],
                    ['Manifest version', manifest ? `v${manifest.version}` : '—'],
                  ].map(([k, v], i) => (
                    <div key={k} className="f-mono text-xs flex justify-between px-4 py-3" style={{ background: i % 2 ? '#fff' : SURFACE }}>
                      <span style={{ color: SUB }}>{k}</span>
                      <span className="text-right ml-4">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <button onClick={() => setStep('configure')} className="f-mono text-sm px-4 py-2 rounded-md flex items-center gap-1" style={{ color: SUB }}>
                    <ChevronLeft size={14} /> Back
                  </button>
                  <button onClick={deployAgent} disabled={deploying}
                    className="f-mono text-sm px-5 py-3 rounded-md flex items-center gap-2" style={{ background: SKY, color: '#fff' }}>
                    {deploying ? <Loader2 size={15} className="animate-spin" /> : <Fingerprint size={15} />}
                    {deploying ? 'Deploying...' : 'Deploy agent'}
                  </button>
                </div>
              </div>
            )}

            {step === 'live' && deployedAgent && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: SAGE }} />
                  <h1 className="f-display text-2xl font-semibold">{deployedAgent.name} is live</h1>
                </div>
                <p className="text-sm mb-5" style={{ color: SUB }}>
                  Working for {businessName} · listed on OKX AI · {selectedSkills.length} skills active
                </p>

                <div className="grid sm:grid-cols-2 gap-3 mb-6">
                  <div className="p-4 rounded-lg" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
                    <div className="flex items-center gap-2 mb-1"><Fingerprint size={14} style={{ color: SKY_DEEP }} /><span className="f-mono text-xs" style={{ color: SUB }}>IDENTITY</span></div>
                    <div className="f-mono text-xs">{deployedAgent.identity_ref}</div>
                    <div className="f-mono text-[10px] mt-1" style={{ color: SUB }}>registry: {deployedAgent.registry_contract?.slice(0, 10)}...</div>
                  </div>
                  <div className="p-4 rounded-lg" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
                    <div className="flex items-center gap-2 mb-1"><Wallet size={14} style={{ color: SKY_DEEP }} /><span className="f-mono text-xs" style={{ color: SUB }}>WALLET</span></div>
                    <div className="f-mono text-xs">{deployedAgent.wallet_address}</div>
                    <div className="f-mono text-[10px] mt-1" style={{ color: SUB }}>linked to {ownerEmail}</div>
                  </div>
                </div>

                {services.length > 0 && (
                  <div className="mb-6">
                    <span className="f-mono text-xs tracking-wider" style={{ color: SUB }}>PUBLISHED SERVICES</span>
                    <div className="mt-2 flex flex-col gap-2">
                      {services.map((s) => (
                        <div key={s.id} className="p-3 rounded-lg flex items-center justify-between" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
                          <div>
                            <div className="f-display text-sm font-semibold">{s.name}</div>
                            <div className="f-mono text-[10px]" style={{ color: SUB }}>
                              {s.service_type} · {s.price} {s.currency} · {s.sold_count} sold · {Number(s.rating_avg).toFixed(1)}★ ({s.rating_count})
                            </div>
                          </div>
                          <span className="f-mono text-[10px] px-2 py-1 rounded-full" style={{ background: s.listed ? 'rgba(22,163,74,0.12)' : 'rgba(14,165,233,0.12)', color: s.listed ? SAGE : SKY_DEEP }}>
                            {s.listed ? 'Listed on OKX AI' : 'Draft'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-3">
                  <span className="f-mono text-xs tracking-wider" style={{ color: SUB }}>ORDER TICKETS</span>
                  <button onClick={simulateOrder} className="f-mono text-[11px] px-3 py-1.5 rounded-md flex items-center gap-1" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
                    <Plus size={12} /> Simulate incoming order
                  </button>
                </div>

                <div>
                  {tickets.length === 0 && (
                    <div className="f-mono text-xs p-6 text-center rounded-lg" style={{ border: `1px dashed ${LINE}`, color: SUB }}>
                      No orders yet. Tap "Simulate incoming order" to see how it flows.
                    </div>
                  )}
                  {tickets.map((t) => (
                    <Ticket key={t.id} order={t} onFulfill={fulfill} fulfilling={fulfilling} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
