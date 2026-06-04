FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
# If there were dependencies, we would run npm install here
# RUN npm install

COPY . .

ENV PORT=3003
ENV CMS_DB_PATH=/app/storage/cms.sqlite
EXPOSE 3003

CMD ["npm", "start"]
