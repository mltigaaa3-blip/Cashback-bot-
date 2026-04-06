const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");

/* ================= CONFIG ================= */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ADMIN_ID = process.env.ADMIN_ID;

/* ================= CLIENT ================= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ================= DATABASE (VOLUME SAFE) ================= */

const FILE = "/data/data.json";

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({ pending: {}, cashback: {} }));
}

let data = JSON.parse(fs.readFileSync(FILE));

if (!data.pending) data.pending = {};
if (!data.cashback) data.cashback = {};

function save() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

/* ================= UTILS ================= */

function formatNumber(num) {
  return new Intl.NumberFormat("id-ID").format(num);
}

function getTier(amount) {
  if (amount >= 2000) return "🔥 Overlord";
  if (amount >= 1200) return "👑 Sultan";
  if (amount >= 750) return "💎 Elite";
  if (amount >= 400) return "🏛️ Investor";
  if (amount >= 200) return "💰 Grinder";
  if (amount >= 75) return "🪙 Hunter";
  if (amount >= 25) return "💵 Rookie";
  return "▫️ -";
}

/* ================= EMBED ================= */

function buildEmbed() {
  let totalPending = 0;
  let totalCashback = 0;

  const pending = Object.entries(data.pending).sort((a, b) => b[1] - a[1]);
  const cashback = Object.entries(data.cashback).sort((a, b) => b[1] - a[1]);

  const pendingList = pending.map(([n, a], i) => {
    totalPending += a;
    return `**${i + 1}.** ${n} — ${formatNumber(a)} ⏣`;
  }).join("\n") || "_Kosong_";

  const MAX = 15;
  const cashbackList = cashback.slice(0, MAX).map(([n, a], i) => {
    totalCashback += a;
    return `**${i + 1}.** ${n} — ${formatNumber(a)} ⏣ (${getTier(a)})`;
  }).join("\n") || "_Kosong_";

  return new EmbedBuilder()
    .setTitle("💰 CASHBACK SYSTEM CSBK")
    .setColor("Gold")
    .setDescription(`
📊 **Dashboard Member**

━━━━━━━━━━━━━━━━━━

⏳ **PENDING**
${pendingList}

💵 Total Pending: **${formatNumber(totalPending)} ⏣**

━━━━━━━━━━━━━━━━━━

🏆 **CASHBACK**
${cashbackList}

🏦 Total Cashback: **${formatNumber(totalCashback)} ⏣**

━━━━━━━━━━━━━━━━━━

🔥 Semakin besar total → semakin tinggi tier!
`)
    .setTimestamp();
}

/* ================= COMMAND ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("pending")
    .setDescription("Tambah pending")
    .addStringOption(o => o.setName("nama").setRequired(true))
    .addIntegerOption(o => o.setName("jumlah").setRequired(true)),

  new SlashCommandBuilder()
    .setName("cair")
    .setDescription("Cairkan cashback")
    .addStringOption(o => o.setName("nama").setRequired(true))
    .addIntegerOption(o => o.setName("jumlah").setRequired(true)),

  new SlashCommandBuilder()
    .setName("hapus")
    .setDescription("Hapus user")
    .addStringOption(o => o.setName("nama").setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log("Slash command ready");
})();

/* ================= READY ================= */

client.once("ready", async () => {
  console.log("BOT ONLINE 🔥");

  const channel = await client.channels.fetch(CHANNEL_ID);

  try {
    if (!data.messageId) throw "no msg";

    await channel.messages.fetch(data.messageId);
  } catch {
    const msg = await channel.send({ embeds: [buildEmbed()] });
    data.messageId = msg.id;
    save();
  }
});

/* ================= HANDLE ================= */

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  try {

    if (interaction.user.id !== ADMIN_ID) {
      return interaction.editReply("❌ Tidak ada izin");
    }

    const channel = await client.channels.fetch(CHANNEL_ID);

    let msg;

    try {
      msg = await channel.messages.fetch(data.messageId);
    } catch {
      msg = await channel.send({ embeds: [buildEmbed()] });
      data.messageId = msg.id;
      save();
    }

    // ===== PENDING =====
    if (interaction.commandName === "pending") {
      const n = interaction.options.getString("nama");
      const j = interaction.options.getInteger("jumlah");

      data.pending[n] = (data.pending[n] || 0) + j;
      save();

      await msg.edit({ embeds: [buildEmbed()] });

      return interaction.editReply("✅ Pending ditambah");
    }

    // ===== CAIR =====
    if (interaction.commandName === "cair") {
      const n = interaction.options.getString("nama");
      const j = interaction.options.getInteger("jumlah");

      if (!data.pending[n] || data.pending[n] < j) {
        return interaction.editReply("❌ Pending tidak cukup");
      }

      data.pending[n] -= j;
      if (data.pending[n] <= 0) delete data.pending[n];

      data.cashback[n] = (data.cashback[n] || 0) + j;
      save();

      await msg.edit({ embeds: [buildEmbed()] });

      return interaction.editReply("💸 Berhasil dicairkan");
    }

    // ===== HAPUS =====
    if (interaction.commandName === "hapus") {
      const n = interaction.options.getString("nama");

      delete data.pending[n];
      delete data.cashback[n];
      save();

      await msg.edit({ embeds: [buildEmbed()] });

      return interaction.editReply("🗑️ User dihapus");
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error terjadi");
  }
});

client.login(TOKEN);