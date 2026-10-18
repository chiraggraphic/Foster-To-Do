// Sends WhatsApp messages to the boss automatically (WhatsApp Business Cloud API).
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {setGlobalOptions} = require("firebase-functions/v2");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({region: "asia-south1"}); // must match your Firestore location

const WA_TOKEN = defineSecret("WA_TOKEN"), WA_PHONE_ID = defineSecret("WA_PHONE_ID");
const secrets = [WA_TOKEN, WA_PHONE_ID];
const TEMPLATE = "foster_followup", LANG = "en", GRAPH = "v21.0";

async function send(text) {
  const s = await db.doc("settings/main").get();
  const to = s.exists && s.data().bossPhone;
  if (!to) { console.log("Boss WhatsApp number not set (Reports page)."); return; }
  // Template parameters must be single line
  const clean = String(text).replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").slice(0, 900);
  const r = await fetch(`https://graph.facebook.com/${GRAPH}/${WA_PHONE_ID.value()}/messages`, {
    method: "POST",
    headers: {Authorization: "Bearer " + WA_TOKEN.value(), "Content-Type": "application/json"},
    body: JSON.stringify({messaging_product: "whatsapp", to, type: "template",
      template: {name: TEMPLATE, language: {code: LANG},
        components: [{type: "body", parameters: [{type: "text", text: clean}]}]}})
  });
  if (!r.ok) console.error("WhatsApp error", r.status, await r.text());
}

// Daily follow-up summary, 9:00 AM India time. Change the cron to 0 9,18 * * * for morning + evening.
exports.dailyFollowup = onSchedule({schedule: "0 9 * * *", timeZone: "Asia/Kolkata", secrets}, async () => {
  const [ts, tm] = await Promise.all([db.collection("tasks").get(), db.collection("team").get()]);
  const names = {}; tm.forEach(d => names[d.id] = d.data().name || d.id);
  const today = new Date().toLocaleDateString("en-CA", {timeZone: "Asia/Kolkata"}), day = Date.now() - 864e5;
  const T = ts.docs.map(d => d.data()), open = T.filter(t => t.status !== "done");
  const od = open.filter(t => t.due && t.due < today), dt = open.filter(t => t.due === today);
  const rv = open.filter(t => t.status === "review"), fl = open.filter(t => t.followUp && t.followUp <= today);
  const un = open.filter(t => !t.assignee), dn = T.filter(t => t.status === "done" && t.doneAt > day);
  const lst = od.slice(0, 3).map(t => `${t.title} (${names[t.assignee] || "Unassigned"})`).join("; ");
  await send(`Overdue ${od.length}${lst ? ": " + lst : ""} | Due today ${dt.length} | Waiting approval ${rv.length} | Follow-up flagged ${fl.length} | Unassigned ${un.length} | Done in last 24h ${dn.length}`);
});

// Instant alert when a task moves to In Review (needs approval) or Done.
exports.taskAlert = onDocumentWritten({document: "tasks/{id}", secrets}, async (e) => {
  const b = e.data.before.exists ? e.data.before.data() : null;
  const a = e.data.after.exists ? e.data.after.data() : null;
  if (!a) return;
  const moved = s => a.status === s && (!b || b.status !== s);
  if (!moved("review") && !moved("done")) return; // delete the "done" alert here if it is too noisy
  let who = a.assignee || "Unassigned";
  if (a.assignee) { try { const m = await db.doc("team/" + a.assignee).get(); if (m.exists) who = m.data().name || who; } catch (err) {} }
  await send(`${moved("review") ? "Needs your approval" : "Completed"}: ${a.title} | Client: ${a.client || "-"} | By: ${who}`);
});
