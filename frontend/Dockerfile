FROM node:lts

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json (se existir)
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar todo o código da aplicação
COPY . .

# Variável de porta
ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]