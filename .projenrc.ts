import { awscdk } from 'projen';
import { NpmAccess } from 'projen/lib/javascript';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Manuel Vogel',
  authorAddress: 'mavogel@posteo.de',
  cdkVersion: '2.80.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~5.0.0',
  name: 'cdk-hugo-pipeline',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/mavogel/cdk-hugo-pipeline.git',
  tsconfigDev: {
    compilerOptions: {
    },
    include: [
      'integ-tests/**/*.ts',
    ],
  },

  bundledDeps: [ /* TODO or normal deps */
    'aws-sdk',
    'axios',
    'cdk-nag',
  ],

  // deps: [],                /* Runtime dependencies of this module. */
  description: 'Build you hugo website all on AWS with CI/CD and a dev environment.', /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [ /* Build dependencies for this module. */
    '@aws-cdk/integ-runner@^2.90.0-alpha.0',
    '@aws-cdk/integ-tests-alpha@^2.90.0-alpha.0',
    '@commitlint/cli',
    '@commitlint/config-conventional',
    'husky',
  ],
  packageName: '@mavogel/cdk-hugo-pipeline', /* The "name" in package.json. */
  npmAccess: NpmAccess.PUBLIC, /* The npm access level to use when releasing this module. */
});
project.package.setScript('prepare', 'husky install');
project.package.setScript('integ-test', 'integ-runner --directory ./integ-tests --parallel-regions eu-west-1 --update-on-failed');
project.synth();