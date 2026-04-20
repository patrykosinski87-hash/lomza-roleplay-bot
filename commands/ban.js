const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

function loadVerified() {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../data/verified.json'), 'utf8'));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Zbanuj gracza w grze Roblox')
        .addStringOption(option =>
            option.setName('gracz')
                .setDescription('Nazwa użytkownika Roblox lub @wzmianka Discord')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('powód')
                .setDescription('Powód bana')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('czas')
                .setDescription('Czas bana w godzinach (0 = permanentny)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(720)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, client, config, noblox) {
        await interaction.deferReply({ ephemeral: true });

        const graczInput = interaction.options.getString('gracz');
        const powod = interaction.options.getString('powód');
        const czas = interaction.options.getInteger('czas') ?? 0;

        let robloxId, robloxName;

        try {
            robloxId = await noblox.getIdFromUsername(graczInput);
            robloxName = graczInput;
        } catch {
            const notFoundEmbed = new EmbedBuilder()
                .setColor(config.colors.error)
                .setTitle('❌ Nie znaleziono gracza!')
                .setDescription(`Nie znaleziono gracza **${graczInput}** na Robloxie.`)
                .setFooter({ text: 'Łomża Roleplay Bot' })
                .setTimestamp();
            
            return interaction.editReply({ embeds: [notFoundEmbed] });
        }

        // Sprawdź czy gracz jest w grupie
        let rankInGroup;
        try {
            rankInGroup = await noblox.getRankInGroup(config.groupId, robloxId);
        } catch {
            rankInGroup = 0;
        }

        const successEmbed = new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle('🔨 Gracz został zbanowany!')
            .addFields(
                { name: '👤 Gracz', value: `**${robloxName}** (\`${robloxId}\`)`, inline: true },
                { name: '👮 Admin', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📝 Powód', value: powod, inline: false },
                { name: '⏰ Czas bana', value: czas === 0 ? '🔴 Permanentny' : `⏱️ ${czas} godzin`, inline: true },
                { name: '🎭 Ranga w grupie', value: rankInGroup > 0 ? `Ranga ${rankInGroup}` : 'Nie należy do grupy', inline: true }
            )
            .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=420&height=420&format=png`)
            .setFooter({ text: 'Łomża Roleplay Bot' })
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

        // Log akcji
        const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(config.colors.error)
                .setTitle('🔨 BAN | Akcja moderacyjna')
                .addFields(
                    { name: '👤 Zbanowany gracz', value: `**${robloxName}** (\`${robloxId}\`)`, inline: true },
                    { name: '👮 Przez administratora', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                    { name: '📝 Powód', value: powod, inline: false },
                    { name: '⏰ Czas bana', value: czas === 0 ? '🔴 Permanentny' : `⏱️ ${czas} godzin`, inline: true }
                )
                .setFooter({ text: 'Łomża Roleplay Bot' })
                .setTimestamp();
            
            logChannel.send({ embeds: [logEmbed] });
        }
    }
};