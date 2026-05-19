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
        
        console.log('Carregando CNEFE...');

        const cnefeMap = await all(`
            SELECT 
                SUBSTR(CAST(COD_MUNICIPIO AS VARCHAR), 1, 6) as mun6,
                REGEXP_REPLACE(CAST(CEP AS VARCHAR), '[^0-9]', '', 'g') as cep_limpo,
                NOM_SEGLOGR,
                CAST(COD_SETOR AS VARCHAR) as COD_SETOR
            FROM read_csv_auto('${PATH_DADOS_CNEFE}', delim=';', header=True, all_varchar=True)
            GROUP BY mun6, cep_limpo, NOM_SEGLOGR, COD_SETOR
        `);
        
        const linhasBusca = await all(`
            SELECT *, ROW_NUMBER() OVER () as id_linha_busca 
            FROM busca
        `);
        
        console.log('Processando inteligência Fuzzy e contando registros...');

        const resultadoFinal = linhasBusca.map(linhaBusca => {
            const cepBusca = (linhaBusca.consulta_cep || '').replace(/[^0-9]/g, '');
            const munBusca = String(linhaBusca.consulta_municipio || '').substring(0, 6);
            const ruaBuscaSimplificada = simplificarTexto(linhaBusca.consulta_logradouro);

            const candidatosNoMesmoCep = cnefeMap.filter(c => c.cep_limpo === cepBusca && c.mun6 === munBusca);
        
            let melhorSetor = null;
            let statusVinculacao = 'NÃO LOCALIZADO';

            if (candidatosNoMesmoCep.length > 0) {
                let matchCandidato = candidatosNoMesmoCep.find(c => {
                    const ruaCnefeSimplificada = simplificarTexto(c.NOM_SEGLOGR);
                    return ruaCnefeSimplificada === ruaBuscaSimplificada || 
                           ruaCnefeSimplificada.includes(ruaBuscaSimplificada) || 
                           ruaBuscaSimplificada.includes(ruaCnefeSimplificada);
                });
                                
                if (!matchCandidato && candidatosNoMesmoCep.length === 1) {
                    matchCandidato = candidatosNoMesmoCep[0];
                }

                if (matchCandidato) {
                    melhorSetor = matchCandidato.COD_SETOR;
                    statusVinculacao = 'LOCALIZADO';
                } else {
                    // Se não achou a rua mas o CEP existe, puxa o primeiro setor disponível e marca como ambíguo
                    melhorSetor = candidatosNoMesmoCep[0].COD_SETOR;
                    statusVinculacao = `AMBÍGUO (${candidatosNoMesmoCep.length} registros)`;
                }
            }
            
             return {
                ...linhaBusca,
                setor_censitario_encontrado: melhorSetor,
                status_vinculacao: statusVinculacao
            };
        });
        
        resultadoFinal.sort((a, b) => Number(a.id_linha_busca) - Number(b.id_linha_busca));
        
        console.log('Salvando arquivo final...');

        const cabecalhoFinal = [...colunasOriginal, 'setor_censitario_encontrado', 'status_vinculacao'];
        const linhasCSV = resultadoFinal.map(row => {
            return cabecalhoFinal.map(col => {
                if (col === 'setor_censitario_encontrado') return row.setor_censitario_encontrado || 'NÃO ENCONTRADO';
                if (col === 'status_vinculacao') return row.status_vinculacao;
                return row[col] === null || row[col] === undefined ? '' : row[col];
            }).join(';');
        });

        fs.writeFileSync(PATH_SAIDA_FINAL, [cabecalhoFinal.join(';'), ...linhasCSV].join('\n'));    
      
        const totalLinhas = resultadoFinal.length;
        const totalEncontrados = resultadoFinal.filter(row => row.setor_censitario_encontrado !== null).length;
        const totalNaoEncontrados = totalLinhas - totalEncontrados;

        console.log(`\n--- GEODECODIFICAÇÃO CONCLUÍDA ---`);
        console.log(`Total de linhas processadas: ${totalLinhas}`);
        console.log(`Dados localizados com sucesso: ${totalEncontrados} / ${totalLinhas}`);
        console.log(`Dados NÃO LOCALIZADOS: ${totalNaoEncontrados}`);
        console.log(`Arquivo final salvo em: ${PATH_SAIDA_FINAL}`);
    
    } catch (error) {
        console.error('Erro durante a execução:', error);
    }
}
