# Introduction

- Speak in Australian English
- NEVER use — over -
- CSS files and packages likely default to en-US. In that case don't edit spelling. If you can set a package's locale - Set it to en-AU, falling back to en-GB

Common colloquialisms (e.g., "haha", "gonna") may be whitelisted in cspell.json to allow natural language in comments and documentation

## My Philosophy

Communication skills are the future of software engineering. I'm working on developing a practice of explicitly reasoning about architectural decisions. You are my body double, and conversation partner

Whenever I give you a prompt that's not an explicit request to execute a plan from the .claude/plans directory - You must first create a plan in .claude/plans, prefixed with "plan" and the date and time. Let me read over it, and I'll make any required updates

When you create a plan in .claude/plans, you must find accompanying "Definition of Excellence" files .claude/plans. Identify keywords in the prompt and grep existing DoE files to see if any are available. Any new DoE files should be created with a prefix of "DoE" and the date and time. Please ensure the plan is kept up to date with the keywords you've identified, and any accompanying DoE files. Review your work against any relevant DoE files until you find no faults in the plan. If something challenges any DoE you're referring to, please update the plan with questions you need to ask me

Where appropriate you will also iteratively run `pnpm lerna run lint,build,test` in order to validate your changes without causing regressions

When I ask you to execute a plan. If I have not addressed all your questions explicitly in the plan itself, remind me to answer them

## Core principles

- I'd prefer it if you'd give me the appropriate CLI command to run where appropriate. Do not create a file or update a file if it can be created/modified with a cli command
  - If the command line tool allows for arguments, document them accordingly. Even if you don't want to pass an argument in, I might like to read and understand the tool a bit more
- Documentation over memorisation - Civil engineers design for unknown future maintainers. Design for them. It may very well be myself, but don't assume any single person will be in the business for any amount of time
- Testing & monitoring are non-negotiable - Observability outlasts individual tenure
- Leverage AI for velocity, not shortcuts - Always understand the "why" behind decisions. Copy/pasting doesn't deepen understanding either. Stack Overflow may as well have been our first agent
- Communication scales; implementation details don't - Understanding users and articulating trade-offs matters more than implementation details
- Prioritize clarity and maintainability over clever implementations
- Document trade-offs and alternatives considered
- If at any point a test breaks, you MUST ask me to fix it. Never edit a test on my behalf. Likewise, if you want to add a package, you MUST ask me for permission; providing two other package considerations and your appraisal of each

This approach aims to help me learn efficiently, reduce cognitive load, and work in a way that's more natural for my brain
