# 🏸 Shuttle App — Edogawa Badminton Lottery

> Your personal badminton lottery helper for 江戸川区 えどねっと  
> Live at: **https://samkarikalan.github.io/shuttle-app**

---

## 📱 How to use on your phone

1. Open Safari or Chrome on your phone
2. Go to `https://samkarikalan.github.io/shuttle-app`
3. Tap **Share → Add to Home Screen**
4. It appears as an app on your home screen!

---

## 🚀 First-time GitHub Setup (do this once)

### Step 1 — Create the repository

1. Go to [github.com](https://github.com) and log in
2. Click **＋ New repository** (top right)
3. Name it exactly: `shuttle-app`
4. Set to **Public**
5. Click **Create repository**

### Step 2 — Upload these files

Drag and drop ALL files from this zip into the repository:
```
index.html
style.css
app.js
icon.png
slots_data.json
scripts/scrape.py
.github/workflows/scrape.yml
```

Or use GitHub Desktop app to push them all at once.

### Step 3 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Branch: `main`, Folder: `/ (root)`
4. Click **Save**
5. Wait ~2 minutes → your app is live at `https://samkarikalan.github.io/shuttle-app`

### Step 4 — Add your えどねっと credentials as Secrets

⚠️ This keeps your password safe — it's never visible in the code.

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these two secrets:

| Name | Value |
|------|-------|
| `EDONET_UID` | Your えどねっと User ID |
| `EDONET_PW` | Your えどねっと Password |

### Step 5 — Run the scraper for the first time

1. Go to your repo → **Actions** tab
2. Click **🏸 Scrape Badminton Slots** on the left
3. Click **Run workflow** → **Run workflow**
4. Wait ~1 minute for it to finish
5. Open your app — live slot data will appear! 🎉

---

## ⚙️ How it works

```
GitHub Actions (every 6 hours)
    ↓
Python scraper logs into えどねっと
    ↓
Checks your 4 halls for available badminton slots
    ↓
Saves slots_data.json to this repo
    ↓
Your phone reads it from GitHub Pages
```

**Scrape schedule:** 9 AM, 3 PM, 9 PM, 3 AM (JST)

---

## 🏟️ Your 4 halls

- 臨海町コミュニティ会館 (Rinkaichou)
- 北葛西コミュニティ会館 (Kitakasai)
- 西葛西コミュニティ会館 (Nishikasai)
- 長島コミュニティ会館 (Nagashima)

---

## 📅 Lottery Schedule (every month)

| Date | Event |
|------|-------|
| 1st, 9:00 AM | Lottery window opens |
| 10th, 10:00 PM | Application deadline |
| After 10th | Check メッセージ for results |
| 25th, noon | Vacancy slots open (葛西 area) |
| 26th, noon | Vacancy slots open (小岩・東部 area) |
