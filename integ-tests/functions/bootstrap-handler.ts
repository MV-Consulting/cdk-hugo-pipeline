import * as AWS from 'aws-sdk';

const SES = new AWS.SES();

export const handler = async (event: any) => {
  const id = event.id || 'test-id-1';
  const text = event.text || 'test';
  log(SES);

  // steps
  // 1. setup vpc and ec2 instance with bootstrap script and admin permissions OR
  // 1. lambda function
  // 3. set up dependencies: node, git, docker, python, aws cli, cdk, hugo or use container
  // 4. use projen script to create project
  // 5. npm run deploy (with detach to avoid busy waiting?)
  // 6. git remote add origin <for example codecommit repo>
  // 7. add python script/wrapper to commit and push to codecommit repo
  // 8. git push origin master

  try {
    return { sendStatusCode: 200 };
  } catch (err) {
    return { sendStatusCode: 500, err: err };
  }
};

function log(msg: any) {
  console.log(JSON.stringify(msg));
}