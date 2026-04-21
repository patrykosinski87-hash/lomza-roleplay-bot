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
        .setDescription('Odlacz konto Roblox od Discorda')
        .addUserOption(option =>
            option.setName('gracz')
                .setDescription('Gracz ktoremu odlaczasz konto (zostaw puste zeby odlaczyc swoje)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('powod')
                .setDescription('Powod odlaczenia konta')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client, config) {
        await interaction.deferReply({ ephemeral: true });

        // Jesli nie podano gracza, odlacz swoje konto
        const targetUser = interaction.options.getUser('gracz') || interaction.user;
        const powod = interaction.options.getString('powod') || 'Brak powodu';
        const targetId = targetUser.id;
        const isSelf = targetId === interaction.user.id;

        try {
            const verified = loadVerified();

            // Sprawdz czy gracz ma podlaczone konto
            if (!verified[targetId]) {
                const notVerifiedEmbed = new EmbedBuilder()
                    .setColor("#FFA500")
                    .setTitle('⚠️ Konto nie jest podlaczone!')
                    .setDescription(
                        isSelf
                            ? 'Nie masz podlaczonego konta Roblox.'
                            : `Gracz <@${targetId}> nie ma podlaczonego konta Roblox.`
                    )
                    .setFooter({ text: 'Lomza Roleplay' })
                    .setTimestamp();
                return interaction.editReply({ embeds: [notVerifiedEmbed] });
            }

            // Zapamietaj stare dane
            const stareKonto = verified[targetId];

            // Usun konto z bazy
            delete verified[targetId];
            saveVerified(verified);

            // Pobierz membera
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);

            if (member) {
                // Zabierz role Obywatel
                if (config.verifiedRoleId) {
                    await member.roles.remove(config.verifiedRoleId).catch(e => {
                        console.log("Blad usuwania roli Obywatel: " + e.message);
                    });
                }

                // Nadaj role Niezweryfikowany
                if (config.unverifiedRoleId) {
                    await member.roles.add(config.unverifiedRoleId).catch(e => {
                        console.log("Blad nadawania roli Niezweryfikowany: " + e.message);
                    });
                }

                // Zresetuj nick
                await member.setNickname(null).catch(e => {
                    console.log("Blad resetowania nicku: " + e.message);
                });
            }

            // Embed sukcesu
            const successEmbed = new EmbedBuilder()
                .setColor("#00FF7F")
                .setTitle('✅ Konto zostalo odlaczone!')
                .addFields(
                    { name: '👤 Gracz', value: `<@${targetId}>`, inline: true },
                    { name: '🆔 Bylo ID Roblox', value: `\`${stareKonto.robloxId}\``, inline: true },
                    { name: '📝 Powod', value: powod, inline: false },
                    {
                        name: '👮 Odlaczyl',
                        value: isSelf ? 'Gracz sam odlaczyl swoje konto' : `<@${interaction.user.id}>`,
                        inline: false
                    }
                )
                .setFooter({ text: 'Lomza Roleplay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // DM do gracza (tylko jesli ktos inny odlaczyl)
            if (!isSelf) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor("#FF4444")
                        .setTitle('⚠️ Twoje konto zostalo odlaczone!')
                        .setDescription('Administrator odlaczyl Twoje konto Roblox od serwera **Lomza Roleplay**.')
                        .addFields(
                            { name: '📝 Powod', value: powod },
                            { name: '🔄 Co teraz?', value: 'Mozesz ponownie zweryfikowac konto uzywajac komendy `/weryfikacja`.' }
                        )
                        .setFooter({ text: 'Lomza Roleplay' })
                        .setTimestamp();

                    await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
                } catch {
                    // Gracz moze miec wylaczone DM
                }
            }

            // LOG NA KANAL LOGOW
            try {
                if (!config.logChannelId) {
                    console.log("⚠️ Brak LOG_CHANNEL_ID w zmiennych!");
                    return;
                }

                const logChannel = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);

                if (!logChannel) {
                    console.log("⚠️ Nie znaleziono kanalu logow! Sprawdz LOG_CHANNEL_ID w Railway.");
                    return;
                }

                const logEmbed = new EmbedBuilder()
                    .setColor("#FF4444")
                    .setTitle('🔓 Konto odlaczone | Log')
                    .addFields(
                        { name: '👤 Gracz', value: `<@${targetId}> (${targetUser.tag})`, inline: true },
                        { name: '🆔 Bylo ID Roblox', value: `\`${stareKonto.robloxId}\``, inline: true },
                        { name: '📝 Powod', value: powod, inline: false },
                        {
                            name: '👮 Odlaczyl',
                            value: isSelf
                                ? `Gracz sam odlaczyl swoje konto`
                                : `<@${interaction.user.id}> (${interaction.user.tag})`,
                            inline: false
                        },
                        { name: '📅 Data', value: new Date().toLocaleString('pl-PL'), inline: false }
                    )
                    .setFooter({ text: 'Lomza Roleplay | System weryfikacji' })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
                console.log("✅ Log odlaczenia wyslany!");

            } catch (logError) {
                console.error("❌ Blad wysylania logu:", logError.message);
            }

        } catch (error) {
            console.error('Blad odlaczania konta:', error);
            await interaction.editReply({
                content: '❌ Wystapil blad podczas odlaczania konta. Sprobuj ponownie.'
            });
        }
    }
};
