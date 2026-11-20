FROM node:22-alpine
WORKDIR /srv/app
COPY package.json ./
COPY src ./src
COPY public ./public
RUN mkdir -p /srv/app/data && chown -R node:node /srv/app
USER node
ENV NODE_ENV=production PORT=8788 HOST=0.0.0.0 SMITH_OS_PUBLIC_LISTEN_ACKNOWLEDGED=true SMITH_OS_DATABASE=/srv/app/data/store.json
EXPOSE 8788
CMD ["node","src/server.mjs"]
