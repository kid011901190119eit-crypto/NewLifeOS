# Renovate(依存関係の更新の自動提案)

## それは何か

**Renovate** は、依存関係(npm の部品、GitHub Actions のアクション、コンテナイメージなど)の新しい版を見つけて、更新のプルリクエストを自動で作る道具である。Mend 社が運営する GitHub アプリとして動き、リポジトリの設定ファイル([`renovate.json`](../../renovate.json))に従う。

| 用語 | 意味 |
|---|---|
| マネージャー(manager) | 依存関係が書かれたファイルの種類。`npm`(package.json とロックファイル)、`github-actions`(ワークフローの `uses:`)など |
| 更新の種類(update type) | `major`(互換性を壊しうる 1.x→2.x)・`minor`(機能の追加)・`patch`(修正)・`digest`(SHA や digest だけが変わる) |
| プリセット(`extends`) | よく使う設定のまとまり。`config:recommended` は Renovate が推奨する基本の設定 |
| パッケージルール(`packageRules`) | 特定の依存関係や種類にだけ効く設定。下に書いたものほど優先される |
| Dependency Dashboard | Renovate が作る Issue。待っている更新・止めている更新の一覧が見られ、チェックを入れると PR をすぐ作らせられる |

GitHub には **Dependabot** という同じ目的の機能もある。Renovate は、まとめ方・時間帯・版の制限などを細かく設定でき、GitHub Actions の SHA とコメント(`# v7.0.1`)を一緒に更新できるので、仕様(`docs/spec.md` §9)で Renovate を選んでいる。

## なぜ必要か

- 依存関係を古いままにすると、脆弱性の修正を取り込めず、あとで上げるときの差分が大きくなる。
- ワークフローのアクションは SHA で固定している。固定すると安全だが、自動では新しくならない。SHA を手で調べて直すのは大変なので、Renovate に任せる。
- 更新を PR として出すので、CI(Lint・テスト・CodeQL・Trivy)を通してから取り込める。

## このプロジェクトでどう使うか

設定は [`renovate.json`](../../renovate.json) にある。設定の約束は [`packages/config/tests/renovate.test.ts`](../../packages/config/tests/renovate.test.ts) で確かめている。判断の記録は [ADR 0021](../adr/0021-security-scans-and-renovate.md)。JSON にはコメントが書けないので、各ルールの理由は `description` に書いている。

| 設定 | 値 | 意味 |
|---|---|---|
| `extends` | `config:recommended`・`helpers:pinGitHubActionDigests` | 基本の設定と、Actions を SHA で固定して更新する設定 |
| `automerge` | `false` | 自動でマージしない。オーナーがレビューしてからマージする |
| `schedule`・`timezone` | 月曜の朝9時前・`Asia/Tokyo` | PR を作るのは週に1回 |
| `prConcurrentLimit` | `5` | 開いている Renovate の PR は5本まで。マージすると次が来る |
| `prHourlyLimit` | `2` | 1時間に作る PR は2本まで |
| `minimumReleaseAge` | `7 days` | 公開から7日たった版だけを提案する |
| `rangeStrategy` | `bump` | `^3.9.10` → `^3.9.11` のように、package.json の範囲の下限も上げる |
| `semanticCommits` | `enabled` | PR のタイトルを Conventional Commits にする。npm は `build(deps): …`、Actions は `ci(deps): …` |

### まとめ方

- npm のマイナー・パッチは、1つの PR(`npm non-major dependencies`)にまとめる。
- GitHub Actions(Trivy のイメージを含む)のマイナー・パッチ・SHA の更新は、1つの PR(`github-actions non-major`)にまとめる。
- メジャーは、1つの依存関係につき1つの PR にする。互換性を壊しうるので、個別に確かめる。

### 版の制限

- **TypeScript は `<6.1.0`**: typescript-eslint が 6.1 未満にしか対応していないため([ADR 0017](../adr/0017-typescript-6.md))。6.1 や 7 は提案されない。typescript-eslint が対応したら、ADR を見直してからこの制限を外す。
- **Node.js と `@types/node` は `<25`**: package.json の `engines` で Node.js 24 に固定している。型定義も実行環境と合わせる。

### 公開から7日待つ理由

依存関係の乗っ取りは、多くの場合、公開から数時間〜数日で見つかって取り下げられる(2026年3月の Trivy の事件では、悪意のある版は約半日で取り下げられた)。7日待てば、そうした版を提案されにくくなる。かわりに、新しい版が届くのは1週間遅れる。

待っている間の更新は、Dependency Dashboard の Issue に「Pending」として表示される。

**脆弱性の修正は待たない**: 依存関係の今の版に脆弱性が知られている場合(GitHub の Dependabot alerts を Renovate が読む)、Renovate は待ち日数・時間帯・本数の制限なしに、すぐ PR を作る(Renovate の `vulnerabilityAlerts` の既定)。タイトルの末尾に `[SECURITY]` が付く。

### Renovate の PR が来たら

1. PR の本文で、何がどの版からどの版へ上がるかと、リリースノートを読む。
2. CI がすべて通っていることを確かめる。
3. メジャーの更新は、リリースノートの「Breaking changes」を読み、必要ならコードを直すコミットを同じ PR に足す。
4. 問題なければ Squash and merge する。取り込みたくない更新は、PR を閉じると、その版は再提案されない。
