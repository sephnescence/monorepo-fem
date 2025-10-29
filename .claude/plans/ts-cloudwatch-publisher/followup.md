# Follow up

## Step 2 - Check the flags

    ``sh
    - Set strict error handling (`set -euo pipefail`)
    ``

I've never see u or o used before. I believe I've only ever seen e and x, though I might be confusing x with the chmod

## Step 2 - Claude even gave me the query

    ``sh
    fields @timestamp, service, event, metadata.container
    | filter event = "heartbeat"
    | sort @timestamp desc
    ``

## Step 2 - Claude told me about required IAM permissions

    ``sh
    Required IAM Permissions will now be:
    - logs:CreateLogGroup
    - logs:CreateLogStream
    - logs:PutLogEvents
    ``

## Step 2 originally produced a call to put-metric-data

Having asked Claude after step 2 - I asked for cloudwatch log, for sure, but if I'm after a time series graph, then CloudWatch can do that

I'd like to play around with that later

    ``sh
    # CloudWatch metric configuration
    NAMESPACE="MonorepoFEM/HeartbeatMetrics"
    METRIC_NAME="ServiceHeartbeat"
    METRIC_VALUE=1
    METRIC_UNIT="Count"

    # Function to publish metric to CloudWatch
    publish_metric() {
        aws cloudwatch put-metric-data \
            --namespace "${NAMESPACE}" \
            --metric-name "${METRIC_NAME}" \
            --value "${METRIC_VALUE}" \
            --unit "${METRIC_UNIT}" \
            --region "${AWS_REGION}" \
            --timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    }
    ``

## Step 4 - There are now duplicated commands for log and log_error

Perhaps I would prefer to get it to run ts so that I can have a helper package that references a consistent log and log_error

## Step 5 - Caching dependencies

I noticed that it's installing bash, aws-cli, and dcron, but I wonder if there's a way to better cache this layer, or rather, if I'm already going to be referencing these packages frequently, is it worth breaking up the docker file so other docker container can use a base that's already got common dependencies in there? I expect that DX over time would investigate something like this as a potential speed up
