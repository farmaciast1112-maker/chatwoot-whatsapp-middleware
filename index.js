import express from "express";
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import fs from "fs";
import axios from "axios";

const app = express();
app.use(express.json());

// Variáveis de ambiente (Render → Environment Variables)
const CHATWOOT_URL = process.env.CHATWOOT_URL;      // https://app.chatwoot.com
const CHATWOOT_TOKEN = process.env.CHATWOOT_TOKEN;  // Token API
const CHATWOOT_INBOX_ID = process.env.CHATWOOT_INBOX_ID; // Inbox ID

// Guardar sockets por sessão
let sessions = {};

// Função para iniciar sessão do WhatsApp
async function startWhatsApp(sessionName) {
  const { state, saveCreds } = await useMultiFileAuthState(`./auth/${sessionName}`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // QR pelo endpoint
  });

  // Evento para QR code
  sock.ev.on("connection.update", async (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      fs.writeFileSync(`./${sessionName}-qr.txt`, qr);
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startWhatsApp(sessionName);
    }
  });

  // Salvar credenciais
  sock.ev.on("creds.update", saveCreds);

  // Evento de mensagens recebidas
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (text) {
      console.log(`[${sessionName}] Nova mensagem de ${from}: ${text}`);

      // Enviar para o Chatwoot
      try {
        await axios.post(
          `${CHATWOOT_URL}/api/v1/accounts/1/conversations`,
          {
            inbox_id: CHATWOOT_INBOX_ID,
            source_id: from,
            messages: [
              {
                content: text,
              },
            ],
          },
          {
            headers: {
              api_access_token: CHATWOOT_TOKEN,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (err) {
        console.error("Erro ao enviar msg pro Chatwoot:", err.message);
      }
    }
  });

  sessions[sessionName] = sock;
}

// Endpoint para exibir QR Code
app.get("/qr/:session", async (req, res) => {
  const session = req.params.session;
  const file = `./${session}-qr.txt`;

  if (fs.existsSync(file)) {
    const qrData = fs.readFileSync(file, "utf8");
    const qrImage = await qrcode.toDataURL(qrData);
    res.send(`<img src="${qrImage}" />`);
  } else {
    res.send("Nenhum QR disponível, aguarde...");
  }
});

// Endpoint webhook → Chatwoot envia mensagens para cá
app.post("/webhook/:session", async (req, res) => {
  const session = req.params.session;
  const sock = sessions[session];

  if (!sock) {
    return res.status(400).send("Sessão não encontrada");
  }

  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).send("Parâmetros inválidos");
  }

  await sock.sendMessage(`${phone}@s.whatsapp.net`, { text: message });
  res.send("Mensagem enviada ao WhatsApp");
});

// Iniciar sessões (2 números, exemplo wa1 e wa2)
startWhatsApp("wa1");
startWhatsApp("wa2");

app.listen(3000, () => {
  console.log("🚀 Middleware rodando na porta 3000");
});
