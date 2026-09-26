# 發布驗收

目前狀態：軟體測試版。尚未實印與專業法規審閱；正式標籤閘門預設關閉。這不是依法須事前送審的宣告。

- [ ] 食品技師/熟悉台灣標示法規的人員複核規則表、官方有效版本、例外及代表性標籤。記錄日期、角色、結果與內部證據索引（不公開個資）。
- [ ] 普通紙與相容A4整張貼紙，100%實際大小列印；100mm線誤差目標≤1mm。
- [ ] 固定字型10pt下的中文、數字、單位等實印長寬依適用規則量測，不能只測100mm線。必要時提高字級並重新驗全部版面。
- [ ] 實測標籤120×130mm、裁切線、邊界、墨水清晰、黏貼後資訊可讀。
- [ ] Chrome/Edge下載、預覽；手機可編輯下載。
- [ ] npm run check、npm run test:e2e 通過，核對公開子路徑字型/worker無404。
- [ ] 依證據更新 src/domain/release.ts 的兩項通過狀態、reviewedAt、evidence；再次執行測試及PR review。
- [ ] GitHub登入後建立public repo及階段PR。GitHub Settings→Pages→GitHub Actions。

正式網站公開部署工作流程預設需 repository variable PUBLIC_RELEASE_READY=true，未完成以上清單不要啟用。CI可先執行。失敗回復前一通過版本；localStorage schema變更須有遷移方案，不直接清掉舊商品。

## 真實驗收紀錄

法規審閱：未執行。
普通紙實印：未執行。
貼紙實印：未執行。
字體量測：未執行。
GitHub遠端/PR：需已登入的GitHub帳號。
