FROM node:23-alpine3.20

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm install

COPY . .

EXPOSE 3000
CMD ["yarn", "start"]