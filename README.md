# 健身教練課程預估與收款追蹤網頁

自由接案健身教練用的網頁：串接 **Google 日曆**（排課事實來源），每天晚上自動抓取當月課程，算出每位學生的剩餘堂數與應收/未收金額，部署在雲端可以直接用手機瀏覽。

- 一對一實體教學，每次一小時，Google 日曆事件標題＝學生姓名
- 學生每次購買固定堂數的課程包（預設 10 堂），分包結算（一包用完才算下一包）
- 日曆上當天結束時還留著的事件＝這堂課實際有上（取消/調課會直接刪除或移動事件，不需另外處理未到狀態）
- 每天 22:00（台灣時間）自動重新抓取「當月 1 號到今天」的日曆事件並整月重算一次；換月後自動變成新的月份資料，舊月份原封不動留著

## 技術棧

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- `googleapis`（Google Calendar API，OAuth2）
- `@upstash/redis`（資料儲存：學生、課程包購買、每月上課紀錄、Google Token）
- 部署在 **Vercel**：內建 Cron Jobs 做每日自動排程，免費方案即可
- 網站前面有一道簡單密碼保護（環境變數設定），手機瀏覽器打開就能用

## 1. 部署到 Vercel

1. 到 [vercel.com](https://vercel.com) 用 GitHub 帳號登入，選擇 Import 這個 repo，Framework 會自動偵測為 Next.js，直接部署。
2. 部署完成後，到專案 **Storage** 分頁，加入一個 **Redis**（Upstash）資料庫（Marketplace → Redis → Add），Vercel 會自動把 `KV_REST_API_URL` / `KV_REST_API_TOKEN`（或 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`，視版本而定）注入環境變數，不用手動設定。
3. 到專案 **Settings → Environment Variables** 加入以下變數（詳見下方各節說明）：

| 變數 | 說明 |
|---|---|
| `APP_PASSWORD` | 網站登入密碼，自己設一組即可 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 憑證（見第 2 節） |
| `GOOGLE_REDIRECT_URI` | `https://你的網域/api/google/callback` |
| `CRON_SECRET` | 隨機字串，保護排程端點不被外部呼叫（見第 3 節） |

4. 加完環境變數後點 **Redeploy** 重新部署一次讓變數生效。

## 2. 設定 Google Calendar OAuth

1. 到 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 建立專案（或使用現有專案）。
2. 啟用 **Google Calendar API**（APIs & Services → Library → 搜尋 Google Calendar API → Enable）。
3. 建立 OAuth 用戶端 ID（APIs & Services → Credentials → Create Credentials → OAuth client ID），類型選 **網頁應用程式 (Web application)**。
4. 把 `https://你的網域/api/google/callback` 加進「已授權的重新導向 URI」。
5. 複製 Client ID / Client Secret，設定到 Vercel 環境變數 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`，並把 `GOOGLE_REDIRECT_URI` 設成同一個網址。
6. 重新部署後，到網頁「設定」頁面按「連接 Google 日曆」，用你自己的 Google 帳號完成授權（只需做一次，之後 refresh token 會自動更新 access token）。

## 3. Cron 自動排程（已內建）

`vercel.json` 已經設定 `0 14 * * *`（UTC，等於台灣時間每天 22:00，台灣不使用夏令時間所以固定 UTC+8）自動呼叫 `/api/cron/sync`。這個端點會用 `CRON_SECRET` 環境變數驗證是 Vercel 自己觸發的請求（Vercel 會自動帶上 `Authorization: Bearer $CRON_SECRET`），所以只要有設定 `CRON_SECRET` 就不需要額外設定。如果你想改時間，直接改 `vercel.json` 裡的 cron 排程字串。

儀表板上也有「立即同步」按鈕，可以隨時手動觸發，不用等到晚上。

## 4. 使用方式

1. 手機或電腦瀏覽器打開你的 Vercel 網址，輸入 `APP_PASSWORD` 登入。
2. 先到「學生管理」新增學生（姓名要跟 Google 日曆事件標題「包含」的字串一致），並幫每位學生新增第一筆課程包購買紀錄（購買堂數、單堂課費、是否已收款）。
3. 到「設定」頁面確認 Google 日曆已連接。
4. （建議）在「設定」頁的「上課事件顏色篩選」選一個顏色，之後在 Google 日曆幫每一堂課的事件都設成這個顏色——這樣同步時就只會比對這個顏色的事件，你排的其他行程（用別的顏色）不會被誤算成課程，就算標題剛好提到學生的名字也一樣。不選的話預設會比對所有事件（跟舊行為一樣）。
5. 之後系統每天 22:00 自動同步；也可以在「儀表板」按「立即同步」手動刷新。
6. 儀表板最上方是**本月預估卡片**：預估課程數量（含已排定但還沒上的未來課程）、預估課程收入、場地租借費用（可直接編輯覆蓋當月數字，不填則沿用設定頁的預設值）、扣掉場地費後的淨收入。
7. 下面是每位學生一張卡片，顯示：
   - 單堂課費、已用/剩餘堂數、應收金額、未收款總額、最近上課日期
   - 剩餘堂數低於設定門檻（預設 2 堂）時標紅提醒續購
   - 完全比對不到任何學生的日曆事件（且顏色符合上面設定的上課顏色）、或一個事件同時比對到多位學生，會在頁面上方持續顯示警示（來自最近一次同步結果，不管是自動排程還是手動觸發都看得到）
8. 點一張卡片可展開查看該學生的課程包購買歷史，每筆都可以按「編輯」直接修正購買日期、購買堂數、單堂課費（設定打錯時用這個修正），也可以標記已收款、新增購買、手動覆蓋已用堂數。

**「已用堂數」與「本月預估」的差別**：已用堂數/剩餘堂數只計算「已經發生」的課（日曆事件日期 ≤ 今天），確保堂數不會因為未來排定的課還沒真的上就被扣掉；本月預估則會把這個月「已經排在日曆上但還沒到」的課也一併算進去，讓你提早看到這個月大概的收入輪廓。

## 專案結構

```
app/
  page.tsx                  儀表板（核心數據卡片、立即同步、警示訊息）
  students/page.tsx         學生管理（新增學生、課程包購買、收款狀態）
  settings/page.tsx         設定頁（Google 連接狀態、提醒門檻）
  login/page.tsx            密碼登入頁
  api/
    login/                  密碼登入/登出
    google/auth,callback    Google OAuth 流程
    students/                學生 CRUD
    purchases/                課程包購買 CRUD（含收款狀態）
    sessions/                 上課紀錄查詢（來自每月同步快照）
    settings/                 讀寫提醒門檻/日曆ID/預設場地租借費用
    dashboard/                核心數據計算結果 + 本月預估
    venue-fee/                 設定當月場地租借費用覆蓋值
    sync/                     手動同步（當月）
    cron/sync/                 排程自動同步（Vercel Cron 呼叫，當月）
lib/
  kvStore.ts                 KV 讀寫抽象層（雲端用 Upstash Redis，本機開發 fallback 成 JSON 檔）
  store.ts                   學生/購買/月份快照/設定/Token 的型別化存取
  google.ts                  Google OAuth + 日曆事件讀取
  matching.ts                 姓名比對邏輯
  sync.ts                     同步主流程：整月重新抓取並覆蓋快照
  metrics.ts                   每位學生核心數據計算（FIFO 分包）+ 本月預估（含未來已排定課程）
  timezone.ts                  台灣時間（UTC+8）月份範圍計算
  types.ts                     共用型別
  auth 相關見 middleware.ts 與 app/api/login
components/
  NavBar.tsx
  StudentDetail.tsx           學生展開明細（購買紀錄/收款/上課紀錄）
middleware.ts                 網站密碼保護（cookie gate）
vercel.json                   Cron 排程設定
```

## 本機開發

```bash
npm install
npm run dev
```

本機執行時如果沒有設定 `KV_REST_API_URL`/`KV_REST_API_TOKEN`，資料會自動存到本機 `data/store.local.json`（已加入 `.gitignore`），方便先在電腦上測試功能，不需要真的接一個雲端 Redis。要測試登入功能，記得先設定 `APP_PASSWORD` 環境變數（例如建立 `.env.local`）。

## 注意事項

- 密碼保護是給單人使用的輕量方案（cookie 直接比對 `APP_PASSWORD`），不是完整的帳號系統；如果要更嚴謹的保護可以之後再加強。
- 「已用堂數」以 Google 日曆比對結果自動計算為主，若有例外狀況（例如日曆事件被誤刪但實際有上課），可在課程包購買紀錄展開明細中手動調整覆蓋。
- 所有憑證（Google OAuth token、密碼）都透過環境變數或雲端 KV 儲存，不會寫死在程式碼或進版控。
