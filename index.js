import makeWASocket from "@whiskeysockets/baileys";
import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// 🔑 Configurações Chatwoot
const CHATWOOT_URL = "https://app.chatwoot.com";
const ACCOUNT_ID = "SEU_ACCOUNT_ID";       // exemplo: 136271
const API_TOKEN = "SEU_API_TOKEN";         // copie do Chatwoot
const INBOX_WA1 = "INBOX_IDENTIFIER_WA1";  // copie do Chatwoot
const INBOX_WA2 = "INBOX_IDENTIFIER_WA2";  // copie do Chatwoot

// Sessões do WhatsApp
const sessions = {};

async function startWhatsApp(name, inboxId) {
  const sock = makeWASocket({ printQRInTerminal: true });

  // Receber mensagens → Chatwoot
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message?.conversation) return;

    await axios.post(
      `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}/inboxes/${inboxId}/messages`,
      {
        content: msg.message.conversation,
        message_type: "incoming",
        sender: {
          phone_number: msg.key.remoteJid.split("@")[0],
          name: msg.pushName || "Contato WhatsApp"
        }
      },
      { headers: { api_access_token: API_TOKEN } }
    );
  });

  sessions[name] = sock;
}

// Iniciar 2 WhatsApps
startWhatsApp("wa1", INBOX_WA1);
startWhatsApp("wa2", INBOX_WA2);

// Receber respostas do Chatwoot (webhook → enviar pro WhatsApp)
app.post("/webhook/:wa", async (req, res) => {
  const { content, phone_number } = req.body;
  const wa = req.params.wa; // wa1 ou wa2
  const sock = sessions[wa];
  if (!sock) return res.status(400).send("Sessão inválida");

  await sock.sendMessage(`${phone_number}@s.whatsapp.net`, { text: content });
  res.sendStatus(200);
});

app.listen(3000, () => console.log("Middleware rodando na porta 3000"));
