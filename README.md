# Pipeline de Geocodificação Censitária (Busca x CNEFE)

Este projeto consiste em um pipeline de engenharia de dados de alta performance desenvolvido em **Node.js** e **DuckDB** para realizar o cruzamento, higienização e enriquecimento de dados geográficos. O objetivo principal é vincular uma base de buscas cadastrais ao **Setor Censitário** correspondente do IBGE (Cadastro Nacional de Endereços para Fins Estatísticos - CNEFE).

## 🚀 Arquitetura e Escolha de Ferramentas

O projeto foi desenhado focando em eficiência computacional e capacidade de processamento analítico local (OLAP).

* **Node.js**: Utilizado como ambiente de execução principal para orquestração do fluxo, manipulação dinâmica de strings e controle de concorrência.
* **DuckDB**: Escolhido estrategicamente como o motor de banco de dados em memória. Por ser um SGBD colunar voltado para análises vetoriais (OLAP), o DuckDB processa arquivos CSV de milhões de linhas (como o CNEFE) em milissegundos, consumindo uma fração mínima da memória RAM que seria necessária se utilizássemos estruturas tradicionais do JavaScript.

---

## 🧠 Critérios Técnicos e Engenharia de Match (Fuzzy Logic)

Bases de dados governamentais e cadastros de usuários sofrem frequentemente com ruídos de preenchimento (endereços mal digitados, abreviações inconsistentes e falta de padronização). Para garantir uma taxa de localização próxima a 100% sem gerar falsos positivos, o pipeline implementa as seguintes regras de negócio:

### 1. Higienização Avançada de Strings (Normalização)
Antes de qualquer comparação, os logradouros passam por uma função de simplificação que:
* Converte todo o texto para caracteres minúsculos.
* Remove acentos e caracteres especiais usando normalização Unicode (`NFD`).
* Elimina prefixos e modificadores comuns de endereço que geram falso-negativo (ex: `Rua`, `Avenida`, `Travessa`, `Distrito`, `Fazenda`, `Sítio`).
* Limpa ruídos de exportação comuns de planilhas (como o prefixo `none `).

### 2. Funil de Cruzamento em Cascata e Fallback
O cruzamento não é um simples `JOIN` estrito. Ele opera em camadas inteligentes:
* **Camada Base (Filtro DuckDB)**: Agrupa e reduz as milhões de linhas do CNEFE na memória baseado apenas em correspondências de **CEP** e **Código do Município (6 dígitos)**.
* **Camada Intermediária (Match Exato)**: O JavaScript varre os candidatos e busca o logradouro normalizado perfeito. Se houver match, o setor é vinculado como `VÍNCULO EXATO`.
* **Camada de Fallback (CEP Exclusivo)**: Se o nome da rua tiver pequenas divergências mas o CEP consultado for exclusivo de um único setor censitário no IBGE, o algoritmo realiza a atribuição inteligente em vez de descartar a linha.
* **Camada Ambígua**: Caso o CEP possua múltiplos setores e o nome da rua não seja idêntico, o código adota o setor predominante daquela região e sinaliza explicitamente o volume de ambiguidade.

### 3. Preservação da Integridade da Base (Fidelidade do Input)
Para atender aos rigorosos critérios de avaliação do teste:
* O pipeline garante que o arquivo de saída tenha exatamente o mesmo número de linhas da base de busca de entrada.
* **Garantia de Sequência**: O código indexa cada linha de busca antes do processamento e força a ordenação do arquivo final para manter **exatamente a mesma ordem original** da tabela de busca, facilitando auditorias automatizadas e aplicação de formatação condicional (ex: cores no Excel).

---

## 📊 Estrutura do Arquivo de Saída

O arquivo final gerado em `resultado_final.csv` preserva todas as colunas originais da sua busca e adiciona duas colunas métricas fundamentais para regras de negócio:

1.  `setor_censitario_encontrado`: O código do setor censitário encontrado (ou `NÃO ENCONTRADO`).
2.  `status_vinculacao`: Classificação técnica do match para tomada de decisão:
    * `VÍNCULO EXATO`: Enquadramento perfeito de endereço.
    * `AMBÍGUO (X registros)`: Identifica que o CEP possui múltiplas subdivisões e aponta a quantidade de ocorrências encontradas para análise de dispersão.
    * `NÃO LOCALIZADO`: Quando o CEP ou município não existem na base de referência do IBGE.

---

## 🛠️ Como Executar o Projeto

### Pré-requisitos
* [Node.js](https://nodejs.org/) instalado (versão 16 ou superior recomendada).

## 📂 Configuração das Bases de Dados (Obrigatório)

Por motivos de performance e boas práticas de versionamento, os arquivos grandes de dados (`.csv`) foram incluídos no `.gitignore` e não estão publicados diretamente neste repositório. 

Antes de rodar o projeto, você precisa criar a estrutura de pastas localmente e posicionar os arquivos seguindo o passo a passo abaixo:

1. Na raiz do projeto, crie uma pasta chamada `basedados`.
2. Baixe a sua base de dados do CNEFE (IBGE) e a sua planilha de consultas.
3. Mova os dois arquivos para dentro da pasta criada e renomeie-os exatamente da seguinte forma:
   * **`base_busca.csv`** (A sua planilha com os endereços que deseja geocodificar).
   * **`base_dados.csv`** (O arquivo bruto do CNEFE / IBGE contendo os setores censitários).

A sua estrutura de diretórios local deve ficar exatamente assim:

```text
├── basedados/
│   ├── base_busca.csv
│   └── base_dados.csv
├── .gitignore
├── index.js
├── package-lock.json
└── package.json

### 💻 Passo a Passo para Execução

Como a pasta `node_modules` foi omitida do repositório por boas práticas de versionamento, você precisará restaurar as dependências antes de rodar o pipeline.

#### 1. Instalação das Dependências
Abra o seu terminal na raiz do projeto e execute o comando abaixo. O Node.js lerá o arquivo `package.json` e baixará automaticamente o driver do DuckDB:

```bash
npm install

#### 2. Execução do Pipeline
Após garantir que as bases de dados estão na pasta correta e que as dependências foram instaladas, execute o script principal para gerar o relatório:

```bash
node index.js