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
}

export class HugoHostingStack extends Stack {
  public readonly staticSiteURL: CfnOutput;

  constructor(scope: Construct, id: string, props: HugoHostingStackProps) {
    super(scope, id, props);

    const staticHosting = new HugoHosting(this, 'static-hosting', {
      buildStage: props.buildStage,
      siteSubDomain: props.siteSubDomain,
      domainName: props.domainName,
    });

    this.staticSiteURL = staticHosting.staticSiteURL;
  }
}

export interface HugoPageStageProps extends StageProps {
  readonly buildStage: string;
  readonly domainName: string;
  readonly siteSubDomain?: string;
}
export class HugoPageStage extends Stage {
  public readonly staticSiteURL: CfnOutput;

  constructor(scope: Construct, id: string, props: HugoPageStageProps) {
    super(scope, id, props);

    const hugoHostingStack = new HugoHostingStack(this, 'hugo-blog-stack', {
      buildStage: props.buildStage,
      siteSubDomain: props.siteSubDomain,
      domainName: props.domainName,
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
  readonly siteSubDomain: string;
}

export class HugoPipeline extends Construct {
  public readonly domainName: string;
  public readonly siteSubDomain: string;

  constructor(scope: Construct, id: string, props: HugoPipelineProps) {
    super(scope, id);

    // TODO helper class
    const basicAuthUsername = props.basicAuthUsername || 'john';
    const basicAuthPassword = props.basicAuthPassword || 'doe';
    const basicAuthBase64 = Buffer.from(`${basicAuthUsername}:${basicAuthPassword}`).toString('base64');
    this.domainName = props.domainName;
    this.siteSubDomain = props.siteSubDomain;

    const repository = codecommit.Repository.fromRepositoryName(this, 'hugo-blog-repo', props.name || 'hugo-blog');
    const pipepline = new pipelines.CodePipeline(this, 'hugo-blog-pipeline', {
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.codeCommit(repository, 'master', {
          codeBuildCloneOutput: true, // we need this to preserve the git history
        }),
        // not implemented on 2022-12-28: https://github.com/aws/aws-cdk/issues/11399
        // so we clone submodules manually
        commands: [
          'npm ci',
          'git submodule update --init',
          'npm run build',
          'npm run synth',
        ],
      }),
      // NOTE: as we build the hugo blog in a docker container
      // see https://github.com/aws/aws-cdk/tree/v2.56.1/packages/%40aws-cdk/pipelines#using-bundled-file-assets
      dockerEnabledForSynth: true,
      // codeBuildDefaults: {
      //   timeout: Duration.minutes(20),
      // },
    });

    const hugoPageDevStage = new HugoPageStage(this, 'dev-stage', {
      buildStage: 'development',
      siteSubDomain: this.siteSubDomain,
      domainName: this.domainName,
    });

    pipepline.addStage(hugoPageDevStage, {
      post: [
        new pipelines.ShellStep('HitDevEndpoint', {
          envFromCfnOutputs: {
            // Make the address available as $URL inside the commands
            URL: hugoPageDevStage.staticSiteURL,
          },
          // TODO add header to allow request to call
          commands: [`curl -Ssf -H "Authorization: Basic ${basicAuthBase64}" $URL`],
        }),
      ],
    });

    const hugoPageProdStage = new HugoPageStage(this, 'prod-stage', {
      buildStage: 'production',
      domainName: this.domainName,
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