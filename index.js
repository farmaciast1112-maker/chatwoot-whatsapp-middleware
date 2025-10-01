import express from "express"
import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys"

async function startWhatsApp(sessionName) {
  // Cria pasta para armazenar credenciais da sessão
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionName}`)

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // Mostra QR no console do Render
  })

  // Salva credenciais quando atualizadas
  sock.ev.on("creds.update", saveCreds)

  // Eventos de conexão
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log(`📲 QR CODE da sessão ${sessionName}:`, qr)
    }
    if (connection === "open") {
      console.log(`✅ Sessão ${sessionName} conectada com sucesso!`)
    }
    if (connection === "close") {
      console.log(`⚠️ Sessão ${sessionName} desconectada`, lastDisconnect?.error)
    }
  })

  return sock
}

// Express API
const app = express()
app.use(express.json())

// Webhook para Chatwoot
app.post("/webhook/:session", (req, res) => {
  const session = req.params.session
  console.log("📩 Mensagem recebida na sessão:", session, req.body)
  res.sendStatus(200)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log("🚀 Middleware rodando na porta", PORT)

  // Inicia duas sessões diferentes
  await startWhatsApp("wa1")
  await startWhatsApp("wa2")
})
