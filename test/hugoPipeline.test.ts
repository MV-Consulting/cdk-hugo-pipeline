import * as path from 'path';
import {
  App,
  Stack,
} from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { HugoPipeline, HugoPipelineProps } from '../src';

test('Snapshot pipeline', () => {
  const app = new App();
  const stack = new Stack(app, 'testStack', {
    env: {
      region: 'us-east-1',
      account: '1234',
    },
  });

  const testProps: HugoPipelineProps = {
    domainName: 'example.com',
    siteSubDomain: 'dev',
    hugoProjectPath: path.join(process.cwd(), 'test', 'frontend-test'),
    s3deployAssetHash: '3',
  };
  // WHEN
  new HugoPipeline(stack, 'hugoPipeline', testProps);

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});

test('Default pipeline', () => {
  const app = new App();
  const stack = new Stack(app, 'testStack', {
    env: {
      region: 'us-east-1',
      account: '1234',
    },
  });

  const testProps: HugoPipelineProps = {
    domainName: 'example.com',
    siteSubDomain: 'dev',
    hugoProjectPath: path.join(process.cwd(), 'test', 'frontend-test'),
    s3deployAssetHash: '3',
  };
  // WHEN
  new HugoPipeline(stack, 'hugoPipeline', testProps);

  const template = Template.fromStack(stack);

  // THEN
  template.hasResource('AWS::CodeCommit::Repository', {
    Properties: Match.objectLike({
      RepositoryName: 'hugo-blog',
    }),
  });
  template.hasResource('AWS::CodePipeline::Pipeline', {
    Properties: Match.objectLike({
      RestartExecutionOnUpdate: true,
      Stages: Match.arrayWith([
        Match.objectLike({ Name: 'Source' }),
        Match.objectLike({ Name: 'Build' }),
        Match.objectLike({ Name: 'UpdatePipeline' }),
        Match.objectLike({ Name: 'Assets' }),
        Match.objectLike({
          Name: 'dev-stage',
          Actions: Match.arrayWith([
            Match.objectLike({
              Name: 'hugo-blog-stack.Prepare',
              Configuration: Match.objectLike({
                StackName: 'dev-stage-hugo-blog-stack',
                ActionMode: 'CHANGE_SET_REPLACE',
              }),
              RunOrder: 1,
            }),
            Match.objectLike({
              Name: 'hugo-blog-stack.Deploy',
              Configuration: Match.objectLike({
                StackName: 'dev-stage-hugo-blog-stack',
                ActionMode: 'CHANGE_SET_EXECUTE',
              }),
              RunOrder: 2,
            }),
            Match.objectLike({
              Name: 'HitDevEndpoint',
              RunOrder: 3,
            }),
          ]),
        }),
        Match.objectLike({
          Name: 'prod-stage',
          Actions: Match.arrayWith([
            Match.objectLike({
              Name: 'PromoteToProd',
              ActionTypeId: Match.objectLike({
                Category: 'Approval',
              }),
              RunOrder: 1,
            }),
            Match.objectLike({
              Name: 'hugo-blog-stack.Prepare',
              Configuration: Match.objectLike({
                StackName: 'prod-stage-hugo-blog-stack',
                ActionMode: 'CHANGE_SET_REPLACE',
              }),
              RunOrder: 2,
            }),
            Match.objectLike({
              Name: 'hugo-blog-stack.Deploy',
              Configuration: Match.objectLike({
                StackName: 'prod-stage-hugo-blog-stack',
                ActionMode: 'CHANGE_SET_EXECUTE',
              }),
              RunOrder: 3,
            }),
            Match.objectLike({
              Name: 'HitProdEndpoint',
              RunOrder: 4,
            }),
          ]),
        }),
      ]),
    }),
  });
});

test('Custom pipeline', () => {
  const app = new App();
  const stack = new Stack(app, 'testStack', {
    env: {
      region: 'us-east-1',
      account: '1234',
    },
  });

  const testProps: HugoPipelineProps = {
    domainName: 'example.com',
    siteSubDomain: 'dev',
    hugoProjectPath: path.join(process.cwd(), 'test', 'frontend-test-custom'),
    s3deployAssetHash: '3',
    // below is custom
    hugoBuildCommand: 'hugo --gc',
    dockerImage: 'public.ecr.aws/docker/library/node:16-alpine',
    cloudfrontRedirectReplacements: {
      '/talks/': '/works/',
      '/post/': '/posts/',
    },
  };
  // WHEN
  new HugoPipeline(stack, 'hugoPipeline', testProps);

  const template = Template.fromStack(stack);

  // THEN
  template.hasResource('AWS::CodeCommit::Repository', {
    Properties: Match.objectLike({
      RepositoryName: 'hugo-blog',
    }),
  });
  template.hasResource('AWS::CodePipeline::Pipeline', {
    Properties: Match.objectLike({
      RestartExecutionOnUpdate: true,
      Stages: Match.arrayWith([
        Match.objectLike({ Name: 'Source' }),
        Match.objectLike({ Name: 'Build' }),
        Match.objectLike({ Name: 'UpdatePipeline' }),
        Match.objectLike({ Name: 'Assets' }),
        Match.objectLike({
          Name: 'dev-stage',
          Actions: Match.arrayWith([
            Match.objectLike({
              Name: 'hugo-blog-stack.Prepare',
              Configuration: Match.objectLike({
                StackName: 'dev-stage-hugo-blog-stack',
                ActionMode: 'CHANGE_SET_REPLACE',
              }),
              RunOrder: 1,
            }),
            Match.objectLike({
              Name: 'hugo-blog-stack.Deploy',
              Configuration: Match.objectLike({
                StackName: 'dev-stage-hugo-blog-stack',
                ActionMode: 'CHANGE_SET_EXECUTE',
              }),
              RunOrder: 2,
            }),
            Match.objectLike({
              Name: 'HitDevEndpoint',
              RunOrder: 3,
            }),
          ]),
        }),
        Match.objectLike({
          Name: 'prod-stage',
          Actions: Match.arrayWith([
            Match.objectLike({
              Name: 'PromoteToProd',
              ActionTypeId: Match.objectLike({
                Category: 'Approval',
              }),
              RunOrder: 1,
            }),
            Match.objectLike({
              Name: 'hugo-blog-stack.Prepare',
              Configuration: Match.objectLike({
                StackName: 'prod-stage-hugo-blog-stack',
                ActionMode: 'CHANGE_SET_REPLACE',
              }),
              RunOrder: 2,
            }),
            Match.objectLike({
              Name: 'hugo-blog-stack.Deploy',
              Configuration: Match.objectLike({
                StackName: 'prod-stage-hugo-blog-stack',
                ActionMode: 'CHANGE_SET_EXECUTE',
              }),
              RunOrder: 3,
            }),
            Match.objectLike({
              Name: 'HitProdEndpoint',
              RunOrder: 4,
            }),
          ]),
        }),
      ]),
    }),
  });
});