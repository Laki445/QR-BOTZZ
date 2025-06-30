module.exports = {
  command: 'menu',
  run: async (sock, m) => {
    const text = `
🤖 *Bot Menu*:
• .alive - Check bot status
• .menu - Show this menu
• .ping - Check bot speed
• .help - Show help
• .setname [name] - Set your display name
• .yt [query] - Search YouTube (demo)
    `.trim();
    await sock.sendMessage(m.key.remoteJid, { text });
  }
};
