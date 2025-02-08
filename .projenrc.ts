import { cwd } from 'process';
import { MvcCdkConstructLibrary } from '@mavogel/mvc-projen';
import { javascript } from 'projen';
import { NpmAccess } from 'projen/lib/javascript';
const project = new MvcCdkConstructLibrary({
  author: 'Manuel Vogel',
  authorAddress: '8409778+mavogel@users.noreply.github.com',
  cdkVersion: '2.177.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~5.7.0',
  name: 'cdk-hugo-pipeline',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/MV-Consulting/cdk-hugo-pipeline',

  deps: [
    '@mavogel/mvc-projen',
    'constructs@^10.4.2',
  ],
  description: 'Build you hugo website all on AWS with CI/CD and a dev environment.',
  packageName: '@mavogel/cdk-hugo-pipeline', /* The "name" in package.json. */
  packageManager: javascript.NodePackageManager.YARN_CLASSIC,
  npmAccess: NpmAccess.PUBLIC, /* The npm access level to use when releasing this module. */
  keywords: ['aws', 'cdk', 'hugo'],
  baseAssetsDirectory: `${cwd()}/node_modules/@mavogel/mvc-projen/assets`,
});
project.synth();