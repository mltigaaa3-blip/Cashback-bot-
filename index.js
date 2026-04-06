const {
  Client,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const fs = require('fs');

// ========= CONFIG =========
const TOKEN = 'MTQ2NTY3NTc0OTk2ODE4MzM2OA.Ggj6z2.Iy7SpMzNVxmQfpNSmwBEdiOMbl12TpwTEbykjw';
const CLIENT_ID = '1465675749968183368';
const GUILD_ID = '1437072658675269644';
const CHANNEL_ID = '1437688402467098634';
const ADMIN_ID = '1004034354919506011';
// ==========================

const client = new Client({ intents: [] });

// ===== LOAD DATA =====
let data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
if (!data.pending) data.pending = {};
if (!data.cashback) data.cashback = {};

function save() {
  fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

// ===== SORT =====
function sortObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))
  );
}

// ===== FORMAT =====
function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}

// ===== TIER =====
function getTier(amount) {
  if (amount >= 2000) return '🔥 Overlord';
  if (amount >= 1200) return '👑 Sultan';
  if (amount >= 750) return '💎 Elite';
  if (amount >= 400) return '🏛️ Investor';
  if (amount >= 200) return '💰 Grinder';
  if (amount >= 75) return '🪙 Hunter';
  if (amount >= 25) return '💵 Rookie';
  return '▫️ -';
}

// ===== BUILD EMBED (SUPER RAPI MONOSPACE) =====
function buildEmbed() {
  let pendingList = '';
  let cashbackList = '';
  let totalPending = 0;
  let totalCashback = 0;

  data.pending = sortObject(data.pending);
  data.cashback = sortObject(data.cashback);

  // Pending
  for (const [name, amount] of Object.entries(data.pending)) {
    pendingList += `• ${name} — ${formatNumber(amount)} ⏣\n`;
    totalPending += amount;
  }

  if (!pendingList) pendingList = '_Kosong_';

  // Cashback (rapi)
  const entries = Object.entries(data.cashback);

// Urut terbesar dulu
const sorted = entries.sort((a, b) => b[1] - a[1]);

// Maksimal 20 baris biar tidak kena limit 1024 karakter
const MAX_ROWS = 20;
const limited = sorted.slice(0, MAX_ROWS);

const names = limited.map(e => e[0]);
const maxNameLength = Math.max(...names.map(n => n.length), 15);

const formattedAmounts = limited.map(e => formatNumber(e[1]));
const maxAmountLength = Math.max(...formattedAmounts.map(a => a.length), 4);

for (const [name, amount] of limited) {
  totalCashback += amount;

  const nameCol = name.padEnd(maxNameLength, ' ');
  const amountCol = formatNumber(amount).padStart(maxAmountLength, ' ');
  const tier = getTier(amount);

  cashbackList += `• ${nameCol}  ${amountCol} ⏣  │  ${tier}\n`;
}

if (entries.length > MAX_ROWS) {
  cashbackList += `\n... dan ${entries.length - MAX_ROWS} lainnya`;
}

  if (!cashbackList) cashbackList = '_Kosong_';

  return new EmbedBuilder()
    .setTitle('📊 SALDO CASHBACK')
    .setColor(0x2f3136)
    .addFields(
      {
        name: '⏳ **PENDING**',
        value: `\n────────────\n${pendingList}`
      },
      {
        name: '💰 **TOTAL PENDING**',
        value: `${formatNumber(totalPending)} ⏣`
      },
      {
        name: '\u200B',
        value: '\n'
      },
      {
        name: '🎁 **CASHBACK DIDAPAT**',
        value: `\n────────────\n\`\`\`\n${cashbackList}\`\`\``
      },
      {
        name: '🏦 **TOTAL CASHBACK DIDAPAT**',
        value: `${formatNumber(totalCashback)} ⏣`
      }
    )
    .setTimestamp();
}

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName('pending')
    .setDescription('Tambah / update pending')
    .addStringOption(o =>
      o.setName('nama').setDescription('Nama user').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('jumlah').setDescription('Jumlah').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('cair')
    .setDescription('Pindahkan pending ke cashback didapat')
    .addStringOption(o =>
      o.setName('nama').setDescription('Nama user').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('jumlah').setDescription('Jumlah').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('hapus')
    .setDescription('Hapus user dari semua data')
    .addStringOption(o =>
      o.setName('nama').setDescription('Nama user').setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

// ===== REGISTER =====
(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log('Slash command siap');
})();

// ===== READY =====
client.once('ready', async () => {
  console.log('BOT SIAP');

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!data.messageId) {
    const msg = await channel.send({ embeds: [buildEmbed()] });
    data.messageId = msg.id;
    save();
  }
});

// ===== HANDLE =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.user.id !== ADMIN_ID) {
    return interaction.reply({
      content: '❌ Kamu tidak punya izin memakai command ini.',
      ephemeral: true
    });
  }

  let msg;

try {
  msg = await interaction.channel.messages.fetch(data.messageId);
} catch (err) {
  msg = await interaction.channel.send({ embeds: [buildEmbed()] });
  data.messageId = msg.id;
  save();
}

  // ===== PENDING =====
  if (interaction.commandName === 'pending') {
    await interaction.deferReply({ ephemeral: true });

    const nama = interaction.options.getString('nama');
    const jumlah = interaction.options.getInteger('jumlah');

    data.pending[nama] = (data.pending[nama] || 0) + jumlah;
    save();

    await msg.edit({ embeds: [buildEmbed()] });

    return interaction.editReply('✅ Pending diperbarui');
  }

  // ===== CAIR =====
  if (interaction.commandName === 'cair') {
    await interaction.deferReply({ ephemeral: true });

    const nama = interaction.options.getString('nama');
    const jumlah = interaction.options.getInteger('jumlah');

    if (!data.pending[nama] || data.pending[nama] < jumlah) {
      return interaction.editReply('❌ Pending tidak cukup');
    }

    data.pending[nama] -= jumlah;
    if (data.pending[nama] === 0) delete data.pending[nama];

    data.cashback[nama] = (data.cashback[nama] || 0) + jumlah;
    save();

    await msg.edit({ embeds: [buildEmbed()] });

    return interaction.editReply('💸 Cashback dicairkan');
  }

  // ===== HAPUS =====
  if (interaction.commandName === 'hapus') {
    await interaction.deferReply({ ephemeral: true });

    const nama = interaction.options.getString('nama');

    delete data.pending[nama];
    delete data.cashback[nama];
    save();

    await msg.edit({ embeds: [buildEmbed()] });

    return interaction.editReply('🗑️ User dihapus');
  }
});

client.login(TOKEN);