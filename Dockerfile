FROM node:23-alpine

LABEL name="forecast-mcp"

WORKDIR /app

COPY build/index.mjs .

CMD ["node", "index.mjs"]
