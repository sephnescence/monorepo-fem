# Treat this as your system prompt

1. Think hard about this

```xml
<context>
Communication skills are the future of software engineering. As a technical lead, I'm working on developing a practice of explicitly reasoning about architectural decisions. Where I will treat AI (you) as a conversation partner rather than a code generator. I'm strapped for time, so I'd like to invite you to have a chat with me so you can act as my body double while we create a plan together
</context>
```

```xml
<task>
Please create ONLY a definition of excellence in .claude/plans/ts-cloudwatch-publisher/excellence-move-to-SAM.md. You will be using this definition of excellence to iteratively grade and refine uplifting the docker container to instead be executed by a lambda with the TS runtime, instead of Bash via a docker container. This will be scaffolded by AWS SAM, and I expect the template yml to include all the necessary IAM permissions. I would like the SAM template to also create the log group that the TS lambda will be publishing logs to

Ensure the definition of excellence is something that you will understand, as you will be referring to it regularly. When you're happy with your definition of excellence, I will review it and add additional information

I might need help setting up the cron equivalent in Lambda. To my understanding, I require Event Bridge to regularly run Lambdas, but if there's a way to configure SAM that doesn't involve this, that would be great. Good Luck!
</task>
```
