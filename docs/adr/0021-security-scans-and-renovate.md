# 0021: 脆弱性の検査(CodeQL・Trivy)と依存関係の更新(Renovate)の方針

- ステータス: 承認
- 日付: 2026-11-04

## 背景
フェーズ2(Issue #21)で、自分たちのコードの脆弱性を CodeQL で、依存関係の既知の脆弱性を Trivy(`trivy fs`)で検査し、依存関係の更新を Renovate に提案させることにした。そのとき、次の事情があった。

- 2026年3月19日、`aquasecurity/trivy-action` のタグ77個のうち76個と、`aquasecurity/setup-trivy` の全タグが、CI のシークレットを盗むコードに付け替えられた。同時に、悪意のある Trivy 本体 v0.69.4 が公開された(CVE-2026-33634)。タグで参照していたワークフローは、ファイルを変えずに攻撃コードを実行した。コミットの SHA で固定していた利用者は影響を受けなかった。
- `github/codeql-action` には、デバッグ用の成果物に `GITHUB_TOKEN` が含まれる問題があった(CVE-2025-24362、v3.28.3 で修正済み、悪用の形跡なし)。
- このリポジトリの npm の依存関係は、すべて devDependencies である。Trivy は既定では開発用の依存関係を報告しない。
- Renovate は、GHCR(GitHub のコンテナレジストリ)のイメージの公開日時を読めない。Docker Hub の公開日時は読める。
- CodeQL のジョブは、脆弱性を見つけても成功する(結果を登録するだけ)。

## 検討した選択肢
**Trivy の実行方法**
- 公式イメージを digest で固定して直接動かす: 間に挟まるアクションがなく、トークンも渡さない。Renovate が版と digest を更新できる / 毎回、脆弱性 DB をダウンロードする
- `trivy-action` を SHA で固定する: 機能がそろい、例が多い / 中で setup-trivy → インストールスクリプト → 本体と段が多く、3月の事件で乗っ取られた経路そのもの。Trivy の版は別に指定する必要がある
- バイナリを自分で取得し、ハッシュを照合する: 仕組みがすべて見える / 版を上げるたびにハッシュを手で直す必要があり、Renovate で更新できない

**Trivy で CI を失敗させる基準**
- HIGH 以上で、修正版が出ているもの: 対応できる重大なものだけで止まる / MEDIUM 以下と修正版のないものは、見逃しうる(Security タブには出る)
- CRITICAL のみ / HIGH 以上(修正版なしも含む) / MEDIUM 以上: 順に厳しくなる。修正版がないものを含めると、直しようがないのに CI が止まり続ける

**Trivy の結果の扱い**
- SARIF で Security タブにも登録する: CodeQL と同じ画面で一覧・履歴を管理できる / 書き込みの権限が要り、Trivy を2回動かす
- CI のログだけ: 単純 / 履歴が残らない

**CodeQL のクエリスイート**
- `security-extended`: 標準より多くのセキュリティの検査を含む / 誤検知が少し増える
- `default`: 誤検知が少ない / 見つけられる幅が狭い
- `security-and-quality`: 品質の指摘も含む / ESLint と重なり、ノイズが増える

**必須チェックの方式**
- ジョブの成功に加えて、ルールセットの「Require code scanning results」で CodeQL の新しいアラートを止める: CodeQL の指摘でも確実に止まる / 設定する場所が2つになる
- ジョブの成功だけ: 単純 / CodeQL の指摘ではマージを止められない

**Renovate の更新のまとめ方**
- 種類(npm・GitHub Actions)ごとにマイナー・パッチをまとめ、メジャーは個別: PR が少なく、壊れやすいメジャーは個別に確かめられる / まとめた PR が失敗すると、原因の切り分けが要る
- 非メジャーを全部1つに: PR が最も少ない / 種類が混ざりレビューしにくい
- 関連するものだけまとめる(既定): 切り分けが簡単 / PR が多い

**頻度と数の制限**
- 週1回(月曜朝)・同時5本・1時間2本 / 月1回・同時3本 / 週末・同時10本

**公開から待つ日数(`minimumReleaseAge`)**
- 7日 / 3日 / 待たない: 長いほど乗っ取られた直後の版を避けやすく、更新は遅れる

**package.json の版の書き方(`rangeStrategy`)**
- `bump`(範囲の下限も上げる): package.json で実際の版がわかる / 変更するファイルが増える
- `update-lockfile`(ロックファイルだけ): 差分が小さい / package.json と実際の版がずれる
- `pin`(範囲をやめて固定): 版が明確 / TypeScript の `~6.0.3` のような意図のある指定が消える

**Renovate の設定の形式とテスト**
- `renovate.json` と Vitest のテスト: 依存関係を増やさずに約束を確かめられる / コメントが書けない
- `renovate.json5`(コメント付き)でテストなし: 理由を横に書ける / 約束が壊れても気づけない

## 決定
- CodeQL は `.github/workflows/codeql.yml` に置く(GitHub の設定画面の Default setup は使わない)。対象は `javascript-typescript`、`build-mode: none`、クエリは **`security-extended`**。
- Trivy は `.github/workflows/trivy.yml` に置き、**Docker Hub の公式イメージ `aquasec/trivy` を digest で固定**して、`uses: docker://…` で直接動かす。GHCR ではなく Docker Hub にしたのは、Renovate が公開日時を読めて、7日待ちの対象にできるためである(GHCR のイメージと digest は同じ)。
  - `--include-dev-deps` を付ける。
  - 結果は、すべての深刻度を **SARIF で Security タブに登録**し、別に **HIGH 以上で修正版のあるもの**(`--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1`)があればジョブを失敗させる。
- 両方とも、プルリクエスト・main への push に加え、毎週(月曜 0:00 日本時間)実行する。ジョブ名(`codeql`・`trivy`)を必須チェックにする。加えて、ルールセットの **Require code scanning results** で CodeQL のアラートを止める。Trivy はこのルールの対象にしない(Security タブには修正版のないものも登録するので、基準が「修正版のあるもの」と食い違うため。Trivy の基準はジョブの成否で守る)。
- Renovate は、ルートの **`renovate.json`** で設定し、約束を `packages/config/tests/renovate.test.ts` で確かめる。
  - 自動ではマージしない。GitHub Actions の SHA も更新する(`helpers:pinGitHubActionDigests`)。
  - TypeScript は `<6.1.0`(ADR 0017)、Node.js と `@types/node` は `<25`(`engines` と合わせる)にとどめる。
  - npm と GitHub Actions で、それぞれマイナー・パッチ(Actions は SHA の更新も)をまとめる。メジャーは個別。
  - **毎週月曜の朝9時前(日本時間)**、開いている PR は**5本まで**、1時間に**2本まで**。
  - **公開から7日**たった版だけを提案する。脆弱性の修正(Renovate の `vulnerabilityAlerts`)は、Renovate の既定のとおり、待ち日数・時間帯・本数の制限を受けずにすぐ提案される。
  - `rangeStrategy` は **`bump`**。PR のタイトルは、npm が `build(deps): …`、GitHub Actions が `ci(deps): …`(commitlint を通る)。
- ワークフローの外部のアクションが SHA で、イメージが digest で固定されていることを、`packages/config/tests/workflows.test.ts` で確かめる。

## 結果
- 自分たちのコードと依存関係の脆弱性が、プルリクエストの段階でわかる。
- 依存関係の更新が週に数本の PR で届く。レビューしてからマージする手間はかかる。
- 公開直後に乗っ取られた版は、7日待つ間に取り下げられることが多く、取り込みにくくなる。新しい版が届くのは1週間遅れる。
- Trivy は毎回、脆弱性 DB をダウンロードする(数十秒)。
- 修正版のない HIGH 以上の脆弱性では CI は止まらない。Security タブで気づく必要がある。
- 詳細は学習ノート([CodeQL](../learning/codeql.md)・[Trivy](../learning/trivy.md)・[Renovate](../learning/renovate.md))にある。
