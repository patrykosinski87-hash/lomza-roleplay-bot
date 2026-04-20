const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Promuj gracza w grupie Roblox')
        .addStringOption(option =>
            option.setName('gracz')
                .setDescription('Nazwa użytkownika Roblox')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction, client, config, noblox) {
        await interaction.deferReply({ ephemeral: true });

        const graczInput = interaction.options.getString('gracz');

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
            await noblox.promote(config.groupId, robloxId);
            const rankAfter = await noblox.getRankInGroup(config.groupId, robloxId);

            const successEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle('⬆️ Gracz został promowany!')
                .addFields(
                    { name: '👤 Gracz', value: `**${graczInput}** (\`${robloxId}\`)`, inline: true },
                    { name: '👮 Przez', value: `<@${interaction.user.id}>`, inline: true },
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
                    .setColor(config.colors.success)
                    .setTitle('⬆️ PROMOTE | Zmiana rangi')
                    .addFields(
                        { name: '👤 Gracz', value: `**${graczInput}** (\`${robloxId}\`)`, inline: true },
                        { name: '👮 Przez administratora', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                        { name: '📊 Zmiana rangi', value: `**${rankBefore}** → **${rankAfter}**`, inline: false }
                    )
                    .setFooter({ text: 'Łomża Roleplay Bot' })
                    .setTimestamp();
                
                logChannel.send({ embeds: [logEmbed] });
            }
        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(config.colors.error)
                .setTitle('❌ Błąd promowania!')
                .setDescription('Nie udało się promować gracza. Sprawdź czy:\n• Gracz jest w grupie\n• Bot ma odpowiednie uprawnienia w grupie')
                .setFooter({ text: 'Łomża Roleplay Bot' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};