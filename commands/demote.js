const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demote')
        .setDescription('Zdegraduj gracza w grupie Roblox')
        .addStringOption(option =>
            option.setName('gracz')
                .setDescription('Nazwa użytkownika Roblox')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('powód')
                .setDescription('Powód degradacji')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction, client, config, noblox) {
        await interaction.deferReply({ ephemeral: true });

        const graczInput = interaction.options.getString('gracz');
        const powod = interaction.options.getString('powód') ?? 'Brak powodu';

        let robloxId;
        try {
            robloxId = await noblox.getIdFromUsername(graczInput);
        } catch {
            const notFoundEmbed = new EmbedBuilder()
                .setColor(config.colors.error)
                .setTitle('❌ Nie znaleziono gracza!')
                .setDescription(`Nie znaleziono gracza **${graczInput}** na Robloxie.`)
                .setFooter({ text: 'Łomża Roleplay Bot' })
                .setTimestamp();
            
            return interaction.editReply({ embeds: [notFoundEmbed] });
        }

        try {
            const rankBefore = await noblox.getRankInGroup(config.groupId, robloxId);
            await noblox.demote(config.groupId, robloxId);
            const rankAfter = await noblox.getRankInGroup(config.groupId, robloxId);

            const successEmbed = new EmbedBuilder()
                .setColor(config.colors.warning)
                .setTitle('⬇️ Gracz został zdegradowany!')
                .addFields(
                    { name: '👤 Gracz', value: `**${graczInput}** (\`${robloxId}\`)`, inline: true },
                    { name: '👮 Przez', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📝 Powód', value: powod, inline: false },
                    { name: '📊 Zmiana rangi', value: `Ranga **${rankBefore}** → Ranga **${rankAfter}**`, inline: false }
                )
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=420&height=420&format=png`)
                .setFooter({ text: 'Łomża Roleplay Bot' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // Log akcji
            const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(config.colors.warning)
                    .setTitle('⬇️ DEMOTE | Zmiana rangi')
                    .addFields(
                        { name: '👤 Gracz', value: `**${graczInput}** (\`${robloxId}\`)`, inline: true },
                        { name: '👮 Przez administratora', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                        { name: '📝 Powód', value: powod, inline: false },
                        { name: '📊 Zmiana rangi', value: `**${rankBefore}** → **${rankAfter}**`, inline: false }
                    )
                    .setFooter({ text: 'Łomża Roleplay Bot' })
                    .setTimestamp();
                
                logChannel.send({ embeds: [logEmbed] });
            }
        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(config.colors.error)
                .setTitle('❌ Błąd degradacji!')
                .setDescription('Nie udało się zdegradować gracza.')
                .setFooter({ text: 'Łomża Roleplay Bot' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};