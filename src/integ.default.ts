import * as cdk from 'aws-cdk-lib';
import { HugoPipeline, HugoPipelineProps } from './index';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'MyIntegStack');

const testProps: HugoPipelineProps = {
  domainName: 'mavogel.xyz',
  siteSubDomain: 'dev',
  hugoProjectPath: '../test/frontend-test',
};

new HugoPipeline(stack, 'hugoPipeline', testProps);