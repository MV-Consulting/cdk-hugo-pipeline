import { awscdk } from 'projen';
import { NpmAccess } from 'projen/lib/javascript';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Manuel Vogel',
  authorAddress: 'mavogel@posteo.de',
  cdkVersion: '2.80.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~5.3.0',
  name: 'cdk-hugo-pipeline',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/MV-Consulting/cdk-hugo-pipeline',

  // deps: [],                /* Runtime dependencies of this module. */
  description: 'Build you hugo website all on AWS with CI/CD and a dev environment.', /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [ /* Build dependencies for this module. */
    '@commitlint/cli',
    '@commitlint/config-conventional',
    'husky',
  ],
  packageName: '@mavogel/cdk-hugo-pipeline', /* The "name" in package.json. */
  npmAccess: NpmAccess.PUBLIC, /* The npm access level to use when releasing this module. */
  keywords: ['aws', 'cdk', 'hugo'],
  autoApproveOptions: {
    allowedUsernames: ['mavogel'],
  },
  autoApproveUpgrades: true,
  depsUpgradeOptions: {
    workflowOptions: {
      labels: ['auto-approve'],
    },
  },
});
project.package.setScript('prepare', 'husky install');
project.synth();