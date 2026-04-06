import { MvcCdkConstructLibrary } from '@mavogel/mvc-projen';
import { javascript } from 'projen';
import { NpmAccess } from 'projen/lib/javascript';
const project = new MvcCdkConstructLibrary({
  author: 'Manuel Vogel',
  authorAddress: '8409778+mavogel@users.noreply.github.com',
  cdkVersion: '2.197.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~5.9.0',
  name: 'cdk-hugo-pipeline',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/MV-Consulting/cdk-hugo-pipeline',

  deps: [
    '@mavogel/mvc-projen@0.0.22',
    'constructs@^10.4.2',
  ],
  description: 'Build you hugo website all on AWS with CI/CD and a dev environment.',
  packageName: '@mavogel/cdk-hugo-pipeline', /* The "name" in package.json. */
  packageManager: javascript.NodePackageManager.YARN_CLASSIC,
  npmAccess: NpmAccess.PUBLIC, /* The npm access level to use when releasing this module. */
  keywords: ['aws', 'cdk', 'hugo'],
  baseAssetsDirectory: `${process.cwd()}/node_modules/@mavogel/mvc-projen/assets`,
});

// Pre-pull Docker image used by CDK asset bundling to avoid rate limiting
// when multiple concurrent docker run commands try to pull the same image
const buildWorkflow = project.github?.tryFindWorkflow('build');
if (buildWorkflow) {
  const buildJob = buildWorkflow.getJob('build');
  if (buildJob && 'steps' in buildJob) {
    const steps = [...buildJob.steps];
    // Insert docker pull step before the build step
    const buildStepIndex = steps.findIndex(s => 'run' in s && s.name === 'build');
    if (buildStepIndex !== -1) {
      steps.splice(buildStepIndex, 0, {
        name: 'Pre-pull Docker image',
        run: 'for i in 1 2 3; do docker pull public.ecr.aws/docker/library/node:lts-alpine && break || sleep 15; done',
      });
      buildWorkflow.updateJob('build', {
        ...buildJob,
        steps,
      });
    }
  }
}

// Do the same for the release workflow
const releaseWorkflow = project.github?.tryFindWorkflow('release');
if (releaseWorkflow) {
  const releaseJob = releaseWorkflow.getJob('release');
  if (releaseJob && 'steps' in releaseJob) {
    const steps = [...releaseJob.steps];
    const releaseStepIndex = steps.findIndex(s => 'run' in s && s.name === 'release');
    if (releaseStepIndex !== -1) {
      steps.splice(releaseStepIndex, 0, {
        name: 'Pre-pull Docker image',
        run: 'for i in 1 2 3; do docker pull public.ecr.aws/docker/library/node:lts-alpine && break || sleep 15; done',
      });
      releaseWorkflow.updateJob('release', {
        ...releaseJob,
        steps,
      });
    }
  }
}

project.synth();
