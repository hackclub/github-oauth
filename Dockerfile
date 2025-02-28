FROM node:23-alpine3.20

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm install

COPY . .

# build project
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]