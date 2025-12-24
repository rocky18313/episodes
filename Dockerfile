FROM node:20-slim

RUN apt-get update && \
    apt-get install -y curl unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun && \
    ln -s /root/.bun/bin/bunx /usr/local/bin/bunx

RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PORT=3829

EXPOSE ${PORT}

COPY package*.json ./

RUN bun install

COPY . .


CMD ["bun", "run", "start"]