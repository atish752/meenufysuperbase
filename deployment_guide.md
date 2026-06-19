# Meenufy Deployment Guide: Vercel & Google Firebase

This guide provides step-by-step instructions to deploy Meenufy to **Vercel** and connect it with **Google Firebase** for Authentication, Realtime Database sync, and Storage (for menu images).

All features run on **Firebase's free tier (Spark plan)**. You do NOT need to enable billing or enter a credit card.

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Step 1: Set Up a Firebase Project](#step-1-set-up-a-firebase-project)
3. [Step 2: Configure Firebase Services](#step-2-configure-firebase-services)
   - [Authentication (Email & Google)](#authentication-email--google)
   - [Realtime Database (Data Sync)](#realtime-database-data-sync)
   - [Firebase Storage (Menu Images)](#firebase-storage-menu-images)
4. [Step 3: Push Code to GitHub](#step-3-push-code-to-github)
5. [Step 4: Deploy to Vercel](#step-4-deploy-to-vercel)
6. [Step 5: Testing & Verification](#step-5-testing--verification)
7. [Offline Fallback (Local Dev)](#offline-fallback-local-dev)

---

## 1. Prerequisites
- A Google account (for Firebase).
- A GitHub account.
- A Vercel account (connected to your GitHub account).
- Node.js installed locally (if running verification checks).

---

## Step 1: Set Up a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Create a project** (or **Add project**).
3. Name your project (e.g., `Meenufy-App`) and click **Continue**.
4. Disable Google Analytics for this project (recommended to speed up setup, or enable it if preferred) and click **Create project**.
5. Once ready, click **Continue** to enter your Project Dashboard.
6. In the center of the dashboard, click the **Web icon (`</>`)** to register a web app.
7. Enter an App nickname (e.g., `Meenufy Web`) and click **Register app**.
8. Firebase will show you a `firebaseConfig` object containing credentials. Keep this tab open or copy these values; you will need them for Vercel environment variables:
   ```js
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

---

## Step 2: Configure Firebase Services

### Authentication (Email & Google)
1. In the Firebase left sidebar, click **Build** -> **Authentication**, then click **Get started**.
2. Under the **Sign-in method** tab, click **Add new provider**.
3. Select **Email/Password**:
   - Enable the **Email/Password** toggle (leave *Email link* disabled).
   - Click **Save**.
4. Click **Add new provider** again and select **Google**:
   - Enable the Google provider toggle.
   - Choose a project support email from the dropdown.
   - Click **Save**.

### Realtime Database (Data Sync)
1. In the Firebase sidebar, click **Build** -> **Realtime Database**, then click **Create database**.
2. Select your **Database location** (choose the one closest to your restaurant/customers) and click **Next**.
3. Select **Start in test mode** (this allows quick configuration without strict security constraints during launch) and click **Enable**.
4. Go to the **Rules** tab at the top and paste the following rules to allow read/write access:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
5. Click **Publish**.
6. Copy the **database URL** shown at the top of the Data tab (e.g. `https://your-project-id-default-rtdb.firebaseio.com/` or `https://your-project-id-default-rtdb.asia-southeast1.firebasedatabase.app/`). This is your `VITE_FIREBASE_DATABASE_URL`.

### Firebase Storage (Menu Images)
1. In the Firebase sidebar, click **Build** -> **Storage**, then click **Get started**.
2. Select **Start in test mode** and click **Next**.
3. Choose your Storage location (usually matches database location) and click **Done**.
4. Once initialized, go to the **Rules** tab at the top and replace the rules with the following to allow image uploads and reads:
   ```javascript
   rules_version = '2';

   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if true;
       }
     }
   }
   ```
5. Click **Publish**.

---

## Step 3: Push Code to GitHub

1. Initialize git in your local project root if not already done:
   ```powershell
   git init
   git add .
   git commit -m "feat: integrate firebase realtime database, auth, storage, and build verification"
   ```
2. Create a new repository on your [GitHub](https://github.com/) account (set it to private or public).
3. Copy the remote commands from GitHub and push:
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 4: Deploy to Vercel

1. Log in to [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
2. Find your `Meenufy` repository in the list and click **Import**.
3. Expand the **Environment Variables** section.
4. Add the following **7 Environment Variables** corresponding to your Firebase configuration details:

| Name | Value | Description |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | *Your Firebase apiKey* | Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | *Your Firebase authDomain* | Auth Domain |
| `VITE_FIREBASE_DATABASE_URL` | *Your Realtime Database URL* | E.g. `https://project-rtdb.firebaseio.com/` |
| `VITE_FIREBASE_PROJECT_ID` | *Your Firebase projectId* | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | *Your Firebase storageBucket* | Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | *Your Firebase messagingSenderId* | Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | *Your Firebase appId* | App ID |

5. Click **Deploy**. Vercel will build and launch your application in under a minute!

---

## Step 5: Testing & Verification

Once deployed, visit your Vercel URL and check these features:
1. **Admin Registration**:
   - Go to `/admin` (the admin login page).
   - Enter your email and password, choose **Sign Up**, and create an account.
   - Go to your Firebase Console -> Realtime Database. You should see a new `restaurantAccounts` node created with your admin record.
2. **Menu Creation & Storage Upload**:
   - In the Admin Panel, click **Add Item**.
   - Fill in details and upload an image using the upload dropzone or camera capture.
   - Verify that the image is saved in Firebase Storage (`menu_photos/YOUR_ADMIN_ID/...`) and successfully rendered on screen.
3. **Multi-device Realtime Sync**:
   - Scan the Table QR code or go to the Customer Panel URL on another browser or phone: `https://YOUR-VERCEL-APP.vercel.app/?restaurant=YOUR_UID&table=table-1` (replace `YOUR_UID` with your Firebase Auth UID from the database console).
   - In the Customer Panel, add items and place an order.
   - On the Admin Panel on your laptop, observe the order appearing instantly in real-time under the "Orders" list.

---

## Offline Fallback (Local Dev)

Meenufy is built to be resilient. If the environment variables are not supplied (e.g. running locally via `npm run dev` without a `.env` file):
- It operates in **Local Offline Mode**.
- Accounts, Menus, and Orders are stored securely in the browser's `localStorage` and synced across tabs using a `BroadcastChannel`.
- Image uploads are converted to local Base64 data URLs instead of uploading to the cloud.
- Any email can log in with a password matching its username, and the default account `atish3477` / `atish3477` is available instantly.
