# Frontend edge infrastructure

This stack creates the development SPA entry point:

- private Amazon S3 bucket;
- Amazon CloudFront distribution;
- Origin Access Control (OAC);
- SPA route rewriting with CloudFront Functions;
- security response headers;
- an optional `/api/*` behavior for the authentication BFF.

The stack is intentionally deployed in two passes.

## Pass 1: create the SPA origin

```powershell
aws cloudformation deploy `
  --template-file .\template.yaml `
  --stack-name sntimnt-frontend-dev `
  --parameter-overrides EnvironmentName=dev `
  --profile sntimnt-dev `
  --region us-east-1 `
  --no-fail-on-empty-changeset
```

Read the generated application origin:

```powershell
$AppOrigin = aws cloudformation describe-stacks `
  --stack-name sntimnt-frontend-dev `
  --profile sntimnt-dev `
  --region us-east-1 `
  --query "Stacks[0].Outputs[?OutputKey=='AppOrigin'].OutputValue | [0]" `
  --output text
```

Use this exact HTTPS origin as the Cognito callback application origin.

## Pass 2: connect `/api/*`

After the authentication stack returns `AuthApiEndpoint`, extract only its
hostname and update this stack:

```powershell
$AuthApiEndpoint = "https://example.execute-api.us-east-1.amazonaws.com"
$ApiOriginDomainName = ([Uri]$AuthApiEndpoint).Host

aws cloudformation deploy `
  --template-file .\template.yaml `
  --stack-name sntimnt-frontend-dev `
  --parameter-overrides `
    EnvironmentName=dev `
    ApiOriginDomainName=$ApiOriginDomainName `
  --profile sntimnt-dev `
  --region us-east-1 `
  --no-fail-on-empty-changeset
```

CloudFront caching is disabled for `/api/*`. Only the authentication cookies,
required headers, and query strings are forwarded to the BFF.

## Upload a development artifact

Do not upload a production artifact until the protected production build passes.
For the current non-production integration environment, upload only a clearly
labelled demo build with no real users or data.

```powershell
$BucketName = aws cloudformation describe-stacks `
