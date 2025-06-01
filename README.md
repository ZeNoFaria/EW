Collecting workspace information# Sistema de Arquivo Digital - EW

Este projeto implementa um sistema completo de arquivo digital baseado no modelo OAIS (Open Archival Information System), desenvolvido como trabalho prático da disciplina de Engenharia Web.

## 📋 Descrição do Projeto

O sistema permite a preservação digital de conteúdos através de pacotes SIP (Submission Information Package), que são processados e armazenados como AIP (Archival Information Package), podendo posteriormente ser disponibilizados como DIP (Dissemination Information Package).

### Funcionalidades Principais

- **Gestão de Utilizadores**: Autenticação, registo e controlo de acesso
- **Ingestão de SIP**: Upload e processamento de pacotes de submissão
- **Arquivo Digital**: Armazenamento e gestão de AIP
- **Disseminação**: Exportação de DIP para acesso ao conteúdo
- **Área Pública**: Visualização de conteúdos públicos sem autenticação
- **Timeline**: Visualização cronológica dos conteúdos
- **Sistema de Comentários**: Interação social nos conteúdos
- **Taxonomias e Tags**: Classificação e organização dos conteúdos
- **Estatísticas**: Dashboard administrativo com métricas do sistema

## 🏗️ Arquitetura do Sistema

### Backend (Node.js/Express)

- **API RESTful** com documentação Swagger
- **Base de Dados**: MongoDB com Mongoose
- **Autenticação**: JWT + Sessions
- **Upload de Ficheiros**: Multer
- **Processamento de ZIP**: AdmZip
- **Logging**: Sistema de auditoria completo

### Frontend (Express + Pug)

- **Template Engine**: Pug
- **CSS Framework**: Bootstrap 5
- **JavaScript**: Vanilla JS com funcionalidades modernas
- **Routing**: Express Router
- **Middleware**: Autenticação e gestão de sessões

### Principais Controladores

#### `sipController.js`

- Ingestão e processamento de pacotes SIP
- Gestão de AIP (Archival Information Package)
- Validação de metadados e manifestos
- Controlo de visibilidade (público/privado)

#### `publicController.js`

- Endpoints públicos para AIP
- Acesso a conteúdos sem autenticação
- Estatísticas públicas

#### `dipController.js`

- Exportação de DIP (Dissemination Information Package)
- Servidor de ficheiros individuais
- Geração de pacotes ZIP para download

#### `timelineController.js`

- Visualização cronológica dos conteúdos
- Filtros por data, categoria e tags
- Estatísticas e agregações

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js (v16 ou superior)
- MongoDB
- Docker e Docker Compose (opcional)

### Instalação Manual

1. **Clonar o repositório**:

```bash
git clone <url-do-repositorio>
cd EW
```

2. **Configurar variáveis de ambiente**:

```bash
cp .env.example .env
# Editar o ficheiro .env com as suas configurações
```

3. **Instalar dependências**:

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

4. **Iniciar os serviços**:

```bash
# Backend (porta 3000)
cd backend
npm start

# Frontend (porta 3001)
cd frontend
npm start
```

### Instalação com Docker

```bash
docker-compose up -d
```

## 📁 Estrutura do Projeto

```
EW/
├── backend/                 # API e lógica de negócio
│   ├── src/
│   │   ├── controllers/     # Controladores da API
│   │   ├── models/         # Esquemas da base de dados
│   │   ├── routes/         # Definição das rotas
│   │   ├── middleware/     # Middleware personalizado
│   │   └── config/         # Configurações
│   └── uploads/            # Ficheiros enviados
├── frontend/               # Interface web
│   ├── routes/            # Rotas do frontend
│   ├── views/             # Templates Pug
│   └── public/            # Recursos estáticos
├── teste-sip/             # Exemplo de pacote SIP
└── docker-compose.yml     # Configuração Docker
```

## 📊 Modelos de Dados

### SIP Schema (`sipSchema.js`)

- **Metadados**: Título, descrição, tipo, tags, produtor
- **Ficheiros**: Array de ficheiros com checksums
- **Estado**: pending, processing, ingested, failed
- **Visibilidade**: público/privado

### Outros Modelos

- **User**: Utilizadores do sistema
- **Category/Taxonomy**: Classificação hierárquica
- **Tag**: Etiquetas para organização
- **Comment**: Sistema de comentários
- **Log**: Auditoria e estatísticas

## 🔄 Fluxo de Trabalho SIP → AIP → DIP

1. **Submissão (SIP)**:

   - Upload de ficheiro ZIP com manifesto
   - Validação de metadados
   - Processamento automático

2. **Armazenamento (AIP)**:

   - Extração e validação dos ficheiros
   - Cálculo de checksums
   - Armazenamento seguro

3. **Disseminação (DIP)**:
   - Exportação de pacotes para acesso
   - Controlo de permissões
   - Download de ficheiros individuais

## 🔐 Sistema de Autenticação

- **JWT Tokens**: Para autenticação da API
- **Sessions**: Para o frontend web
- **Roles**: Utilizador normal, admin
- **OAuth**: Suporte para Google e Facebook (configurável)

## 📋 Formato do Manifesto SIP

Exemplo de manifesto-SIP.json:

```json
{
  "metadata": {
    "dataCreacao": "2025-01-15",
    "titulo": "Viagem ao Porto - Janeiro 2025",
    "tipo": "viagem",
    "descricao": "Fim de semana no Porto",
    "localizacao": "Porto, Portugal",
    "tags": ["viagem", "porto", "turismo"]
  },
  "files": [
    {
      "nome": "foto_ponte_dom_luis.jpg",
      "tipo": "imagem",
      "descricao": "Vista da Ponte Dom Luís I"
    }
  ]
}
```

## 🌐 Rotas Principais

### API (Backend)

- `POST /api/sip/ingest` - Ingestão de SIP
- `GET /api/sip/aips` - Listar AIP
- `GET /api/public/aips` - AIP públicos
- `GET /api/sip/dip/:id/export` - Exportar DIP

### Frontend

- `/` - Página inicial pública
- `/dashboard` - Dashboard privado
- `/archive/upload` - Upload de SIP
- `/archive/aips` - Navegação de AIP
- `/timeline` - Vista cronológica

## 📈 Funcionalidades Avançadas

- **Logging Completo**: Todas as ações são registadas (`logger.js`)
- **Estatísticas**: Dashboard com métricas detalhadas (`statsController.js`)
- **API Documentation**: Swagger integrado
- **Responsive Design**: Interface adaptável a dispositivos móveis
- **Pesquisa**: Sistema de pesquisa por conteúdo e metadados

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js, Express, MongoDB, Mongoose, JWT, Multer
- **Frontend**: Pug, Bootstrap 5, JavaScript
- **Base de Dados**: MongoDB
- **Containerização**: Docker
- **Documentação**: Swagger/OpenAPI

## 📝 Notas de Desenvolvimento

- O sistema segue o padrão MVC
- Validação robusta de dados de entrada
- Gestão de erros centralizada
- Logs estruturados para auditoria
- Testes automáticos (em desenvolvimento)

## 🤝 Contribuições

Este é um projeto académico desenvolvido para a disciplina de Engenharia Web. Para sugestões ou melhorias, por favor contacte os autores do projeto.

## 📄 Licença

Projeto desenvolvido para fins académicos na Universidade do Minho.
