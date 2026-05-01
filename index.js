require("dotenv").config();

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on port ${PORT}`);
});

const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

const DB_FILE = path.join(__dirname, "tickets.json");

function ensureDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ tickets: [] }, null, 2));
  }
}

function loadDb() {
  ensureDb();

  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { tickets: [] };
  }
}

function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function addTicket(ticket) {
  const db = loadDb();
  db.tickets.push(ticket);
  saveDb(db);
}

function closeTicketInDb(channelId) {
  const db = loadDb();
  const ticket = db.tickets.find((t) => t.channelId === channelId);

  if (ticket) {
    ticket.closed = true;
    ticket.closedAt = new Date().toISOString();
    saveDb(db);
  }
}

function sanitizeName(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

const CATEGORY_OPTIONS = [
  {
    value: "games",
    label: "Gry / Platformy",
    emoji: "🎮",
    description: "Steam, Fortnite, Roblox, Riot, EA i inne",
  },
  {
    value: "social",
    label: "Social Media",
    emoji: "💬",
    description: "Discord, TikTok, Instagram, Telegram",
  },
  {
    value: "tools",
    label: "Usługi / Narzędzia",
    emoji: "🛠️",
    description: "VPN, ExitLag, ChatGPT, Gift Card",
  },
  {
    value: "other",
    label: "Inne",
    emoji: "📦",
    description: "Pozostałe zamówienia",
  },
];

const PRODUCTS = {
  games: [
    { value: "steam", label: "Steam", logo: "" },
    { value: "fortnite", label: "Fortnite", logo: "" },
    { value: "roblox", label: "Roblox", logo: "" },
    { value: "riot_games", label: "Riot Games", logo: "" },
    { value: "ea", label: "EA", logo: "" },
    { value: "ubisoft", label: "Ubisoft", logo: "" },
    { value: "minecraft", label: "Minecraft", logo: "" },
    { value: "world_of_tanks", label: "World of Tanks", logo: "" },
    { value: "world_of_tanks_blitz", label: "World of Tanks Blitz", logo: "" },
    { value: "epic_games", label: "Epic Games", logo: "" },
    { value: "rockstar", label: "Rockstar", logo: "" },
  ],

  social: [
    { value: "discord", label: "Discord", logo: "" },
    { value: "tiktok", label: "TikTok", logo: "" },
    { value: "instagram", label: "Instagram", logo: "" },
    { value: "telegram", label: "Telegram", logo: "" },
  ],

  tools: [
    { value: "exitlag", label: "ExitLag", logo: "" },
    { value: "chatgpt", label: "ChatGPT", logo: "" },
    { value: "vpn", label: "VPN", logo: "" },
    { value: "gift_card", label: "Gift Card", logo: "" },
  ],

  other: [
    { value: "custom", label: "Inny produkt", logo: "" },
  ],
};

function getCategoryMenuRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("category_select")
      .setPlaceholder("Wybierz kategorię")
      .addOptions(
        CATEGORY_OPTIONS.map((c) => ({
          label: c.label,
          value: c.value,
          emoji: c.emoji,
          description: c.description,
        }))
      )
  );
}

function getProductMenuRow(category) {
  const products = PRODUCTS[category] || [];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`product_select:${category}`)
      .setPlaceholder("Wybierz produkt")
      .addOptions(
        products.map((p) => ({
          label: p.label,
          value: p.value,
          description: `Zamów ${p.label}`,
          emoji: "🟢",
        }))
      )
  );
}

function getBackButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("back_to_categories")
      .setLabel("← Wróć")
      .setStyle(ButtonStyle.Secondary)
  );
}

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Wyślij panel zamówień")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("valorant")
    .setDescription("Wyślij panel Valorant")
    .toJSON(),
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );

  console.log("✅ Komendy zarejestrowane");
}

client.once("ready", () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);
});

async function createTicket(interaction, data) {
  const unique = Date.now().toString().slice(-6);

  const channelName = `ticket-${sanitizeName(
    interaction.user.username
  )}-${sanitizeName(data.productValue)}-${unique}`;

  const ticketChannel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: process.env.TICKET_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: interaction.guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: process.env.SUPPORT_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
  });

  const orderEmbed = new EmbedBuilder()
    .setTitle(`🧾 Zamówienie: ${data.productLabel}`)
    .setColor(data.color || 0x57f287)
    .addFields(
      { name: "Użytkownik", value: `${interaction.user}`, inline: false },
      { name: "Produkt", value: data.productLabel, inline: true },
      { name: "Szczegóły", value: data.details || "Brak", inline: false },
      { name: "Ilość / Plan / Okres", value: data.amount || "Brak", inline: false },
      { name: "Płatność", value: data.payment || "Brak", inline: false }
    )
    .setTimestamp();

  const infoEmbed = new EmbedBuilder()
    .setTitle("👋 Witaj w tickecie")
    .setColor(0x5865f2)
    .setDescription(
      `Cześć ${interaction.user},\n\nSupport wkrótce się odezwie. Możesz dopisać dodatkowe informacje.`
    );

  const buttonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("claim_ticket")
      .setLabel("Claim ticket")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Zamknij ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({
    content: `${interaction.user} <@&${process.env.SUPPORT_ROLE_ID}>`,
    embeds: [orderEmbed, infoEmbed],
    components: [buttonsRow],
  });

  if (process.env.LOG_CHANNEL_ID) {
    const log = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);

    if (log) {
      await log
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🧾 Nowy ticket")
              .setColor(data.color || 0xfaa61a)
              .addFields(
                { name: "Kanał", value: `${ticketChannel}`, inline: false },
                { name: "Użytkownik", value: `${interaction.user}`, inline: true },
                { name: "Produkt", value: data.productLabel, inline: true },
                { name: "Płatność", value: data.payment || "Brak", inline: true }
              )
              .setTimestamp(),
          ],
        })
        .catch(() => {});
    }
  }

  addTicket({
    channelId: ticketChannel.id,
    userId: interaction.user.id,
    username: interaction.user.tag,
    product: data.productValue,
    productLabel: data.productLabel,
    details: data.details || "",
    amount: data.amount || "",
    payment: data.payment || "",
    closed: false,
    createdAt: new Date().toISOString(),
  });

  return ticketChannel;
}

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "panel") {
        await interaction.reply({
          content: "Wybierz kategorię:",
          components: [getCategoryMenuRow()],
        });

        return;
      }

      if (interaction.commandName === "valorant") {
        const embed = new EmbedBuilder()
          .setTitle("🔴 Valorant Service — Powered by Nexa")
          .setColor(0xff0000)
          .setDescription(`
💰 **CENNIK:**
> • 7 dni — **80 zł**
> • 14 dni — **120 zł**
> • 30 dni — **240 zł**
> • Plan indywidualny — **699 zł**

━━━━━━━━━━━━━━━━━━

🖥️ **SYSTEM:**
> Windows 7 / 8 / 10 / 11  
> Fullscreen / Windowed / Borderless  

⚙️ **CPU:**
> Intel / AMD  

━━━━━━━━━━━━━━━━━━

📩 Kliknij przycisk poniżej, aby utworzyć ticket.
`);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("valorant_buy")
            .setLabel("💰 KUP TERAZ")
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
          embeds: [embed],
          components: [row],
        });

        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "category_select") {
        const category = interaction.values[0];

        await interaction.update({
          content: "Wybierz produkt:",
          embeds: [],
          components: [getProductMenuRow(category), getBackButtonRow()],
        });

        return;
      }

      if (interaction.customId.startsWith("product_select:")) {
        const category = interaction.customId.split(":")[1];
        const productValue = interaction.values[0];

        const product = (PRODUCTS[category] || []).find(
          (p) => p.value === productValue
        );

        if (!product) {
          await interaction.reply({
            content: "❌ Nie znaleziono produktu.",
            ephemeral: true,
          });

          return;
        }

        const modal = new ModalBuilder()
          .setCustomId(`ticket_modal:${category}:${productValue}`)
          .setTitle(`Zamów: ${product.label}`);

        const detailsInput = new TextInputBuilder()
          .setCustomId("details")
          .setLabel("Co dokładnie chcesz?")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("np. konto, usługa, konkretna wersja")
          .setRequired(true);

        const amountInput = new TextInputBuilder()
          .setCustomId("amount")
          .setLabel("Ilość / plan / okres")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("np. x1 / 30 dni / premium")
          .setRequired(true);

        const paymentInput = new TextInputBuilder()
          .setCustomId("payment")
          .setLabel("Forma płatności")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("np. Blik / Revolut / PayPal")
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(detailsInput),
          new ActionRowBuilder().addComponents(amountInput),
          new ActionRowBuilder().addComponents(paymentInput)
        );

        await interaction.showModal(modal);
        return;
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === "back_to_categories") {
        await interaction.update({
          content: "Wybierz kategorię:",
          embeds: [],
          components: [getCategoryMenuRow()],
        });

        return;
      }

      if (interaction.customId === "valorant_buy") {
        const db = loadDb();

        const existing = db.tickets.find(
          (t) =>
            t.userId === interaction.user.id &&
            t.product === "valorant" &&
            !t.closed
        );

        if (existing) {
          await interaction.reply({
            content: "❌ Masz już otwarty ticket Valorant.",
            ephemeral: true,
          });

          return;
        }

        const ticketChannel = await createTicket(interaction, {
          productValue: "valorant",
          productLabel: "Valorant Service — Powered by Nexa",
          details: "Klient kliknął KUP TERAZ",
          amount: "Do ustalenia",
          payment: "Do ustalenia",
          color: 0xff0000,
        });

        await interaction.reply({
          content: `✅ Ticket utworzony: ${ticketChannel}`,
          ephemeral: true,
        });

        return;
      }

      if (interaction.customId === "claim_ticket") {
        await interaction.reply({
          content: `📌 Ticket przejął ${interaction.user}`,
        });

        return;
      }

      if (interaction.customId === "close_ticket") {
        await interaction.reply({
          content: "🔒 Ticket zostanie zamknięty za 3 sekundy...",
          ephemeral: true,
        });

        const channelId = interaction.channel.id;

        setTimeout(async () => {
          try {
            closeTicketInDb(channelId);
            await interaction.channel.delete();
          } catch (error) {
            console.error(error);
          }
        }, 3000);

        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (!interaction.customId.startsWith("ticket_modal:")) return;

      const [, category, productValue] = interaction.customId.split(":");

      const product = (PRODUCTS[category] || []).find(
        (p) => p.value === productValue
      );

      if (!product) {
        await interaction.reply({
          content: "❌ Produkt nie istnieje.",
          ephemeral: true,
        });

        return;
      }

      const details = interaction.fields.getTextInputValue("details");
      const amount = interaction.fields.getTextInputValue("amount");
      const payment = interaction.fields.getTextInputValue("payment");

      const db = loadDb();

      const existing = db.tickets.find(
        (t) =>
          t.userId === interaction.user.id &&
          t.product === productValue &&
          !t.closed
      );

      if (existing) {
        await interaction.reply({
          content: "❌ Masz już otwarty ticket na ten produkt.",
          ephemeral: true,
        });

        return;
      }

      const ticketChannel = await createTicket(interaction, {
        productValue,
        productLabel: product.label,
        details,
        amount,
        payment,
      });

      await interaction.reply({
        content: `✅ Ticket utworzony: ${ticketChannel}`,
        ephemeral: true,
      });

      return;
    }
  } catch (error) {
    console.error(error);

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Wystąpił błąd podczas obsługi interakcji.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Wystąpił błąd podczas obsługi interakcji.",
          ephemeral: true,
        });
      }
    } catch {}
  }
});

(async () => {
  try {
    await registerCommands();
    await client.login(process.env.TOKEN);
  } catch (error) {
    console.error(error);
  }
})();
