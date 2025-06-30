# Claude Command: Deploy

This command helps you deploy your application to various platforms with proper checks and validation.

## Usage

To deploy to the default environment:
```
/deploy
```

To deploy to a specific environment:
```
/deploy staging
/deploy production
```

With deployment options:
```
/deploy production --skip-tests --force
```

## What This Command Does

1. **Pre-deployment Validation**:
   - Runs all tests to ensure code quality
   - Performs type checking (if TypeScript)
   - Validates environment configuration
   - Checks for uncommitted changes
   - Verifies branch is up to date

2. **Build Preparation**:
   - Creates production build
   - Optimizes assets and bundles
   - Validates build artifacts
   - Generates deployment manifest

3. **Security Checks**:
   - Scans for security vulnerabilities
   - Validates environment variables
   - Checks for exposed secrets
   - Performs dependency audit

4. **Deployment Execution**:
   - Deploys to target environment
   - Runs database migrations (if needed)
   - Updates configuration
   - Performs health checks

5. **Post-deployment Verification**:
   - Validates deployment success
   - Runs smoke tests
   - Checks service health
   - Sends deployment notifications

## Supported Platforms

### Cloud Platforms
- **Vercel**: Next.js and static sites
- **Netlify**: Static sites and serverless functions
- **Railway**: Full-stack applications
- **AWS**: EC2, ECS, Lambda deployments
- **Google Cloud**: App Engine, Cloud Run
- **Azure**: App Service, Container Instances

### Container Platforms
- **Docker**: Local container deployment
- **Kubernetes**: Cluster deployments
- **Docker Swarm**: Multi-container orchestration

### Traditional Hosting
- **VPS/Dedicated Servers**: Via SSH deployment
- **Shared Hosting**: FTP/SFTP uploads

## Environment Configuration

### Development
```bash
# Deploys to development environment
/deploy dev
```
- Skips some validation checks
- Uses development configuration
- Enables debug logging
- Faster deployment process

### Staging
```bash
# Deploys to staging environment
/deploy staging
```
- Full validation and testing
- Production-like configuration
- Performance monitoring
- User acceptance testing ready

### Production
```bash
# Deploys to production environment
/deploy production
```
- Strictest validation checks
- Zero-downtime deployment
- Full monitoring and alerting
- Rollback capability

## Pre-deployment Checks

### Code Quality
- **Linting**: Ensures code follows style guidelines
- **Type Checking**: Validates TypeScript types
- **Tests**: Runs unit, integration, and e2e tests
- **Coverage**: Checks test coverage thresholds

### Security
- **Dependency Audit**: Checks for vulnerable packages
- **Secret Scanning**: Ensures no secrets in code
- **Environment Validation**: Verifies required env vars
- **Permission Checks**: Validates access controls

### Performance
- **Bundle Analysis**: Checks bundle size limits
- **Asset Optimization**: Compresses images and assets
- **Lighthouse**: Performance, accessibility, SEO checks
- **Load Testing**: Stress tests critical endpoints

## Deployment Strategies

### Blue-Green Deployment
- Maintains two identical environments
- Switches traffic after validation
- Instant rollback capability
- Zero downtime deployments

### Rolling Deployment
- Updates instances gradually
- Maintains service availability
- Lower resource requirements
- Slower rollback process

### Canary Deployment
- Deploys to subset of instances
- Monitors metrics and errors
- Gradual traffic increase
- Safe production testing

## Configuration Files

### Deployment Config
```yaml
# deploy.yml
environments:
  development:
    platform: vercel
    branch: develop
    auto_deploy: true
    
  staging:
    platform: railway
    branch: main
    require_approval: false
    
  production:
    platform: aws
    branch: main
    require_approval: true
    health_check_url: /health
```

### Environment Variables
```bash
# .env.production
NODE_ENV=production
DATABASE_URL=${DATABASE_URL}
API_KEY=${API_KEY}
```

## Command Options

### Validation Options
- `--skip-tests`: Skip running tests before deployment
- `--skip-lint`: Skip linting checks
- `--skip-security`: Skip security scans
- `--skip-build`: Use existing build artifacts

### Deployment Options
- `--force`: Force deployment despite warnings
- `--dry-run`: Simulate deployment without executing
- `--rollback`: Rollback to previous version
- `--tag <version>`: Deploy specific version tag

### Monitoring Options
- `--wait`: Wait for deployment completion
- `--health-check`: Perform post-deployment health checks
- `--smoke-test`: Run smoke tests after deployment

## Platform-Specific Instructions

### Vercel Deployment
```bash
/deploy production --platform vercel
```
- Automatically builds and deploys
- Handles serverless functions
- Provides preview URLs
- Manages custom domains

### Railway Deployment
```bash
/deploy staging --platform railway
```
- Containerized deployment
- Database integration
- Environment variable management
- Custom domain support

### AWS Deployment
```bash
/deploy production --platform aws --service ecs
```
- Supports multiple AWS services
- Blue-green deployment strategy
- Auto-scaling configuration
- CloudWatch monitoring

### Docker Deployment
```bash
/deploy production --platform docker --registry ecr
```
- Builds and pushes Docker images
- Updates container orchestration
- Handles multi-service deployments
- Rolling update strategy

## Monitoring and Alerting

### Health Checks
- **Endpoint Monitoring**: Checks critical API endpoints
- **Database Connectivity**: Validates database connections
- **External Services**: Verifies third-party integrations
- **Performance Metrics**: Monitors response times

### Error Tracking
- **Error Rates**: Monitors application error rates
- **Performance Degradation**: Detects slow responses
- **Availability**: Tracks uptime metrics
- **User Experience**: Monitors user-facing errors

### Notifications
- **Slack**: Deployment status updates
- **Email**: Critical failure alerts
- **Discord**: Team notifications
- **PagerDuty**: On-call incident alerts

## Rollback Procedures

### Automatic Rollback
- Health check failures
- Error rate thresholds
- Performance degradation
- User-defined conditions

### Manual Rollback
```bash
/deploy rollback production
/deploy rollback --version v1.2.3
```

### Rollback Verification
- Validates previous version stability
- Checks data consistency
- Verifies feature functionality
- Monitors for issues

## Troubleshooting

### Common Issues

#### Build Failures
- Check build logs for specific errors
- Verify dependencies are installed
- Ensure environment variables are set
- Validate configuration files

#### Deployment Timeouts
- Check network connectivity
- Verify platform status
- Increase timeout settings
- Review resource limits

#### Health Check Failures
- Verify endpoint accessibility
- Check database connections
- Validate external dependencies
- Review application logs

#### Environment Issues
- Confirm environment variables
- Check configuration differences
- Verify secrets management
- Review access permissions

### Debugging Commands
```bash
/deploy --dry-run production    # Simulate deployment
/deploy --verbose staging       # Detailed logging
/deploy --debug development     # Debug mode
```

## Best Practices

### Pre-deployment
1. **Test Thoroughly**: Run all tests locally
2. **Review Changes**: Check git diff before deployment
3. **Update Documentation**: Keep deployment docs current
4. **Backup Data**: Ensure recent backups exist

### During Deployment
1. **Monitor Closely**: Watch deployment progress
2. **Check Logs**: Review application logs
3. **Validate Health**: Ensure health checks pass
4. **Test Functionality**: Verify key features work

### Post-deployment
1. **Monitor Metrics**: Watch performance indicators
2. **Check Errors**: Monitor error rates
3. **User Testing**: Verify user experience
4. **Document Issues**: Record any problems found

## Security Considerations

### Secrets Management
- Use platform-provided secret stores
- Rotate secrets regularly
- Limit secret access permissions
- Audit secret usage

### Access Control
- Implement deployment permissions
- Use service accounts for automation
- Enable audit logging
- Review access regularly

### Network Security
- Configure firewalls properly
- Use HTTPS for all traffic
- Implement rate limiting
- Monitor for suspicious activity

---

*This command provides a comprehensive deployment workflow while maintaining security and reliability standards.*