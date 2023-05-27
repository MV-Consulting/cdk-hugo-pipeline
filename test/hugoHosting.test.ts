import {
  App,
  Stack,
  aws_route53 as route53,
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

  const testZone = new route53.HostedZone(stack, 'HostedZone', {
    zoneName: 'example.com',
  });

  const testProps: HugoHostingProps = {
    siteSubDomain: 'dev',
    domainName: 'example.com',
    buildStage: 'development',
    zone: testZone,
    hugoProjectPath: '../test/frontend-test',
  };
  // WHEN
  new HugoHosting(stack, 'hugoHosting', testProps);

  const template = Template.fromStack(stack);

  // THEN
  template.hasResource('AWS::Route53::HostedZone', {
    Properties: Match.objectLike({
      Name: 'example.com.',
    }),
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

  const testZone = new route53.HostedZone(stack, 'HostedZone', {
    zoneName: 'example.com',
  });

  const testProps: HugoHostingProps = {
    domainName: 'example.com',
    buildStage: 'production',
    zone: testZone,
    hugoProjectPath: '../test/frontend-test',
  };
  // WHEN
  new HugoHosting(stack, 'hugoHosting', testProps);

  const template = Template.fromStack(stack);

  // THEN
  template.hasResource('AWS::Route53::HostedZone', {
    Properties: Match.objectLike({
      Name: 'example.com.',
    }),
  });
});