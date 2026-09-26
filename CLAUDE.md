# 開發規則

- 本產品是台灣包裝烘焙食品的標示輔助工具；不能宣告全面合法或官方認證。
- 先讀 docs/requirements.md、docs/regulations.md、docs/release-checklist.md。
- npm run check：型別、規則/PDF/備份測試與正式 build。npm run test:e2e：瀏覽器流程。
- React/TypeScript/Vite；資料留在 localStorage；不新增 API、AI 呼叫、追蹤器或遠端字型。
- 規則放 src/domain；介面與 PDF 不得各自實作一套判定。尺寸一律 mm；PDF 才轉 pt。
- 原始輸入以十進位字串保存；不得猜測營養、有效日期、過敏原、成分或使用者確認。
- 預覽和下載必須使用同一份 PDF bytes。輸入改變即使舊預覽失效。
- 缺字、內容溢出、資料缺漏不可靜默截掉、縮字或補成零。
- src/domain/release.ts 的審閱/實印狀態，只有在已有真實證據且完成 release checklist 時才能更新。不得以測試通過取代實印或法規審閱。
- 法規規則需有來源、適用條件、狀態及日期；草案不能作現行法。規則變更需附回歸測試。
- public repo 只放虛構資料。不得提交真實備份、供應商資料、密鑰或本機設定。
- 每阶段獨立分支與 PR；沒有遠端登入時保留本機階段分支與提交，不偽稱已建立 PR。
