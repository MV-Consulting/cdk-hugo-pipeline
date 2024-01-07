import {
  Stage,
  StageProps,
  Stack,
  StackProps,
  aws_codecommit as codecommit,
  pipelines,
  CfnOutput,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HugoHosting } from './hugoHosting';

export interface HugoHostingStackProps extends StackProps {
  readonly buildStage: string;
  readonly domainName: string;
  readonly siteSubDomain?: string;
  readonly hugoProjectPath?: string;
  readonly dockerImage?: string;
  readonly hugoBuildCommand?: string;
  readonly s3deployAssetHash?: string;
  readonly cloudfrontRedirectReplacements?: Record<string, string>;
}

export class HugoHostingStack extends Stack {
  public readonly staticSiteURL: CfnOutput;

  constructor(scope: Construct, id: string, props: HugoHostingStackProps) {
    super(scope, id, props);

    const staticHosting = new HugoHosting(this, 'static-hosting', {
      buildStage: props.buildStage,
      siteSubDomain: props.siteSubDomain,
      domainName: props.domainName,
      hugoProjectPath: props.hugoProjectPath,
      hugoBuildCommand: props.hugoBuildCommand,
      dockerImage: props.dockerImage,
      s3deployAssetHash: props.s3deployAssetHash,
    });

    this.staticSiteURL = staticHosting.staticSiteURL;
  }
}

export interface HugoPageStageProps extends StageProps {
  readonly buildStage: string;
  readonly domainName: string;
  readonly siteSubDomain?: string;
  readonly hugoProjectPath?: string;
  readonly dockerImage?: string;
  readonly hugoBuildCommand?: string;
  readonly s3deployAssetHash?: string;
  readonly cloudfrontRedirectReplacements?: Record<string, string>;
}
export class HugoPageStage extends Stage {
  public readonly staticSiteURL: CfnOutput;

  constructor(scope: Construct, id: string, props: HugoPageStageProps) {
    super(scope, id, props);

    const hugoHostingStack = new HugoHostingStack(this, 'hugo-blog-stack', {
      buildStage: props.buildStage,
      siteSubDomain: props.siteSubDomain,
      domainName: props.domainName,
      hugoProjectPath: props.hugoProjectPath,
      hugoBuildCommand: props.hugoBuildCommand,
      dockerImage: props.dockerImage,
      s3deployAssetHash: props.s3deployAssetHash,
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
   * The cloudfront redirect replacements. Those are string replacements for the request.uri
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
    const hugoProjectPath = props.hugoProjectPath || '../../../../blog';
    const hugoBuildCommand = props.hugoBuildCommand || 'hugo --gc --minify --cleanDestinationDir';
    const siteSubDomain = props.siteSubDomain || 'dev';
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
          'test -f package-lock.json && npm ci',
          'test -f yarn.lock && yarn install --check-files --frozen-lockfile',
          'git submodule update --init',
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
      domainName: this.domainName,
      siteSubDomain: siteSubDomain,
      hugoProjectPath: hugoProjectPath,
      dockerImage: dockerImage,
      hugoBuildCommand: hugoBuildCommand,
      s3deployAssetHash: props.s3deployAssetHash,
      cloudfrontRedirectReplacements: cloudfrontRedirectReplacements,
    });

    pipepline.addStage(hugoPageDevStage, {
      post: [
        new pipelines.ShellStep('HitDevEndpoint', {
          envFromCfnOutputs: {
            // Make the address available as $URL inside the commands
            URL: hugoPageDevStage.staticSiteURL,
          },
          commands: [`curl -Ssf -H "Authorization: Basic ${basicAuthBase64}" $URL`],
        }),
      ],
    });

    const hugoPageProdStage = new HugoPageStage(this, 'prod-stage', {
      env: {
        account: Stack.of(this).account,
        region: Stack.of(this).region,
      },
      buildStage: 'production',
      domainName: this.domainName,
      hugoProjectPath: props.hugoProjectPath,
      s3deployAssetHash: props.s3deployAssetHash,
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
          commands: ['curl -Ssf $URL'],
        }),
      ],
    });
  }
}