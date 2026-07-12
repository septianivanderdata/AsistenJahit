// Entry: start bot (long polling). §4 — tak perlu webhook/domain untuk MVP.
import { Bot, Context } from 'grammy';
import { config } from './config.js';
import { M } from './bot/messages.js';
import { handleStart, tryWizardStep } from './bot/handlers/start-wizard.js';
import { handleForward } from './bot/handlers/forward-order.js';
import { handleAntrian } from './bot/handlers/antrian.js';
import { handleSelesai } from './bot/handlers/selesai.js';
import { handleProfil } from './bot/handlers/profil.js';
import { handleDashboard } from './bot/handlers/dashboard.js';
import { handleLibur } from './bot/handlers/libur.js';
import { handleEdit, tryEditReply } from './bot/handlers/edit.js';
import { handleRiwayat } from './bot/handlers/riwayat.js';
import { startReminderLoop } from './bot/reminder.js';
import { handleCallback } from './bot/handlers/callbacks.js';
import { getClarify } from './bot/session.js';

const bot = new Bot(config.telegramToken);

bot.command('start', wrap(handleStart));
bot.command('antrian', wrap(handleAntrian));
bot.command('selesai', wrap(handleSelesai));
bot.command('edit', wrap(handleEdit));
bot.command('riwayat', wrap(handleRiwayat));
bot.command('profil', wrap(handleProfil));
bot.command('dashboard', wrap(handleDashboard));
bot.command('libur', wrap(handleLibur));

bot.on('callback_query:data', wrap(handleCallback));

bot.on('message:text', wrap(async (ctx) => {
  const chatId = ctx.chat!.id;
  const text = ctx.message?.text ?? '';

  // 1) Wizard menelan pesan bila aktif.
  if (await tryWizardStep(ctx)) return;

  // 2) Menunggu tanggal untuk /edit.
  if (await tryEditReply(ctx)) return;

  // 3) Menunggu koreksi klarifikasi → lanjutkan alur forward.
  if (getClarify(chatId)) {
    await handleForward(ctx, text);
    return;
  }

  // 4) Forward / paste order.
  const msg = ctx.message as any;
  const isForward = !!(msg.forward_origin || msg.forward_date);
  if (isForward || text.length > 25) {
    await handleForward(ctx, text);
    return;
  }

  // 5) Chit-chat → arahkan.
  await ctx.reply(M.forwardHint);
}));

// Pesan forward tanpa teks (mis. hanya media) → arahkan singkat.
bot.on('message', wrap(async (ctx) => {
  await ctx.reply(M.forwardHint);
}));

function wrap(fn: (ctx: Context) => Promise<void>) {
  return async (ctx: Context) => {
    try {
      await fn(ctx);
    } catch (e) {
      console.error('handler error', e);
      try {
        await ctx.reply(M.errGeneric);
      } catch {
        /* ignore */
      }
    }
  };
}

bot.catch((err) => {
  console.error('bot error', err.error);
});

async function main() {
  // setMyCommands hanya kosmetik menu — gangguan jaringan sesaat tak boleh
  // mematikan bot. bot.start() sendiri punya retry internal (grammY).
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: 'Setup / atur ulang profil' },
      { command: 'antrian', description: 'Lihat antrian aktif' },
      { command: 'selesai', description: 'Tandai order selesai' },
      { command: 'edit', description: 'Ubah order aktif (selesai/deadline/batal)' },
      { command: 'riwayat', description: 'Order selesai & ditolak' },
      { command: 'profil', description: 'Lihat profil kapasitas' },
      { command: 'dashboard', description: 'Link dashboard pribadimu' },
      { command: 'libur', description: 'Catat hari libur/cuti' },
    ]);
  } catch (e) {
    console.error('setMyCommands gagal (lanjut tanpa menu)', e);
  }
  startReminderLoop(bot);
  console.log('JuruJahit bot jalan (long polling)…');
  await bot.start();
}

main().catch((e) => {
  console.error('fatal', e);
  process.exit(1);
});
