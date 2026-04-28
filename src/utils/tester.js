const { enviarVaga } = require('../platforms/whatsapp');

const simularEnvioVagas = (sock) => {
    // ID que capturamos no log
    const grupoId = '120363406857942739@g.us'; 

    const vagaFake = {
        titulo: "Desenvolvedor Backend Node.js",
        empresa: "Comunidade Juninhos",
        link: "https://github.com",
        local: "Remoto"
    };

    // Teste imediato
    console.log("🛠️  Tentando envio imediato de teste...");
    enviarVaga(sock, vagaFake, grupoId);

    setInterval(() => {
        enviarVaga(sock, vagaFake, grupoId);
    }, 120000);
};

module.exports = { simularEnvioVagas };
