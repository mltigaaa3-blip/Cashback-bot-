const {
  Client,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  GatewayIntentBits
} = require('discord.js');

const fs = require('fs');

/* ================= CONFIG ================= */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ADMIN_ID = process.env.ADMIN_ID;
/* ========================================= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ================= DATABASE ================= */
const FILE = './data.json';

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({ pending: {}, cashback: {} }));
}

let data = JSON.parse(fs.readFileSync(FILE));

function save() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

/* ================= FORMAT ================= */

function format(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}

/* ================= EMBED ================= */

function buildEmbed() {
  let pending = '';
  let cashback = '';

  let totalPending = 0;
  let totalCash = 0;

  for (const [n, a] of Object.entries(data.pending)) {
    pending += `• ${n} — ${format(a)} ⏣\n`;
    totalPending += a;
  }

  if (!pending) pending = '_Kosong_';

  for (const [n, a] of Object.entries(data.cashback)) {
    cashback += `• ${n} — ${format(a)} ⏣\n`;
    totalCash += a;
  }

  if (!cashback) cashback = '_Kosong_';

  return new EmbedBuilder()
    .setTitle('📊 CASHBACK PANEL')
    .setColor(0x2f3136)
    .addFields(
      { name: '⏳ Pending', value: pending },
      { name: 'Total Pending', value: `${format(totalPending)} ⏣` },
      { name: '🎁 Cashback', value: cashback },
      { name: 'Total Cashback', value: `${format(totalCash)} ⏣` }
    );
}

/* ================= COMMAND ================= */

const commands = [
  new SlashCommandBuilder()
    .setName('pending')
    .setDescription('Tambah pending')
    .addStringOption(o =>
      o.setName('nama')
        .setDescription('Nama user')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('jumlah')
        .setDescription('Jumlah')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('cair')
    .setDescription('Cairkan pending')
    .addStringOption(o =>
      o.setName('nama')
        .setDescription('Nama user')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('jumlah')
        .setDescription('Jumlah')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('hapus')
    .setDescription('Hapus user')
    .addStringOption(o =>
      o.setName('nama')
        .setDescription('Nama user')
        .setRequired(true)
    )

].map(c => c.toJSON());

/* ================= REGISTER ================= */

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log('✅ Command ready');
})();

/* ================= READY ================= */

client.once('ready', async () => {
  console.log('🔥 BOT ONLINE');

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!data.messageId) {
    const msg = await channel.send({ embeds: [buildEmbed()] });
    data.messageId = msg.id;
    save();
  }
});

/* ================= INTERACTION ================= */

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  if (i.user.id !== ADMIN_ID) {
    return i.reply({ content: '❌ No access', ephemeral: true });
  }

  let msg;

  try {
    msg = await i.channel.messages.fetch(data.messageId);
  } catch {
    msg = await i.channel.send({ embeds: [buildEmbed()] });
    data.messageId = msg.id;
    save();
  }

  if (i.commandName === 'pending') {
    const n = i.options.getString('nama');
    const j = i.options.getInteger('jumlah');

    data.pending[n] = (data.pending[n] || 0) + j;
    save();

    await msg.edit({ embeds: [buildEmbed()] });

    return i.reply({ content: '✅ Pending masuk', ephemeral: true });
  }

  if (i.commandName === 'cair') {
    const n = i.options.getString('nama');
    const j = i.options.getInteger('jumlah');

    if (!data.pending[n] || data.pending[n] < j)
      return i.reply({ content: '❌ Tidak cukup', ephemeral: true });

    data.pending[n] -= j;
    if (data.pending[n] <= 0) delete data.pending[n];

    data.cashback[n] = (data.cashback[n] || 0) + j;
    save();

    await msg.edit({ embeds: [buildEmbed()] });

    return i.reply({ content: '💰 Berhasil cair', ephemeral: true });
  }

  if (i.commandName === 'hapus') {
    const n = i.options.getString('nama');

    delete data.pending[n];
    delete data.cashback[n];
    save();

    await msg.edit({ embeds: [buildEmbed()] });

    return i.reply({ content: '🗑️ Dihapus', ephemeral: true });
  }
});

client.login(TOKEN);