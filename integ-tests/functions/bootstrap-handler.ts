import * as AWS from 'aws-sdk';

const SES = new AWS.SES();

export const handler = async (event: any) => {
  const id = event.id || 'test-id-1';
  const text = event.text || 'test';
  log(SES);

  // steps
  // 1. setup vpc
  // 2. setup ec2 instance with bootstrap script and admin permissions
  // 2.0 set up dependencies: node, git, docker, aws cli, cdk, hugo
  // 2.1 use projen script
  // 2.2 cdk deploy

  try {
    return { sendStatusCode: 200 };
  } catch (err) {
    return { sendStatusCode: 500, err: err };
  }
};

function log(msg: any) {
  console.log(JSON.stringify(msg));
}