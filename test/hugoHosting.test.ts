import {
  App,
  Stack,
} from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { HugoHosting, HugoHostingProps } from '../src';

test('Snapshot development hosting', () => {
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
    s3deployAssetHash: '1',
    cloudfrontRedirectReplacements: {
      '/talks/': '/works/',
      '/project/': '/works/',
      '/post/': '/posts/',
    },
  };
  // WHEN
  new HugoHosting(stack, 'hugoDevelopmentHosting', testProps);

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});

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
    s3deployAssetHash: '1',
  };
  // WHEN
  new HugoHosting(stack, 'hugoDevelopmentHosting', testProps);

  const template = Template.fromStack(stack);

  // THEN
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

  template.hasResourceProperties('AWS::CloudFront::CloudFrontOriginAccessIdentity', {
    CloudFrontOriginAccessIdentityConfig: Match.objectLike({
      Comment: 'OAI for hugoDevelopmentHosting',
    }),
  });

  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({
      Aliases: Match.arrayWith(['dev.example.com']),
      CustomErrorResponses: Match.arrayWith([
        Match.objectLike({
          ErrorCachingMinTTL: 1800,
          ErrorCode: 403,
          ResponseCode: 404,
          ResponsePagePath: '/en/404.html',
        }),
        Match.objectLike({
          ErrorCachingMinTTL: 1800,
          ErrorCode: 404,
          ResponseCode: 404,
          ResponsePagePath: '/en/404.html',
        }),
      ]),
      DefaultRootObject: 'index.html',
      DefaultCacheBehavior: Match.objectLike({
        Compress: true,
        ViewerProtocolPolicy: 'redirect-to-https',
        FunctionAssociations: Match.arrayWith([
          Match.objectLike({
            EventType: 'viewer-request',
          }),
        ]),
      }),
    }),
  });

  template.hasResourceProperties('AWS::Route53::RecordSet', {
    Name: 'dev.example.com.',
    Type: 'A',
    HostedZoneId: 'DUMMY',
  });

  template.hasResource('Custom::CDKBucketDeployment', {
    Properties: Match.objectLike({
      Prune: true,
      DistributionPaths: Match.arrayWith(['/*']),
    }),
    UpdateReplacePolicy: 'Delete',
    DeletionPolicy: 'Delete',
  });
});

test('Snapshot production hosting', () => {
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
    s3deployAssetHash: '2',
    cloudfrontRedirectReplacements: {
      '/talks/': '/works/',
      '/project/': '/works/',
      '/post/': '/posts/',
    },
  };
  // WHEN
  new HugoHosting(stack, 'hugoProductionHosting', testProps);

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
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
    s3deployAssetHash: '2',
    cloudfrontRedirectReplacements: {
      '/talks/': '/works/',
      '/post/': '/posts/',
    },
  };
  // WHEN
  new HugoHosting(stack, 'hugoProductionHosting', testProps);

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

  template.hasResourceProperties('AWS::CloudFront::CloudFrontOriginAccessIdentity', {
    CloudFrontOriginAccessIdentityConfig: Match.objectLike({
      Comment: 'OAI for hugoProductionHosting',
    }),
  });

  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({
      Aliases: Match.arrayWith(['example.com']),
      CustomErrorResponses: Match.arrayWith([
        Match.objectLike({
          ErrorCachingMinTTL: 1800,
          ErrorCode: 403,
          ResponseCode: 404,
          ResponsePagePath: '/en/404.html',
        }),
        Match.objectLike({
          ErrorCachingMinTTL: 1800,
          ErrorCode: 404,
          ResponseCode: 404,
          ResponsePagePath: '/en/404.html',
        }),
      ]),
      DefaultRootObject: 'index.html',
      DefaultCacheBehavior: Match.objectLike({
        Compress: true,
        ViewerProtocolPolicy: 'redirect-to-https',
        FunctionAssociations: Match.arrayWith([
          Match.objectLike({
            EventType: 'viewer-request',
          }),
        ]),
      }),
    }),
  });

  template.hasResourceProperties('AWS::CloudFront::Function', {
    AutoPublish: true,
    FunctionCode: Match.exact(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Check whether the URI is missing a file name.
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  }
  // Check whether the URI is missing a file extension.
  else if (!uri.includes('.')) {
    request.uri += '/index.html';
  }

  var froms = ['/talks/','/post/'];

  if (froms.some(from => request.uri.includes(from))) {
    request.uri = request.uri.replace('/talks/', '/works/');
    request.uri = request.uri.replace('/post/', '/posts/');

    var response = {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers:
          { 'location': { 'value': request.uri } }
    }
    return response;
  }

  return request;
}
      `),
  }); // NOTE: keep the 6 whitespaces at the end of the string

  template.hasResourceProperties('AWS::Route53::RecordSet', {
    Name: 'example.com.',
    Type: 'A',
    HostedZoneId: 'DUMMY',
  });

  template.hasResource('Custom::CDKBucketDeployment', {
    Properties: Match.objectLike({
      Prune: true,
      DistributionPaths: Match.arrayWith(['/*']),
    }),
    UpdateReplacePolicy: 'Delete',
    DeletionPolicy: 'Delete',
  });
});