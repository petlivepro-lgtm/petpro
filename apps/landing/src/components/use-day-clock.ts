"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Relógio do petshop: avança um passo por intervalo enquanto o bloco está na
 * tela. Todas as demonstrações de um bloco leem o mesmo passo, então a câmera,
 * a agenda e o app do tutor mudam juntos. Com movimento reduzido o relógio
 * anda mais devagar e o CSS troca deslocamentos por esmaecimento. `paused`
 * atende o controle de pausa exigido para conteúdo que se atualiza sozinho.
 */
export function useDayClock<T extends HTMLElement>(length: number, intervalMs = 2600) {
  const ref = useRef<T>(null);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || paused) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const every = reduce ? intervalMs * 2 : intervalMs;
    let timer: number | undefined;

    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && timer === undefined) {
          timer = window.setInterval(() => setStep((s) => (s + 1) % length), every);
        } else if (!entry?.isIntersecting) {
          stop();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [length, intervalMs, paused]);

  return { ref, step, paused, setPaused };
}
