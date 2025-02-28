FROM node:23-alpine3.20

WORKDIR /app

COPY package.json .
COPY package-lock.json .

# build project
RUN npm run build

RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "start"]