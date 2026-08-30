const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const express = require('express');

// سيرفر وهمي لتبقى استضافة Railway شغالة
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('3play')) {
        const args = message.content.split(' ');
        const query = args.slice(1).join(' ');

        if (!query) {
            return message.reply('❌ يرجى كتابة اسم أو رابط الأغنية بعد الأمر مثال: `3play faded`');
        }

        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ يجب أن تكون متصلاً بروم صوتي (Voice Channel)!');
        }

        try {
            const msg = await message.channel.send('🔍 جاري البحث والتحميل...');

            // البحث باستخدام play-dl
            let searchResults = await play.search(query, { limit: 1 });
            if (!searchResults || searchResults.length === 0) {
                return msg.edit('❌ لم يتم العثور على نتائج مطابقة!');
            }

            const song = searchResults[0];

            // الاتصال بالروم الصوتي
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            // جلب البث الصوتي
            let streamData = await play.stream(song.url);
            let resource = createAudioResource(streamData.stream, { inputType: streamData.type });
            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

            await msg.edit(`🎶 جاري تشغيل الآن: **${song.title}**`);

            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

            player.on('error', error => {
                console.error('Audio Player Error:', error);
                message.channel.send('❌ حدث خطأ أثناء تشغيل الصوت.');
                connection.destroy();
            });

        } catch (error) {
            console.error('Command Error:', error);
            message.reply(`❌ حدث خطأ أثناء محاولة تشغيل الأغنية:\n\`\`\`${error.message}\`\`\``);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
