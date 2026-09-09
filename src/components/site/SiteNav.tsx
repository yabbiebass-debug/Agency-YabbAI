import { Link } from "@tanstack/react-router";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-void/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-3">
        <Link to="/" className="font-display text-[14px] font-extrabold tracking-[0.5px] text-ink">
          YABBAI <span className="text-purple">//</span> BASHAM AUTOMATIONS
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-[1.5px] text-dim">
          <Link to="/pricing" activeProps={{ className: "text-ink" }} className="hover:text-ink">
            Packages
          </Link>
          <Link to="/contact" activeProps={{ className: "text-ink" }} className="hover:text-ink">
            Enquire
          </Link>
          <Link to="/pulse" activeProps={{ className: "text-ink" }} className="hover:text-ink">
            Pulse
          </Link>
          <Link
            to="/pricing"
            className="bg-purple px-3 py-2 font-bold text-white hover:shadow-[0_0_18px_rgba(153,69,255,.5)]"
          >
            Buy now
          </Link>
          <Link to="/auth" className="hover:text-ink">
            Director
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line px-5 py-8 text-center text-[10px] uppercase tracking-[1.5px] text-dim">
      Basham Automations · Australia · basham_x@proton.me
      <div className="mt-2 normal-case tracking-normal">
        Payments handled by PayPal (card or PayPal balance) and Solana on-chain transfer. Prices in AUD.
      </div>
    </footer>
  );
}
