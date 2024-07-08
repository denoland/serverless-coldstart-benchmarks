# npm modules
FROM node:22.5.1 as npm
COPY package.json .
RUN npm install

# aws-lambda-adapter
FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.8.3 as aws-lambda-adapter

# Node.js runtime
FROM node:22.5.1 as node_bin
FROM debian:bookworm-20230703-slim as node_runtime
COPY --from=aws-lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter
EXPOSE 8080
COPY --from=node_bin /usr/local/bin/node /usr/local/bin/node
WORKDIR "/var/task"
COPY --from=npm /node_modules /var/task/node_modules
COPY . /var/task

ENV NODE_COMPILE_CACHE=/home/node_cache

# Warmup caches
RUN timeout 10s node main.mjs || [ $? -eq 124 ] || exit 1

CMD ["node", "main.mjs"]
