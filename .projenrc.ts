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

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [ /* Build dependencies for this module. */
    '@commitlint/cli',
    '@commitlint/config-conventional',
    'husky',
  ],
  packageName: '@mavogel/cdk-hugo-pipeline', /* The "name" in package.json. */
  npmAccess: NpmAccess.PUBLIC, /* The npm access level to use when releasing this module. */
});
project.package.setScript('prepare', 'husky install');
project.synth();