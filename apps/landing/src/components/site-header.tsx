"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LOGIN_URL, SIGNUP_URL } from "@/content/links";

const links = [
  { id: "recursos", label: "Recursos" },
  { id: "ao-vivo", label: "Câmera ao vivo", live: true },
  { id: "precos", label: "Preços" },
  { id: "duvidas", label: "Dúvidas" },
];

export function SiteHeader() {
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Destaca no menu a seção que está na tela.
  useEffect(() => {
    const sections = links
      .map((l) => document.getElementById(l.id))
      .filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0]!.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // Menu do celular: fecha com Esc, toque fora ou ao virar desktop.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => desktop.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    desktop.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  return (
    <header ref={headerRef} className="sticky top-0 z-30 bg-white/90 backdrop-blur-md">
      <div className="mx-auto grid h-[72px] max-w-[1440px] grid-cols-[1fr_auto] items-center px-4 sm:px-8 lg:h-[84px] lg:grid-cols-[1fr_auto_1fr] lg:px-[72px]">
        <a href="#topo" className="flex items-center gap-3 text-graphite" aria-label="Pet Live Pro, início">
          <img src="/brand/faviconpet.svg" alt="" className="h-9 w-auto lg:h-[38px]" />
          <span className="leading-none">
            <b className="block font-heading text-lg font-extrabold tracking-[-0.01em] lg:text-[19px]">
              Pet Live <span className="title-accent">Pro</span>
            </b>
            <small className="mt-1 hidden text-xs font-medium text-[#5d6873] sm:block">Transparência e cuidado</small>
          </span>
        </a>

        <nav aria-label="Seções" className="hidden gap-1 rounded-full bg-[#f4f6f8] p-[5px] lg:flex">
          {links.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              aria-current={active === l.id ? "true" : undefined}
              className={`flex items-center gap-2 rounded-full px-4 py-[9px] text-[14.5px] font-semibold transition-colors duration-200 ${
                active === l.id
                  ? "bg-white text-graphite shadow-[0_1px_2px_rgba(31,42,51,.08)]"
                  : "text-[#3d4954] hover:text-graphite"
              }`}
            >
              {l.live && <i aria-hidden className="live-dot" />}
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1 justify-self-end sm:gap-2">
          <a
            href={LOGIN_URL}
            className="hidden rounded-[10px] px-4 py-[11px] text-[15px] font-semibold text-graphite hover:bg-[#f4f6f8] sm:block"
          >
            Entrar
          </a>
          <a
            href={SIGNUP_URL}
            className="rounded-[10px] bg-graphite px-4 py-[11px] text-[15px] font-semibold text-white transition-colors hover:bg-[#2b3a46]"
          >
            Criar conta
          </a>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="menu-celular"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            className="ml-1 grid h-11 w-11 place-items-center rounded-[10px] text-graphite transition-colors hover:bg-[#f4f6f8] lg:hidden"
          >
            {open ? <X aria-hidden className="h-6 w-6" /> : <Menu aria-hidden className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* painel do menu no celular: desce abaixo da barra */}
      <div
        id="menu-celular"
        inert={!open}
        className={`absolute inset-x-0 top-full origin-top border-b border-[#e6eaee] bg-white shadow-[0_18px_40px_rgba(31,42,51,.12)] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] lg:hidden ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <nav aria-label="Seções" className="mx-auto max-w-[1440px] px-4 pb-5 pt-2 sm:px-8">
          <ul>
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={active === l.id ? "true" : undefined}
                  className="flex items-center gap-2.5 border-b border-[#f0f2f4] py-4 font-heading text-lg font-bold text-graphite"
                >
                  {l.live && <i aria-hidden className="live-dot" />}
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={LOGIN_URL}
            className="mt-4 block rounded-xl border border-[#d5dbe0] py-3.5 text-center text-base font-semibold text-graphite sm:hidden"
          >
            Entrar no painel
          </a>
        </nav>
      </div>
    </header>
  );
}
