# Cold Start Serverless Benchmarks

This repository contains cold start benchmarks for server-side JavaScript
applications, executed using different JavaScript runtimes, and deployed via
Docker images on AWS Lambda using
[AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter). For
more information, read our
[blog post summary](https://deno.com/blog/aws-lambda-coldstart-benchmarks).

# Benchmark Results

Results are discussed in the
[blog post](https://deno.com/blog/aws-lambda-coldstart-benchmarks). Raw data is
available in the [raw_results](raw_results) directory.

#### AWS Lambda configuration:

- Region: us-west2
- Memory: 512MB

#### Runtime versions:

- Deno: 1.45.2
- Bun: 1.1.19
- Node.js: 22.5.1

# How To Run Benchmarks

## Build Docker Images

Express app:

```bash
docker build --rm -t deno_express_app:latest -f docker/deno.dockerfile ./apps/express
docker build --rm -t node_express_app:latest -f docker/node.dockerfile ./apps/express
docker build --rm -t bun_express_app:latest -f docker/bun.dockerfile ./apps/express
```

Fastify app:

```bash
docker build --rm -t deno_fastify_app:latest -f docker/deno.dockerfile ./apps/fastify
docker build --rm -t node_fastify_app:latest -f docker/node.dockerfile ./apps/fastify
docker build --rm -t bun_fastify_app:latest -f docker/bun.dockerfile ./apps/fastify
```

Hono app:

```bash
docker build --rm -t deno_hono_app:latest -f docker/deno.dockerfile ./apps/hono
docker build --rm -t node_hono_app:latest -f docker/node.dockerfile ./apps/hono
docker build --rm -t bun_hono_app:latest -f docker/bun.dockerfile ./apps/hono
```

## Run Benchmarks

Once the Lambda functions are created using the Docker images, you can use the
[run_benchmark.ts](tools/run_benchmark.ts) script to run the benchmark for each
function. You'll need to provide the function ARN, the function invoke URL, and
the number of invocations as arguments.

The script forces a cold start for each iteration, parses `Init Duration` from
CloudWatch, and writes the results to stdout in CSV format.

e.g.

```bash
./tools/run_benchmark.ts arn:aws:lambda:us-west-2:123456789123:function:express_app_on_deno https://e6mpazwlnt5ykocyq3qcobotp40zdlpr.lambda-url.us-west-2.on.aws 25
```
