const { Client, ChannelType } = require("discord.js");

const client = new Client({ intents: ["DirectMessages", "Guilds", "GuildMessages", "MessageContent"] });

const MODMAIL_CHANNEL_ID = process.env.MODMAIL_CHANNEL_ID || "1488943640192745563";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "MTQ4ODk2OTQ2ODg0MjM0ODYwNA.GUC72S.h4jY7DvMTmx6wJnnBinZz-yJT59zzfDHpjhCMo";

const userThreads = new Map();

client.on("ready", () => {
  console.log(`✓ Bot logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    // Handle DMs from users
    if (message.isDMChannel()) {
      const userId = message.author.id;
      const modmailChannel = await client.channels.fetch(MODMAIL_CHANNEL_ID);

      if (!modmailChannel || !modmailChannel.isTextBased()) {
        console.error("Modmail channel not found or not text-based");
        return;
      }

      let threadId = userThreads.get(userId);
      let thread;

      if (!threadId) {
        thread = await modmailChannel.threads.create({
          name: `${message.author.username} (${userId})`,
          autoArchiveDuration: 1440,
        });
        userThreads.set(userId, thread.id);
      } else {
        thread = await modmailChannel.threads.fetch(threadId).catch(() => null);
        if (!thread) {
          thread = await modmailChannel.threads.create({
            name: `${message.author.username} (${userId})`,
            autoArchiveDuration: 1440,
          });
          userThreads.set(userId, thread.id);
        }
      }

      await thread.send({
        content: `**${message.author}**: ${message.content}`,
        allowedMentions: { parse: [] },
      });

      await message.reply("✓ Your message has been received by the moderation team.");
    }

    // Handle messages in modmail thread
    if (message.channel.isThread() && message.channel.parent?.id === MODMAIL_CHANNEL_ID) {
      if (message.author.bot) return;

      const match = message.channel.name.match(/\((\d+)\)$/);
      if (!match) return;

      const userId = match[1];
      const user = await client.users.fetch(userId);

      if (!user) {
        await message.reply("Could not find user to send DM to.");
        return;
      }

      try {
        await user.send({
          content: `**Moderation Team**: ${message.content}`,
          allowedMentions: { parse: [] },
        });
        await message.react("✅");
      } catch (error) {
        await message.reply("Failed to send DM to user (they may have DMs disabled).");
      }
    }
  } catch (error) {
    console.error("Error handling message:", error);
  }
});

client.login(DISCORD_TOKEN);
