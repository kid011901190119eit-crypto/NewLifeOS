-- システム勘定の2件(開始残高・未分類)を作る。利用者の口座・ラベルはシードに入れない(spec §3.3.2・ADR 0030)
INSERT INTO "finance"."accounts" ("kind", "name", "system_key") VALUES
  ('equity', '開始残高', 'opening_balance'),
  ('suspense', '未分類', 'uncategorized');
