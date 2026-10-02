const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

loadEnv();

const config = {
  port: Number(process.env.PORT || 3000),
  verifyToken: requiredEnv("VERIFY_TOKEN"),
  whatsappToken: requiredEnv("WHATSAPP_TOKEN"),
  phoneNumberId: requiredEnv("PHONE_NUMBER_ID"),
  graphApiVersion: process.env.GRAPH_API_VERSION || "v23.0",
  responseText: process.env.RESPONSE_TEXT || "Mensaje recibido.",
  responseImageUrl: process.env.RESPONSE_IMAGE_URL || "",
  responseImageId: process.env.RESPONSE_IMAGE_ID || "",
  appSecret: process.env.APP_SECRET || ""
};

if (!config.responseImageUrl && !config.responseImageId) {
  throw new Error("Configura RESPONSE_IMAGE_URL o RESPONSE_IMAGE_ID en .env");
}

const processedMessageIds = new Set();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/webhook") {
      return handleWebhookVerification(url, res);
    }

    if (req.method === "POST" && url.pathname === "/webhook") {
      const rawBody = await readRequestBody(req);

      if (!isValidSignature(req, rawBody)) {
        return sendJson(res, 401, { error: "Invalid signature" });
      }

      const payload = JSON.parse(rawBody || "{}");
      await handleWebhookEvent(payload);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { ok: true });
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(config.port, () => {
  console.log(`WhatsApp bot escuchando en http://localhost:${config.port}`);
});

function handleWebhookVerification(url, res) {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === config.verifyToken && challenge) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end(challenge);
  }

  sendJson(res, 403, { error: "Verification failed" });
}

async function handleWebhookEvent(payload) {
  const messages = extractIncomingMessages(payload);

  for (const message of messages) {
    if (!message.id || !message.from) continue;
    if (processedMessageIds.has(message.id)) continue;

    processedMessageIds.add(message.id);
    trimProcessedMessageCache();

    await sendImage(message.from);
    await sendText(message.from);
  }
}

function extractIncomingMessages(payload) {
  const messages = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      if (Array.isArray(value.messages)) {
        messages.push(...value.messages);
      }
    }
  }

  return messages;
}

async function sendImage(to) {
  const image = config.responseImageId
    ? { id: config.responseImageId }
    : { link: config.responseImageUrl };

  await sendWhatsappMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "image",
    image
  });
}

async function sendText(to) {
  await sendWhatsappMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: config.responseText
    }
  });
}

async function sendWhatsappMessage(body) {
  const endpoint = `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsappToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WhatsApp API error ${response.status}: ${text}`);
  }

  return response.json();
}

function isValidSignature(req, rawBody) {
  if (!config.appSecret) return true;

  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !signature.startsWith("sha256=")) return false;

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", config.appSecret)
      .update(rawBody)
      .digest("hex");

  return timingSafeEqual(signature, expected);
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.setEncoding("utf8");
    req.on("data", chunk => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name}`);
  return value;
}

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function trimProcessedMessageCache() {
  if (processedMessageIds.size <= 500) return;

  const oldestMessageId = processedMessageIds.values().next().value;
  processedMessageIds.delete(oldestMessageId);
}
