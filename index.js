const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');
const { cmd } = require('./lib/cmd');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static('public'));

let sock;
let latestQR = '';
let connectedJid = '';

const startSock = async () => {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) latestQR = qr;

    if (connection === 'open') {
      console.log('✅ BOT CONNECTED');

      // Send message to the linked device
      try {
        const id = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        connectedJid = id;
        await sock.sendMessage(id, { text: '✅ Bot successfully connected! Type .menu to begin.' });
      } catch (e) {
        console.log('❌ Failed to send welcome message:', e);
      }

      // Setup command handler
      sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const type = Object.keys(m.message)[0];
        const content = m.message[type];
        const text = type === 'conversation' ? content :
                    content?.text || content?.caption || '';

        if (!text) return;

        const prefix = '.';
        if (text.startsWith(prefix)) {
          const [cmdName, ...args] = text.slice(1).trim().split(/\s+/);
          const plugin = cmd[cmdName.toLowerCase()];
          if (plugin) {
            try {
              await plugin(sock, m, args.join(' '));
            } catch (e) {
              console.error(e);
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Plugin error' });
            }
          }
        }
      });
    }

    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        startSock();
      }
    }
  });
};

app.get('/qr', async (req, res) => {
  if (!latestQR) return res.status(404).send('QR not ready');
  const qrImage = await qrcode.toDataURL(latestQR);
  const base64Data = qrImage.replace(/^data:image\/png;base64,/, '');
  const imgBuffer = Buffer.from(base64Data, 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': imgBuffer.length
  });
  res.end(imgBuffer);
});

app.get('/', (req, res) => res.redirect('/pair.html'));

app.listen(PORT, () => {
  console.log(`🌐 QR UI Running: http://localhost:${PORT}`);
});

startSock();
