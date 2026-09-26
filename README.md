# 標籤日常 EasyLabel

台灣包裝烘焙食品標籤工作台。React + TypeScript + Vite，純前端、免登入，商品資料只保存在使用者瀏覽器。

**目前是測試版：法規專業審閱、實際紙張及字體量測尚未完成，因此 PDF 保留「草稿／待確認」浮水印。程式測試不是全面合規驗證。**

[開啟公開試用版](https://kirkli9999.github.io/easylabel/)。可填寫自己的商品資料並下載草稿；內建資料為虛構示範，草稿請勿直接用於販售。各位使用者的商品資料保存在各自瀏覽器，不會因網站公開而分享給其他人。

## 本機啟動

安裝 Node.js 24 LTS（至少22.12）。在 repo 目錄執行：

```sh
npm ci
npm run dev
```

開啟終端顯示的網址（通常 http://127.0.0.1:5173）。內建商品、地址與營養數值都是虛構範例，不能直接用於販售。

## 功能

- 商品新增、複製、刪除、原料排序、複合成分、添加物與資料確認。
- 台灣11類過敏原、例外資料及同產線資訊分開處理。
- 每份/每100g八項營養；原始十進位字串與列印數值分開；零標示雙基準及相依條件。
- 清楚的有效日期/批號/張數批次；切換商品及新批次均重新確認日期。
- A4整張貼紙、預設120×130mm、兩張/頁，1–100張、自訂尺寸、裁切線、100mm测试頁。
- 字型隨站提供且嵌入PDF；預覽與下載共用相同bytes；文字過長或缺字就停止，不縮字或截斷。
- 自動本機保存、版本化JSON備份/嚴格匯入、檢查報告；失敗不丟掉記憶體編輯。
- 無API、無AI呼叫、無分析追蹤。清除瀏覽器資料會刪除商品，請定期匯出備份。

## 範圍

先支援國內完整包裝、常溫/冷藏、無肉及無特殊宣稱的一般烘焙食品。其他食品、未知資料、未完成檢查僅供草稿。詳見 [需求文件](docs/requirements.md)、[法規對照](docs/regulations.md)、[發布驗收](docs/release-checklist.md)。

使用者對營養資料、效期、原料及商品資訊負責。規則只做支援範圍的輔助檢查；不宣稱全面合法或食藥署認證。正式驗收需核對模板字型的實印長寬，不能將10pt視為2mm合規證明。

## 測試

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

單元測試涵蓋零標示邊界/相依条件、修整、日期、必填/過敏原/範圍、JSON匯入、PDF頁數與尺寸、缺字與溢出。瀏覽器測試使用 `/easylabel/` 子路徑的正式 build，驗證中文字型與PDF worker、下載、過期預覽、保存失敗、手機與備份。

`npm run test:e2e` 的實際PDF及截圖在 `test-results/`，不提交repo。

## GitHub 與發布

目標 repo：<https://github.com/kirkli9999/easylabel>。開發用分階段分支，詳見 [交付與遠端操作](docs/handoff.md)。

GitHub Actions Checks 執行型別、單元、PDF、瀏覽器測試。部署固定 `/easylabel/`；若更名需同步 Vite `BASE_PATH`、Playwright 與 workflow。

1. 推送並完成 PR 檢查，再合併至 main。
2. GitHub Settings → Pages → GitHub Actions。
3. 公開試用：設定 Actions repository variable `PUBLIC_PREVIEW_ENABLED=true`，執行 Publish GitHub Pages 工作流程。這只開啟網站部署，不會解除 PDF 草稿限制。
4. 正式標籤輸出：依 `docs/release-checklist.md` 完成法規審閱及普通紙/貼紙實印，在 `src/domain/release.ts` 紀錄真實驗收及內部證據索引，經 PR 複核才啟用。`PUBLIC_RELEASE_READY` 保留供正式發布使用。

使用者於 2026-09-27 授權先公開試用，讓朋友以實際商品資料體驗；法規審閱與實印狀態仍為未完成。關閉自動部署可將兩項部署變數設為 false；已上線內容需於 Pages 設定另行取消發布。

## 字型與授權

程式 MIT。`public/fonts/NotoSansCJKtc-Regular.otf` 為 Noto Sans CJK TC 靜態繁中字型（OFL，原授權見同目錄OFL.txt），來源 [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk/tree/main/Sans/OTF/TraditionalChinese)。完整字型約16MB，首次PDF產生需載入，之後重用。不依賴Google Fonts線上服務。

## 維護

規則版本 `tw-bakery-2026-09-v1`。法規條文、日期、來源、適用條件集中在domain與規則文件。修改必須附原始官方來源及測試，草案不能直接啟用。發現發布錯誤時回退上一驗收版本；備份schema不相容時保留原檔，不自動清空。
