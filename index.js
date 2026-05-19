const duckdb = require('duckdb');
const fs = require('fs');

const db = new duckdb.Database(':memory:');

const PATH_BUSCA = './basedados/base_busca.csv';
const PATH_DADOS_CNEFE = './basedados/base_dados.csv';
const PATH_SAIDA_FINAL = './basedados/resultado_final.csv';