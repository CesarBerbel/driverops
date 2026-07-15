import { useEffect, useRef } from "react";

// Client ID público do Google (Google Cloud Console). Sem ele, o botão some.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GIS_SRC = "https://accounts.google.com/gsi/client";

export const googleAuthEnabled = Boolean(CLIENT_ID);

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

// Carrega o script do Google Identity Services uma única vez (memoizado).
let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o Google Sign-In."));
    document.head.appendChild(script);
  });
  return gisPromise;
}

/**
 * Botão oficial "Entrar com Google" (Google Identity Services). Devolve o ID
 * token via `onCredential`. Não renderiza nada se o Client ID não estiver
 * configurado (VITE_GOOGLE_CLIENT_ID).
 */
export function GoogleSignInButton({
  onCredential,
  text = "signin_with",
}: {
  onCredential: (credential: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Mantém o callback atual sem re-inicializar o GIS a cada render.
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => callbackRef.current(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          text,
          locale: "pt-BR",
        });
      })
      .catch(() => {
        // Silencioso: se o script não carregar, o botão apenas não aparece.
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!CLIENT_ID) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}
