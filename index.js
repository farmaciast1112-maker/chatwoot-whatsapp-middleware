import express from "express";
import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import qrcode from "qrcode";

const app = express();
const port = process.env.PORT || 10000;

let lastQr = { wa1: null, wa2: null };

async function startWhatsApp(sessionName) {
  const { state, saveCreds } = await useMultiFileAuthState(`./session-${sessionName}`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false // não mostra mais no log, só via rota
  });

  sock.ev.on("connection.update", (update) => {
    const { qr } = update;
    if (qr) {
      lastQr[sessionName] = qr; // guarda o QR da sessão
      console.log(`📲 Novo QR gerado para ${sessionName}`);
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// rota web para exibir QR Code em imagem
app.get("/qr/:session", async (req, res) => {
  const session = req.params.session;
  const qr = lastQr[session];
  if (!qr) {
    return res.send("Nenhum QR disponível, aguarde alguns segundos...");
  }
  try {
    const qrImg = await qrcode.toDataURL(qr);
    res.send(`
      <h2>QR Code da sessão ${session}</h2>
      <img src="${qrImg}" style="width:300px;height:300px"/>
    `);
  } catch (err) {
    res.status(500).send("Erro ao gerar QR");
  }
});

app.listen(port, () => {
  console.log(`🚀 Middleware rodando na porta ${port}`);
  startWhatsApp("wa1");
  startWhatsApp("wa2");
});
