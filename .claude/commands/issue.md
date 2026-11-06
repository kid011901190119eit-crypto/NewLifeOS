---
description: AGENTS.md の標準の手順に従って、GitHub の Issue に取り組む
argument-hint: <Issue番号>
disable-model-invocation: true
---

Issue #$ARGUMENTS に取り組みます。番号が空なら、作業を始める前にオーナーに番号を聞いてください。

AGENTS.md の「Issue に取り組むときの標準の手順」に従って進めてください。「1. 読む」と「2. 計画する」を行い、計画にオーナーの確認をもらうまではファイルを書き始めないでください。

テストを書く変更では、Red・Green・Refactor を別々のコミットにしてください(AGENTS.md ルール1)。最後の報告には、それぞれのコミットの SHA を書いてください。Red のコミットを作れないテスト(ADR 0032 の2種類)は、わざと壊す実験でテストが落ちることを確かめ、その内容をプルリクエストの本文に書いてください。

push の前に、ブランチのすべてのコミットの件名を commitlint で確かめ、誤りがあれば直してください(AGENTS.md「4. 確かめる」)。
