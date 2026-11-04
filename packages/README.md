# packages/

複数のアプリから共有される部品を置きます。

| ディレクトリ | 役割 |
|---|---|
| `core/` | 全モジュールが依存する基盤(認証、イベント、ジョブ、通知、監査ログ、モジュール登録) |
| `db/` | DB接続とマイグレーションの実行の仕組み |
| `ui/` | 画面の共通部品 |
| `config/` | TypeScript・Vitest・ESLintなどの共通設定 |
| `modules/finance/` | 家計簿モジュール |
| `modules/calendar/` | カレンダーモジュール |
| `registry/` | サーバー側で載せるモジュールの一覧(api・mcp・worker・migrate が共通で読む) |

## モジュールのルール

- 各モジュールは自分専用のDBスキーマ(`finance`、`calendar` など)とマイグレーションを持ちます。
- **他のモジュールのテーブルを直接読み書きしません。** 連携はイベントか、公開されたインターフェースで行います。
- 他のモジュールを使うときは、公開用の入口(`@lifeos/<id>/public`)だけを import します。
- 詳細は [`docs/spec.md` §4.2〜4.3](../docs/spec.md) と [`docs/design/module-system.md`](../docs/design/module-system.md) を参照してください。
