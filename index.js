const fs = require("fs");
const cron = require("node-cron");
const axios = require("axios").default;
const logFile = "log.json";
const dataFile = "data.json";
const BATCH_SIZE = 200;
const AXIOS_TIMEOUT = 10000; // 10s

function ensureLog() {
  if (!fs.existsSync(logFile)) {
    const init = { totalSent: 0, currentIndex: 0, failed: [] };
    fs.writeFileSync(logFile, JSON.stringify(init, null, 2));
  }
}

function loadJSON(file, defaultValue) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`Error reading ${file}: ${e.message}`);
    return defaultValue;
  }
}

function saveJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

async function sendWhatsappMessage(phone) {
  // basic validation
  if (!phone) throw new Error("empty phone");
  const payload = {
    to: phone,
  };

  return axios.post("http://localhost:3030/send-message", payload, {
    timeout: AXIOS_TIMEOUT,
  });
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

ensureLog();

// Schedule: run every day at 18:00 (6 PM). Change to "0 9 * * *" for 9AM.
// cron.schedule("* * * * *", async () => {
cron.schedule("30 15 * * *", async () => {
  console.log(`[${new Date().toISOString()}] Starting daily message batch...`);

  const data = loadJSON(dataFile, []);
  const log = loadJSON(logFile, { totalSent: 0, currentIndex: 0, failed: [] });

  const start = log.currentIndex || 0;
  if (start >= data.length) {
    console.log("All messages already processed.");
    return;
  }

  const end = Math.min(start + BATCH_SIZE, data.length);
  const batch = data.slice(start, end);

  for (let i = 0; i < batch.length; i++) {
    const phone = batch[i];
    try {
      // Attempt with simple retry
      const attempts = 3;
      let sent = false;
      for (let a = 1; a <= attempts; a++) {
        try {
          await sendWhatsappMessage(phone);
          sent = true;
          break;
        } catch (err) {
          console.warn(`Attempt ${a} failed for ${phone}: ${err.message}`);
          if (a < attempts) await delay(1000 * a); // linear backoff
        }
      }
      if (sent) {
        log.totalSent = (log.totalSent || 0) + 1;
        console.log(`Sent to ${phone} (start:${start} index:${i})`);
      } else {
        log.failed = log.failed || [];
        log.failed.push({
          phone,
          reason: "max attempts reached",
          time: new Date().toISOString(),
        });
        console.error(`Failed to send to ${phone} after retries`);
      }
    } catch (err) {
      console.error(`Unexpected error for ${phone}: ${err.message}`);
      log.failed.push({ phone, reason: err.message });
    }

    // delay between messages: 1-2 seconds
    // await delay(1000 + Math.floor(Math.random() * 1000));
    await delay(60 * Math.floor(1000 + Math.random() * 1000));
  }

  log.currentIndex = end;
  saveJSON(logFile, log);

  console.log(
    `Batch done. Sent: ${end - start}. Total sent so far: ${log.totalSent}`
  );
  if (end >= data.length) {
    console.log("🎉 All messages have been sent!");
  }
});

console.log("Script started (cron scheduled).");
