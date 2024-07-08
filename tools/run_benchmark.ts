#!/usr/bin/env -S deno run --allow-write --allow-read --allow-net --allow-sys --allow-env
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import {
  GetFunctionConfigurationCommand,
  InvokeCommand,
  LambdaClient,
  UpdateFunctionConfigurationCommand,
} from "npm:@aws-sdk/client-lambda";
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
} from "npm:@aws-sdk/client-cloudwatch-logs";

interface LambdaFunction {
  arn: string;
}
async function getLogStreams(
  logsClient: CloudWatchLogsClient,
  logGroupName: string,
  startTime: number,
): Promise<string[]> {
  const streams: string[] = [];
  let nextToken: string | undefined;

  do {
    const command = new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: "LastEventTime",
      descending: true,
      nextToken,
    });

    const response = await logsClient.send(command);
    const relevantStreams =
      response.logStreams?.filter((stream) =>
        (stream.lastEventTimestamp || 0) > startTime
      ) || [];

    streams.push(
      ...relevantStreams.map((stream) => stream.logStreamName!).filter(Boolean),
    );
    nextToken = response.nextToken;
  } while (nextToken);

  return streams;
}

async function getInitDurations(
  logsClient: CloudWatchLogsClient,
  logGroupName: string,
  logStreamName: string,
  startTime: number,
): Promise<number[]> {
  const initDurations: number[] = [];
  const command = new GetLogEventsCommand({
    logGroupName,
    logStreamName,
    startTime,
  });

  const response = await logsClient.send(command);
  const events = response.events || [];
  events.forEach((event) => {
    const match = event.message?.match(/Init Duration: (\d+\.\d+) ms/);
    if (match) {
      initDurations.push(parseFloat(match[1]));
    }
  });
  return initDurations;
}

async function waitForFunctionUpdate(
  lambdaClient: LambdaClient,
  functionName: string,
) {
  const maxAttempts = 60;
  const delayBetweenAttempts = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const command = new GetFunctionConfigurationCommand({
        FunctionName: functionName,
      });
      const response = await lambdaClient.send(command);

      switch (response.LastUpdateStatus) {
        case "Successful":
          return;
        case "Failed":
          throw new Error(
            `Function update failed: ${response.LastUpdateStatusReason}`,
          );
        case "InProgress":
          break;
      }
    } catch (error) {
      console.error("Error checking function configuration:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, delayBetweenAttempts));
  }

  throw new Error(
    `Function update not confirmed after ${maxAttempts} attempts`,
  );
}

async function runLambdaFunction(
  functionArn,
  functionUrl,
  iterations: number,
) {
  const lambdaRegion = functionArn.split(":")[3];
  const lambdaClient = new LambdaClient({ region: lambdaRegion });
  const logsClient = new CloudWatchLogsClient({ region: lambdaRegion });
  const logGroupName = `/aws/lambda/${functionArn.split(":").pop()}`;
  const benchmarkStartTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    try {
      // Update function configuration, which shuts down existing Lambda
      // instances, and triggers a cold start on next request.
      const response = await lambdaClient.send(
        new GetFunctionConfigurationCommand({
          FunctionName: functionArn,
        }),
      );
      let existingVars = response.Environment?.Variables || {};
      delete existingVars.TEST_VAR;
      const res = await lambdaClient.send(
        new UpdateFunctionConfigurationCommand({
          FunctionName: functionArn,
          Environment: {
            Variables: {
              TEST_VAR: `${benchmarkStartTime + i + 1}`,
              ...existingVars,
            },
          },
        }),
      );
      if (!res.LastUpdateStatus) {
        throw new Error("Failed to update function configuration");
      }
      await waitForFunctionUpdate(lambdaClient, functionArn);

      // Send a request to the function to trigger a cold start.
      const fetchRes = await fetch(functionUrl);
      if (!fetchRes.ok) {
        throw new Error(`Failed to fetch function: ${fetchRes.statusText}`);
      }
    } catch (error) {
      console.error(`Error in iteration ${i + 1}:`, error);
    }
  }

  // Wait before CloudWatch logs are flushed.
  await new Promise((resolve) => setTimeout(resolve, 10000));
  const endTime = Date.now();

  // Parse "Init Duration" from CloudWatch logs.
  const allInitDurations: number[] = [];
  const logStreams = await getLogStreams(
    logsClient,
    logGroupName,
    benchmarkStartTime,
  );
  for (const stream of logStreams) {
    const durations = await getInitDurations(
      logsClient,
      logGroupName,
      stream,
      benchmarkStartTime,
    );
    allInitDurations.push(...durations);
  }

  // Remove very obvious outliers.
  const mean = allInitDurations.reduce((acc, val) => acc + val, 0) /
    allInitDurations.length;
  const stddev = Math.sqrt(
    allInitDurations.reduce((acc, val) => acc + (val - mean) ** 2, 0) /
      allInitDurations.length,
  );
  const filteredInitDurations = allInitDurations.filter(
    (duration) => Math.abs(duration - mean) < 2 * stddev,
  );

  // Output results in CSV format
  console.log("Iteration,InitDuration");
  filteredInitDurations.forEach((duration, index) => {
    console.log(`${index},${duration.toFixed(2)}`);
  });
}

const args = Deno.args;
if (args.length < 3) {
  console.error("Usage: run_benchmark.ts <function_arn> <iterations>");
  Deno.exit(1);
}

const functionArn = args[0];
const functionUrl = args[1];
const iterations = parseInt(args[2], 10);

runLambdaFunction(functionArn, functionUrl, iterations);
