# Claude Command: Setup

This command helps you set up a new project from the Claude Code template.

## Usage

To set up a new project:
```
/setup
```

Or with a specific project name:
```
/setup my-new-project
```

## What This Command Does

1. **Project Initialization**:
   - Prompts for project name if not provided
   - Creates project directory structure
   - Copies template files to appropriate locations

2. **Template Customization**:
   - Processes all `.template` files and removes the `.template` extension
   - Replaces `[REPLACE: ...]` placeholders with project-specific values
   - Updates `CLAUDE.md` with project context
   - Customizes `package.json` with project details

3. **Git Initialization**:
   - Initializes a new Git repository
   - Creates initial commit with template files
   - Sets up Git hooks (if Husky is configured)

4. **Dependency Installation**:
   - Detects package manager (npm, yarn, pnpm)
   - Installs project dependencies
   - Sets up development environment

5. **Environment Setup**:
   - Creates `.env` file from `.env.template`
   - Prompts for essential environment variables
   - Sets up local development configuration

## Project Information Prompts

The setup command will ask for the following information:

### Basic Information
- **Project Name**: Used for package.json name and directory
- **Description**: Brief project description
- **Author**: Your name and email
- **License**: Project license (MIT, Apache-2.0, etc.)
- **Repository URL**: Git repository URL

### Technology Stack
- **Framework**: React, Next.js, Vue, etc.
- **Language**: TypeScript, JavaScript, Python, etc.
- **Database**: PostgreSQL, MongoDB, MySQL, etc.
- **Styling**: Tailwind, Styled Components, CSS Modules, etc.

### Development Configuration
- **Package Manager**: npm, yarn, or pnpm
- **Testing Framework**: Jest, Vitest, Pytest, etc.
- **Linting**: ESLint, Prettier configuration
- **Build Tool**: Vite, Webpack, etc.

### Environment Variables
- **Database URL**: Connection string for your database
- **API Keys**: External service API keys (optional)
- **Auth Secrets**: JWT secrets and session keys
- **External Services**: Third-party service configurations

## Generated Project Structure

After setup, your project will have:

```
my-new-project/
├── src/                    # Source code directory
├── public/                 # Static assets
├── tests/                  # Test files
├── docs/                   # Documentation
├── ai_docs/                # AI-specific documentation
│   ├── architecture.md     # Architecture overview
│   ├── decisions.md        # Architecture decision records
│   └── context.md          # AI development context
├── specs/                  # Technical specifications
│   ├── requirements.md     # Project requirements
│   └── api-spec.md         # API specification
├── .claude/                # Claude Code configuration
│   ├── settings.local.json # Claude permissions
│   └── commands/           # Custom commands
├── .env                    # Environment variables
├── .gitignore             # Git ignore patterns
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── Dockerfile             # Container configuration
├── docker-compose.yml     # Multi-service setup
├── CLAUDE.md              # Project context for Claude
└── README.md              # Project documentation
```

## Customization Options

### Framework-Specific Setup
The setup command can configure different project types:

- **Next.js**: Full-stack React applications
- **React**: Client-side React applications
- **Vue.js**: Vue applications with Vite
- **Node.js**: Backend API servers
- **Python**: FastAPI or Django applications
- **Go**: Go web applications

### Database Configuration
Supports various database setups:
- **PostgreSQL**: With connection pooling
- **MongoDB**: With Mongoose ODM
- **MySQL**: With Prisma ORM
- **SQLite**: For local development

### Development Tools
Automatically configures:
- **Linting**: ESLint, Prettier, or language-specific linters
- **Testing**: Jest, Vitest, Pytest, or Go testing
- **Git Hooks**: Pre-commit hooks for code quality
- **Docker**: Development and production containers

## Post-Setup Steps

After running the setup command:

1. **Review Configuration**:
   - Check `CLAUDE.md` for accuracy
   - Verify environment variables in `.env`
   - Confirm dependencies in `package.json`

2. **Start Development**:
   ```bash
   cd my-new-project
   npm run dev  # or yarn dev, pnpm dev
   ```

3. **Customize Further**:
   - Update Claude commands for your workflow
   - Add project-specific documentation
   - Configure additional tools as needed

4. **Initialize Remote Repository**:
   ```bash
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

## Command Options

- `--name <project-name>`: Specify project name without prompting
- `--framework <framework>`: Pre-select framework (react, nextjs, vue, etc.)
- `--package-manager <pm>`: Pre-select package manager (npm, yarn, pnpm)
- `--database <db>`: Pre-select database (postgresql, mongodb, mysql, etc.)
- `--skip-install`: Skip dependency installation
- `--skip-git`: Skip Git initialization
- `--template <template>`: Use alternative template

## Examples

### Basic Setup
```bash
/setup
# Interactive prompts for all configuration
```

### Quick Next.js Setup
```bash
/setup my-nextjs-app --framework nextjs --package-manager pnpm
```

### Python API Setup
```bash
/setup my-api --framework fastapi --database postgresql
```

### Skip Installation
```bash
/setup my-project --skip-install
# Set up files but don't install dependencies
```

## Troubleshooting

### Common Issues

#### Permission Errors
- Ensure you have write permissions in the target directory
- Run with appropriate permissions if needed

#### Template File Errors
- Verify all template files are present in the source
- Check that placeholder syntax is correct

#### Dependency Installation Failures
- Check internet connection
- Verify package manager is installed
- Try manual installation after setup

#### Git Initialization Issues
- Ensure Git is installed and configured
- Check if directory already contains a Git repository

### Getting Help

If you encounter issues:
1. Check the error message for specific guidance
2. Verify all prerequisites are installed
3. Try running individual setup steps manually
4. Consult project documentation

## Best Practices

1. **Before Setup**:
   - Plan your project structure
   - Have repository URL ready
   - Know your technology preferences

2. **During Setup**:
   - Provide meaningful project descriptions
   - Use consistent naming conventions
   - Configure all necessary environment variables

3. **After Setup**:
   - Review generated files before committing
   - Test the development environment
   - Update documentation as needed

---

*This command automates project initialization while maintaining consistency with Claude Code best practices.*