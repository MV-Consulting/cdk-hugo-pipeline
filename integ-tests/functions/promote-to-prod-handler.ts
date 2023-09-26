import * as AWS from 'aws-sdk';

const SES = new AWS.SES();

export const handler = async (event: any) => {
  const id = event.id || 'test-id-1';
  const text = event.text || 'test';
  log(SES);

  // steps
  // 1. wait for pipeline to be at the promotion step
  // 2. trigger promote to prod with random message

  try {
    return { sendStatusCode: 200 };
  } catch (err) {
    return { sendStatusCode: 500, err: err };
  }
};

function log(msg: any) {
  console.log(JSON.stringify(msg));
}