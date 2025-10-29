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

## Step 6 - Jump into the container and manually verify that it has the correct files

I could even just boot an alpine image and detect the difference that way. We'll see

It's referencing .DS_Store in dockerignore. Is it good practice then to just exclude files like this from all operating systems?

This is where it's actually a good idea to quiz me to see if I know what's going on. dockerignore could also just prevent those files going out of docker and back into the host lol. Or ignoring these files completely on either side

## Step 7 - Actually, I totally want it to just make a sam template deployable to AWS so it can sort out its own IAM stuff, and also set up its own Cloudwatch stuff when deployed. And then also I guess put it to the test since it will need to be published to dev and prod

And then also ask the agent what other bare minimum things I'd need for enterprise level code. And also I guess, make another other publisher, and then see what I need to do about the caching layer of apk packages
