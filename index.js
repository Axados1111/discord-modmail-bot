const { Client, GatewayIntentBits, ChannelType } = require("discord.js");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MODMAIL_CHANNEL_ID = process.env.MODMAIL_CHANNEL_ID;

if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN environment variable is not set. Exiting.");
  process.exit(1);
}

if (!MODMAIL_CHANNEL_ID) {
  console.error("MODMAIL_CHANNEL_ID environment variable is not set. Exiting.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once("ready", () => {
  console.log(`✓ Bot online — logged in as ${client.user.tag}`);
});

client.on("error", (error) => {
  console.error("Discord client error:", error);
});

client.on("warn", (info) => {
  console.warn("Discord client warning:", info);
});

client.on("disconnect", () => {
  console.warn("Bot disconnected. Attempting to reconnect...");
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

client.on("messageCreate", async (message) => {
  // Ignore all bot messages
  if (message.author.bot) return;

  // --- Incoming DM: user → modmail thread ---
  if (message.channel.type === ChannelType.DM) {
    try {
      const modmailChannel = await client.channels.fetch(MODMAIL_CHANNEL_ID);
      if (!modmailChannel) {
        console.error("Modmail channel not found:", MODMAIL_CHANNEL_ID);
        return;
      }

      // Thread name encodes the user ID so staff replies can be routed back
      const threadName = `${message.author.username} (${message.author.id})`;

      // Re-use an existing open thread for this user if one exists
      await modmailChannel.threads.fetchActive();
      let thread = modmailChannel.threads.cache.find(
        (t) => t.name === threadName && !t.archived
      );

      if (!thread) {
        thread = await modmailChannel.threads.create({
          name: threadName,
          reason: `Modmail thread for ${message.author.tag}`,
        });
        await thread.send(
          `📬 New modmail from **${message.author.tag}** (<@${message.author.id}>)`
        );
      }

      // Relay the user's message into the thread
      const relayContent = message.content || "(no text content)";
      await thread.send(`**${message.author.tag}:** ${relayContent}`);

      // Relay any attachments
      for (const attachment of message.attachments.values()) {
        await thread.send(attachment.url);
      }

      // Confirm receipt to the user
      await message.reply(
        "✅ Your message has been received by the moderation team. We'll get back to you soon."
      );
    } catch (error) {
      console.error("Error handling incoming DM:", error);
      try {
        await message.reply(
          "⚠️ There was an error sending your message. Please try again later."
        );
      } catch (replyError) {
        console.error("Error sending error reply to user:", replyError);
      }
    }
    return;
  }

  // --- Staff reply in a modmail thread: thread → user DM ---
  if (
    message.channel.isThread() &&
    message.channel.parentId === MODMAIL_CHANNEL_ID
  ) {
    try {
      // Extract the user ID from the thread name: "Username (123456789)"
      const match = message.channel.name.match(/\((\d+)\)$/);
      if (!match) {
        console.warn(
          "Could not extract user ID from thread name:",
          message.channel.name
        );
        return;
      }

      const userId = match[1];
      const user = await client.users.fetch(userId);
      if (!user) {
        console.error("Could not fetch user with ID:", userId);
        return;
      }

      // Relay the staff reply as a DM to the user
      const replyContent = message.content || "(no text content)";
      await user.send(`📨 **Reply from the moderation team:** ${replyContent}`);

      // Relay any attachments
      for (const attachment of message.attachments.values()) {
        await user.send(attachment.url);
      }

      // Acknowledge the relay with a checkmark reaction
      await message.react("✅");
    } catch (error) {
      console.error("Error relaying staff reply to user:", error);
      try {
        await message.react("❌");
      } catch (reactError) {
        console.error("Error adding failure reaction:", reactError);
      }
    }
  }
});

client.login(DISCORD_TOKEN);
