/**
 * Testcontainers が一緒に起動する Ryuk のイメージ。版は Testcontainers が既定で使う版に合わせ、
 * digest は Renovate が更新する(docs/learning/testcontainers.md・ADR 0025)。
 */
export const RYUK_IMAGE =
  "testcontainers/ryuk:0.14.0@sha256:7c1a8a9a47c780ed0f983770a662f80deb115d95cce3e2daa3d12115b8cd28f0";
