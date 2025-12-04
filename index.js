const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, REST } = require("discord.js");

// ================== KONFIGURACJA ==================
const TOKEN = "TU_WKLEJ_SWÓJ_AKTUALNY_TOKEN";
const CLIENT_ID = "TU_WKLEJ_SWOJE_CLIENT_ID";
const GUILD_ID = "TU_WKLEJ_SWOJE_GUILD_ID";

// ================== DEFINICJA KOMEND ==================
const commands = [
    new SlashCommandBuilder()
        .setName("rzucam")
        .setDescription("Zaczynam przerzucać użytkownika między kanałami głosowymi.")
        .addUserOption(option =>
            option
                .setName("uzytkownik")
                .setDescription("Kogo przerzucać")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("nierzucam")
        .setDescription("Przestaję przerzucać użytkownika.")
        .addUserOption(option =>
            option
                .setName("uzytkownik")
                .setDescription("Kogo przestać przerzucać")
                .setRequired(true)
        )
].map(cmd => cmd.toJSON());

// ================== REJESTRACJA KOMEND ==================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    try {
        console.log("Rejestruję komendy...");
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log("Komendy zarejestrowane.");
    } catch (error) {
        console.error("Błąd przy rejestracji komend:", error);
    }
})();

// ================== LOGIKA BOTA ==================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
        // GuildMembers nie jest potrzebne – unikamy privileged intents
    ]
});

// userId -> interval
const activeThrows = new Map();

// Funkcja przerzucająca usera
async function startThrowing(member) {
    const guild = member.guild;

    const voiceChannels = guild.channels.cache.filter(
        ch => ch.isVoiceBased() && ch.type === 2
    );

    if (voiceChannels.size < 2) return;

    let i = 0;

    const interval = setInterval(async () => {
        if (!member.voice || !member.voice.channel) {
            clearInterval(interval);
            activeThrows.delete(member.id);
            return;
        }

        const channelsArray = [...voiceChannels.values()];
        const target = channelsArray[i % channelsArray.length];
        i++;

        if (target.id === member.voice.channelId) return;

        try {
            await member.voice.setChannel(target);
        } catch (err) {
            console.log("Błąd przerzucania:", err);
        }
    }, 1000); // co 1 sekundę

    activeThrows.set(member.id, interval);
}

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.commandName;
    const member = interaction.options.getMember("uzytkownik"); // pobieramy od razu membera

    if (!member) {
        return interaction.reply({
            content: "Nie znalazłem tego użytkownika na serwerze.",
            ephemeral: true
        });
    }

    if (command === "rzucam") {
        if (!member.voice || !member.voice.channel) {
            return interaction.reply({
                content: `${member} nie jest w kanale głosowym.`,
                ephemeral: true
            });
        }

        if (activeThrows.has(member.id)) {
            return interaction.reply({
                content: `Już przerzucam ${member}.`,
                ephemeral: true
            });
        }

        await interaction.reply(`Zaczynam rzucać ${member} po kanałach.`);
        startThrowing(member);
    }

    if (command === "nierzucam") {
        if (!activeThrows.has(member.id)) {
            return interaction.reply({
                content: `Nie rzucam ${member}.`,
                ephemeral: true
            });
        }

        clearInterval(activeThrows.get(member.id));
        activeThrows.delete(member.id);

        return interaction.reply(`Przestaję rzucać ${member}.`);
    }
});

client.once("ready", () => {
    console.log(`Zalogowano jako ${client.user.tag}`);
});

client.login(TOKEN);
