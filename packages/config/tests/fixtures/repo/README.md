# 境界の検査のテスト用フィクスチャ

`packages/config/tests/` の境界のテストだけが使う、架空の小さなリポジトリ。本物のモジュールではない。

- `pnpm-workspace.yaml` の対象外で、package.json も置かないので、ワークスペースのパッケージにはならない。
- 実際の Lint・dependency-cruiser・型チェックの対象からは外している。
- `alpha` と `beta` は架空のモジュール。`violation-` で始まるファイルは、`docs/design/module-system.md` §5.2 の依存のルールにわざと違反している。それ以外のファイルは違反していない。
