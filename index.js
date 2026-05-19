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