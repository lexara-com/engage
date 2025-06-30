# Lexara Engage Documentation

This directory contains documentation for the Lexara Engage platform.

## Directory Structure

- `components/` - Documentation specific to individual components migrated from apps/
- `legacy/` - Legacy documentation from previous architecture

## Component Architecture

The platform is organized into 5 main components:

1. **Conversation Agent** - Core agentic worker (`worktrees/conversation-agent/`)
2. **MCP Servers** - Model Context Protocol servers (`worktrees/mcp-servers/`)
3. **Chat UI** - End-user chat interface (`worktrees/chat-ui/`)
4. **Firm Admin Portal** - Law firm management interface (`worktrees/firm-admin-portal/`)
5. **Platform Admin Portal** - Lexara employee administration (`worktrees/platform-admin-portal/`)

Each component has its own README.md and CLAUDE.md files in their respective worktree directories.

## Development Workflow

For multi-agent development using git worktrees, see:
- `../agents/coordinator/CLAUDE.md` - Coordinator instructions
- `../.github/ISSUE_TEMPLATE/` - Issue templates for agent communication

## Legacy Documentation

Historical documentation from the previous monolithic architecture is preserved in the `legacy/` directory for reference.