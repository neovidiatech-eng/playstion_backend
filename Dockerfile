FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN ./node_modules/.bin/prisma generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma generate && ./node_modules/.bin/prisma db push && node dist/index.js"]
