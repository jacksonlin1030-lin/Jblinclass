# 健身教練課程預估與收款追蹤網頁

自由接案健身教練用的本機網頁：串接 **Notion**（學生 / 課程包 / 上課紀錄的主要儲存）與 **Google 日曆**（排課事實來源），自動比對「日曆上實際發生的課」與「Notion 裡的課程包」，算出每位學生的剩餘堂數與應收/未收金額，不用再手動對帳。

- 一對一實體教學，每次一小時，Google 日曆事件標題＝學生姓名
- 學生每次購買固定堂數的課程包（預設 10 堂），分包結算（一包用完才算下一包）
- 日曆上當天結束時還留著的事件＝這堂課實際有上（取消/調課會直接刪除或移動事件，不需另外處理未到狀態）

## 技術棧

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- `@notionhq/client`（Notion API）
- `googleapis`（Google Calendar API，OAuth2）
- 所有憑證存在本機檔案 `data/config.local.json`（已加入 `.gitignore`，不會進版控），不寫死在程式碼裡

## 1. 安裝與啟動

```bash
npm install
npm run dev
```

開啟 http://localhost:3000 ，先到「設定」頁面完成以下設定，再回到「儀表板」使用。

## 2. 建立 Notion 資料庫

在你的 Notion workspace 建立 **3 個資料庫**，欄位名稱必須完全一致（設定頁面裡也有同一份表格可對照）：

### 學生資料庫 (Students)
| 欄位 | 型態 |
|---|---|
| 姓名 | Title |
| 狀態 | Select（選項：`啟用`、`停用`） |

### 課程包購買紀錄資料庫 (Purchases)
| 欄位 | 型態 |
|---|---|
| 學生 | Relation → 學生資料庫 |
| 購買日期 | Date |
| 購買堂數 | Number（預設 10） |
| 單堂課費 | Number |
| 已收款 | Checkbox |
| 收款日期 | Date（選填） |
| 備註 | Text（選填） |
| 已用堂數手動調整 | Number（選填，日曆比對有例外狀況時可手動覆蓋自動計算的已用堂數） |

### 上課紀錄資料庫 (ClassRecords)
| 欄位 | 型態 |
|---|---|
| 學生 | Relation → 學生資料庫 |
| 日期 | Date |
| 對應課程包 | Relation → 課程包購買紀錄資料庫（同步時依購買日期 FIFO 自動指派，不用手動填） |
| Google日曆事件ID | Text（同步防重複寫入用，不用手動填） |
| 事件標題 | Text（同步時自動帶入原始日曆標題） |

建立好之後：

1. 到 [Notion Integrations](https://www.notion.so/my-integrations) 建立一個新的 Internal Integration，複製 **Internal Integration Token**（`secret_...`）。
2. 把上面 3 個資料庫都「分享」給這個 Integration（資料庫右上角 `...` → Connections → 選取你的 Integration）。
3. 複製每個資料庫的 ID：開啟資料庫、複製網址，網址中 `notion.so/` 後面、`?` 前面那段 32 碼字串就是 database ID。
4. 到本網頁「設定」頁面貼上 Token 與 3 個資料庫 ID，儲存後按「測試連線」確認可以讀到資料。

## 3. 設定 Google Calendar OAuth

1. 到 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 建立專案（或使用現有專案）。
2. 啟用 **Google Calendar API**（APIs & Services → Library → 搜尋 Google Calendar API → Enable）。
3. 建立 OAuth 用戶端 ID（APIs & Services → Credentials → Create Credentials → OAuth client ID），類型選 **網頁應用程式 (Web application)**。
4. 把設定頁面上顯示的「重新導向 URI」（預設 `http://localhost:3000/api/google/callback`）加進「已授權的重新導向 URI」。
5. 複製 Client ID / Client Secret，貼到本網頁「設定」頁面，儲存後按「連接 Google 日曆」完成授權（會跳轉到 Google 登入你自己的帳號）。

授權完成後 Token 會自動存到 `data/config.local.json`，之後 access token 過期會用 refresh token 自動更新，不用重複授權。

## 4. 使用方式

1. 在「儀表板」選擇日期範圍（預設本月初到今天），按「同步日曆」。
2. 系統會：
   - 抓取該範圍內的 Google 日曆事件
   - 用「事件標題包含學生姓名」的方式比對到學生（同一天同一學生多個事件都算入；一個事件比對到多位學生會標註「多重比對」提醒確認）
   - 完全比對不到任何學生的事件，會列在頁面最上方的警示區塊，不會被默默略過
   - 把新比對到的課程寫回 Notion 上課紀錄資料庫（用 Google 日曆事件ID 查重，重複執行同步不會產生重複紀錄），並依購買日期 FIFO 自動分配到對應的課程包（一包用滿才分配到下一包；全部用滿則指派到最新一包並標註「超額」提醒確認）
3. 儀表板表格（每位學生一列）顯示：
   - 單堂課費、已用堂數（可展開手動微調覆蓋自動值）、剩餘堂數、應收金額、未收款總額、最近上課日期
   - 剩餘堂數低於設定門檻（預設 2 堂）時該列標紅提醒續購
4. 點一列可展開查看該學生完整的課程包購買歷史（含收款狀態，可標記已收款、新增購買）與上課紀錄明細。

## 專案結構

```
app/
  page.tsx                 儀表板（核心數據表格、同步日曆、未比對事件警示）
  settings/page.tsx         設定頁（Notion / Google OAuth / 提醒門檻）
  api/
    config/                 讀寫本機設定
    google/auth,callback    Google OAuth 流程
    google/events            讀取日曆事件（測試用）
    notion/students          讀學生
    notion/purchases         讀/寫課程包購買紀錄（含收款狀態）
    notion/classrecords      讀上課紀錄
    dashboard                核心數據計算結果
    sync                     核心同步：比對 → 查重 → FIFO 分配 → 寫回 Notion
lib/
  config.ts                 本機設定檔讀寫（data/config.local.json）
  notion.ts / notion-schema.ts   Notion CRUD 與欄位名稱定義
  google.ts                 Google OAuth + 日曆事件讀取
  matching.ts                姓名比對邏輯
  sync.ts                    同步主流程
  metrics.ts                 每位學生核心數據計算
  types.ts                   共用型別
components/
  NavBar.tsx
  StudentDetail.tsx          學生展開明細（購買紀錄/收款/上課紀錄）
data/
  config.local.json.example  設定檔範例（實際檔案不會進版控）
```

## 注意事項

- 本專案設計為**本機執行**，沒有登入系統；所有 Token 存在本機 `data/config.local.json`，請勿把這個檔案分享出去或提交到 Git（已在 `.gitignore` 中排除）。
- 「已用堂數」以 Google 日曆比對結果自動計算為主，若有例外狀況（例如日曆事件被誤刪但實際有上課），可在課程包購買紀錄展開明細中手動調整覆蓋。
