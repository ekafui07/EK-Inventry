#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');

// Command line arguments (e.g. node deploy-frontend.js --stage prod --skip-tests)
const stageArg = process.argv.find((arg, i) => process.argv[i - 1] === '--stage') || 'prod';
const skipTests = process.argv.includes('--skip-tests');
const region = process.env.AWS_REGION || 'us-east-1';
const stackName = `ek-gearflow-backend-${stageArg}`;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

async function getStackOutputs() {
  console.log(`[1/4] Fetching CloudFormation outputs for stack '${stackName}'...`);
  const cfn = new CloudFormationClient({ region });
  const response = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
  
  if (!response.Stacks || response.Stacks.length === 0) {
    throw new Error(`Stack '${stackName}' not found in region ${region}. Ensure backend is deployed first.`);
  }
  
  const outputs = {};
  for (const o of response.Stacks[0].Outputs || []) {
    outputs[o.OutputKey] = o.OutputValue;
  }
  
  return outputs;
}

function getFilesRecursively(dir, base = dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getFilesRecursively(fullPath, base));
    } else if (entry.isFile()) {
      const relPath = path.relative(base, fullPath).replace(/\\/g, '/');
      files.push({ fullPath, relPath });
    }
  }
  return files;
}

async function uploadFrontend(bucketName, frontendDir) {
  console.log(`[2/4] Uploading static assets to S3 bucket '${bucketName}'...`);
  const s3 = new S3Client({ region });
  const files = getFilesRecursively(frontendDir);
  
  for (const file of files) {
    const ext = path.extname(file.fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isHtml = ext === '.html';
    
    // HTML files should revalidate; static assets (JS, CSS, images) can be cached long-term
    const cacheControl = isHtml 
      ? 'public, max-age=0, must-revalidate'
      : 'public, max-age=31536000, immutable';
      
    const fileBody = fs.readFileSync(file.fullPath);
    
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: file.relPath,
      Body: fileBody,
      ContentType: contentType,
      CacheControl: cacheControl
    }));
    
    console.log(`  ✓ Uploaded: ${file.relPath} (${contentType})`);
  }
  
  console.log(`Uploaded ${files.length} files successfully.`);
}

async function invalidateCloudFront(distributionId) {
  console.log(`[3/4] Invalidating CloudFront cache for distribution '${distributionId}'...`);
  const cf = new CloudFrontClient({ region });
  const callerReference = `inv-${Date.now()}`;
  
  const res = await cf.send(new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: callerReference,
      Paths: {
        Quantity: 1,
        Items: ['/*']
      }
    }
  }));
  
  console.log(`  ✓ Invalidation created: ${res.Invalidation.Id} (Status: ${res.Invalidation.Status})`);
}

async function main() {
  try {
    const frontendDir = path.resolve(__dirname, '../frontend');
    if (!fs.existsSync(frontendDir)) {
      throw new Error(`Frontend directory not found at: ${frontendDir}`);
    }

    if (skipTests) {
      console.log('⚠️ [0/4] Skipping pre-flight test suites (--skip-tests flag detected)...\n');
    } else {
      console.log('[0/4] Running pre-flight Contract Guardrails (8 test suites)...');
      const testRes = spawnSync('node', ['test-runner.js'], {
        cwd: __dirname,
        stdio: 'inherit'
      });
      if (testRes.status !== 0) {
        throw new Error('Contract Guardrails failed! Pre-flight test suite encountered regressions. Deployment aborted.');
      }
      console.log('  ✓ Contract Guardrails passed: All 8 test suites validated.\n');
    }

    const outputs = await getStackOutputs();
    const bucketName = outputs.FrontendBucketName;
    const distributionId = outputs.CloudFrontDistributionId;
    const domainName = outputs.CloudFrontDomainName;

    if (!bucketName) throw new Error('Missing FrontendBucketName in stack outputs');
    if (!distributionId) throw new Error('Missing CloudFrontDistributionId in stack outputs');

    await uploadFrontend(bucketName, frontendDir);
    await invalidateCloudFront(distributionId);

    console.log('\n======================================================');
    console.log('🚀 EK GearFlow Production Deployment Complete!');
    console.log('======================================================');
    console.log(`🌐 Live URL: https://${domainName}`);
    console.log(`📦 S3 Bucket: ${bucketName}`);
    console.log(`⚡ CloudFront ID: ${distributionId}`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Frontend Deployment Failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, getFilesRecursively };
