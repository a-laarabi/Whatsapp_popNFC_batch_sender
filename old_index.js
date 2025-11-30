const fs = require("fs");
const cron = require("node-cron");
const axios = require("axios");
const logFile = "log.json";
const dataFile = "data.json";
const BATCH_SIZE = 500;
// Load or initialize message count
let state = { messageCount: 0, failed: [] };

if (fs.existsSync(logFile)) {
  const raw = fs.readFileSync(logFile);
  state = JSON.parse(raw);
}

async function sendWhatsappMessage(phone) {
  await axios.post("http://localhost:3030/send-message", {
    to: phone,
  });
  // await axios.post("https://securewhats.getpopcard.com/send-message", {
  //   to: phone,
  // });
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
"0 9 * * *"
function loadData(file) {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch (e) {
    console.error(`❌ Error reading ${file}:`, e.message);
    return [];
  }
}

function saveLog(log) {
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
}

// Cron job: run every day at 9AM
// cron.schedule("0 18 * * *", async () => {
cron.schedule("* * * * *", async () => {
  console.log(
    `[${new Date().toISOString()}] 🟢 Starting daily message batch...`
  );

  const data = loadData(dataFile);
  let log = loadData(logFile);

  const start = log.currentIndex || 0;
  const end = Math.min(start + BATCH_SIZE, data.length);
  const batch = data.slice(start, end);

  for (let i = 0; i < batch.length; i++) {
    const phone = batch[i];

    try {
      await sendWhatsappMessage(phone);
      log.totalSent += 1;
      console.log(`✅ Sent to ${phone} start:${start} index:${i}`);
    } catch (err) {
      console.error(`❌ Error sending to ${phone}: ${err.message}`);
      log.failed.push({ phone, reason: err.message });
    }
    await delay(60 * Math.floor(1000 + Math.random() * 1000));
  }

  log.currentIndex = end;
  saveLog(log);

  console.log(
    `📦 Batch done. Sent: ${end - start}. Total sent so far: ${log.totalSent}`
  );
  if (end >= data.length) {
    console.log("🎉 All messages have been sent!");
  }
});



console.log("the script start running")

