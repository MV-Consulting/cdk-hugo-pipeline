import {
  App,
  Stack,
} from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { HugoHosting, HugoHostingProps } from '../src';

test('Development hosting', () => {
  const app = new App();
  const stack = new Stack(app, 'testStack', {
    env: {
      region: 'us-east-1',
      account: '1234',
    },
  });

  const testProps: HugoHostingProps = {
    siteSubDomain: 'dev',
    domainName: 'example.com',
    buildStage: 'development',
    hugoProjectPath: '../test/frontend-test',
  };
  // WHEN
  new HugoHosting(stack, 'hugoHosting', testProps);

  const template = Template.fromStack(stack);

  // THEN
  // TODO test something else
  template.hasResource('AWS::S3::Bucket', {
    Properties: Match.objectLike({
      BucketName: 'dev.example.com',
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    }),
    DeletionPolicy: 'Delete',
    UpdateReplacePolicy: 'Delete',
  });
});

test('Production hosting', () => {
  const app = new App();
  const stack = new Stack(app, 'testStack', {
    env: {
      region: 'us-east-1',
      account: '1234',
    },
  });

  const testProps: HugoHostingProps = {
    domainName: 'example.com',
    buildStage: 'production',
    hugoProjectPath: '../test/frontend-test',
  };
  // WHEN
  new HugoHosting(stack, 'hugoHosting', testProps);

  const template = Template.fromStack(stack);

  // THEN
  template.hasResource('AWS::S3::Bucket', {
    Properties: Match.objectLike({
      BucketName: 'example.com',
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    }),
    DeletionPolicy: 'Retain',
    UpdateReplacePolicy: 'Retain',
  });
});