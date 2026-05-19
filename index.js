const duckdb = require('duckdb');
const fs = require('fs');

const db = new duckdb.Database(':memory:');

const PATH_BUSCA = './basedados/base_busca.csv';
const PATH_DADOS_CNEFE = './basedados/base_dados.csv';
const PATH_SAIDA_FINAL = './basedados/resultado_final.csv';

function simplificarTexto(texto) {
    if (!texto) return '';
    return texto.toString()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/\b(rua|r|avenida|av|alameda|al|travessa|tv|praca|pca|distrito|fazenda|sitio|chacara|none)\b/g, '') // Remove prefixos comuns
        .replace(/[^a-z0-9]/g, '') // Remove pontuação e espaços
        .trim();
}

async function executarGeocodificacao() {
    const all = (query) => new Promise((res, rej) => db.all(query, (err, rows) => err ? rej(err) : res(rows)));
    const run = (query) => new Promise((res, rej) => db.run(query, (err) => err ? rej(err) : res()));
    
    try {
        await run(`CREATE TABLE busca AS SELECT * FROM read_csv_auto('${PATH_BUSCA}', delim=';', header=True, all_varchar=True)`);
        const colunasOriginal = (await all(`PRAGMA table_info('busca')`)).map(c => c.name);
    }
}
