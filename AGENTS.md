# Project Instructions

> **IMPORTANT**: These instructions are MANDATORY. Follow them exactly.

<!-- KNOWNS GUIDELINES START -->
# Knowns Project

This project uses **Knowns CLI** for task and documentation management.

## Before Starting

Run this command to get usage guidelines:

```bash
knowns agents guideline
```

This will output the complete rules for:
- Task management workflow
- Documentation commands
- Time tracking
- Reference system
- Common mistakes to avoid

You MUST call this at session start and follow every rule it outputs. If any rule cannot be followed, stop and ask for guidance before proceeding.

## Quick Commands

```bash
# Get guidelines (run this first!)
knowns agents guideline

# List tasks
knowns task list --plain

# List docs
knowns doc list --plain

# Edit task properties  
knowns task edit [option] <id>

Arguments:
  id                        Task ID

Options:
  -t, --title <text>        New title
  -d, --description <text>  New description
  -s, --status <status>     New status
  --priority <level>        New priority
  -l, --labels <labels>     Comma-separated labels
  -a, --assignee <name>     Assignee
  --parent <id>             Move task to new parent (use 'none' to remove parent)
  --ac <text>               Add new acceptance criterion (can be used multiple times) (default: [])
  --check-ac <index>        Check acceptance criterion by index (1-based, can be used multiple times) (default: [])
  --uncheck-ac <index>      Uncheck acceptance criterion by index (1-based, can be used multiple times) (default: [])
  --remove-ac <index>       Remove acceptance criterion by index (1-based, can be used multiple times) (default: [])
  --plan <text>             Implementation plan
  --notes <text>            Implementation notes (replaces existing)
  --append-notes <text>     Append to implementation notes
  -h, --help                display help for command
```

**Important:** Always read the guidelines before working on tasks.
<!-- KNOWNS GUIDELINES END -->



