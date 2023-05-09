import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { HugoRepository, HugoRepositoryProps } from '../src';

test('Repository default name', () => {
  const app = new App();
  const stack = new Stack(app, 'testStack', {
    env: {
      region: 'us-east-1',
      account: '1234',
    },
  });

  const testProps: HugoRepositoryProps = {};
  // WHEN
  new HugoRepository(stack, 'hugoRepository', testProps);

  const template = Template.fromStack(stack);

  // THEN
  template.hasResource('AWS::CodeCommit::Repository', {
    Properties: Match.objectLike({
      RepositoryName: 'hugo-blog',
    }),
  });
});