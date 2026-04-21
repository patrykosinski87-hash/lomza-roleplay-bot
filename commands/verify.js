const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
        .setName('weryfikacja')
        .setDescription('Zweryfikuj swoje konto Roblox')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('Twoje ID z Roblox (tylko cyfry)')
                .setRequired(true)
        ),

    async execute(interaction, client, config) {
        await interaction.deferReply({ ephemeral: true });

        const robloxId = interaction.options.getString('id');
        const discordId = interaction.user.id;

        // Sprawdz czy ID to same cyfry
        if (!/^\d+$/.test(robloxId)) {
            return interaction.editReply({
                content: '❌ Podaj poprawne ID Roblox (tylko cyfry)!'
            });
        }

        try {
            const member = await interaction.guild.members.fetch(discordId);
            const verified = loadVerified();

            // Sprawdz czy jest adminem
            const isAdmin = member.permissions.has('Administrator');

            // Sprawdz czy ma juz podlaczone konto
            if (verified[discordId]) {
                // Jesli admin - moze sie ponownie zweryfikowac
                if (isAdmin) {
                    // Usun stare konto admina i pozwol na nowe
                    delete verified[discordId];
                    saveVerified(verified);
                    console.log(`Admin ${member.user.tag} resetuje swoje konto.`);
                } else {
                    // Zwykly gracz - nie moze sie ponownie weryfikowac
                    const alreadyEmbed = new EmbedBuilder()
                        .setColor("#FFA500")
                        .setTitle('⚠️ Jestes juz zweryfikowany!')
                        .setDescription(`Twoje konto jest juz podlaczone do ID Roblox: \`${verified[discordId].robloxId}\``)
                        .addFields({
                            name: '❓ Chcesz zmienic konto?',
                            value: 'Skontaktuj sie z administratorem - uzyje on komendy `/odlacz`.'
                        })
                        .setFooter({ text: 'Lomza Roleplay' })
                        .setTimestamp();
                    return interaction.editReply({ embeds: [alreadyEmbed] });
                }
            }

            // Zapisz nowe konto
            const verifiedData = loadVerified();
            verifiedData[discordId] = {
                robloxId: robloxId,
                verifiedAt: new Date().toISOString(),
                verifiedBy: 'self'
            };
            saveVerified(verifiedData);

            // Nadaj role Obywatel
            if (config.verifiedRoleId) {
                await member.roles.add(config.verifiedRoleId).catch(e => {
                    console.log("Blad nadawania roli Obywatel: " + e.message);
                });
            }

            // Zabierz role Niezweryfikowany
            if (config.unverifiedRoleId) {
                await member.roles.remove(config.unverifiedRoleId).catch(e => {
                    console.log("Blad usuwania roli Niezweryfikowany: " + e.message);
                });
            }

            // Zmien nick na: NickDiscord (@IDRoblox)
            const nowyNick = `${interaction.user.username} (@${robloxId})`;
            await member.setNickname(nowyNick).catch(e => {
                console.log("Blad zmiany nicku: " + e.message);
            });

            // Embed sukcesu
            const successEmbed = new EmbedBuilder()
                .setColor("#00FF7F")
                .setTitle('✅ Weryfikacja zakonczona pomyslnie!')
                .setDescription(`Witaj **${interaction.user.username}**!\nTwoje konto zostalo zweryfikowane.`)
                .addFields(
                    { name: '🆔 ID Roblox', value: `\`${robloxId}\``, inline: true },
                    { name: '🏷️ Nowy nick', value: `\`${nowyNick}\``, inline: true },
                    { name: '🎖️ Ranga', value: 'Otrzymales range **Obywatel**', inline: false }
                )
                .setFooter({ text: 'Lomza Roleplay' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

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
                    .setColor("#00FF7F")
                    .setTitle('🔐 Nowa weryfikacja | Log')
                    .addFields(
                        { name: '👤 Gracz Discord', value: `<@${discordId}> (${interaction.user.tag})`, inline: true },
                        { name: '🆔 ID Roblox', value: `\`${robloxId}\``, inline: true },
                        { name: '🏷️ Nowy nick', value: `\`${nowyNick}\``, inline: false },
                        { name: '📅 Data', value: new Date().toLocaleString('pl-PL'), inline: false }
                    )
                    .setFooter({ text: 'Lomza Roleplay | System weryfikacji' })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
                console.log("✅ Log weryfikacji wyslany!");

            } catch (logError) {
                console.error("❌ Blad wysylania logu:", logError.message);
            }

        } catch (error) {
            console.error('Blad weryfikacji:', error);
            await interaction.editReply({
                content: '❌ Wystapil blad podczas weryfikacji. Upewnij sie ze bot ma uprawnienia do zarzadzania rolami!'
            });
        }
    }
};
