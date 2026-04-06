const {
  Client,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  GatewayIntentBits
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

/* ================= DATABASE (RAILWAY SAFE) ================= */

const DIR = "/data";
const FILE = "/data/data.json";

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({ pending: {}, cashback: {} }));
}

let data = JSON.parse(fs.readFileSync(FILE));

function save() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

/* ================= FORMAT ================= */

function format(num) {
  return new Intl.NumberFormat("id-ID").format(num);
}

/* ================= TIER ================= */

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
  let pendingText = "";
  let cashbackText = "";

  let totalPending = 0;
  let totalCashback = 0;

  /* PENDING */
  for (const [name, amount] of Object.entries(data.pending)) {
    pendingText += `• ${name} — ${format(amount)} ⏣\n`;
    totalPending += amount;
  }

  if (!pendingText) pendingText = "_Kosong_";

  /* CASHBACK SORT */
  const sorted = Object.entries(data.cashback)
    .sort((a, b) => b[1] - a[1]);

  const MAX = 20;
  const top = sorted.slice(0, MAX);

  const maxName = Math.max(...top.map(x => x[0].length), 10);
  const maxNum = Math.max(...top.map(x => format(x[1]).length), 4);

  for (const [name, amount] of top) {
    totalCashback += amount;

    const n = name.padEnd(maxName, " ");
    const a = format(amount).padStart(maxNum, " ");
    const tier = getTier(amount);

    cashbackText += `• ${n}  ${a} ⏣ │ ${tier}\n`;
  }

  if (sorted.length > MAX) {
    cashbackText += `\n... dan ${sorted.length - MAX} lainnya`;
  }

  if (!cashbackText) cashbackText = "_Kosong_";

  return new EmbedBuilder()
    .setTitle("📊 SALDO CASHBACK")
    .setColor(0x2f3136)
    .addFields(
      {
        name: "⏳ PENDING",
        value: `────────────\n${pendingText}`
      },
      {
        name: "💰 TOTAL PENDING",
        value: `${format(totalPending)} ⏣`
      },
      {
        name: "\u200B",
        value: " "
      },
      {
        name: "🎁 CASHBACK DIDAPAT",
        value: `────────────\n\`\`\`\n${cashbackText}\`\`\``
      },
      {
        name: "🏦 TOTAL CASHBACK",
        value: `${format(totalCashback)} ⏣`
      }
    )
    .setTimestamp();
}

/* ================= COMMAND ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("pending")
    .setDescription("Tambah pending")
    .addStringOption(o =>
      o.setName("nama").setDescription("Nama user").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("jumlah").setDescription("Jumlah").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("cair")
    .setDescription("Cairkan pending")
    .addStringOption(o =>
      o.setName("nama").setDescription("Nama user").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("jumlah").setDescription("Jumlah").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("hapus")
    .setDescription("Hapus user")
    .addStringOption(o =>
      o.setName("nama").setDescription("Nama user").setRequired(true)
    )

].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ================= REGISTER ================= */

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log("✅ Command ready");
})();

/* ================= READY ================= */

client.once("ready", async () => {
  console.log("🔥 BOT ONLINE");

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!data.messageId) {
    const msg = await channel.send({ embeds: [buildEmbed()] });
    data.messageId = msg.id;
    save();
  }
});

/* ================= INTERACTION ================= */

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (i.user.id !== ADMIN_ID) {
    return i.reply({ content: "❌ No access", ephemeral: true });
  }

  await i.deferReply({ ephemeral: true }); // 🔥 FIX NOT RESPOND

  let msg;

  try {
    msg = await i.channel.messages.fetch(data.messageId);
  } catch {
    msg = await i.channel.send({ embeds: [buildEmbed()] });
    data.messageId = msg.id;
    save();
  }

  if (i.commandName === "pending") {
    const n = i.options.getString("nama");
    const j = i.options.getInteger("jumlah");

    data.pending[n] = (data.pending[n] || 0) + j;
    save();

    await msg.edit({ embeds: [buildEmbed()] });

    return i.editReply("✅ Pending ditambahkan");
  }

  if (i.commandName === "cair") {
    const n = i.options.getString("nama");
    const j = i.options.getInteger("jumlah");

    if (!data.pending[n] || data.pending[n] < j) {
      return i.editReply("❌ Pending tidak cukup");
    }

    data.pending[n] -= j;
    if (data.pending[n] <= 0) delete data.pending[n];

    data.cashback[n] = (data.cashback[n] || 0) + j;
    save();

    await msg.edit({ embeds: [buildEmbed()] });

    return i.editReply("💰 Berhasil dicairkan");
  }

  if (i.commandName === "hapus") {
    const n = i.options.getString("nama");

    delete data.pending[n];
    delete data.cashback[n];
    save();

    await msg.edit({ embeds: [buildEmbed()] });

    return i.editReply("🗑️ Data dihapus");
  }
});

client.login(TOKEN);