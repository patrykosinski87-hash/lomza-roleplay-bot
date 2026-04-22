const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('odlacz')
        .setDescription('Odlacz konto Roblox od Discorda')
        .addUserOption(option =>
            option.setName('gracz')
                .setDescription('Gracz')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client, config, noblox, db) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const targetUser = interaction.options.getUser('gracz') || interaction.user;
            const targetId = targetUser.id;
            const testValue = await db.get(`verified_${targetId}`);
            
            await interaction.editReply({ 
                content: `Test: ${JSON.stringify(testValue)}` 
            });

        } catch (error) {
            await interaction.editReply({ 
                content: `Blad: ${error.message}` 
            });
        }
    }
};
