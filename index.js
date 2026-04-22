const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on port ${PORT}`);
});
require("dotenv").config();
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
    { value: "steam", label: "Steam", logo: "https://cdn.discordapp.com/emojis/1496530193207267329.webp?size=40" },
    { value: "fortnite", label: "Fortnite", logo: "https://cdn.discordapp.com/emojis/1496530448644571166.webp?size=40" },
    { value: "roblox", label: "Roblox", logo: "https://cdn.discordapp.com/emojis/1496530793399451768.webp?size=40" },
    { value: "riot_games", label: "Riot Games", logo: "https://cdn.discordapp.com/emojis/1496530944973344859.webp?size=40" },
    { value: "ea", label: "EA", logo: "https://cdn.discordapp.com/emojis/1496531087386480650.webp?size=40" },
    { value: "ubisoft", label: "Ubisoft", logo: "https://upload.wikimedia.org/wikipedia/commons/9/91/Ubisoft_logo.svg" },
    { value: "minecraft", label: "Minecraft", logo: "https://cdn.discordapp.com/emojis/1496531206907498610.webp?size=40" },
    { value: "world_of_tanks", label: "World of Tanks", logo: "https://cdn.discordapp.com/emojis/1496531334888292373.webp?size=40" },
    { value: "world_of_tanks_blitz", label: "World of Tanks Blitz", logo: "https://cdn.discordapp.com/emojis/1496531631090045098.webp?size=40" },
    { value: "epic_games", label: "Epic Games", logo: "https://cdn.discordapp.com/emojis/1496531783691276510.webp?size=40" },
    { value: "rockstar", label: "Rockstar", logo: "https://cdn.discordapp.com/emojis/1496531896749002772.webp?size=40" },
  ],
  social: [
    { value: "discord", label: "Discord", logo: "https://upload.wikimedia.org/wikipedia/commons/9/98/Discord_logo.svg" },
    { value: "tiktok", label: "TikTok", logo: "https://upload.wikimedia.org/wikipedia/en/0/09/TikTok_logo.svg" },
    { value: "instagram", label: "Instagram", logo: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg" },
    { value: "telegram", label: "Telegram", logo: "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" },
  ],
  tools: [
    { value: "exitlag", label: "ExitLag", logo: "https://www.exitlag.com/img/Logo.png" },
    { value: "chatgpt", label: "ChatGPT", logo: "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg" },
    { value: "vpn", label: "VPN", logo: "https://upload.wikimedia.org/wikipedia/commons/9/9e/VPN_Logo.svg" },
    { value: "gift_card", label: "Gift Card", logo: "https://upload.wikimedia.org/wikipedia/commons/4/46/Gift_card_icon.svg" },
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
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  console.log("✅ Komendy zarejestrowane");
}

client.once("ready", () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "panel") {
        await interaction.reply({
          content: "Wybierz kategorię:",
          components: [getCategoryMenuRow()],
          
        });
      }
      return;
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
        const product = (PRODUCTS[category] || []).find((p) => p.value === productValue);

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
      const product = (PRODUCTS[category] || []).find((p) => p.value === productValue);

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
        (t) => t.userId === interaction.user.id && t.product === productValue && !t.closed
      );

      if (existing) {
        await interaction.reply({
          content: "❌ Masz już otwarty ticket na ten produkt.",
          ephemeral: true,
        });
        return;
      }

      const unique = Date.now().toString().slice(-6);
      const channelName = `ticket-${sanitizeName(interaction.user.username)}-${sanitizeName(product.value)}-${unique}`;

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
        .setTitle(`Wybrałeś: ${product.label}`)
        .setThumbnail(product.logo || null)
        .setColor(0x57f287)
        .addFields(
          { name: "Użytkownik", value: `${interaction.user}`, inline: false },
          { name: "Produkt", value: product.label, inline: true },
          { name: "Szczegóły", value: details, inline: false },
          { name: "Ilość / Plan / Okres", value: amount, inline: false },
          { name: "Płatność", value: payment, inline: false }
        )
        .setTimestamp();

      const infoEmbed = new EmbedBuilder()
        .setTitle("👋 Witaj w tickecie")
        .setColor(0x5865f2)
        .setDescription(
          `Cześć ${interaction.user},\n\nsupport wkrótce się odezwie.\nJeśli chcesz, możesz dopisać dodatkowe informacje.`
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
          await log.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("🧾 Nowy ticket")
                .setColor(0xfaa61a)
                .addFields(
                  { name: "Kanał", value: `${ticketChannel}`, inline: false },
                  { name: "Użytkownik", value: `${interaction.user}`, inline: true },
                  { name: "Produkt", value: product.label, inline: true },
                  { name: "Płatność", value: payment, inline: true }
                )
                .setTimestamp(),
            ],
          }).catch(() => {});
        }
      }

      addTicket({
        channelId: ticketChannel.id,
        userId: interaction.user.id,
        username: interaction.user.tag,
        product: productValue,
        productLabel: product.label,
        details,
        amount,
        payment,
        closed: false,
        createdAt: new Date().toISOString(),
      });

      await interaction.reply({
        content: `✅ Ticket utworzony: ${ticketChannel}`,
        ephemeral: true,
      });
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
