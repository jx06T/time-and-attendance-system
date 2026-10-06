# Firebase 配置復原（Cloud Shell）

目前工作目錄中的前端設定指向 Firebase 專案 `cksc-attendance`，使用 Cloud Firestore 的 `(default)` 資料庫及 Google 登入。Git 上一版提交的前端設定則是 `taas-jx`；請先確認你要恢復的是哪個專案，以下指令依目前工作目錄的 `cksc-attendance` 編寫。網站的 QR Code 指向 `https://attendance.cksc.tw`，部署時請確認目前正式網站仍使用這個網域。

## 1. 確認專案與資料庫

在 Firebase Console 開啟 Cloud Shell。Cloud Shell 已內建 Firebase CLI；若指令不存在，再安裝最新版 CLI。將本目錄的 `firebase.json`、`firestore.rules`、`firestore.indexes.json` 上傳到 Cloud Shell 的同一目錄，然後執行：

```bash
firebase --version
firebase projects:list
gcloud config set project cksc-attendance
gcloud firestore databases list --project cksc-attendance
```

若 `firebase projects:list` 無法列出該專案，執行 `firebase login --no-localhost`，以有該專案管理權限的 Google 帳號登入。若 `(default)` 資料庫不存在，先確認**原本的資料庫位置**再建立；新建空資料庫不會復原舊資料：

```bash
gcloud firestore databases create \
  --project=cksc-attendance \
  --database='(default)' \
  --type=firestore-native \
  --location=YOUR_ORIGINAL_FIRESTORE_LOCATION
```

若專案 ID `cksc-attendance` 也不存在，這些指令無法復原已刪除的專案、Auth 使用者或 Firestore 文件。先檢查專案與資料備份。

## 2. 部署 Firestore 規則與索引

從上述三個檔案所在的 Cloud Shell 目錄執行：

```bash
firebase deploy --project cksc-attendance --only firestore:rules,firestore:indexes
firebase firestore:indexes --project cksc-attendance
```

部署規則會覆蓋 Firebase Console 中現有的 Firestore 規則。索引建立可能需要幾分鐘。規則只覆蓋專案實際用到的 `users`、`admins`、`timeRecords`、`publicData/weeklyChampion`；未列出的路徑預設拒絕存取。

## 3. 恢復 Google 登入

目前 Firebase CLI 可設定 Google Authentication 提供者。它需要你自己的 OAuth 顯示名稱及已註冊的支援信箱，因此執行互動式初始化：

```bash
firebase init auth --project cksc-attendance
# 只選 Google Sign-In，依提示填入 OAuth 顯示名稱、支援信箱及網站 URL。
firebase deploy --project cksc-attendance --only auth
```

`firebase init auth` 會在現有 `firebase.json` 加入 `auth` 區塊；保留其中的 `firestore` 區塊。此專案沒有使用 Email/Password 或匿名登入。到 Firebase Console → Authentication → Settings → Authorized domains，確認 `attendance.cksc.tw`（若目前仍是正式網域）已加入；登入頁使用 `signInWithPopup`。本地測試若需要 `localhost`，另行加入授權網域。

## 4. 首位 SuperAdmin 與空資料庫初始化

程式以 `admins/{Firebase Auth UID}` 的 `role` 欄位判斷 `superadmin`、`admin`、`clocker`。只有現有 SuperAdmin 能在網頁中指派角色。因此如果 `admins` 已遺失，請先用 Google 登入一次，在 Firebase Console → Authentication → Users 複製自己的 UID，並用具備 Firestore 寫入 IAM 權限的 Cloud Shell 帳號建立角色文件：

```bash
read -rp '你的 Firebase Auth UID: ' ADMIN_UID
curl --fail-with-body -sS -X PATCH \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H 'Content-Type: application/json' \
  --data '{"fields":{"role":{"stringValue":"superadmin"}}}' \
  "https://firestore.googleapis.com/v1/projects/cksc-attendance/databases/(default)/documents/admins/${ADMIN_UID}?updateMask.fieldPaths=role"
```

若 `users` 集合也已空白，登入流程仍要求相同 Email 的個人資料。先從備份還原；或只為自己建立一筆 `users` 文件，欄位需要 `email`（小寫）、`uid`、`name`、`classId`、`seatNo`、`studentId`。以下只在該使用者文件**確定不存在**時執行，並填入真實資料：

```bash
read -rp '你的 Google Email（小寫）: ' ADMIN_EMAIL
read -rp '姓名: ' ADMIN_NAME
read -rp '班級: ' ADMIN_CLASS
read -rp '座號: ' ADMIN_SEAT
read -rp '學號: ' ADMIN_STUDENT_ID
jq -n \
  --arg uid "$ADMIN_UID" --arg email "$ADMIN_EMAIL" \
  --arg name "$ADMIN_NAME" --arg classId "$ADMIN_CLASS" \
  --arg seatNo "$ADMIN_SEAT" --arg studentId "$ADMIN_STUDENT_ID" \
  '{fields:{uid:{stringValue:$uid},email:{stringValue:$email},name:{stringValue:$name},classId:{stringValue:$classId},seatNo:{stringValue:$seatNo},studentId:{stringValue:$studentId}}}' \
  | curl --fail-with-body -sS -X POST \
      -H "Authorization: Bearer $(gcloud auth print-access-token)" \
      -H 'Content-Type: application/json' --data-binary @- \
      "https://firestore.googleapis.com/v1/projects/cksc-attendance/databases/(default)/documents/users?documentId=${ADMIN_UID}"
```

首頁週榜程式使用 `updateDoc`，因此空資料庫還需建立 `publicData/weeklyChampion`。下列 POST 若文件已存在會失敗，不會覆蓋現有週榜：

```bash
curl --fail-with-body -sS -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H 'Content-Type: application/json' \
  --data '{"fields":{"topFive":{"arrayValue":{}}}}' \
  'https://firestore.googleapis.com/v1/projects/cksc-attendance/databases/(default)/documents/publicData?documentId=weeklyChampion'
```

若 Firebase 專案或 Auth 使用者被重建，新的 UID 可能不同於舊 `users.uid`。核對使用者身份後，才應修正相應的 `users.uid` 與 `admins/{uid}`。規則、索引與 Authentication 提供者設定均無法還原已刪除的業務資料。

## 規則與查詢對照

| 路徑 | 網頁使用方式 | 規則 |
| --- | --- | --- |
| `users` | Google Email 查詢、首次登入綁定 UID、管理者匯入 | 本人讀取與僅一次 UID 綁定；工作人員讀取；SuperAdmin 管理 |
| `admins/{uid}` | 登入後查角色、權限管理 | 本人讀取角色；SuperAdmin 列表與管理他人角色 |
| `timeRecords/{email}_{date}` | 個人紀錄、打卡、批次打卡、報表 | 本人讀取；工作人員讀取；Clocker 僅簽到簽退；Admin／SuperAdmin 編輯 |
| `publicData/weeklyChampion` | 公開週榜、管理者發布 | 公開讀取；Admin／SuperAdmin 寫入 |

`firestore.indexes.json` 為個人紀錄與月報表提供 `userEmail + date DESC`，並為今日已簽退監聽提供 `date + checkOut ASC`。其餘程式查詢使用 Firestore 自動單欄索引或等值查詢索引合併。
