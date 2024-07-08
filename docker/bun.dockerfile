# npm modules
FROM node:22.5.1 as npm
COPY package.json .
RUN npm install

# aws-lambda-adapter
FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.8.3 as aws-lambda-adapter

# Bun runtime
FROM oven/bun:1.1.19 as bun_bin
FROM debian:bookworm-20230703-slim as bun_runtime
COPY --from=aws-lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter
EXPOSE 8080
COPY --from=bun_bin /usr/local/bin/bun /usr/local/bin/bun
WORKDIR "/var/task"
COPY --from=npm /node_modules /var/task/node_modules
COPY . /var/task

# Warmup caches
RUN timeout 10s bun main.mjs || [ $? -eq 124 ] || exit 1

CMD ["bun", "main.mjs"]
