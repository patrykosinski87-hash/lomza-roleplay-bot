const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

function loadVerified() {
    const file = path.join(__dirname, '../data/verified.json');
    if (!fs.existsSync(file)) fs.writeFileSync(file, '{}');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveVerified(data) {
    fs.writeFileSync(path.join(__dirname, '../data/verified.json'), JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('odlacz')
        .setDescription('Odlacz konto Roblox gracza od Discorda')
        .addUserOption(option =>
            option.setName('gracz')
                .setDescription('Gracz Discord ktoremu chcesz odlaczyc konto')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('powod')
                .setDescription('Powod odlaczenia konta')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, client, config) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('gracz');
        const powod = interaction.options.getString('powod') || 'Brak powodu';
        const targetId = targetUser.id;

        try {
            // Sprawdz czy gracz ma powiazane konto
            const verified = loadVerified();

            if (!verified[targetId]) {
                const notVerifiedEmbed = new EmbedBuilder()
                    .setColor("#FFA500")
                    .setTitle('⚠️ Gracz nie jest zweryfikowany!')
                    .setDescription(`Gracz <@${targetId}> nie ma przypisanego konta Roblox.`)
                    .setFooter({ text: 'Lomza Roleplay' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [notVerifiedEmbed] });
            }

            // Zapamietaj stare dane przed usunieciem
            const stareKonto = verified[targetId];

            // Usun konto z bazy
            delete verified[targetId];
            saveVerified(verified);

            // Pobierz membera z serwera
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);

            if (member) {
                // Zabierz role Obywatel
                if (config.verifiedRoleId) {
                    await member.roles.remove(config.verifiedRoleId).catch(() => {});
                }

                // Nadaj role Niezweryfikowany
                if (config.unverifiedRoleId) {
                    await member.roles.add(config.unverifiedRoleId).catch(() => {});
                }

                // Przywroc oryginalny nick (usun to co bot dodal)
                await member.setNickname(null).catch(() => {});
            }

            // Wyslij potwierdzenie
            const successEmbed = new EmbedBuilder()
                .setColor("#00FF7F")
                .setTitle('✅ Konto zostalo odlaczone!')
                .addFields(
                    { name: '👤 Gracz Discord', value: `<@${targetId}>`, inline: true },
                    { name: '🎮 Bylo powiazane z', value: `ID: \`${stareKonto.robloxId}\``, inline: true },
                    { name: '📝 Powod', value: powod, inline: false },
                    { name: '👮 Odlaczyl', value: `<@${interaction.user.id}>`, inline: false }
                )
                .setFooter({ text: 'Lomza Roleplay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // Powiadom gracza na DM
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor("#FF4444")
                    .setTitle('⚠️ Twoje konto zostalo odlaczone!')
                    .setDescription(`Administrator odlaczyl Twoje konto Roblox od serwera **Lomza Roleplay**.`)
                    .addFields(
                        { name: '📝 Powod', value: powod },
                        { name: '🔄 Co teraz?', value: 'Mozesz ponownie zweryfikowac konto uzywajac komendy `/weryfikacja`.' }
                    )
                    .setFooter({ text: 'Lomza Roleplay' })
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
            } catch {
                // Gracz moze miec wylaczone DM - nie ma problemu
            }

            // Log na kanal logow
            try {
                const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor("#FF4444")
                        .setTitle('🔓 Konto odlaczone | Log')
                        .addFields(
                            { name: '👤 Gracz', value: `<@${targetId}> (${targetUser.tag})`, inline: true },
                            { name: '🎮 Bylo ID Roblox', value: `\`${stareKonto.robloxId}\``, inline: true },
                            { name: '📝 Powod', value: powod, inline: false },
                            { name: '👮 Odlaczyl administrator', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false }
                        )
                        .setFooter({ text: 'Lomza Roleplay | Log systemu' })
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                }
            } catch {
                // Blad logu - nie zatrzymuje dzialania
            }

        } catch (error) {
            console.error('Blad odlaczania konta:', error);
            await interaction.editReply({ content: '❌ Wystapil blad podczas odlaczania konta. Sprobuj ponownie.' });
        }
    }
};
