FROM node:23-alpine

LABEL name="forecast-mcp"

WORKDIR /app

COPY build/index.js .

CMD ["node", "index.js"]
