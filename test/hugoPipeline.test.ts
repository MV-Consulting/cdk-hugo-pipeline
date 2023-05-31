import {
  App,
  Stack,
} from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { HugoPipeline, HugoPipelineProps } from '../src';

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
    hugoProjectPath: '../test/frontend-test',
  };
  // WHEN
  new HugoPipeline(stack, 'hugoRepository', testProps);

  const template = Template.fromStack(stack);

  // THEN
  template.hasResource('AWS::CodePipeline::Pipeline', {
    Properties: Match.objectLike({
      RestartExecutionOnUpdate: true,
      // Stages: Match.arrayWith(['']),
    }),
  });
});