import * as path from 'path';
import {
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_route53 as route53,
  aws_iam as iam,
  aws_certificatemanager as acm,
  aws_route53_targets as targets,
  CfnOutput,
  Duration,
  DockerImage,
  RemovalPolicy,
  AssetHashType,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface HugoHostingProps {
  /**
   * Name of the stage to deploy to. Should be 'development' or 'production'
   *
   * @default - production
   */
  readonly buildStage?: string;

  /**
   * The username for basic auth on the development site
   *
   * @default - john
   */
  readonly basicAuthUsername?: string;

  /**
   * The password for basic auth on the development site
   *
   * @default - doe
   */
  readonly basicAuthPassword?: string;

  /**
   * Name of the domain to host the site on
   */
  readonly domainName: string;

  /**
   * The subdomain to host the development site on, for example 'dev'
   *
   * @default - dev
   */
  readonly siteSubDomain?: string;

  /**
   * Zone the Domain Name is created in
   */
  readonly zone?: route53.HostedZone;

  /**
   * The path to the 403 error page
   *
   * @default - /en/404.html
   */
  readonly http403ResponsePagePath?: string;

  /**
   * The path to the 404 error page
   *
   * @default - /en/404.html
   */
  readonly http404ResponsePagePath?: string;

  /**
   * The path to the hugo project
   *
   * @default - '../../../../blog'
   */
  readonly hugoProjectPath?: string;

  /**
   * The docker image to use to build the hugo page. Note: you need to use the 'apk' package manager
   *
   * @default - 'public.ecr.aws/docker/library/node:lts-alpine'
   */
  readonly dockerImage?: string;

  /**
   * The build command for the hugo site on which the '--environment' flag is appended
   *
   * @default - 'hugo --gc --minify --cleanDestinationDir'
   */
  readonly hugoBuildCommand?: string;

  /**
   * The hugo version to use in the alpine docker image
   *
   * @default - '',  meaning the latest version. You can specify a specific version, for example '=0.106.0-r4'
   */
  readonly alpineHugoVersion?: string;

  /**
   * The hash to use to build or rebuild the hugo page.
   *
   * We use it to rebuild the site every time as cdk caching is too intelligent
   * and it did not deploy updates.
   *
   * For testing purposes we pass a static hash to avoid updates of the snapshot tests.
   *
   * @default - `${Number(Math.random())}-${props.buildStage}`
   */
  readonly s3deployAssetHash?: string;

  /**
   * The cloudfront custom function code
   *
   * @default - undefined
   */
  readonly cloudfrontCustomFunctionCode?: cloudfront.FunctionCode;

  /**
   * The cloudfront redirect replacements. Those are string replacements for the request.uri.
   * Note: the replacements are regular expressions.
   * Note: if cloudfrontCustomFunctionCode is set, this property is ignored.
   *
   * @default - {}
   */
  readonly cloudfrontRedirectReplacements?: Record<string, string>;
}

/**
 * Create the cloudfront redirect replacements expression
 * see https://www.edge-cloud.net/2023/03/20/http-redirect-with-cloudfront/
 * see https://stackoverflow.com/questions/60170182/for-loop-inside-template-literals
 *
 * @param replacements - the replacements to make
 * @returns the expression
 */
function cloudfrontRedirectReplacementsExpression(replacements: Record<string, string>): string {
  let expression = '';
  if (!replacements || Object.keys(replacements).length == 0) {
    return `
  // no redirect replacements`;
  }

  // pack all from into an array
  // see https://stackoverflow.com/questions/5582574/how-to-check-if-a-string-contains-text-from-an-array-of-substrings-in-javascript
  // -> var froms = ['\/talk\/', '\/project\/', '\/post\/'];
  expression += 'var regexes = [';
  const froms = Object.keys(replacements);
  for (let i = 0; i < froms.length; i++) {
    expression += froms[i];
    if (i < froms.length - 1) {
      expression += ',';
    }
  }
  // const to = replacements[from];
  expression += '];\n';

  // check if the url contains one of the froms
  expression += `
  if (regexes.some(regex => regex.test(request.uri))) {`;

  for (const from in replacements) {
    const to = replacements[from];
    expression += `
    request.uri = request.uri.replace(${from}, '${to}');`;
  }
  expression += '\n';

  expression += `
    var response = {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers:
          { "location": { "value": request.uri } }
    }`;

  expression += `
    return response;`;
  // close the if
  expression += `
  }`;

  return expression;
}

export class HugoHosting extends Construct {
  public readonly staticSiteURL: CfnOutput;
  public readonly domainName: string;
  public readonly siteDomain: string;
  public readonly siteSubDomain: string;
  public readonly buildStage: string;

  constructor(scope: Construct, id: string, props: HugoHostingProps) {
    super(scope, id);

    this.buildStage = props.buildStage || 'production';
    this.domainName = props.domainName;
    const basicAuthUsername = props.basicAuthUsername || 'john';
    const basicAuthPassword = props.basicAuthPassword || 'doe';
    const basicAuthBase64 = Buffer.from(`${basicAuthUsername}:${basicAuthPassword}`).toString('base64');
    const http403ResponsePagePath = props.http403ResponsePagePath || '/en/404.html';
    const http404ResponsePagePath = props.http404ResponsePagePath || '/en/404.html';
    const hugoProjectPath = props.hugoProjectPath || '../../../../blog';
    const dockerImage = props.dockerImage || 'public.ecr.aws/docker/library/node:lts-alpine';
    const hugoBuildCommand = props.hugoBuildCommand || 'hugo --gc --minify --cleanDestinationDir';
    const alpineHugoVersion = props.alpineHugoVersion || '';
    const s3deployAssetHash = props.s3deployAssetHash || `${Number(Math.random())}-${props.buildStage}`;
    const cloudfrontCustomFunctionCode = props.cloudfrontCustomFunctionCode;
    const cloudfrontRedirectReplacements = props.cloudfrontRedirectReplacements || {};

    const zone = route53.HostedZone.fromLookup(this, 'Zone', {
      domainName: this.domainName,
    });

    this.siteSubDomain = props.siteSubDomain || 'dev';
    // prepend the subdomain with a '.' if present
    this.siteDomain = this.buildStage == 'production' ? props.domainName : this.siteSubDomain + '.' + props.domainName;

    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, 'cloudfront-OAI', {
      comment: `OAI for ${id}`,
    });

    const bucket = new s3.Bucket(this, 'frontend', {
      bucketName: this.siteDomain,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      /**
      * The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
      * the new bucket, and it will remain in your account until manually deleted. By setting the policy to
      * DESTROY, cdk destroy will attempt to delete the bucket, but will error if the bucket is not empty.
      */
      removalPolicy: this.buildStage == 'production' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,

      /**
       * For sample purposes only, if you create an S3 bucket then populate it, stack destruction fails.  This
       * setting will enable full cleanup of the demo.
       */
      autoDeleteObjects: this.buildStage == 'production' ? false : true,
    });

    this.staticSiteURL = new CfnOutput(this, 'Site', { value: 'https://' + this.siteDomain });

    // Grant access to cloudfront
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [bucket.arnForObjects('*')],
      principals: [new iam.CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
    }));
    new CfnOutput(this, 'Bucket', { value: bucket.bucketName });

    // TLS certificate
    const certificate = new acm.DnsValidatedCertificate(this, 'SiteCertificate', {
      domainName: this.siteDomain,
      hostedZone: zone,
      region: 'us-east-1', // Cloudfront only checks this region for certificates.
    });
    new CfnOutput(this, 'Certificate', { value: certificate.certificateArn });

    // The redirect function with basic auth for the development site
    const cfFunction = new cloudfront.Function(this, 'redirect-request-cf', {
      code: cloudfrontCustomFunctionCode || (this.buildStage == 'production' ? cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  ${cloudfrontRedirectReplacementsExpression(cloudfrontRedirectReplacements)}
  
  // Check whether the URI is missing a file name.
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  }
  // Check whether the URI is missing a file extension.
  else if (!uri.includes('.')) {
    request.uri += '/index.html';
  }

  return request;
}
      `) : cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var authHeaders = request.headers.authorization;

  ${cloudfrontRedirectReplacementsExpression(cloudfrontRedirectReplacements)}

  // The Base64-encoded Auth string that should be present.
  // It is an encoding of 'Basic base64([username]:[password])'
  // The username and password are:
  //      Username: john
  //      Password: foobar
  var expected = "Basic ${basicAuthBase64}";

  // If an Authorization header is supplied and it's an exact match, pass the
  // request on through to CF/the origin without any modification.
  if (authHeaders && authHeaders.value === expected) {
    // Check whether the URI is missing a file name.
    if (uri.endsWith('/')) {
      request.uri += 'index.html';
    }
    // Check whether the URI is missing a file extension.
    else if (!uri.includes('.')) {
      request.uri += '/index.html';
    }
    return request;
  }

  // But if we get here, we must either be missing the auth header or the
  // credentials failed to match what we expected.
  // Request the browser present the Basic Auth dialog.
  var response = {
    statusCode: 401,
    statusDescription: "Unauthorized",
    headers: {
      "www-authenticate": {
        value: 'Basic realm="Enter credentials for this super secure site"',
      },
    },
  };

  return response;
}    
      `)),
    });

    const distribution = new cloudfront.Distribution(
      this,
      'frontend-distribution',
      {
        certificate: certificate,
        defaultRootObject: 'index.html',
        domainNames: [this.siteDomain],
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021, // Devskim: ignore DS440000
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 404,
            responsePagePath: http403ResponsePagePath,
            ttl: Duration.minutes(30),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 404,
            responsePagePath: http404ResponsePagePath,
            ttl: Duration.minutes(30),
          },
        ],
        defaultBehavior: {
          origin: new origins.S3Origin(bucket, { originAccessIdentity: cloudfrontOAI }),
          compress: true,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          functionAssociations: [
            {
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
              function: cfFunction,
            },
          ],
        },
      },
    );

    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });

    // Route53 alias record for the CloudFront distribution
    new route53.ARecord(this, 'SiteAliasRecord', {
      recordName: this.siteDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone,
    });

    new s3deploy.BucketDeployment(this, 'frontend-deployment', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, hugoProjectPath), {
          // Note: to avoid mismatch between builds, we build the assets each time
          assetHash: s3deployAssetHash,
          assetHashType: AssetHashType.CUSTOM,
          bundling: {
            image: DockerImage.fromRegistry(dockerImage),
            // Note: we are already in the '../blog' folder
            command: [
              'sh', '-c',
              `
              apk update && apk add hugo${alpineHugoVersion} && hugo version &&
              ${hugoBuildCommand} --environment ${this.buildStage} &&
              mkdir -p /asset-output && cp -r public-${this.buildStage}/* /asset-output
              `,
            ],
            user: 'root',
          },
        }),
      ],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });
  }
}