import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) carrega o pdf.worker.mjs dinamicamente em runtime;
  // bundlado pelo Turbopack o worker não é emitido e a importação de PDF quebra
  // em produção. Fora do bundle, resolve direto de node_modules.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
