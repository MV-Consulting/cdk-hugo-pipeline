import * as path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntegTest, ExpectedResult, LogType, InvocationType } from '@aws-cdk/integ-tests-alpha';
import {
  App,
  Duration,
  Stack,
  aws_iam as iam,
  aws_lambda as lambda,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
// CDK App for Integration Tests
const app = new App();
// Parameters TODO
const testDomain = process.env.TEST_DOMAIN ?? '';
const testAccount = process.env.TEST_ACCOUNT_ID ?? process.env.CDK_DEFAULT_ACCOUNT ?? '';
const testRegion = 'eu-west-1';
console.log(`Running integration tests in region '${testRegion}' and account '${testAccount}' for domain '${testDomain}'`);
if (testDomain === '' || testAccount === '') {
  throw new Error(`TEST_DOMAIN and TEST_ACCOUNT_ID environment variables must be set. Were TEST_DOMAIN='${testDomain}' and TEST_ACCOUNT_ID='${testAccount}'`);
}
// Stack under test
const stackUnderTestName = 'HugoPipelineTestStack';
const stackUnderTest = new Stack(app, stackUnderTestName, {
  description: "This stack includes the application's resources for integration testing.",
  env: {
    account: testAccount,
    region: testRegion,
  },
});

const randomTestId = 1234;
const testSubdomain = `integ-hugo-${randomTestId}`;

// Initialize Integ Test construct
const integStackName = 'SetupTest';
const integ = new IntegTest(app, integStackName, {
  testCases: [stackUnderTest], // Define a list of cases for this test
  cdkCommandOptions: {
    destroy: {
      args: {
        force: true,
      },
    },
  },
  regions: [stackUnderTest.region],
});

const bootstrapHandler = new NodejsFunction(stackUnderTest, 'bootstrap-handler', {
  functionName: `${stackUnderTestName}-bootstrap-handler`,
  entry: path.join(__dirname, 'functions', 'bootstrap-handler.ts'),
  runtime: lambda.Runtime.NODEJS_18_X,
  logRetention: 1,
  timeout: Duration.minutes(30),
  initialPolicy: [
    new iam.PolicyStatement({
      actions: [
        'ec2:*', // TODO
      ],
      resources: ['*'],
    }),
  ],
});

/**
 * Assertion: TBD
 */
const id = `test-id-${randomTestId}`;
const message = 'This is a mail body';

const bootstrapAssertion = integ.assertions
  .invokeFunction({
    functionName: bootstrapHandler.functionName,
    logType: LogType.TAIL,
    invocationType: InvocationType.REQUEST_RESPONE,
    payload: JSON.stringify({
      id: id,
      text: message,
    }),
  }).expect(ExpectedResult.objectLike(
    // as the object 'return { sendStatusCode: 200 };' is wrapped in a Payload object with other properties
    {
      Payload: {
        sendStatusCode: 200,
      },
    },
  ),
  );

const devSiteAvailableAssertion = integ.assertions
  .httpApiCall(`https://${testSubdomain}.${testDomain}`)
  .expect(ExpectedResult.objectLike({ TODO: 'tbd' })) // TODO or use lambda  busy waiting
  .waitForAssertions({
    totalTimeout: Duration.minutes(10),
    interval: Duration.seconds(20),
  });

const promoteToProdHandler = new NodejsFunction(stackUnderTest, 'promote-to-prod-handler', {
  functionName: `${stackUnderTestName}-promote-to-prod-handler`,
  entry: path.join(__dirname, 'functions', 'promote-to-prod-handler.ts'),
  runtime: lambda.Runtime.NODEJS_18_X,
  logRetention: 1,
  timeout: Duration.minutes(30),
  initialPolicy: [
    new iam.PolicyStatement({
      actions: [
        'codepipeline:*', // TODO
      ],
      resources: ['*'],
    }),
  ],
});

const promoteToProdAssertion = integ.assertions
  .invokeFunction({
    functionName: promoteToProdHandler.functionName,
    logType: LogType.TAIL,
    invocationType: InvocationType.REQUEST_RESPONE,
    payload: JSON.stringify({
      id: id,
      text: message,
    }),
  }).expect(ExpectedResult.objectLike(
    // as the object 'return { sendStatusCode: 200 };' is wrapped in a Payload object with other properties
    {
      Payload: {
        sendStatusCode: 200,
      },
    },
  ),
  );

const prodSiteAvailableAssertion = integ.assertions
  .httpApiCall(`https://${testDomain}`)
  .expect(ExpectedResult.objectLike({ TODO: 'tbd' })) // TODO or use lambda  busy waiting
  .waitForAssertions({
    totalTimeout: Duration.minutes(10),
    interval: Duration.seconds(20),
  });


/**
 * Main test case
 */
bootstrapAssertion
  .next(devSiteAvailableAssertion)
  .next(promoteToProdAssertion)
  .next(prodSiteAvailableAssertion);