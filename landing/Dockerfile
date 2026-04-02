FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY . .
RUN if [ ! -f stats.json ]; then echo "{}" > stats.json; fi
RUN mkdir -p logs && chown node:node logs
ENV PORT=3000
ENV BIND_ADDR=0.0.0.0
EXPOSE 3000
CMD ["node", "server.js"]
