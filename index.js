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
  Events,
  PermissionFlagsBits,
  ChannelType,
  StringSelectMenuBuilder,
  Colors
} = require("discord.js");
const express = require("express");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.get("/", (req, res) => res.send("✅ البوت شغال 24/7 - By TSK"));
app.listen(3000, () => console.log("🚀 السيرفر شغال على بورت 3000"));
setInterval(() => {
  fetch("https://hc-ping.com/96de4fd9-a4d2-4dd4-9bc8-f433807d4dc8")
    .then(() => console.log("✅ Ping sent to Healthchecks"))
    .catch(() => console.log("❌ Ping failed"));
}, 1000 * 60 * 10); // كل 10 دقائق


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
      if (num >= parseInt(process.env.START_ID) && num < 999999999) return num;
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
      console.log("⚠️ جاري إعادة تعيين الأسماء المستعارة لجميع الأعضاء...");
      for (const [id, member] of guild.members.cache) {
        if (!member.user.bot) {
          try { 
             await member.setNickname(null); 
          } catch (e) {
             console.error(`❌ فشل إعادة تعيين اسم ${member.user.tag}: ${e.message}`);
          }
        }
      }
      console.log("✅ اكتملت إعادة تعيين الأسماء.");
    }

    const sortedMembers = guild.members.cache
      .filter(m => !m.user.bot)
      .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);

    let lastId = getLastId(sortedMembers);
    let currentId = lastId === 0 ? parseInt(process.env.START_ID) : lastId + 1;

    for (const [id, member] of sortedMembers) {
      if (process.env.ASSIGN_ONLY_NEW === "true" && /\b\d+\b/.test(member.displayName)) continue;
      const nicknameBase = member.nickname ? member.nickname.replace(/ I \d+$/, '') : member.displayName;
      const newNickname = `${nicknameBase} I ${currentId}`;
      try { 
        await member.setNickname(newNickname); 
        console.log(`📌 ${member.user.tag} → ID ${currentId}`); 
      } catch (e) {
        console.error(`❌ فشل تعيين ID لـ ${member.user.tag}: ${e.message}`);
      }
      currentId++;
    }
    console.log("🎯 تم توزيع جميع IDs بنجاح.");
  } catch (error) {
    console.error("❌ خطأ في ID Bot:", error);
  }
});

clientID.on("guildMemberAdd", async member => {
  if (member.user.bot) return;
  try {
    const guild = member.guild;
    await guild.members.fetch();
    const lastId = getLastId(guild.members.cache);
    const newId = lastId === 0 ? parseInt(process.env.START_ID) : lastId + 1;
    const nicknameBase = member.displayName;
    const newNickname = `${nicknameBase} I ${newId}`;
    await member.setNickname(newNickname);
    console.log(`🆕 عضو جديد: ${member.user.tag} → ID ${newId}`);
  } catch (e) {
    console.error(`❌ فشل تعيين ID للعضو الجديد ${member.user.tag}: ${e.message}`);
  }
});

clientID.login(process.env.TOKEN_IDBOT);

/* ================================================================================ */
/* 🕊️ القسم الثاني: بوت الزاجل + نظام القروبات */
/* ================================================================================ */

const clientTag = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessageReactions
  ] 
});

const cooldown = new Map();
const configPath = "./config.json";

const logWebhook = process.env.ZAGL_LOG_WEBHOOK ?
  new WebhookClient({ url: process.env.ZAGL_LOG_WEBHOOK }) : null;

// ================================================================================
// 🛠 دالة قراءة وكتابة الإعدادات
// ================================================================================

function writeConfig(newConfig) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), "utf8");
  } catch (err) {
    console.error("❌ فشل في كتابة ملف config.json:", err);
  }
}

function readConfig() {
  const defaultConfig = { 
    GUILD_ID: process.env.GUILD_ID || "",
    START_ID: parseInt(process.env.START_ID) || 10000,
    RESET_NICK: false,
    ASSIGN_ONLY_NEW: true,
    BAD_WORDS: ["fuck", "shit", "احا", "كس", "ايري", "ابن كلب", "متخلف"], 
    groups: {} 
  };
  
  try {
    if (!fs.existsSync(configPath)) {
      console.log("⚠️ ملف config.json غير موجود، سيتم إنشاؤه...");
      writeConfig(defaultConfig);
      return defaultConfig;
    }

    const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
    let needsUpdate = false;

    if (!data.groups || typeof data.groups !== 'object') {
      data.groups = {};
      needsUpdate = true;
    }

    if (!Array.isArray(data.BAD_WORDS)) {
      data.BAD_WORDS = defaultConfig.BAD_WORDS;
      needsUpdate = true;
    }

    // تأكد من وجود جميع الحقول المطلوبة
    if (!data.GUILD_ID) data.GUILD_ID = process.env.GUILD_ID || "";
    if (!data.START_ID) data.START_ID = parseInt(process.env.START_ID) || 10000;
    if (data.RESET_NICK === undefined) data.RESET_NICK = false;
    if (data.ASSIGN_ONLY_NEW === undefined) data.ASSIGN_ONLY_NEW = true;

    if (needsUpdate) {
      writeConfig(data);
    }
    return data;
  } catch (err) {
    console.error("❌ فشل في قراءة ملف config.json أو تنسيقه غير صحيح. يتم إنشاء ملف جديد بأمان.");
    writeConfig(defaultConfig);
    return defaultConfig;
  }
}

let config = readConfig();

clientTag.once("ready", () => {
  console.log(`✅ [ZAGL/GROUP BOT] ${clientTag.user.tag} شغال`);
});

// ================================================================================
// ⚙️ وظائف مساعدة لنظام القروبات
// ================================================================================

async function sendUnifiedLog(title, description, color, fields = []) {
  if (!logWebhook) return;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  if (fields.length) embed.addFields(fields);
  try {
    await logWebhook.send({ embeds: [embed] });
  } catch (e) {
    console.error("❌ فشل إرسال اللوق الموحد:", e);
  }
}

async function createSettingsMessage(group, channel, client) {
  const guild = channel.guild;
  const owner = await client.users.fetch(group.ownerId).catch(() => null);

  const memberRole = guild.roles.cache.get(group.memberRoleId);
  await guild.members.fetch();
  const members = memberRole ?
    memberRole.members.map(m => m.user.tag).join("\n") : "لا يوجد أعضاء";
  const managers = group.managerIds.map(id => `<@${id}>`).join(", ") || "لا يوجد";
  
  const embed = new EmbedBuilder()
    .setTitle(`⚙️ إعدادات قروب ${group.name}`)
    .setDescription(`**👑 المالك الحالي:** ${owner ? owner.tag : 'غير متوفر'}\n**👮 المدراء:** ${managers}\n\n**القائمة الحالية للأعضاء:**\n\`\`\`\n${members}\n\`\`\``)
    .setColor(memberRole?.color || Colors.Blue)
    .setTimestamp();
  
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`group_add_member_${group.id}`).setLabel("➕ إضافة عضو").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`group_remove_member_${group.id}`).setLabel("➖ إزالة عضو").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`group_add_manager_${group.id}`).setLabel("🛡️ إضافة مدير").setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`group_change_name_${group.id}`).setLabel("📝 تغيير اسم القروب").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`group_change_color_${group.id}`).setLabel("🎨 تغيير لون الرتب").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`group_request_delete_${group.id}`).setLabel("🗑️ طلب حذف القروب").setStyle(ButtonStyle.Danger),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`group_add_channels_${group.id}`).setLabel("➕ إضافة قنوات").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`group_delete_channels_${group.id}`).setLabel("✂️ حذف قنوات بـ ID").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`group_transfer_owner_${group.id}`).setLabel("👑 تحويل الملكية").setStyle(ButtonStyle.Danger),
  );
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`group_rename_channel_${group.id}`).setLabel("✏️ تغيير اسم روم").setStyle(ButtonStyle.Primary)
  );

  const message = await channel.send({ embeds: [embed], components: [row1, row2, row3, row4] });
  group.settingsMessageId = message.id;
  config.groups[group.id] = group;
  writeConfig(config);
}

async function updateSettingsMessage(group, guild, client) {
  const channel = guild.channels.cache.get(group.settingsChannelId);
  if (!channel || !channel.isTextBased()) return;
  
  const owner = await client.users.fetch(group.ownerId).catch(() => null);
  const memberRole = guild.roles.cache.get(group.memberRoleId);
  const managers = group.managerIds.map(id => `<@${id}>`).join(", ") || "لا يوجد";
  
  let membersList = "لا يوجد أعضاء";
  if (memberRole) {
    await guild.members.fetch();
    const members = memberRole.members;
    membersList = members.map(m => m.user.tag).join("\n") || "لا يوجد أعضاء";
  }

  const embed = new EmbedBuilder()
    .setTitle(`⚙️ إعدادات قروب ${group.name}`)
    .setDescription(`**👑 المالك الحالي:** ${owner ? owner.tag : 'غير متوفر'}\n**👮 المدراء:** ${managers}\n\n**القائمة الحالية للأعضاء:**\n\`\`\`\n${membersList}\n\`\`\``)
    .setColor(memberRole?.color || Colors.Blue)
    .setTimestamp();
  
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`group_add_member_${group.id}`).setLabel("➕ إضافة عضو").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`group_remove_member_${group.id}`).setLabel("➖ إزالة عضو").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`group_add_manager_${group.id}`).setLabel("🛡️ إضافة مدير").setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`group_change_name_${group.id}`).setLabel("📝 تغيير اسم القروب").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`group_change_color_${group.id}`).setLabel("🎨 تغيير لون الرتب").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`group_request_delete_${group.id}`).setLabel("🗑️ طلب حذف القروب").setStyle(ButtonStyle.Danger),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`group_add_channels_${group.id}`).setLabel("➕ إضافة قنوات").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`group_delete_channels_${group.id}`).setLabel("✂️ حذف قنوات بـ ID").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`group_transfer_owner_${group.id}`).setLabel("👑 تحويل الملكية").setStyle(ButtonStyle.Danger),
  );
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`group_rename_channel_${group.id}`).setLabel("✏️ تغيير اسم روم").setStyle(ButtonStyle.Primary)
  );

  try {
    const message = await channel.messages.fetch(group.settingsMessageId);
    await message.edit({ embeds: [embed], components: [row1, row2, row3, row4] });
  } catch (error) {
    console.error("❌ فشل تحديث رسالة الإعدادات:", error);
    delete group.settingsMessageId;
    writeConfig(config);
    await createSettingsMessage(group, channel, client);
  }
}

function isGroupAdmin(interaction, group) {
  return interaction.user.id === group.ownerId || group.managerIds.includes(interaction.user.id);
}

// ================================================================================
// 🕊️ منطق بوت الزاجل والقروبات
// ================================================================================

clientTag.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  try {
      // --- 1. منطق بوت الزاجل ---
      if (message.content === "!zagl") {
          const isOnline = clientTag.ws.status === 0 ? "By TSK" : "🔴 أوفلاين";
          const embed = new EmbedBuilder()
              .setTitle("🕊️ حمام زاجل")
              .setDescription(`أرسل رسالة لشخص آخر بطريقة أنيقة عبر الحمام الزاجل ✉️\n\n ! **${isOnline}**`)
              .setColor(Colors.Blue)
              .setTimestamp();
          const button = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("send_message").setLabel("📨 إرسال رسالة").setStyle(ButtonStyle.Primary)
          );
          await message.reply({ embeds: [embed], components: [button] });
          return;
      }

      // --- 2. منطق نظام القروبات (الأوامر) ---
      if (message.content.startsWith("!")) {
          const args = message.content.slice(1).split(/\s+/);
          const command = args.shift().toLowerCase();

          const groupManagerRoleId = process.env.ROLE_GROUP_MANAGER_ID;
          
          if (!message.member) {
              await message.guild.members.fetch(message.author.id).catch(() => null); 
          }
          
          const isGroupManager = message.member && message.member.roles.cache.has(groupManagerRoleId);

          if (command === "memberbytsk") {
              const embed = new EmbedBuilder()
                  .setTitle("👤 خدمات القروبات (By TSK)")
                  .setDescription("اختر الخدمة التي تريد القيام بها:")
                  .setColor(Colors.Blue);
              
              const row = new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId("tsk_join_group_menu").setLabel("➕ تقديم طلب انضمام لقروب").setStyle(ButtonStyle.Success),
                  new ButtonBuilder().setCustomId("tsk_exit_group").setLabel("🚪 الخروج من القروب الحالي").setStyle(ButtonStyle.Danger),
              );
              await message.reply({ embeds: [embed], components: [row] });
              return;
          }

          if (command === "group") {
              if (!isGroupManager) {
                  return message.reply("🚫 ليس لديك الصلاحية لاستخدام أوامر إدارة القروبات.");
              }

              const embed = new EmbedBuilder()
                  .setTitle("⚙️ لوحة إدارة القروبات")
                  .setDescription("الرجاء اختيار العملية التي تريد القيام بها:")
                  .setColor(Colors.Yellow);

              const row = new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId("create_group").setLabel("➕ إنشاء قروب جديد").setStyle(ButtonStyle.Success),
                  new ButtonBuilder().setCustomId("delete_group_menu").setLabel("🗑️ حذف قروب / كل القروبات").setStyle(ButtonStyle.Danger),
                  new ButtonBuilder().setCustomId("view_active_groups").setLabel("📊 عرض القروبات النشطة").setStyle(ButtonStyle.Primary)
              );

              await message.reply({ embeds: [embed], components: [row] });
              return;
          }

          if (command === "info") {
              const groupData = config.groups;
              if (Object.keys(groupData).length === 0) {
                  return message.reply("😔 لا توجد قروبات نشطة حالياً.");
              }

              const infoEmbed = new EmbedBuilder()
                  .setTitle("📊 معلومات القروبات النشطة")
                  .setColor(Colors.Purple);
              
              for (const [id, group] of Object.entries(groupData)) {
                  const guild = message.guild;
                  const owner = await guild.members.fetch(group.ownerId).catch(() => null);
                  const memberRole = guild.roles.cache.get(group.memberRoleId);

                  let membersCount = 0;
                  let membersMentions = "";
                  if (memberRole) {
                      const members = memberRole.members;
                      membersCount = members.size;
                      membersMentions = members.map(m => m.toString()).slice(0, 5).join(", ") + (members.size > 5 ? ` و ${members.size - 5} آخرين...` : "");
                  }

                  infoEmbed.addFields({
                      name: `🏷️ ${group.name} (ID: ${id.substring(0, 4)})`,
                      value: `**👥 الأعضاء:** ${membersCount}\n**👑 المالك:** ${owner ? owner.toString() : "غير متوفر"}\n**🔗 الأعضاء الأوائل:** ${membersMentions || "لا يوجد أعضاء"}`,
                      inline: false
                  });
              }

              await message.reply({ embeds: [infoEmbed] });
              return;
          }
      }
  } catch (error) {
      console.error("❌ خطأ غير متوقع في معالجة رسالة (messageCreate):", error);
  }
});

// ================================================================================
// 🖱️ منطق التفاعلات (Buttons & Modals & Select Menus)
// ================================================================================

clientTag.on(Events.InteractionCreate, async interaction => {

  // --- 1. منطق بوت الزاجل ---
  if (interaction.isButton() && interaction.customId === "send_message") {
    const modal = new ModalBuilder().setCustomId("zagl_modal").setTitle("📨 إرسال رسالة زاجل");
    const userIdInput = new TextInputBuilder().setCustomId("user_id").setLabel("أدخل كوبي آيدي الشخص المستلم").setPlaceholder("مثال: 123456789012345678").setStyle(TextInputStyle.Short).setRequired(true);
    const messageInput = new TextInputBuilder().setCustomId("message_content").setLabel("اكتب الرسالة التي تريد إرسالها").setPlaceholder("اكتب هنا...").setStyle(TextInputStyle.Paragraph).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(userIdInput), new ActionRowBuilder().addComponents(messageInput));
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === "zagl_modal") {
    const sender = interaction.user;
    const now = Date.now();
    if (cooldown.has(sender.id)) {
      const remaining = cooldown.get(sender.id) - now;
      if (remaining > 0) {
        await interaction.reply({ content: `⏳ يمكنك إرسال رسالة أخرى بعد ${Math.ceil(remaining / 60000)} دقيقة.`, ephemeral: true });
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
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith("anon_")) {
    const [_, mode, targetId, senderId, encodedMsg] = interaction.customId.split("_");
    const msgContent = Buffer.from(encodedMsg, "base64").toString("utf8");
    try {
      const target = await clientTag.users.fetch(targetId);
      const sender = await clientTag.users.fetch(senderId);

      const embed = new EmbedBuilder().setTitle("📨 رسالة زاجل وصلت إليك 🕊️").setDescription(msgContent).setColor(Colors.Green).setTimestamp();
      if (mode === "no") embed.setFooter({ text: `من ${sender.tag}`, iconURL: sender.displayAvatarURL() });
      else embed.setFooter({ text: `مرسل مجهول 🕵️‍♂️` });
      await target.send({ embeds: [embed] });

      if (logWebhook) {
        const logEmbed = new EmbedBuilder()
          .setTitle("📋 رسالة زاجل جديدة")
          .setColor(mode === "yes" ? Colors.Orange : Colors.Yellow)
          .addFields(
            { name: "👤 المرسل", value: `${sender.tag} (<@${sender.id}>)`, inline: false },
            { name: "🎯 المستلم", value: `${target.tag} (<@${target.id}>)`, inline: false },
            { name: "💬 الرسالة", value: msgContent.length > 1000 ? msgContent.slice(0, 1000) + "..." : msgContent, inline: false },
            { name: "⚙️ نوع الإرسال", value: mode === "yes" ? "مجهول الهوية 🕵️" : "عادي 👤", inline: false },
            { name: "⏰ الوقت", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false }
          );
        await logWebhook.send({ embeds: [logEmbed] });
      }

      await interaction.update({ content: "✅ تم إرسال الرسالة بنجاح!", components: [] });
      cooldown.set(senderId, Date.now() + 10 * 60 * 1000);
      setTimeout(() => cooldown.delete(senderId), 10 * 60 * 1000);
    } catch (err) {
      console.error(err);
      await interaction.update({ content: "⚠️ حدث خطأ أثناء الإرسال. تأكد أن المستخدم يستقبل الرسائل الخاصة.", components: [] });
    }
    return;
  }

  // --- 2. منطق التفاعلات الجديدة (Join/Exit Group) ---
  if (interaction.isButton() && interaction.customId.startsWith("tsk_")) {
      const action = interaction.customId.split("_")[1];

      if (action === "join" && interaction.customId.endsWith("menu")) {
          const groupOptions = Object.entries(config.groups).map(([id, group]) => ({
              label: group.name,
              description: `المالك: ${group.ownerId}`,
              value: id,
          }));

          if (groupOptions.length === 0) {
              return interaction.reply({ content: "😔 لا توجد قروبات نشطة حالياً يمكنك الانضمام إليها.", ephemeral: true });
          }
          
          const memberCurrentGroup = Object.entries(config.groups).find(([id, group]) => interaction.member.roles.cache.has(group.memberRoleId));
          if(memberCurrentGroup) {
              return interaction.reply({ content: `🚫 أنت بالفعل عضو في قروب **${memberCurrentGroup[1].name}**. لا يمكنك الانضمام لقروب آخر.`, ephemeral: true });
          }

          const selectMenu = new StringSelectMenuBuilder()
              .setCustomId("tsk_select_group_to_join")
              .setPlaceholder("اختر القروب الذي تريد التقديم عليه...")
              .addOptions(groupOptions);
          
          const row = new ActionRowBuilder().addComponents(selectMenu);

          await interaction.reply({ content: "الرجاء اختيار القروب الذي تريد إرسال طلب انضمام إليه:", components: [row], ephemeral: true });
          return;
      }
      
      if (action === "exit" && interaction.customId.endsWith("group")) {
          const member = interaction.member;
          const groupFound = Object.entries(config.groups).find(([id, group]) => member.roles.cache.has(group.memberRoleId));

          if (!groupFound) {
              return interaction.reply({ content: "🚫 أنت لست عضواً في أي قروب لتتمكن من الخروج منه.", ephemeral: true });
          }

          const [groupId, group] = groupFound;
          const ownerRole = interaction.guild.roles.cache.get(group.ownerRoleId);
          const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);

          if (member.id === group.ownerId) {
             return interaction.reply({ content: "👑 لا يمكنك الخروج من القروب لأنك **المالك**. يجب عليك أولاً **تحويل الملكية** عبر قناة الإعدادات الخاصة بالقروب.", ephemeral: true });
          }

          try {
              if (ownerRole && member.roles.cache.has(ownerRole.id) && group.managerIds.includes(member.id)) {
                  await member.roles.remove(ownerRole, "خروج من القروب (مدير سابق)");
                  group.managerIds = group.managerIds.filter(id => id !== member.id);
                  writeConfig(config);
              }
              await member.roles.remove(memberRole, "خروج من القروب بأمر !tsk");
              
              await updateSettingsMessage(group, interaction.guild, clientTag);

              await sendUnifiedLog("🏃‍♂️ خروج عضو من القروب (زر)",
                  `**${member.user.tag}** (<@${member.id}>) غادر قروب **${group.name}** بنفسه.`,
                  Colors.Orange);
              await interaction.reply({ content: `✅ تم خروجك من قروب **${group.name}** بنجاح.`, ephemeral: true });

          } catch (error) {
              console.error("❌ فشل في إزالة الرتبة عند الخروج:", error);
              await interaction.reply({ content: "⚠️ حدث خطأ أثناء محاولة الخروج من القروب. يرجى مراجعة صلاحيات البوت.", ephemeral: true });
          }
          return;
      }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "tsk_select_group_to_join") {
      await interaction.deferReply({ ephemeral: true });
      const groupId = interaction.values[0];
      const group = config.groups[groupId];
      const member = interaction.member;

      if (!group) return interaction.editReply("❌ القروب غير موجود.");
      
      const isAlreadyInGroup = Object.entries(config.groups).some(([id, g]) => member.roles.cache.has(g.memberRoleId));
      if (isAlreadyInGroup) {
          return interaction.editReply("🚫 أنت بالفعل عضو في قروب آخر. لا يمكنك الانضمام.");
      }

      try {
          const settingsChannel = interaction.guild.channels.cache.get(group.settingsChannelId);
          if (!settingsChannel || !settingsChannel.isTextBased()) {
              return interaction.editReply("❌ قناة إعدادات القروب غير موجودة أو لا يمكن الوصول إليها.");
          }

          const embed = new EmbedBuilder()
              .setTitle(`📬 طلب انضمام جديد لقروب ${group.name}`)
              .setDescription(`**👤 مقدم الطلب:** ${member.toString()} (\`${member.id}\`)\n\n**❓ هل توافق على انضمام هذا العضو؟**`)
              .setColor(Colors.Yellow)
              .setTimestamp();
          
          const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`approve_join_${groupId}_${member.id}`).setLabel("✅ قبول").setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`reject_join_${groupId}_${member.id}`).setLabel("❌ رفض").setStyle(ButtonStyle.Danger),
          );

          await settingsChannel.send({ embeds: [embed], components: [row] });
          await interaction.editReply(`✅ تم إرسال طلب الانضمام إلى قناة الإعدادات الخاصة بقروب **${group.name}** بنجاح. سيتم إخطارك بالقبول أو الرفض عبر الخاص.`);

      } catch (error) {
          console.error("❌ فشل إرسال طلب الانضمام:", error);
          await interaction.editReply("⚠️ حدث خطأ أثناء إرسال طلب الانضمام. يرجى مراجعة الصلاحيات.");
      }
      return;
  }
  
  if (interaction.isButton() && (interaction.customId.startsWith("approve_join_") || interaction.customId.startsWith("reject_join_"))) {
      await interaction.deferUpdate();
      const parts = interaction.customId.split("_");
      const action = parts[0];
      const groupId = parts[2];
      const memberId = parts[3];
      
      const group = config.groups[groupId];
      if (!group) return interaction.editReply({ content: "❌ هذا القروب غير موجود.", components: [] });
      
      if (!isGroupAdmin(interaction, group)) {
          return interaction.followUp({ content: "🚫 أنت لست مالكاً أو مديراً لهذا القروب لتقبل/ترفض الطلب.", ephemeral: true });
      }

      const targetMember = await interaction.guild.members.fetch(memberId).catch(() => null);
      if (!targetMember) {
          return interaction.editReply({ content: "❌ العضو مقدم الطلب لم يعد في السيرفر.", components: [] });
      }

      if (action === "approve") {
          try {
              const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);
              if (!memberRole) return interaction.editReply({ content: "❌ رتبة القروب غير موجودة.", components: [] });

              const isAlreadyInGroup = Object.entries(config.groups).some(([id, g]) => g.id !== groupId && targetMember.roles.cache.has(g.memberRoleId));
              if (isAlreadyInGroup) {
                  return interaction.editReply({ content: `🚫 لا يمكن قبول العضو. لقد انضم لقروب آخر في هذه الأثناء.`, components: [] });
              }
              
              await targetMember.roles.add(memberRole, `قبول طلب الانضمام لقروب ${group.name} بواسطة ${interaction.user.tag}`);

              const acceptedEmbed = new EmbedBuilder().setTitle("✅ تم قبول طلبك!").setDescription(`تهانينا! تم قبول انضمامك لقروب **${group.name}**.`).setColor(Colors.Green);
              await targetMember.send({ embeds: [acceptedEmbed] }).catch(() => console.error(`❌ فشل إرسال رسالة خاصة للقبول إلى ${targetMember.user.tag}`));

              await updateSettingsMessage(group, interaction.guild, clientTag);
              await interaction.editReply({ content: `✅ تم **قبول** طلب انضمام ${targetMember.toString()} للقروب.`, embeds: [], components: [] });
              await sendUnifiedLog("✅ قبول طلب انضمام", `تم قبول انضمام العضو **${targetMember.user.tag}** لقروب **${group.name}** بواسطة ${interaction.user.tag}.`, Colors.Green);

          } catch (error) {
              console.error("❌ فشل قبول طلب الانضمام:", error);
              await interaction.editReply({ content: "⚠️ حدث خطأ أثناء قبول الطلب. يرجى مراجعة صلاحيات البوت.", embeds: [], components: [] });
          }
      } else if (action === "reject") {
          const rejectedEmbed = new EmbedBuilder().setTitle("❌ تم رفض طلبك").setDescription(`نأسف، تم رفض طلب انضمامك لقروب **${group.name}**.`).setColor(Colors.Red);
          await targetMember.send({ embeds: [rejectedEmbed] }).catch(() => console.error(`❌ فشل إرسال رسالة خاصة للرفض إلى ${targetMember.user.tag}`));

          await interaction.editReply({ content: `❌ تم **رفض** طلب انضمام ${targetMember.toString()} للقروب.`, embeds: [], components: [] });
          await sendUnifiedLog("❌ رفض طلب انضمام", `تم رفض انضمام العضو **${targetMember.user.tag}** لقروب **${group.name}** بواسطة ${interaction.user.tag}.`, Colors.Red);
      }
      return;
  }
  
  if (interaction.isButton() && interaction.customId.startsWith("group_transfer_owner_")) {
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
      if (interaction.user.id !== group.ownerId) return interaction.reply({ content: "🚫 أنت لست مالك القروب الحالي لتحويل الملكية.", ephemeral: true });

      const modal = new ModalBuilder().setCustomId(`modal_transfer_owner_${groupId}`).setTitle(`👑 تحويل ملكية قروب ${group.name}`);
      const newOwnerIdInput = new TextInputBuilder().setCustomId("new_owner_id").setLabel("كوبي آيدي المالك الجديد").setPlaceholder("أدخل آيدي العضو الذي سيصبح المالك الجديد").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(newOwnerIdInput));
      
      return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_transfer_owner_")) {
      await interaction.deferReply({ ephemeral: true });
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.editReply("❌ القروب غير موجود.");

      const newOwnerId = interaction.fields.getTextInputValue("new_owner_id").trim();
      const oldOwnerId = group.ownerId;
      
      const newOwnerMember = await interaction.guild.members.fetch(newOwnerId).catch(() => null);
      if (!newOwnerMember) {
          return interaction.editReply("❌ لم يتم العثور على المالك الجديد بهذا الآيدي في السيرفر.");
      }

      if (newOwnerId === oldOwnerId) {
          return interaction.editReply("⚠️ الآيدي المدخل هو آيدي المالك الحالي بالفعل.");
      }

      try {
          const ownerRole = interaction.guild.roles.cache.get(group.ownerRoleId);
          const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);
          if (!ownerRole || !memberRole) {
              return interaction.editReply("❌ رتب القروب (المالك/العضو) غير موجودة.");
          }
          if (!newOwnerMember.roles.cache.has(memberRole.id)) {
              await newOwnerMember.roles.add(memberRole, "إضافة كعضو قبل تحويل الملكية");
          }
          const oldOwnerMember = interaction.member;
          await oldOwnerMember.roles.remove(ownerRole, "تحويل الملكية للمالك الجديد");
          await newOwnerMember.roles.add(ownerRole, "منحه ملكية القروب");
          group.ownerId = newOwnerId;
          group.managerIds = group.managerIds.filter(id => id !== oldOwnerId);
          group.managerIds = group.managerIds.filter(id => id !== newOwnerId);
          writeConfig(config);
          await updateSettingsMessage(group, interaction.guild, clientTag);

          await sendUnifiedLog("👑 تحويل ملكية القروب", 
              `تم تحويل ملكية قروب **${group.name}**.\n**المالك الجديد:** ${newOwnerMember.user.tag} (<@${newOwnerId}>)\n**المالك السابق:** ${oldOwnerMember.user.tag} (<@${oldOwnerId}>) (أصبح عضواً فقط).`,
              Colors.Gold);
          
          const transferEmbed = new EmbedBuilder().setTitle("👑 مبروك! أصبحت مالكاً جديداً").setDescription(`تم تحويل ملكية قروب **${group.name}** إليك بواسطة المالك السابق ${oldOwnerMember.user.tag}.`).setColor(Colors.Gold);
          await newOwnerMember.send({ embeds: [transferEmbed] }).catch(() => console.error(`❌ فشل إرسال رسالة خاصة للمالك الجديد`));

          return interaction.editReply(`✅ تم تحويل ملكية قروب **${group.name}** إلى ${newOwnerMember.toString()} بنجاح. المالك السابق أصبح عضواً فقط.`);

      } catch (error) {
          console.error("❌ فشل تحويل ملكية القروب:", error);
          return interaction.editReply("⚠️ حدث خطأ أثناء تحويل الملكية. يرجى التحقق من صلاحيات البوت.");
      }
  }

  // ================================================================================
  // ⚙️ منطق إنشاء وحذف القروبات
  // ================================================================================

  if (interaction.isButton() && interaction.customId === "create_group") {
    const groupManagerRoleId = process.env.ROLE_GROUP_MANAGER_ID;
    if (!interaction.member.roles.cache.has(groupManagerRoleId)) {
        return interaction.reply({ content: "🚫 ليس لديك الصلاحية لإنشاء قروب.", ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId("modal_create_group").setTitle("➕ إنشاء قروب جديد");
    const groupNameInput = new TextInputBuilder().setCustomId("group_name").setLabel("أدخل اسم القروب").setPlaceholder("مثال: TSK").setStyle(TextInputStyle.Short).setRequired(true);
    const ownerIdInput = new TextInputBuilder().setCustomId("owner_id").setLabel("كوبي آيدي مالك القروب (اختياري)").setPlaceholder("آيدي العضو. اتركه فارغاً إذا كنت أنت المالك").setStyle(TextInputStyle.Short).setRequired(false);
    const textChannelsInput = new TextInputBuilder().setCustomId("text_channels_count").setLabel("عدد قنوات الدردشة الكتابية (افتراضي: 1)").setPlaceholder("مثال: 2").setStyle(TextInputStyle.Short).setRequired(false);
    const voiceChannelsInput = new TextInputBuilder().setCustomId("voice_channels_count").setLabel("عدد قنوات الدردشة الصوتية (افتراضي: 0)").setPlaceholder("مثال: 1").setStyle(TextInputStyle.Short).setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(groupNameInput),
        new ActionRowBuilder().addComponents(ownerIdInput),
        new ActionRowBuilder().addComponents(textChannelsInput),
        new ActionRowBuilder().addComponents(voiceChannelsInput)
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "modal_create_group") {
    await interaction.deferReply({ ephemeral: true });
    const groupName = interaction.fields.getTextInputValue("group_name").trim();
    let ownerId = interaction.fields.getTextInputValue("owner_id").trim();
    const textChannelsCount = parseInt(interaction.fields.getTextInputValue("text_channels_count")) || 1;
    const voiceChannelsCount = parseInt(interaction.fields.getTextInputValue("voice_channels_count")) || 0;

    if (!ownerId) ownerId = interaction.user.id;
    const groupOwner = await interaction.guild.members.fetch(ownerId).catch(() => null);
    if (!groupOwner) {
        return interaction.editReply("❌ لم يتم العثور على مالك القروب بهذا الآيدي في السيرفر.");
    }
    if (Object.values(config.groups).some(g => g.name.toLowerCase() === groupName.toLowerCase())) {
        return interaction.editReply("❌ يوجد قروب آخر بهذا الاسم بالفعل.");
    }

    try {
        const memberRole = await interaction.guild.roles.create({
            name: `${groupName} | Member`,
            color: Colors.Blue,
            reason: `إنشاء قروب ${groupName} - رتبة الأعضاء`,
            mentionable: true,
        });

        const ownerRole = await interaction.guild.roles.create({
            name: `${groupName} | Owner`,
            color: Colors.Gold,
            reason: `إنشاء قروب ${groupName} - رتبة المالك`,
            permissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages],
            mentionable: true,
        });

        const groupCategory = await interaction.guild.channels.create({
            name: groupName,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: memberRole.id,
                    allow: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: ownerRole.id,
                    allow: [PermissionFlagsBits.ViewChannel],
                },
            ],
        });
        
        const newGroupId = Date.now().toString(36);
        const newGroup = {
            id: newGroupId,
            name: groupName,
            ownerId: ownerId,
            memberRoleId: memberRole.id,
            ownerRoleId: ownerRole.id,
            categoryId: groupCategory.id,
            managerIds: [],
            channelIds: [],
            settingsChannelId: null,
            settingsMessageId: null,
        };
        config.groups[newGroupId] = newGroup;

        const settingsChannel = await interaction.guild.channels.create({
            name: `⚙️-${groupName}-settings`,
            type: ChannelType.GuildText,
            parent: groupCategory.id,
            topic: `قناة إعدادات قروب ${groupName}. لا يمكن حذف هذه القناة!`,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: memberRole.id,
                    deny: [PermissionFlagsBits.SendMessages],
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                },
                {
                    id: ownerRole.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
            ],
        });
        newGroup.settingsChannelId = settingsChannel.id;

        for (let i = 1; i <= textChannelsCount; i++) {
            const channel = await interaction.guild.channels.create({
                name: `${groupName}-chat-${i}`,
                type: ChannelType.GuildText,
                parent: groupCategory.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: memberRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                    {
                        id: ownerRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                ],
            });
            newGroup.channelIds.push(channel.id);
        }

        for (let i = 1; i <= voiceChannelsCount; i++) {
            const channel = await interaction.guild.channels.create({
                name: `${groupName}-Voice-${i}`,
                type: ChannelType.GuildVoice,
                parent: groupCategory.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: memberRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                    },
                    {
                        id: ownerRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
                    },
                ],
            });
            newGroup.channelIds.push(channel.id);
        }

        await groupOwner.roles.add(memberRole, `تعيين كعضو في قروب ${groupName}`);
        await groupOwner.roles.add(ownerRole, `تعيين كمالك لقروب ${groupName}`);

        writeConfig(config);
        await createSettingsMessage(newGroup, settingsChannel, clientTag);
        
        await sendUnifiedLog("➕ إنشاء قروب جديد", `تم إنشاء قروب **${groupName}** بنجاح بواسطة ${interaction.user.tag}.\n**المالك:** ${groupOwner.user.tag} (<@${ownerId}>)`, Colors.Green);

        await interaction.editReply(`✅ تم إنشاء قروب **${groupName}** بنجاح!`);

    } catch (error) {
        console.error("❌ فشل إنشاء القروب:", error);
        await interaction.editReply("⚠️ حدث خطأ أثناء إنشاء القروب. يرجى مراجعة صلاحيات البوت وأذوناته.");
    }
    return;
  }

  // زر تغيير اسم الروم
  if (interaction.isButton() && interaction.customId.startsWith("group_rename_channel_")) {
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
      if (!isGroupAdmin(interaction, group)) return interaction.reply({ content: "🚫 أنت لست مالكاً أو مديراً لهذا القروب لتغيير اسم الروم.", ephemeral: true });

      const modal = new ModalBuilder().setCustomId(`modal_rename_channel_${groupId}`).setTitle(`✏️ تغيير اسم روم في قروب ${group.name}`);
      const channelIdInput = new TextInputBuilder().setCustomId("channel_id").setLabel("آيدي الروم المراد تغيير اسمه").setPlaceholder("أدخل آيدي القناة").setStyle(TextInputStyle.Short).setRequired(true);
      const newChannelNameInput = new TextInputBuilder().setCustomId("new_channel_name").setLabel("الاسم الجديد للروم").setPlaceholder("أدخل الاسم الجديد").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(
          new ActionRowBuilder().addComponents(channelIdInput),
          new ActionRowBuilder().addComponents(newChannelNameInput)
      );
      
      return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_rename_channel_")) {
      await interaction.deferReply({ ephemeral: true });
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.editReply("❌ القروب غير موجود.");
      if (!isGroupAdmin(interaction, group)) return interaction.editReply("🚫 أنت لست مالكاً أو مديراً لهذا القروب لتغيير اسم الروم.");

      const channelId = interaction.fields.getTextInputValue("channel_id").trim();
      const newChannelName = interaction.fields.getTextInputValue("new_channel_name").trim();

      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel) {
          return interaction.editReply("❌ القناة غير موجودة أو الآيدي خاطئ.");
      }

      if (channel.parentId !== group.categoryId) {
          return interaction.editReply("❌ هذه القناة ليست تابعة للقروب.");
      }

      if (channelId === group.settingsChannelId) {
          return interaction.editReply("🚫 لا يمكن تغيير اسم قناة الإعدادات.");
      }

      try {
          const oldName = channel.name;
          await channel.setName(newChannelName, `تغيير اسم الروم بواسطة ${interaction.user.tag}`);
          
          await sendUnifiedLog("✏️ تغيير اسم روم", 
              `تم تغيير اسم القناة في قروب **${group.name}**\n**من:** ${oldName}\n**إلى:** ${newChannelName}\n**بواسطة:** ${interaction.user.tag}`,
              Colors.Blue);
          
          return interaction.editReply(`✅ تم تغيير اسم القناة من **${oldName}** إلى **${newChannelName}** بنجاح.`);

      } catch (error) {
          console.error("❌ فشل تغيير اسم الروم:", error);
          return interaction.editReply("⚠️ حدث خطأ أثناء تغيير اسم الروم. يرجى التحقق من صلاحيات البوت.");
      }
  }

  if (interaction.isButton() && interaction.customId.startsWith("group_add_channels_")) {
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
      if (!isGroupAdmin(interaction, group)) return interaction.reply({ content: "🚫 أنت لست مالكاً أو مديراً لهذا القروب لإضافة قنوات.", ephemeral: true });

      const modal = new ModalBuilder().setCustomId(`modal_add_channels_${groupId}`).setTitle(`➕ إضافة قنوات لقروب ${group.name}`);
      const textChannelsInput = new TextInputBuilder().setCustomId("text_channels_count").setLabel("عدد قنوات الدردشة الكتابية الجديدة").setPlaceholder("مثال: 2").setStyle(TextInputStyle.Short).setRequired(false);
      const voiceChannelsInput = new TextInputBuilder().setCustomId("voice_channels_count").setLabel("عدد قنوات الدردشة الصوتية الجديدة").setPlaceholder("مثال: 1").setStyle(TextInputStyle.Short).setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(textChannelsInput), new ActionRowBuilder().addComponents(voiceChannelsInput));
      
      return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_add_channels_")) {
      await interaction.deferReply({ ephemeral: true });
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.editReply("❌ القروب غير موجود.");
      if (!isGroupAdmin(interaction, group)) return interaction.editReply("🚫 أنت لست مالكاً أو مديراً لهذا القروب لإضافة قنوات.");

      const textChannelsCount = parseInt(interaction.fields.getTextInputValue("text_channels_count")) || 0;
      const voiceChannelsCount = parseInt(interaction.fields.getTextInputValue("voice_channels_count")) || 0;
      if (textChannelsCount <= 0 && voiceChannelsCount <= 0) return interaction.editReply("⚠️ يجب إدخال عدد صحيح موجب للقنوات المراد إضافتها.");

      try {
          const ownerRole = interaction.guild.roles.cache.get(group.ownerRoleId);
          const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);
          const category = interaction.guild.channels.cache.get(group.categoryId);
          if (!ownerRole || !memberRole || !category) return interaction.editReply("❌ تعذر العثور على رتب القروب أو الكاتيجوري. قد يكون القروب غير مكتمل الإعداد.");

          const permissionOverwrites = [
              { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: ownerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
              { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }, 
          ];

          let addedChannels = 0;
          for (let i = 1; i <= textChannelsCount; i++) {
              const channel = await interaction.guild.channels.create({
                  name: `${group.name}-chat-${Date.now().toString(36)}`,
                  type: ChannelType.GuildText,
                  parent: category.id,
                  permissionOverwrites: permissionOverwrites,
              });
              group.channelIds.push(channel.id);
              addedChannels++;
          }

          for (let i = 1; i <= voiceChannelsCount; i++) {
              const channel = await interaction.guild.channels.create({
                  name: `${group.name}-Voice-${Date.now().toString(36)}`,
                  type: ChannelType.GuildVoice,
                  parent: category.id,
                  permissionOverwrites: [
                      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                      { id: ownerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
                      { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
                  ],
              });
              group.channelIds.push(channel.id);
              addedChannels++;
          }

          writeConfig(config);
          await sendUnifiedLog("🛠️ إضافة قنوات للقروب", 
              `تم إضافة **${addedChannels}** قناة جديدة لقروب **${group.name}** بواسطة ${interaction.user.tag}.`,
              Colors.Blue);
          
          await interaction.editReply(`✅ تم إضافة ${addedChannels} قناة جديدة لقروب **${group.name}** بنجاح. (${textChannelsCount} كتابية، ${voiceChannelsCount} صوتية).`);

      } catch (error) {
          console.error("❌ فشل إضافة القنوات:", error);
          await interaction.editReply("⚠️ حدث خطأ أثناء إضافة القنوات. يرجى التحقق من صلاحيات البوت.");
      }
      return;
  }

  if (interaction.isButton() && interaction.customId.startsWith("group_delete_channels_")) {
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
      if (!isGroupAdmin(interaction, group)) return interaction.reply({ content: "🚫 أنت لست مالكاً أو مديراً لهذا القروب لحذف قنوات.", ephemeral: true });

      const modal = new ModalBuilder().setCustomId(`modal_delete_channels_${groupId}`).setTitle(`✂️ حذف قنوات قروب ${group.name}`);
      const channelIdsInput = new TextInputBuilder().setCustomId("channel_ids").setLabel("أدخل آيديات القنوات المراد حذفها").setPlaceholder("آيديات مفصولة بمسافة أو فاصلة (مثال: 123 456, 789)").setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(channelIdsInput));
      
      return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_delete_channels_")) {
      await interaction.deferReply({ ephemeral: true });
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.editReply("❌ القروب غير موجود.");
      if (!isGroupAdmin(interaction, group)) return interaction.editReply("🚫 أنت لست مالكاً أو مديراً لهذا القروب لحذف قنوات.");

      const channelIds = interaction.fields.getTextInputValue("channel_ids").split(/[\s,]+/).filter(id => id.length > 0);
      let deletedCount = 0;
      let notFoundCount = 0;
      const failedDeletions = [];

      for (const channelId of channelIds) {
          if (channelId === group.settingsChannelId) {
              failedDeletions.push(`<#${channelId}> (قناة الإعدادات)`);
              continue;
          }

          const channel = interaction.guild.channels.cache.get(channelId);
          if (!channel) {
              notFoundCount++;
              continue;
          }

          if (channel.parentId !== group.categoryId) {
              failedDeletions.push(`<#${channelId}> (ليست تابعة للقروب)`);
              continue;
          }

          try {
              await channel.delete(`حذف قناة من قروب ${group.name} بواسطة ${interaction.user.tag}`);
              group.channelIds = group.channelIds.filter(id => id !== channelId);
              deletedCount++;
          } catch (error) {
              console.error(`❌ فشل حذف القناة ${channelId}:`, error);
              failedDeletions.push(`<#${channelId}> (فشل الحذف)`);
          }
      }

      writeConfig(config);

      let replyMessage = `✅ تم معالجة طلب حذف القنوات لقروب **${group.name}**.\n`;
      if (deletedCount > 0) replyMessage += `☑️ تم حذف **${deletedCount}** قناة بنجاح.\n`;
      if (notFoundCount > 0) replyMessage += `⚠️ تم تجاهل **${notFoundCount}** آيدي قناة غير موجود.\n`;
      if (failedDeletions.length > 0) replyMessage += `❌ فشل حذف القنوات التالية: ${failedDeletions.join(", ")}\n`;
      
      await sendUnifiedLog("✂️ حذف قنوات من القروب", 
          `قام ${interaction.user.tag} بحذف قنوات من قروب **${group.name}**.\n**المحذوف:** ${deletedCount}\n**الفاشل/المتجاهل:** ${notFoundCount + failedDeletions.length}`,
          deletedCount > 0 ? Colors.Orange : Colors.Red);

      await interaction.editReply(replyMessage);
      return;
  }
  
  if (interaction.isButton() && interaction.customId.startsWith("group_change_name_")) {
    const groupId = interaction.customId.split("_").pop();
    const group = config.groups[groupId];
    if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
    if (!isGroupAdmin(interaction, group)) return interaction.reply({ content: "🚫 أنت لست مالكاً أو مديراً لهذا القروب.", ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`modal_change_name_${groupId}`).setTitle(`📝 تغيير اسم قروب ${group.name}`);
    const newNameInput = new TextInputBuilder().setCustomId("new_name").setLabel("الاسم الجديد للقروب").setPlaceholder("أدخل الاسم الجديد (مثال: TSK New)").setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(newNameInput));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_change_name_")) {
    await interaction.deferReply({ ephemeral: true });
    const groupId = interaction.customId.split("_").pop();
    const group = config.groups[groupId];
    if (!group) return interaction.editReply("❌ القروب غير موجود.");
    if (!isGroupAdmin(interaction, group)) return interaction.editReply("🚫 أنت لست مالكاً أو مديراً لهذا القروب.");

    const newName = interaction.fields.getTextInputValue("new_name").trim();
    if (Object.values(config.groups).some(g => g.name.toLowerCase() === newName.toLowerCase() && g.id !== groupId)) {
      return interaction.editReply("❌ يوجد قروب آخر بهذا الاسم بالفعل.");
    }
    const oldName = group.name;

    try {
      const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);
      const ownerRole = interaction.guild.roles.cache.get(group.ownerRoleId);
      const category = interaction.guild.channels.cache.get(group.categoryId);
      const settingsChannel = interaction.guild.channels.cache.get(group.settingsChannelId);

      if (memberRole) await memberRole.setName(`${newName} | Member`);
      if (ownerRole) await ownerRole.setName(`${newName} | Owner`);
      if (category) await category.setName(newName);
      if (settingsChannel) await settingsChannel.setName(`⚙️-${newName}-settings`);
      
      group.name = newName;
      writeConfig(config);

      await updateSettingsMessage(group, interaction.guild, clientTag);
      
      await sendUnifiedLog("📝 تغيير اسم القروب", 
          `تم تغيير اسم قروب **${oldName}** إلى **${newName}** بواسطة ${interaction.user.tag}.`,
          Colors.Blue);
      
      return interaction.editReply(`✅ تم تغيير اسم القروب من **${oldName}** إلى **${newName}** بنجاح.`);

    } catch (error) {
      console.error("❌ فشل تغيير اسم القروب:", error);
      return interaction.editReply("⚠️ حدث خطأ أثناء تغيير اسم القروب. يرجى التحقق من صلاحيات البوت.");
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith("group_change_color_")) {
    const groupId = interaction.customId.split("_").pop();
    const group = config.groups[groupId];
    if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
    if (!isGroupAdmin(interaction, group)) return interaction.reply({ content: "🚫 أنت لست مالكاً أو مديراً لهذا القروب.", ephemeral: true });

    const modal = new ModalBuilder().setCustomId(`modal_change_color_${groupId}`).setTitle(`🎨 تغيير لون رتب قروب ${group.name}`);
    const newColorInput = new TextInputBuilder().setCustomId("new_color").setLabel("اللون الجديد (Hex Code)").setPlaceholder("أدخل كود اللون السداسي (مثال: #FF0000)").setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(newColorInput));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_change_color_")) {
    await interaction.deferReply({ ephemeral: true });
    const groupId = interaction.customId.split("_").pop();
    const group = config.groups[groupId];
    if (!group) return interaction.editReply("❌ القروب غير موجود.");
    if (!isGroupAdmin(interaction, group)) return interaction.editReply("🚫 أنت لست مالكاً أو مديراً لهذا القروب.");

    const newColor = interaction.fields.getTextInputValue("new_color").trim().toUpperCase();
    if (!/^#([0-9A-F]{3}){1,2}$/i.test(newColor) && !/^[0-9A-F]{6}$/i.test(newColor)) {
      return interaction.editReply("❌ تنسيق اللون غير صحيح. يرجى استخدام كود Hex (مثال: #FF0000).");
    }

    try {
      const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);
      const ownerRole = interaction.guild.roles.cache.get(group.ownerRoleId);
      
      if (memberRole) await memberRole.setColor(newColor);
      if (ownerRole) await ownerRole.setColor(newColor);
      
      await updateSettingsMessage(group, interaction.guild, clientTag);

      await sendUnifiedLog("🎨 تغيير لون رتب القروب", 
          `تم تغيير لون رتب قروب **${group.name}** إلى \`${newColor}\` بواسطة ${interaction.user.tag}.`,
          newColor);

      return interaction.editReply(`✅ تم تغيير لون رتب قروب **${group.name}** إلى \`${newColor}\` بنجاح.`);

    } catch (error) {
      console.error("❌ فشل تغيير لون الرتب:", error);
      return interaction.editReply("⚠️ حدث خطأ أثناء تغيير لون الرتب. يرجى التحقق من صلاحيات البوت.");
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith("group_request_delete_")) {
    const groupId = interaction.customId.split("_").pop();
    const group = config.groups[groupId];
    if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
    if (interaction.user.id !== group.ownerId) return interaction.reply({ content: "🚫 فقط مالك القروب يمكنه طلب الحذف.", ephemeral: true });

    await interaction.deferUpdate();
    const embed = interaction.message.embeds[0];
    const newEmbed = new EmbedBuilder(embed).setDescription(embed.description + "\n\n⚠️ **تأكيد الحذف النهائي:** هذا الإجراء لا يمكن التراجع عنه وسيحذف جميع قنوات ورتب القروب. اضغط على الزر أدناه للتأكيد النهائي.");
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`group_confirm_delete_${groupId}`).setLabel("🔥 تأكيد حذف القروب نهائياً").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`group_cancel_delete_${groupId}`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Secondary),
    );

    await interaction.message.edit({ embeds: [newEmbed], components: [row] });
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith("group_cancel_delete_")) {
    const groupId = interaction.customId.split("_").pop();
    const group = config.groups[groupId];
    if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
    if (interaction.user.id !== group.ownerId) return interaction.reply({ content: "🚫 لا يمكنك إلغاء طلب حذف لا تملكه.", ephemeral: true });

    await interaction.deferUpdate();
    await updateSettingsMessage(group, interaction.guild, clientTag);
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith("group_confirm_delete_")) {
    const groupId = interaction.customId.split("_").pop();
    const group = config.groups[groupId];
    if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
    if (interaction.user.id !== group.ownerId) return interaction.reply({ content: "🚫 أنت لست مالك القروب لتأكيد الحذف النهائي.", ephemeral: true });

    await interaction.deferUpdate();

    try {
        const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);
        const ownerRole = interaction.guild.roles.cache.get(group.ownerRoleId);
        const category = interaction.guild.channels.cache.get(group.categoryId);
        
        const channelsToDelete = [...group.channelIds, group.settingsChannelId].map(id => interaction.guild.channels.cache.get(id)).filter(c => c);

        for (const channel of channelsToDelete) {
            await channel.delete(`حذف قروب ${group.name} بطلب من المالك`).catch(err => console.error("خطأ في حذف القناة:", err));
        }
        if (category) await category.delete(`حذف قروب ${group.name} بطلب من المالك`).catch(err => console.error("خطأ في حذف الكاتيجوري:", err));
        if (memberRole) await memberRole.delete(`حذف قروب ${group.name} بطلب من المالك`).catch(err => console.error("خطأ في حذف رتبة الأعضاء:", err));
        if (ownerRole) await ownerRole.delete(`حذف قروب ${group.name} بطلب من المالك`).catch(err => console.error("خطأ في حذف رتبة المالك:", err));
        
        delete config.groups[groupId];
        writeConfig(config);

        await sendUnifiedLog("🗑️ حذف قروب (من المالك)", 
            `تم حذف قروب **${group.name}** بالكامل بطلب من المالك **${interaction.user.tag}**.\n**المالك:** <@${group.ownerId}>`,
            Colors.DarkRed);

        const deleteEmbed = new EmbedBuilder().setTitle("✅ تم حذف القروب نهائياً").setDescription(`تم حذف قروب **${group.name}** وكل ما يتعلق به بنجاح.`).setColor(Colors.Green);
        await interaction.message.edit({ embeds: [deleteEmbed], components: [] });

    } catch (error) {
        console.error("❌ فشل حذف القروب بطلب من المالك:", error);
        const errorEmbed = new EmbedBuilder().setTitle("⚠️ حدث خطأ").setDescription("حدث خطأ أثناء حذف القروب. يرجى مراجعة الصلاحيات.").setColor(Colors.Red);
        await interaction.message.edit({ embeds: [errorEmbed], components: [] }).catch(() => {});
    }
    return;
  }

  if (interaction.isButton() && interaction.customId === "delete_group_menu") {
      const groupManagerRoleId = process.env.ROLE_GROUP_MANAGER_ID;
      if (!interaction.member.roles.cache.has(groupManagerRoleId)) {
          return interaction.reply({ content: "🚫 ليس لديك الصلاحية لحذف القروبات.", ephemeral: true });
      }

      const groupOptions = Object.entries(config.groups).map(([id, group]) => ({
          label: group.name,
          description: `المالك: ${group.ownerId}`,
          value: id,
      }));

      if (groupOptions.length === 0) {
          return interaction.reply({ content: "😔 لا توجد قروبات نشطة لحذفها.", ephemeral: true });
      }
      
      const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("admin_select_group_to_delete")
          .setPlaceholder("اختر القروب الذي تريد حذفه إدارياً...")
          .addOptions(groupOptions);
      
      const row1 = new ActionRowBuilder().addComponents(selectMenu);
      const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("admin_delete_all_groups").setLabel("🔥 حذف كل القروبات").setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ content: "الرجاء اختيار القروب المراد حذفه إدارياً أو اختيار حذف الكل:", components: [row1, row2], ephemeral: true });
      return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "admin_select_group_to_delete") {
      await interaction.deferUpdate();
      const groupId = interaction.values[0];
      const group = config.groups[groupId];
      
      if (!group) return interaction.followUp({ content: "❌ هذا القروب غير موجود.", ephemeral: true });

      const embed = new EmbedBuilder()
          .setTitle(`⚠️ تأكيد الحذف الإداري لقروب ${group.name}`)
          .setDescription(`**هل أنت متأكد من حذف قروب **${group.name}**؟**\nهذا الإجراء سيحذف جميع القنوات والرتب المرتبطة به.`)
          .setColor(Colors.Red)
          .setTimestamp();
      
      const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`admin_confirm_delete_${groupId}`).setLabel("✅ تأكيد الحذف").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`admin_cancel_operation`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Secondary)
      );

      await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
      return;
  }

  if (interaction.isButton() && interaction.customId.startsWith("admin_confirm_delete_")) {
      await interaction.deferUpdate();
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      
      if (!group) return interaction.editReply({ content: "❌ هذا القروب غير موجود.", components: [] });

      try {
        const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);
        const ownerRole = interaction.guild.roles.cache.get(group.ownerRoleId);
        const category = interaction.guild.channels.cache.get(group.categoryId);
        
        const channelsToDelete = [...group.channelIds, group.settingsChannelId].map(id => interaction.guild.channels.cache.get(id)).filter(c => c);

        for (const channel of channelsToDelete) {
            await channel.delete(`حذف قروب ${group.name} بقرار إداري من ${interaction.user.tag}`).catch(err => console.error("خطأ حذف القناة:", err));
        }
        if (category) await category.delete(`حذف قروب ${group.name} بقرار إداري من ${interaction.user.tag}`).catch(err => console.error("خطأ حذف الكاتيجوري:", err));
        if (memberRole) await memberRole.delete(`حذف قروب ${group.name} بقرار إداري من ${interaction.user.tag}`).catch(err => console.error("خطأ حذف رتبة الأعضاء:", err));
        if (ownerRole) await ownerRole.delete(`حذف قروب ${group.name} بقرار إداري من ${interaction.user.tag}`).catch(err => console.error("خطأ حذف رتبة المالك:", err));

        delete config.groups[groupId];
        writeConfig(config);
        
        const owner = await clientTag.users.fetch(group.ownerId).catch(() => null);
        if (owner) {
            const embed = new EmbedBuilder().setTitle("🗑️ تم حذف القروب").setDescription(`تم حذف قروب **${group.name}** الذي تملكه بقرار إداري من **${interaction.user.tag}**.`).setColor(Colors.Red);
            await owner.send({ embeds: [embed] }).catch(() => console.error(`❌ فشل إرسال إشعار الحذف للمالك`));
        }

        const logEmbed = new EmbedBuilder()
            .setTitle(`✅ تم الحذف النهائي لقروب ${group.name}`)
            .setDescription(`تم حذف القروب بالكامل بنجاح.\n**المالك الأصلي:** <@${group.ownerId}>\n**المنفذ (الإدارة):** ${interaction.user.tag}`)
            .setColor(Colors.DarkRed);
        
        await interaction.message.edit({ embeds: [logEmbed], components: [] });

    } catch (error) {
        console.error("❌ فشل حذف القروب بقرار إداري:", error);
        const errorEmbed = new EmbedBuilder().setTitle("⚠️ خطأ").setDescription("حدث خطأ أثناء حذف القروب.").setColor(Colors.Red);
        await interaction.message.edit({ embeds: [errorEmbed], components: [] }).catch(() => {});
    }
    return;
  }

  if (interaction.isButton() && interaction.customId === "admin_delete_all_groups") {
      const groupManagerRoleId = process.env.ROLE_GROUP_MANAGER_ID;
      if (!interaction.member.roles.cache.has(groupManagerRoleId)) {
          return interaction.reply({ content: "🚫 ليس لديك الصلاحية لحذف القروبات.", ephemeral: true });
      }

      await interaction.deferUpdate();

      const groupIds = Object.keys(config.groups);
      if (groupIds.length === 0) {
          return interaction.followUp({ content: "😔 لا توجد قروبات نشطة لحذفها.", ephemeral: true });
      }
      
      const embed = new EmbedBuilder()
          .setTitle(`⚠️ تأكيد الحذف الإداري لجميع القروبات (${groupIds.length})`)
          .setDescription(`**هل أنت متأكد من حذف **كل** القروبات؟**\nهذا الإجراء لا يمكن التراجع عنه وسيحذف جميع القنوات والرتب المرتبطة بها.`)
          .setColor(Colors.Red)
          .setTimestamp();
      
      const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`admin_confirm_delete_all`).setLabel("🔥🔥 تأكيد حذف كل القروبات").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`admin_cancel_operation`).setLabel("❌ إلغاء").setStyle(ButtonStyle.Secondary)
      );

      await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
      return;
  }

  if (interaction.isButton() && interaction.customId === "admin_confirm_delete_all") {
    await interaction.deferUpdate();
    const groupIds = Object.keys(config.groups);
    let deletedCount = 0;
    
    for (const groupId of groupIds) {
        const group = config.groups[groupId];
        if (!group) continue;
        
        try {
            const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);
            const ownerRole = interaction.guild.roles.cache.get(group.ownerRoleId);
            const category = interaction.guild.channels.cache.get(group.categoryId);
            
            const channelsToDelete = [...group.channelIds, group.settingsChannelId].map(id => interaction.guild.channels.cache.get(id)).filter(c => c);

            for (const channel of channelsToDelete) {
                await channel.delete(`حذف قروب ${group.name} بقرار إداري جماعي`).catch(err => console.error("خطأ حذف القناة:", err));
            }
            if (category) await category.delete(`حذف قروب ${group.name} بقرار إداري جماعي`).catch(err => console.error("خطأ حذف الكاتيجوري:", err));
            if (memberRole) await memberRole.delete(`حذف قروب ${group.name} بقرار إداري جماعي`).catch(err => console.error("خطأ حذف رتبة الأعضاء:", err));
            if (ownerRole) await ownerRole.delete(`حذف قروب ${group.name} بقرار إداري جماعي`).catch(err => console.error("خطأ حذف رتبة المالك:", err));

            const owner = await clientTag.users.fetch(group.ownerId).catch(() => null);
            if (owner) {
                const embed = new EmbedBuilder().setTitle("🗑️ تم حذف القروب").setDescription(`تم حذف قروب **${group.name}** الذي تملكه بقرار إداري جماعي من **${interaction.user.tag}**.`).setColor(Colors.Red);
                await owner.send({ embeds: [embed] }).catch(() => console.error(`❌ فشل إرسال إشعار الحذف للمالك`));
            }
            
            delete config.groups[groupId];
            deletedCount++;

        } catch (error) {
            console.error(`❌ فشل حذف القروب الإداري الجماعي ${group.name}:`, error);
        }
    }

    writeConfig(config);

    const logEmbed = new EmbedBuilder()
        .setTitle(`✅ تم الحذف النهائي لجميع القروبات`)
        .setDescription(`تم حذف **${deletedCount}** قروب بالكامل بنجاح.\n**المنفذ (الإدارة):** ${interaction.user.tag}`)
        .setColor(Colors.DarkRed);
    
    await interaction.message.edit({ embeds: [logEmbed], components: [] });

    await interaction.followUp({ content: `✅ تم حذف **${deletedCount}** قروب بالكامل بنجاح.`, ephemeral: true });

    return;
  }

  if (interaction.isButton() && interaction.customId === "view_active_groups") {
      await interaction.deferReply({ ephemeral: true });
      const groupData = config.groups;
      if (Object.keys(groupData).length === 0) {
          return interaction.editReply("😔 لا توجد قروبات نشطة حالياً.");
      }

      const infoEmbed = new EmbedBuilder()
          .setTitle("📊 معلومات القروبات النشطة")
          .setColor(Colors.Purple);
      
      for (const [id, group] of Object.entries(groupData)) {
          const guild = interaction.guild;
          const owner = await guild.members.fetch(group.ownerId).catch(() => null);
          const memberRole = guild.roles.cache.get(group.memberRoleId);
          const category = guild.channels.cache.get(group.categoryId);

          let membersCount = 0;
          let channelsCount = group.channelIds.length + 1;
          if (memberRole) {
              await guild.members.fetch();
              membersCount = memberRole.members.size;
          }

          infoEmbed.addFields({
              name: `🏷️ ${group.name} (ID: ${id.substring(0, 4)})`,
              value: `**👥 الأعضاء:** ${membersCount}\n**👑 المالك:** ${owner ? owner.toString() : "غير متوفر"}\n**#️⃣ القنوات:** ${channelsCount}\n**🔗 الكاتيجوري:** ${category ? category.toString() : "غير متوفر"}`,
              inline: false
          });
      }

      await interaction.editReply({ embeds: [infoEmbed] });
      return;
  }

  if (interaction.isButton() && interaction.customId === "admin_cancel_operation") {
      await interaction.update({ content: "✅ تم إلغاء العملية.", components: [], embeds: [] });
  }

  // معالجة الأزرار الأخرى (إضافة/إزالة أعضاء ومدراء)
  if (interaction.isButton() && interaction.customId.startsWith("group_add_member_")) {
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
      if (!isGroupAdmin(interaction, group)) return interaction.reply({ content: "🚫 أنت لست مالكاً أو مديراً لهذا القروب.", ephemeral: true });

      const modal = new ModalBuilder().setCustomId(`modal_add_member_${groupId}`).setTitle(`➕ إضافة عضو لقروب ${group.name}`);
      const memberIdInput = new TextInputBuilder().setCustomId("member_id").setLabel("آيدي العضو المراد إضافته").setPlaceholder("أدخل آيدي العضو").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(memberIdInput));
      return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_add_member_")) {
      await interaction.deferReply({ ephemeral: true });
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.editReply("❌ القروب غير موجود.");
      if (!isGroupAdmin(interaction, group)) return interaction.editReply("🚫 أنت لست مالكاً أو مديراً لهذا القروب.");

      const memberId = interaction.fields.getTextInputValue("member_id").trim();
      const targetMember = await interaction.guild.members.fetch(memberId).catch(() => null);
      
      if (!targetMember) return interaction.editReply("❌ لم يتم العثور على العضو بهذا الآيدي.");
      
      const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);
      if (!memberRole) return interaction.editReply("❌ رتبة القروب غير موجودة.");

      if (targetMember.roles.cache.has(memberRole.id)) {
          return interaction.editReply("⚠️ هذا العضو بالفعل في القروب.");
      }

      try {
          await targetMember.roles.add(memberRole, `إضافة عضو بواسطة ${interaction.user.tag}`);
          await updateSettingsMessage(group, interaction.guild, clientTag);
          await sendUnifiedLog("➕ إضافة عضو للقروب", `تم إضافة ${targetMember.user.tag} لقروب **${group.name}** بواسطة ${interaction.user.tag}.`, Colors.Green);
          return interaction.editReply(`✅ تم إضافة ${targetMember.toString()} للقروب بنجاح.`);
      } catch (error) {
          console.error("❌ فشل إضافة العضو:", error);
          return interaction.editReply("⚠️ حدث خطأ أثناء إضافة العضو.");
      }
  }

  if (interaction.isButton() && interaction.customId.startsWith("group_remove_member_")) {
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
      if (!isGroupAdmin(interaction, group)) return interaction.reply({ content: "🚫 أنت لست مالكاً أو مديراً لهذا القروب.", ephemeral: true });

      const modal = new ModalBuilder().setCustomId(`modal_remove_member_${groupId}`).setTitle(`➖ إزالة عضو من قروب ${group.name}`);
      const memberIdInput = new TextInputBuilder().setCustomId("member_id").setLabel("آيدي العضو المراد إزالته").setPlaceholder("أدخل آيدي العضو").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(memberIdInput));
      return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_remove_member_")) {
      await interaction.deferReply({ ephemeral: true });
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.editReply("❌ القروب غير موجود.");
      if (!isGroupAdmin(interaction, group)) return interaction.editReply("🚫 أنت لست مالكاً أو مديراً لهذا القروب.");

      const memberId = interaction.fields.getTextInputValue("member_id").trim();
      const targetMember = await interaction.guild.members.fetch(memberId).catch(() => null);
      
      if (!targetMember) return interaction.editReply("❌ لم يتم العثور على العضو بهذا الآيدي.");
      
      if (memberId === group.ownerId) return interaction.editReply("🚫 لا يمكن إزالة المالك.");

      const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);
      const ownerRole = interaction.guild.roles.cache.get(group.ownerRoleId);

      try {
          if (ownerRole && targetMember.roles.cache.has(ownerRole.id)) {
              await targetMember.roles.remove(ownerRole);
              group.managerIds = group.managerIds.filter(id => id !== memberId);
              writeConfig(config);
          }
          
          await targetMember.roles.remove(memberRole, `إزالة عضو بواسطة ${interaction.user.tag}`);
          await updateSettingsMessage(group, interaction.guild, clientTag);
          await sendUnifiedLog("➖ إزالة عضو من القروب", `تم إزالة ${targetMember.user.tag} من قروب **${group.name}** بواسطة ${interaction.user.tag}.`, Colors.Orange);
          return interaction.editReply(`✅ تم إزالة ${targetMember.toString()} من القروب بنجاح.`);
      } catch (error) {
          console.error("❌ فشل إزالة العضو:", error);
          return interaction.editReply("⚠️ حدث خطأ أثناء إزالة العضو.");
      }
  }

  if (interaction.isButton() && interaction.customId.startsWith("group_add_manager_")) {
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.reply({ content: "❌ هذا القروب غير موجود.", ephemeral: true });
      if (interaction.user.id !== group.ownerId) return interaction.reply({ content: "🚫 فقط المالك يمكنه إضافة مدراء.", ephemeral: true });

      const modal = new ModalBuilder().setCustomId(`modal_add_manager_${groupId}`).setTitle(`🛡️ إضافة مدير لقروب ${group.name}`);
      const managerIdInput = new TextInputBuilder().setCustomId("manager_id").setLabel("آيدي المدير المراد إضافته").setPlaceholder("أدخل آيدي العضو").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(managerIdInput));
      return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_add_manager_")) {
      await interaction.deferReply({ ephemeral: true });
      const groupId = interaction.customId.split("_").pop();
      const group = config.groups[groupId];
      if (!group) return interaction.editReply("❌ القروب غير موجود.");
      if (interaction.user.id !== group.ownerId) return interaction.editReply("🚫 فقط المالك يمكنه إضافة مدراء.");

      const managerId = interaction.fields.getTextInputValue("manager_id").trim();
      const targetMember = await interaction.guild.members.fetch(managerId).catch(() => null);
      
      if (!targetMember) return interaction.editReply("❌ لم يتم العثور على العضو بهذا الآيدي.");
      
      const memberRole = interaction.guild.roles.cache.get(group.memberRoleId);
      const ownerRole = interaction.guild.roles.cache.get(group.ownerRoleId);

      if (group.managerIds.includes(managerId)) {
          return interaction.editReply("⚠️ هذا العضو مدير بالفعل.");
      }

      try {
          if (!targetMember.roles.cache.has(memberRole.id)) {
              await targetMember.roles.add(memberRole);
          }
          await targetMember.roles.add(ownerRole, `إضافة كمدير بواسطة ${interaction.user.tag}`);
          group.managerIds.push(managerId);
          writeConfig(config);
          await updateSettingsMessage(group, interaction.guild, clientTag);
          await sendUnifiedLog("🛡️ إضافة مدير للقروب", `تم إضافة ${targetMember.user.tag} كمدير لقروب **${group.name}** بواسطة ${interaction.user.tag}.`, Colors.Blue);
          return interaction.editReply(`✅ تم إضافة ${targetMember.toString()} كمدير للقروب بنجاح.`);
      } catch (error) {
          console.error("❌ فشل إضافة المدير:", error);
          return interaction.editReply("⚠️ حدث خطأ أثناء إضافة المدير.");
      }
  }
});

// ================================================================================
// 📚 نظام طلبات الشرح (Explanation Requests) - نسخة معدلة ومطورة
// ================================================================================

// متغير لتخزين طلبات الشرح المؤقتة
const explanationRequests = new Map();

// دالة للتحقق من الرابط (إذا كان المستخدم يريد إضافة رابط)
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// دالة لإرسال اللوقات
async function sendExplanationLog(title, description, color, fields = []) {
    if (!logWebhook) {
        console.log(`📋 [Explanation Log] ${title}: ${description}`);
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
    
    if (fields.length > 0) embed.addFields(fields);
    
    try {
        await logWebhook.send({ embeds: [embed] });
    } catch (e) {
        console.error("❌ فشل إرسال لوق الشرح:", e);
    }
}

// دالة لاستخراج المرفقات من المحتوى
function extractAttachments(content) {
    const attachments = [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = content.match(urlRegex);
    
    if (matches) {
        matches.forEach(url => {
            if (isValidUrl(url)) {
                // تصنيف المرفقات حسب النوع
                if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                    attachments.push({ type: 'image', url });
                } else if (url.match(/\.(mp4|avi|mov|wmv|flv|webm)$/i)) {
                    attachments.push({ type: 'video', url });
                } else if (url.match(/\.(mp3|wav|ogg|flac)$/i)) {
                    attachments.push({ type: 'audio', url });
                } else if (url.match(/\.(pdf|doc|docx|txt)$/i)) {
                    attachments.push({ type: 'document', url });
                } else {
                    attachments.push({ type: 'link', url });
                }
            }
        });
    }
    
    return attachments;
}

// دالة لإنشاء روم شرح جديد
async function createExplanationRoom(interaction, categoryId, roomName, messageContent, originalRequester) {
    try {
        const guild = interaction.guild;
        const category = guild.channels.cache.get(categoryId);
        
        if (!category) {
            throw new Error('الكاتجوري غير موجود');
        }

        // الحصول على الرول المحدد من .env
        const explanationRoleId = process.env.EXPLANATION_ROLE_ID;
        let permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: originalRequester.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            }
        ];

        // إضافة الرول إذا كان موجوداً
        if (explanationRoleId) {
            permissionOverwrites.push({
                id: explanationRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            });
        }

        // إنشاء الروم الكتابي
        const textChannel = await guild.channels.create({
            name: roomName,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: permissionOverwrites,
            topic: `روم شرح مقدم من: ${originalRequester.tag} | ${new Date().toLocaleDateString('ar-SA')}`
        });

        // استخراج المرفقات من المحتوى
        const attachments = extractAttachments(messageContent);
        let contentWithoutUrls = messageContent;
        
        // إزالة الروابط من النص الأصلي
        attachments.forEach(attachment => {
            contentWithoutUrls = contentWithoutUrls.replace(attachment.url, '');
        });

        // إنشاء إمبد أساسي للشرح
        const explanationEmbed = new EmbedBuilder()
            .setTitle(`📚 شرح: ${roomName}`)
            .setDescription(contentWithoutUrls.trim() || 'لا يوجد نص إضافي')
            .setColor(Colors.Green)
            .setFooter({ 
                text: `الشرح تم تقديمه بواسطة ${originalRequester.tag}`,
                iconURL: originalRequester.displayAvatarURL() 
            })
            .setTimestamp();

        const messageParts = [];
        
        // إضافة المرفقات كروابط مباشرة في الرسالة
        attachments.forEach((attachment, index) => {
            let attachmentType = '';
            switch(attachment.type) {
                case 'image':
                    attachmentType = '🖼️ صورة';
                    break;
                case 'video':
                    attachmentType = '🎬 فيديو';
                    break;
                case 'audio':
                    attachmentType = '🎵 صوت';
                    break;
                case 'document':
                    attachmentType = '📄 ملف';
                    break;
                default:
                    attachmentType = '🔗 رابط';
            }
            messageParts.push(`${attachmentType}: ${attachment.url}`);
        });

        // إرسال الرسالة الأساسية
        await textChannel.send({ 
            content: `بواسطة: ${originalRequester}\n${messageParts.join('\n')}`,
            embeds: [explanationEmbed] 
        });

        // إرسال المرفقات بشكل منفصل إذا كانت هناك صور أو فيديوهات
        for (const attachment of attachments) {
            if (attachment.type === 'image' || attachment.type === 'video') {
                try {
                    const attachmentEmbed = new EmbedBuilder()
                        .setTitle(attachment.type === 'image' ? '🖼️ صورة مرفقة' : '🎬 فيديو مرفق')
                        .setColor(Colors.Blue)
                        .setImage(attachment.type === 'image' ? attachment.url : null)
                        .setURL(attachment.url)
                        .setTimestamp();

                    await textChannel.send({ 
                        content: attachment.type === 'video' ? `**فيديو مرفق:**\n${attachment.url}` : null,
                        embeds: attachment.type === 'image' ? [attachmentEmbed] : []
                    });
                } catch (error) {
                    console.error(`❌ خطأ في إرسال المرفق:`, error);
                    await textChannel.send(`🔗 ${attachment.url}`);
                }
            }
        }

        // منح الرول للمستخدم إذا كان موجوداً
        if (explanationRoleId) {
            try {
                const member = await guild.members.fetch(originalRequester.id);
                const role = guild.roles.cache.get(explanationRoleId);
                if (role && !member.roles.cache.has(explanationRoleId)) {
                    await member.roles.add(role, `تقديم شرح: ${roomName}`);
                    
                    await sendExplanationLog(
                        "🎖️ منح رول المساهم",
                        `تم منح رول المساهم لـ **${originalRequester.tag}** لتقديمه شرح **${roomName}**`,
                        Colors.Gold,
                        [
                            { name: '👤 المستخدم', value: `${originalRequester.tag} (<@${originalRequester.id}>)`, inline: true },
                            { name: '📝 الشرح', value: roomName, inline: true },
                            { name: '🎖️ الرول', value: `<@&${explanationRoleId}>`, inline: true }
                        ]
                    );
                }
            } catch (roleError) {
                console.error('❌ خطأ في منح الرول:', roleError);
                await sendExplanationLog(
                    "⚠️ خطأ في منح الرول",
                    `فشل منح رول المساهم لـ **${originalRequester.tag}**`,
                    Colors.Red,
                    [
                        { name: '👤 المستخدم', value: `${originalRequester.tag}`, inline: true },
                        { name: '📝 السبب', value: roleError.message, inline: true }
                    ]
                );
            }
        }

        return textChannel;
    } catch (error) {
        console.error('❌ خطأ في إنشاء روم الشرح:', error);
        throw error;
    }
}

// معالجة أمر !Srh
clientTag.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === '!Srh' || message.content === '!srh') {
        await sendExplanationLog(
            "📚 تشغيل نظام الشرح",
            `تم تشغيل أمر الشرح بواسطة ${message.author.tag}`,
            Colors.Blue,
            [
                { name: '👤 المستخدم', value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
                { name: '📌 القناة', value: `<#${message.channel.id}>`, inline: true }
            ]
        );

        const embed = new EmbedBuilder()
            .setTitle('📚 نظام طلبات الشرح')
            .setDescription('مرحباً! يمكنك تقديم طلب شرح عبر هذا النظام. اضغط على الزر لبدء طلب جديد:')
            .setColor(Colors.Blue)
            .addFields(
                {
                    name: '📝 كيفية العمل',
                    value: 'سيطلب منك إدخال:\n• آيدي الكاتجوري\n• اسم الروم الجديد\n• محتوى الشرح (يمكن إضافة روابط، صور، ملفات)'
                },
                {
                    name: '⚡ العملية',
                    value: 'سيتم مراجعة طلبك وإنشاء الروم تلقائياً بعد القبول'
                },
                {
                    name: '🎁 مكافأة',
                    value: process.env.EXPLANATION_ROLE_ID ? 
                        `سيتم منحك رول <@&${process.env.EXPLANATION_ROLE_ID}> بعد نشر الشرح! 🎖️` : 
                        'تقدير للمساهمين في الشرح 🌟'
                }
            )
            .setFooter({ text: 'سيتم إنشاء روم شرح جديد بعد الموافقة على طلبك' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_explanation_request')
                .setLabel('📝 بدء طلب شرح')
                .setStyle(ButtonStyle.Primary)
        );

        await message.reply({ embeds: [embed], components: [row] });
    }
});

// معالجة تفاعلات نظام الشرح
clientTag.on(Events.InteractionCreate, async (interaction) => {
    // معالجة زر بدء طلب الشرح
    if (interaction.isButton() && interaction.customId === 'start_explanation_request') {
        await sendExplanationLog(
            "📝 بدء طلب شرح جديد",
            `بدأ ${interaction.user.tag} عملية تقديم طلب شرح`,
            Colors.Blue,
            [
                { name: '👤 المستخدم', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true }
            ]
        );

        const modal = new ModalBuilder()
            .setCustomId('modal_explanation_request')
            .setTitle('📝 تقديم طلب شرح جديد');

        // حقل آيدي الكاتجوري
        const categoryInput = new TextInputBuilder()
            .setCustomId('category_id')
            .setLabel('آيدي الكاتجوري')
            .setPlaceholder('123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(categoryInput));

        // حقل اسم الروم
        const roomNameInput = new TextInputBuilder()
            .setCustomId('room_name')
            .setLabel('اسم الروم الجديد')
            .setPlaceholder('شرح-البرمجة-المتقدمة')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(roomNameInput));

        // حقل محتوى الشرح
        const contentInput = new TextInputBuilder()
            .setCustomId('explanation_content')
            .setLabel('محتوى الشرح')
            .setPlaceholder('اكتب هنا الشرح الكامل... يمكنك إضافة روابط، صور، ملفات، إلخ.')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(contentInput));

        await interaction.showModal(modal);
        return;
    }

    // معالجة تقديم النموذج
    if (interaction.isModalSubmit() && interaction.customId === 'modal_explanation_request') {
        await interaction.deferReply({ ephemeral: true });
        
        let categoryId = '';
        let roomName = '';
        let explanationContent = '';

        try {
            // استخراج البيانات من النموذج
            categoryId = interaction.fields.getTextInputValue('category_id');
            roomName = interaction.fields.getTextInputValue('room_name');
            explanationContent = interaction.fields.getTextInputValue('explanation_content');

            // التحقق من وجود الكاتجوري
            const category = interaction.guild.channels.cache.get(categoryId);
            if (!category || category.type !== ChannelType.GuildCategory) {
                await sendExplanationLog(
                    "❌ طلب شرح مرفوض - كاتجوري غير صحيح",
                    `قدم ${interaction.user.tag} طلب شرح بكاتجوري غير صحيح`,
                    Colors.Red,
                    [
                        { name: '👤 المستخدم', value: `${interaction.user.tag}`, inline: true },
                        { name: '📝 آيدي الكاتجوري', value: categoryId, inline: true }
                    ]
                );
                return await interaction.editReply('❌ آيدي الكاتجوري غير صحيح أو الكاتجوري غير موجود!');
            }

            // حفظ طلب الشرح مؤقتاً
            const requestId = Date.now().toString();
            explanationRequests.set(requestId, {
                categoryId: categoryId,
                roomName: roomName,
                content: explanationContent,
                requester: interaction.user,
                timestamp: Date.now()
            });

            // إرسال طلب المراجعة إلى الروم المحدد في .env
            const reviewChannelId = process.env.EXPLANATION_REVIEW_CHANNEL_ID;
            if (!reviewChannelId) {
                await sendExplanationLog(
                    "❌ خطأ في إعدادات النظام",
                    `قناة المراجعة غير محددة في الإعدادات`,
                    Colors.Red,
                    [
                        { name: '👤 المستخدم', value: `${interaction.user.tag}`, inline: true }
                    ]
                );
                return await interaction.editReply('❌ لم يتم تحديد قناة المراجعة في الإعدادات. يرجى التواصل مع المسؤول.');
            }

            const reviewChannel = interaction.guild.channels.cache.get(reviewChannelId);
            if (!reviewChannel) {
                await sendExplanationLog(
                    "❌ خطأ في إعدادات النظام",
                    `قناة المراجعة غير موجودة في السيرفر`,
                    Colors.Red,
                    [
                        { name: '👤 المستخدم', value: `${interaction.user.tag}`, inline: true },
                        { name: '📝 آيدي القناة', value: reviewChannelId, inline: true }
                    ]
                );
                return await interaction.editReply('❌ قناة المراجعة غير موجودة. يرجى التواصل مع المسؤول.');
            }

            // استخراج المرفقات للعرض
            const attachments = extractAttachments(explanationContent);
            let displayContent = explanationContent;
            let attachmentsInfo = 'لا توجد مرفقات';
            
            if (attachments.length > 0) {
                attachmentsInfo = attachments.map(att => {
                    const types = {
                        'image': '🖼️ صورة',
                        'video': '🎬 فيديو', 
                        'audio': '🎵 صوت',
                        'document': '📄 ملف',
                        'link': '🔗 رابط'
                    };
                    return `${types[att.type]}: ${att.url}`;
                }).join('\n');
                
                // تقصير المحتوى المعروض
                displayContent = explanationContent.length > 800 ? 
                    explanationContent.substring(0, 800) + '...' : 
                    explanationContent;
            }

            // إنشاء embed لطلب المراجعة
            const reviewEmbed = new EmbedBuilder()
                .setTitle('📚 طلب شرح جديد')
                .setColor(Colors.Yellow)
                .addFields(
                    {
                        name: '👤 مقدم الطلب',
                        value: `${interaction.user.tag} (${interaction.user.id})`,
                        inline: true
                    },
                    {
                        name: '📂 الكاتجوري',
                        value: `📁 ${category.name} (\`${categoryId}\`)`,
                        inline: true
                    },
                    {
                        name: '📝 اسم الروم المقترح',
                        value: roomName,
                        inline: true
                    },
                    {
                        name: '📎 المرفقات',
                        value: attachmentsInfo,
                        inline: false
                    }
                )
                .addFields({
                    name: '📄 محتوى الشرح',
                    value: displayContent,
                    inline: false
                })
                .setTimestamp();

            // أزرار القبول والرفض
            const reviewButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`explanation_approve_${requestId}`)
                    .setLabel('✅ قبول')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`explanation_reject_${requestId}`)
                    .setLabel('❌ رفض')
                    .setStyle(ButtonStyle.Danger)
            );

            await reviewChannel.send({ 
                embeds: [reviewEmbed], 
                components: [reviewButtons] 
            });

            await sendExplanationLog(
                "📨 طلب شرح مرسل للمراجعة",
                `تم إرسال طلب شرح من ${interaction.user.tag} للمراجعة`,
                Colors.Yellow,
                [
                    { name: '👤 المستخدم', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 اسم الروم', value: roomName, inline: true },
                    { name: '📂 الكاتجوري', value: category.name, inline: true }
                ]
            );

            await interaction.editReply('✅ تم إرسال طلب الشرح بنجاح! سيتم مراجعته من قبل الفريق المختص وسيتم إعلامك بالقرار.');

        } catch (error) {
            console.error('❌ خطأ في معالجة طلب الشرح:', error);
            await sendExplanationLog(
                "❌ خطأ في معالجة طلب الشرح",
                `حدث خطأ أثناء معالجة طلب شرح من ${interaction.user.tag}`,
                Colors.Red,
                [
                    { name: '👤 المستخدم', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 الخطأ', value: error.message, inline: true }
                ]
            );
            await interaction.editReply('❌ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.');
        }
        return;
    }

    // معالجة قبول طلب الشرح
    if (interaction.isButton() && interaction.customId.startsWith('explanation_approve_')) {
        await interaction.deferReply({ ephemeral: true });
        
        const requestId = interaction.customId.replace('explanation_approve_', '');
        const request = explanationRequests.get(requestId);
        
        if (!request) {
            await sendExplanationLog(
                "❌ طلب شرح غير موجود",
                `حاول ${interaction.user.tag} قبول طلب شرح غير موجود`,
                Colors.Red,
                [
                    { name: '👤 المعالج', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 آيدي الطلب', value: requestId, inline: true }
                ]
            );
            return await interaction.editReply('❌ طلب الشرح غير موجود أو انتهت صلاحيته.');
        }

        try {
            // إنشاء الروم مباشرة
            const category = interaction.guild.channels.cache.get(request.categoryId);
            if (!category) {
                await sendExplanationLog(
                    "❌ خطأ في قبول الطلب - كاتجوري غير موجود",
                    `حاول ${interaction.user.tag} قبول طلب شرح بكاتجوري غير موجود`,
                    Colors.Red,
                    [
                        { name: '👤 المعالج', value: `${interaction.user.tag}`, inline: true },
                        { name: '👤 مقدم الطلب', value: `${request.requester.tag}`, inline: true }
                    ]
                );
                return await interaction.editReply('❌ الكاتجوري لم يعد موجوداً!');
            }

            const createdChannel = await createExplanationRoom(
                interaction, 
                request.categoryId, 
                request.roomName, 
                request.content, 
                request.requester
            );

            // إرسال رسالة القبول للمستخدم
            const acceptEmbed = new EmbedBuilder()
                .setTitle('✅ تم قبول طلب الشرح')
                .setColor(Colors.Green)
                .setDescription('تم قبول طلب الشرح الذي قدمته!')
                .addFields(
                    {
                        name: '📁 الكاتجوري',
                        value: `📁 ${category.name}`,
                        inline: true
                    },
                    {
                        name: '📝 روم الشرح',
                        value: `${createdChannel}`,
                        inline: true
                    }
                )
                .addFields({
                    name: '🎁 مكافأة',
                    value: process.env.EXPLANATION_ROLE_ID ? 
                        `تم منحك رول <@&${process.env.EXPLANATION_ROLE_ID}> 🎖️\nشكراً لمساهمتك في نشر المعرفة!` : 
                        'شكراً لمساهمتك في نشر المعرفة! 🌟',
                    inline: false
                })
                .setTimestamp();

            try {
                await request.requester.send({ embeds: [acceptEmbed] });
            } catch (dmError) {
                console.error('❌ فشل إرسال رسالة القبول للخاص:', dmError);
                // يمكن إضافة رسالة في السيرفر كبديل
            }

            // تحديث رسالة الطلب الأصلية
            const originalEmbed = interaction.message.embeds[0];
            const approvedEmbed = new EmbedBuilder(originalEmbed)
                .setColor(Colors.Green)
                .setTitle('✅ تم قبول طلب الشرح')
                .addFields(
                    {
                        name: '👨‍💼 تم القبول بواسطة',
                        value: interaction.user.tag,
                        inline: true
                    },
                    {
                        name: '⏰ وقت القبول',
                        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                        inline: true
                    },
                    {
                        name: '📝 الروم المنشأ',
                        value: `${createdChannel}`,
                        inline: true
                    }
                );

            await interaction.message.edit({ 
                embeds: [approvedEmbed], 
                components: [] 
            });

            // إرسال إشعار في الروم المحدد في .env إذا كان موجوداً
            const notificationChannelId = process.env.EXPLANATION_NOTIFICATION_CHANNEL_ID;
            if (notificationChannelId) {
                const notificationChannel = interaction.guild.channels.cache.get(notificationChannelId);
                if (notificationChannel) {
                    const notificationEmbed = new EmbedBuilder()
                        .setTitle('📚 تم نشر شرح جديد')
                        .setColor(Colors.Green)
                        .setDescription(`تم قبول ونشر شرح جديد بواسطة ${request.requester.tag}`)
                        .addFields(
                            {
                                name: '📝 الروم',
                                value: `${createdChannel}`,
                                inline: true
                            },
                            {
                                name: '👨‍💼 تمت المراجعة بواسطة',
                                value: interaction.user.tag,
                                inline: true
                            }
                        )
                        .setTimestamp();

                    await notificationChannel.send({ embeds: [notificationEmbed] });
                }
            }

            await sendExplanationLog(
                "✅ طلب شرح مقبول",
                `تم قبول طلب شرح من ${request.requester.tag} بواسطة ${interaction.user.tag}`,
                Colors.Green,
                [
                    { name: '👤 مقدم الطلب', value: `${request.requester.tag}`, inline: true },
                    { name: '👤 المعالج', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 الروم المنشأ', value: `${createdChannel}`, inline: true }
                ]
            );

            await interaction.editReply('✅ تم قبول طلب الشرح بنجاح وإنشاء الروم وإعلام المستخدم.');

            // حذف الطلب من التخزين المؤقت
            explanationRequests.delete(requestId);

        } catch (error) {
            console.error('❌ خطأ في معالجة قبول الطلب:', error);
            await sendExplanationLog(
                "❌ خطأ في قبول طلب الشرح",
                `حدث خطأ أثناء قبول طلب شرح من ${request.requester.tag}`,
                Colors.Red,
                [
                    { name: '👤 المعالج', value: `${interaction.user.tag}`, inline: true },
                    { name: '👤 مقدم الطلب', value: `${request.requester.tag}`, inline: true },
                    { name: '📝 الخطأ', value: error.message, inline: true }
                ]
            );
            await interaction.editReply('❌ حدث خطأ أثناء معالجة القبول. يرجى المحاولة مرة أخرى.');
        }
        return;
    }

    // معالجة رفض طلب الشرح
    if (interaction.isButton() && interaction.customId.startsWith('explanation_reject_')) {
        await interaction.deferReply({ ephemeral: true });
        
        const requestId = interaction.customId.replace('explanation_reject_', '');
        const request = explanationRequests.get(requestId);
        
        if (!request) {
            await sendExplanationLog(
                "❌ طلب شرح غير موجود",
                `حاول ${interaction.user.tag} رفض طلب شرح غير موجود`,
                Colors.Red,
                [
                    { name: '👤 المعالج', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 آيدي الطلب', value: requestId, inline: true }
                ]
            );
            return await interaction.editReply('❌ طلب الشرح غير موجود أو انتهت صلاحيته.');
        }

        const modal = new ModalBuilder()
            .setCustomId(`modal_reject_reason_${requestId}`)
            .setTitle('❌ إدخال سبب الرفض');

        const reasonInput = new TextInputBuilder()
            .setCustomId('rejection_reason')
            .setLabel('سبب الرفض')
            .setPlaceholder('يرجى كتابة سبب الرفض بشكل واضح...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
        return;
    }

    // معالجة نموذج سبب الرفض
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_reject_reason_')) {
        await interaction.deferReply({ ephemeral: true });
        
        const requestId = interaction.customId.replace('modal_reject_reason_', '');
        const request = explanationRequests.get(requestId);
        
        if (!request) {
            await sendExplanationLog(
                "❌ طلب شرح غير موجود",
                `حاول ${interaction.user.tag} رفض طلب شرح غير موجود`,
                Colors.Red,
                [
                    { name: '👤 المعالج', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 آيدي الطلب', value: requestId, inline: true }
                ]
            );
            return await interaction.editReply('❌ طلب الشرح غير موجود أو انتهت صلاحيته.');
        }

        try {
            const rejectionReason = interaction.fields.getTextInputValue('rejection_reason');

            // إرسال رسالة الرفض للمستخدم
            const rejectEmbed = new EmbedBuilder()
                .setTitle('❌ تم رفض طلب الشرح')
                .setColor(Colors.Red)
                .setDescription('نأسف، تم رفض طلب الشرح الذي قدمته.')
                .addFields({
                    name: '📋 سبب الرفض',
                    value: rejectionReason,
                    inline: false
                })
                .setFooter({ text: 'يمكنك تعديل الطلب وإرساله مرة أخرى' })
                .setTimestamp();

            try {
                await request.requester.send({ embeds: [rejectEmbed] });
            } catch (dmError) {
                console.error('❌ فشل إرسال رسالة الرفض للخاص:', dmError);
                // يمكن إضافة رسالة في السيرفر كبديل
            }

            // تحديث رسالة الطلب الأصلية
            const originalEmbed = interaction.message.embeds[0];
            const rejectedEmbed = new EmbedBuilder(originalEmbed)
                .setColor(Colors.Red)
                .setTitle('❌ تم رفض طلب الشرح')
                .addFields(
                    {
                        name: '👨‍💼 تم الرفض بواسطة',
                        value: interaction.user.tag,
                        inline: true
                    },
                    {
                        name: '📋 سبب الرفض',
                        value: rejectionReason.length > 500 ? 
                            rejectionReason.substring(0, 500) + '...' : 
                            rejectionReason,
                        inline: false
                    },
                    {
                        name: '⏰ وقت الرفض',
                        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                        inline: true
                    }
                );

            await interaction.message.edit({ 
                embeds: [rejectedEmbed], 
                components: [] 
            });

            await sendExplanationLog(
                "❌ طلب شرح مرفوض",
                `تم رفض طلب شرح من ${request.requester.tag} بواسطة ${interaction.user.tag}`,
                Colors.Red,
                [
                    { name: '👤 مقدم الطلب', value: `${request.requester.tag}`, inline: true },
                    { name: '👤 المعالج', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 سبب الرفض', value: rejectionReason.length > 200 ? rejectionReason.substring(0, 200) + '...' : rejectionReason, inline: false }
                ]
            );

            await interaction.editReply('✅ تم رفض طلب الشرح وإعلام المستخدم بالسبب.');

            // حذف الطلب من التخزين المؤقت
            explanationRequests.delete(requestId);

        } catch (error) {
            console.error('❌ خطأ في معالجة رفض الطلب:', error);
            await sendExplanationLog(
                "❌ خطأ في رفض طلب الشرح",
                `حدث خطأ أثناء رفض طلب شرح من ${request.requester.tag}`,
                Colors.Red,
                [
                    { name: '👤 المعالج', value: `${interaction.user.tag}`, inline: true },
                    { name: '👤 مقدم الطلب', value: `${request.requester.tag}`, inline: true },
                    { name: '📝 الخطأ', value: error.message, inline: true }
                ]
            );
            await interaction.editReply('❌ حدث خطأ أثناء معالجة الرفض. يرجى المحاولة مرة أخرى.');
        }
        return;
    }
});

// تنظيف الطلبات القديمة تلقائياً كل ساعة
setInterval(() => {
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 ساعة
    
    for (const [requestId, request] of explanationRequests.entries()) {
        if (now - request.timestamp > twentyFourHours) {
            explanationRequests.delete(requestId);
            console.log(`🧹 تم تنظيف طلب شرح منتهي الصلاحية: ${requestId}`);
        }
    }
}, 60 * 60 * 1000); // كل ساعة

console.log('✅ نظام طلبات الشرح (Explanation Requests) - النسخة المعدلة والمطورة تم تحميلها بنجاح!');

clientTag.login(process.env.TOKEN_ZAGLGROUPBOT);
