const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  EmbedBuilder, 
  WebhookClient,
  Events
} = require("discord.js");
const express = require("express");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.get("/", (req, res) => res.send("✅ البوت شغال 24/7 - By TSK"));
app.listen(3000, () => console.log("🚀 السيرفر شغال على بورت 3000"));

/* ================================================================================ */
/* 🧩 القسم الأول: بوت IDs */
/* ================================================================================ */
const clientID = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

function getLastId(members) {
  const sorted = Array.from(members.values()).sort(
    (a, b) => a.joinedTimestamp - b.joinedTimestamp
  );
  for (let i = sorted.length - 1; i >= 0; i--) {
    const member = sorted[i];
    if (!member.nickname) continue;
    const match = member.nickname.match(/\b(\d+)\b$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= process.env.START_ID && num < 999999999) return num;
    }
  }
  return 0;
}

clientID.once("ready", async () => {
  console.log(`✅ [ID BOT] ${clientID.user.tag} شغال`);
  try {
    const guild = await clientID.guilds.fetch(process.env.GUILD_ID);
    await guild.members.fetch();

    if (process.env.RESET_NICK === "true") {
      for (const [id, member] of guild.members.cache) {
        if (!member.user.bot) {
          try { await member.setNickname(null); } catch {}
        }
      }
    }

    const sortedMembers = guild.members.cache
      .filter(m => !m.user.bot)
      .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);

    let lastId = getLastId(sortedMembers);
    let currentId = lastId === 0 ? parseInt(process.env.START_ID) : lastId + 1;

    for (const [id, member] of sortedMembers) {
      if (process.env.ASSIGN_ONLY_NEW === "true" && /\b\d+\b/.test(member.displayName)) continue;
      const newNickname = `${member.displayName || member.user.username} I ${currentId}`;
      try { await member.setNickname(newNickname); console.log(`📌 ${member.user.tag} → ID ${currentId}`); } catch {}
      currentId++;
    }
    console.log("🎯 تم توزيع جميع IDs بنجاح.");
  } catch (error) {
    console.error("❌ خطأ في ID Bot:", error);
  }
});

clientID.on("guildMemberAdd", async member => {
  if (member.user.bot) return;
  const guild = member.guild;
  await guild.members.fetch();
  const lastId = getLastId(guild.members.cache);
  const newId = lastId === 0 ? parseInt(process.env.START_ID) : lastId + 1;
  const newNickname = `${member.displayName || member.user.username} I ${newId}`;
  try { await member.setNickname(newNickname); console.log(`🆕 عضو جديد: ${member.user.tag} → ID ${newId}`); } catch {}
});

clientID.login(process.env.TOKEN_IDBOT);

/* ================================================================================ */
/* 🕊️ القسم الثاني: بوت الزاجل + نظام اللوق + Bad Words + مجهول الهوية */
/* ================================================================================ */
const clientTag = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const cooldown = new Map();
const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const logWebhook = process.env.ZAGL_LOG_WEBHOOK ? new WebhookClient({ url: process.env.ZAGL_LOG_WEBHOOK }) : null;

clientTag.once("ready", () => { console.log(`✅ [ZAGL BOT] ${clientTag.user.tag} شغال`); });

clientTag.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.content === "!zagl") {
    const isOnline = clientTag.ws.status === 0 ? "🟢 أونلاين" : "🔴 أوفلاين";
    const embed = new EmbedBuilder()
      .setTitle("🕊️ حمام زاجل")
      .setDescription(`أرسل رسالة لشخص آخر بطريقة أنيقة عبر الحمام الزاجل ✉️\n\nحالة البوت: **${isOnline}**`)
      .setColor("Blue");
    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("send_message").setLabel("📨 إرسال رسالة").setStyle(ButtonStyle.Primary)
    );
    await message.reply({ embeds: [embed], components: [button] });
  }
});

clientTag.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton() && interaction.customId === "send_message") {
    const modal = new ModalBuilder().setCustomId("zagl_modal").setTitle("📨 إرسال رسالة زاجل");
    const userIdInput = new TextInputBuilder().setCustomId("user_id").setLabel("أدخل كوبي آيدي الشخص المستلم").setPlaceholder("مثال: 123456789012345678").setStyle(TextInputStyle.Short).setRequired(true);
    const messageInput = new TextInputBuilder().setCustomId("message_content").setLabel("اكتب الرسالة التي تريد إرسالها").setPlaceholder("اكتب هنا...").setStyle(TextInputStyle.Paragraph).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(userIdInput), new ActionRowBuilder().addComponents(messageInput));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "zagl_modal") {
    const sender = interaction.user;
    const now = Date.now();
    if (cooldown.has(sender.id)) {
      const remaining = cooldown.get(sender.id) - now;
      if (remaining > 0) {
        const minutes = Math.ceil(remaining / 60000);
        await interaction.reply({ content: `⏳ يمكنك إرسال رسالة أخرى بعد ${minutes} دقيقة.`, ephemeral: true });
        return;
      }
    }

    const userId = interaction.fields.getTextInputValue("user_id");
    const msgContent = interaction.fields.getTextInputValue("message_content");
    if (config.BAD_WORDS.some(word => msgContent.toLowerCase().includes(word.toLowerCase()))) {
      await interaction.reply({ content: "🚫 رسالتك تحتوي على كلمات غير مسموح بها.", ephemeral: true });
      return;
    }

    const anonButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`anon_yes_${userId}_${sender.id}_${Buffer.from(msgContent).toString("base64")}`).setLabel("✅ إرسال كمجهول").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`anon_no_${userId}_${sender.id}_${Buffer.from(msgContent).toString("base64")}`).setLabel("❌ إرسال باسمك").setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({ content: "هل ترغب بإرسال الرسالة كمجهول الهوية؟", components: [anonButtons], ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith("anon_")) {
    const [_, mode, targetId, senderId, encodedMsg] = interaction.customId.split("_");
    const msgContent = Buffer.from(encodedMsg, "base64").toString("utf8");
    try {
      const target = await clientTag.users.fetch(targetId);
      const sender = await clientTag.users.fetch(senderId);

      const embed = new EmbedBuilder().setTitle("📨 رسالة زاجل وصلت إليك 🕊️").setDescription(msgContent).setColor("Green").setTimestamp();
      if (mode === "no") embed.setFooter({ text: `من ${sender.tag}`, iconURL: sender.displayAvatarURL() });
      else embed.setFooter({ text: `مرسل مجهول 🕵️‍♂️` });
      await target.send({ embeds: [embed] });

      if (logWebhook) {
        const logEmbed = new EmbedBuilder()
          .setTitle("📋 رسالة زاجل جديدة")
          .setColor(mode === "yes" ? "Orange" : "Yellow")
          .addFields(
            { name: "👤 المرسل", value: `${sender.tag} (<@${sender.id}>)`, inline: false },
            { name: "🎯 المستلم", value: `${target.tag} (<@${target.id}>)`, inline: false },
            { name: "💬 الرسالة", value: msgContent.length>1000 ? msgContent.slice(0,1000)+"..." : msgContent, inline: false },
            { name: "⚙️ نوع الإرسال", value: mode==="yes"?"مجهول الهوية 🕵️":"عادي 👤", inline:false },
            { name: "⏰ الوقت", value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline:false }
          );
        await logWebhook.send({ embeds: [logEmbed] });
      }

      await interaction.update({ content: "✅ تم إرسال الرسالة بنجاح!", components: [] });
      cooldown.set(senderId, Date.now() + 10*60*1000);
      setTimeout(() => cooldown.delete(senderId), 10*60*1000);
    } catch (err) {
      console.error(err);
      await interaction.update({ content: "⚠️ حدث خطأ أثناء الإرسال. تأكد أن المستخدم يستقبل الرسائل الخاصة.", components: [] });
    }
  }
});

clientTag.login(process.env.TOKEN_TAGBOT);
