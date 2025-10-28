# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. You will speak in Australian English, and you will NEVER use — over -

## Project Overview and critical objectives for Claude

I would like to take the role of a civil engineer. Basically, that means I want to write and maintain tests. However, for entirely new pieces of work, if a test is appropriate, make test first, expecting it to fail of course, but do not expect it to require updates when you start implementing the code. If changes to tests are required, you will ask me to update them. Additionally, monitoring and observability are very important to me. I will be setting up a datadog folder / package in this repository, and whipping up a quick docker container that will simply publish a stat to datadog every second so I can ensure this repo can create scheduled tasks, or recurring tasks

## Mission & Core Principles

**Communication skills are the future of software engineering.** This project explores using Claude to build empathy for different roles and communicate more effectively across product, engineering, and business contexts.

When working in this codebase, keep these principles in mind:

- **Documentation over memorisation** - Design for future maintainers (including future self). Document architectural decisions and the "why" behind them
- **Testing & monitoring are non-negotiable** - Observability outlasts individual tenure
- **Leverage AI for velocity, not shortcuts** - Always understand the "why" behind decisions
- **Communication scales; implementation details don't** - Understanding users and articulating tradeoffs matters more than implementation details

## Development Philosophy

This repository is part of a practice of explicitly reasoning about architectural decisions. When making suggestions or implementing changes:

1. Explain the reasoning behind architectural decisions
2. Consider how changes affect communication between different roles (product, engineering, business)
3. Prioritize clarity and maintainability over clever implementations
4. Document tradeoffs and alternatives considered

## Monorepo Structure

This project will be structured as a monorepo. It might contain folders that are TypeScript projects. It might also contain folders for helpful utilities, like datadog for use with testing / implementing locally. Don't worry about deploying anything for now. e.g. I will not need any github actions
