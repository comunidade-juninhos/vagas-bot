/**
 * modelo padrão de uma vaga (job) no sistema.
 * serve para garantir que todos os dados tenham o mesmo formato
 */
export class Vaga {
    constructor(data) {
        this.title = data.title; // título da vaga
        this.company = data.company; // nome da empresa
        this.description = data.description; // texto da descrição
        this.location = data.location || 'não informado'; // local ou país
        this.url = data.url; // link para se candidatar
        this.source = data.source; // de onde veio (linkedin, gupy, etc)
        this.workMode = data.workMode || 'onsite'; // remote, hybrid ou onsite
        this.seniority = data.seniority || 'n/a'; // junior, pleno, senior
        this.stack = data.stack || []; // tecnologias (react, node, etc)
        this.originalLanguage = data.originalLanguage || 'en'; // idioma original da vaga (usado para as bandeiras)
        this.createdAt = data.createdAt || new Date().toISOString(); // data de quando foi encontrada
    }

    /**
     * valida se os campos obrigatórios estão preenchidos
     */
    isValid() {
        return !!(this.title && this.company && this.url);
    }
}

