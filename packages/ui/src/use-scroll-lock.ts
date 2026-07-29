"use client";

import * as React from "react";

// Lock de scroll seguro para camadas aninhadas (Dialog sobre Dialog, BottomSheet
// sobre Dialog): só restaura o overflow quando a última camada fecha. O contador
// vive no módulo, então precisa ser compartilhado por todos os componentes que
// travam o scroll — senão a camada de cima restaura o overflow cedo demais.
let openLayerCount = 0;

/** Trava o scroll do body enquanto `active` for verdadeiro. */
export function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    openLayerCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      openLayerCount = Math.max(0, openLayerCount - 1);
      if (openLayerCount === 0) document.body.style.overflow = "";
    };
  }, [active]);
}
