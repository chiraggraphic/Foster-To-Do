# Foster Tasks

Zoho-style task manager for Foster Creative Agency: Google login, shared team workspace, client directory, task assignment, reports to the boss on WhatsApp, CSV export. Static site (HTML/CSS/JS) with Firebase Auth + Firestore for login and storage.

## Files
- `index.html` page and login screen
- `style.css` styling
- `app.js` app logic and Firebase code
- `firebase-config.js` your Firebase keys (edit this)
- `firestore.rules` security rules (paste into Firebase)

## Setup (about 10 minutes)
1. Go to https://console.firebase.google.com and create a project.
2. Build > Authentication > Get started > Sign-in method > enable **Google** only (leave Email/Password OFF).
3. Build > Firestore Database > Create database (production mode) and choose location **asia-south1 (Mumbai)**.
4. Open `firestore.rules`, replace `owner@example.com` with the owner's email ID (lowercase), then paste it in Firestore > Rules and Publish.
5. Project settings > Your apps > Web (`</>`): register an app and copy the config into `firebase-config.js`. Also set `ownerEmail` there to the same owner email.
6. Push the files to your GitHub repository (below) and turn on Pages: Settings > Pages > Deploy from branch `main`, folder `/ (root)`.
7. Firebase > Authentication > Settings > Authorized domains: add `YOUR-USERNAME.github.io`.
8. Open the site. **The owner clicks Sign in with Google** using the owner Gmail, then gives permission to staff in the Team page. A staff member can sign in with Google only after the owner has added their Gmail there. Everyone else is blocked.

## Automatic WhatsApp follow-up to the boss
The `functions/` folder sends WhatsApp messages by itself using the official WhatsApp Business Cloud API:
- every day at 9:00 AM IST: overdue, due today, waiting approval, flagged follow-ups, unassigned, done in the last 24 hours
- instantly when a task moves to **In Review** (needs approval) or **Done**

Setup (one time):
1. Firebase must be on the **Blaze** (pay-as-you-go) plan to deploy functions. Small usage costs very little.
2. developers.facebook.com > Create app (type Business) > add **WhatsApp**. In WhatsApp > API Setup note the **Phone number ID** and add the boss's number as a recipient (the free test number allows up to 5 verified recipients; use your own number for real use). The boss must agree to receive messages.
3. Create a permanent token: Business Settings > System users > add a user > generate token with `whatsapp_business_messaging`. (The token shown on API Setup expires in 24 hours.)
4. WhatsApp Manager > Message templates > create `foster_followup`, category **Utility**, language **English**, body:
   `Foster Creative Agency follow-up: {{1}}. Open the Foster Tasks app for details.`
   Sample for {{1}}: `Overdue 2: Logo design (Ravi) | Due today 1`. Wait until it is Approved.
5. In the app: Reports > "Boss number" (owner only), enter the boss number with country code.
6. Deploy:
```
npm i -g firebase-tools
firebase login
# put your project id in .firebaserc, then:
cd functions && npm install && cd ..
firebase functions:secrets:set WA_TOKEN        # paste the permanent token
firebase functions:secrets:set WA_PHONE_ID     # paste the Phone number ID
firebase deploy --only functions,firestore:rules
```
Test: move any task to In Review. The boss should get a WhatsApp within a few seconds. Check `firebase functions:log` if not.

Meta charges per message depending on category and country, so check current pricing. The Follow-ups page in the app lets the boss approve, set a follow-up for tomorrow, leave a note, or nudge the assignee on WhatsApp.

## How it works
- Owner = full access, manages Team and the boss WhatsApp number. Members = work with tasks and clients.
- Clients page stores company, contact, phone, email, GST, address, notes, status and shows all tasks for that client. The search box searches everything.
- Reports page builds a summary (by status, member, client, overdue). "Send to boss on WhatsApp" opens WhatsApp with the report typed in; press send. Set the boss number once.

## Push to GitHub
```
git init
git add .
git commit -m "Foster Tasks"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/REPO-NAME.git
git push -u origin main
```

## Run locally
`python3 -m http.server 8000` then open http://localhost:8000. Until `firebase-config.js` is filled in, the app runs in local mode (browser only).
