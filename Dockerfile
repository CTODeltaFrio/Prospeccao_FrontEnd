FROM node:18-alpine

# Instalar servidor estático
RUN npm install -g serve

# Copiar arquivos do frontend
COPY . /app

# Definir diretório de trabalho
WORKDIR /app

# Expor porta 3000 (padrão do serve)
EXPOSE 3000

# Comando para servir os arquivos
CMD ["serve", "-s", ".", "-l", "3000"]