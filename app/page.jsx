const INK = '#0B1220';
const SUB = '#5B6472';
const SURFACE = '#F2F9FF';
const LINE = '#E1ECF7';
const SKY = '#0EA5E9';
const SKY_DEEP = '#0284C7';

export default function LandingPage() {
  return (
    <div style={{ background: '#fff', color: INK, minHeight: '100vh' }}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background: `radial-gradient(circle at 18% 10%, rgba(14,165,233,0.10), transparent 45%),
                       radial-gradient(circle at 85% 60%, rgba(14,165,233,0.07), transparent 50%), #fff`,
        }}
      />

      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center f-display font-bold text-white"
            style={{ background: SKY }}
          >
            A
          </div>
          <span className="f-display font-semibold text-lg">AgentPress</span>
          <span
            className="f-mono text-[10px] px-2 py-0.5 rounded ml-1 hidden sm:inline-block"
            style={{ background: SURFACE, border: `1px solid ${LINE}`, color: SUB }}
          >
            X LAYER · OKX AI
          </span>
        </div>
        <a
          href="/dashboard"
          className="f-mono text-sm font-medium px-5 py-2.5 rounded-full text-white"
          style={{ background: SKY }}
        >
          Open Dashboard
        </a>
      </nav>

      <section className="relative z-10 max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
        <span
          className="f-mono text-xs inline-block px-4 py-1.5 rounded-full mb-7"
          style={{ background: SURFACE, border: `1px solid ${LINE}`, color: SKY_DEEP }}
        >
          Build · Deploy · List on OKX AI
        </span>

        <h1 className="f-display font-bold leading-tight tracking-tight mb-5" style={{ fontSize: 'clamp(2.1rem, 7vw, 3.4rem)' }}>
          Build an <span style={{ color: SKY }}>AI agent</span> for any small business — deploy it on X Layer.
        </h1>

        <p className="max-w-md mx-auto mb-9 text-[17px] leading-relaxed" style={{ color: SUB }}>
          Pick skills, configure guardrails, generate the manifest, and go live on the OKX AI Marketplace.
          A developer console, not a packaged product.
        </p>

        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          <a href="/dashboard" className="f-mono text-[15px] font-semibold px-6 py-4 rounded-full text-white" style={{ background: SKY }}>
            Open Dashboard
          </a>
          <a
            href="/dashboard#skills"
            className="f-mono text-sm px-6 py-3.5 rounded-full"
            style={{ background: '#fff', border: `1px solid ${LINE}`, color: INK }}
          >
            Browse Skills
          </a>
        </div>

        <div className="f-mono text-[11px] mt-4" style={{ color: SUB }}>
          No wallet needed to start — <span style={{ color: SKY_DEEP }}>connect only when you're ready to deploy</span>
        </div>
      </section>

      <div className="relative z-10 max-w-4xl mx-auto px-6 mt-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            ['8', 'SKILLS AVAILABLE'],
            ['5', 'READY-MADE TEMPLATES'],
            ['1-CLICK', 'DEPLOY TO OKX AI'],
            ['196', 'X LAYER CHAIN ID'],
          ].map(([k, l]) => (
            <div key={l} className="rounded-xl p-4" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
              <div className="f-display text-xl font-semibold">{k}</div>
              <div className="f-mono text-[10px] mt-1 tracking-wide" style={{ color: SUB }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 mt-16">
        <h2 className="f-display text-center font-semibold text-xl mb-7">Build like a plugin, not a product</h2>
        <div className="grid sm:grid-cols-3 gap-3.5">
          {[
            ['01', 'Pick a template', 'Customer Support, Finance, Sales, or start blank — each pre-loads a starter set of skills and guardrails.'],
            ['02', 'Configure & guard', 'Set services, pricing, and spend limits. Nothing runs autonomously past what you allow.'],
            ['03', 'Deploy to OKX AI', 'Identity, wallet, and manifest generated automatically. One click lists it on the marketplace.'],
          ].map(([n, title, body]) => (
            <div key={n} className="rounded-xl p-5" style={{ border: `1px solid ${LINE}` }}>
              <div className="f-mono text-xs mb-2" style={{ color: SKY_DEEP }}>{n}</div>
              <h3 className="f-display font-semibold text-base mb-1.5">{title}</h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: SUB }}>{body}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="relative z-10 text-center py-14 f-mono text-[11px]" style={{ color: SUB }}>
        AgentPress · built on X Layer
      </footer>
    </div>
  );
}
