# ADR(設計判断の記録)

ADR(Architecture Decision Record)は、「何を・なぜ決めたのか」を1件1ファイルで残す記録です。後から「なぜこうなっているのか」を確認できるようにします。

## ルール

- 新しいADRは [`0000-template.md`](0000-template.md) をコピーし、次の番号を振って作ります。
- 一度「承認」したADRは書き換えません。判断を変えるときは新しいADRを作り、古いADRのステータスを「置き換え済み(→ 新しい番号)」にします。

## 一覧

| # | タイトル | ステータス |
|---|---|---|
| [0001](0001-modular-monolith.md) | マイクロサービスではなくモジュラーモノリスにする | 承認 |
| [0002](0002-hosting-oracle-cloud.md) | ホスティングはOracle Cloud Always Freeにする | 承認 |
| [0003](0003-react-spa-and-hono.md) | 画面はReact SPA、APIはHonoで分離する | 承認 |
| [0004](0004-double-entry-bookkeeping.md) | 家計簿は複式簿記で記録する | 承認 |
| [0005](0005-agent-via-mcp-connector.md) | エージェント連携はMCPコネクタ方式にする | 承認 |
| [0006](0006-self-implemented-auth.md) | 認証はID+パスワードとGoogle OAuthを自前実装する | 承認 |
| [0007](0007-aws-for-external-monitoring.md) | AWSは外部死活監視にのみ使う | 承認 |
| [0008](0008-tdd.md) | 開発はTDDで進める | 承認 |
| [0009](0009-learning-first.md) | 主目的はオーナーの学習とし、理解を優先する | 承認 |
