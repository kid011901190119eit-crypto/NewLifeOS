# Trivy(依存関係の脆弱性の検査)

## それは何か

**Trivy** は、Aqua Security が作っているオープンソースの脆弱性スキャナーである。ロックファイル(`pnpm-lock.yaml` など)やコンテナイメージに含まれる部品の名前と版を読み、**既知の脆弱性**の一覧(CVE)と照らし合わせる。

| 用語 | 意味 |
|---|---|
| CVE | 公開された脆弱性1件ごとに付く番号。例: CVE-2026-33634 |
| 深刻度 | CVSS という採点に基づく4段階。CRITICAL > HIGH > MEDIUM > LOW |
| 修正版(fixed version) | その脆弱性が直った版。まだ出ていない脆弱性もある |
| 脆弱性 DB | Trivy が照らし合わせる脆弱性の一覧。実行のたびにダウンロードする |
| `trivy fs` | ファイルシステム(リポジトリの中身)を検査するコマンド。フェーズ7では、イメージを検査する `trivy image` も使う |

CodeQL との違い: CodeQL は**自分たちが書いたコード**の書き方の問題を探す。Trivy は**他人が作った部品**に、すでに知られている問題がないかを探す。

## なぜ必要か

- このプロジェクトのコードの大部分は、npm の部品(依存関係の依存関係を含めて数百個)である。そのどれかに脆弱性が見つかることは、日常的に起きる。
- 部品の脆弱性は、自分のコードが変わらなくても、ある日新しく公開される。そのため毎週も実行する。
- どの部品を上げればよいか(修正版)まで教えてくれるので、Renovate による更新と組み合わせて直せる。

## このプロジェクトでどう使うか

ワークフローは [`.github/workflows/trivy.yml`](../../.github/workflows/trivy.yml) にある。判断の記録は [ADR 0021](../adr/0021-security-scans-and-renovate.md)。

### 公式イメージを digest で固定して動かす

よく使われる `aquasecurity/trivy-action` は使わず、Docker Hub の公式イメージ `aquasec/trivy` を、`uses: docker://aquasec/trivy:0.76.1@sha256:…` のように **digest** で固定して直接動かす。digest は、イメージの中身から計算したハッシュで、中身が1ビットでも変われば値が変わる。タグ(`0.76.1`)は付け替えられるが、digest で指定すれば、同じ中身しか動かない。

こうした理由は、**2026年3月の乗っ取り事件**である。攻撃者が盗んだ認証情報で、`trivy-action` のタグ77個のうち76個と、`setup-trivy` の全タグを、CI のシークレット(トークンや鍵)を盗むコードに付け替えた。悪意のある Trivy 本体 v0.69.4 も公開された。`@v0.x` のようにタグで参照していたワークフローは、ファイルを1行も変えずに攻撃コードを実行した。SHA で固定していた利用者は影響を受けなかった。`trivy-action` は、中で `setup-trivy` → インストールスクリプト → Trivy 本体と、信頼する段が多い。イメージを直接動かせば、信頼するのはイメージ1つになり、トークンも渡さない。

GHCR(`ghcr.io/aquasecurity/trivy`)にも同じイメージ(digest も同じ)があるが、Renovate が GHCR の公開日時を読めず、「公開から7日待つ」設定が効かないので、Docker Hub を使う。

### 新しい版の digest を確かめる

Renovate が Trivy のイメージの更新を提案してきたら、マージの前に次を確かめる(v0.76.1 を固定したときに行った方法)。

1. 版のリリースが、公式リポジトリの Security Advisories で問題とされていないこと(`gh api repos/aquasecurity/trivy/security-advisories`)。
2. その版のタグで動いた公式のリリース用ワークフロー(`release.yaml`)の実行記録に、PR の digest が出力されていること。`gh run list -R aquasecurity/trivy --workflow release.yaml` で実行を探し、ジョブのログで `digest=sha256:…` を検索する。
3. 同じ digest が GHCR(`ghcr.io/aquasecurity/trivy`)にもあること。乗っ取られたのが1つのレジストリだけなら、digest が食い違う。

### 2回動かす

1. すべての深刻度の結果を SARIF(解析結果の標準形式)に書き出し、`github/codeql-action/upload-sarif` で Security タブの Code scanning に登録する(カテゴリ `trivy`)。CodeQL の結果と同じ画面で、一覧と履歴を見られる。
2. **HIGH 以上で、修正版が出ているもの**があれば失敗させる(オーナーが選んだ基準)。`--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1`。表の形式でログに出る。修正版がないものは直しようがないので CI を止めない(Security タブには出る)。

2回目は `--skip-db-update` で、1回目にダウンロードした脆弱性 DB を使う。コンテナで動くステップは、ホームディレクトリ(`/github/home`)を共有するので、DB の置き場(`$HOME/.cache/trivy`)が引き継がれる。

### オプション

- `--scanners vuln`: 脆弱性だけを検査する。Trivy は秘密情報の検査もできるが、それは GitHub のシークレットスキャンに任せる。
- `--include-dev-deps`: 開発用の依存関係(devDependencies)も報告する。**Trivy は既定では報告しない**。いまの依存関係はすべて開発用なので、これがないと何も検査されない。開発用の道具も CI で動き、乗っ取られれば被害が出るので、検査の対象にする。

### 脆弱性が見つかったら

1. ログか Security タブで、どの部品のどの版か、修正版は何かを見る。
2. 直接の依存関係なら、Renovate の PR を待つか、`package.json` の版を上げる。依存関係の依存関係なら、直接の依存関係を上げるか、pnpm の `overrides` で版を指定する。
3. どうしても今すぐ直せず、影響がないと判断した場合は、`.trivyignore` に CVE の番号と理由を書いて除外する(このファイルは、必要になったときに作る)。
