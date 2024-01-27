import * as path from 'path';
import {
  Stage,
  StageProps,
  Stack,
  StackProps,
  aws_cloudfront as cloudfront,
  aws_codecommit as codecommit,
  pipelines,
  CfnOutput,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HugoHosting } from './hugoHosting';

export interface HugoHostingStackProps extends StackProps {
  readonly buildStage: string;
  readonly basicAuthUsername?: string;
  readonly basicAuthPassword?: string;
  readonly domainName: string;
  readonly siteSubDomain?: string;
  readonly http403ResponsePagePath?: string;
  readonly http404ResponsePagePath?: string;
  readonly hugoProjectPath?: string;
  readonly dockerImage?: string;
  readonly hugoBuildCommand?: string;
  readonly s3deployAssetHash?: string;
  readonly cloudfrontCustomFunctionCode?: cloudfront.FunctionCode;
  readonly cloudfrontRedirectReplacements?: Record<string, string>;
}

export class HugoHostingStack extends Stack {
  public readonly staticSiteURL: CfnOutput;

  constructor(scope: Construct, id: string, props: HugoHostingStackProps) {
    super(scope, id, props);

    const staticHosting = new HugoHosting(this, 'static-hosting', {
      buildStage: props.buildStage,
      basicAuthUsername: props.basicAuthUsername,
      basicAuthPassword: props.basicAuthPassword,
      siteSubDomain: props.siteSubDomain,
      domainName: props.domainName,
      http403ResponsePagePath: props.http403ResponsePagePath,
      http404ResponsePagePath: props.http404ResponsePagePath,
      hugoProjectPath: props.hugoProjectPath,
      hugoBuildCommand: props.hugoBuildCommand,
      dockerImage: props.dockerImage,
      s3deployAssetHash: props.s3deployAssetHash,
      cloudfrontCustomFunctionCode: props.cloudfrontCustomFunctionCode,
      cloudfrontRedirectReplacements: props.cloudfrontRedirectReplacements,
    });

    this.staticSiteURL = staticHosting.staticSiteURL;
  }
}

export interface HugoPageStageProps extends StageProps {
  readonly buildStage: string;
  readonly basicAuthUsername?: string;
  readonly basicAuthPassword?: string;
  readonly domainName: string;
  readonly siteSubDomain?: string;
  readonly http403ResponsePagePath?: string;
  readonly http404ResponsePagePath?: string;
  readonly hugoProjectPath?: string;
  readonly dockerImage?: string;
  readonly hugoBuildCommand?: string;
  readonly s3deployAssetHash?: string;
  readonly cloudfrontCustomFunctionCode?: cloudfront.FunctionCode;
  readonly cloudfrontRedirectReplacements?: Record<string, string>;
}
export class HugoPageStage extends Stage {
  public readonly staticSiteURL: CfnOutput;

  constructor(scope: Construct, id: string, props: HugoPageStageProps) {
    super(scope, id, props);

    const hugoHostingStack = new HugoHostingStack(this, 'hugo-blog-stack', {
      buildStage: props.buildStage,
      basicAuthUsername: props.basicAuthUsername,
      basicAuthPassword: props.basicAuthPassword,
      siteSubDomain: props.siteSubDomain,
      domainName: props.domainName,
      http403ResponsePagePath: props.http403ResponsePagePath,
      http404ResponsePagePath: props.http404ResponsePagePath,
      hugoProjectPath: props.hugoProjectPath,
      hugoBuildCommand: props.hugoBuildCommand,
      dockerImage: props.dockerImage,
      s3deployAssetHash: props.s3deployAssetHash,
      cloudfrontCustomFunctionCode: props.cloudfrontCustomFunctionCode,
      cloudfrontRedirectReplacements: props.cloudfrontRedirectReplacements,
    });

    this.staticSiteURL = hugoHostingStack.staticSiteURL;
  }
}

export interface HugoPipelineProps {
  /**
   * Name of the codecommit repository
   *
   * @default - hugo blog
   */
  readonly name?: string;

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
   * @default - path.join(process.cwd(), 'blog')
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
   * The cloudfront custom function code for the development stage.
   *
   * @default - undefined
   */
  readonly cloudfrontCustomFunctionCodeDevelopment?: cloudfront.FunctionCode;

  /**
   * The cloudfront custom function code for the production stage.
   *
   * @default - undefined
   */
  readonly cloudfrontCustomFunctionCodeProduction?: cloudfront.FunctionCode;

  /**
   * The cloudfront redirect replacements. Those are string replacements for the request.uri.
   * Note: the replacements are regular expressions.
   * Note: if cloudfrontCustomFunctionCode(Development|Production) is set, this property is ignored.
   *
   * @default - {}
   */
  readonly cloudfrontRedirectReplacements?: Record<string, string>;
}

export class HugoPipeline extends Construct {
  public readonly domainName: string;

  constructor(scope: Construct, id: string, props: HugoPipelineProps) {
    super(scope, id);

    this.domainName = props.domainName;
    const basicAuthUsername = props.basicAuthUsername || 'john';
    const basicAuthPassword = props.basicAuthPassword || 'doe';
    const basicAuthBase64 = Buffer.from(`${basicAuthUsername}:${basicAuthPassword}`).toString('base64');
    const dockerImage = props.dockerImage || 'public.ecr.aws/docker/library/node:lts-alpine';
    const hugoProjectPath = props.hugoProjectPath || path.join(process.cwd(), 'blog');
    const http403ResponsePagePath = props.http403ResponsePagePath || '/en/404.html';
    const http404ResponsePagePath = props.http404ResponsePagePath || '/en/404.html';
    const hugoBuildCommand = props.hugoBuildCommand || 'hugo --gc --minify --cleanDestinationDir';
    const siteSubDomain = props.siteSubDomain || 'dev';
    const cloudfrontCustomFunctionCodeDevelopment = props.cloudfrontCustomFunctionCodeDevelopment;
    const cloudfrontCustomFunctionCodeProduction = props.cloudfrontCustomFunctionCodeProduction;
    const cloudfrontRedirectReplacements = props.cloudfrontRedirectReplacements || {};

    const repository = new codecommit.Repository(this, 'hugo-blog', {
      repositoryName: props.name || 'hugo-blog',
      description: 'host the code for the hugo blog and its infrastructure',
    });
    const pipepline = new pipelines.CodePipeline(this, 'hugo-blog-pipeline', {
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.codeCommit(repository, 'master', {
          codeBuildCloneOutput: true, // we need this to preserve the git history
        }),
        // not implemented on 2022-12-28: https://github.com/aws/aws-cdk/issues/11399
        // so we clone submodules manually
        commands: [
          'pwd && ls -la',
          'test -f package-lock.json && npm ci || echo "NO package-lock.json file found"',
          'test -f yarn.lock && yarn install --check-files --frozen-lockfile || echo "NO yarn.lock file found"',
          'test -f .gitmodules && git submodule update --init',
          'npm run build',
          'npm run synth',
        ],
      }),
      // NOTE: as we build the hugo blog in a docker container
      // see https://github.com/aws/aws-cdk/tree/v2.56.1/packages/%40aws-cdk/pipelines#using-bundled-file-assets
      dockerEnabledForSynth: true,
    });

    const hugoPageDevStage = new HugoPageStage(this, 'dev-stage', {
      // Note: the pipeline and deployment are in the same account
      env: {
        account: Stack.of(this).account,
        region: Stack.of(this).region,
      },
      buildStage: 'development',
      basicAuthUsername: basicAuthUsername,
      basicAuthPassword: basicAuthPassword,
      domainName: this.domainName,
      siteSubDomain: siteSubDomain,
      http403ResponsePagePath: http403ResponsePagePath,
      http404ResponsePagePath: http404ResponsePagePath,
      hugoProjectPath: hugoProjectPath,
      dockerImage: dockerImage,
      hugoBuildCommand: hugoBuildCommand,
      s3deployAssetHash: props.s3deployAssetHash,
      cloudfrontCustomFunctionCode: cloudfrontCustomFunctionCodeDevelopment,
      cloudfrontRedirectReplacements: cloudfrontRedirectReplacements,
    });

    pipepline.addStage(hugoPageDevStage, {
      post: [
        new pipelines.ShellStep('HitDevEndpoint', {
          envFromCfnOutputs: {
            // Make the address available as $URL inside the commands
            URL: hugoPageDevStage.staticSiteURL,
          },
          commands: [`curl -sSfL -H "Authorization: Basic ${basicAuthBase64}" $URL -o /dev/null`],
        }),
      ],
    });

    const hugoPageProdStage = new HugoPageStage(this, 'prod-stage', {
      env: {
        account: Stack.of(this).account,
        region: Stack.of(this).region,
      },
      buildStage: 'production',
      basicAuthUsername: basicAuthUsername,
      basicAuthPassword: basicAuthPassword,
      domainName: this.domainName,
      http403ResponsePagePath: http403ResponsePagePath,
      http404ResponsePagePath: http404ResponsePagePath,
      hugoProjectPath: props.hugoProjectPath,
      s3deployAssetHash: props.s3deployAssetHash,
      cloudfrontCustomFunctionCode: cloudfrontCustomFunctionCodeProduction,
      cloudfrontRedirectReplacements: cloudfrontRedirectReplacements,
    });

    pipepline.addStage(hugoPageProdStage, {
      pre: [
        new pipelines.ManualApprovalStep('PromoteToProd'),
      ],
      post: [
        new pipelines.ShellStep('HitProdEndpoint', {
          envFromCfnOutputs: {
            URL: hugoPageProdStage.staticSiteURL,
          },
          commands: ['curl -sSfL $URL -o /dev/null'],
        }),
      ],
    });
  }
}