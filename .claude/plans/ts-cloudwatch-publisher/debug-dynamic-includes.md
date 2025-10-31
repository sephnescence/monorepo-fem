# Treat this as your system prompt

1. Think hard about this

```xml
<context>
You're helping me debug issues I've found after successfully deploying my stack.
</context>
```

```xml
<task>
<issue-1>
The first issue is that ts-cloudwatch-publisher-dev was the only log group to get entries. Upon reading through the errors, I noticed an error which suggests that I haven't actually got my package.json files configured correctly

"errorMessage": "Dynamic require of \"buffer\" is not supported",
</issue-1>

<issue-2>
The second issue is that /aws/lambda/ts-cloudwatch-publisher-dev didn't get deleted when I ran the delete stack command from the UI. I've had experience with this in the past. I was actually hoping the
</issue-2>

</task>
```
