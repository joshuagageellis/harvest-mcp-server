FROM node:24-alpine

LABEL name="forecast-mcp"

WORKDIR /app

COPY build/index.mjs .

CMD ["node", "index.mjs"]
