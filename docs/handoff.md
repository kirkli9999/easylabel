# 開發交付與遠端操作

目標：`https://github.com/kirkli9999/easylabel`。原 repo 讀取時為空，沒有覆蓋既有程式。

## 分階段提交

- 初始規格：`phase/01-regulations`。
- 檢查引擎：`phase/02-rules`。
- PDF引擎：`phase/03-pdf`。
- 網站介面：`phase/04-workspace`。
- 測試/工作流程/最終修正：`phase/05-delivery`。

分支按上列順序相依。完整功能在最後分支；不要只啟動較早、尚未有介面的階段。PR依序以main、前一階段分支為base；合併前一階段後再調整base。main初始為空專案基底，不含功能。這樣每階段都有實際差異可審閱。

## GitHub 登入尚未完成時

在你自己的終端執行：

```sh
gh auth login
gh auth setup-git
```

不需要將token/密碼交給AI或放进repo。登入後才可推送並建立PR。未登入時，不代表遠端repo已收到程式。

## 維護順序

1. 先讀CLAUDE.md與regulations.md。任何未確認法規細節不能用AI記憶猜補。
2. 新增規則前先加入真實邊界測試；調整介面與輸出後跑Playwright並檢查PDF實際渲染。
3. 複製或匯入商品需重新確認資料；新批次日期獨立，不沿用過期確認。
4. 真實商品備份、測試報告與供應商文件留本機，不提交public repo。

## 已發現並修正的限制

- Noto Sans CJK TC OTF使用fontkit CFF子集嵌入時出現中文字形不完整，因此採**完整字型嵌入**，實際渲染複核後中文字正常。代價是每份PDF約14MB，不會每一標籤重複嵌入字型；100張仍共用一份。不可未經視覺回歸驗證就重新啟用subset。
- 測試必須等PDF.js render promise完成，不能僅以canvas尺寸存在視為渲染完成。
- 預覽資料改變後立即失效，舊bytes不能下載。產生途中若資料改變，也不接受舊結果。
- 無效紙張輸入不覆蓋上次有效設定，避免下一次啟動時整份localStorage解析失敗。
- 本機正式build與瀏覽器測試以`/easylabel/`驗證，不只測根目錄。

## 未執行的外部驗收

專業法規審閱、普通紙/貼紙實印、實際字體長寬量測均未執行。`release.ts`保持false。使用者已授權以 `PUBLIC_PREVIEW_ENABLED=true` 先公開試用草稿版；這與正式驗收獨立，詳見release-checklist.md。
