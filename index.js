const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, REST } = require("discord.js");

// === ZMIENNE ŚRODOWISKOWE ===
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error("Brak DISCORD_TOKEN / CLIENT_ID / GUILD_ID w zmiennych środowiskowych!");
    process.exit(1);
}

// ===== DEFINICJA KOMEND =====
const commands = [
    new SlashCommandBuilder()
        .setName("rzucam")
        .setDescription("Zaczynam przerzucać użytkownika między kanałami głosowymi.")
        .addUserOption(option =>
            option.setName("uzytkownik").setDescription("Kogo przerzucać").setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("nierzucam")
        .setDescription("Przestaję przerzucać użytkownika.")
        .addUserOption(option =>
            option.setName("uzytkownik").setDescription("Kogo przestać przerzucać").setRequired(true)
        )
].map(cmd => cmd.toJSON());

// ===== REJESTRACJA KOMEND =====
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log("Rejestruję komendy...");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("Komendy zarejestrowane.");
    } catch (error) {
        console.error("Błąd przy rejestracji komend:", error);
    }
})();

// ===== LOGIKA BOTA =====

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
        // UWAGA: usunąłem GuildMembers, żeby nie było problemu z privileged intents
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
    const member = interaction.options.getMember("uzytkownik"); // zamiast
