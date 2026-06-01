# PR — <一句話標題>

## 解決什麼
<連結 Linear ticket：CLOSES LIN-123>
<一兩句說明這個 PR 解決的問題，不要貼 ticket 內容>

## 怎麼做的
<列點說明關鍵設計選擇，不要 paste 程式碼>

## 影響範圍
- [ ] 純後端
- [ ] 純前端
- [ ] BE + FE
- [ ] DB schema 變動（有 migration）
- [ ] API contract 變動（已更新 OpenAPI）
- [ ] 設定 / 環境變數變動（已更新 `.env.example`）

## 測試
- [ ] 已新增 / 更新 unit test
- [ ] 已新增 / 更新 integration test
- [ ] 已手動驗證 happy path
- [ ] 已手動驗證 error path
- [ ] CI 全綠

## 安全 / 隱私 checklist
- [ ] 沒有把 secret / token / API key 寫進程式碼
- [ ] 使用者輸入有經過驗證 / 跳脫
- [ ] 敏感資料未寫入 log
- [ ] 權限檢查到位（誰能呼叫此 API）

## 給 reviewer 的提示
<重點看哪幾個檔案 / 哪段邏輯 / 哪些邊界情境>

## 文件更新
- [ ] `CLAUDE.md` 是否需要更新慣例
- [ ] `PLAN.md` 已劃掉完成項
- [ ] 有重大決策 → 已寫 `docs/adr/<日期>-<名>.md`

---

<!--
AI Reviewer 提示：
請聚焦在 (1) 資安疑慮 (2) 與既有 ADR 是否衝突 (3) 邊界情境是否有測試 (4) 命名一致性
不要重複討論 lint 與格式，那已由 CI 處理
-->
