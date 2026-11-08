import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 passou a validar que toda página bate com uma rota completa em
  // todos os slots paralelos, mesmo fora da árvore do slot (aqui, @modal vive
  // em (app)/, mas a validação também olha /login, que é vizinho de (app)/
  // fora dela). Sem isso, `next dev` recusa /login com 404.
  deprecated: {
    looseRouteMatching: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
