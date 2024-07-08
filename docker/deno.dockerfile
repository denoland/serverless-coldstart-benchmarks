# npm modules
FROM node:22.5.1 as npm
COPY package.json .
RUN npm install

# aws-lambda-adapter
FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.8.3 as aws-lambda-adapter

# Deno runtime
FROM denoland/deno:1.45.2 AS deno_bin
FROM debian:bookworm-20230703-slim as deno_runtime
COPY --from=aws-lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter
EXPOSE 8080
COPY --from=deno_bin /usr/bin/deno /usr/local/bin/deno
WORKDIR "/var/task"
COPY --from=npm /node_modules /var/task/node_modules
COPY . /var/task

# Warmup caches
RUN timeout 10s deno run -A main.mjs || [ $? -eq 124 ] || exit 1

CMD ["deno", "run", "-A", "main.mjs"]
