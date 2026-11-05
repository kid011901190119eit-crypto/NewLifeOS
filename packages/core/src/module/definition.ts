/**
 * サーバー用のモジュールの定義(module-system.md §3)。
 * 今は migrate が使う項目だけを持つ。フェーズ4で defineModule とともに、routes・tools などの項目を足す。
 */
export interface AnyModuleDefinition {
  /** DB のスキーマ名にもなる(§3.4) */
  readonly id: string;
  readonly migrations: {
    /** drizzle-kit generate が出力したフォルダの絶対パス */
    readonly folder: string;
  };
}
