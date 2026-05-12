import { startWhatsApp } from './client.js';

await startWhatsApp({
  onReady: async (sock) => {
    // espera um instante para o store sincronizar
    setTimeout(async () => {
      const groups = await sock.groupFetchAllParticipating();
      const list = Object.values(groups);

      if (list.length === 0) {
        console.log('\n⚠️  Nenhum grupo encontrado. Adicione o número do bot a um grupo e tente de novo.\n');
        process.exit(0);
      }

      console.log(`\n📋 ${list.length} grupo(s) encontrado(s):\n`);
      list.forEach((g) => {
        console.log(`  • ${g.subject}`);
        console.log(`    JID: ${g.id}\n`);
      });

      console.log('👉 Copie o JID do grupo desejado e cole em WA_STAGING_GROUP_JID no arquivo .env\n');
      process.exit(0);
    }, 3000);
  },
});
