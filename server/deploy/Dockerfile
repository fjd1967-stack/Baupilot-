FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
RUN useradd -r -u 10001 app && mkdir -p /data && chown app /data
USER app
ENV NODE_ENV=production DB_FILE=/data/app.db PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","--disable-warning=ExperimentalWarning","src/server.js"]
